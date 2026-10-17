import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { localDatabase } from './db-local.ts';
import { postgresDatabase } from './db-postgres.ts';

export async function openDatabase() {
  const production=process.env.CERPLUS_MODE==='production';
  if (process.env.DATABASE_URL) return postgresDatabase(process.env.DATABASE_URL);
  if (production) throw new Error('Üretimde DATABASE_URL zorunlu; PGlite yalnızca geliştirme içindir.');
  const path=resolve(process.env.CERPLUS_DATA_DIR||'.cerplus/development');
  await mkdir(path,{recursive:true});
  return localDatabase(path);
}
