import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const H={'Accept':'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/admin/courses',Authorization:'Bearer '+T};
const paths=['/admins','/admin/user','/admin/dashboard','/admin/courses','/admin/lessons','/admin/videos','/admin/admins','/admin/all-admins','/admin/users/search/07','/admin/users/blocked','/admin/users/unverified-nic','/admin/insights','/admin/purchases/accepted','/admin/purchases/online','/admin/tutes','/admin/events','/admin/practical-sessions','/admin/reviews','/admin/tickets','/admin/zoom','/admin/tags','/admin/slips/pending','/admin/papers','/admin/past-papers/al','/admin/model-papers/marked'];
for(const p of paths){
  try{
    const r=await fetch('https://ictfromabc.com/api'+p,{headers:H,redirect:'manual'});
    const b=await r.text();
    console.log(String(r.status).padEnd(4),p.padEnd(34),b.slice(0,140).replace(/\s+/g,' '));
  }catch(e){console.log('ERR ',p,e.message);}
  await new Promise(r=>setTimeout(r,1100));
}
