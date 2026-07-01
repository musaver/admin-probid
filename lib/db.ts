import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema'; // ✅ ensure this imports all table definitions


// Reuse ONE pool across hot-reloads (dev) and across a warm serverless instance (prod).
// Without this, Next.js re-evaluates this module on every HMR reload and creates a NEW
// pool each time — the old connections leak and MySQL eventually rejects with
// "Too many connections" (ER_CON_COUNT_ERROR). Stashing the pool on globalThis fixes it.
const globalForDb = globalThis as unknown as { _mysqlPool?: mysql.Pool };

const pool =
  globalForDb._mysqlPool ??
  mysql.createPool({
    host: process.env.DB_HOST!,
    user: process.env.DB_USER!,
    password: process.env.DB_PASS!,
    database: process.env.DB_NAME!,
    port: Number(process.env.DB_PORT!),
    connectionLimit: 10,        // cap connections so we never exhaust MySQL
    waitForConnections: true,   // queue queries instead of erroring when all are busy
    queueLimit: 0,
    enableKeepAlive: true,
  });

globalForDb._mysqlPool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
