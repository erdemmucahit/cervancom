import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { localDatabase } from '../db-local.ts';
import { migrate } from '../migrate.ts';
import { seedDevelopment,demoPassword } from '../seed.ts';
import { createApp } from '../app.ts';
import { fullProductCount,eligibleOwner } from '../catalog.ts';
import { claimAvailable,normalizeReceipt,receive } from '../inventory.ts';
import { headers,previewImport,commitImport } from '../imports.ts';
import type { Database } from '../types.ts';
import { postgresDatabase } from '../db-postgres.ts';

let db:Database,app:ReturnType<typeof createApp>,admin:any,dealerA:any,dealerB:any,team:any,meta:any;
let control:Database|undefined,testSchema:string|undefined;
const origin='http://localhost:4321';
async function request(path:string,body?:any,auth?:any,method=body===undefined?'GET':'POST',requestOrigin=origin){
  return app(new Request(origin+'/cerplus/api'+path,{method,headers:{...(auth?{cookie:auth.cookie,'x-csrf-token':auth.csrf}:{}),...(body===undefined?{}:{'Content-Type':'application/json',origin:requestOrigin})},...(body===undefined?{}:{body:JSON.stringify(body)})}),'test-ip');
}
async function auth(email:string){const response=await request('/login',{email,password:demoPassword});assert.equal(response.status,200);return {...await response.json(),cookie:response.headers.get('set-cookie')!.split(';')[0]};}
async function workbook(kind:'catalog'|'receipt',rows:any[][]){const book=new ExcelJS.Workbook();const sheet=book.addWorksheet('Veri');sheet.addRow(headers[kind]);rows.forEach(row=>sheet.addRow(row));return Buffer.from(await book.xlsx.writeBuffer());}
before(async()=>{
  if(process.env.CERPLUS_TEST_DATABASE_URL){
    control=postgresDatabase(process.env.CERPLUS_TEST_DATABASE_URL);
    testSchema='cerplus_suite_'+randomUUID().replaceAll('-','');await control.query(`CREATE SCHEMA ${testSchema}`);
    const connection=new URL(process.env.CERPLUS_TEST_DATABASE_URL);connection.searchParams.set('options',`-c search_path=${testSchema}`);
    db=postgresDatabase(connection.toString());
  }else db=await localDatabase();
  await migrate(db);await seedDevelopment(db);
  app=createApp(db,{origin,production:false});
  admin=await auth('admin@cerplus.test');dealerA=await auth('bayia@cerplus.test');dealerB=await auth('bayib@cerplus.test');team=await auth('ekip@cerplus.test');
  meta=await (await request('/bootstrap',undefined,admin)).json();
});
after(async()=>{await db?.close();if(control){await control.query(`DROP SCHEMA ${testSchema} CASCADE`);await control.close();}});

test('migration and seed are repeatable, development dataset is blocked in production',async()=>{
  await migrate(db);const before=(await db.query('SELECT count(*)::int AS count FROM stock_movements')).rows[0].count;
  assert.equal((await seedDevelopment(db)).duplicate,true);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM stock_movements')).rows[0].count,before);
  await assert.rejects(()=>seedDevelopment(db,true),/Üretimde/);
  const response=await createApp(db,{origin,production:true})(new Request(origin+'/cerplus/api/health'));
  assert.equal(response.status,503);
});
test('fifteen boxes with one missing package type never count as a complete wardrobe',async()=>{
  const required=(await db.query("SELECT k.id,k.required_quantity AS quantity FROM package_types k JOIN products p ON p.id=k.product_id WHERE p.code='GRD-15' ORDER BY k.sequence")).rows as any[];
  const stock=(await db.query('SELECT package_type_id,sum(physical-reserved-protected)::int AS quantity FROM stock WHERE owner_key=$1 GROUP BY package_type_id',[dealerA.user.dealer_id])).rows;
  assert.equal(stock.reduce((sum,row)=>sum+row.quantity,0),15);
  const available=Object.fromEntries(stock.map(row=>[row.package_type_id,row.quantity]));
  assert.equal(fullProductCount(required,available),0);
  available[required[14].id]=1;assert.equal(fullProductCount(required,available),1);
});
test('partial delivery domain count only admits full products and respects required multiplicities',()=>{
  assert.equal(fullProductCount([{id:'sofa',quantity:1}],{sofa:2}),2);
  assert.equal(fullProductCount([{id:'a',quantity:2},{id:'b',quantity:1}],{a:3,b:20}),1);
  assert.equal(fullProductCount([{id:'a',quantity:1},{id:'b',quantity:1}],{a:15}),0);
  assert.equal(fullProductCount([],{}),0);
});
test('dealer isolation covers stock filters, direct ids, movements, management and file routes',async()=>{
  const own=await (await request('/stock',undefined,dealerA)).json();assert.ok(own.length);
  assert.ok(own.every((row:any)=>row.dealer_id===dealerA.user.dealer_id));
  const bypass=await (await request('/stock?owner='+dealerB.user.dealer_id,undefined,dealerA)).json();
  assert.ok(bypass.every((row:any)=>row.dealer_id===dealerA.user.dealer_id));
  const other=await (await request('/stock',undefined,dealerB)).json();
  assert.equal((await request('/stock/'+other[0].id,undefined,dealerA)).status,404);
  const history=await (await request('/movements',undefined,dealerA)).json();assert.ok(history.every((row:any)=>row.owner==='Örnek Bayi A'));
  assert.equal((await request('/users',undefined,dealerA)).status,403);
  assert.equal((await request('/receipts',{},dealerA)).status,403);
  assert.equal((await request('/files/'+randomUUID(),undefined,dealerA)).status,404);
  const teamMeta=await (await request('/bootstrap',undefined,team)).json();assert.deepEqual(teamMeta.dealers,[]);
  assert.equal((await request('/stock',undefined,team)).status,403);
});
test('barcode without brand reports ambiguity, unknown barcode never creates a receipt',async()=>{
  const result=await (await request('/barcode?value=15-01',undefined,admin)).json();assert.equal(result.matches.length,2);assert.equal(result.ambiguous,true);
  const exact=await (await request('/barcode?value=15-01&brandId='+result.matches[0].brand_id,undefined,admin)).json();assert.equal(exact.matches.length,1);
  const missing=await (await request('/barcode?value=UNKNOWN',undefined,admin)).json();assert.deepEqual(missing.matches,[]);
});
test('manual receipt retries are idempotent; changed payload with same key is rejected',async()=>{
  const packageId=(await db.query('SELECT id FROM package_types LIMIT 1')).rows[0].id;
  const body={reference:'TEST-MANUAL',ownerKey:'common',idempotencyKey:randomUUID(),lines:[{packageTypeId:packageId,rackId:meta.racks[6].id,quantity:2}]};
  const responses=await Promise.all([request('/receipts',body,admin),request('/receipts',body,admin)]);
  assert.deepEqual(responses.map(res=>res.status),[201,201]);
  const results=await Promise.all(responses.map(res=>res.json()));assert.equal(results[0].id,results[1].id);assert.equal(results.filter(r=>r.duplicate).length,1);
  assert.equal((await request('/receipts',{...body,reference:'CHANGED'},admin)).status,409);
  const stock=(await db.query("SELECT physical FROM stock WHERE package_type_id=$1 AND rack_id=$2 AND owner_key='common'",[packageId,meta.racks[6].id])).rows[0];assert.equal(stock.physical,2);
});
test('failed receipt rolls back every line and movement',async()=>{
  const prior=(await db.query('SELECT count(*)::int AS count FROM receipts')).rows[0].count;
  const packageId=(await db.query('SELECT id FROM package_types LIMIT 1')).rows[0].id;
  const response=await request('/receipts',{reference:'INVALID',ownerKey:'common',idempotencyKey:randomUUID(),lines:[{packageTypeId:packageId,rackId:meta.racks[0].id,quantity:1},{packageTypeId:randomUUID(),rackId:meta.racks[0].id,quantity:1}]},admin);
  assert.equal(response.status,404);assert.equal((await db.query('SELECT count(*)::int AS count FROM receipts')).rows[0].count,prior);
});
test('XLSX catalog preview/commit preserves leading zeroes, creates no stock, and rejects duplicate replay',async()=>{
  const brandId=meta.brands[0].id,owner=admin.user.id;
  const bytes=await workbook('catalog',[['XLSX-01','Excel Test','',1,2,1,'000001',0.1,10,30],['XLSX-01','Excel Test','',2,2,1,'000002',0.2,12,30]]);
  const stockBefore=(await db.query('SELECT sum(physical)::int AS count FROM stock')).rows[0].count;
  const preview=await previewImport(db,owner,'catalog',bytes,{brandId});assert.deepEqual(preview.errors,[]);
  assert.equal((await db.query("SELECT id FROM products WHERE code='XLSX-01'")).rows.length,0);
  const result=await commitImport(db,owner,preview.id);assert.equal(result.count,1);
  assert.equal((await db.query('SELECT sum(physical)::int AS count FROM stock')).rows[0].count,stockBefore);
  assert.equal((await db.query("SELECT barcode FROM package_types WHERE barcode='000001'")).rows[0].barcode,'000001');
  assert.equal((await commitImport(db,owner,preview.id)).duplicate,true);
  const replay=await previewImport(db,owner,'catalog',bytes,{brandId});assert.equal(replay.duplicate,true);assert.deepEqual(replay.errors,[]);
  assert.equal((await commitImport(db,owner,replay.id)).duplicate,true);
});
test('XLSX receiving is previewed, atomic, content-deduplicated across parallel commits',async()=>{
  const type=(await db.query("SELECT k.barcode,k.brand_id FROM package_types k WHERE barcode='000001'")).rows[0];
  const bytes=await workbook('receipt',[[type.barcode,meta.racks[7].code,3]]);
  const context={brandId:type.brand_id,ownerKey:dealerA.user.dealer_id,reference:'TEST-XLSX-KABUL'};
  const preview=await previewImport(db,admin.user.id,'receipt',bytes,context);assert.deepEqual(preview.errors,[]);
  const results=await Promise.all([commitImport(db,admin.user.id,preview.id),commitImport(db,admin.user.id,preview.id)]);assert.equal(results[0].id,results[1].id);
  const replay=await previewImport(db,admin.user.id,'receipt',bytes,context);assert.equal(replay.duplicate,true);
  const final=await commitImport(db,admin.user.id,replay.id);assert.equal(final.duplicate,true);
  assert.equal((await db.query("SELECT physical FROM stock s JOIN package_types k ON k.id=s.package_type_id WHERE barcode='000001' AND owner_key=$1",[dealerA.user.dealer_id])).rows[0].physical,3);
});
test('bad Excel rows, formulas and numeric barcodes block the entire import; previews are private',async()=>{
  const brandId=meta.brands[0].id;
  const bad=await workbook('catalog',[['BAD-01','Bad','',1,2,1,123,0.1,1,0]]);
  const preview=await previewImport(db,admin.user.id,'catalog',bad,{brandId});assert.ok(preview.errors.some(err=>err.row===2));
  await assert.rejects(()=>commitImport(db,admin.user.id,preview.id),/Hataları/);
  await assert.rejects(()=>commitImport(db,dealerA.user.id,preview.id),/bulunamadı/);
  const formula=await workbook('catalog',[['BAD-02','Bad','',1,1,1,'FORMULA',{formula:'1+1',result:2},1,0]]);
  const formulaPreview=await previewImport(db,admin.user.id,'catalog',formula,{brandId});assert.ok(formulaPreview.errors.some(err=>/formül/.test(err.message)));
  assert.equal((await db.query("SELECT id FROM products WHERE code LIKE 'BAD-%'")).rows.length,0);
});
test('full rack cannot be deleted, transfer preserves owner and quantity, damage records negative movement',async()=>{
  const stocks=await (await request('/stock',undefined,dealerA)).json();const stock=stocks.find((row:any)=>row.physical===2)!;
  assert.equal((await request('/racks/'+stock.rack_id,{},admin,'DELETE')).status,409);
  const target=meta.racks[4];
  const transfer={stockId:stock.id,kind:'transfer',quantity:1,targetRackId:target.id,reason:'Test transfer',idempotencyKey:randomUUID()};
  assert.equal((await request('/adjustments',transfer,admin)).status,200);
  assert.equal((await request('/adjustments',transfer,admin)).status,200);
  const moved=(await db.query('SELECT * FROM stock WHERE rack_id=$1 AND package_type_id=$2 AND owner_key=$3',[target.id,stock.package_type_id,stock.owner_key])).rows[0];assert.equal(moved.physical,1);assert.equal(moved.dealer_id,dealerA.user.dealer_id);
  assert.equal((await request('/adjustments',{stockId:moved.id,kind:'damage',quantity:1,reason:'Test hasar',idempotencyKey:randomUUID()},admin)).status,200);
  assert.equal((await db.query('SELECT physical FROM stock WHERE id=$1',[moved.id])).rows[0].physical,0);
  assert.equal((await db.query("SELECT quantity FROM stock_movements WHERE stock_id=$1 AND kind='damage'",[moved.id])).rows[0].quantity,-1);
  assert.equal((await request('/racks/'+target.id,{},admin,'DELETE')).status,200);
  assert.equal((await request('/receipts',{reference:'CLOSED-RACK',ownerKey:'common',idempotencyKey:randomUUID(),lines:[{packageTypeId:stock.package_type_id,rackId:target.id,quantity:1}]},admin)).status,404);
});
test('other dealer stock is never eligible or claimable',async()=>{
  assert.equal(eligibleOwner(dealerB.user.dealer_id,dealerA.user.dealer_id),false);
  assert.equal(eligibleOwner('common',dealerA.user.dealer_id),true);
  const other=(await db.query('SELECT id FROM stock WHERE dealer_id=$1 LIMIT 1',[dealerB.user.dealer_id])).rows[0];
  await assert.rejects(()=>db.transaction(tx=>claimAvailable(tx,dealerA.user.dealer_id,[{stockId:other.id,quantity:1}])),/Başka bayinin/);
});
test('parallel claims cannot oversubscribe; failure on a later line rolls back earlier claims',async()=>{
  const stock=(await db.query("SELECT s.* FROM stock s JOIN package_types k ON k.id=s.package_type_id WHERE k.barcode='KLT-001' AND owner_key='common'")).rows[0];
  const outcomes=await Promise.allSettled([1,2].map(()=>db.transaction(tx=>claimAvailable(tx,dealerA.user.dealer_id,[{stockId:stock.id,quantity:2}]))));
  assert.equal(outcomes.filter(item=>item.status==='fulfilled').length,1);
  assert.equal((await db.query('SELECT reserved FROM stock WHERE id=$1',[stock.id])).rows[0].reserved,2);
  await assert.rejects(()=>db.transaction(async tx=>{await claimAvailable(tx,dealerA.user.dealer_id,[{stockId:stock.id,quantity:1}]);throw new Error('Later line failed');}));
  assert.equal((await db.query('SELECT reserved FROM stock WHERE id=$1',[stock.id])).rows[0].reserved,2);
});
test('CSRF/origin checks, session security, disabled accounts and audit avoid secret disclosure',async()=>{
  assert.equal((await request('/dealers',{code:'CSRF',name:'Blocked'},admin,'POST','https://attacker.test')).status,403);
  assert.equal((await request('/dealers',{code:'CSRF',name:'Blocked'},{cookie:admin.cookie,csrf:'wrong'})).status,403);
  assert.equal((await request('/stock')).status,401);
  assert.equal((await request('/users/'+admin.user.id,{active:false},admin,'PATCH')).status,400);
  const userResponse=await request('/users',{name:'Temp','email':'temp@cerplus.test',password:demoPassword,role:'operations'},admin);assert.equal(userResponse.status,201);const created=await userResponse.json();assert.equal(created.password_hash,undefined);
  const temp=await auth('temp@cerplus.test');assert.equal((await request('/users/'+created.id,{active:false},admin,'PATCH')).status,200);
  assert.equal((await request('/bootstrap',undefined,temp)).status,401);
  const logs=await (await request('/audit',undefined,admin)).json();assert.ok(logs.some((row:any)=>row.action==='inventory.transfer'));
  assert.ok(!JSON.stringify(logs).includes(demoPassword));assert.ok(!JSON.stringify(logs).includes('password_hash'));
  const logout=await request('/logout',{},dealerB);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie')!,/HttpOnly; SameSite=Strict/);assert.equal((await request('/bootstrap',undefined,dealerB)).status,401);
});
test('unimplemented dealer return decisions cannot increase stock',async()=>{
  const before=(await db.query('SELECT sum(physical)::int AS total FROM stock')).rows[0].total;
  assert.equal((await request('/return-decisions',{decision:'accept'},dealerA)).status,404);
  assert.equal((await db.query('SELECT sum(physical)::int AS total FROM stock')).rows[0].total,before);
});
