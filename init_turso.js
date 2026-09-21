import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || ''
});

async function main() {
  console.log('Connecting to Turso...');

  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      monthly_salary REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      date TEXT NOT NULL
    );
  `);

  await client.execute(`
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

  await client.execute(`
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

  await client.execute(`
    CREATE TABLE IF NOT EXISTS lent_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      purpose TEXT,
      interest_type TEXT DEFAULT 'none',
      interest_rate REAL DEFAULT 0,
      interest_amount REAL DEFAULT 0,
      total_due REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      date_lent TEXT NOT NULL,
      date_returned TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  try {
    await client.execute('ALTER TABLE lent_records ADD COLUMN purpose TEXT;');
  } catch (e) {
    // Column already exists
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS borrowed_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      lender_name TEXT NOT NULL,
      amount REAL NOT NULL,
      purpose TEXT,
      interest_type TEXT DEFAULT 'none',
      interest_rate REAL DEFAULT 0,
      interest_amount REAL DEFAULT 0,
      total_due REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      date_borrowed TEXT NOT NULL,
      date_repaid TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS monthly_budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      month TEXT NOT NULL,
      gross_income REAL DEFAULT 0,
      expense_budget REAL DEFAULT 0,
      lent_budget REAL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, month)
    );
  `);

  console.log('✅ All tables (including monthly_budgets) initialized in Turso Cloud SQLite successfully!');

  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables in Turso:', tables.rows.map(r => r.name));
}

main().catch(console.error);
