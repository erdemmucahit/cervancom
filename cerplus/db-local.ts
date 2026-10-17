import { PGlite } from '@electric-sql/pglite';
import type { Connection, Database } from './types.ts';

export async function localDatabase(path?: string): Promise<Database> {
  const db = new PGlite(path);
  await db.waitReady;
  // PGlite has one connection; serialize all public work, including reads, so
  // no request can accidentally join another request's uncommitted transaction.
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  }
  const connection: Connection = { query: (sql, params) => db.query(sql, params) };
  return {
    query: (sql, params) => exclusive(() => db.query(sql, params)),
    transaction: fn => exclusive(() => db.transaction(tx => fn(tx as Connection))),
    close: () => exclusive(() => db.close()),
  };
}
