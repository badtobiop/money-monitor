// db.ts: Database Connection aur Tables ka Setup
import Database, { Database as DBInstance } from 'better-sqlite3';

// 1. Database file create karo (Hard disk me 'agent_data.db' banegi)
const db: DBInstance = new Database('agent_data.db');

// WAL Mode (Write-Ahead Logging): Database ko super-fast aur crash-safe banata hai
db.pragma('journal_mode = WAL');

// 2. Users Table (Authentication ke liye)
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        monthly_salary REAL DEFAULT 0,
        created_at TEXT NOT NULL
    );
`);

// Migration if table already existed without monthly_salary
try {
    db.exec(`ALTER TABLE users ADD COLUMN monthly_salary REAL DEFAULT 0;`);
} catch (e) {
    // Already added
}

// 3. Expenses Table (Jisme har bande ki 'user_id' hogi)
db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL
    );
`);

// 4. Tasks Table (Jisme har bande ki 'user_id' hogi)
db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        date TEXT NOT NULL
    );
`);

// 5. Password Resets Table (Secure Tokenized Email Link Verification)
db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );
`);

// 6. Support Tickets Table (Help Center messages dispatched to Admin Gmail)
db.exec(`
    CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        user_name TEXT NOT NULL,
        user_email TEXT NOT NULL,
        category TEXT DEFAULT 'General Inquiry',
        priority TEXT DEFAULT 'Normal',
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL
    );
`);

export default db;
