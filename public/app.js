// ==========================================================================
// AURA AI — FULL-STACK ENGINE (LENIS + GSAP + AUTH + AI DRAWER)
// ==========================================================================

// Global Currency Symbol
let currentCurrency = '₹';

// Current Authenticated User
let currentUser = null;

// Base API URL: Automatically routes to port 3000 even if opened via VS Code Live Server (5500) or file://
// Base API URL: Automatically routes to port 3000 even if opened via VS Code Live Server (5500) or file://
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' && window.location.port !== ''
    ? 'http://localhost:3000'
    : '';

// Clear poisoned Google GIS state cookie so account clicks never get suppressed
function clearGoogleGsiState() {
    try {
        const hostname = window.location.hostname;
        document.cookie = "g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + hostname;
        document.cookie = "g_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=." + hostname;
    } catch(e) {}
}
clearGoogleGsiState();

// ==================== 1. NATIVE SMOOTH SCROLL & CHIPS HORIZONTAL SCROLL ====================
// Native smooth scroll enabled without any third-party hijacking
document.addEventListener('DOMContentLoaded', () => {
    // Enable horizontal wheel scroll for AI agent prompt chips
    const setupChipsScroll = () => {
        const drawerChips = document.querySelector('.drawer-chips');
        if (drawerChips) {
            drawerChips.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    drawerChips.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }
    };
    setupChipsScroll();
});

// ==================== 2. AUTHENTICATION (LOGIN / SIGNUP / RESET / SESSION) ====================
const authModal = document.getElementById('auth-modal');
const dashboardApp = document.getElementById('dashboard-app');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authToggleBtn = document.getElementById('auth-toggle-btn');
const authToggleText = document.getElementById('auth-toggle-text');

const nameGroup = document.getElementById('name-group');
const authName = document.getElementById('auth-name');
const emailGroup = document.getElementById('email-group');
const authEmail = document.getElementById('auth-email');

const passwordGroup = document.getElementById('password-group');
const authPassword = document.getElementById('auth-password');
const passwordLabel = document.getElementById('password-label');
const passwordToggleBtn = document.getElementById('password-toggle-btn');
const forgotPasswordLink = document.getElementById('forgot-password-link');

const confirmPasswordGroup = document.getElementById('confirm-password-group');
const authConfirmPassword = document.getElementById('auth-confirm-password');
const confirmPasswordToggleBtn = document.getElementById('confirm-password-toggle-btn');

const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

const tabLoginBtn = document.getElementById('tab-login-btn');
const tabSignupBtn = document.getElementById('tab-signup-btn');
const tabResetBtn = document.getElementById('tab-reset-btn');

let currentAuthMode = 'login'; // 'login' | 'signup' | 'forgot' | 'set-new-password'
let activeResetToken = null;
let activeResetEmail = null;

// Set Mode Function
window.setAuthMode = function(mode) {
    currentAuthMode = mode || 'login';
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';
    if (authSubmitBtn) authSubmitBtn.disabled = false;

    // Update active tab buttons
    [tabLoginBtn, tabSignupBtn, tabResetBtn].forEach(btn => btn?.classList.remove('active'));

    if (currentAuthMode === 'signup') {
        tabSignupBtn?.classList.add('active');
        authTitle.innerText = 'Create an Account';
        authSubtitle.innerText = 'Create your personal account to isolate and protect your data';
        authSubmitBtn.innerText = 'Sign Up';
        authToggleText.innerText = 'Already have an account?';
        authToggleBtn.innerText = 'Log In';

        nameGroup.style.display = 'flex';
        authName.required = true;
        emailGroup.style.display = 'flex';
        authEmail.required = true;
        passwordGroup.style.display = 'flex';
        authPassword.required = true;
        passwordLabel.innerText = 'Create Password';
        authPassword.placeholder = 'Create your password';
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
        if (authConfirmPassword) authConfirmPassword.required = false;

        setTimeout(() => authName?.focus(), 60);
        if (window.location.hash !== '#signup') history.replaceState(null, '', '#signup');

    } else if (currentAuthMode === 'forgot' || currentAuthMode === 'reset') {
        currentAuthMode = 'forgot';
        tabResetBtn?.classList.add('active');
        authTitle.innerText = 'Forgot Your Password?';
        authSubtitle.innerText = 'Enter your registered email address to receive a secure reset link';
        authSubmitBtn.innerText = 'Send Reset Link 📩';
        authToggleText.innerText = 'Remember your password?';
        authToggleBtn.innerText = 'Back to Log In';

        nameGroup.style.display = 'none';
        authName.required = false;
        emailGroup.style.display = 'flex';
        authEmail.required = true;
        passwordGroup.style.display = 'none';
        authPassword.required = false;
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
        if (authConfirmPassword) authConfirmPassword.required = false;

        setTimeout(() => authEmail?.focus(), 60);
        if (window.location.hash !== '#forgot') history.replaceState(null, '', '#forgot');

    } else if (currentAuthMode === 'set-new-password') {
        // Step 2 of Password Reset (After clicking the email token link)
        authTitle.innerText = 'Create New Password';
        authSubtitle.innerText = activeResetEmail 
            ? `Setting a fresh secure password for ${activeResetEmail}` 
            : 'Enter and confirm your new secure password';
        authSubmitBtn.innerText = 'Save New Password 🔒';
        authToggleText.innerText = 'Remembered password or cancel?';
        authToggleBtn.innerText = 'Back to Log In';

        nameGroup.style.display = 'none';
        authName.required = false;
        emailGroup.style.display = 'none';
        authEmail.required = false;
        passwordGroup.style.display = 'flex';
        authPassword.required = true;
        passwordLabel.innerText = 'New Password (min 6 chars)';
        authPassword.placeholder = 'Enter new password';
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'none';

        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'flex';
        if (authConfirmPassword) {
            authConfirmPassword.required = true;
            authConfirmPassword.value = '';
        }
        authPassword.value = '';

        setTimeout(() => authPassword?.focus(), 60);

    } else {
        // Default: Log In
        currentAuthMode = 'login';
        tabLoginBtn?.classList.add('active');
        authTitle.innerText = 'Log In to Your Account';
        authSubtitle.innerText = 'Enter your email and password to access your financial workspace';
        authSubmitBtn.innerText = 'Log In';
        authToggleText.innerText = "Don't have an account yet?";
        authToggleBtn.innerText = 'Sign Up';

        nameGroup.style.display = 'none';
        authName.required = false;
        emailGroup.style.display = 'flex';
        authEmail.required = true;
        passwordGroup.style.display = 'flex';
        authPassword.required = true;
        passwordLabel.innerText = 'Password';
        authPassword.placeholder = 'Enter your password';
        if (forgotPasswordLink) forgotPasswordLink.style.display = 'inline-block';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
        if (authConfirmPassword) authConfirmPassword.required = false;

        setTimeout(() => authEmail?.focus(), 60);
        if (window.location.hash !== '#login') history.replaceState(null, '', '#login');
    }

    // Toggle Google Sign-In visibility depending on auth mode
    const googleDivider = document.getElementById('google-auth-divider');
    const googleSigninWrapper = document.getElementById('google-signin-wrapper');
    const showGoogle = currentAuthMode === 'login' || currentAuthMode === 'signup';
    if (googleDivider) googleDivider.style.display = showGoogle ? 'flex' : 'none';
    if (googleSigninWrapper) googleSigninWrapper.style.display = showGoogle ? 'flex' : 'none';
};

// ==================== GOOGLE ONE-TAP & SIGN-IN HANDLER ====================
window._handleGoogleLoginImpl = async function(response) {
    if (!response || !response.credential) {
        console.error('Google response missing credential');
        return;
    }

    if (authError) authError.style.display = 'none';
    if (authSuccess) {
        authSuccess.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;background:rgba(244,63,94,0.12);border:1px solid rgba(244,63,94,0.3);border-radius:12px;color:#fda4af;font-weight:600;font-size:0.86rem;"><span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(253,164,175,0.3);border-top-color:#fda4af;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Authenticating with Google account...</div>';
        authSuccess.style.display = 'block';
    }

    try {
        const res = await fetch(`${API_BASE}/api/auth/google-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            if (authError) {
                authError.innerText = data.error || 'Google Sign-In failed. Please try again.';
                authError.style.display = 'block';
            }
            if (authSuccess) authSuccess.style.display = 'none';
            return;
        }

        // Successfully Authenticated!
        currentUser = data.user;
        localStorage.setItem('aura_user', JSON.stringify(currentUser));

        if (authSuccess) {
            authSuccess.innerHTML = `<div style="font-weight:700;color:#10b981;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 14px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:12px;font-size:0.88rem;">🎉 Welcome, ${escapeHtml(currentUser.name)}! Opening Dashboard...</div>`;
            authSuccess.style.display = 'block';
        }

        setTimeout(() => {
            initAppForUser();
        }, 400);

    } catch (err) {
        console.error('Google login fetch error:', err);
        if (authError) {
            authError.innerText = 'Connection error during Google Sign-In.';
            authError.style.display = 'block';
        }
        if (authSuccess) authSuccess.style.display = 'none';
    }
};
window.handleGoogleLogin = window._handleGoogleLoginImpl;

// If a Google response arrived before app.js loaded, process it immediately
if (window._pendingGoogleResponse) {
    window._handleGoogleLoginImpl(window._pendingGoogleResponse);
    delete window._pendingGoogleResponse;
}

// Bottom Toggle Function (Deterministic switch)
window.toggleAuthMode = function(explicitMode) {
    if (explicitMode) {
        setAuthMode(explicitMode);
        return;
    }
    if (currentAuthMode === 'signup' || currentAuthMode === 'forgot' || currentAuthMode === 'set-new-password') {
        setAuthMode('login');
    } else {
        setAuthMode('signup');
    }
};

// Tab Click Events (Clear previous and assign cleanly)
if (tabLoginBtn) tabLoginBtn.onclick = (e) => { e.preventDefault(); setAuthMode('login'); };
if (tabSignupBtn) tabSignupBtn.onclick = (e) => { e.preventDefault(); setAuthMode('signup'); };
if (tabResetBtn) tabResetBtn.onclick = (e) => { e.preventDefault(); setAuthMode('forgot'); };
if (forgotPasswordLink) forgotPasswordLink.onclick = (e) => { e.preventDefault(); setAuthMode('forgot'); };

// Bottom Toggle Button (Explicit toggle with single handler)
if (authToggleBtn) {
    authToggleBtn.onclick = (e) => {
        e.preventDefault();
        window.toggleAuthMode();
    };
}

// Hash Change Listener
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['login', 'signup', 'forgot', 'reset'].includes(hash)) {
        setAuthMode(hash === 'reset' ? 'forgot' : hash);
    }
});

// Password Show / Hide Eye Toggles
let isPasswordVisible = false;
passwordToggleBtn?.addEventListener('click', () => {
    isPasswordVisible = !isPasswordVisible;
    authPassword.type = isPasswordVisible ? 'text' : 'password';
    passwordToggleBtn.innerText = isPasswordVisible ? '🙈' : '👁️';
});

let isConfirmPasswordVisible = false;
confirmPasswordToggleBtn?.addEventListener('click', () => {
    isConfirmPasswordVisible = !isConfirmPasswordVisible;
    authConfirmPassword.type = isConfirmPasswordVisible ? 'text' : 'password';
    confirmPasswordToggleBtn.innerText = isConfirmPasswordVisible ? '🙈' : '👁️';
});

// Auth Form Submit Handler
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (authError) authError.style.display = 'none';
    if (authSuccess) authSuccess.style.display = 'none';

    const email = authEmail.value.trim();
    const password = authPassword.value;
    const name = authName.value.trim();

    // ================= STEP 1: FORGOT PASSWORD (EMAIL LINK REQUEST) =================
    if (currentAuthMode === 'forgot') {
        if (!email) {
            authError.innerText = 'Please enter your registered email address.';
            authError.style.display = 'block';
            return;
        }

        const origBtnText = authSubmitBtn.innerText;
        authSubmitBtn.disabled = true;
        authSubmitBtn.innerText = 'Sending Link... ⏳';

        try {
            const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = origBtnText;

            if (!res.ok) {
                authError.innerHTML = `${data.error || 'Failed to send reset link.'} <button type="button" onclick="setAuthMode('signup')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Sign Up Instead 👉</button>`;
                authError.style.display = 'block';
                return;
            }

            authSuccess.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: #047857;">📩 Password Reset Email Sent!</div>
                    <div style="font-size: 0.85rem; line-height: 1.5; color: #065f46;">
                        A secure password reset link has been sent to <strong>${escapeHtml(data.email)}</strong>.<br>
                        Please check your Gmail inbox (and Spam folder) and click the link in the email to reset your password.
                    </div>
                    <div style="font-size: 0.78rem; color: #059669; opacity: 0.85;">⏳ For your security, this link expires in 15 minutes.</div>
                </div>
            `;
            authSuccess.style.display = 'block';
            authSubmitBtn.disabled = true;
            authSubmitBtn.innerText = 'Check Your Gmail Inbox 📩';
        } catch (err) {
            console.error('Forgot password fetch error:', err);
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = origBtnText;
            authError.innerText = 'Connection error: Unable to reach server.';
            authError.style.display = 'block';
        }
        return;
    }

    // ================= STEP 2: SET NEW PASSWORD (VIA VERIFIED TOKEN) =================
    if (currentAuthMode === 'set-new-password') {
        const confirmPassword = authConfirmPassword ? authConfirmPassword.value : '';

        if (!password || password.length < 6) {
            authError.innerText = 'New password must be at least 6 characters long.';
            authError.style.display = 'block';
            return;
        }

        if (password !== confirmPassword) {
            authError.innerText = 'Passwords do not match. Please verify and re-enter.';
            authError.style.display = 'block';
            return;
        }

        if (!activeResetToken) {
            authError.innerText = 'Invalid or missing reset token. Please request a new link.';
            authError.style.display = 'block';
            return;
        }

        const origBtnText = authSubmitBtn.innerText;
        authSubmitBtn.disabled = true;
        authSubmitBtn.innerText = 'Updating Password... ⏳';

        try {
            const res = await fetch(`${API_BASE}/api/auth/reset-password-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: activeResetToken, newPassword: password })
            });
            const data = await res.json();
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = origBtnText;

            if (!res.ok) {
                authError.innerHTML = `${data.error || 'Failed to update password.'} <button type="button" onclick="setAuthMode('forgot')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Request New Link 👉</button>`;
                authError.style.display = 'block';
                return;
            }

            authSuccess.innerText = 'Password updated successfully! Redirecting to Log In...';
            authSuccess.style.display = 'block';

            // Clean up reset state
            const targetEmail = activeResetEmail || '';
            activeResetToken = null;
            activeResetEmail = null;

            setTimeout(() => {
                setAuthMode('login');
                if (targetEmail) authEmail.value = targetEmail;
                authSuccess.innerText = 'Password updated! Please enter your new password to log in.';
                authSuccess.style.display = 'block';
            }, 1200);

        } catch (err) {
            console.error('Reset password confirm fetch error:', err);
            authSubmitBtn.disabled = false;
            authSubmitBtn.innerText = origBtnText;
            authError.innerText = 'Connection error: Unable to reach server.';
            authError.style.display = 'block';
        }
        return;
    }

    // ================= LOGIN AND REGISTER MODES =================
    const origBtnText = authSubmitBtn.innerText;
    authSubmitBtn.disabled = true;
    authSubmitBtn.innerText = 'Please wait... ⏳';

    let endpoint = '/api/auth/login';
    let payload = { email, password };

    if (currentAuthMode === 'signup') {
        endpoint = '/api/auth/register';
        payload = { email, password, name };
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        authSubmitBtn.disabled = false;
        authSubmitBtn.innerText = origBtnText;

        if (!res.ok) {
            let errorMsg = data.error || 'Authentication failed';
            
            // Helpful smart actions
            if (errorMsg.includes('already exists')) {
                authError.innerHTML = `${errorMsg} <button type="button" onclick="setAuthMode('login')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Switch to Log In 👉</button>`;
            } else if (errorMsg.includes('No account found')) {
                authError.innerHTML = `${errorMsg} <button type="button" onclick="setAuthMode('signup')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Create Account 👉</button>`;
            } else if (errorMsg.includes('Incorrect password')) {
                authError.innerHTML = `${errorMsg} <button type="button" onclick="setAuthMode('forgot')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Reset Password 👉</button>`;
            } else {
                authError.innerText = errorMsg;
            }
            authError.style.display = 'block';
            return;
        }

        // Save User Session in LocalStorage
        currentUser = data.user;
        localStorage.setItem('aura_user', JSON.stringify(currentUser));
        initAppForUser();

    } catch (err) {
        console.error('Fetch error:', err);
        authSubmitBtn.disabled = false;
        authSubmitBtn.innerText = origBtnText;
        authError.innerText = 'Connection error: Please check your internet connection and try again.';
        authError.style.display = 'block';
    }
});

// Logout Handler (can optionally open directly to 'signup' or 'login')

// ==================== GOOGLE OAUTH2 TOKEN CLIENT (CUSTOM BUTTON) ====================
let googleTokenClient = null;

window.initGoogleAuth = function() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) {
        try {
            googleTokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: '786991397900-g07b4v23aa9sb1f5j57184f0qrvgs84v.apps.googleusercontent.com',
                scope: 'email profile openid',
                prompt: 'select_account',
                callback: async (tokenResponse) => {
                    if (tokenResponse.error) {
                        console.error('Google OAuth2 error:', tokenResponse.error);
                        if (authError) {
                            authError.innerText = 'Google Sign-In was cancelled or failed. Please try again.';
                            authError.style.display = 'block';
                        }
                        if (authSuccess) authSuccess.style.display = 'none';
                        return;
                    }
                    if (tokenResponse.access_token) {
                        await window.handleGoogleLogin({ credential: tokenResponse.access_token });
                    }
                }
            });
            console.log('Google OAuth2 TokenClient initialized successfully!');
        } catch (e) {
            console.error('Failed to init Google OAuth2 TokenClient:', e);
        }
    }
};

// Also attempt initialization on startup in case library is already present
if (window.google) {
    window.initGoogleAuth();
}

// Attach click listener to custom-google-btn
document.addEventListener('DOMContentLoaded', () => {
    const customGoogleBtn = document.getElementById('custom-google-btn');
    if (customGoogleBtn) {
        customGoogleBtn.addEventListener('click', () => {
            if (authError) authError.style.display = 'none';
            if (authSuccess) {
                authSuccess.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:10px 14px;background:rgba(244,63,94,0.12);border:1px solid rgba(244,63,94,0.3);border-radius:12px;color:#fda4af;font-weight:600;font-size:0.86rem;"><span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(253,164,175,0.3);border-top-color:#fda4af;border-radius:50%;animation:spin 0.8s linear infinite;"></span> Opening Google Account Chooser...</div>';
                authSuccess.style.display = 'block';
            }

            if (googleTokenClient) {
                googleTokenClient.requestAccessToken({ prompt: 'select_account' });
            } else if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                window.initGoogleAuth();
                googleTokenClient?.requestAccessToken({ prompt: 'select_account' });
            } else if (window.google && window.google.accounts && window.google.accounts.id) {
                window.google.accounts.id.prompt();
            } else {
                if (authError) {
                    authError.innerText = 'Google authentication is initializing. Please tap again in 1 second.';
                    authError.style.display = 'block';
                }
                if (authSuccess) authSuccess.style.display = 'none';
            }
        });
    }
});


window.logout = function(targetMode = 'login') {
    clearGoogleGsiState();
    // 1. Clear local user session
    localStorage.removeItem('aura_user');
    currentUser = null;

    // 2. Disable auto-select in Google Identity Services so Google doesn't silently re-login
    if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
            window.google.accounts.id.disableAutoSelect();
        } catch(e) {}
    }

    // 3. Save targetMode in sessionStorage (e.g. if 'signup' or 'login' was requested)
    if (targetMode === 'signup') {
        sessionStorage.setItem('aura_auth_mode', 'signup');
    } else {
        sessionStorage.removeItem('aura_auth_mode');
    }

    // 4. Instant clean redirect to login screen
    // This resets the Google GIS library, avoids iframe desync, and enables the Google account switcher!
    window.location.replace('/');
};

document.getElementById('logout-btn')?.addEventListener('click', () => window.logout('login'));
document.getElementById('settings-logout-btn')?.addEventListener('click', () => window.logout('login'));
document.getElementById('settings-signup-new-btn')?.addEventListener('click', () => window.logout('signup'));

// Check for Password Reset Token in URL
async function checkResetTokenInUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');

    // Also inspect hash (e.g. #reset-password?token=XYZ or #token=XYZ)
    if (!token && window.location.hash.includes('token=')) {
        const hashQuery = window.location.hash.includes('?') 
            ? window.location.hash.split('?')[1] 
            : window.location.hash.replace('#', '');
        const hashParams = new URLSearchParams(hashQuery);
        token = hashParams.get('token');
    }

    if (token) {
        activeResetToken = token;
        dashboardApp.style.setProperty('display', 'none', 'important');
        authModal.style.setProperty('display', 'flex', 'important');

        authSubmitBtn.disabled = true;
        authSubmitBtn.innerText = 'Verifying security link... ⏳';

        try {
            const res = await fetch(`${API_BASE}/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
            const data = await res.json();
            authSubmitBtn.disabled = false;

            if (res.ok && data.valid) {
                activeResetEmail = data.email;
                setAuthMode('set-new-password');
                return true;
            } else {
                setAuthMode('forgot');
                authError.innerHTML = `${data.error || 'This reset link is invalid or has expired.'} <button type="button" onclick="setAuthMode('forgot')" style="margin-left:6px; color:#be123c; font-weight:700; text-decoration:underline; background:none; border:none; cursor:pointer;">Request New Link 👉</button>`;
                authError.style.display = 'block';
                return true;
            }
        } catch (err) {
            console.error('Verify token failed:', err);
            authSubmitBtn.disabled = false;
        }
    }
    return false;
}

// Initialize Session on Load
async function checkAuth() {
    // 1. Prioritize Reset Token in URL if present
    const hasToken = await checkResetTokenInUrl();
    if (hasToken) return;

    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    const pathname = (window.location.pathname || '').toLowerCase();

    const isExplicitSignup = hash === 'signup' || pathname === '/signup' || pathname === '/register';
    const isExplicitForgot = hash === 'forgot' || hash === 'reset' || pathname === '/forgot-password' || pathname === '/reset-password';
    const isExplicitLogin = hash === 'login' || pathname === '/login';

    // If user specifically navigated to /signup or #signup, prioritize showing the signup page
    if (isExplicitSignup) {
        dashboardApp.style.display = 'none';
        authModal.style.display = 'flex';
        setAuthMode('signup');
        return;
    }

    // If user specifically navigated to /forgot-password or /reset-password without token, show forgot password
    if (isExplicitForgot) {
        dashboardApp.style.display = 'none';
        authModal.style.display = 'flex';
        setAuthMode('forgot');
        return;
    }

    if (!isExplicitLogin) {
        const saved = localStorage.getItem('aura_user');
        if (saved) {
            try {
                currentUser = JSON.parse(saved);
                initAppForUser();
                return;
            } catch (e) {
                localStorage.removeItem('aura_user');
            }
        }
    }

    // Show Auth Modal
    document.body.classList.remove('logged-in');
    document.body.classList.add('logged-out');
    authModal.style.display = 'flex';
    dashboardApp.style.display = 'none';
    const postLogoutMode = sessionStorage.getItem('aura_auth_mode');
    if (postLogoutMode) {
        sessionStorage.removeItem('aura_auth_mode');
        setAuthMode(postLogoutMode);
    } else {
        setAuthMode('login');
    }
}

function initAppForUser() {
    document.body.classList.add('logged-in');
    document.body.classList.remove('logged-out');
    authModal.style.setProperty('display', 'none', 'important');
    dashboardApp.style.setProperty('display', 'flex', 'important');

    // Populate Sidebar User Profile
    const initials = (currentUser.name || 'User').charAt(0).toUpperCase();
    document.getElementById('sidebar-avatar').innerText = initials;
    document.getElementById('sidebar-username').innerText = currentUser.name || 'User';
    document.getElementById('sidebar-email').innerText = currentUser.email;

    // Populate Settings
    document.getElementById('settings-name-display').innerText = currentUser.name || 'User';
    document.getElementById('settings-email-display').innerText = currentUser.email;

    // Populate Help Center Form
    const supportNameInput = document.getElementById('support-name');
    const supportEmailInput = document.getElementById('support-email');
    if (supportNameInput) supportNameInput.value = currentUser.name || '';
    if (supportEmailInput) supportEmailInput.value = currentUser.email || '';
    loadUserTickets();

    // Entrance Animation with GSAP
    if (typeof gsap !== 'undefined') {
        gsap.from('#dashboard-app', { opacity: 0, y: 15, duration: 0.5, ease: 'power2.out' });
    }

    // Load User Data
    refreshAllData();
}

// ==================== 3. VIEW NAVIGATION (DASHBOARD / STATS / SETTINGS / HELP) ====================
const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageHeading = document.getElementById('page-heading');
const pageSubheading = document.getElementById('page-subheading');

const viewMeta = {
    'view-dashboard': { title: 'Dashboard', subtitle: 'Personal overview and financial insights' },
    'view-statistics': { title: 'Statistics & Analytics', subtitle: 'Circular spending ratios across Week, Month, and Year' },
    'view-udhar': { title: 'Money Lent Ledger', subtitle: 'Manage issued capital, configure custom interest models, and reconcile repayments' },
    'view-borrowed': { title: 'Money Borrowed (Debt Liabilities)', subtitle: 'Track loans received from creditors, monitor daily interest, and record repayments' },
    'view-calendar': { title: 'Calendar & Monthly History', subtitle: 'Interactive daily financial activity matrix and historical month-by-month archive' },
    'view-settings': { title: 'Settings', subtitle: 'Account preferences and SQLite database configuration' },
    'view-help': { title: 'Help Center & Support', subtitle: 'Submit tickets directly to our admin desk — real-time Gmail dispatch' }
};

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const targetView = item.getAttribute('data-view');
        if (!targetView) return;

        // Sync active state on both desktop sidebar and mobile bottom nav
        document.querySelectorAll('.nav-item').forEach(n => {
            if (n.getAttribute('data-view') === targetView) {
                n.classList.add('active');
            } else {
                n.classList.remove('active');
            }
        });

        viewPanels.forEach(panel => {
            if (panel.id === targetView) {
                panel.style.display = 'block';
                if (typeof gsap !== 'undefined') {
                    gsap.fromTo(panel, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
                }
            } else {
                panel.style.display = 'none';
            }
        });

        // Update Heading
        if (viewMeta[targetView]) {
            pageHeading.innerText = viewMeta[targetView].title;
            pageSubheading.innerText = viewMeta[targetView].subtitle;
        }

        // If switching to stats, animate circular rings
        if (targetView === 'view-statistics') {
            loadStatistics();
        }

        // If switching to udhar, load lent records
        if (targetView === 'view-udhar') {
            loadLentData();
        }

        // If switching to borrowed, load borrowed debt records
        if (targetView === 'view-borrowed') {
            loadBorrowedData();
        }

        // If switching to calendar, load calendar month
        if (targetView === 'view-calendar') {
            loadCalendarMonth();
        }

        // If switching to help, reload tickets
        if (targetView === 'view-help') {
            loadUserTickets();
        }

        initGsapHoverEffects();
    });
});

// ==================== 4. LIVE DASHBOARD DATA & CRUD ====================
async function loadDashboard() {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/dashboard/${userId}`);
        const data = await res.json();
        const analytics = data.analytics || {};

        // 1. Update KPI Cards & Salary Metrics
        const monthlySalary = Number(data.monthlySalary) || 0;
        const monthSpent = Number(data.monthTotal) || 0;
        const remainingBalance = data.availableBalance !== undefined ? Number(data.availableBalance) : (data.remainingBalance !== undefined ? Number(data.remainingBalance) : (monthlySalary > 0 ? (monthlySalary - monthSpent) : 0));
        const savingsRate = monthlySalary > 0 ? Math.max(0, Math.round((remainingBalance / monthlySalary) * 100)) : 0;

        // KPI 1: Monthly Salary
        document.getElementById('kpi-salary-display').innerText = `${currentCurrency}${monthlySalary.toLocaleString()}`;
        document.getElementById('kpi-salary-note').innerText = monthlySalary > 0 ? 'Fixed monthly income' : 'Click edit to record salary';

        // KPI 2: Spent This Month
        document.getElementById('kpi-month-spent').innerText = `${currentCurrency}${monthSpent.toLocaleString()}`;

        // KPI 3: Savings Balance (Liquid Cash in Hand)
        document.getElementById('kpi-savings-balance').innerText = `${currentCurrency}${remainingBalance.toLocaleString()}`;
        const savingsTag = document.getElementById('kpi-savings-tag');
        if (monthlySalary === 0) {
            savingsTag.className = 'kpi-tag';
            savingsTag.innerText = 'Set Salary';
        } else {
            savingsTag.className = savingsRate >= 40 ? 'kpi-tag tag-emerald' : 'kpi-tag tag-rose';
            savingsTag.innerText = `${savingsRate}% Saved`;
        }

        // Sidebar Salary Tracker Widget
        document.getElementById('sidebar-salary-display').innerText = `${currentCurrency}${monthlySalary.toLocaleString()}`;
        document.getElementById('sidebar-salary-spent').innerText = `${currentCurrency}${monthSpent.toLocaleString()}`;
        document.getElementById('sidebar-salary-balance').innerText = `${currentCurrency}${remainingBalance.toLocaleString()}`;
        document.getElementById('sidebar-salary-progress').style.width = `${monthlySalary > 0 ? savingsRate : 0}%`;

        // Multi-Pool Financial Capital Overview
        const poolAvailable = document.getElementById('pool-available-cash');
        const poolLent = document.getElementById('pool-lent-receivables');
        const poolLentNote = document.getElementById('pool-lent-note');
        const poolBorrowed = document.getElementById('pool-debt-liabilities');
        const poolBorrowedNote = document.getElementById('pool-borrowed-note');
        const poolNetWorth = document.getElementById('pool-net-worth');

        const lentPortfolio = data.lentPortfolio || {};
        const borrowedPortfolio = data.borrowedPortfolio || {};
        const pendingLentDue = Number(lentPortfolio.pendingTotalDue || data.pendingLentTotalDue || 0);
        const pendingLentPrincipal = Number(lentPortfolio.pendingPrincipal || data.pendingLent || 0);
        const pendingBorrowedDue = Number(borrowedPortfolio.pendingTotalDue || 0);
        const pendingBorrowedPrincipal = Number(borrowedPortfolio.pendingPrincipal || 0);
        const netPosition = data.netFinancialPosition !== undefined ? Number(data.netFinancialPosition) : (remainingBalance + pendingLentDue - pendingBorrowedDue);

        if (poolAvailable) poolAvailable.innerText = `${currentCurrency}${remainingBalance.toLocaleString()}`;
        if (poolLent) poolLent.innerText = `${currentCurrency}${pendingLentDue.toLocaleString()}`;
        if (poolLentNote) poolLentNote.innerText = `${currentCurrency}${pendingLentPrincipal.toLocaleString()} principal + interest`;
        if (poolBorrowed) poolBorrowed.innerText = `${currentCurrency}${pendingBorrowedDue.toLocaleString()}`;
        if (poolBorrowedNote) poolBorrowedNote.innerText = `${currentCurrency}${pendingBorrowedPrincipal.toLocaleString()} principal + interest`;
        if (poolNetWorth) {
            poolNetWorth.innerText = `${netPosition < 0 ? '-' : ''}${currentCurrency}${Math.abs(netPosition).toLocaleString()}`;
            poolNetWorth.style.color = netPosition >= 0 ? '#10b981' : '#f43f5e';
        }

        // Three-Envelope Capital Allocation System
        if (data.envelopes) {
            const env = data.envelopes;
            const exp = env.expenseEnvelope || {};
            const lent = env.lendingEnvelope || {};

            window.currentEnvelopeData = env;

            // Envelope Month Pill
            const envMonthEl = document.getElementById('dashboard-envelope-month');
            if (envMonthEl && env.month) {
                const [y, m] = env.month.split('-');
                const monthName = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                envMonthEl.innerText = monthName;
            }

            // Envelope 1: Live Master Salary Balance
            const liveSalary = env.liveAvailableSalary !== undefined 
                ? Number(env.liveAvailableSalary) 
                : Math.max(0, (Number(env.grossIncome || 0) + Number(env.rolloverSavings || 0)) - Number(exp.spent || 0) - Number(lent.activeLent || 0));

            const liveSalaryEl = document.getElementById('env-master-live-salary');
            const grossEl = document.getElementById('env-master-gross');
            const spentDeductEl = document.getElementById('env-master-spent-deduct');
            const lentDeductEl = document.getElementById('env-master-lent-deduct');
            const rolloverRow = document.getElementById('env-master-rollover-row');
            const rolloverVal = document.getElementById('env-master-rollover-val');
            const masterBarEl = document.getElementById('env-master-bar');
            const masterPctEl = document.getElementById('env-master-pct');

            if (liveSalaryEl) liveSalaryEl.innerText = `${currentCurrency}${liveSalary.toLocaleString()}`;
            if (grossEl) grossEl.innerText = `${currentCurrency}${Number(env.grossIncome || 0).toLocaleString()}`;
            if (spentDeductEl) spentDeductEl.innerText = `-${currentCurrency}${Number(exp.spent || 0).toLocaleString()}`;
            if (lentDeductEl) lentDeductEl.innerText = `-${currentCurrency}${Number(lent.activeLent || 0).toLocaleString()}`;

            const rollover = Number(env.rolloverSavings || data.rolloverSavings || 0);
            if (rolloverRow && rolloverVal) {
                if (rollover > 0) {
                    rolloverRow.style.display = 'flex';
                    rolloverVal.innerText = `+${currentCurrency}${rollover.toLocaleString()}`;
                } else {
                    rolloverRow.style.display = 'none';
                }
            }

            const totalPool = (Number(env.grossIncome || 0) + rollover);
            const retainedPct = totalPool > 0 ? Math.round((liveSalary / totalPool) * 100) : 0;
            if (masterBarEl) masterBarEl.style.width = `${Math.min(100, Math.max(0, retainedPct))}%`;
            if (masterPctEl) masterPctEl.innerText = `${retainedPct}% Available Balance`;

            // Envelope 2: Living Expenses Envelope
            const expBudgetEl = document.getElementById('env-expense-budget');
            const expSpentEl = document.getElementById('env-expense-spent');
            const expRemainingEl = document.getElementById('env-expense-remaining');
            const expImpactEl = document.getElementById('env-expense-impact');
            const expBarEl = document.getElementById('env-expense-bar');
            const expPctEl = document.getElementById('env-expense-pct');

            if (expBudgetEl) expBudgetEl.innerText = `${currentCurrency}${Number(exp.budget || 0).toLocaleString()}`;
            if (expSpentEl) expSpentEl.innerText = `${currentCurrency}${Number(exp.spent || 0).toLocaleString()}`;
            if (expRemainingEl) expRemainingEl.innerText = `${currentCurrency}${Number(exp.remaining || 0).toLocaleString()}`;
            if (expImpactEl) expImpactEl.innerText = `-${currentCurrency}${Number(exp.spent || 0).toLocaleString()} deducted from salary`;
            if (expBarEl) expBarEl.style.width = `${Math.min(100, Math.max(0, exp.percentage || 0))}%`;
            if (expPctEl) expPctEl.innerText = `${exp.percentage || 0}% of budget spent (${currentCurrency}${Number(exp.remaining).toLocaleString()} envelope left)`;

            // Envelope 3: Lending Fund Envelope
            const lentBudgetEl = document.getElementById('env-lending-budget');
            const lentActiveEl = document.getElementById('env-lending-active');
            const lentCapacityEl = document.getElementById('env-lending-capacity');
            const lentImpactEl = document.getElementById('env-lending-impact');
            const lentBarEl = document.getElementById('env-lending-bar');
            const lentPctEl = document.getElementById('env-lending-pct');

            if (lentBudgetEl) lentBudgetEl.innerText = `${currentCurrency}${Number(lent.fundBudget || 0).toLocaleString()}`;
            if (lentActiveEl) lentActiveEl.innerText = `${currentCurrency}${Number(lent.activeLent || 0).toLocaleString()}`;
            if (lentCapacityEl) lentCapacityEl.innerText = `${currentCurrency}${Number(lent.remainingCapacity || 0).toLocaleString()}`;
            if (lentImpactEl) lentImpactEl.innerText = `-${currentCurrency}${Number(lent.activeLent || 0).toLocaleString()} deducted (credits back when repaid)`;
            if (lentBarEl) lentBarEl.style.width = `${Math.min(100, Math.max(0, lent.percentage || 0))}%`;
            if (lentPctEl) lentPctEl.innerText = `${lent.percentage || 0}% deployed (${currentCurrency}${Number(lent.remainingCapacity).toLocaleString()} limit left)`;
        }

        // Expenses count
        document.getElementById('expenses-count-badge').innerText = `${data.expenses.length} items`;

        // KPI Card 4: Top Spending Driver / Leakage
        const topCat = analytics.topCategory;
        const topCatEl = document.getElementById('kpi-top-category');
        const topCatNote = document.getElementById('kpi-top-category-note');
        const leakageTag = document.getElementById('kpi-leakage-tag');

        if (topCat) {
            topCatEl.innerText = `${topCat.category} (${topCat.percentage}%)`;
            topCatNote.innerText = `${currentCurrency}${topCat.total.toLocaleString()} spent this month`;
            if (analytics.alertLevel === 'critical') {
                leakageTag.className = 'kpi-tag tag-leakage-danger';
                leakageTag.innerText = 'High Leakage';
            } else if (analytics.alertLevel === 'warning') {
                leakageTag.className = 'kpi-tag tag-leakage-warning';
                leakageTag.innerText = 'Watch Out';
            } else {
                leakageTag.className = 'kpi-tag tag-emerald';
                leakageTag.innerText = 'Balanced';
            }
        } else {
            topCatEl.innerText = 'None';
            topCatNote.innerText = 'No monthly expenses yet';
            leakageTag.className = 'kpi-tag';
            leakageTag.innerText = 'Clear';
        }

        // 2. Render Expenses Table
        const tbody = document.getElementById('expenses-tbody');
        if (data.expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-cell">No expenses logged yet. Tell the AI Agent or use quick add!</td></tr>`;
        } else {
            tbody.innerHTML = data.expenses.map(e => `
                <tr>
                    <td><strong>${escapeHtml(e.title)}</strong></td>
                    <td><span class="cat-badge">${escapeHtml(e.category)}</span></td>
                    <td class="amt-bold">${currentCurrency}${e.amount}</td>
                    <td style="color:var(--text-subtle); font-size:0.8rem;">${e.date}</td>
                    <td>
                        <button class="del-btn-icon" onclick="deleteExpense(${e.id})" title="Delete Expense">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }

        // 3. Render Monthly Expense Leakage & Spending Control Advisor
        const adviceBox = document.getElementById('advice-box');
        const adviceIcon = document.getElementById('advice-icon');
        const adviceTitle = document.getElementById('advice-title');
        const adviceText = document.getElementById('advice-text');
        const statusBadge = document.getElementById('leakage-status-badge');

        const level = analytics.alertLevel || 'safe';
        adviceBox.className = `advice-box advice-${level}`;
        adviceText.innerText = analytics.advice || 'Log expenses to see where your money is going and where to cut down.';

        if (level === 'critical') {
            adviceIcon.innerText = '🚨';
            adviceTitle.innerText = 'Excessive Spending Detected — Action Needed';
            statusBadge.className = 'badge tag-leakage-danger';
            statusBadge.innerText = 'High Leakage';
        } else if (level === 'warning') {
            adviceIcon.innerText = '⚠️';
            adviceTitle.innerText = 'Discretionary Spending Warning';
            statusBadge.className = 'badge tag-leakage-warning';
            statusBadge.innerText = 'Caution';
        } else {
            adviceIcon.innerText = '✅';
            adviceTitle.innerText = 'Healthy Spending Distribution';
            statusBadge.className = 'badge tag-leakage-safe';
            statusBadge.innerText = 'Controlled';
        }

        // 4. Update Needs vs Wants Stacked Bar
        const essentialPct = analytics.essentialPct || 0;
        const discretionaryPct = analytics.discretionaryPct || 0;
        document.getElementById('meter-essential-val').innerText = `${essentialPct}% (${currentCurrency}${(analytics.essentialTotal || 0).toLocaleString()})`;
        document.getElementById('meter-discretionary-val').innerText = `${discretionaryPct}% (${currentCurrency}${(analytics.discretionaryTotal || 0).toLocaleString()})`;
        
        // Ensure at least minimal visual bar if percentages exist
        const totalBarPct = essentialPct + discretionaryPct;
        if (totalBarPct > 0) {
            document.getElementById('bar-essential').style.width = `${essentialPct}%`;
            document.getElementById('bar-discretionary').style.width = `${discretionaryPct}%`;
        } else {
            document.getElementById('bar-essential').style.width = '50%';
            document.getElementById('bar-discretionary').style.width = '50%';
        }

        // 5. Render Category Consumption Breakdown List
        const leakageList = document.getElementById('leakage-items-list');
        const categories = analytics.categories || [];
        if (categories.length === 0) {
            leakageList.innerHTML = `<div class="empty-cell">No expenses logged this month yet. Tell the AI: "I spent $30 on shopping"</div>`;
        } else {
            leakageList.innerHTML = categories.map(c => {
                let tagHtml = '';
                let fillGrad = 'linear-gradient(90deg, #4f46e5, #7c3aed)';
                
                if (c.percentage >= 40) {
                    tagHtml = '<span class="tag-leakage-danger">⚠️ Reduce Spend</span>';
                    fillGrad = 'linear-gradient(90deg, #f43f5e, #e11d48)';
                } else if (c.percentage >= 25) {
                    tagHtml = '<span class="tag-leakage-warning">Moderate</span>';
                    fillGrad = 'linear-gradient(90deg, #f59e0b, #d97706)';
                } else {
                    tagHtml = '<span class="tag-leakage-safe">Optimal</span>';
                    fillGrad = 'linear-gradient(90deg, #10b981, #0d9488)';
                }

                return `
                    <div class="leakage-item">
                        <div class="leakage-item-header">
                            <div>
                                <strong>${escapeHtml(c.category)}</strong> 
                                <span style="font-size:0.75rem; color:var(--text-subtle);">(${c.count} items)</span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-weight:700;">${currentCurrency}${c.total.toLocaleString()}</span>
                                <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted);">${c.percentage}%</span>
                                ${tagHtml}
                            </div>
                        </div>
                        <div class="leakage-progress-bar">
                            <div class="leakage-progress-fill" style="width: ${c.percentage}%; background: ${fillGrad};"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

// Toggle Task Completion
window.toggleTask = async function(id) {
    try {
        await fetch(`${API_BASE}/api/tasks/${id}/toggle`, { method: 'POST' });
        await loadDashboard();
    } catch (e) {
        console.error(e);
    }
};

// Delete Expense
window.deleteExpense = async function(id) {
    if (!confirm('Are you sure you want to delete this expense record?')) return;
    try {
        await fetch(`${API_BASE}/api/expenses/${id}`, { method: 'DELETE' });
        await refreshAllData();
    } catch (e) {
        console.error(e);
    }
};

// Quick Expense Form Submission (Optimized: Direct fast API + Instant UI feedback)
document.getElementById('quick-expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const titleInput = document.getElementById('quick-title');
    const amountInput = document.getElementById('quick-amount');
    const categoryInput = document.getElementById('quick-category');
    const submitBtn = document.querySelector('#quick-expense-form button[type="submit"]') || document.querySelector('#quick-expense-form .btn-primary');

    const title = titleInput.value.trim();
    const amount = Number(amountInput.value);
    const category = categoryInput.value;
    const userId = String(currentUser.id || currentUser.email);

    if (!title || !amount || isNaN(amount)) return;

    // Instant UI feedback: clear inputs & show saving state in 0ms
    titleInput.value = '';
    amountInput.value = '';
    const oldBtnText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = 'Adding... ⚡';
    }

    try {
        // Direct fast database insertion (50ms instead of 4-5s LLM loop!)
        const res = await fetch(`${API_BASE}/api/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                title,
                amount,
                category
            })
        });

        if (!res.ok) {
            throw new Error('Failed to save expense');
        }

        // Parallel fast data refresh
        await refreshAllData();

        if (submitBtn) {
            submitBtn.innerText = 'Added! ✓';
            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.innerText = oldBtnText || 'Add Expense';
            }, 600);
        }
    } catch (err) {
        console.error('Failed to add quick expense:', err);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = oldBtnText || 'Add Expense';
        }
        alert('Failed to record expense. Please try again.');
    }
});

// ==================== MONTHLY SALARY / INCOME HANDLER ====================
const sidebarSalaryEditBtn = document.getElementById('sidebar-salary-edit-btn');
const sidebarSalaryAddToggleBtn = document.getElementById('sidebar-salary-add-toggle-btn');
const kpiSalaryEditBtn = document.getElementById('kpi-salary-edit-btn');
const salaryInputRow = document.getElementById('salary-input-row');
const sidebarSalaryMonth = document.getElementById('sidebar-salary-month');
const sidebarSalaryInput = document.getElementById('sidebar-salary-input');
const sidebarSalaryAddBtn = document.getElementById('sidebar-salary-add-btn');
const sidebarSalarySaveBtn = document.getElementById('sidebar-salary-save-btn');

function toggleSalaryEdit(defaultMode = 'add') {
    if (salaryInputRow.style.display === 'none' || !salaryInputRow.style.display) {
        salaryInputRow.style.display = 'flex';
        if (sidebarSalaryMonth && !sidebarSalaryMonth.value) {
            sidebarSalaryMonth.value = new Date().toISOString().slice(0, 7);
        }
        sidebarSalaryInput.placeholder = defaultMode === 'add' ? 'Add amount (e.g. 200)' : 'Set base salary (e.g. 50000)';
        sidebarSalaryInput.dataset.defaultMode = defaultMode;
        sidebarSalaryInput.focus();
    } else {
        salaryInputRow.style.display = 'none';
    }
}

if (sidebarSalaryAddToggleBtn) sidebarSalaryAddToggleBtn.addEventListener('click', () => toggleSalaryEdit('add'));
if (sidebarSalaryEditBtn) sidebarSalaryEditBtn.addEventListener('click', () => toggleSalaryEdit('set'));
if (kpiSalaryEditBtn) kpiSalaryEditBtn.addEventListener('click', () => toggleSalaryEdit('add'));

async function submitSalary(mode = 'add') {
    const salaryVal = Number(sidebarSalaryInput.value);
    if (isNaN(salaryVal) || salaryVal <= 0 || !currentUser) return;
    const userId = String(currentUser.id || currentUser.email);
    const month = sidebarSalaryMonth?.value || new Date().toISOString().slice(0, 7);

    try {
        await fetch(`${API_BASE}/api/user/${userId}/salary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ salary: salaryVal, mode, month })
        });
        salaryInputRow.style.display = 'none';
        sidebarSalaryInput.value = '';
        await refreshAllData();
    } catch (err) {
        console.error('Failed to update salary:', err);
    }
}

if (sidebarSalaryAddBtn) sidebarSalaryAddBtn.addEventListener('click', () => submitSalary('add'));
if (sidebarSalarySaveBtn) sidebarSalarySaveBtn.addEventListener('click', () => submitSalary('set'));
if (sidebarSalaryInput) {
    sidebarSalaryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const mode = sidebarSalaryInput.dataset.defaultMode || 'add';
            submitSalary(mode);
        }
    });
}

// ==================== 5. STATISTICS & CIRCULAR RATIO ANIMATIONS (GSAP) ====================
async function loadStatistics() {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/statistics/${userId}`);
        const data = await res.json();

        // Update Monthly KPI in Dashboard
        document.getElementById('kpi-month-spent').innerText = `${currentCurrency}${data.month.total.toLocaleString()}`;

        // Circumference of SVG r=66 is 2 * PI * 66 = 414.69
        const circumference = 414.69;

        // Function to animate circle ring with GSAP
        function animateRing(elementId, targetPercent) {
            const circle = document.getElementById(elementId);
            if (!circle) return;

            const safePercent = Math.min(100, Math.max(0, targetPercent));
            const targetOffset = circumference - (safePercent / 100) * circumference;

            if (typeof gsap !== 'undefined') {
                gsap.to(circle, {
                    strokeDashoffset: targetOffset,
                    duration: 1.2,
                    ease: 'power2.out'
                });
            } else {
                circle.style.strokeDashoffset = targetOffset;
            }
        }

        // Animate Week, Month, Year Rings
        animateRing('circle-week', data.week.percent);
        document.getElementById('stat-week-pct').innerText = `${data.week.percent}%`;
        document.getElementById('stat-week-amt').innerText = `${currentCurrency}${data.week.total} spent`;

        animateRing('circle-month', data.month.percent);
        document.getElementById('stat-month-pct').innerText = `${data.month.percent}%`;
        document.getElementById('stat-month-amt').innerText = `${currentCurrency}${data.month.total} spent`;

        animateRing('circle-year', data.year.percent);
        document.getElementById('stat-year-pct').innerText = `${data.year.percent}%`;
        document.getElementById('stat-year-amt').innerText = `${currentCurrency}${data.year.total} spent`;

        // Render Category Progress Bars
        const catContainer = document.getElementById('category-bars-container');
        if (!data.categories || data.categories.length === 0) {
            catContainer.innerHTML = `<div class="empty-cell">No category data recorded yet.</div>`;
        } else {
            catContainer.innerHTML = data.categories.map(c => `
                <div class="cat-bar-item">
                    <div class="cat-bar-header">
                        <span><strong>${escapeHtml(c.category)}</strong> (${c.percentage}%)</span>
                        <span style="color:var(--text-muted);">${currentCurrency}${c.total.toLocaleString()}</span>
                    </div>
                    <div class="cat-track">
                        <div class="cat-fill" style="width: ${c.percentage}%;"></div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error('Failed to load statistics:', err);
    }
}

// Refresh All Data Helper
async function refreshAllData() {
    // Parallel fetch: cuts dashboard refresh latency in half!
    const promises = [loadDashboard(), loadStatistics(), loadLentData(), loadBorrowedData()];
    if (typeof loadCalendarMonth === 'function' && typeof activeCalendarMonth !== 'undefined') {
        promises.push(loadCalendarMonth(activeCalendarMonth));
    }
    await Promise.all(promises);
    initGsapHoverEffects();
}

// ==================== GSAP HOVER & INTERACTION ENGINE (NO FLICKER) ====================
function initGsapHoverEffects() {
    if (typeof gsap === 'undefined') return;

    // 1. Text Heading Color Accents (without reflow/flicker)
    const textElements = document.querySelectorAll(
        '.card-heading h3, .circle-title, .page-title'
    );
    textElements.forEach(el => {
        if (el.dataset.gsapBound) return;
        el.dataset.gsapBound = 'true';

        el.addEventListener('mouseenter', () => {
            gsap.to(el, { color: '#e11d48', duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
        el.addEventListener('mouseleave', () => {
            gsap.to(el, { color: '', duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
        });
    });

    // 2. Circular AI Agent FAB Button GSAP Animation
    const fab = document.getElementById('ai-fab-btn');
    if (fab && !fab.dataset.gsapBound) {
        fab.dataset.gsapBound = 'true';
        fab.addEventListener('mouseenter', () => {
            gsap.to(fab, { scale: 1.12, rotation: 8, duration: 0.3, ease: 'back.out(2)' });
        });
        fab.addEventListener('mouseleave', () => {
            gsap.to(fab, { scale: 1, rotation: 0, duration: 0.3, ease: 'power2.out' });
        });
    }

    // 3. Drawer Quick Chips Hover
    document.querySelectorAll('.chip-item').forEach(chip => {
        if (chip.dataset.gsapBound) return;
        chip.dataset.gsapBound = 'true';

        chip.addEventListener('mouseenter', () => {
            gsap.to(chip, { scale: 1.05, duration: 0.25, ease: 'power1.out' });
        });
        chip.addEventListener('mouseleave', () => {
            gsap.to(chip, { scale: 1, duration: 0.25, ease: 'power1.out' });
        });
    });
}

document.getElementById('manual-refresh-btn').addEventListener('click', refreshAllData);

// Currency Switcher
document.getElementById('currency-select').addEventListener('change', (e) => {
    currentCurrency = e.target.value;
    refreshAllData();
});

// ==================== 6. FLOATING AI AGENT DRAWER (ENGLISH SPEAKING) ====================
const aiFabBtn = document.getElementById('ai-fab-btn');
const aiDrawer = document.getElementById('ai-drawer');
const drawerCloseBtn = document.getElementById('drawer-close-btn');
const drawerChatBox = document.getElementById('drawer-chat-box');
const drawerInput = document.getElementById('drawer-input');
const drawerSendBtn = document.getElementById('drawer-send-btn');

// Open / Close Drawer
function openDrawer() {
    aiDrawer.classList.add('open');
    if (typeof gsap !== 'undefined') {
        gsap.to(aiFabBtn, { scale: 0.9, opacity: 0.4, duration: 0.2 });
    }
    drawerInput.focus();
}

function closeDrawer() {
    aiDrawer.classList.remove('open');
    aiDrawer.classList.remove('keyboard-open');
    aiDrawer.style.removeProperty('--keyboard-drawer-height');
    aiDrawer.style.removeProperty('height');
    aiDrawer.style.removeProperty('max-height');
    aiDrawer.style.removeProperty('top');
    if (drawerInput) drawerInput.blur();
    if (typeof gsap !== 'undefined') {
        gsap.to(aiFabBtn, { scale: 1, opacity: 1, duration: 0.2 });
    }
}

aiFabBtn.addEventListener('click', openDrawer);
drawerCloseBtn.addEventListener('click', closeDrawer);

// Smooth Auto-Scroll Helper for AI Chat
function scrollChatToBottom(smooth = true) {
    if (!drawerChatBox) return;
    requestAnimationFrame(() => {
        drawerChatBox.scrollTo({
            top: drawerChatBox.scrollHeight + 150,
            behavior: smooth ? 'smooth' : 'auto'
        });
    });
}

// Append Chat Message
function appendDrawerMessage(text, isUser) {
    const div = document.createElement('div');
    div.className = 'chat-bubble ' + (isUser ? 'bubble-user' : 'bubble-ai');

    const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    div.innerHTML = formatted;

    drawerChatBox.appendChild(div);
    scrollChatToBottom(true);
}

// Send Message to Gemini AI Agent
async function sendDrawerMessage(customText = null) {
    const text = (customText || drawerInput.value).trim();
    if (!text || !currentUser) return;

    const userId = String(currentUser.id || currentUser.email);

    // Show User message
    appendDrawerMessage(text, true);
    if (!customText) drawerInput.value = '';

    // Show AI Typing indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'chat-bubble bubble-ai';
    typingBubble.innerHTML = 'Thinking and executing tools... ⚡';
    drawerChatBox.appendChild(typingBubble);
    drawerChatBox.scrollTop = drawerChatBox.scrollHeight;

    try {
        const res = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text,
                userId: userId
            })
        });
        const data = await res.json();

        typingBubble.innerHTML = (data.reply || data.error)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        scrollChatToBottom(true);
        setTimeout(() => scrollChatToBottom(true), 60);

        // Non-blocking real-time background sync so UI responds instantly
        refreshAllData().catch(e => console.error(e));
    } catch (err) {
        typingBubble.innerText = 'Error: Unable to communicate with AI Agent.';
    }
}

drawerSendBtn.addEventListener('click', () => sendDrawerMessage());
drawerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendDrawerMessage();
});

// Quick Chips in AI Drawer
document.querySelectorAll('.chip-item').forEach(chip => {
    chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-text');
        sendDrawerMessage(prompt);
    });
});

// Utility: HTML Escaping
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}


// ==================== AUTO-SCROLL OBSERVER & MOBILE KEYBOARD HANDLER ====================
// 1. MutationObserver: automatically scrolls chat down whenever any new bubble or text arrives
if (window.MutationObserver && drawerChatBox) {
    const chatObserver = new MutationObserver(() => {
        scrollChatToBottom(true);
    });
    chatObserver.observe(drawerChatBox, { childList: true, subtree: true, characterData: true });
}

// 2. Mobile Visual Viewport: Pin AI chat drawer right on top of virtual keyboard with ZERO white space
if (window.visualViewport) {
    const syncDrawerWithKeyboard = () => {
        const aiDrawer = document.getElementById('ai-drawer');
        if (!aiDrawer || !aiDrawer.classList.contains('open')) return;

        const vp = window.visualViewport;
        const vpHeight = vp.height;
        const screenHeight = window.innerHeight;

        if (screenHeight - vpHeight > 80) {
            // Virtual Keyboard is OPEN
            aiDrawer.classList.add('keyboard-open');
            aiDrawer.style.setProperty('--keyboard-drawer-height', `${vpHeight}px`);
            aiDrawer.style.setProperty('height', `${vpHeight}px`, 'important');
            aiDrawer.style.setProperty('max-height', `${vpHeight}px`, 'important');
            aiDrawer.style.setProperty('top', `${vp.offsetTop}px`, 'important');
            window.scrollTo(0, 0);
            scrollChatToBottom(false);
        } else {
            // Virtual Keyboard is CLOSED
            aiDrawer.classList.remove('keyboard-open');
            aiDrawer.style.removeProperty('--keyboard-drawer-height');
            aiDrawer.style.removeProperty('height');
            aiDrawer.style.removeProperty('max-height');
            aiDrawer.style.removeProperty('top');
        }
    };

    window.visualViewport.addEventListener('resize', syncDrawerWithKeyboard);
    window.visualViewport.addEventListener('scroll', syncDrawerWithKeyboard);
}

// Focus and blur handlers for mobile drawer input (Zero white space gap)
if (drawerInput) {
    drawerInput.addEventListener('focus', () => {
        window.scrollTo(0, 0);
        setTimeout(() => {
            const aiDrawer = document.getElementById('ai-drawer');
            if (aiDrawer) {
                aiDrawer.classList.add('keyboard-open');
                if (window.visualViewport) {
                    const vp = window.visualViewport;
                    const vpHeight = vp.height;
                    aiDrawer.style.setProperty('--keyboard-drawer-height', `${vpHeight}px`);
                    aiDrawer.style.setProperty('height', `${vpHeight}px`, 'important');
                    aiDrawer.style.setProperty('max-height', `${vpHeight}px`, 'important');
                    aiDrawer.style.setProperty('top', `${vp.offsetTop}px`, 'important');
                }
            }
            window.scrollTo(0, 0);
            scrollChatToBottom(true);
        }, 120);
    });

    drawerInput.addEventListener('blur', () => {
        setTimeout(() => {
            const aiDrawer = document.getElementById('ai-drawer');
            if (aiDrawer) {
                if (!window.visualViewport || (window.innerHeight - window.visualViewport.height < 80)) {
                    aiDrawer.classList.remove('keyboard-open');
                    aiDrawer.style.removeProperty('--keyboard-drawer-height');
                    aiDrawer.style.removeProperty('height');
                    aiDrawer.style.removeProperty('max-height');
                    aiDrawer.style.removeProperty('top');
                }
            }
        }, 120);
    });
}

// ==================== 7. UDHAR / MONEY LENT KHATA ====================
let allLentRecords = [];
let currentLentFilter = 'all'; // 'all' | 'pending' | 'returned'

const lentForm = document.getElementById('lent-form');
const lentPersonName = document.getElementById('lent-person-name');
const lentAmount = document.getElementById('lent-amount');
const lentDateLent = document.getElementById('lent-date-lent');
const lentPurpose = document.getElementById('lent-purpose');
const lentInterestType = document.getElementById('lent-interest-type');
const lentInterestValGroup = document.getElementById('lent-interest-val-group');
const lentInterestValLabel = document.getElementById('lent-interest-val-label');
const lentInterestVal = document.getElementById('lent-interest-val');
const lentNotes = document.getElementById('lent-notes');
const lentSubmitBtn = document.getElementById('lent-submit-btn');

const previewPrincipal = document.getElementById('preview-principal');
const previewDays = document.getElementById('preview-days');
const previewDailyRate = document.getElementById('preview-daily-rate');
const previewInterest = document.getElementById('preview-interest');
const previewTotal = document.getElementById('preview-total');
const lentTbody = document.getElementById('lent-tbody');

// Initialize date picker to today's date
if (lentDateLent && !lentDateLent.value) {
    lentDateLent.value = new Date().toISOString().split('T')[0];
}

// Client-side Interest & Accrual Calculator
function calcClientLoanDaysAndInterest(amount, interestType, interestRate, dateLent, dateReturned = null, status = 'pending') {
    const numAmount = Number(amount) || 0;
    const numRate = Number(interestRate) || 0;

    const startDateStr = (dateLent ? dateLent.split('T')[0] : new Date().toISOString().split('T')[0]);
    const startDate = new Date(`${startDateStr}T00:00:00`);

    const endDateStr = (status === 'returned' && dateReturned)
        ? dateReturned.split('T')[0]
        : new Date().toISOString().split('T')[0];
    const endDate = new Date(`${endDateStr}T00:00:00`);

    const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let dailyInterest = 0;
    let accruedInterest = 0;
    let rateLabel = '0% (Zero Interest)';

    if (interestType === 'daily_percent') {
        dailyInterest = Math.round((numAmount * (numRate / 100)) * 100) / 100;
        accruedInterest = Math.round((dailyInterest * daysElapsed) * 100) / 100;
        rateLabel = `${numRate}% / day (${currentCurrency}${dailyInterest.toFixed(2)}/day)`;
    } else if (interestType === 'monthly_percent' || interestType === 'percent') {
        dailyInterest = Math.round((numAmount * (numRate / 100) / 30) * 100) / 100;
        accruedInterest = Math.round((dailyInterest * daysElapsed) * 100) / 100;
        rateLabel = `${numRate}% / mo (${currentCurrency}${dailyInterest.toFixed(2)}/day)`;
    } else if (interestType === 'daily_flat') {
        dailyInterest = numRate;
        accruedInterest = Math.round((numRate * daysElapsed) * 100) / 100;
        rateLabel = `${currentCurrency}${numRate} / day`;
    } else if (interestType === 'flat') {
        dailyInterest = 0;
        accruedInterest = numRate;
        rateLabel = `${currentCurrency}${numRate} (One-time fixed)`;
    } else {
        dailyInterest = 0;
        accruedInterest = 0;
        rateLabel = '0% (Zero Interest)';
    }

    const totalDue = Math.round((numAmount + accruedInterest) * 100) / 100;

    return {
        daysElapsed,
        dailyInterest,
        accruedInterest,
        totalDue,
        rateLabel
    };
}

// Real-time Preview Calculation
function updateLentPreview() {
    if (!previewPrincipal || !previewInterest || !previewTotal) return;
    const amount = Number(lentAmount?.value) || 0;
    const type = lentInterestType?.value || 'none';
    const rate = Number(lentInterestVal?.value) || 0;
    const dateLent = lentDateLent?.value || new Date().toISOString().split('T')[0];

    const calc = calcClientLoanDaysAndInterest(amount, type, rate, dateLent, null, 'pending');

    previewPrincipal.innerText = `${currentCurrency}${amount.toLocaleString()}`;
    if (previewDays) {
        previewDays.innerText = calc.daysElapsed === 0 ? '0 Days (Today)' : `${calc.daysElapsed} Day${calc.daysElapsed === 1 ? '' : 's'}`;
    }
    if (previewDailyRate) {
        previewDailyRate.innerText = calc.dailyInterest > 0 ? `+${currentCurrency}${calc.dailyInterest.toFixed(2)} / day` : '₹0.00 / day';
    }
    previewInterest.innerText = `+${currentCurrency}${calc.accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    previewTotal.innerText = `${currentCurrency}${calc.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Check against Remaining Lending Fund Capacity
    const remainingCap = window.currentEnvelopeData?.lendingEnvelope?.remainingCapacity;
    const warnEl = document.getElementById('lent-capacity-warning');
    const warnAmtEl = document.getElementById('warn-loan-amount');
    const warnCapEl = document.getElementById('warn-remaining-cap');

    if (warnEl && amount > 0 && remainingCap !== undefined && remainingCap !== null && amount > remainingCap) {
        warnEl.style.display = 'block';
        if (warnAmtEl) warnAmtEl.innerText = `${currentCurrency}${amount.toLocaleString()}`;
        if (warnCapEl) warnCapEl.innerText = `${currentCurrency}${Number(remainingCap).toLocaleString()}`;
    } else if (warnEl) {
        warnEl.style.display = 'none';
    }
}

// Toggle Interest Input Visibility & Labels
if (lentInterestType) {
    lentInterestType.addEventListener('change', () => {
        const val = lentInterestType.value;
        if (val === 'daily_percent') {
            lentInterestValGroup.style.display = 'flex';
            lentInterestValLabel.innerText = 'Daily Rate (% per day)';
            lentInterestVal.placeholder = 'e.g. 0.5 (for 0.5%/day)';
        } else if (val === 'monthly_percent') {
            lentInterestValGroup.style.display = 'flex';
            lentInterestValLabel.innerText = 'Monthly Rate (% per month - Daily Pro-Rata)';
            lentInterestVal.placeholder = 'e.g. 2 (for 2%/month)';
        } else if (val === 'daily_flat') {
            lentInterestValGroup.style.display = 'flex';
            lentInterestValLabel.innerText = 'Daily Flat Fee (₹ per day)';
            lentInterestVal.placeholder = 'e.g. 25 (₹25/day)';
        } else if (val === 'flat') {
            lentInterestValGroup.style.display = 'flex';
            lentInterestValLabel.innerText = 'One-Time Fixed Fee (₹)';
            lentInterestVal.placeholder = 'e.g. 500 (one-time)';
        } else {
            lentInterestValGroup.style.display = 'none';
            lentInterestVal.value = '0';
        }
        updateLentPreview();
    });
}

if (lentAmount) lentAmount.addEventListener('input', updateLentPreview);
if (lentInterestVal) lentInterestVal.addEventListener('input', updateLentPreview);
if (lentDateLent) lentDateLent.addEventListener('input', updateLentPreview);

// Load Lent Records and Stats
async function loadLentData() {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/lent/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!data.success) return;

        allLentRecords = data.records || [];
        const stats = data.stats || {};

        // Update KPI Cards
        const totalGivenEl = document.getElementById('kpi-lent-total');
        const pendingEl = document.getElementById('kpi-lent-pending');
        const recoveredEl = document.getElementById('kpi-lent-recovered');
        const interestEl = document.getElementById('kpi-lent-interest');
        const pendingTag = document.getElementById('kpi-lent-pending-tag');
        const returnedTag = document.getElementById('kpi-lent-returned-tag');

        const pendingCount = allLentRecords.filter(r => r.status === 'pending').length;
        const returnedCount = allLentRecords.filter(r => r.status === 'returned').length;

        if (totalGivenEl) totalGivenEl.innerText = `${currentCurrency}${(stats.totalLentGiven || 0).toLocaleString()}`;
        if (pendingEl) pendingEl.innerText = `${currentCurrency}${(stats.pendingTotalDue || stats.pendingPrincipal || 0).toLocaleString()}`;
        if (recoveredEl) recoveredEl.innerText = `${currentCurrency}${(stats.returnedTotal || 0).toLocaleString()}`;
        if (interestEl) interestEl.innerText = `+${currentCurrency}${(stats.interestEarned || 0).toLocaleString()}`;

        if (pendingTag) pendingTag.innerText = `${pendingCount} Active`;
        if (returnedTag) returnedTag.innerText = `${returnedCount} Settled`;

        // Update Lending Fund Capacity Banner
        if (window.currentEnvelopeData && window.currentEnvelopeData.lendingEnvelope) {
            const le = window.currentEnvelopeData.lendingEnvelope;
            const bEl = document.getElementById('lent-envelope-budget');
            const aEl = document.getElementById('lent-envelope-active');
            const cEl = document.getElementById('lent-envelope-capacity');
            const pEl = document.getElementById('lent-envelope-progress');
            const pctEl = document.getElementById('lent-envelope-pct');

            if (bEl) bEl.innerText = `${currentCurrency}${Number(le.fundBudget || 0).toLocaleString()}`;
            if (aEl) aEl.innerText = `${currentCurrency}${Number(le.activeLent || 0).toLocaleString()}`;
            if (cEl) cEl.innerText = `${currentCurrency}${Number(le.remainingCapacity || 0).toLocaleString()}`;
            if (pEl) pEl.style.width = `${Math.min(100, Math.max(0, le.percentage || 0))}%`;
            if (pctEl) pctEl.innerText = `${le.percentage || 0}% Used`;
        }

        // Update Filter Tab Badges
        const countAll = document.getElementById('count-all');
        const countPending = document.getElementById('count-pending');
        const countReturned = document.getElementById('count-returned');

        if (countAll) countAll.innerText = allLentRecords.length;
        if (countPending) countPending.innerText = pendingCount;
        if (countReturned) countReturned.innerText = returnedCount;

        renderLentTable();
    } catch (err) {
        console.error('Failed to load lent data:', err);
    }
}

// Render Table with Filter
function renderLentTable() {
    if (!lentTbody) return;

    let filtered = allLentRecords;
    if (currentLentFilter === 'pending') {
        filtered = allLentRecords.filter(r => r.status === 'pending');
    } else if (currentLentFilter === 'returned') {
        filtered = allLentRecords.filter(r => r.status === 'returned');
    }

    if (filtered.length === 0) {
        const msg = currentLentFilter === 'all' 
            ? 'No loan records found. Issue a new loan using the form above.'
            : currentLentFilter === 'pending'
                ? 'No active pending loans. All issued loans have been settled.'
                : 'No settled loans yet. Click "Mark as Repaid" when a borrower returns funds.';
        lentTbody.innerHTML = `<tr><td colspan="10" class="empty-cell">${msg}</td></tr>`;
        return;
    }

    lentTbody.innerHTML = filtered.map(r => {
        const isReturned = r.status === 'returned';
        const calc = calcClientLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_lent, r.date_returned, r.status);
        const days = r.days_elapsed !== undefined ? r.days_elapsed : calc.daysElapsed;
        const dailyRate = r.daily_interest !== undefined ? r.daily_interest : calc.dailyInterest;
        const interestAmt = r.interest_amount !== undefined ? r.interest_amount : calc.accruedInterest;
        const totalDue = r.total_due !== undefined ? r.total_due : calc.totalDue;

        // Daily Rate Badge
        let dailyRateHtml = '';
        if (dailyRate > 0) {
            dailyRateHtml = `<span class="daily-rate-tag">+${currentCurrency}${dailyRate.toFixed(2)}/day</span>`;
        } else if (r.interest_type === 'flat' && (r.interest_rate > 0 || r.interest_amount > 0)) {
            dailyRateHtml = `<span class="daily-rate-tag text-muted">Fixed ${currentCurrency}${r.interest_rate || r.interest_amount}</span>`;
        } else {
            dailyRateHtml = `<span class="lent-no-interest">0% (Zero Interest)</span>`;
        }

        // Days Active Badge
        const daysHtml = isReturned
            ? `<div class="days-badge days-badge-returned">${days} days (settled)</div>`
            : `<div class="days-badge days-badge-pending">${days} day${days === 1 ? '' : 's'} active</div>`;

        // Status Badge
        const statusHtml = isReturned 
            ? `<span class="badge tag-returned">Fully Repaid</span>` 
            : `<span class="badge tag-pending">Pending Repayment</span>`;

        // Interactive Return Settlement Button (Refined & Modern)
        const tickBtnHtml = isReturned
            ? `<button type="button" class="lent-settle-btn btn-settle-done" onclick="toggleLentReturn(${r.id})" title="Repaid on ${r.date_returned || 'Settled'} (Click to revert if marked by mistake)">
                <span class="btn-check-icon">✓</span>
                <span>Repaid (${r.date_returned || 'Settled'})</span>
               </button>`
            : `<button type="button" class="lent-settle-btn btn-settle-pending" onclick="toggleLentReturn(${r.id})" title="Click when borrower repays to credit funds back into balance">
                <span class="btn-check-icon">○</span>
                <span>Mark as Repaid</span>
               </button>`;

        return `
            <tr class="${isReturned ? 'row-returned' : 'row-pending'}">
                <td>
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${escapeHtml(r.person_name)}</div>
                    ${r.notes ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">💬 ${escapeHtml(r.notes)}</div>` : ''}
                </td>
                <td>
                    <span class="purpose-badge">${escapeHtml(r.purpose || 'Personal Loan')}</span>
                </td>
                <td>
                    <span class="amt-bold" style="font-size: 0.95rem;">${currentCurrency}${Number(r.amount).toLocaleString()}</span>
                </td>
                <td>
                    <div style="color: var(--text-muted); font-size: 0.82rem; font-weight: 500;">${r.date_lent}</div>
                    ${daysHtml}
                </td>
                <td>${dailyRateHtml}</td>
                <td>
                    <span class="amt-bold text-rose" style="font-size: 0.92rem;">
                        +${currentCurrency}${Number(interestAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </td>
                <td>
                    <span class="amt-bold" style="color: ${isReturned ? '#10b981' : '#e11d48'}; font-size: 1.02rem;">
                        ${currentCurrency}${Number(totalDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </td>
                <td>${statusHtml}</td>
                <td>${tickBtnHtml}</td>
                <td>
                    <button class="del-btn-icon" onclick="deleteLent(${r.id})" title="Delete loan record">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter Tab Click Handlers
document.querySelectorAll('.lent-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.lent-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLentFilter = btn.getAttribute('data-filter') || 'all';
        renderLentTable();
    });
});

// Toggle Lent Return Status
window.toggleLentReturn = async function(id) {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/lent/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            alert(data.error || 'Failed to update loan settlement status');
            return;
        }

        // Live refresh of dashboard, statistics, and lent data
        await refreshAllData();
    } catch (err) {
        console.error('Toggle lent error:', err);
    }
};

// Delete Lent Record
window.deleteLent = async function(id) {
    if (!confirm('Are you sure you want to permanently delete this loan record?')) return;
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/lent/${id}?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            await refreshAllData();
        }
    } catch (err) {
        console.error('Delete lent error:', err);
    }
};

// Lent Form Submission
if (lentForm) {
    lentForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const personName = (lentPersonName?.value || '').trim();
        const amount = Number(lentAmount?.value);
        const dateLent = (lentDateLent?.value || '').trim() || new Date().toISOString().split('T')[0];
        const purpose = (lentPurpose?.value || 'Personal Loan').trim();
        const interestType = lentInterestType?.value || 'none';
        const interestRate = Number(lentInterestVal?.value) || 0;
        const notes = (lentNotes?.value || '').trim();
        const userId = String(currentUser.id || currentUser.email);

        if (!personName || !amount || isNaN(amount) || amount <= 0) {
            alert('Please provide a valid borrower name and an amount greater than zero.');
            return;
        }

        const origBtnHtml = lentSubmitBtn.innerHTML;
        lentSubmitBtn.disabled = true;
        lentSubmitBtn.innerHTML = '<span>⏳</span> Recording Loan...';

        try {
            const res = await fetch(`${API_BASE}/api/lent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    personName,
                    amount,
                    dateLent,
                    purpose,
                    interestType,
                    interestRate,
                    notes
                })
            });

            const data = await res.json();
            lentSubmitBtn.disabled = false;
            lentSubmitBtn.innerHTML = origBtnHtml;

            if (!res.ok || !data.success) {
                alert(data.error || 'Failed to record loan');
                return;
            }

            // Reset Form & Preview
            lentPersonName.value = '';
            lentAmount.value = '';
            if (lentDateLent) lentDateLent.value = new Date().toISOString().split('T')[0];
            if (lentPurpose) lentPurpose.value = 'Personal Loan';
            lentInterestType.value = 'none';
            if (lentInterestValGroup) lentInterestValGroup.style.display = 'none';
            if (lentInterestVal) lentInterestVal.value = '0';
            if (lentNotes) lentNotes.value = '';
            updateLentPreview();

            // Refresh all data
            await refreshAllData();

            // Success feedback on button
            lentSubmitBtn.innerHTML = '<span>✓</span> Loan Recorded!';
            setTimeout(() => {
                lentSubmitBtn.innerHTML = origBtnHtml;
            }, 1200);

        } catch (err) {
            console.error('Add lent error:', err);
            lentSubmitBtn.disabled = false;
            lentSubmitBtn.innerHTML = origBtnHtml;
            alert('Failed to record loan. Please check your network connection.');
        }
    });
}

// ==================== 7B. MONEY BORROWED / DEBT LIABILITIES KHATA ====================
let allBorrowedRecords = [];
let currentBorrowedFilter = 'all'; // 'all' | 'pending' | 'repaid'

const borrowedForm = document.getElementById('borrowed-form');
const borrowedLenderName = document.getElementById('borrowed-lender-name');
const borrowedAmount = document.getElementById('borrowed-amount');
const borrowedDateBorrowed = document.getElementById('borrowed-date-borrowed');
const borrowedPurpose = document.getElementById('borrowed-purpose');
const borrowedInterestType = document.getElementById('borrowed-interest-type');
const borrowedInterestValGroup = document.getElementById('borrowed-interest-val-group');
const borrowedInterestValLabel = document.getElementById('borrowed-interest-val-label');
const borrowedInterestVal = document.getElementById('borrowed-interest-val');
const borrowedNotes = document.getElementById('borrowed-notes');
const borrowedSubmitBtn = document.getElementById('borrowed-submit-btn');

const borrowedPreviewPrincipal = document.getElementById('borrowed-preview-principal');
const borrowedPreviewDays = document.getElementById('borrowed-preview-days');
const borrowedPreviewDailyRate = document.getElementById('borrowed-preview-daily-rate');
const borrowedPreviewInterest = document.getElementById('borrowed-preview-interest');
const borrowedPreviewTotal = document.getElementById('borrowed-preview-total');
const borrowedTbody = document.getElementById('borrowed-tbody');

// Initialize date picker to today's date
if (borrowedDateBorrowed && !borrowedDateBorrowed.value) {
    borrowedDateBorrowed.value = new Date().toISOString().split('T')[0];
}

// Real-time Preview Calculation for Borrowed Debt
function updateBorrowedPreview() {
    if (!borrowedPreviewPrincipal || !borrowedPreviewInterest || !borrowedPreviewTotal) return;
    const amount = Number(borrowedAmount?.value) || 0;
    const type = borrowedInterestType?.value || 'none';
    const rate = Number(borrowedInterestVal?.value) || 0;
    const dateBorrowed = borrowedDateBorrowed?.value || new Date().toISOString().split('T')[0];

    const calc = calcClientLoanDaysAndInterest(amount, type, rate, dateBorrowed, null, 'pending');

    borrowedPreviewPrincipal.innerText = `${currentCurrency}${amount.toLocaleString()}`;
    if (borrowedPreviewDays) {
        borrowedPreviewDays.innerText = calc.daysElapsed === 0 ? '0 Days (Today)' : `${calc.daysElapsed} Day${calc.daysElapsed === 1 ? '' : 's'}`;
    }
    if (borrowedPreviewDailyRate) {
        borrowedPreviewDailyRate.innerText = calc.dailyInterest > 0 ? `+${currentCurrency}${calc.dailyInterest.toFixed(2)} / day` : '₹0.00 / day';
    }
    borrowedPreviewInterest.innerText = `+${currentCurrency}${calc.accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    borrowedPreviewTotal.innerText = `${currentCurrency}${calc.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Toggle Interest Input Visibility & Labels for Borrowed
if (borrowedInterestType) {
    borrowedInterestType.addEventListener('change', () => {
        const val = borrowedInterestType.value;
        if (val === 'daily_percent') {
            borrowedInterestValGroup.style.display = 'flex';
            borrowedInterestValLabel.innerText = 'Daily Rate (% per day)';
            borrowedInterestVal.placeholder = 'e.g. 0.5 (for 0.5%/day)';
        } else if (val === 'monthly_percent') {
            borrowedInterestValGroup.style.display = 'flex';
            borrowedInterestValLabel.innerText = 'Monthly Rate (% per month - Daily Pro-Rata)';
            borrowedInterestVal.placeholder = 'e.g. 2 (for 2%/month)';
        } else if (val === 'daily_flat') {
            borrowedInterestValGroup.style.display = 'flex';
            borrowedInterestValLabel.innerText = 'Daily Flat Fee (₹ per day)';
            borrowedInterestVal.placeholder = 'e.g. 25 (₹25/day)';
        } else if (val === 'flat') {
            borrowedInterestValGroup.style.display = 'flex';
            borrowedInterestValLabel.innerText = 'One-Time Fixed Fee (₹)';
            borrowedInterestVal.placeholder = 'e.g. 500 (one-time)';
        } else {
            borrowedInterestValGroup.style.display = 'none';
            borrowedInterestVal.value = '0';
        }
        updateBorrowedPreview();
    });
}

if (borrowedAmount) borrowedAmount.addEventListener('input', updateBorrowedPreview);
if (borrowedInterestVal) borrowedInterestVal.addEventListener('input', updateBorrowedPreview);
if (borrowedDateBorrowed) borrowedDateBorrowed.addEventListener('input', updateBorrowedPreview);

// Load Borrowed Records and Stats
async function loadBorrowedData() {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/borrowed/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (!data.success) return;

        allBorrowedRecords = data.records || [];
        const stats = data.stats || {};

        // Update KPI Cards
        const totalGivenEl = document.getElementById('kpi-borrowed-total');
        const pendingEl = document.getElementById('kpi-borrowed-pending');
        const repaidEl = document.getElementById('kpi-borrowed-repaid');
        const interestEl = document.getElementById('kpi-borrowed-interest');
        const pendingTag = document.getElementById('kpi-borrowed-pending-tag');
        const repaidTag = document.getElementById('kpi-borrowed-repaid-tag');

        const pendingCount = allBorrowedRecords.filter(r => r.status === 'pending').length;
        const repaidCount = allBorrowedRecords.filter(r => r.status === 'repaid').length;

        if (totalGivenEl) totalGivenEl.innerText = `${currentCurrency}${(stats.totalDebtIncurred || stats.totalBorrowedPrincipal || 0).toLocaleString()}`;
        if (pendingEl) pendingEl.innerText = `${currentCurrency}${(stats.pendingTotalDue || stats.pendingPrincipal || 0).toLocaleString()}`;
        if (repaidEl) repaidEl.innerText = `${currentCurrency}${(stats.repaidTotal || 0).toLocaleString()}`;
        if (interestEl) interestEl.innerText = `+${currentCurrency}${(stats.interestIncurred || 0).toLocaleString()}`;

        if (pendingTag) pendingTag.innerText = `${pendingCount} Active`;
        if (repaidTag) repaidTag.innerText = `${repaidCount} Settled`;

        // Update Filter Tab Badges
        const countAll = document.getElementById('borrowed-count-all');
        const countPending = document.getElementById('borrowed-count-pending');
        const countRepaid = document.getElementById('borrowed-count-repaid');

        if (countAll) countAll.innerText = allBorrowedRecords.length;
        if (countPending) countPending.innerText = pendingCount;
        if (countRepaid) countRepaid.innerText = repaidCount;

        renderBorrowedTable();
    } catch (err) {
        console.error('Failed to load borrowed data:', err);
    }
}

// Render Borrowed Debt Table with Filter
function renderBorrowedTable() {
    if (!borrowedTbody) return;

    let filtered = allBorrowedRecords;
    if (currentBorrowedFilter === 'pending') {
        filtered = allBorrowedRecords.filter(r => r.status === 'pending');
    } else if (currentBorrowedFilter === 'repaid') {
        filtered = allBorrowedRecords.filter(r => r.status === 'repaid');
    }

    if (filtered.length === 0) {
        const msg = currentBorrowedFilter === 'all'
            ? 'No debt records found. Record borrowed money using the form above.'
            : currentBorrowedFilter === 'pending'
                ? 'No active debt liabilities. All borrowed funds have been settled!'
                : 'No settled debts yet. Click "Mark as Repaid" when you pay back a lender.';
        borrowedTbody.innerHTML = `<tr><td colspan="10" class="empty-cell">${msg}</td></tr>`;
        return;
    }

    borrowedTbody.innerHTML = filtered.map(r => {
        const isRepaid = r.status === 'repaid';
        const calc = calcClientLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_borrowed, r.date_repaid, r.status);
        const days = r.days_elapsed !== undefined ? r.days_elapsed : calc.daysElapsed;
        const dailyRate = r.daily_interest !== undefined ? r.daily_interest : calc.dailyInterest;
        const interestAmt = r.interest_amount !== undefined ? r.interest_amount : calc.accruedInterest;
        const totalDue = r.total_due !== undefined ? r.total_due : calc.totalDue;

        // Daily Rate Badge
        let dailyRateHtml = '';
        if (dailyRate > 0) {
            dailyRateHtml = `<span class="daily-rate-tag">+${currentCurrency}${dailyRate.toFixed(2)}/day</span>`;
        } else if (r.interest_type === 'flat' && (r.interest_rate > 0 || r.interest_amount > 0)) {
            dailyRateHtml = `<span class="daily-rate-tag text-muted">Fixed ${currentCurrency}${r.interest_rate || r.interest_amount}</span>`;
        } else {
            dailyRateHtml = `<span class="lent-no-interest">0% (Zero Interest)</span>`;
        }

        // Days Active Badge
        const daysHtml = isRepaid
            ? `<div class="days-badge days-badge-returned">${days} days (settled)</div>`
            : `<div class="days-badge days-badge-pending">${days} day${days === 1 ? '' : 's'} active</div>`;

        // Status Badge
        const statusHtml = isRepaid 
            ? `<span class="badge tag-returned">Fully Paid Off</span>` 
            : `<span class="badge tag-pending">Active Liability</span>`;

        // Interactive Return Settlement Button
        const tickBtnHtml = isRepaid
            ? `<button type="button" class="lent-settle-btn btn-settle-done" onclick="toggleBorrowedReturn(${r.id})" title="Settled on ${r.date_repaid || 'Settled'} (Click to revert if marked by mistake)">
                <span class="btn-check-icon">✓</span>
                <span>Paid Off (${r.date_repaid || 'Settled'})</span>
               </button>`
            : `<button type="button" class="lent-settle-btn btn-settle-pending" onclick="toggleBorrowedReturn(${r.id})" title="Click when you pay back the lender to clear liability">
                <span class="btn-check-icon">○</span>
                <span>Mark as Repaid</span>
               </button>`;

        return `
            <tr class="${isRepaid ? 'row-returned' : 'row-pending'}">
                <td>
                    <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${escapeHtml(r.lender_name)}</div>
                    ${r.notes ? `<div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">💬 ${escapeHtml(r.notes)}</div>` : ''}
                </td>
                <td>
                    <span class="purpose-badge purpose-borrowed">${escapeHtml(r.purpose || 'Personal Emergency')}</span>
                </td>
                <td>
                    <span class="amt-bold" style="font-size: 0.95rem;">${currentCurrency}${Number(r.amount).toLocaleString()}</span>
                </td>
                <td>
                    <div style="color: var(--text-muted); font-size: 0.82rem; font-weight: 500;">${r.date_borrowed}</div>
                    ${daysHtml}
                </td>
                <td>${dailyRateHtml}</td>
                <td>
                    <span class="amt-bold text-rose" style="font-size: 0.92rem;">
                        +${currentCurrency}${Number(interestAmt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </td>
                <td>
                    <span class="amt-bold" style="color: ${isRepaid ? '#10b981' : '#e11d48'}; font-size: 1.02rem;">
                        ${currentCurrency}${Number(totalDue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </td>
                <td>${statusHtml}</td>
                <td>${tickBtnHtml}</td>
                <td>
                    <button class="del-btn-icon" onclick="deleteBorrowed(${r.id})" title="Delete debt record">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Filter Tab Click Handlers for Borrowed
document.querySelectorAll('.borrowed-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.borrowed-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBorrowedFilter = btn.getAttribute('data-filter') || 'all';
        renderBorrowedTable();
    });
});

// Toggle Borrowed Repayment Status
window.toggleBorrowedReturn = async function(id) {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/borrowed/${id}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            alert(data.error || 'Failed to update debt settlement status');
            return;
        }

        await refreshAllData();
    } catch (err) {
        console.error('Toggle borrowed error:', err);
    }
};

// Delete Borrowed Record
window.deleteBorrowed = async function(id) {
    if (!confirm('Are you sure you want to permanently delete this debt liability record?')) return;
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/borrowed/${id}?userId=${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            await refreshAllData();
        }
    } catch (err) {
        console.error('Delete borrowed error:', err);
    }
};

// Borrowed Form Submission
if (borrowedForm) {
    borrowedForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const lenderName = (borrowedLenderName?.value || '').trim();
        const amount = Number(borrowedAmount?.value);
        const dateBorrowed = (borrowedDateBorrowed?.value || '').trim() || new Date().toISOString().split('T')[0];
        const purpose = (borrowedPurpose?.value || 'Personal Emergency').trim();
        const interestType = borrowedInterestType?.value || 'none';
        const interestRate = Number(borrowedInterestVal?.value) || 0;
        const notes = (borrowedNotes?.value || '').trim();
        const userId = String(currentUser.id || currentUser.email);

        if (!lenderName || !amount || isNaN(amount) || amount <= 0) {
            alert('Please provide a valid lender name and an amount greater than zero.');
            return;
        }

        const origBtnHtml = borrowedSubmitBtn.innerHTML;
        borrowedSubmitBtn.disabled = true;
        borrowedSubmitBtn.innerHTML = '<span>⏳</span> Recording Debt Liability...';

        try {
            const res = await fetch(`${API_BASE}/api/borrowed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    lenderName,
                    amount,
                    dateBorrowed,
                    purpose,
                    interestType,
                    interestRate,
                    notes
                })
            });

            const data = await res.json();
            borrowedSubmitBtn.disabled = false;
            borrowedSubmitBtn.innerHTML = origBtnHtml;

            if (!res.ok || !data.success) {
                alert(data.error || 'Failed to record debt liability');
                return;
            }

            // Reset Form & Preview
            borrowedLenderName.value = '';
            borrowedAmount.value = '';
            if (borrowedDateBorrowed) borrowedDateBorrowed.value = new Date().toISOString().split('T')[0];
            if (borrowedPurpose) borrowedPurpose.value = 'Personal Emergency';
            borrowedInterestType.value = 'none';
            if (borrowedInterestValGroup) borrowedInterestValGroup.style.display = 'none';
            if (borrowedInterestVal) borrowedInterestVal.value = '0';
            if (borrowedNotes) borrowedNotes.value = '';
            updateBorrowedPreview();

            // Refresh all data
            await refreshAllData();

            // Success feedback on button
            borrowedSubmitBtn.innerHTML = '<span>✓</span> Debt Recorded!';
            setTimeout(() => {
                borrowedSubmitBtn.innerHTML = origBtnHtml;
            }, 1200);

        } catch (err) {
            console.error('Add borrowed error:', err);
            borrowedSubmitBtn.disabled = false;
            borrowedSubmitBtn.innerHTML = origBtnHtml;
            alert('Failed to record debt liability. Please check your network connection.');
        }
    });
}

// ==================== 8. HELP CENTER & SUPPORT TICKETS ====================
const supportTicketForm = document.getElementById('support-ticket-form');
const supportName = document.getElementById('support-name');
const supportEmail = document.getElementById('support-email');
const supportCategory = document.getElementById('support-category');
const supportPriority = document.getElementById('support-priority');
const supportSubject = document.getElementById('support-subject');
const supportMessage = document.getElementById('support-message');
const supportSubmitBtn = document.getElementById('support-submit-btn');
const supportError = document.getElementById('support-error');
const supportSuccess = document.getElementById('support-success');
const userTicketsList = document.getElementById('user-tickets-list');
const refreshTicketsBtn = document.getElementById('refresh-tickets-btn');

async function loadUserTickets() {
    if (!currentUser || !userTicketsList) return;
    const userId = String(currentUser.id || currentUser.email);

    try {
        const res = await fetch(`${API_BASE}/api/support/tickets/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.tickets)) {
            if (data.tickets.length === 0) {
                userTicketsList.innerHTML = `<div class="empty-cell" style="padding: 16px; font-size: 0.82rem;">No support tickets submitted yet.</div>`;
                return;
            }

            userTicketsList.innerHTML = data.tickets.map(t => {
                const prioClass = t.priority?.toLowerCase() === 'urgent' 
                    ? 'tag-priority-urgent' 
                    : t.priority?.toLowerCase() === 'high' 
                        ? 'tag-priority-high' 
                        : 'tag-priority-normal';

                const formattedDate = new Date(t.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return `
                    <div class="ticket-item">
                        <div class="ticket-item-header">
                            <span class="ticket-subject">#${t.id}: ${escapeHtml(t.subject)}</span>
                            <span class="ticket-priority-tag ${prioClass}">${escapeHtml(t.priority || 'Normal')}</span>
                        </div>
                        <div style="font-size: 0.78rem; color: #475569; line-height: 1.4; margin: 4px 0;">
                            ${escapeHtml(t.message.length > 80 ? t.message.substring(0, 80) + '...' : t.message)}
                        </div>
                        <div class="ticket-meta">
                            📁 ${escapeHtml(t.category)} • 🕒 ${formattedDate} • Status: <span style="font-weight: 600; color: #0284c7;">${escapeHtml(t.status || 'open')}</span>
                        </div>
                    </div>
                `;
            }).join('');
        }
    } catch (e) {
        console.warn('Could not load tickets:', e);
    }
}

if (refreshTicketsBtn) {
    refreshTicketsBtn.addEventListener('click', () => {
        loadUserTickets();
    });
}

if (supportTicketForm) {
    supportTicketForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (supportError) supportError.style.display = 'none';
        if (supportSuccess) supportSuccess.style.display = 'none';

        const name = (supportName?.value || '').trim();
        const email = (supportEmail?.value || '').trim();
        const category = supportCategory?.value || 'General Inquiry';
        const priority = supportPriority?.value || 'Normal';
        const subject = (supportSubject?.value || '').trim();
        const message = (supportMessage?.value || '').trim();

        if (!name || !email || !subject || !message) {
            if (supportError) {
                supportError.innerText = 'Please fill out all required fields.';
                supportError.style.display = 'block';
            }
            return;
        }

        const origBtnHtml = supportSubmitBtn.innerHTML;
        supportSubmitBtn.disabled = true;
        supportSubmitBtn.innerHTML = '<span>⏳</span> Sending to Admin Gmail...';

        try {
            const res = await fetch(`${API_BASE}/api/support/contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser ? currentUser.id : 'anonymous',
                    userName: name,
                    userEmail: email,
                    category,
                    priority,
                    subject,
                    message
                })
            });

            const data = await res.json();
            supportSubmitBtn.disabled = false;
            supportSubmitBtn.innerHTML = origBtnHtml;

            if (!res.ok) {
                if (supportError) {
                    supportError.innerText = data.error || 'Failed to submit ticket. Please try again.';
                    supportError.style.display = 'block';
                }
                return;
            }

            if (supportSuccess) {
                supportSuccess.innerHTML = `
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="font-weight: 700; font-size: 0.95rem; color: #047857;">🎉 Support Ticket #${data.ticketId} Sent Successfully!</div>
                        <div style="font-size: 0.84rem; line-height: 1.5; color: #065f46;">
                            Your message has been emailed directly to the admin's Gmail.<br>
                            The admin will review your message and reply directly to <strong>${escapeHtml(email)}</strong>.
                        </div>
                    </div>
                `;
                supportSuccess.style.display = 'block';
            }

            // Clear inputs
            if (supportSubject) supportSubject.value = '';
            if (supportMessage) supportMessage.value = '';

            // Refresh ticket list
            loadUserTickets();

        } catch (err) {
            console.error('Support ticket error:', err);
            supportSubmitBtn.disabled = false;
            supportSubmitBtn.innerHTML = origBtnHtml;
            if (supportError) {
                supportError.innerText = 'Connection error: Unable to deliver ticket to server.';
                supportError.style.display = 'block';
            }
        }
    });
}

// ==================== 8. THREE-ENVELOPE CAPITAL ALLOCATION SYSTEM & MODAL ====================
let currentEnvelopeData = null;

const openEnvelopeModalBtn = document.getElementById('open-envelope-modal-btn');
const closeEnvelopeModalBtn = document.getElementById('close-envelope-modal-btn');
const modalEnvelopeAllocations = document.getElementById('modal-envelope-allocations');
const envelopeAllocationForm = document.getElementById('envelope-allocation-form');
const allocMonthInput = document.getElementById('alloc-month');
const allocGrossInput = document.getElementById('alloc-gross');
const allocExpenseInput = document.getElementById('alloc-expense');
const allocLentInput = document.getElementById('alloc-lent');
const allocPreviewTotal = document.getElementById('alloc-preview-total');
const allocPreviewReserve = document.getElementById('alloc-preview-reserve');
const allocWarningMsg = document.getElementById('alloc-warning-msg');
const saveEnvelopeAllocBtn = document.getElementById('save-envelope-alloc-btn');

function updateAllocPreview() {
    if (!allocGrossInput || !allocExpenseInput || !allocLentInput) return;
    const gross = Number(allocGrossInput.value) || 0;
    const expense = Number(allocExpenseInput.value) || 0;
    const lent = Number(allocLentInput.value) || 0;
    const totalAllocated = expense + lent;
    const unallocated = gross - totalAllocated;

    if (allocPreviewTotal) allocPreviewTotal.innerText = `${currentCurrency}${totalAllocated.toLocaleString()}`;
    if (allocPreviewReserve) {
        allocPreviewReserve.innerText = `${currentCurrency}${Math.max(0, unallocated).toLocaleString()}`;
        allocPreviewReserve.style.color = unallocated >= 0 ? '#10b981' : '#f43f5e';
    }

    if (allocWarningMsg) {
        if (totalAllocated > gross && gross > 0) {
            allocWarningMsg.style.display = 'block';
            allocWarningMsg.innerText = `⚠️ Warning: Total allocated (${currentCurrency}${totalAllocated.toLocaleString()}) exceeds gross income by ${currentCurrency}${(totalAllocated - gross).toLocaleString()}!`;
        } else {
            allocWarningMsg.style.display = 'none';
        }
    }
}

if (allocGrossInput) allocGrossInput.addEventListener('input', updateAllocPreview);
if (allocExpenseInput) allocExpenseInput.addEventListener('input', updateAllocPreview);
if (allocLentInput) allocLentInput.addEventListener('input', updateAllocPreview);

async function loadMonthIntoAllocModal(targetMonth) {
    if (!currentUser || !allocMonthInput) return;
    allocMonthInput.value = targetMonth;
    const userId = String(currentUser.id || currentUser.email);
    try {
        const res = await fetch(`${API_BASE}/api/budget/${encodeURIComponent(userId)}/${targetMonth}`);
        const data = await res.json();
        if (data && data.budget) {
            const b = data.budget;
            if (allocGrossInput) allocGrossInput.value = b.grossIncome > 0 ? b.grossIncome : '';
            if (allocExpenseInput) allocExpenseInput.value = b.expenseEnvelope?.budget > 0 ? b.expenseEnvelope.budget : '';
            if (allocLentInput) allocLentInput.value = b.lendingEnvelope?.fundBudget > 0 ? b.lendingEnvelope.fundBudget : '';
        } else {
            if (allocGrossInput) allocGrossInput.value = '';
            if (allocExpenseInput) allocExpenseInput.value = '';
            if (allocLentInput) allocLentInput.value = '';
        }
        updateAllocPreview();
    } catch (e) {
        console.error('Failed to load month into modal:', e);
    }
}

if (allocMonthInput) {
    allocMonthInput.addEventListener('change', (e) => {
        if (e.target.value) loadMonthIntoAllocModal(e.target.value);
    });
}

const allocLastMonthBtn = document.getElementById('alloc-last-month-btn');
const allocCurrentMonthBtn = document.getElementById('alloc-current-month-btn');
const calSetBudgetBtn = document.getElementById('cal-set-budget-btn');

if (allocLastMonthBtn) {
    allocLastMonthBtn.addEventListener('click', () => {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const lastMonthStr = now.toISOString().slice(0, 7);
        loadMonthIntoAllocModal(lastMonthStr);
    });
}

if (allocCurrentMonthBtn) {
    allocCurrentMonthBtn.addEventListener('click', () => {
        const curMonthStr = new Date().toISOString().slice(0, 7);
        loadMonthIntoAllocModal(curMonthStr);
    });
}

if (calSetBudgetBtn) {
    calSetBudgetBtn.addEventListener('click', () => {
        openEnvelopeModal(activeCalendarMonth);
    });
}

function openEnvelopeModal(customMonth) {
    if (!modalEnvelopeAllocations) return;
    const targetMonth = customMonth || activeCalendarMonth || new Date().toISOString().slice(0, 7);
    if (allocMonthInput) allocMonthInput.value = targetMonth;
    loadMonthIntoAllocModal(targetMonth);
    modalEnvelopeAllocations.style.display = 'flex';
}

function closeEnvelopeModal() {
    if (modalEnvelopeAllocations) modalEnvelopeAllocations.style.display = 'none';
}

if (openEnvelopeModalBtn) openEnvelopeModalBtn.addEventListener('click', () => openEnvelopeModal());
if (closeEnvelopeModalBtn) closeEnvelopeModalBtn.addEventListener('click', closeEnvelopeModal);

if (envelopeAllocationForm) {
    envelopeAllocationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;
        const userId = String(currentUser.id || currentUser.email);

        const month = allocMonthInput?.value || new Date().toISOString().slice(0, 7);
        const grossIncome = Number(allocGrossInput?.value) || 0;
        const expenseBudget = Number(allocExpenseInput?.value) || 0;
        const lentBudget = Number(allocLentInput?.value) || 0;

        const origText = saveEnvelopeAllocBtn ? saveEnvelopeAllocBtn.innerText : 'Save';
        if (saveEnvelopeAllocBtn) {
            saveEnvelopeAllocBtn.disabled = true;
            saveEnvelopeAllocBtn.innerText = 'Saving Allocations... ⏳';
        }

        try {
            const res = await fetch(`${API_BASE}/api/budget/${encodeURIComponent(userId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month,
                    grossIncome,
                    expenseBudget,
                    lentBudget
                })
            });
            const data = await res.json();
            if (saveEnvelopeAllocBtn) {
                saveEnvelopeAllocBtn.disabled = false;
                saveEnvelopeAllocBtn.innerText = origText;
            }

            if (!res.ok || !data.success) {
                alert(data.error || 'Failed to save envelope allocations');
                return;
            }

            closeEnvelopeModal();
            await refreshAllData();
            if (activeCalendarMonth === month) {
                await loadCalendarMonth(month);
            }
        } catch (err) {
            console.error('Save envelopes error:', err);
            if (saveEnvelopeAllocBtn) {
                saveEnvelopeAllocBtn.disabled = false;
                saveEnvelopeAllocBtn.innerText = origText;
            }
            alert('Failed to connect to server. Please try again.');
        }
    });
}

// ==================== 9. CALENDAR & MONTHLY HISTORICAL ARCHIVE ENGINE ====================
let activeCalendarMonth = new Date().toISOString().slice(0, 7);
window.activeCalendarMonth = activeCalendarMonth;
let currentCalendarData = null;
let currentCalFilter = 'all'; // 'all' | 'expense' | 'lent' | 'borrowed'

const calMonthText = document.getElementById('cal-month-text');
const calMonthPicker = document.getElementById('cal-month-picker');
const calPrevBtn = document.getElementById('cal-prev-btn');
const calNextBtn = document.getElementById('cal-next-btn');
const calTodayBtn = document.getElementById('cal-today-btn');
const calDaysGrid = document.getElementById('cal-days-grid');
const calLedgerTbody = document.getElementById('cal-ledger-tbody');

// Format YYYY-MM into Human Readable Month (e.g. "September 2026")
function formatMonthDisplay(monthStr) {
    if (!monthStr) return '';
    const parts = monthStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

// Shift active month by delta (+1 or -1)
function shiftCalendarMonth(delta) {
    const parts = (activeCalendarMonth || new Date().toISOString().slice(0, 7)).split('-');
    let year = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) + delta;

    if (month > 12) {
        month = 1;
        year += 1;
    } else if (month < 1) {
        month = 12;
        year -= 1;
    }

    const newMonthStr = `${year}-${String(month).padStart(2, '0')}`;
    loadCalendarMonth(newMonthStr);
}

if (calPrevBtn) calPrevBtn.addEventListener('click', () => shiftCalendarMonth(-1));
if (calNextBtn) calNextBtn.addEventListener('click', () => shiftCalendarMonth(1));
if (calTodayBtn) calTodayBtn.addEventListener('click', () => {
    const todayMonth = new Date().toISOString().slice(0, 7);
    loadCalendarMonth(todayMonth);
});
if (calMonthPicker) calMonthPicker.addEventListener('change', (e) => {
    if (e.target.value) {
        loadCalendarMonth(e.target.value);
    }
});

// Load and Render Calendar Month Archive
async function loadCalendarMonth(targetMonth) {
    if (!currentUser) return;
    const userId = String(currentUser.id || currentUser.email);
    const monthStr = targetMonth || activeCalendarMonth || new Date().toISOString().slice(0, 7);
    activeCalendarMonth = monthStr;
    window.activeCalendarMonth = monthStr;

    // Update Toolbar Display
    if (calMonthText) calMonthText.innerText = formatMonthDisplay(monthStr);
    if (calMonthPicker) calMonthPicker.value = monthStr;

    try {
        const res = await fetch(`${API_BASE}/api/calendar/${encodeURIComponent(userId)}/${encodeURIComponent(monthStr)}`);
        const data = await res.json();
        if (!data.success || !data.data) return;

        currentCalendarData = data.data;
        const b = currentCalendarData.budgetStats;

        // 1. Populate Month Envelope Summary Strip
        const grossEl = document.getElementById('cal-kpi-gross');
        const reserveEl = document.getElementById('cal-kpi-reserve');
        const expSpentEl = document.getElementById('cal-kpi-expense-spent');
        const expBudgetEl = document.getElementById('cal-kpi-expense-budget');
        const expTagEl = document.getElementById('cal-kpi-expense-tag');
        const lentActiveEl = document.getElementById('cal-kpi-lent-active');
        const lentBudgetEl = document.getElementById('cal-kpi-lent-budget');
        const lentTagEl = document.getElementById('cal-kpi-lent-tag');
        const retainedEl = document.getElementById('cal-kpi-retained');

        if (b) {
            const exp = b.expenseEnvelope || {};
            const lent = b.lendingEnvelope || {};

            if (grossEl) grossEl.innerText = `${currentCurrency}${Number(b.grossIncome || 0).toLocaleString()}`;
            if (reserveEl) reserveEl.innerText = `Unallocated Reserve: ${currentCurrency}${Number(b.unallocatedReserve || 0).toLocaleString()}`;

            if (expSpentEl) expSpentEl.innerText = `${currentCurrency}${Number(exp.spent || 0).toLocaleString()}`;
            if (expBudgetEl) expBudgetEl.innerText = `Budget: ${currentCurrency}${Number(exp.budget || 0).toLocaleString()} | Remaining: ${currentCurrency}${Number(exp.remaining || 0).toLocaleString()}`;
            if (expTagEl) {
                expTagEl.innerText = `${exp.percentage || 0}% Used`;
                expTagEl.className = exp.overspent > 0 ? 'kpi-tag tag-rose' : 'kpi-tag';
            }

            if (lentActiveEl) lentActiveEl.innerText = `${currentCurrency}${Number(lent.activeLent || 0).toLocaleString()}`;
            if (lentBudgetEl) lentBudgetEl.innerText = `Fund: ${currentCurrency}${Number(lent.fundBudget || 0).toLocaleString()} | Remaining Limit: ${currentCurrency}${Number(lent.remainingCapacity || 0).toLocaleString()}`;
            if (lentTagEl) {
                lentTagEl.innerText = `${lent.percentage || 0}% Deployed`;
                lentTagEl.className = lent.overcommitted > 0 ? 'kpi-tag tag-rose' : 'kpi-tag tag-warning';
            }

            if (retainedEl) retainedEl.innerText = `${currentCurrency}${Number(b.totalRetainedLiquid || 0).toLocaleString()}`;
        }

        // 2. Render 7-Day Calendar Grid
        renderCalendarGrid(monthStr, currentCalendarData.days || {});

        // 3. Render Itemized Monthly Ledger
        renderCalendarLedger();

    } catch (err) {
        console.error('Failed to load calendar month:', err);
    }
}

// Render 7-Day Matrix Grid
function renderCalendarGrid(monthStr, daysData) {
    if (!calDaysGrid) return;

    const parts = monthStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed

    const firstDate = new Date(year, month, 1);
    const lastDate = new Date(year, month + 1, 0);
    const totalDays = lastDate.getDate();

    // Determine day of week for the 1st (0=Sun, 1=Mon, ..., 6=Sat)
    // Convert to Monday-first (0=Mon, 1=Tue, ..., 6=Sun)
    let startDayOfWeek = (firstDate.getDay() + 6) % 7;

    const todayStr = new Date().toISOString().split('T')[0];
    let html = '';

    // Days in previous month for padding
    const prevMonthLastDate = new Date(year, month, 0).getDate();
    for (let i = 0; i < startDayOfWeek; i++) {
        const prevDayNum = prevMonthLastDate - startDayOfWeek + i + 1;
        html += `
            <div class="cal-day-cell other-month">
                <div class="cal-day-header">
                    <span class="cal-day-num">${prevDayNum}</span>
                </div>
            </div>
        `;
    }

    // Days in current active month
    for (let day = 1; day <= totalDays; day++) {
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dayStr === todayStr;
        const activity = daysData[dayStr];

        let badgesHtml = '';
        let totalItems = 0;

        if (activity) {
            const expCount = (activity.expenses || []).length;
            const lentCount = (activity.lent || []).length;
            const borrowedCount = (activity.borrowed || []).length;
            totalItems = expCount + lentCount + borrowedCount;

            if (activity.totalExpense > 0) {
                badgesHtml += `<div class="cal-chip chip-expense" title="${expCount} expense(s)">💳 ${currentCurrency}${Math.round(activity.totalExpense).toLocaleString()}</div>`;
            }
            if (activity.totalLent > 0) {
                badgesHtml += `<div class="cal-chip chip-lent" title="${lentCount} loan(s) issued">🤝 ${currentCurrency}${Math.round(activity.totalLent).toLocaleString()}</div>`;
            }
            if (activity.totalBorrowed > 0) {
                badgesHtml += `<div class="cal-chip chip-borrowed" title="${borrowedCount} debt(s)">📥 ${currentCurrency}${Math.round(activity.totalBorrowed).toLocaleString()}</div>`;
            }
        }

        const cellClasses = [
            'cal-day-cell',
            isToday ? 'is-today' : '',
            activity && totalItems > 0 ? 'has-activity' : ''
        ].filter(Boolean).join(' ');

        html += `
            <div class="${cellClasses}" data-date="${dayStr}">
                <div class="cal-day-header">
                    <span class="cal-day-num">${day}</span>
                    ${totalItems > 0 ? `<span class="cal-activity-count">${totalItems} item${totalItems === 1 ? '' : 's'}</span>` : ''}
                </div>
                <div class="cal-day-badges">
                    ${badgesHtml}
                </div>
            </div>
        `;
    }

    // Days in next month for trailing padding (to reach 35 or 42 grid cells)
    const filledCount = startDayOfWeek + totalDays;
    const totalSlots = filledCount <= 35 ? 35 : 42;
    const trailingDays = totalSlots - filledCount;

    for (let day = 1; day <= trailingDays; day++) {
        html += `
            <div class="cal-day-cell other-month">
                <div class="cal-day-header">
                    <span class="cal-day-num">${day}</span>
                </div>
            </div>
        `;
    }

    calDaysGrid.innerHTML = html;

    // Attach click listeners to open Day Detail Modal
    calDaysGrid.querySelectorAll('.cal-day-cell:not(.other-month)').forEach(cell => {
        cell.addEventListener('click', () => {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr && currentCalendarData) {
                const dayAct = (currentCalendarData.days && currentCalendarData.days[dateStr]) || {
                    date: dateStr,
                    expenses: [],
                    lent: [],
                    borrowed: [],
                    totalExpense: 0,
                    totalLent: 0,
                    totalBorrowed: 0
                };
                openDayDetailModal(dateStr, dayAct);
            }
        });
    });
}

// Render Monthly Chronological Ledger
function renderCalendarLedger() {
    if (!calLedgerTbody || !currentCalendarData) return;

    const raw = currentCalendarData.raw || {};
    const items = [];

    // 1. Expenses
    (raw.expenses || []).forEach(e => {
        items.push({
            id: `exp-${e.id}`,
            type: 'expense',
            date: e.date ? e.date.split('T')[0] : '',
            title: e.title,
            category: e.category || 'General',
            amount: Number(e.amount) || 0,
            status: 'Settled',
            raw: e
        });
    });

    // 2. Lent Loans
    (raw.lentRecords || []).forEach(l => {
        items.push({
            id: `lent-${l.id}`,
            type: 'lent',
            date: l.date_lent ? l.date_lent.split('T')[0] : '',
            title: l.person_name,
            category: l.purpose || 'Personal Loan',
            amount: Number(l.amount) || 0,
            status: l.status === 'returned' ? `Settled (${l.date_returned || 'Repaid'})` : 'Active / Pending Repayment',
            raw: l
        });
    });

    // 3. Borrowed Debts
    (raw.borrowedRecords || []).forEach(b => {
        items.push({
            id: `borrowed-${b.id}`,
            type: 'borrowed',
            date: b.date_borrowed ? b.date_borrowed.split('T')[0] : '',
            title: b.lender_name,
            category: b.purpose || 'Debt Liability',
            amount: Number(b.amount) || 0,
            status: b.status === 'repaid' ? `Settled (${b.date_repaid || 'Paid'})` : 'Active / Due to Lender',
            raw: b
        });
    });

    // Sort descending by date
    items.sort((a, b) => b.date.localeCompare(a.date));

    // Update Counts on Filter Tabs
    const expItems = items.filter(i => i.type === 'expense');
    const lentItems = items.filter(i => i.type === 'lent');
    const borrowedItems = items.filter(i => i.type === 'borrowed');

    const countAllEl = document.getElementById('cal-count-all');
    const countExpEl = document.getElementById('cal-count-expense');
    const countLentEl = document.getElementById('cal-count-lent');
    const countBorrowedEl = document.getElementById('cal-count-borrowed');

    if (countAllEl) countAllEl.innerText = items.length;
    if (countExpEl) countExpEl.innerText = expItems.length;
    if (countLentEl) countLentEl.innerText = lentItems.length;
    if (countBorrowedEl) countBorrowedEl.innerText = borrowedItems.length;

    // Filter Items
    let filtered = items;
    if (currentCalFilter === 'expense') filtered = expItems;
    else if (currentCalFilter === 'lent') filtered = lentItems;
    else if (currentCalFilter === 'borrowed') filtered = borrowedItems;

    if (filtered.length === 0) {
        calLedgerTbody.innerHTML = `<tr><td colspan="6" class="empty-cell">No ${currentCalFilter === 'all' ? '' : currentCalFilter} activity recorded for ${formatMonthDisplay(activeCalendarMonth)}.</td></tr>`;
        return;
    }

    calLedgerTbody.innerHTML = filtered.map(item => {
        let typeBadge = '';
        let amtClass = '';

        if (item.type === 'expense') {
            typeBadge = `<span class="cal-chip chip-expense">💳 Expense</span>`;
            amtClass = 'text-rose';
        } else if (item.type === 'lent') {
            typeBadge = `<span class="cal-chip chip-lent">🤝 Loan Lent</span>`;
            amtClass = 'text-warning';
        } else if (item.type === 'borrowed') {
            typeBadge = `<span class="cal-chip chip-borrowed">📥 Borrowed</span>`;
            amtClass = 'text-primary';
        }

        return `
            <tr>
                <td style="font-weight: 600; color: #475569; font-size: 0.85rem;">${item.date}</td>
                <td>${typeBadge}</td>
                <td><strong>${escapeHtml(item.title)}</strong></td>
                <td><span class="cat-badge">${escapeHtml(item.category)}</span></td>
                <td><span class="amt-bold ${amtClass}">${currentCurrency}${item.amount.toLocaleString()}</span></td>
                <td><span style="font-size: 0.82rem; color: #64748b;">${escapeHtml(item.status)}</span></td>
            </tr>
        `;
    }).join('');
}

// Calendar Filter Tabs Listener
document.querySelectorAll('#cal-ledger-tabs .lent-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#cal-ledger-tabs .lent-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCalFilter = btn.getAttribute('data-cal-filter') || 'all';
        renderCalendarLedger();
    });
});

// ==================== 10. DAY DETAIL MODAL ====================
const modalDayDetail = document.getElementById('modal-day-detail');
const closeDayModalBtn = document.getElementById('close-day-modal-btn');
const dayDetailTitle = document.getElementById('day-detail-title');
const dayDetailSubtitle = document.getElementById('day-detail-subtitle');
const dayStatExpense = document.getElementById('day-stat-expense');
const dayStatLent = document.getElementById('day-stat-lent');
const dayStatBorrowed = document.getElementById('day-stat-borrowed');
const dayDetailList = document.getElementById('day-detail-list');

function openDayDetailModal(dateStr, dayData) {
    if (!modalDayDetail) return;

    const formattedDate = new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });

    if (dayDetailTitle) dayDetailTitle.innerText = `📅 ${formattedDate}`;
    if (dayDetailSubtitle) dayDetailSubtitle.innerText = `Full activity report for ${dateStr}`;

    if (dayStatExpense) dayStatExpense.innerText = `${currentCurrency}${Number(dayData.totalExpense || 0).toLocaleString()}`;
    if (dayStatLent) dayStatLent.innerText = `${currentCurrency}${Number(dayData.totalLent || 0).toLocaleString()}`;
    if (dayStatBorrowed) dayStatBorrowed.innerText = `${currentCurrency}${Number(dayData.totalBorrowed || 0).toLocaleString()}`;

    const expenses = dayData.expenses || [];
    const lent = dayData.lent || [];
    const borrowed = dayData.borrowed || [];

    if (expenses.length === 0 && lent.length === 0 && borrowed.length === 0) {
        if (dayDetailList) {
            dayDetailList.innerHTML = `<div class="empty-cell" style="padding: 24px;">No transactions recorded on this date.</div>`;
        }
    } else {
        let itemsHtml = '';

        expenses.forEach(e => {
            itemsHtml += `
                <div class="day-detail-item">
                    <div class="day-item-left">
                        <div class="day-item-icon icon-exp">💳</div>
                        <div>
                            <div class="day-item-title">${escapeHtml(e.title)}</div>
                            <div class="day-item-meta">Expense • ${escapeHtml(e.category || 'General')}</div>
                        </div>
                    </div>
                    <div class="day-item-amount text-rose">
                        -${currentCurrency}${Number(e.amount).toLocaleString()}
                    </div>
                </div>
            `;
        });

        lent.forEach(l => {
            const isSettled = l.status === 'returned';
            itemsHtml += `
                <div class="day-detail-item">
                    <div class="day-item-left">
                        <div class="day-item-icon icon-lent">🤝</div>
                        <div>
                            <div class="day-item-title">Lent to ${escapeHtml(l.person_name)}</div>
                            <div class="day-item-meta">Loan • ${escapeHtml(l.purpose || 'Personal')} • Status: <strong>${isSettled ? 'Settled' : 'Pending'}</strong></div>
                        </div>
                    </div>
                    <div class="day-item-amount text-warning">
                        ${currentCurrency}${Number(l.amount).toLocaleString()}
                    </div>
                </div>
            `;
        });

        borrowed.forEach(b => {
            const isSettled = b.status === 'repaid';
            itemsHtml += `
                <div class="day-detail-item">
                    <div class="day-item-left">
                        <div class="day-item-icon icon-borrowed">📥</div>
                        <div>
                            <div class="day-item-title">Borrowed from ${escapeHtml(b.lender_name)}</div>
                            <div class="day-item-meta">Debt • ${escapeHtml(b.purpose || 'Personal')} • Status: <strong>${isSettled ? 'Repaid' : 'Pending Due'}</strong></div>
                        </div>
                    </div>
                    <div class="day-item-amount text-primary">
                        ${currentCurrency}${Number(b.amount).toLocaleString()}
                    </div>
                </div>
            `;
        });

        if (dayDetailList) dayDetailList.innerHTML = itemsHtml;
    }

    modalDayDetail.style.display = 'flex';
}

function closeDayDetailModal() {
    if (modalDayDetail) modalDayDetail.style.display = 'none';
}

if (closeDayModalBtn) closeDayModalBtn.addEventListener('click', closeDayDetailModal);

// Boot Check
checkAuth();
