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

// 5. Dashboard Data (Live Overview + Monthly Waste & Leakage Analysis + Salary)
export async function getDashboardData(userId: string) {
    // 30 days window for current month analytics
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    // FAST PARALLEL QUERIES: Run all 5 database queries concurrently in single roundtrip
    const [totalRow, expensesList, userRow, monthTotalRow, catRows] = await Promise.all([
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
        `).all(userId, monthAgo).catch(() => []) as Promise<{ category: string; total: number; count: number }[]>
    ]);

    let monthlySalary = 0;
    if (userRow?.monthly_salary) {
        monthlySalary = Number(userRow.monthly_salary);
    }

    const monthTotal = monthTotalRow?.total || 0;
    const remainingBalance = monthlySalary > 0 ? monthlySalary - monthTotal : 0;
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
    }
    return `Error: Tool ${name} not found.`;
}
