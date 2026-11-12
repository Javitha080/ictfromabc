import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const H={Accept:'application/json','User-Agent':UA,Authorization:'Bearer '+T,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/all-lessons'};
for(const id of [188,187,186,185,100,60,2,151]){
 const r=await fetch('https://ictfromabc.com/api/lessons/'+id,{headers:H,redirect:'manual'});
 const b=await r.text(); let vids='';
 try{const j=JSON.parse(b); if(j.videos) vids=' videos='+j.videos.map(v=>v.id).join(','); }catch{}
 console.log(String(r.status).padEnd(4),'lesson',String(id).padEnd(4),b.slice(0,90).replace(/\s+/g,' ')+vids);
 await new Promise(r=>setTimeout(r,900));
}
