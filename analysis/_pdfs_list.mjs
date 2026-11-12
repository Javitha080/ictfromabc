import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
const H={Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/pastPapers',Authorization:'Bearer '+T};
for(const p of ['/pdfs/tute','/pdfs/lesson-pp','/pdfs/paper-book','/tutes','/papers','/model-papers','/practical-sessions']){
 const r=await fetch(B+p,{headers:H,redirect:'manual'}); const t=await r.text();
 console.log('\n==',p,r.status,t.slice(0,600).replace(/\s+/g,' '));
 await new Promise(r=>setTimeout(r,1000));
}
