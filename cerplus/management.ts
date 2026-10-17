import { randomUUID } from 'node:crypto';
import { emailValue, passwordHash, publicUser } from './auth.ts';
import { AppError, audit, decimal, one, textValue, uuid } from './types.ts';
import type { Database, User } from './types.ts';

export async function createUser(db: Database, actor: User, body: any) {
  const role=body.role;
  if (!['admin','operations','team','dealer'].includes(role)) throw new AppError('Geçersiz rol.');
  const email=emailValue(body.email), name=textValue(body.name,'Ad soyad'), password=await passwordHash(body.password);
  const dealer=role==='dealer'?uuid(body.dealerId,'Bayi'):null,id=randomUUID();
  return db.transaction(async tx=>{
    if (dealer) await one(tx,'SELECT id FROM dealers WHERE id=$1',[dealer]);
    await tx.query('INSERT INTO users(id,name,email,password_hash,role,dealer_id) VALUES($1,$2,$3,$4,$5,$6)',[id,name,email,password,role,dealer]);
    const result={id,name,email,role,dealer_id:dealer};
    await audit(tx,actor.id,'user.create',id,null,result);
    return result;
  });
}
export async function toggleUser(db: Database, actor: User, id: string, active: unknown) {
  if (typeof active!=='boolean') throw new AppError('Hesap durumu geçersiz.');
  return db.transaction(async tx=>{
    await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
    const before=await one(tx,'SELECT id,name,email,role,dealer_id,active FROM users WHERE id=$1',[uuid(id)]);
    if (!active && before.id===actor.id) throw new AppError('Kendi hesabınızı bu ekrandan kapatamazsınız.');
    if (!active && before.role==='admin') {
      const count=(await tx.query("SELECT count(*)::int AS count FROM users WHERE role='admin' AND active=true")).rows[0].count;
      if (count<=1) throw new AppError('Son aktif admin kapatılamaz.',409);
    }
    await tx.query('UPDATE users SET active=$1 WHERE id=$2',[active,id]);
    if (!active) await tx.query('DELETE FROM sessions WHERE user_id=$1',[id]);
    await audit(tx,actor.id,'user.status',id,before,{...before,active});
    return {...publicUser(before),active};
  });
}
export async function saveEntity(db: Database, actor: User, entity: 'dealers'|'sections'|'racks'|'brands', body: any, existingId?: string) {
  const id=existingId?uuid(existingId):randomUUID();
  const code=entity!=='brands'?textValue(body.code,'Kod',40):null;
  const name=entity!=='racks'?textValue(body.name,'Ad'):null;
  const section=entity==='racks'?uuid(body.sectionId,'Bölüm'):null;
  const capacity=entity==='racks' && body.capacityM3!=='' && body.capacityM3!==null && body.capacityM3!==undefined ? decimal(body.capacityM3,'Raf kapasitesi'):null;
  return db.transaction(async tx=>{
    const before=existingId?await one(tx,`SELECT * FROM ${entity} WHERE id=$1 FOR UPDATE`,[id]):null;
    if (section) await one(tx,'SELECT id FROM sections WHERE id=$1',[section]);
    if (entity==='racks') {
      if (before) await tx.query('UPDATE racks SET code=$1,section_id=$2,capacity_m3=$3 WHERE id=$4',[code,section,capacity,id]);
      else await tx.query('INSERT INTO racks(id,code,section_id,capacity_m3) VALUES($1,$2,$3,$4)',[id,code,section,capacity]);
    } else if (entity==='brands') {
      if (before) await tx.query('UPDATE brands SET name=$1 WHERE id=$2',[name,id]);
      else await tx.query('INSERT INTO brands(id,name) VALUES($1,$2)',[id,name]);
    } else {
      if (before) await tx.query(`UPDATE ${entity} SET code=$1,name=$2 WHERE id=$3`,[code,name,id]);
      else await tx.query(`INSERT INTO ${entity}(id,code,name) VALUES($1,$2,$3)`,[id,code,name]);
    }
    const after=await one(tx,`SELECT * FROM ${entity} WHERE id=$1`,[id]);
    await audit(tx,actor.id,`${entity}.${before?'update':'create'}`,id,before,after);
    return after;
  });
}
export async function deactivateRack(db: Database, actor: User, id: string) {
  return db.transaction(async tx=>{
    const before=await one(tx,'SELECT * FROM racks WHERE id=$1 FOR UPDATE',[uuid(id)]);
    // Reception checks lock the same rack before adding stock.
    const full=(await tx.query('SELECT id FROM stock WHERE rack_id=$1 AND physical>0 LIMIT 1',[id])).rows.length;
    if (full) throw new AppError('Dolu raf silinemez. Önce stoğu başka rafa aktarın.',409);
    await tx.query('UPDATE racks SET active=false WHERE id=$1',[id]);
    await audit(tx,actor.id,'racks.deactivate',id,before,{...before,active:false});
    return {id,active:false};
  });
}
