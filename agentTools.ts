// agentTools.ts: AI Agent Tools + SQLite Database + Analytics
import { Type } from '@google/genai';
import db from './db.js';

export interface Expense {
    id: number;
    user_id: string;
    title: string;
    amount: number;
    category: string;
    date: string;
}

export interface Task {
    id: number;
    user_id: string;
    title: string;
    status: 'pending' | 'completed';
    date: string;
}

export interface LentRecord {
    id: number;
    user_id: string;
    person_name: string;
    amount: number;
    interest_type: string;
    interest_rate: number;
    interest_amount: number;
    total_due: number;
    status: 'pending' | 'returned';
    date_lent: string;
    date_returned: string | null;
    notes: string | null;
    created_at: string;
    days_elapsed?: number;
    daily_interest?: number;
    rate_label?: string;
}

// 1. Add Expense
export async function addExpense(userId: string, title: string, amount: number, category: string = 'General'): Promise<string> {
    const date = new Date().toISOString().split('T')[0]!; // YYYY-MM-DD
    const stmt = db.prepare('INSERT INTO expenses (user_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?)');
    await stmt.run(userId, title, amount, category, date);

    const totalRow = await db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ?').get(userId) as { total: number | null };
    const total = totalRow?.total || 0;
    return `Success: Added expense of $${amount} for "${title}" under category [${category}]. Total expense is now $${total}.`;
}

// 2. Get Expense Summary
export async function getExpenseSummary(userId: string): Promise<string> {
    const rows = await db.prepare('SELECT title, amount, category FROM expenses WHERE user_id = ?').all(userId) as { title: string; amount: number; category: string }[];
    if (!rows || rows.length === 0) {
        return `No expenses recorded yet. Total: $0.`;
    }
    const totalRow = await db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ?').get(userId) as { total: number | null };
    const total = totalRow?.total || 0;
    const list = rows.map(e => `- ${e.title}: $${e.amount} (${e.category})`).join('\n');
    return `Total Expense: $${total}\n\nBreakdown:\n${list}`;
}

// 3. Add Task
export async function addTask(userId: string, title: string): Promise<string> {
    const date = new Date().toISOString().split('T')[0]!;
    const stmt = db.prepare('INSERT INTO tasks (user_id, title, status, date) VALUES (?, ?, ?, ?)');
    await stmt.run(userId, title, 'pending', date);
    return `Success: Task "${title}" added to your to-do list!`;
}

// 4. Get Pending Tasks
export async function getPendingTasks(userId: string): Promise<string> {
    const rows = await db.prepare('SELECT title FROM tasks WHERE user_id = ? AND status = "pending"').all(userId) as { title: string }[];
    if (!rows || rows.length === 0) {
        return `You have no pending tasks in your list. Everything is complete!`;
    }
    const list = rows.map((t, idx) => `${idx + 1}. ${t.title}`).join('\n');
    return `Pending Tasks:\n${list}`;
}

// 0. Set Monthly Salary Tool
export async function setMonthlySalary(userId: string, salary: number): Promise<string> {
    try {
        await db.prepare('UPDATE users SET monthly_salary = ? WHERE id = ? OR email = ?').run(salary, userId, userId);
        return `Success: Updated monthly income/salary to $${salary}.`;
    } catch (e) {
        return `Failed to update salary: ${e}`;
    }
}

// Helper: Calculate days elapsed and interest accrual
export function calculateLoanDaysAndInterest(
    amount: number,
    interestType: string,
    interestRate: number,
    dateLent: string,
    dateReturned: string | null = null,
    status: string = 'pending'
) {
    const numAmount = Number(amount) || 0;
    const numRate = Number(interestRate) || 0;

    const startDateStr = (dateLent ? dateLent.split('T')[0] : new Date().toISOString().split('T')[0])!;
    const startDate = new Date(`${startDateStr}T00:00:00`);

    const endDateStr = (status === 'returned' && dateReturned)
        ? dateReturned.split('T')[0]!
        : new Date().toISOString().split('T')[0]!;
    const endDate = new Date(`${endDateStr}T00:00:00`);

    const diffMs = Math.max(0, endDate.getTime() - startDate.getTime());
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let dailyInterest = 0;
    let accruedInterest = 0;
    let rateLabel = '0% (Zero Interest)';

    if (interestType === 'daily_percent') {
        dailyInterest = Math.round((numAmount * (numRate / 100)) * 100) / 100;
        accruedInterest = Math.round((dailyInterest * daysElapsed) * 100) / 100;
        rateLabel = `${numRate}% / day ($${dailyInterest.toFixed(2)}/day)`;
    } else if (interestType === 'monthly_percent' || interestType === 'percent') {
        dailyInterest = Math.round((numAmount * (numRate / 100) / 30) * 100) / 100;
        accruedInterest = Math.round((dailyInterest * daysElapsed) * 100) / 100;
        rateLabel = `${numRate}% / month ($${dailyInterest.toFixed(2)}/day)`;
    } else if (interestType === 'daily_flat') {
        dailyInterest = numRate;
        accruedInterest = Math.round((numRate * daysElapsed) * 100) / 100;
        rateLabel = `$${numRate} / day`;
    } else if (interestType === 'flat') {
        dailyInterest = 0;
        accruedInterest = numRate;
        rateLabel = `$${numRate} (One-time fixed)`;
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

// 7. Add Lent Record (Udhar Diya)
export async function addLentRecord(
    userId: string,
    personName: string,
    amount: number,
    interestType: string = 'none',
    interestRate: number = 0,
    notes: string = '',
    customDateLent?: string
): Promise<{ success: boolean; message: string; record?: any }> {
    const numAmount = Number(amount) || 0;
    const numRate = Number(interestRate) || 0;
    const dateLent = customDateLent && customDateLent.trim()
        ? customDateLent.trim().split('T')[0]!
        : new Date().toISOString().split('T')[0]!;

    const calc = calculateLoanDaysAndInterest(numAmount, interestType, numRate, dateLent, null, 'pending');
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO lent_records (user_id, person_name, amount, interest_type, interest_rate, interest_amount, total_due, status, date_lent, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    const info = await stmt.run(userId, personName.trim(), numAmount, interestType, numRate, calc.accruedInterest, calc.totalDue, dateLent, notes.trim(), createdAt);

    const interestInfo = calc.accruedInterest > 0
        ? ` with accrued interest of $${calc.accruedInterest} (${calc.rateLabel}, Total repayment: $${calc.totalDue})`
        : (calc.dailyInterest > 0 ? ` with daily accrual of $${calc.dailyInterest}/day (Total repayment: $${calc.totalDue})` : '');

    return {
        success: true,
        message: `Success: Recorded loan of $${numAmount} to "${personName}"${interestInfo}.`,
        record: {
            id: info.lastInsertRowid,
            user_id: userId,
            person_name: personName.trim(),
            amount: numAmount,
            interest_type: interestType,
            interest_rate: numRate,
            interest_amount: calc.accruedInterest,
            total_due: calc.totalDue,
            daily_interest: calc.dailyInterest,
            days_elapsed: calc.daysElapsed,
            rate_label: calc.rateLabel,
            status: 'pending',
            date_lent: dateLent,
            notes: notes.trim()
        }
    };
}

// 8. Toggle Lent Status (Mark as Returned or Pending)
export async function toggleLentStatus(lentId: number, userId?: string) {
    let query = 'SELECT * FROM lent_records WHERE id = ?';
    const args: any[] = [lentId];
    if (userId) {
        query += ' AND user_id = ?';
        args.push(userId);
    }
    const record = await db.prepare(query).get(...args) as LentRecord | undefined;
    if (!record) {
        throw new Error('Lent record not found');
    }

    const newStatus = record.status === 'pending' ? 'returned' : 'pending';
    const dateReturned = newStatus === 'returned' ? new Date().toISOString().split('T')[0]! : null;

    let finalInterestAmount = record.interest_amount;
    let finalTotalDue = record.total_due;

    if (newStatus === 'returned') {
        const calc = calculateLoanDaysAndInterest(record.amount, record.interest_type, record.interest_rate, record.date_lent, dateReturned, 'returned');
        finalInterestAmount = calc.accruedInterest;
        finalTotalDue = calc.totalDue;
    }

    await db.prepare('UPDATE lent_records SET status = ?, date_returned = ?, interest_amount = ?, total_due = ? WHERE id = ?')
        .run(newStatus, dateReturned, finalInterestAmount, finalTotalDue, lentId);

    return {
        success: true,
        newStatus,
        dateReturned,
        record: {
            ...record,
            status: newStatus,
            date_returned: dateReturned,
            interest_amount: finalInterestAmount,
            total_due: finalTotalDue
        }
    };
}

// 9. Get Lent Records & Stats
export async function getLentRecords(userId: string) {
    const rawRecords = await db.prepare('SELECT * FROM lent_records WHERE user_id = ? ORDER BY id DESC').all(userId) as LentRecord[];

    let totalLentGiven = 0;
    let pendingPrincipal = 0;
    let pendingTotalDue = 0;
    let returnedTotal = 0;
    let interestEarned = 0;

    const enrichedRecords = (rawRecords || []).map(r => {
        totalLentGiven += Number(r.amount) || 0;

        if (r.status === 'returned') {
            const calc = calculateLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_lent, r.date_returned, 'returned');
            returnedTotal += Number(r.total_due) || 0;
            interestEarned += Number(r.interest_amount) || 0;
            return {
                ...r,
                days_elapsed: calc.daysElapsed,
                daily_interest: calc.dailyInterest,
                rate_label: calc.rateLabel
            };
        } else {
            const calc = calculateLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_lent, null, 'pending');
            pendingPrincipal += Number(r.amount) || 0;
            pendingTotalDue += calc.totalDue;
            return {
                ...r,
                days_elapsed: calc.daysElapsed,
                daily_interest: calc.dailyInterest,
                interest_amount: calc.accruedInterest,
                total_due: calc.totalDue,
                rate_label: calc.rateLabel
            };
        }
    });

    return {
        records: enrichedRecords,
        stats: {
            totalLentGiven: Math.round(totalLentGiven * 100) / 100,
            pendingPrincipal: Math.round(pendingPrincipal * 100) / 100,
            pendingTotalDue: Math.round(pendingTotalDue * 100) / 100,
            returnedTotal: Math.round(returnedTotal * 100) / 100,
            interestEarned: Math.round(interestEarned * 100) / 100
        }
    };
}

// 10. Delete Lent Record
export async function deleteLentRecord(lentId: number, userId?: string) {
    if (userId) {
        await db.prepare('DELETE FROM lent_records WHERE id = ? AND user_id = ?').run(lentId, userId);
    } else {
        await db.prepare('DELETE FROM lent_records WHERE id = ?').run(lentId);
    }
    return { success: true };
}

// 11. Settle Lent by Person Name (for AI Agent)
export async function settleMoneyLentByPerson(userId: string, personName: string): Promise<string> {
    const record = await db.prepare("SELECT * FROM lent_records WHERE user_id = ? AND LOWER(person_name) LIKE ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(userId, `%${personName.toLowerCase().trim()}%`) as LentRecord | undefined;
    if (!record) {
        return `No pending lent record found for "${personName}".`;
    }
    const res = await toggleLentStatus(record.id, userId);
    const updated = res.record;
    return `Success: Marked loan of $${record.amount} (Accrued Interest: $${updated.interest_amount}, Total repayment: $${updated.total_due}) from "${record.person_name}" as repaid. Capital and interest have been credited back to your balance.`;
}

// 12. Get Lent Summary for AI Agent
export async function getLentSummary(userId: string): Promise<string> {
    const { records, stats } = await getLentRecords(userId);
    if (!records || records.length === 0) {
        return 'No loan records found in portfolio.';
    }
    const pendingList = records.filter(r => r.status === 'pending');

    let summary = `Total Capital Lent: $${stats.totalLentGiven} | Active Pending Repayments: $${stats.pendingTotalDue} | Settled: $${stats.returnedTotal} (Interest Profit: $${stats.interestEarned})\n\n`;
    if (pendingList.length > 0) {
        summary += 'Active Pending Loans:\n' + pendingList.map(r =>
            `- ${r.person_name}: Principal $${r.amount} | Days Active: ${r.days_elapsed} days | Accrued Interest: $${r.interest_amount} | Total Repayment Due: $${r.total_due}`
        ).join('\n');
    } else {
        summary += 'All issued loans have been settled! No pending repayments.';
    }
    return summary;
}

// 5. Dashboard Data (Live Overview + Monthly Waste & Leakage Analysis + Salary + Lent Sync)
export async function getDashboardData(userId: string) {
    // 30 days window for current month analytics
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    // FAST PARALLEL QUERIES: Run all database queries concurrently in single roundtrip
    const [totalRow, expensesList, userRow, monthTotalRow, catRows, lentStatsRow] = await Promise.all([
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ?').get(userId) as Promise<{ total: number | null }>,
        db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC LIMIT 10').all(userId) as Promise<Expense[]>,
        db.prepare('SELECT monthly_salary FROM users WHERE id = ? OR email = ?').get(userId, userId).catch(() => null) as Promise<{ monthly_salary: number | null } | undefined>,
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= ?').get(userId, monthAgo) as Promise<{ total: number | null }>,
        db.prepare(`
            SELECT category, SUM(amount) as total, COUNT(*) as count 
            FROM expenses 
            WHERE user_id = ? AND date >= ?
            GROUP BY category 
            ORDER BY total DESC
        `).all(userId, monthAgo).catch(() => []) as Promise<{ category: string; total: number; count: number }[]>,
        db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_lent,
                COALESCE(SUM(CASE WHEN status = 'returned' THEN interest_amount ELSE 0 END), 0) as returned_interest
            FROM lent_records
            WHERE user_id = ?
        `).get(userId).catch(() => ({ pending_lent: 0, returned_interest: 0 })) as Promise<{ pending_lent: number; returned_interest: number }>
    ]);

    let monthlySalary = 0;
    if (userRow?.monthly_salary) {
        monthlySalary = Number(userRow.monthly_salary);
    }

    const monthTotal = monthTotalRow?.total || 0;
    const pendingLent = Number(lentStatsRow?.pending_lent) || 0;
    const returnedInterest = Number(lentStatsRow?.returned_interest) || 0;

    // Remaining Balance = Monthly Salary - Monthly Expenses - Pending Lent (out of pocket) + Recovered Vyaj
    const remainingBalance = monthlySalary > 0 
        ? Math.max(0, monthlySalary - monthTotal - pendingLent + returnedInterest) 
        : 0;
    const savingsRate = monthlySalary > 0 ? Math.max(0, Math.round((remainingBalance / monthlySalary) * 100)) : 0;

    const categoriesWithPct = catRows.map(c => ({
        category: c.category,
        total: c.total,
        percentage: monthTotal > 0 ? Math.round((c.total / monthTotal) * 100) : 0,
        count: c.count
    }));

    const topCategory = categoriesWithPct[0] || null;

    // Discretionary vs Essentials (Needs vs Wants)
    const essentialNames = ['food', 'groceries', 'bills', 'utilities', 'health', 'fitness', 'rent', 'medicine', 'education'];
    const nonEssentialExclusions = ['dining', 'takeout', 'restaurant', 'fast food', 'cafe', 'coffee'];
    let essentialTotal = 0;
    let discretionaryTotal = 0;

    for (const c of categoriesWithPct) {
        const catLower = c.category.toLowerCase();
        const isExcluded = nonEssentialExclusions.some(ex => catLower.includes(ex));
        const isEssential = !isExcluded && essentialNames.some(name => catLower.includes(name));
        if (isEssential) {
            essentialTotal += c.total;
        } else {
            discretionaryTotal += c.total;
        }
    }

    const discretionaryPct = monthTotal > 0 ? Math.round((discretionaryTotal / monthTotal) * 100) : 0;
    const essentialPct = monthTotal > 0 ? Math.round((essentialTotal / monthTotal) * 100) : 0;

    // Waste / Overspending alert & Smart Control Advice
    let alertLevel: 'safe' | 'warning' | 'critical' = 'safe';
    let advice = 'Your spending is currently well-balanced. Keep maintaining your budget discipline!';
    let wasteCategory = null;

    if (monthTotal === 0) {
        advice = 'No expenses logged this month yet. Start logging expenses to see real-time leakage detection.';
    } else if (topCategory && topCategory.percentage >= 40 && !essentialNames.some(n => topCategory.category.toLowerCase().includes(n))) {
        alertLevel = 'critical';
        wasteCategory = topCategory.category;
        advice = `Critical Waste Alert: You spent ${topCategory.percentage}% of your monthly money on "${topCategory.category}". Consider setting a strict weekly cap here to save money immediately!`;
    } else if (discretionaryPct > 45) {
        alertLevel = 'warning';
        wasteCategory = topCategory ? topCategory.category : 'Discretionary';
        advice = `Discretionary Spending Alert: Non-essential expenses make up ${discretionaryPct}% of your budget. Cut down on ${topCategory?.category || 'shopping/dining'} to avoid budget leakage!`;
    } else if (topCategory) {
        advice = `Your highest spending category is "${topCategory.category}" (${topCategory.percentage}% of month). Review non-essential purchases in this area to optimize savings.`;
    }

    return {
        total: totalRow?.total || 0,
        monthTotal,
        monthlySalary,
        remainingBalance,
        savingsRate,
        pendingLent,
        returnedInterest,
        expenses: expensesList,
        analytics: {
            topCategory,
            categories: categoriesWithPct,
            discretionaryTotal,
            discretionaryPct,
            essentialTotal,
            essentialPct,
            alertLevel,
            advice,
            wasteCategory
        }
    };
}

// 6. Statistics Analytics (Weekly, Monthly, Yearly Circular Ratios & Categories)
export async function getStatisticsData(userId: string) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]!;
    
    // 7 days ago
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    // 30 days ago
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
    // Year start
    const yearStart = `${now.getFullYear()}-01-01`;

    // FAST PARALLEL QUERIES: Run all 5 stats queries simultaneously in single roundtrip
    const [weekRow, monthRow, yearRow, allRow, catRows] = await Promise.all([
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= ?').get(userId, weekAgo) as Promise<{ total: number | null }>,
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= ?').get(userId, monthAgo) as Promise<{ total: number | null }>,
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= ?').get(userId, yearStart) as Promise<{ total: number | null }>,
        db.prepare('SELECT SUM(amount) as total FROM expenses WHERE user_id = ?').get(userId) as Promise<{ total: number | null }>,
        db.prepare(`
            SELECT category, SUM(amount) as total, COUNT(*) as count 
            FROM expenses 
            WHERE user_id = ? 
            GROUP BY category 
            ORDER BY total DESC
        `).all(userId).catch(() => []) as Promise<{ category: string; total: number; count: number }[]>
    ]);

    const weekTotal = weekRow?.total || 0;
    const monthTotal = monthRow?.total || 0;
    const yearTotal = yearRow?.total || 0;
    const allTotal = allRow?.total || 1; // avoid / 0

    // Ratios (percentage of all-time or monthly budget benchmark e.g. $1000)
    const benchmarkMonth = 1500;
    const benchmarkWeek = 400;
    const benchmarkYear = 15000;

    const weekPercent = Math.min(100, Math.round((weekTotal / benchmarkWeek) * 100));
    const monthPercent = Math.min(100, Math.round((monthTotal / benchmarkMonth) * 100));
    const yearPercent = Math.min(100, Math.round((yearTotal / benchmarkYear) * 100));

    // Category Distribution
    const categories = catRows || [];

    return {
        week: { total: weekTotal, percent: weekPercent, benchmark: benchmarkWeek },
        month: { total: monthTotal, percent: monthPercent, benchmark: benchmarkMonth },
        year: { total: yearTotal, percent: yearPercent, benchmark: benchmarkYear },
        categories: categories.map(c => ({
            category: c.category,
            total: c.total,
            percentage: Math.round((c.total / allTotal) * 100)
        }))
    };
}

// Gemini Tool Declarations
export const toolsDeclaration = [
    {
        functionDeclarations: [
            {
                name: 'addExpense',
                description: 'Record a new money expense with title, amount, and optional category (e.g. Food, Travel, Shopping, Bills)',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: 'Item name or description of purchase' },
                        amount: { type: Type.NUMBER, description: 'Amount spent' },
                        category: { type: Type.STRING, description: 'Category like Food, Travel, Bills, Shopping, Tech' }
                    },
                    required: ['title', 'amount']
                }
            },
            {
                name: 'getExpenseSummary',
                description: 'Get total expense and breakdown of all expenses for the user',
                parameters: { type: Type.OBJECT, properties: {} }
            },
            {
                name: 'addTask',
                description: 'Add a new task or to-do reminder',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: 'Task description' }
                    },
                    required: ['title']
                }
            },
            {
                name: 'setMonthlySalary',
                description: 'Set or update the user monthly income or salary',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        salary: { type: Type.NUMBER, description: 'Monthly income or salary amount' }
                    },
                    required: ['salary']
                }
            },
            {
                name: 'getPendingTasks',
                description: 'Get all pending tasks from the to-do list',
                parameters: { type: Type.OBJECT, properties: {} }
            },
            {
                name: 'recordMoneyLent',
                description: 'Record capital lent to an individual or contact, with optional daily or monthly interest accrual models',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        person_name: { type: Type.STRING, description: 'Name of the contact or friend who received the loan' },
                        amount: { type: Type.NUMBER, description: 'Initial principal amount of money borrowed' },
                        interest_type: { type: Type.STRING, description: '"none" (0%), "daily_percent" (% per day), "monthly_percent" (% per month pro-rata), "daily_flat" (fixed amount/day), or "flat" (one-off fee)' },
                        interest_rate: { type: Type.NUMBER, description: 'Interest rate value (e.g. 1 for 1% daily, 2 for 2% monthly, or 50 for flat amount)' },
                        notes: { type: Type.STRING, description: 'Optional purpose or reference note' },
                        date_lent: { type: Type.STRING, description: 'Optional date the money was lent in YYYY-MM-DD format (defaults to today)' }
                    },
                    required: ['person_name', 'amount']
                }
            },
            {
                name: 'settleMoneyLent',
                description: 'Mark an issued loan as repaid when a borrower returns the money',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        person_name: { type: Type.STRING, description: 'Name of the borrower who returned the funds' }
                    },
                    required: ['person_name']
                }
            },
            {
                name: 'getLentSummary',
                description: 'Get summary of all money lent, active pending repayments with daily accrued interest, and settled returns',
                parameters: { type: Type.OBJECT, properties: {} }
            }
        ]
    }
];

// Tool Executor
export async function executeTool(name: string, args: any, currentUserId: string = 'guest'): Promise<string> {
    if (name === 'addExpense') {
        return await addExpense(currentUserId, args.title, Number(args.amount), args.category || 'General');
    } else if (name === 'getExpenseSummary') {
        return await getExpenseSummary(currentUserId);
    } else if (name === 'setMonthlySalary') {
        return await setMonthlySalary(currentUserId, Number(args.salary));
    } else if (name === 'addTask') {
        return await addTask(currentUserId, args.title);
    } else if (name === 'getPendingTasks') {
        return await getPendingTasks(currentUserId);
    } else if (name === 'recordMoneyLent') {
        const res = await addLentRecord(
            currentUserId,
            args.person_name,
            Number(args.amount),
            args.interest_type || 'none',
            Number(args.interest_rate || 0),
            args.notes || '',
            args.date_lent
        );
        return res.message;
    } else if (name === 'settleMoneyLent') {
        return await settleMoneyLentByPerson(currentUserId, args.person_name);
    } else if (name === 'getLentSummary') {
        return await getLentSummary(currentUserId);
    }
    return `Error: Tool ${name} not found.`;
}
