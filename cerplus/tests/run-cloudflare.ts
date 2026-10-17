import { build } from 'esbuild';
import { Miniflare,convertV4MiniflareOptions } from 'miniflare';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const outfile=resolve('.cerplus/runtime-smoke/index.mjs');
await build({entryPoints:['cerplus/tests/cloudflare-runtime.worker.ts'],outfile,bundle:true,format:'esm',platform:'neutral',mainFields:['browser','module','main'],conditions:['workerd','worker','browser'],external:['node:*']});
const runtime=new Miniflare(convertV4MiniflareOptions({modules:true,scriptPath:outfile,compatibilityDate:'2026-10-17',compatibilityFlags:['nodejs_compat'],host:'127.0.0.1',port:0}));
try{
  const response=await runtime.dispatchFetch('http://localhost/runtime-smoke');
  const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));assert.deepEqual(result,{scrypt:true,xlsx:true,xlsxRead:true});
  console.log('workerd: scrypt, ExcelJS XLSX üretme/okuma, ZIP ve şablon doğrulama geçti.');
}finally{await runtime.dispose();}
