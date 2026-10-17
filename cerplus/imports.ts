// Browser build avoids filesystem/archiver imports in Cloudflare Functions.
import ExcelJS from 'exceljs/dist/exceljs.min.js';
import { inflateRawSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import { hash } from './auth.ts';
import { insertProduct, normalizeProduct } from './catalog.ts';
import { normalizeReceipt, receive, validateReceipt } from './inventory.ts';
import { AppError, one, quantity, textValue, uuid } from './types.ts';
import type { Connection, Database } from './types.ts';

export const headers = {
  catalog:['urun_kodu','model','varyant','koli_sira','toplam_koli','gereken_adet','barkod','hacim_m3','agirlik_kg','montaj_dakika'],
  receipt:['barkod','raf','miktar'],
};
export type ImportKind = keyof typeof headers;
interface ImportError { row: number; message: string }

// Validate both declared and actual uncompressed size BEFORE ExcelJS/JSZip.
// ZIP64, encryption and external links/macros are outside the supported template.
export function checkXlsxZip(buffer: Buffer) {
  if (buffer.length<22 || buffer.length>2*1024*1024) throw new AppError('XLSX dosyası en fazla 2 MB olmalı.');
  let end = -1;
  for (let pos=buffer.length-22;pos>=Math.max(0,buffer.length-65557);pos--) {
    if (buffer.readUInt32LE(pos)===0x06054b50) { end=pos; break; }
  }
  if (end<0) throw new AppError('Geçerli bir XLSX dosyası seçin.');
  const count=buffer.readUInt16LE(end+10), centralSize=buffer.readUInt32LE(end+12), offset=buffer.readUInt32LE(end+16);
  if (count>200 || !count || buffer.readUInt16LE(end+4)!==0 || offset+centralSize>end) throw new AppError('XLSX arşiv yapısı desteklenmiyor.');
  let pos=offset, actualTotal=0;
  try {
    for (let i=0;i<count;i++) {
      if (buffer.readUInt32LE(pos)!==0x02014b50) throw new Error();
      const flags=buffer.readUInt16LE(pos+8), method=buffer.readUInt16LE(pos+10), compressed=buffer.readUInt32LE(pos+20), expanded=buffer.readUInt32LE(pos+24);
      const nameLength=buffer.readUInt16LE(pos+28), extra=buffer.readUInt16LE(pos+30), comment=buffer.readUInt16LE(pos+32), local=buffer.readUInt32LE(pos+42);
      const name=buffer.subarray(pos+46,pos+46+nameLength).toString('utf8');
      if ((flags&1) || expanded>8*1024*1024 || /vbaProject|externalLinks|\.\.\//i.test(name)) throw new Error();
      if (buffer.readUInt32LE(local)!==0x04034b50) throw new Error();
      const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28);
      if (start+compressed>offset) throw new Error();
      const input=buffer.subarray(start,start+compressed);
      const data=method===0 ? input : method===8 ? inflateRawSync(input,{maxOutputLength:8*1024*1024}) : null;
      if (!data || data.length!==expanded) throw new Error();
      actualTotal+=data.length;
      if (actualTotal>8*1024*1024) throw new Error();
      pos+=46+nameLength+extra+comment;
    }
    if (pos!==offset+centralSize) throw new Error();
  } catch { throw new AppError('XLSX bozuk, şifreli veya izin verilen açılmış boyutu (8 MB) aşıyor.'); }
}
async function readRows(buffer: Buffer, kind: ImportKind) {
  checkXlsxZip(buffer);
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer as any); } catch { throw new AppError('Excel dosyası okunamadı. Standart XLSX şablonunu kullanın.'); }
  if (workbook.worksheets.length!==1) throw new AppError('Dosyada yalnızca bir çalışma sayfası olmalı.');
  const sheet=workbook.worksheets[0];
  if (sheet.rowCount<2 || sheet.rowCount>1001 || sheet.columnCount>headers[kind].length) throw new AppError('Şablon başlıkları ve 1–1000 veri satırı bulunmalı.');
  const actual=headers[kind].map((_,i)=>sheet.getRow(1).getCell(i+1).text.trim());
  if (JSON.stringify(actual)!==JSON.stringify(headers[kind])) throw new AppError('Sütunlar standart şablonla aynı sırada olmalı. Şablonu indirin.');
  const rows: { row:number; data:Record<string,any> }[] = [], errors:ImportError[]=[];
  for (let index=2;index<=sheet.rowCount;index++) {
    const row=sheet.getRow(index);
    if (!row.hasValues) continue;
    const data:Record<string,any>={};
    headers[kind].forEach((key,col)=>{
      const cell=row.getCell(col+1), value=cell.value;
      if (value!==null && typeof value==='object') errors.push({row:index,message:`${key}: formül, bağlantı veya zengin metin desteklenmiyor.`});
      if (['barkod','urun_kodu','raf'].includes(key) && typeof value!=='string') errors.push({row:index,message:`${key}: hücre metin biçiminde olmalı (baştaki sıfırlar için).`});
      data[key]=typeof value==='number' ? value : cell.text.trim();
    });
    rows.push({row:index,data});
  }
  if (!rows.length) throw new AppError('Dosyada veri satırı yok.');
  return {rows,errors};
}
export async function previewImport(db: Database, actor: string, kind: ImportKind, buffer: Buffer, context: any) {
  const brandId=uuid(context.brandId,'Marka');
  await one(db,'SELECT id FROM brands WHERE id=$1',[brandId]);
  const {rows,errors}=await readRows(buffer,kind);
  let payload:any;
  if (kind==='catalog') {
    const groups=new Map<string, typeof rows>();
    for (const row of rows) {
      const key=JSON.stringify([row.data.urun_kodu,row.data.varyant]);
      groups.set(key,[...(groups.get(key)??[]),row]);
    }
    const products:any[]=[], seenBarcodes=new Set<string>();
    for (const group of groups.values()) {
      try {
        const first=group[0].data;
        for (const {data,row} of group) {
          if (quantity(data.toplam_koli,'Toplam koli',100)!==group.length) errors.push({row,message:'Ürünün toplam koli sayısı ve dosyadaki farklı koli tipleri eşleşmiyor.'});
          if (data.model!==first.model || String(data.montaj_dakika)!==String(first.montaj_dakika)) errors.push({row,message:'Aynı üründe model ve montaj süresi tutarlı olmalı.'});
          if (seenBarcodes.has(data.barkod)) errors.push({row,message:'Dosyada aynı marka/barkod tekrar ediyor.'});
          seenBarcodes.add(data.barkod);
          if ((await db.query('SELECT id FROM package_types WHERE brand_id=$1 AND barcode=$2',[brandId,String(data.barkod)])).rows.length) errors.push({row,message:'Bu markada barkod zaten kayıtlı.'});
        }
        const product=normalizeProduct({brandId,code:first.urun_kodu,model:first.model,variant:first.varyant,assemblyMinutes:first.montaj_dakika,
          packages:group.map(({data})=>({sequence:data.koli_sira,required:data.gereken_adet,barcode:data.barkod,volume:data.hacim_m3,weight:data.agirlik_kg}))});
        if ((await db.query('SELECT id FROM products WHERE brand_id=$1 AND code=$2 AND variant=$3',[brandId,product.code,product.variant])).rows.length) errors.push({row:group[0].row,message:'Ürün kodu/varyant zaten kayıtlı; mevcut katalog değiştirilmedi.'});
        products.push(product);
      } catch (error) { errors.push({row:group[0].row,message:error instanceof AppError ? error.message : 'Ürün satırı geçersiz.'}); }
    }
    products.sort((a,b)=>`${a.code}\0${a.variant}`.localeCompare(`${b.code}\0${b.variant}`));
    payload={brandId,products};
  } else {
    const lines:any[]=[];
    for (const {data,row} of rows) {
      try {
        const type=await one(db,'SELECT id FROM package_types WHERE brand_id=$1 AND barcode=$2',[brandId,String(data.barkod)]);
        const rack=await one(db,'SELECT id FROM racks WHERE code=$1 AND active=true',[String(data.raf)]);
        lines.push({packageTypeId:type.id,rackId:rack.id,quantity:quantity(data.miktar)});
      } catch (error) { errors.push({row,message:error instanceof AppError && error.status!==404 ? error.message : 'Barkod bu markada tanımlı değil veya raf bulunamadı.'}); }
    }
    try { payload=normalizeReceipt({...context,lines}); await validateReceipt(db,payload); }
    catch(error) { errors.push({row:0,message:error instanceof AppError?error.message:'Kabul bilgileri geçersiz.'}); payload={...context,lines}; }
  }
  const digest=hash(JSON.stringify({kind,payload}));
  // Same normalized content reports the original result, even though catalog
  // validation now sees the products created by that successful import.
  const prior=(await db.query('SELECT result FROM imports WHERE digest=$1',[digest])).rows[0];
  const id=randomUUID();
  await db.query('DELETE FROM import_previews WHERE expires_at<now() AND result IS NULL');
  await db.query('INSERT INTO import_previews(id,actor_id,kind,digest,payload,errors) VALUES($1,$2,$3,$4,$5::jsonb,$6::jsonb)',[id,actor,kind,digest,JSON.stringify(payload),JSON.stringify(prior?[]:errors)]);
  return {id,kind,context:{brandId,ownerKey:payload.ownerKey,reference:payload.reference},rowCount:rows.length,rows:rows.map(row=>({row:row.row,...row.data})),errors:prior?[]:errors,duplicate:!!prior,result:prior?.result};
}
export async function commitImport(db: Database, actor: string, id: string) {
  return db.transaction(async tx=>{
    const preview=await one(tx,'SELECT * FROM import_previews WHERE id=$1 AND actor_id=$2 FOR UPDATE',[uuid(id),actor]);
    if (preview.result) return {...preview.result,duplicate:true};
    if (new Date(preview.expires_at).getTime()<Date.now()) throw new AppError('Önizleme süresi doldu; dosyayı yeniden yükleyin.',409);
    if (preview.errors.length) throw new AppError('Hataları dosyada düzeltip yeniden yükleyin.',409);
    await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`import:${preview.digest}`]);
    const prior=(await tx.query('SELECT result FROM imports WHERE digest=$1',[preview.digest])).rows[0];
    if (prior) return {...prior.result,duplicate:true};
    let result:any;
    if (preview.kind==='catalog') {
      const ids=[];
      for (const product of preview.payload.products) ids.push((await insertProduct(tx,actor,normalizeProduct(product))).id);
      result={kind:'catalog',count:ids.length,ids};
    } else result={kind:'receipt',...await receive(tx,actor,normalizeReceipt(preview.payload),`xlsx:${preview.digest}`,'xlsx')};
    await tx.query('INSERT INTO imports(digest,kind,result,actor_id) VALUES($1,$2,$3::jsonb,$4)',[preview.digest,preview.kind,JSON.stringify(result),actor]);
    await tx.query('UPDATE import_previews SET result=$1::jsonb WHERE id=$2',[JSON.stringify(result),id]);
    return {...result,duplicate:false};
  });
}
export async function template(kind: ImportKind) {
  const workbook=new ExcelJS.Workbook(), sheet=workbook.addWorksheet(kind==='catalog'?'Katalog':'Mal kabul');
  sheet.addRow(headers[kind]);
  sheet.addRow(kind==='catalog'?['ORNEK-01','Örnek ürün','',1,1,1,'000001',0.12,15,30]:['000001','A1',1]);
  sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};
  sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF103F45'}};
  sheet.columns.forEach((col,index)=>{col.width=22;if (['urun_kodu','barkod','raf'].includes(headers[kind][index])) col.numFmt='@';});
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
