import { createApp, securityHeaders } from '../../../cerplus/app.ts';
import { postgresDatabase } from '../../../cerplus/db-postgres.ts';

interface Context {
  request: Request;
  env: { HYPERDRIVE?: { connectionString:string }; CERPLUS_ORIGIN?:string };
  waitUntil(promise:Promise<unknown>):void;
}
export async function onRequest(context: Context) {
  const {env,request}=context;
  if (!env.HYPERDRIVE || !env.CERPLUS_ORIGIN?.startsWith('https://'))
    return Response.json({error:'Cerplus henüz yapılandırılmadı. PostgreSQL, Hyperdrive ve uygulama adresi kurulmalı.'},{status:503,headers:securityHeaders});
  const db=postgresDatabase(env.HYPERDRIVE.connectionString);
  try {return await createApp(db,{origin:env.CERPLUS_ORIGIN,production:true})(request,request.headers.get('CF-Connecting-IP')||'unknown');}
  finally {context.waitUntil(db.close());}
}
