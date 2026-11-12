import fs from 'fs';
const HOST='https://ictfromabc.com/api';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const r=await fetch(HOST+'/login',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/auth/login'},body:JSON.stringify({phoneNumber:process.env.ICT_PHONE||'',password:process.env.ICT_PASS||'',visitorId:'CWUriseStUq30ANV6hIt',confidenceScore:0.97}),redirect:'manual'});
const t=await r.text(); const j=JSON.parse(t);
console.log('STATUS',r.status,'role=',j.role,'user.role=',j.user&&j.user.role,'token=',j.token&&j.token.split('|')[0]);
if(j.token){fs.writeFileSync('analysis/_live_token.json',JSON.stringify({token:j.token,role:j.role,user:j.user,course_id:j.course_id,at:new Date().toISOString()},null,2));}
