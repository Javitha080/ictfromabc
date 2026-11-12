import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com';
const H={Accept:'application/json','User-Agent':UA,Origin:B,Referer:B+'/admin/courses',Authorization:'Bearer '+T};
const paths=['/api/admin/courses/all','/api/admin/lessons/all','/api/admin/students/all','/api/admin/users/all','/api/admin/purchases/all','/api/admin/tutes/all','/api/admin/papers/all','/api/admin/events/all','/api/admin/insights/all','/api/admin/videos/all','/api/admin/courses/all?page=1'];
for(const p of paths){
 const r=await fetch(B+p,{headers:H,redirect:'manual'}); const t=await r.text();
 console.log(String(r.status).padEnd(4),p.padEnd(32),'loc='+(r.headers.get('location')||'-'),'|',t.slice(0,110).replace(/\s+/g,' '));
 await new Promise(r=>setTimeout(r,900));
}
console.log('--- login response headers (session?) ---');
const lr=await fetch(B+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':UA,Origin:B,Referer:B+'/auth/login'},body:JSON.stringify({phoneNumber:process.env.ICT_PHONE||'',password:process.env.ICT_PASS||'',visitorId:'CWUriseStUq30ANV6hIt',confidenceScore:0.97}),redirect:'manual'});
console.log(lr.status,[...lr.headers.entries()].map(([k,v])=>k+': '+v).join('\n'));
const j=await lr.json(); if(j.token) fs.writeFileSync('analysis/_live_token.json',JSON.stringify({token:j.token,role:j.role,at:new Date().toISOString()},null,2));
