import { randomUUID } from 'node:crypto';
import { openDatabase } from './environment.ts';
import { migrate } from './migrate.ts';
import { demoPassword, seedDevelopment } from './seed.ts';
import { emailValue,passwordHash } from './auth.ts';
import { audit,textValue } from './types.ts';

const db=await openDatabase();
try {
  const command=process.argv[2];
  if (command==='migrate') { await migrate(db);console.log('Cerplus migration’ları uygulandı.'); }
  else if (command==='seed') {
    const result=await seedDevelopment(db,process.env.CERPLUS_MODE==='production');
    console.log(result.duplicate?'Geliştirme örnekleri zaten mevcut; değiştirilmedi.':`YALNIZCA GELİŞTİRME verileri yüklendi.\nadmin@cerplus.test / ${demoPassword}\nDiğer hesaplar: ofis, ekip, bayia, bayib @cerplus.test (aynı geliştirme parolası).`);
  } else if(command==='admin') {
    const email=emailValue(process.env.CERPLUS_ADMIN_EMAIL), name=textValue(process.env.CERPLUS_ADMIN_NAME,'Admin adı'), password=await passwordHash(process.env.CERPLUS_ADMIN_PASSWORD??'');
    await db.transaction(async tx=>{
      await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      if ((await tx.query('SELECT count(*)::int AS count FROM users')).rows[0].count) throw new Error('İlk admin zaten kurulmuş. Yeni kullanıcıyı admin ekranından oluşturun.');
      const id=randomUUID();
      await tx.query("INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,'admin')",[id,name,email,password]);
      await tx.query("UPDATE app_meta SET value='operational' WHERE key='dataset'");
      await audit(tx,id,'user.bootstrap',id,null,{email,name,role:'admin'});
    });
    console.log('İlk admin oluşturuldu. Kurulum parola değişkenini ortamdan kaldırın.');
  } else throw new Error('Komut: migrate | seed | admin');
} catch(error) {console.error(error instanceof Error?error.message:'Kurulum tamamlanamadı.');process.exitCode=1;}
finally {await db.close();}
