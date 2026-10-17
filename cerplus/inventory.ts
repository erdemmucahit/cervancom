import { randomUUID } from 'node:crypto';
import { hash } from './auth.ts';
import { eligibleOwner } from './catalog.ts';
import { AppError, audit, one, quantity, textValue, uuid } from './types.ts';
import type { Connection, Database, User } from './types.ts';

export interface ReceiptInput { reference: string; ownerKey: string; lines: { packageTypeId: string; rackId: string; quantity: number }[] }
export function normalizeReceipt(body: any): ReceiptInput {
  if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length>1000) throw new AppError('1–1000 kabul satırı girin.');
  const merged = new Map<string,ReceiptInput['lines'][number]>();
  for (const item of body.lines) {
    const line = { packageTypeId:uuid(item.packageTypeId,'Koli tipi'),rackId:uuid(item.rackId,'Raf'),quantity:quantity(item.quantity) };
    const key = `${line.packageTypeId}:${line.rackId}`;
    const prev = merged.get(key);
    if (prev) prev.quantity = quantity(prev.quantity+line.quantity); else merged.set(key,line);
  }
  return { reference:textValue(body.reference,'İrsaliye / kabul belge no',120), ownerKey:body.ownerKey==='common' ? 'common' : uuid(body.ownerKey,'Stok sahibi'),
    lines:[...merged.values()].sort((a,b) => `${a.packageTypeId}${a.rackId}`.localeCompare(`${b.packageTypeId}${b.rackId}`)) };
}
export async function validateReceipt(tx: Connection, input: ReceiptInput) {
  if (input.ownerKey!=='common') await one(tx,'SELECT id FROM dealers WHERE id=$1',[input.ownerKey]);
  const types=[...new Set(input.lines.map(line=>line.packageTypeId))], racks=[...new Set(input.lines.map(line=>line.rackId))];
  if((await tx.query('SELECT id FROM package_types WHERE id=ANY($1::uuid[])',[types])).rows.length!==types.length)throw new AppError('Koli tipi bulunamadı.',404);
  // Consistent lock order also prevents receipt / rack-deactivation races.
  if((await tx.query('SELECT id FROM racks WHERE id=ANY($1::uuid[]) AND active=true ORDER BY id FOR SHARE',[racks])).rows.length!==racks.length)throw new AppError('Aktif raf bulunamadı.',404);
}
async function movement(tx: Connection, actor: string, stockId: string, kind: string, amount: number, reference: string, operation: string) {
  await tx.query('INSERT INTO stock_movements(id,stock_id,kind,quantity,actor_id,reference,operation_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),stockId,kind,amount,actor,reference,operation]);
}
async function addStock(tx: Connection, line: ReceiptInput['lines'][number], owner: string) {
  return one(tx,`INSERT INTO stock(id,rack_id,package_type_id,owner_key,dealer_id,physical) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(rack_id,package_type_id,owner_key) DO UPDATE SET physical=stock.physical+EXCLUDED.physical RETURNING *`,
    [randomUUID(),line.rackId,line.packageTypeId,owner,owner==='common'?null:owner,line.quantity]);
}
export async function receive(tx: Connection, actor: string, input: ReceiptInput, key: string, source = 'manual') {
  // Concurrent duplicate requests serialize before the check and all writes.
  await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`receipt:${key}`]);
  const fingerprint = hash(JSON.stringify(input));
  const prior = (await tx.query('SELECT id,payload_hash FROM receipts WHERE idempotency_key=$1',[key])).rows[0];
  if (prior) {
    if (prior.payload_hash!==fingerprint) throw new AppError('Bu gönderim anahtarı farklı içerikte kullanılmış.',409);
    return { id:prior.id, duplicate:true };
  }
  await validateReceipt(tx,input);
  const id = randomUUID();
  await tx.query('INSERT INTO receipts(id,idempotency_key,payload_hash,source,reference,owner_key,dealer_id,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id,key,fingerprint,source,input.reference,input.ownerKey,input.ownerKey==='common'?null:input.ownerKey,actor]);
  for (const line of input.lines) {
    const stock = await addStock(tx,line,input.ownerKey);
    await tx.query('INSERT INTO receipt_lines(id,receipt_id,package_type_id,rack_id,quantity) VALUES($1,$2,$3,$4,$5)',[randomUUID(),id,line.packageTypeId,line.rackId,line.quantity]);
    await movement(tx,actor,stock.id,'receipt',line.quantity,input.reference,id);
  }
  await audit(tx,actor,'inventory.receive',id,null,input);
  return { id, duplicate:false };
}
export async function stockRows(tx: Connection, user: User, search = '', owner?: string) {
  const scopedOwner = user.role==='dealer' ? user.dealer_id : owner || null;
  return (await tx.query(`SELECT s.*,s.physical-s.reserved-s.protected AS available,r.code AS rack,sec.code AS section,
    k.barcode,k.sequence,k.total,k.volume_m3::text,k.weight_kg::text,p.code AS product_code,p.model,p.variant,b.name AS brand,
    COALESCE(d.name,'Ortak depo stoğu') AS owner
    FROM stock s JOIN racks r ON r.id=s.rack_id JOIN sections sec ON sec.id=r.section_id
    JOIN package_types k ON k.id=s.package_type_id JOIN products p ON p.id=k.product_id JOIN brands b ON b.id=p.brand_id LEFT JOIN dealers d ON d.id=s.dealer_id
    WHERE ($1::text IS NULL OR s.owner_key=$1) AND (p.code ILIKE $2 OR p.model ILIKE $2 OR r.code ILIKE $2 OR k.barcode ILIKE $2)
    ORDER BY r.code,p.code,k.sequence LIMIT 500`,[scopedOwner,`%${search.slice(0,100)}%`])).rows;
}
export async function getStock(tx: Connection, user: User, id: string) {
  return one(tx,'SELECT *,physical-reserved-protected AS available FROM stock WHERE id=$1 AND ($2::uuid IS NULL OR dealer_id=$2)',[uuid(id),user.role==='dealer'?user.dealer_id:null]);
}
export async function listMovements(tx: Connection, user: User) {
  return (await tx.query(`SELECT m.id,m.kind,m.quantity,m.reference,m.created_at,r.code AS rack,k.barcode,p.code AS product_code,p.model,
    COALESCE(d.name,'Ortak depo stoğu') AS owner,u.name AS actor
    FROM stock_movements m JOIN stock s ON s.id=m.stock_id JOIN racks r ON r.id=s.rack_id JOIN package_types k ON k.id=s.package_type_id
    JOIN products p ON p.id=k.product_id LEFT JOIN dealers d ON d.id=s.dealer_id JOIN users u ON u.id=m.actor_id
    WHERE ($1::uuid IS NULL OR s.dealer_id=$1) ORDER BY m.created_at DESC,m.id LIMIT 200`,[user.role==='dealer'?user.dealer_id:null])).rows;
}
export async function adjustStock(db: Database, actor: User, body: any) {
  const id = uuid(body.stockId), qty = quantity(body.quantity), kind = body.kind;
  if (!['transfer','damage'].includes(kind)) throw new AppError('Geçersiz stok işlemi.');
  const target = kind==='transfer' ? uuid(body.targetRackId,'Hedef raf') : null;
  const reference = textValue(body.reason,'İşlem gerekçesi',500), key = uuid(body.idempotencyKey,'Gönderim anahtarı');
  const fingerprint = hash(JSON.stringify({id,qty,kind,target,reference}));
  return db.transaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`operation:${key}`]);
    const prior = (await tx.query('SELECT * FROM inventory_operations WHERE idempotency_key=$1',[key])).rows[0];
    if (prior) {
      if (prior.payload_hash!==fingerprint) throw new AppError('Gönderim anahtarı farklı içerikle kullanılmış.',409);
      return prior.result;
    }
    // Lock before capturing the audit snapshot, so concurrent adjustments never
    // record an outdated "before" quantity even when both updates can succeed.
    const before = await one(tx,'SELECT *,physical-reserved-protected AS available FROM stock WHERE id=$1 FOR UPDATE',[id]);
    if (target===before.rack_id) throw new AppError('Hedef raf mevcut raftan farklı olmalı.');
    if (target) await one(tx,'SELECT id FROM racks WHERE id=$1 AND active=true FOR SHARE',[target]);
    const updated = (await tx.query('UPDATE stock SET physical=physical-$1 WHERE id=$2 AND physical-reserved-protected>=$1 RETURNING *',[qty,id])).rows[0];
    if (!updated) throw new AppError('Kullanılabilir stok yetersiz; verileri yenileyin.',409);
    await movement(tx,actor.id,id,kind==='damage'?'damage':'transfer_out',-qty,reference,key);
    if (target) {
      const destination = await addStock(tx,{ rackId:target,packageTypeId:before.package_type_id,quantity:qty },before.owner_key);
      await movement(tx,actor.id,destination.id,'transfer_in',qty,reference,key);
    }
    await audit(tx,actor.id,`inventory.${kind}`,id,before,{...updated,targetRackId:target,reason:reference});
    const result = { id, success:true };
    await tx.query('INSERT INTO inventory_operations VALUES($1,$2,$3::jsonb)',[key,fingerprint,JSON.stringify(result)]);
    return result;
  });
}

// Internal phase-2 primitive, deliberately not exposed as a reservation API.
// Caller must persist its reservation and lines in this same transaction.
export async function claimAvailable(tx: Connection, dealerId: string, lines: { stockId: string; quantity: number }[]) {
  const merged = new Map<string,number>();
  for (const line of lines) merged.set(uuid(line.stockId),quantity((merged.get(line.stockId)??0)+quantity(line.quantity)));
  for (const [id, qty] of [...merged].sort(([a],[b]) => a.localeCompare(b))) {
    const stock = await one(tx,'SELECT owner_key FROM stock WHERE id=$1',[id]);
    if (!eligibleOwner(stock.owner_key,dealerId)) throw new AppError('Başka bayinin stoğu kullanılamaz.',403);
    const result = await tx.query('UPDATE stock SET reserved=reserved+$1 WHERE id=$2 AND physical-reserved-protected>=$1 RETURNING id',[qty,id]);
    if (!result.rows.length) throw new AppError('Kullanılabilir stok yetersiz.',409);
  }
}
