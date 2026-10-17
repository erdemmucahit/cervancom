export type Row = Record<string, any>;
export interface Connection {
  query<T extends Row = Row>(sql: string, params?: any[]): Promise<{ rows: T[] }>;
}
export interface Database extends Connection {
  transaction<T>(fn: (tx: Connection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export type Role = 'admin' | 'operations' | 'team' | 'dealer';
export interface User {
  id: string; name: string; email: string; role: Role; dealer_id: string | null;
}
export interface Config { origin: string; production: boolean }
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export function requireRole(user: User, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new AppError('Bu işlem için yetkiniz yok.', 403);
}
export function textValue(value: unknown, label: string, max = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new AppError(`${label}: 1–${max} karakter girin.`);
  return value.trim();
}
export function uuid(value: unknown, label = 'Kayıt'): string {
  const str = textValue(value, label, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str))
    throw new AppError(`${label} geçersiz.`);
  return str;
}
export function quantity(value: unknown, label = 'Miktar', max = 100000): number {
  if (typeof value !== 'number' && typeof value !== 'string') throw new AppError(`${label} geçersiz.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw new AppError(`${label}: 1–${max} arasında tam sayı girin.`);
  return number;
}
export function decimal(value: unknown, label: string): string {
  const str = String(value ?? '').trim().replace(',', '.');
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(str) || Number(str) <= 0) throw new AppError(`${label}: sıfırdan büyük, en fazla 6 ondalık basamaklı sayı girin.`);
  return str.replace(/^0+(?=\d)/,'').replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
}
export async function one(tx: Connection, sql: string, params: any[] = []): Promise<Row> {
  const row = (await tx.query(sql, params)).rows[0];
  if (!row) throw new AppError('Kayıt bulunamadı.', 404);
  return row;
}
export async function audit(tx: Connection, actor: string, action: string, entity: string, before: unknown, after: unknown) {
  const { randomUUID } = await import('node:crypto');
  await tx.query('INSERT INTO audit_log(id,actor_id,action,entity,before_value,after_value) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',
    [randomUUID(), actor, action, entity, JSON.stringify(before), JSON.stringify(after)]);
}
