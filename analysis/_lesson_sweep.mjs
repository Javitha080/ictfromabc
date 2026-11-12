import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const H={Accept:'application/json','User-Agent':UA,Authorization:'Bearer '+T,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/dashboard/all-lessons'};
const all=await (await fetch('https://ictfromabc.com/api/lessons',{headers:H})).json();
const arr=Array.isArray(all)?all:all.lessons||[];
const out=[];
for(const l of arr){
 const r=await fetch('https://ictfromabc.com/api/lessons/'+l.id,{headers:H,redirect:'manual'});
 let j=null; const b=await r.text(); try{j=JSON.parse(b)}catch{}
 out.push({id:l.id,title:l.title,status:r.status,course_id:l.course_id,msg:j&&(j.message||j.msg),videos:j&&j.videos?j.videos.map(v=>v.id):null});
 console.log(r.status,l.id,String(l.title).slice(0,40),j&&j.videos?('vids='+j.videos.length):(j&&(j.message||j.msg)||''));
 await new Promise(r=>setTimeout(r,1000));
}
fs.writeFileSync('analysis/_lesson_sweep.json',JSON.stringify(out,null,2));
console.log('DONE',out.filter(x=>x.status===200).length,'accessible of',out.length);
