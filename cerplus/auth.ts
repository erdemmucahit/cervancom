import { randomUUID, randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { AppError, audit, textValue } from './types.ts';
import type { Database, User, Config } from './types.ts';

const derive = (password:string,salt:string) => new Promise<Buffer>((resolve,reject)=>{
  scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key));
});
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function passwordHash(password: string) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128)
    throw new AppError('Parola 12–128 karakter olmalı.');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
async function passwordMatches(password: string, stored: string) {
  const [, salt, expected] = stored.split(':');
  const actual = await derive(password, salt);
  const target = Buffer.from(expected, 'hex');
  return target.length === actual.length && timingSafeEqual(actual, target);
}
export function emailValue(value: unknown) {
  const email = textValue(value, 'E-posta', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError('Geçerli bir e-posta girin.');
  return email;
}
export function cookie(value: string, config: Config, remove = false) {
  return `cerplus_session=${value}; Path=/cerplus; HttpOnly; SameSite=Strict; Max-Age=${remove ? 0 : 28800}${config.production ? '; Secure' : ''}`;
}
export function checkOrigin(request: Request, config: Config) {
  if (request.headers.get('origin') !== config.origin) throw new AppError('İstek kaynağı doğrulanamadı.', 403);
}
export async function login(db: Database, body: any, ip: string) {
  const email = emailValue(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length > 128) throw new AppError('E-posta veya parola hatalı.', 401);
  const account = hash(email), address = hash(ip);
  await db.transaction(async tx => {
    // Serialize rate checks across edge invocations without session locks.
    await tx.query('SELECT pg_advisory_xact_lock(771901)');
    await tx.query("DELETE FROM login_attempts WHERE created_at < now()-interval '1 day'");
    const count = (await tx.query("SELECT count(*)::int AS count FROM login_attempts WHERE created_at>now()-interval '15 minutes' AND (account_hash=$1 OR ip_hash=$2)", [account, address])).rows[0].count;
    if (count >= 15) throw new AppError('Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.', 429);
    await tx.query('INSERT INTO login_attempts(id,account_hash,ip_hash) VALUES($1,$2,$3)', [randomUUID(),account,address]);
  });
  const row = (await db.query('SELECT * FROM users WHERE email=$1 AND active=true', [email])).rows[0];
  // A fixed, valid dummy hash prevents early return for unknown accounts.
  const dummy = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
  if (!await passwordMatches(password, row?.password_hash ?? dummy) || !row)
    throw new AppError('E-posta veya parola hatalı.', 401);
  const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  await db.transaction(async tx => {
    await tx.query('DELETE FROM sessions WHERE expires_at<now()');
    await tx.query("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours')", [hash(token),row.id,csrf]);
    await audit(tx,row.id,'session.login',row.id,null,{ success:true });
  });
  return { token, csrf, user: publicUser(row) };
}
export function publicUser(row: any): User {
  return { id:row.id, name:row.name, email:row.email, role:row.role, dealer_id:row.dealer_id };
}
export async function session(db: Database, request: Request) {
  const token = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith('cerplus_session='))?.slice(16);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new AppError('Oturum açın.',401);
  const row = (await db.query(`SELECT u.id,u.name,u.email,u.role,u.dealer_id,s.csrf,s.token_hash
    FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true`,[hash(token)])).rows[0];
  if (!row) throw new AppError('Oturum süresi dolmuş. Yeniden giriş yapın.',401);
  return { user:publicUser(row), csrf:row.csrf as string, tokenHash:row.token_hash as string };
}
export async function changePassword(db: Database, user: User, current: string, next: string) {
  const row = (await db.query('SELECT password_hash FROM users WHERE id=$1',[user.id])).rows[0];
  if (typeof current !== 'string' || current.length>128 || !await passwordMatches(current,row.password_hash)) throw new AppError('Mevcut parola hatalı.',403);
  const nextHash = await passwordHash(next);
  await db.transaction(async tx => {
    await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[nextHash,user.id]);
    await tx.query('DELETE FROM sessions WHERE user_id=$1',[user.id]);
    await audit(tx,user.id,'user.password',user.id,null,{ changed:true });
  });
}
