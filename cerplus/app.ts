import { AppError, one, requireRole, textValue, uuid } from './types.ts';
import type { Database, Config } from './types.ts';
import { changePassword, checkOrigin, cookie, login, session } from './auth.ts';
import { insertProduct, listCatalog, lookupBarcode, normalizeProduct } from './catalog.ts';
import { adjustStock, getStock, listMovements, normalizeReceipt, receive, stockRows } from './inventory.ts';
import { commitImport, previewImport, template } from './imports.ts';
import { createUser, deactivateRack, saveEntity, toggleUser } from './management.ts';

export const securityHeaders: Record<string,string> = {
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY',
  'Referrer-Policy':'no-referrer', 'X-Robots-Tag':'noindex, nofollow',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
};
export async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new AppError('JSON içerik gerekli.',415);
  if (Number(request.headers.get('content-length')??0)>3*1024*1024) throw new AppError('İstek çok büyük.',413);
  const reader=request.body?.getReader();
  if (!reader) throw new AppError('İstek gövdesi gerekli.');
  const chunks:Uint8Array[]=[], decoder=new TextDecoder();let bytes=0;
  while (true) {
    const {value,done}=await reader.read();if(done)break;
    bytes+=value.length;
    if(bytes>3*1024*1024){await reader.cancel();throw new AppError('İstek çok büyük.',413);}
    chunks.push(value);
  }
  let body:any;
  try { body=JSON.parse(chunks.map(chunk=>decoder.decode(chunk,{stream:true})).join('')+decoder.decode()); }
  catch { throw new AppError('JSON okunamadı.'); }
  if (!body || Array.isArray(body) || typeof body!=='object') throw new AppError('Geçersiz istek.');
  return body;
}
export function createApp(db: Database, config: Config) {
  return async function handle(request: Request, ip = 'local'): Promise<Response> {
    const response=(data: unknown,status=200,headers: Record<string,string>={})=>Response.json(data,{status,headers:{...securityHeaders,...headers}});
    try {
      const url=new URL(request.url), path=url.pathname.replace(/^\/cerplus\/api/,'').replace(/\/$/,'')||'/';
      if (!url.pathname.startsWith('/cerplus/api/')) throw new AppError('Kayıt bulunamadı.',404);
      const method=request.method;
      if (!['GET','POST','PATCH','DELETE'].includes(method)) throw new AppError('Yöntem desteklenmiyor.',405);
      const dataset=(await one(db,"SELECT value FROM app_meta WHERE key='dataset'")).value;
      if (config.production && dataset==='development') throw new AppError('Geliştirme verisi üretimde kullanılamaz.',503);
      if (path==='/health' && method==='GET') return response({ok:true});
      if (method!=='GET') checkOrigin(request,config);
      if (path==='/login' && method==='POST') {
        const result=await login(db,await readJson(request),ip);
        return response({user:result.user,csrf:result.csrf},200,{'Set-Cookie':cookie(result.token,config)});
      }
      const auth=await session(db,request), user=auth.user;
      if (method!=='GET' && request.headers.get('x-csrf-token')!==auth.csrf) throw new AppError('Güvenlik anahtarı doğrulanamadı. Sayfayı yenileyin.',403);
      if (path==='/logout' && method==='POST') {
        await db.query('DELETE FROM sessions WHERE token_hash=$1',[auth.tokenHash]);
        return response({success:true},200,{'Set-Cookie':cookie('',config,true)});
      }
      if (path==='/password' && method==='POST') {
        const body=await readJson(request);await changePassword(db,user,body.currentPassword,body.password);
        return response({success:true},200,{'Set-Cookie':cookie('',config,true)});
      }
      if (path==='/bootstrap' && method==='GET') {
        if (user.role==='team') return response({user,csrf:auth.csrf,dataset,brands:[],dealers:[],sections:[],racks:[]});
        const brands=(await db.query('SELECT * FROM brands ORDER BY name')).rows;
        const dealers=(await db.query('SELECT * FROM dealers WHERE ($1::uuid IS NULL OR id=$1) ORDER BY name',[user.role==='dealer'?user.dealer_id:null])).rows;
        const sections=user.role==='dealer'?[]:(await db.query('SELECT * FROM sections ORDER BY code')).rows;
        const racks=user.role==='dealer'?[]:(await db.query(`SELECT r.*,s.code AS section,
          COALESCE((SELECT sum(st.physical*k.volume_m3) FROM stock st JOIN package_types k ON k.id=st.package_type_id WHERE st.rack_id=r.id),0)::text AS occupied_m3
          FROM racks r JOIN sections s ON s.id=r.section_id ORDER BY r.code`)).rows;
        return response({user,csrf:auth.csrf,dataset,brands,dealers,sections,racks});
      }
      if (path==='/catalog' && method==='GET') { requireRole(user,'admin','operations','dealer');return response(await listCatalog(db,url.searchParams.get('search')??'')); }
      if (path==='/catalog' && method==='POST') {
        requireRole(user,'admin','operations');const input=normalizeProduct(await readJson(request));
        return response(await db.transaction(tx=>insertProduct(tx,user.id,input)),201);
      }
      if (path==='/barcode' && method==='GET') {
        requireRole(user,'admin','operations');
        const matches=await lookupBarcode(db,url.searchParams.get('value')??'',url.searchParams.get('brandId')||undefined);
        return response({matches,ambiguous:matches.length>1});
      }
      if (path==='/stock' && method==='GET') {
        requireRole(user,'admin','operations','dealer');return response(await stockRows(db,user,url.searchParams.get('search')??'',url.searchParams.get('owner')??undefined));
      }
      if (/^\/stock\/[^/]+$/.test(path) && method==='GET') { requireRole(user,'admin','operations','dealer');return response(await getStock(db,user,path.split('/')[2])); }
      if (path==='/movements' && method==='GET') { requireRole(user,'admin','operations','dealer');return response(await listMovements(db,user)); }
      if (path==='/receipts' && method==='POST') {
        requireRole(user,'admin','operations');const body=await readJson(request), input=normalizeReceipt(body),key=uuid(body.idempotencyKey,'Gönderim anahtarı');
        return response(await db.transaction(tx=>receive(tx,user.id,input,`manual:${key}`)),201);
      }
      if (path==='/adjustments' && method==='POST') {requireRole(user,'admin','operations');return response(await adjustStock(db,user,await readJson(request)));}
      const importMatch=path.match(/^\/imports\/(catalog|receipt)\/(preview|template)$/);
      if (importMatch) {
        requireRole(user,'admin','operations');const kind=importMatch[1] as 'catalog'|'receipt';
        if (importMatch[2]==='template' && method==='GET') return new Response(await template(kind) as any,{headers:{...securityHeaders,'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="cerplus-${kind}.xlsx"`}});
        if (importMatch[2]==='preview' && method==='POST') {
          const body=await readJson(request);
          if (typeof body.fileBase64!=='string' || body.fileBase64.length>2800000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.fileBase64)) throw new AppError('Dosya içeriği geçersiz.');
          return response(await previewImport(db,user.id,kind,Buffer.from(body.fileBase64,'base64'),body));
        }
      }
      if (path==='/imports/commit' && method==='POST') { requireRole(user,'admin','operations');const body=await readJson(request);return response(await commitImport(db,user.id,body.id)); }
      if (path==='/users' && method==='GET') { requireRole(user,'admin');return response((await db.query('SELECT id,name,email,role,dealer_id,active FROM users ORDER BY name')).rows); }
      if (path==='/users' && method==='POST') {requireRole(user,'admin');return response(await createUser(db,user,await readJson(request)),201);}
      if (/^\/users\/[^/]+$/.test(path) && method==='PATCH') {requireRole(user,'admin');return response(await toggleUser(db,user,path.split('/')[2],(await readJson(request)).active));}
      const entityMatch=path.match(/^\/(dealers|sections|racks|brands)(?:\/([^/]+))?$/);
      if (entityMatch) {
        const entity=entityMatch[1] as 'dealers'|'sections'|'racks'|'brands',id=entityMatch[2];
        requireRole(user,...(entity==='brands'?['admin','operations'] as const:['admin'] as const));
        if (entity==='racks' && id && method==='DELETE') return response(await deactivateRack(db,user,id));
        if ((method==='POST' && !id) || (method==='PATCH' && id)) return response(await saveEntity(db,user,entity,await readJson(request),id),method==='POST'?201:200);
      }
      if (path==='/audit' && method==='GET') {
        requireRole(user,'admin');return response((await db.query(`SELECT a.*,u.name AS actor FROM audit_log a JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 100`)).rows);
      }
      throw new AppError('Kayıt bulunamadı.',404);
    } catch(error: any) {
      if (error instanceof AppError) return response({error:error.message},error.status);
      if (error?.code==='23505') return response({error:'Bu kod, barkod veya kayıt zaten mevcut. Verileri yenileyin.'},409);
      if (error?.code==='23503') return response({error:'İlişkili kayıt bulunamadı veya bu kayıt kullanımda.'},409);
      if (error?.code==='23514' || error?.code==='22003') return response({error:'Miktar veya kayıt değerleri geçersiz.'},400);
      if (['40P01','55P03','57014','40001'].includes(error?.code)) return response({error:'Eşzamanlı işlem nedeniyle tamamlanamadı. Verileri yenileyip tekrar deneyin.'},409);
      // Never return database details, credentials, queries or uploaded content.
      console.error('Cerplus request failed',error?.code??error?.name??'unknown');
      return response({error:'İşlem tamamlanamadı. Veritabanı bağlantısını ve migration durumunu kontrol edin.'},503);
    }
  };
}
