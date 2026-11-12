const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api'; const p='0710000000';
const H={Accept:'application/json','Content-Type':'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/auth/register'};
let r=await fetch(B+'/request-otp-v2/'+p,{method:'POST',headers:H,body:'null',redirect:'manual'});
console.log('request-otp',r.status,(await r.text()).slice(0,800),'rl',r.headers.get('x-ratelimit-limit'),r.headers.get('x-ratelimit-remaining'));
await new Promise(r=>setTimeout(r,1200));
r=await fetch(B+'/validate-otp-v2/'+p,{method:'POST',headers:H,body:JSON.stringify({otp:'123456'}),redirect:'manual'});
console.log('validate-otp',r.status,(await r.text()).slice(0,800));
