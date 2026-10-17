import EmbeddedPostgres from 'embedded-postgres';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdir,mkdtemp,rm } from 'node:fs/promises';
import { resolve,relative,isAbsolute } from 'node:path';
import { spawn } from 'node:child_process';

const testRoot=resolve('.cerplus/pg-tests');await mkdir(testRoot,{recursive:true});
const directory=await mkdtemp(resolve(testRoot,'run-'));
const port=await new Promise<number>((done,reject)=>{const socket=createServer();socket.on('error',reject);socket.listen(0,'127.0.0.1',()=>{const address=socket.address();if(!address||typeof address==='string')return reject(new Error('Port seçilemedi.'));socket.close(()=>done(address.port));});});
const password=randomBytes(24).toString('hex');
const instance=new EmbeddedPostgres({databaseDir:directory,user:'cerplus_test',password,port,persistent:true,
  authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],
  onLog:()=>{},onError:()=>{},createPostgresUser:false,
});
let started=false;
try{
  await instance.initialise();await instance.start();started=true;
  console.log('Yalnızca loopback üzerinde geçici PostgreSQL 18 hazır.');
  const code=await new Promise<number>((done,reject)=>{
    const child=spawn(process.execPath,['--test','cerplus/tests/foundation.test.ts','cerplus/tests/postgres.integration.ts'],{stdio:'inherit',env:{...process.env,CERPLUS_TEST_DATABASE_URL:`postgresql://cerplus_test:${password}@127.0.0.1:${port}/postgres`},windowsHide:true});
    child.on('error',reject);child.on('exit',code=>done(code??1));
  });
  if(code!==0)process.exitCode=code;
}finally{
  if(started)await instance.stop();
  // Only delete the newly generated test directory after verifying its boundary.
  const childPath=relative(testRoot,resolve(directory));
  if(!childPath||childPath.startsWith('..')||isAbsolute(childPath))throw new Error('Test dizini güvenli sınırın dışında; silinmedi.');
  await rm(directory,{recursive:true,force:true});
}
