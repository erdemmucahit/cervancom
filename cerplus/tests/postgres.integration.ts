import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { migrate } from '../migrate.ts';
import { claimAvailable } from '../inventory.ts';
import type { Database } from '../types.ts';

// Uses a unique schema in a dedicated test database; never uses DATABASE_URL.
test('real PostgreSQL: independent connections recheck stock after row-lock contention',{skip:!process.env.CERPLUS_TEST_DATABASE_URL,timeout:20000},async()=>{
  const pool=new pg.Pool({connectionString:process.env.CERPLUS_TEST_DATABASE_URL,max:4});
  const schema='cerplus_test_'+randomUUID().replaceAll('-','');
  const db:Database={
    async query(sql,params){const client=await pool.connect();try{await client.query(`SET search_path TO ${schema}`);return await client.query(sql,params);}finally{client.release();}},
    async transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');await client.query(`SET LOCAL search_path TO ${schema}`);const result=await fn(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}},
    close:()=>pool.end(),
  };
  try{
    await pool.query(`CREATE SCHEMA ${schema}`);await migrate(db);
    const dealer=randomUUID(),brand=randomUUID(),product=randomUUID(),packageId=randomUUID(),section=randomUUID(),rack=randomUUID(),stock=randomUUID();
    await db.query('INSERT INTO dealers(id,code,name) VALUES($1,$2,$3)',[dealer,'T','Test']);
    await db.query('INSERT INTO brands VALUES($1,$2)',[brand,'Test']);
    await db.query('INSERT INTO products(id,brand_id,code,model) VALUES($1,$2,$3,$4)',[product,brand,'T','Test']);
    await db.query('INSERT INTO package_types VALUES($1,$2,$3,1,1,1,$4,0.1,1)',[packageId,product,brand,'T']);
    await db.query('INSERT INTO sections VALUES($1,$2,$3)',[section,'T','Test']);
    await db.query('INSERT INTO racks(id,section_id,code) VALUES($1,$2,$3)',[rack,section,'T']);
    await db.query("INSERT INTO stock(id,rack_id,package_type_id,owner_key,physical) VALUES($1,$2,$3,'common',1)",[stock,rack,packageId]);
    let release!:()=>void,claimed!:()=>void;
    const acquired=new Promise<void>(resolve=>{claimed=resolve;}),hold=new Promise<void>(resolve=>{release=resolve;});
    const first=db.transaction(async tx=>{await claimAvailable(tx,dealer,[{stockId:stock,quantity:1}]);claimed();await hold;});
    await acquired;
    const second=db.transaction(tx=>claimAvailable(tx,dealer,[{stockId:stock,quantity:1}]));
    // Observe an actual blocked UPDATE, rather than relying on scheduler timing.
    let blocked=false;
    for(let i=0;i<100;i++){
      const activity=await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'UPDATE stock SET reserved%' AND pid<>pg_backend_pid()");
      if(activity.rows.length){blocked=true;break;}
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    release();await first;await assert.rejects(()=>second,/stok yetersiz/);assert.equal(blocked,true);
    const final=(await db.query('SELECT physical,reserved FROM stock WHERE id=$1',[stock])).rows[0];assert.deepEqual(final,{physical:1,reserved:1});
  }finally{await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await pool.end();}
});
