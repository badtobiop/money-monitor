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
    purpose?: string | null;
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

export interface BorrowedRecord {
    id: number;
    user_id: string;
    lender_name: string;
    amount: number;
    purpose?: string | null;
    interest_type: string;
    interest_rate: number;
    interest_amount: number;
    total_due: number;
    status: 'pending' | 'repaid';
    date_borrowed: string;
    date_repaid: string | null;
    notes: string | null;
    created_at: string;
    days_elapsed?: number;
    daily_interest?: number;
    rate_label?: string;
}

export interface MonthlyBudget {
    id: number;
    user_id: string;
    month: string;
    gross_income: number;
    expense_budget: number;
    lent_budget: number;
    created_at: string;
    updated_at: string;
}

// 1. Add Expense
export async function addExpense(userId: string, title: string, amount: number, category: string = 'General', customDate?: string): Promise<string> {
    const date = (customDate && customDate.length >= 10) ? customDate.slice(0, 10) : new Date().toISOString().split('T')[0]!; // YYYY-MM-DD
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
    purpose: string = 'Personal',
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
        INSERT INTO lent_records (user_id, person_name, amount, purpose, interest_type, interest_rate, interest_amount, total_due, status, date_lent, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    const info = await stmt.run(userId, personName.trim(), numAmount, purpose.trim() || 'Personal', interestType, numRate, calc.accruedInterest, calc.totalDue, dateLent, notes.trim(), createdAt);

    const interestInfo = calc.accruedInterest > 0
        ? ` with accrued interest of $${calc.accruedInterest} (${calc.rateLabel}, Total repayment: $${calc.totalDue})`
        : (calc.dailyInterest > 0 ? ` with daily accrual of $${calc.dailyInterest}/day (Total repayment: $${calc.totalDue})` : '');

    return {
        success: true,
        message: `Success: Recorded loan of $${numAmount} to "${personName}" for "${purpose || 'Personal'}"${interestInfo}.`,
        record: {
            id: info.lastInsertRowid,
            user_id: userId,
            person_name: personName.trim(),
            amount: numAmount,
            purpose: purpose.trim() || 'Personal',
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
            `- ${r.person_name} [${r.purpose || 'Personal'}]: Principal $${r.amount} | Days Active: ${r.days_elapsed} days | Accrued Interest: $${r.interest_amount} | Total Repayment Due: $${r.total_due}`
        ).join('\n');
    } else {
        summary += 'All issued loans have been settled! No pending repayments.';
    }
    return summary;
}

// ==================== MONEY BORROWED / DEBT MANAGEMENT (UDHAR LIYA) ====================

// 13. Add Borrowed Debt Record (Udhar Liya)
export async function addBorrowedRecord(
    userId: string,
    lenderName: string,
    amount: number,
    purpose: string = 'Personal',
    interestType: string = 'none',
    interestRate: number = 0,
    notes: string = '',
    customDateBorrowed?: string
): Promise<{ success: boolean; message: string; record?: any }> {
    const numAmount = Number(amount) || 0;
    const numRate = Number(interestRate) || 0;
    const dateBorrowed = customDateBorrowed && customDateBorrowed.trim()
        ? customDateBorrowed.trim().split('T')[0]!
        : new Date().toISOString().split('T')[0]!;

    const calc = calculateLoanDaysAndInterest(numAmount, interestType, numRate, dateBorrowed, null, 'pending');
    const createdAt = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO borrowed_records (user_id, lender_name, amount, purpose, interest_type, interest_rate, interest_amount, total_due, status, date_borrowed, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
    `);
    const info = await stmt.run(userId, lenderName.trim(), numAmount, purpose.trim() || 'Personal', interestType, numRate, calc.accruedInterest, calc.totalDue, dateBorrowed, notes.trim(), createdAt);

    const interestInfo = calc.accruedInterest > 0
        ? ` with accrued interest of $${calc.accruedInterest} (${calc.rateLabel}, Total repayment due: $${calc.totalDue})`
        : (calc.dailyInterest > 0 ? ` with daily accrual of $${calc.dailyInterest}/day (Total repayment due: $${calc.totalDue})` : '');

    return {
        success: true,
        message: `Success: Recorded borrowed debt of $${numAmount} from "${lenderName}" for "${purpose || 'Personal'}"${interestInfo}.`,
        record: {
            id: info.lastInsertRowid,
            user_id: userId,
            lender_name: lenderName.trim(),
            amount: numAmount,
            purpose: purpose.trim() || 'Personal',
            interest_type: interestType,
            interest_rate: numRate,
            interest_amount: calc.accruedInterest,
            total_due: calc.totalDue,
            daily_interest: calc.dailyInterest,
            days_elapsed: calc.daysElapsed,
            rate_label: calc.rateLabel,
            status: 'pending',
            date_borrowed: dateBorrowed,
            notes: notes.trim()
        }
    };
}

// 14. Toggle Borrowed Status (Mark as Repaid / Paid Off)
export async function toggleBorrowedStatus(borrowedId: number, userId?: string) {
    let query = 'SELECT * FROM borrowed_records WHERE id = ?';
    const args: any[] = [borrowedId];
    if (userId) {
        query += ' AND user_id = ?';
        args.push(userId);
    }
    const record = await db.prepare(query).get(...args) as BorrowedRecord | undefined;
    if (!record) {
        throw new Error('Borrowed debt record not found');
    }

    const newStatus = record.status === 'pending' ? 'repaid' : 'pending';
    const dateRepaid = newStatus === 'repaid' ? new Date().toISOString().split('T')[0]! : null;

    let finalInterestAmount = record.interest_amount;
    let finalTotalDue = record.total_due;

    if (newStatus === 'repaid') {
        const calc = calculateLoanDaysAndInterest(record.amount, record.interest_type, record.interest_rate, record.date_borrowed, dateRepaid, 'returned');
        finalInterestAmount = calc.accruedInterest;
        finalTotalDue = calc.totalDue;
    }

    await db.prepare('UPDATE borrowed_records SET status = ?, date_repaid = ?, interest_amount = ?, total_due = ? WHERE id = ?')
        .run(newStatus, dateRepaid, finalInterestAmount, finalTotalDue, borrowedId);

    return {
        success: true,
        newStatus,
        dateRepaid,
        record: {
            ...record,
            status: newStatus,
            date_repaid: dateRepaid,
            interest_amount: finalInterestAmount,
            total_due: finalTotalDue
        }
    };
}

// 15. Get Borrowed Records & Stats
export async function getBorrowedRecords(userId: string) {
    const rawRecords = await db.prepare('SELECT * FROM borrowed_records WHERE user_id = ? ORDER BY id DESC').all(userId).catch(() => []) as BorrowedRecord[];

    let totalDebtIncurred = 0;
    let pendingPrincipal = 0;
    let pendingTotalDue = 0;
    let repaidTotal = 0;
    let interestIncurred = 0;

    const enrichedRecords = (rawRecords || []).map(r => {
        totalDebtIncurred += Number(r.amount) || 0;

        if (r.status === 'repaid') {
            const calc = calculateLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_borrowed, r.date_repaid, 'returned');
            repaidTotal += Number(r.total_due) || 0;
            interestIncurred += Number(r.interest_amount) || 0;
            return {
                ...r,
                days_elapsed: calc.daysElapsed,
                daily_interest: calc.dailyInterest,
                rate_label: calc.rateLabel
            };
        } else {
            const calc = calculateLoanDaysAndInterest(r.amount, r.interest_type, r.interest_rate, r.date_borrowed, null, 'pending');
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
            totalDebtIncurred: Math.round(totalDebtIncurred * 100) / 100,
            totalBorrowedPrincipal: Math.round(totalDebtIncurred * 100) / 100,
            pendingPrincipal: Math.round(pendingPrincipal * 100) / 100,
            pendingTotalDue: Math.round(pendingTotalDue * 100) / 100,
            repaidTotal: Math.round(repaidTotal * 100) / 100,
            interestIncurred: Math.round(interestIncurred * 100) / 100
        }
    };
}

// 16. Delete Borrowed Record
export async function deleteBorrowedRecord(borrowedId: number, userId?: string) {
    if (userId) {
        await db.prepare('DELETE FROM borrowed_records WHERE id = ? AND user_id = ?').run(borrowedId, userId);
    } else {
        await db.prepare('DELETE FROM borrowed_records WHERE id = ?').run(borrowedId);
    }
    return { success: true };
}

// 17. Settle Borrowed by Lender Name (for AI Agent)
export async function settleMoneyBorrowedByLender(userId: string, lenderName: string): Promise<string> {
    const record = await db.prepare("SELECT * FROM borrowed_records WHERE user_id = ? AND LOWER(lender_name) LIKE ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(userId, `%${lenderName.toLowerCase().trim()}%`) as BorrowedRecord | undefined;
    if (!record) {
        return `No pending debt record found for lender "${lenderName}".`;
    }
    const res = await toggleBorrowedStatus(record.id, userId);
    const updated = res.record;
    return `Success: Paid back debt of $${record.amount} (Accrued Interest: $${updated.interest_amount}, Total repaid: $${updated.total_due}) to lender "${record.lender_name}". Debt has been cleared and marked as repaid.`;
}

// 18. Get Borrowed Summary for AI Agent
export async function getBorrowedSummary(userId: string): Promise<string> {
    const { records, stats } = await getBorrowedRecords(userId);
    if (!records || records.length === 0) {
        return 'You have no recorded borrowed debts.';
    }
    const pendingList = records.filter(r => r.status === 'pending');

    let summary = `Total Debt Incurred: $${stats.totalDebtIncurred} | Active Debts Due: $${stats.pendingTotalDue} | Settled/Paid Off: $${stats.repaidTotal} (Interest Incurred: $${stats.interestIncurred})\n\n`;
    if (pendingList.length > 0) {
        summary += 'Active Pending Debts:\n' + pendingList.map(r =>
            `- ${r.lender_name} [${r.purpose || 'Personal'}]: Principal $${r.amount} | Days: ${r.days_elapsed}d | Accrued Interest: $${r.interest_amount} | Total Due to Pay: $${r.total_due}`
        ).join('\n');
    } else {
        summary += 'All borrowed debts have been settled and paid off! No outstanding liabilities.';
    }
    return summary;
}

// ==================== 19. THREE-ENVELOPE CAPITAL ALLOCATION SYSTEM ====================

// Get monthly budget envelope status for a user
export async function getMonthlyBudgetData(userId: string, targetMonth?: string) {
    const month = targetMonth || new Date().toISOString().slice(0, 7); // 'YYYY-MM'

    // Fetch monthly budget record for this specific month
    const budgetRecord = await db.prepare('SELECT * FROM monthly_budgets WHERE user_id = ? AND month = ?').get(userId, month) as MonthlyBudget | undefined;

    // Do NOT automatically carry over or fix a salary for new months!
    // Every month requires explicit manual salary entry by the user ("har month salary add krni hi padegi khudke maan se")
    const grossIncome = budgetRecord ? (Number(budgetRecord.gross_income) || 0) : 0;
    const expenseBudget = budgetRecord ? (Number(budgetRecord.expense_budget) || 0) : 0;
    const lentBudget = budgetRecord ? (Number(budgetRecord.lent_budget) || 0) : 0;

    // Query expenses for this month
    const expenseRow = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total_spent, COUNT(*) as count FROM expenses WHERE user_id = ? AND date LIKE ?').get(userId, `${month}%`) as { total_spent: number; count: number };
    const totalSpent = Number(expenseRow?.total_spent) || 0;
    const expenseRemaining = Math.max(0, Math.round((expenseBudget - totalSpent) * 100) / 100);
    const expenseOverspent = totalSpent > expenseBudget ? Math.round((totalSpent - expenseBudget) * 100) / 100 : 0;
    const expensePct = expenseBudget > 0 ? Math.min(100, Math.round((totalSpent / expenseBudget) * 100)) : 0;

    // Query loans issued for this month
    const lentRow = await db.prepare(`
        SELECT 
            COALESCE(SUM(amount), 0) as total_lent,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as active_lent,
            COALESCE(SUM(CASE WHEN status = 'returned' THEN amount ELSE 0 END), 0) as returned_lent,
            COALESCE(SUM(CASE WHEN status = 'returned' THEN interest_amount ELSE 0 END), 0) as interest_earned
        FROM lent_records 
        WHERE user_id = ? AND date_lent LIKE ?
    `).get(userId, `${month}%`) as { total_lent: number; active_lent: number; returned_lent: number; interest_earned: number };

    const totalLentIssued = Number(lentRow?.total_lent) || 0;
    const activeLent = Number(lentRow?.active_lent) || 0;
    const returnedLent = Number(lentRow?.returned_lent) || 0;
    const interestEarned = Number(lentRow?.interest_earned) || 0;

    // Calculate previous month string (e.g. 2026-09 -> 2026-08)
    const [yearStr, monthStr] = month.split('-');
    let prevYear = parseInt(yearStr || '2026', 10);
    let prevMonthNum = parseInt(monthStr || '01', 10) - 1;
    if (prevMonthNum === 0) {
        prevMonthNum = 12;
        prevYear -= 1;
    }
    const prevMonth = `${prevYear}-${String(prevMonthNum).padStart(2, '0')}`;

    // Automatic Rollover of Unspent Savings from Previous Month:
    // (e.g. In previous month: Salary 5000 - Spent 2000 = 3000 unspent automatically rolls over into the new month!)
    let rolloverSavings = 0;
    const prevBudget = await db.prepare('SELECT gross_income FROM monthly_budgets WHERE user_id = ? AND month = ?').get(userId, prevMonth).catch(() => null) as { gross_income: number } | undefined;
    if (prevBudget && Number(prevBudget.gross_income) > 0) {
        const prevSpentRow = await db.prepare('SELECT COALESCE(SUM(amount), 0) as total_spent FROM expenses WHERE user_id = ? AND date LIKE ?').get(userId, `${prevMonth}%`).catch(() => null) as { total_spent: number } | undefined;
        const prevLentRow = await db.prepare("SELECT COALESCE(SUM(amount), 0) as active_lent FROM lent_records WHERE user_id = ? AND date_lent LIKE ? AND status = 'pending'").get(userId, `${prevMonth}%`).catch(() => null) as { active_lent: number } | undefined;
        const prevGross = Number(prevBudget.gross_income) || 0;
        const prevSpent = Number(prevSpentRow?.total_spent) || 0;
        const prevActiveLent = Number(prevLentRow?.active_lent) || 0;
        rolloverSavings = Math.max(0, Math.round((prevGross - prevSpent - prevActiveLent) * 100) / 100);
    }

    // Total Available Capital = Current Month Gross Income + Rollover from Previous Month
    const totalAvailableCapital = Math.round((grossIncome + rolloverSavings) * 100) / 100;

    // Remaining Lending Capacity = Lending Budget - Active Lent Principal
    const lentRemainingCapacity = Math.max(0, Math.round((lentBudget - activeLent) * 100) / 100);
    const lentOvercommitted = activeLent > lentBudget ? Math.round((activeLent - lentBudget) * 100) / 100 : 0;
    const lentPct = lentBudget > 0 ? Math.min(100, Math.round((activeLent / lentBudget) * 100)) : 0;

    // Unallocated Free Cash / Master Reserve = Total Capital - Expense Budget - Lending Budget
    const unallocatedReserve = Math.max(0, Math.round((totalAvailableCapital - expenseBudget - lentBudget) * 100) / 100);

    // Real-Time Live Available Salary Balance = (Gross Income + Rollover) - Actual Expenses Spent - Actual Active Principal Lent
    // (Unspent envelope money stays safely in the user's available balance!)
    const liveAvailableSalary = Math.max(0, Math.round((totalAvailableCapital - totalSpent - activeLent) * 100) / 100);
    const totalDeductions = Math.round((totalSpent + activeLent) * 100) / 100;
    const totalRetainedLiquid = liveAvailableSalary;

    return {
        month,
        grossIncome,
        rolloverSavings,
        totalAvailableCapital,
        liveAvailableSalary,
        totalDeductions,
        unallocatedReserve,
        totalRetainedLiquid,
        expenseEnvelope: {
            budget: expenseBudget,
            spent: totalSpent,
            remaining: expenseRemaining,
            overspent: expenseOverspent,
            percentage: expensePct,
            count: expenseRow?.count || 0
        },
        lendingEnvelope: {
            fundBudget: lentBudget,
            totalIssued: totalLentIssued,
            activeLent,
            returnedLent,
            interestEarned,
            remainingCapacity: lentRemainingCapacity,
            overcommitted: lentOvercommitted,
            percentage: lentPct
        }
    };
}

// Update monthly budget allocations for a user
export async function setMonthlyBudgetAllocations(
    userId: string,
    month: string,
    grossIncome: number,
    expenseBudget: number,
    lentBudget: number
) {
    const numGross = Math.max(0, Number(grossIncome) || 0);
    const numExp = Math.max(0, Number(expenseBudget) || 0);
    const numLent = Math.max(0, Number(lentBudget) || 0);
    const nowIso = new Date().toISOString();

    const existing = await db.prepare('SELECT id FROM monthly_budgets WHERE user_id = ? AND month = ?').get(userId, month) as { id: number } | undefined;

    if (existing) {
        await db.prepare(`
            UPDATE monthly_budgets 
            SET gross_income = ?, expense_budget = ?, lent_budget = ?, updated_at = ?
            WHERE user_id = ? AND month = ?
        `).run(numGross, numExp, numLent, nowIso, userId, month);
    } else {
        await db.prepare(`
            INSERT INTO monthly_budgets (user_id, month, gross_income, expense_budget, lent_budget, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(userId, month, numGross, numExp, numLent, nowIso, nowIso);
    }

    // Also sync users.monthly_salary
    await db.prepare('UPDATE users SET monthly_salary = ? WHERE id = ? OR email = ?').run(numGross, userId, userId);

    return await getMonthlyBudgetData(userId, month);
}

// 20. Calendar & Monthly Historical Archive
export async function getCalendarMonthData(userId: string, month: string) {
    const budgetStats = await getMonthlyBudgetData(userId, month);

    const expenses = await db.prepare(`
        SELECT id, title, amount, category, date 
        FROM expenses 
        WHERE user_id = ? AND date LIKE ?
        ORDER BY date ASC, id ASC
    `).all(userId, `${month}%`) as Expense[];

    const lentRecords = await db.prepare(`
        SELECT id, person_name, amount, purpose, interest_type, interest_rate, interest_amount, total_due, status, date_lent, date_returned, notes
        FROM lent_records
        WHERE user_id = ? AND date_lent LIKE ?
        ORDER BY date_lent ASC, id ASC
    `).all(userId, `${month}%`) as LentRecord[];

    const borrowedRecords = await db.prepare(`
        SELECT id, lender_name, amount, purpose, interest_type, interest_rate, interest_amount, total_due, status, date_borrowed, date_repaid, notes
        FROM borrowed_records
        WHERE user_id = ? AND date_borrowed LIKE ?
        ORDER BY date_borrowed ASC, id ASC
    `).all(userId, `${month}%`) as BorrowedRecord[];

    const daysMap: Record<string, {
        date: string;
        dayNum: number;
        expenses: Expense[];
        lent: LentRecord[];
        borrowed: BorrowedRecord[];
        totalExpense: number;
        totalLent: number;
        totalBorrowed: number;
    }> = {};

    expenses.forEach(e => {
        const d = e.date ? e.date.split('T')[0]! : '';
        if (!d) return;
        if (!daysMap[d]) {
            const dayNum = parseInt(d.split('-')[2] || '1', 10);
            daysMap[d] = { date: d, dayNum, expenses: [], lent: [], borrowed: [], totalExpense: 0, totalLent: 0, totalBorrowed: 0 };
        }
        daysMap[d].expenses.push(e);
        daysMap[d].totalExpense += Number(e.amount) || 0;
    });

    lentRecords.forEach(l => {
        const d = l.date_lent ? l.date_lent.split('T')[0]! : '';
        if (!d) return;
        if (!daysMap[d]) {
            const dayNum = parseInt(d.split('-')[2] || '1', 10);
            daysMap[d] = { date: d, dayNum, expenses: [], lent: [], borrowed: [], totalExpense: 0, totalLent: 0, totalBorrowed: 0 };
        }
        daysMap[d].lent.push(l);
        daysMap[d].totalLent += Number(l.amount) || 0;
    });

    borrowedRecords.forEach(b => {
        const d = b.date_borrowed ? b.date_borrowed.split('T')[0]! : '';
        if (!d) return;
        if (!daysMap[d]) {
            const dayNum = parseInt(d.split('-')[2] || '1', 10);
            daysMap[d] = { date: d, dayNum, expenses: [], lent: [], borrowed: [], totalExpense: 0, totalLent: 0, totalBorrowed: 0 };
        }
        daysMap[d].borrowed.push(b);
        daysMap[d].totalBorrowed += Number(b.amount) || 0;
    });

    const totalExpense = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const totalLent = lentRecords.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const totalBorrowed = borrowedRecords.reduce((s, b) => s + (Number(b.amount) || 0), 0);

    return {
        month,
        budgetStats,
        totals: {
            totalExpense,
            totalLent,
            totalBorrowed
        },
        days: daysMap,
        raw: {
            expenses,
            lentRecords,
            borrowedRecords
        }
    };
}

// 21. AI Agent Envelope Summary
export async function getMonthlyEnvelopeSummary(userId: string, targetMonth?: string): Promise<string> {
    const data = await getMonthlyBudgetData(userId, targetMonth);
    const exp = data.expenseEnvelope;
    const lent = data.lendingEnvelope;

    return `Month: ${data.month} | Gross Income: $${data.grossIncome}\n` +
           `- Living Expenses Envelope: Budget $${exp.budget} | Spent: $${exp.spent} (${exp.percentage}%) | Remaining Allowance: $${exp.remaining}\n` +
           `- Lending Fund Envelope: Fund $${lent.fundBudget} | Active Lent: $${lent.activeLent} (${lent.percentage}%) | Remaining Lending Capacity: $${lent.remainingCapacity} (Returned: $${lent.returnedLent}, Profit: +$${lent.interestEarned})\n` +
           `- Unallocated Free Cash: $${data.unallocatedReserve} | Total Retained Liquid: $${data.totalRetainedLiquid}`;
}

// 5. Dashboard Data (Live Overview + Monthly Waste & Leakage Analysis + Multi-Pool Balance Separation)
export async function getDashboardData(userId: string) {
    // 30 days window for current month analytics
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    // FAST PARALLEL QUERIES: Run all database queries concurrently in single roundtrip
    const [totalRow, expensesList, userRow, monthTotalRow, catRows, lentStatsRow, borrowedStatsRow] = await Promise.all([
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
                COALESCE(SUM(CASE WHEN status = 'pending' THEN total_due ELSE 0 END), 0) as pending_lent_total_due,
                COALESCE(SUM(CASE WHEN status = 'returned' THEN interest_amount ELSE 0 END), 0) as returned_interest
            FROM lent_records
            WHERE user_id = ?
        `).get(userId).catch(() => ({ pending_lent: 0, pending_lent_total_due: 0, returned_interest: 0 })) as Promise<{ pending_lent: number; pending_lent_total_due: number; returned_interest: number }>,
        db.prepare(`
            SELECT 
                COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_borrowed_principal,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN total_due ELSE 0 END), 0) as pending_borrowed_total_due,
                COALESCE(SUM(CASE WHEN status = 'repaid' THEN total_due ELSE 0 END), 0) as repaid_borrowed_total
            FROM borrowed_records
            WHERE user_id = ?
        `).get(userId).catch(() => ({ pending_borrowed_principal: 0, pending_borrowed_total_due: 0, repaid_borrowed_total: 0 })) as Promise<{ pending_borrowed_principal: number; pending_borrowed_total_due: number; repaid_borrowed_total: number }>
    ]);

    let monthlySalary = 0;
    if (userRow?.monthly_salary) {
        monthlySalary = Number(userRow.monthly_salary);
    }

    const monthTotal = monthTotalRow?.total || 0;
    const pendingLent = Number(lentStatsRow?.pending_lent) || 0;
    const pendingLentTotalDue = Number(lentStatsRow?.pending_lent_total_due) || 0;
    const returnedInterest = Number(lentStatsRow?.returned_interest) || 0;
    const pendingBorrowedPrincipal = Number(borrowedStatsRow?.pending_borrowed_principal) || 0;
    const pendingBorrowedTotalDue = Number(borrowedStatsRow?.pending_borrowed_total_due) || 0;

    const currentMonthStr = now.toISOString().slice(0, 7);
    const envelopes = await getMonthlyBudgetData(userId, currentMonthStr);
    const currentMonthSalary = Number(envelopes.grossIncome) || 0;
    const rolloverSavings = envelopes.rolloverSavings || 0;
    const totalSalaryPool = Math.round((currentMonthSalary + rolloverSavings) * 100) / 100;

    // Pure Main Available Cash = (Monthly Salary + Rollover) - Living Expenses - Active Principal Lent Out
    const availableBalance = envelopes.liveAvailableSalary !== undefined 
        ? envelopes.liveAvailableSalary 
        : (totalSalaryPool > 0 ? Math.max(0, Math.round((totalSalaryPool - monthTotal - pendingLent) * 100) / 100) : 0);
    const savingsRate = totalSalaryPool > 0 ? Math.max(0, Math.round((availableBalance / totalSalaryPool) * 100)) : 0;

    // Net Financial Position = Available Cash + Capital Lent to Receive - Debt You Owe
    const netFinancialPosition = Math.round((availableBalance + pendingLentTotalDue - pendingBorrowedTotalDue) * 100) / 100;

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
        monthlySalary: currentMonthSalary,
        rolloverSavings,
        totalSalaryPool,
        remainingBalance: availableBalance, // Main available cash in hand
        availableBalance, // Pure personal cash balance (Salary - Expenses)
        savingsRate,
        pendingLent,
        pendingLentTotalDue,
        returnedInterest,
        envelopes,
        lentPortfolio: {
            pendingPrincipal: pendingLent,
            pendingTotalDue: pendingLentTotalDue,
            returnedInterest
        },
        borrowedPortfolio: {
            pendingPrincipal: pendingBorrowedPrincipal,
            pendingTotalDue: pendingBorrowedTotalDue
        },
        netFinancialPosition,
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
                description: 'Record capital lent to an individual or contact, with loan purpose and optional daily or monthly interest accrual models',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        person_name: { type: Type.STRING, description: 'Name of the contact or friend who received the loan' },
                        amount: { type: Type.NUMBER, description: 'Initial principal amount of money lent' },
                        purpose: { type: Type.STRING, description: 'Purpose or reason for the loan (e.g. Business, Medical Emergency, Education, Travel, Personal)' },
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
            },
            {
                name: 'recordMoneyBorrowed',
                description: 'Record money borrowed from an individual, bank, or lender (debt you owe), with purpose and optional interest model',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        lender_name: { type: Type.STRING, description: 'Name of the lender, friend, or institution who gave you the money' },
                        amount: { type: Type.NUMBER, description: 'Principal amount of money borrowed' },
                        purpose: { type: Type.STRING, description: 'Purpose or reason for borrowing (e.g. Medical Emergency, Business, Education, House Rent, Personal)' },
                        interest_type: { type: Type.STRING, description: '"none" (0%), "daily_percent" (% per day), "monthly_percent" (% per month pro-rata), "daily_flat" (fixed amount/day), or "flat" (one-off fee)' },
                        interest_rate: { type: Type.NUMBER, description: 'Interest rate or fee value' },
                        notes: { type: Type.STRING, description: 'Optional reference note' },
                        date_borrowed: { type: Type.STRING, description: 'Optional date the money was borrowed in YYYY-MM-DD format (defaults to today)' }
                    },
                    required: ['lender_name', 'amount']
                }
            },
            {
                name: 'settleMoneyBorrowed',
                description: 'Mark a borrowed debt as paid back / settled when you repay the lender',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        lender_name: { type: Type.STRING, description: 'Name of the lender you repaid' }
                    },
                    required: ['lender_name']
                }
            },
            {
                name: 'getBorrowedSummary',
                description: 'Get summary of all money borrowed, active debts owed with daily accrued interest, and settled repayments',
                parameters: { type: Type.OBJECT, properties: {} }
            },
            {
                name: 'setBudgetEnvelopes',
                description: 'Set or update the monthly gross income, living expense budget envelope, and lending fund envelope allocation',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        gross_income: { type: Type.NUMBER, description: 'Master gross income or salary for the month' },
                        expense_budget: { type: Type.NUMBER, description: 'Capital allocated strictly for living expenses' },
                        lent_budget: { type: Type.NUMBER, description: 'Capital allocated strictly for lending money to others' },
                        month: { type: Type.STRING, description: 'Optional month in YYYY-MM format (defaults to current month)' }
                    },
                    required: ['gross_income', 'expense_budget', 'lent_budget']
                }
            },
            {
                name: 'getMonthlyEnvelopeSummary',
                description: 'Get the detailed three-envelope capital status (income, expenses, lending fund, remaining allowances, and unallocated reserve)',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        month: { type: Type.STRING, description: 'Optional month in YYYY-MM format (defaults to current month)' }
                    }
                }
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
            args.purpose || 'Personal',
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
    } else if (name === 'recordMoneyBorrowed') {
        const res = await addBorrowedRecord(
            currentUserId,
            args.lender_name,
            Number(args.amount),
            args.purpose || 'Personal',
            args.interest_type || 'none',
            Number(args.interest_rate || 0),
            args.notes || '',
            args.date_borrowed
        );
        return res.message;
    } else if (name === 'settleMoneyBorrowed') {
        return await settleMoneyBorrowedByLender(currentUserId, args.lender_name);
    } else if (name === 'getBorrowedSummary') {
        return await getBorrowedSummary(currentUserId);
    } else if (name === 'setBudgetEnvelopes') {
        const targetMonth = args.month || new Date().toISOString().slice(0, 7);
        const data = await setMonthlyBudgetAllocations(
            currentUserId,
            targetMonth,
            Number(args.gross_income),
            Number(args.expense_budget),
            Number(args.lent_budget)
        );
        return `Success: Updated budget envelopes for ${targetMonth}!\nGross Income: $${data.grossIncome} | Expense Budget: $${data.expenseEnvelope.budget} | Lending Fund: $${data.lendingEnvelope.fundBudget} | Unallocated Reserve: $${data.unallocatedReserve}`;
    } else if (name === 'getMonthlyEnvelopeSummary') {
        return await getMonthlyEnvelopeSummary(currentUserId, args.month);
    }
    return `Error: Tool ${name} not found.`;
}
