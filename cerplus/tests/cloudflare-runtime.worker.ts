// Only bundled by the local smoke test; never a Pages route or production Worker.
import { passwordHash } from '../auth.ts';
import { template,checkXlsxZip,previewImport } from '../imports.ts';
import type { Database } from '../types.ts';
export default {
  async fetch() {
    try{
      const password=await passwordHash('LocalRuntimeTest!2026');
      const bytes=await template('catalog');checkXlsxZip(bytes);
      const brandId='b18f2b7a-c21a-4ffd-b58e-7d342b763cf8';
      // This smoke test isolates runtime compatibility, not database behavior.
      // Real SQL/transactions are covered separately against PostgreSQL.
      const db={query:async(sql:string)=>({rows:sql==='SELECT id FROM brands WHERE id=$1'?[{id:brandId}]:[]})} as unknown as Database;
      const preview=await previewImport(db,brandId,'catalog',bytes,{brandId});
      return Response.json({scrypt:password.startsWith('scrypt:'),xlsx:bytes.length>0,xlsxRead:preview.rowCount===1&&preview.errors.length===0});
    }catch(error){return Response.json({error:error instanceof Error?error.message:String(error)},{status:500});}
  },
};
