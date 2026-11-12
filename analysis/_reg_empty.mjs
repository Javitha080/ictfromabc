import fs from 'fs';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const fd=new FormData();
let r=await fetch('https://ictfromabc.com/api/register',{method:'POST',headers:{Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/auth/register'},body:fd,redirect:'manual'});
console.log(r.status, (await r.text()).slice(0,1200));
