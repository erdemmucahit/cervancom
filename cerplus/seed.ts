import { randomUUID } from 'node:crypto';
import { passwordHash } from './auth.ts';
import { insertProduct, normalizeProduct } from './catalog.ts';
import { normalizeReceipt, receive } from './inventory.ts';
import type { Database } from './types.ts';

export const demoPassword='CerplusDemo!2026';
export async function seedDevelopment(db: Database, production=false) {
  if (production) throw new Error('Üretimde örnek veri yüklenemez.');
  const password=await passwordHash(demoPassword);
  return db.transaction(async tx=>{
    await tx.query("SELECT pg_advisory_xact_lock(771902)");
    const dataset=(await tx.query("SELECT value FROM app_meta WHERE key='dataset'")).rows[0].value;
    if (dataset==='development') return {duplicate:true};
    if ((await tx.query('SELECT count(*)::int AS count FROM users')).rows[0].count || dataset!=='empty') throw new Error('Örnek veri yalnızca boş geliştirme veritabanına yüklenir.');
    const dealerA=randomUUID(),dealerB=randomUUID();
    await tx.query('INSERT INTO dealers(id,code,name) VALUES($1,$2,$3),($4,$5,$6)',[dealerA,'ORNEK-A','Örnek Bayi A',dealerB,'ORNEK-B','Örnek Bayi B']);
    const admin=randomUUID();
    for (const [id,name,email,role,dealer] of [
      [admin,'Örnek Yönetici','admin@cerplus.test','admin',null],
      [randomUUID(),'Örnek Operasyon','ofis@cerplus.test','operations',null],
      [randomUUID(),'Örnek Ekip','ekip@cerplus.test','team',null],
      [randomUUID(),'Örnek Bayi A','bayia@cerplus.test','dealer',dealerA],
      [randomUUID(),'Örnek Bayi B','bayib@cerplus.test','dealer',dealerB],
    ]) await tx.query('INSERT INTO users(id,name,email,password_hash,role,dealer_id) VALUES($1,$2,$3,$4,$5,$6)',[id,name,email,password,role,dealer]);
    const brand=randomUUID(),otherBrand=randomUUID();
    await tx.query('INSERT INTO brands(id,name) VALUES($1,$2),($3,$4)',[brand,'Örnek Mobilya',otherBrand,'Örnek İkinci Marka']);
    const racks:string[]=[];
    for (const code of ['A','B','C','D']) {
      const section=randomUUID();await tx.query('INSERT INTO sections VALUES($1,$2,$3)',[section,code,`${code} Bölümü`]);
      for (const number of [1,2]) {
        const rack=randomUUID();racks.push(rack);await tx.query('INSERT INTO racks(id,section_id,code,capacity_m3) VALUES($1,$2,$3,$4)',[rack,section,`${code}${number}`,'20']);
      }
    }
    const wardrobe=await insertProduct(tx,admin,normalizeProduct({brandId:brand,code:'GRD-15',model:'Örnek 6 Kapaklı Gardrop',variant:'Meşe',assemblyMinutes:120,
      packages:Array.from({length:15},(_,i)=>({sequence:i+1,required:1,barcode:`15-${String(i+1).padStart(2,'0')}`,volume:'0.08',weight:'12'}))}));
    const sofa=await insertProduct(tx,admin,normalizeProduct({brandId:brand,code:'KLT-01',model:'Örnek Üçlü Koltuk',packages:[{sequence:1,required:1,barcode:'KLT-001',volume:'1.8',weight:'55'}]}));
    await insertProduct(tx,admin,normalizeProduct({brandId:otherBrand,code:'MAS-01',model:'Örnek Masa',packages:[{sequence:1,required:1,barcode:'15-01',volume:'0.4',weight:'25'}]}));
    const packages=(await tx.query('SELECT id,sequence FROM package_types WHERE product_id=$1 ORDER BY sequence',[wardrobe.id])).rows;
    await receive(tx,admin,normalizeReceipt({reference:'ORNEK-KABUL-A',ownerKey:dealerA,lines:packages.slice(0,14).map((item,i)=>({packageTypeId:item.id,rackId:racks[i%2],quantity:i===0?2:1}))}),'seed:dealer-a','seed');
    await receive(tx,admin,normalizeReceipt({reference:'ORNEK-KABUL-B',ownerKey:dealerB,lines:[{packageTypeId:packages[14].id,rackId:racks[2],quantity:1}]}),'seed:dealer-b','seed');
    const sofaPackage=(await tx.query('SELECT id FROM package_types WHERE product_id=$1',[sofa.id])).rows[0].id;
    await receive(tx,admin,normalizeReceipt({reference:'ORNEK-KABUL-ORTAK',ownerKey:'common',lines:[{packageTypeId:sofaPackage,rackId:racks[3],quantity:3}]}),'seed:common','seed');
    await tx.query("UPDATE app_meta SET value='development' WHERE key='dataset'");
    return {duplicate:false};
  });
}
