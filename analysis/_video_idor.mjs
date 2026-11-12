import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
const H={Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/myLessons',Authorization:'Bearer '+T};
for(const id of [1,2,10,50,100,200,500,800,1000,1155,1200,1300,1380,1390,1400]){
 const r=await fetch(B+'/videos/'+id,{headers:H,redirect:'manual'}); const t=await r.text();
 console.log(String(r.status).padEnd(4),'video',String(id).padEnd(5),t.slice(0,120).replace(/\s+/g,' '));
 await new Promise(r=>setTimeout(r,900));
}
console.log('--- generate-token arbitrary ---');
for(const id of [1,2,100,500,1000,1390]){
 const r=await fetch(B+'/videos/'+id+'/generate-token',{headers:H,redirect:'manual'}); const t=await r.text();
 console.log(String(r.status).padEnd(4),'tok',String(id).padEnd(5),t.slice(0,120));
 await new Promise(r=>setTimeout(r,900));
}
