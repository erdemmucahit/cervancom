import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { unstable_readConfig } from 'wrangler';

const config=unstable_readConfig({config:resolve('wrangler.toml')});
const runtimeOptions={compatibilityDate:config.compatibility_date,compatibilityFlags:config.compatibility_flags,host:'127.0.0.1',port:0};

const outfile=resolve('.cerplus/runtime-smoke/index.mjs');
await build({entryPoints:['cerplus/tests/cloudflare-runtime.worker.ts'],outfile,bundle:true,format:'esm',platform:'neutral',mainFields:['browser','module','main'],conditions:['workerd','worker','browser'],external:['node:*']});
const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:outfile,...runtimeOptions}));
try{
  const response=await runtime.dispatchFetch('http://localhost/runtime-smoke');
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.deepEqual(result,{scrypt:true,xlsx:true,xlsxRead:true});
  console.log('workerd: scrypt, ExcelJS XLSX üretme/okuma, ZIP ve şablon doğrulama geçti.');
}finally{await runtime.dispose();}

// Run the actual Pages bundle as well: catches unresolved pg / Node imports,
// while an absent real database must return a controlled setup response.
const pagesRuntime=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:resolve('.cerplus/cloudflare-build/index.js'),...runtimeOptions}));
try{
  const response=await pagesRuntime.dispatchFetch('https://cervanlojistik.com/cerplus/api/login/',{method:'POST'});
  assert.equal(response.status,503);
  const result=await response.json() as {error:string};assert.match(result.error,/henüz yapılandırılmadı/);
  console.log('workerd: gerçek Pages paketi yüklendi; eksik veritabanı bağlantısı kontrollü 503 döndürdü.');
}finally{await pagesRuntime.dispose();}
