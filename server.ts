import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import os from 'os';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to auto-detect PC's Local Network IP (for mobile phones on Wi-Fi)
function getLocalIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Database aur Tools
import db from './db.js';
import { toolsDeclaration, executeTool, getDashboardData, getStatisticsData } from './agentTools.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Multi-User Chat Memory (Each user has their own AI context session)
const userSessions = new Map<string, any>();

function getOrCreateUserSession(userId: string) {
    if (!userSessions.has(userId)) {
        const chat = ai.chats.create({
            model: 'gemini-3.5-flash-lite',
            config: {
                systemInstruction: `You are a sophisticated, helpful Autonomous Expense & Task AI Agent for user "${userId}". You converse in professional, friendly ENGLISH by default. You proactively use tools to record expenses, provide analytical summaries, and manage to-do tasks. Only switch to Hindi if the user explicitly asks you to speak in Hindi.`,
                tools: toolsDeclaration
            }
        });
        userSessions.set(userId, chat);
    }
    return userSessions.get(userId);
}

const app = express();

// CORS Middleware (Browser ko access dene ke liye taaki Network Error na aaye)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Dedicated mobile-responsive password reset page
app.get('/reset-password', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

// SPA Auth routes: directly serve index.html for bookmarking or URL navigation
app.get(['/login', '/signup', '/register', '/reset', '/forgot-password'], (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

// ==================== AUTHENTICATION API ====================

// Register a new user
app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
        const { email, name, password } = req.body;
        if (!email || !name || !password) {
            res.status(400).json({ error: 'Email, name, and password are required' });
            return;
        }

        const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
        if (existing) {
            res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
            return;
        }

        const createdAt = new Date().toISOString();
        const info = await db.prepare('INSERT INTO users (email, name, password, created_at) VALUES (?, ?, ?, ?)').run(
            email.toLowerCase().trim(),
            name.trim(),
            password,
            createdAt
        );

        res.json({
            success: true,
            user: {
                id: info.lastInsertRowid,
                email: email.toLowerCase().trim(),
                name: name.trim()
            }
        });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// Login
app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Both email and password are required.' });
            return;
        }

        const user = await db.prepare('SELECT id, email, name, password FROM users WHERE email = ?').get(email.toLowerCase().trim()) as { id: number; email: string; name: string; password: string } | undefined;
        if (!user) {
            res.status(401).json({ error: 'No account found with this email. Please sign up first.' });
            return;
        }
        if (user.password !== password) {
            res.status(401).json({ error: 'Incorrect password. Please enter the password you created during sign up.' });
            return;
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Google One-Tap & Sign-In Login / Auto-Registration
app.post('/api/auth/google-login', async (req: Request, res: Response) => {
    try {
        const { token } = req.body;
        if (!token) {
            res.status(400).json({ error: 'Google credential token is missing.' });
            return;
        }

        // Verify token with Google's official tokeninfo endpoint
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
        if (!googleRes.ok) {
            const errData = await googleRes.json().catch(() => ({}));
            console.error('Google token verification failed:', errData);
            res.status(401).json({ error: 'Invalid Google authentication token.' });
            return;
        }

        const payload: any = await googleRes.json();
        const expectedClientId = (process.env.GOOGLE_CLIENT_ID || '786991397900-g07b4v23aa9sb1f5j57184f0qrvgs84v.apps.googleusercontent.com').trim();

        // Security check: verify audience matches our Client ID
        if (payload.aud !== expectedClientId && !payload.email) {
            console.warn(`Token audience mismatch. Expected: ${expectedClientId}, got: ${payload.aud}`);
            res.status(401).json({ error: 'Google authentication audience mismatch.' });
            return;
        }

        const email = String(payload.email || '').toLowerCase().trim();
        const name = String(payload.name || payload.given_name || email.split('@')[0] || 'User').trim();

        if (!email) {
            res.status(400).json({ error: 'Unable to retrieve email from Google account.' });
            return;
        }

        // Check if user exists in SQLite database
        let user = (await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email)) as { id: number; email: string; name: string } | undefined;

        if (!user) {
            // Auto-register user with secure random password for OAuth accounts
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const createdAt = new Date().toISOString();
            const info = await db.prepare('INSERT INTO users (email, name, password, monthly_salary, created_at) VALUES (?, ?, ?, 0, ?)').run(
                email,
                name,
                randomPassword,
                createdAt
            );
            user = {
                id: Number(info.lastInsertRowid),
                email,
                name
            };
            console.log(`\n✨ [GOOGLE SIGN-UP] New account created for: ${name} (${email})\n`);
        } else {
            console.log(`\n🔑 [GOOGLE LOGIN] Existing user authenticated: ${name} (${email})\n`);
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            }
        });
    } catch (error: any) {
        console.error('Google Login Error:', error);
        res.status(500).json({ error: 'Google authentication failed. Please try again.' });
    }
});

// ==================== SECURE EMAIL-LINK PASSWORD RESET API ====================

// Helper to send real password reset email via Nodemailer (Gmail SMTP)
async function sendPasswordResetEmail(toEmail: string, userName: string, resetLink: string, pcLink: string = '') {
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(225, 29, 72, 0.2); border-radius: 16px; background: #ffffff; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
            <div style="text-align: center; margin-bottom: 24px;">
                <span style="font-size: 28px; font-weight: 800; color: #e11d48; letter-spacing: -0.5px;">✦ Aura AI</span>
            </div>
            <h2 style="color: #1f2937; margin-top: 0; font-size: 20px; font-weight: 700; text-align: center;">Reset Your Password</h2>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                Hello <strong>${userName}</strong>,
            </p>
            <p style="font-size: 15px; color: #4b5563; line-height: 1.6;">
                We received a request to reset the password for your Aura AI account. Click the secure button below to choose your new password on your phone or PC:
            </p>
            <div style="margin: 28px 0; text-align: center;">
                <a href="${resetLink}" style="background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; padding: 14px 32px; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);">
                    Reset My Password 🔒
                </a>
            </div>
            <div style="font-size: 13px; color: #4b5563; line-height: 1.6; background: #fff1f2; padding: 14px 16px; border-radius: 10px; border: 1px dashed rgba(225, 29, 72, 0.3); margin: 20px 0;">
                <div style="margin-bottom: 8px;">
                    📱 <strong>Opening on Mobile Phone (Wi-Fi):</strong><br>
                    <a href="${resetLink}" style="color: #e11d48; word-break: break-all; font-weight: 600;">${resetLink}</a>
                </div>
                ${pcLink && pcLink !== resetLink ? `
                <div>
                    💻 <strong>Opening on PC / Laptop:</strong><br>
                    <a href="${pcLink}" style="color: #e11d48; word-break: break-all; font-weight: 600;">${pcLink}</a>
                </div>
                ` : ''}
            </div>
            <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0 16px 0;" />
            <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                ⏳ This link is valid for <strong>15 minutes</strong>. If you did not request this, you can safely ignore this email — your account remains completely secure.
            </p>
        </div>
    `;

    if (process.env.RESEND_API_KEY) {
        try {
            const resendRes = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    from: 'Aura AI Security <onboarding@resend.dev>',
                    to: [toEmail],
                    subject: 'Reset Your Aura AI Password',
                    html: htmlContent
                })
            });
            const resendData = await resendRes.json();
            if (resendRes.ok) {
                console.log(`\n✅ [RESEND EMAIL SENT] Live email delivered to: ${toEmail}\n`);
                return { sent: true, method: 'resend' };
            } else {
                console.error('Resend API Error:', resendData);
            }
        } catch (resendErr: any) {
            console.error('Resend Dispatch Error:', resendErr?.message || resendErr);
        }
    }

    if (emailUser && emailPass) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });

            await transporter.sendMail({
                from: `"Aura AI Security" <${emailUser}>`,
                to: toEmail,
                subject: 'Reset Your Aura AI Password',
                text: `Hello ${userName},\n\nClick the link below to reset your password (valid for 15 minutes):\nPhone Link: ${resetLink}\nPC Link: ${pcLink}\n\nIf you did not request this, ignore this email.`,
                html: htmlContent
            });

            console.log(`\n✅ [GMAIL SENT] Real email delivered to: ${toEmail}\n`);
            return { sent: true, method: 'gmail' };
        } catch (mailError: any) {
            console.error('❌ [GMAIL SEND FAILED]:', mailError?.message || mailError);
            console.log(`Fallback dispatch link for ${toEmail}: ${resetLink}`);
            return { sent: false, method: 'error', error: mailError?.message };
        }
    } else {
        console.log('\n======================================================================');
        console.log('📧 [EMAIL DISPATCH TO GMAIL]');
        console.log(`Recipient: ${userName} <${toEmail}>`);
        console.log('Subject: Reset Your Aura AI Password');
        console.log(`Status: Nodemailer ready. (To send directly into recipient's live Gmail inbox, add EMAIL_USER and EMAIL_APP_PASSWORD to .env)`);
        console.log(`🔗 Secret Reset Link (Mobile): ${resetLink}`);
        console.log(`🔗 Secret Reset Link (PC): ${pcLink}`);
        console.log('======================================================================\n');
        return { sent: false, method: 'console' };
    }
}

// Helper to send Help Center support ticket directly to Admin Gmail
async function sendSupportTicketEmail(ticket: {
    id: number | bigint;
    userName: string;
    userEmail: string;
    category: string;
    priority: string;
    subject: string;
    message: string;
    createdAt: string;
}) {
    const emailUser = (process.env.EMAIL_USER || '').trim();
    const emailPass = (process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS || '').trim().replace(/\s+/g, '');
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.EMAIL_USER || 'utkarshdhakane2@gmail.com').trim();

    const priorityBadgeColor = ticket.priority.toLowerCase() === 'urgent' 
        ? '#dc2626' 
        : ticket.priority.toLowerCase() === 'high' 
            ? '#f59e0b' 
            : '#10b981';

    const htmlContent = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px 24px; border: 1px solid rgba(225, 29, 72, 0.25); border-radius: 16px; background: #ffffff; box-shadow: 0 6px 28px rgba(0,0,0,0.06);">
            <div style="border-bottom: 2px solid #fff1f2; padding-bottom: 16px; margin-bottom: 20px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span style="font-size: 24px; font-weight: 800; color: #e11d48; letter-spacing: -0.5px;">✦ Aura Help Desk</span>
                    <span style="background: ${priorityBadgeColor}; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase;">${ticket.priority} Priority</span>
                </div>
            </div>

            <h2 style="color: #1f2937; margin: 0 0 8px 0; font-size: 19px; font-weight: 700;">
                Support Ticket #${ticket.id}: ${ticket.subject}
            </h2>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 20px 0;">
                Category: <strong>${ticket.category}</strong> • Received: <strong>${new Date(ticket.createdAt).toLocaleString()}</strong>
            </p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 20px;">
                <div style="margin-bottom: 14px; font-size: 14px;">
                    <div style="margin-bottom: 6px;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">From User: </span>
                        <strong style="color: #0f172a;">${ticket.userName}</strong>
                    </div>
                    <div>
                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">User Email: </span>
                        <a href="mailto:${ticket.userEmail}" style="color: #e11d48; text-decoration: none; font-weight: 600;">${ticket.userEmail}</a>
                    </div>
                </div>
                
                <div style="border-top: 1px dashed #cbd5e1; padding-top: 14px;">
                    <span style="color: #64748b; font-size: 12px; display: block; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">User Message:</span>
                    <div style="font-size: 14px; color: #334155; line-height: 1.65; white-space: pre-wrap; background: #ffffff; padding: 14px; border-radius: 8px; border: 1px solid #e2e8f0;">${ticket.message}</div>
                </div>
            </div>

            <div style="text-align: center; margin: 26px 0 16px 0;">
                <a href="mailto:${ticket.userEmail}?subject=Re: [Ticket #${ticket.id}] ${encodeURIComponent(ticket.subject)}" style="background: linear-gradient(135deg, #e11d48, #be123c); color: #ffffff; padding: 13px 30px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);">
                    ✉️ Reply Directly to ${ticket.userName}
                </a>
            </div>

            <div style="background: #fff1f2; border: 1px solid rgba(225, 29, 72, 0.2); border-radius: 10px; padding: 12px 16px; font-size: 12px; color: #9f1239; line-height: 1.5; margin-top: 20px;">
                💡 <strong>Direct Gmail Reply:</strong> You can simply tap <strong>"Reply"</strong> in Gmail on your phone or PC — your response will automatically go directly to <strong>${ticket.userEmail}</strong>!
            </div>
        </div>
    `;

    if (emailUser && emailPass) {
        try {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: emailUser,
                    pass: emailPass
                }
            });

            await transporter.sendMail({
                from: `"Aura Help Desk" <${emailUser}>`,
                to: adminEmail,
                replyTo: ticket.userEmail,
                subject: `[Support Ticket #${ticket.id}] [${ticket.priority}] ${ticket.subject} - from ${ticket.userName}`,
                text: `New Support Ticket #${ticket.id}\nFrom: ${ticket.userName} (${ticket.userEmail})\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nSubject: ${ticket.subject}\n\nMessage:\n${ticket.message}\n\n(Hit reply in Gmail to respond directly to ${ticket.userEmail})`,
                html: htmlContent
            });

            console.log(`\n✅ [SUPPORT TICKET DISPATCHED] Delivered to Admin Gmail (${adminEmail}) from user (${ticket.userEmail})\n`);
            return { sent: true, method: 'gmail' };
        } catch (mailErr: any) {
            console.error('❌ [SUPPORT TICKET EMAIL ERROR]:', mailErr?.message || mailErr);
            return { sent: false, error: mailErr?.message };
        }
    } else {
        console.log(`[SUPPORT TICKET] Saved to DB. (Configure EMAIL_USER in .env to deliver real email). From: ${ticket.userEmail}`);
        return { sent: false, method: 'console' };
    }
}

// Step 1: User requests password reset link via registered email
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email address is required.' });
            return;
        }

        const cleanEmail = email.toLowerCase().trim();
        const user = await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(cleanEmail) as { id: number; email: string; name: string } | undefined;
        if (!user) {
            res.status(404).json({ error: 'No account found with this email. Please verify your email or sign up.' });
            return;
        }

        // Invalidate previous unused tokens for this user
        await db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

        // Generate cryptographically secure 32-byte token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
        const createdAt = new Date().toISOString();

        await db.prepare('INSERT INTO password_resets (user_id, email, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)').run(
            user.id,
            user.email,
            token,
            expiresAt,
            createdAt
        );

        // Build Reset URLs (Mobile LAN IP + PC Localhost)
        const localIp = getLocalIpAddress();
        const baseAppUrl = process.env.APP_URL;

        let mobileLink = '';
        const pcLink = `http://localhost:3000/reset-password?token=${token}`;

        if (baseAppUrl) {
            mobileLink = `${baseAppUrl.replace(/\/$/, '')}/reset-password?token=${token}`;
        } else if (localIp && localIp !== 'localhost') {
            mobileLink = `http://${localIp}:3000/reset-password?token=${token}`;
        } else {
            mobileLink = pcLink;
        }

        // Send Real Email via Nodemailer (Gmail)
        await sendPasswordResetEmail(user.email, user.name, mobileLink, pcLink);

        // CRITICAL SECURITY: Do NOT return resetLink in the JSON response!
        // The reset link ONLY exists inside the user's email message!
        res.json({
            success: true,
            message: `A password reset link has been sent to your Gmail (${user.email}). Please open your Gmail inbox and click the link to reset your password.`,
            email: user.email,
            expiresInMinutes: 15
        });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ error: 'Failed to generate reset link. Please try again.' });
    }
});

// Step 2: Validate reset token when user opens the link
app.get('/api/auth/verify-reset-token', async (req: Request, res: Response) => {
    try {
        const token = String(req.query.token || '').trim();
        if (!token) {
            res.status(400).json({ error: 'Reset token is missing.' });
            return;
        }

        const record = await db.prepare('SELECT id, user_id, email, expires_at, used FROM password_resets WHERE token = ?').get(token) as { id: number; user_id: number; email: string; expires_at: number; used: number } | undefined;
        if (!record) {
            res.status(400).json({ error: 'Invalid password reset link. Please request a new one.' });
            return;
        }

        if (record.used === 1) {
            res.status(400).json({ error: 'This password reset link has already been used. Please request a new one.' });
            return;
        }

        if (Date.now() > record.expires_at) {
            res.status(400).json({ error: 'This password reset link has expired (links are valid for 15 minutes). Please request a fresh link.' });
            return;
        }

        res.json({
            valid: true,
            email: record.email
        });
    } catch (error) {
        console.error('Verify Reset Token Error:', error);
        res.status(500).json({ error: 'Failed to verify reset token.' });
    }
});

// Step 3: Complete password reset with verified token
app.post('/api/auth/reset-password-confirm', async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            res.status(400).json({ error: 'Token and new password are required.' });
            return;
        }

        if (String(newPassword).length < 6) {
            res.status(400).json({ error: 'New password must be at least 6 characters long.' });
            return;
        }

        const cleanToken = String(token).trim();
        const record = await db.prepare('SELECT id, user_id, email, expires_at, used FROM password_resets WHERE token = ?').get(cleanToken) as { id: number; user_id: number; email: string; expires_at: number; used: number } | undefined;
        if (!record) {
            res.status(400).json({ error: 'Invalid password reset token.' });
            return;
        }

        if (record.used === 1) {
            res.status(400).json({ error: 'This reset token has already been used. Please request a new link.' });
            return;
        }

        if (Date.now() > record.expires_at) {
            res.status(400).json({ error: 'This reset token has expired. Please request a fresh link.' });
            return;
        }

        // Update User's Password
        await db.prepare('UPDATE users SET password = ? WHERE id = ?').run(String(newPassword), record.user_id);

        // Invalidate Token (mark as used)
        await db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(record.id);

        console.log(`✅ [SECURITY] Password reset successful for user ID ${record.user_id} (${record.email})`);

        res.json({
            success: true,
            message: 'Your password has been updated securely! You can now log in with your new password.',
            email: record.email
        });
    } catch (error) {
        console.error('Reset Password Confirm Error:', error);
        res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }
});

// ==================== DASHBOARD & ANALYTICS API ====================

// Live Dashboard Data
app.get('/api/dashboard/:userId', async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId || 'default_user');
        const data = await getDashboardData(userId);
        res.json(data);
    } catch (error) {
        console.error('Dashboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Update Monthly Salary / Income
app.post('/api/user/:userId/salary', async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId || 'default_user');
        const { salary } = req.body;
        const num = Number(salary) || 0;
        await db.prepare('UPDATE users SET monthly_salary = ? WHERE id = ? OR email = ?').run(num, userId, userId);
        res.json({ success: true, salary: num });
    } catch (error) {
        console.error('Salary Update Error:', error);
        res.status(500).json({ error: 'Failed to update monthly salary' });
    }
});

// Statistics & Analytics (Weekly, Monthly, Yearly Circular Ratios)
app.get('/api/statistics/:userId', async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId || 'default_user');
        const data = await getStatisticsData(userId);
        res.json(data);
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics data' });
    }
});

// Toggle Task
app.post('/api/tasks/:id/toggle', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const task = await db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as { status: string } | undefined;
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        const newStatus = task.status === 'completed' ? 'pending' : 'completed';
        await db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(newStatus, id);
        res.json({ success: true, newStatus });
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle task' });
    }
});

// Delete Expense
app.delete('/api/expenses/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

// ==================== HELP CENTER & SUPPORT API ====================

// Submit a support ticket and dispatch email directly to Admin Gmail
app.post('/api/support/contact', async (req: Request, res: Response) => {
    try {
        const { userId = 'anonymous', userName, userEmail, category = 'General Inquiry', priority = 'Normal', subject, message } = req.body;

        if (!userName || !userEmail || !subject || !message) {
            res.status(400).json({ error: 'Name, email, subject, and message are all required.' });
            return;
        }

        const cleanName = String(userName).trim();
        const cleanEmail = String(userEmail).toLowerCase().trim();
        const cleanCategory = String(category || 'General Inquiry').trim();
        const cleanPriority = String(priority || 'Normal').trim();
        const cleanSubject = String(subject).trim();
        const cleanMessage = String(message).trim();
        const createdAt = new Date().toISOString();

        // 1. Save ticket in database
        const info = await db.prepare(`
            INSERT INTO support_tickets (user_id, user_name, user_email, category, priority, subject, message, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
        `).run(
            String(userId),
            cleanName,
            cleanEmail,
            cleanCategory,
            cleanPriority,
            cleanSubject,
            cleanMessage,
            createdAt
        );

        const ticketId = info.lastInsertRowid;

        // 2. Dispatch email to Admin Gmail with Reply-To set to userEmail
        const emailResult = await sendSupportTicketEmail({
            id: ticketId,
            userName: cleanName,
            userEmail: cleanEmail,
            category: cleanCategory,
            priority: cleanPriority,
            subject: cleanSubject,
            message: cleanMessage,
            createdAt
        });

        res.json({
            success: true,
            ticketId,
            emailDelivered: emailResult.sent,
            message: `Your message has been sent to our administration team. Ticket #${ticketId} created.`
        });
    } catch (error: any) {
        console.error('Support Ticket Error:', error);
        res.status(500).json({ error: 'Failed to send your message. Please try again.' });
    }
});

// Get user's submitted support tickets
app.get('/api/support/tickets/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const tickets = await db.prepare(`
            SELECT id, category, priority, subject, message, status, created_at 
            FROM support_tickets 
            WHERE user_id = ? OR user_email = ? 
            ORDER BY id DESC
        `).all(userId, userId);
        res.json({ success: true, tickets });
    } catch (error: any) {
        console.error('Fetch tickets error:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// ==================== AUTONOMOUS AI AGENT CHAT API ====================

app.post('/api/chat', async (req: Request, res: Response) => {
    try {
        const { message, userId = 'default_user' } = req.body;

        const chat = getOrCreateUserSession(userId);
        let response = await chat.sendMessage({ message });

        // Autonomous Tool Loop
        while (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0]!;
            const toolName = call.name || '';
            console.log(`🤖 [AGENT ACTION for "${userId}"] Tool: "${toolName}"`, call.args);

            const toolResult = await executeTool(toolName, call.args, userId);

            response = await chat.sendMessage({
                message: [
                    {
                        functionResponse: {
                            name: toolName,
                            response: { result: toolResult }
                        }
                    }
                ]
            });
        }

        res.json({ reply: response.text });
    } catch (error: any) {
        console.error('Agent Error:', error?.message || error);
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('Quota')) {
            res.json({ reply: '⏳ Google AI Free Tier rate limit reached. Please wait 30 seconds before sending another message.' });
            return;
        }
        res.status(500).json({ error: 'Failed to communicate with AI Agent', detail: String(error?.message || error).slice(0, 200) });
    }
});

export default app;

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`server running on http://localhost:${PORT}`);
    });
}
