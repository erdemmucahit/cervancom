import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,relative,isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { localDatabase } from '../db-local.ts';
import { migrate } from '../migrate.ts';
import { seedDevelopment,demoPassword } from '../seed.ts';
import { cerplusApiUrl } from '../../src/scripts/cerplus-api.ts';

const development=process.argv.includes('--dev');

const testRoot=resolve('.cerplus/http-tests');await mkdir(testRoot,{recursive:true});
const directory=await mkdtemp(resolve(testRoot,'run-'));
const db=await localDatabase(directory);try{await migrate(db);await seedDevelopment(db);}finally{await db.close();}
const unusedPort=()=>new Promise<number>((done,reject)=>{const socket=createServer();socket.on('error',reject);socket.listen(0,'127.0.0.1',()=>{const address=socket.address();if(!address||typeof address==='string')return reject(new Error('Port seçilemedi.'));socket.close(()=>done(address.port));});});
const port=await unusedPort();
let frontendPort=development?await unusedPort():port;
while(development&&frontendPort===port)frontendPort=await unusedPort();
const origin=`http://127.0.0.1:${frontendPort}`;
const apiUrl=(path:string)=>origin+cerplusApiUrl(path);
const child=spawn(process.execPath,['cerplus/server.ts',...(development?[]:['--static'])],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,DATABASE_URL:'',CERPLUS_MODE:'development',CERPLUS_DATA_DIR:directory,CERPLUS_PORT:String(port),CERPLUS_ORIGIN:origin}});
let frontend:{stop():Promise<void>}|undefined;
try{
  await new Promise<void>((done,reject)=>{const timeout=setTimeout(()=>reject(new Error('HTTP sunucusu zamanında başlamadı.')),15000);child.on('error',reject);child.on('exit',()=>reject(new Error('HTTP sunucusu erken kapandı.')));child.stdout.on('data',()=>{clearTimeout(timeout);done();});});
  if(development){
    const {dev}=await import('astro');
    frontend=await dev({logLevel:'error',server:{host:'127.0.0.1',port:frontendPort},vite:{server:{strictPort:true,proxy:{'/cerplus/api':{target:`http://127.0.0.1:${port}`,changeOrigin:false}}}}});
  }
  const site=await fetch(origin+'/');assert.equal(site.status,200);assert.match(await site.text(),/Cerplus/);
  const page=await fetch(origin+'/cerplus/');assert.equal(page.status,200);if(!development)assert.match(page.headers.get('content-security-policy')! ,/script-src 'self'/);
  const markup=await page.text(),script=markup.match(/<script[^>]+src="([^" ]+)"/);assert.ok(script);
  assert.equal((await fetch(origin+script[1])).status,200);
  const initial=await fetch(apiUrl('/bootstrap'));assert.equal(initial.status,401);assert.match(initial.headers.get('content-type')!,/application\/json/);
  const login=await fetch(apiUrl('/login'),{method:'POST',redirect:'manual',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'admin@cerplus.test',password:demoPassword})});assert.equal(login.status,200);
  const credentials=await login.json(),cookie=login.headers.get('set-cookie')!.split(';')[0];
  const headers={cookie,origin,'content-type':'application/json','x-csrf-token':credentials.csrf};
  const bootstrap=await fetch(apiUrl('/bootstrap'),{headers});assert.equal(bootstrap.status,200);const meta=await bootstrap.json();
  const list=await fetch(apiUrl('/stock?search=&owner='),{headers});assert.equal(list.status,200);const stock=await list.json();assert.ok(stock.length);
  const template=await fetch(apiUrl('/imports/catalog/template'),{headers});assert.equal(template.status,200);assert.match(template.headers.get('content-type')!,/spreadsheetml/);
  const line=stock[0],reference='HTTP-TEST-'+randomUUID();
  const receipt={reference,ownerKey:'common',idempotencyKey:randomUUID(),lines:[{packageTypeId:line.package_type_id,rackId:meta.racks[7].id,quantity:1}]};
  const accepted=await fetch(apiUrl('/receipts'),{method:'POST',headers,body:JSON.stringify(receipt)});assert.equal(accepted.status,201);assert.equal((await accepted.json()).duplicate,false);
  const replay=await fetch(apiUrl('/receipts'),{method:'POST',headers,body:JSON.stringify(receipt)});assert.equal(replay.status,201);assert.equal((await replay.json()).duplicate,true);
  const history=await fetch(apiUrl('/movements'),{headers});assert.equal(history.status,200);assert.ok((await history.json()).some((row:any)=>row.reference===reference));
  const logout=await fetch(apiUrl('/logout'),{method:'POST',headers,body:'{}'});assert.equal(logout.status,200);
  assert.equal((await fetch(apiUrl('/stock'),{headers:{cookie}})).status,401);
  console.log(`HTTP ${development?'Astro dev + API':'statik site + API'}: sayfa/JS, ilk oturum kontrolü, giriş, stok filtresi, XLSX şablonu, mal kabul, tekrar koruması ve çıkış geçti.`);
}finally{
  await frontend?.stop();
  const stopped=new Promise<void>(done=>child.once('exit',()=>done()));if(child.exitCode===null){child.kill('SIGTERM');await stopped;}
  const childPath=relative(testRoot,resolve(directory));if(!childPath||childPath.startsWith('..')||isAbsolute(childPath))throw new Error('Test dizini güvenli sınırın dışında; silinmedi.');
  await rm(directory,{recursive:true,force:true});
}
