import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Database } from './types.ts';

export async function migrate(db: Database) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  const folder = new URL('./migrations/', import.meta.url);
  for (const name of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort()) {
    const sql = await readFile(new URL(name, folder), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    await db.transaction(async tx => {
      // Shared by independent migration processes on PostgreSQL too.
      await tx.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
      const prior = (await tx.query('SELECT checksum FROM schema_migrations WHERE name=$1', [name])).rows[0];
      if (prior) {
        if (prior.checksum !== checksum) throw new Error(`Uygulanmış migration değiştirilmiş: ${name}`);
        return;
      }
      // Migration 001 is plain DDL (no function bodies or semicolons in literals).
      for (const statement of sql.split(';').filter(part => part.trim())) await tx.query(statement);
      await tx.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [name, checksum]);
    });
  }
}
