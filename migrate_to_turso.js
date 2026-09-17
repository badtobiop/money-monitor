import { createClient } from '@libsql/client';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
dotenv.config();

const localDb = new Database('agent_data.db');
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
  console.log('Migrating data from local agent_data.db to Turso...');

  // 1. Users
  const users = localDb.prepare('SELECT * FROM users').all();
  for (const u of users) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO users (id, email, name, password, monthly_salary, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      args: [u.id, u.email, u.name, u.password, u.monthly_salary || 0, u.created_at]
    });
  }
  console.log(`Migrated ${users.length} users.`);

  // 2. Expenses
  const expenses = localDb.prepare('SELECT * FROM expenses').all();
  for (const e of expenses) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO expenses (id, user_id, title, amount, category, date) VALUES (?, ?, ?, ?, ?, ?)',
      args: [e.id, e.user_id, e.title, e.amount, e.category, e.date]
    });
  }
  console.log(`Migrated ${expenses.length} expenses.`);

  // 3. Tasks
  const tasks = localDb.prepare('SELECT * FROM tasks').all();
  for (const t of tasks) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO tasks (id, user_id, title, status, date) VALUES (?, ?, ?, ?, ?)',
      args: [t.id, t.user_id, t.title, t.status, t.date]
    });
  }
  console.log(`Migrated ${tasks.length} tasks.`);

  // 4. Support tickets
  const tickets = localDb.prepare('SELECT * FROM support_tickets').all();
  for (const s of tickets) {
    await turso.execute({
      sql: 'INSERT OR IGNORE INTO support_tickets (id, user_id, user_name, user_email, category, priority, subject, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [s.id, s.user_id, s.user_name, s.user_email, s.category, s.priority, s.subject, s.message, s.status, s.created_at]
    });
  }
  console.log(`Migrated ${tickets.length} support tickets.`);

  console.log('🎉 Migration to Turso Cloud completed successfully!');
}

migrate().catch(console.error);
