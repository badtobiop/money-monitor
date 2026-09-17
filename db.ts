// db.ts: Database Connection with Turso Cloud SQLite (LibSQL)
import { createClient, Client } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

const url = (process.env.TURSO_DATABASE_URL || 'libsql://aura-badtobiop.aws-ap-south-1.turso.io').trim();
const authToken = (process.env.TURSO_AUTH_TOKEN || '').trim();

export const client: Client = createClient({
    url,
    authToken
});

// Universal DB adapter that provides async prepare().get(), .all(), .run()
export const db = {
    client,
    prepare(sql: string) {
        return {
            async get(...args: any[]) {
                const res = await client.execute({ sql, args: args.flat() });
                return res.rows[0] as any;
            },
            async all(...args: any[]) {
                const res = await client.execute({ sql, args: args.flat() });
                return res.rows as any[];
            },
            async run(...args: any[]) {
                const res = await client.execute({ sql, args: args.flat() });
                return {
                    lastInsertRowid: res.lastInsertRowid ? Number(res.lastInsertRowid) : 0,
                    changes: res.rowsAffected
                };
            }
        };
    },
    async execute(sql: string, args: any[] = []) {
        return await client.execute({ sql, args });
    }
};

export default db;
