import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
const H={Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/myLessons',Authorization:'Bearer '+T};
for(let id=1360;id<=1379;id++){
 const r=await fetch(B+'/videos/'+id,{headers:H,redirect:'manual'}); const t=await r.text();
 console.log(String(r.status).padEnd(4),'video',id,t.slice(0,90).replace(/\s+/g,' '));
 await new Promise(r=>setTimeout(r,800));
}
