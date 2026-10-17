import pg from 'pg';
import type { Connection, Database } from './types.ts';

// A pool belongs to one invocation on Pages; connections never escape a transaction.
export function postgresDatabase(connectionString: string): Database {
  const pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000 });
  return {
    query: (sql, params) => pool.query(sql, params),
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL lock_timeout = '5s'");
        await client.query("SET LOCAL statement_timeout = '20s'");
        const result = await fn(client as Connection);
        await client.query('COMMIT');
        return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
