const fs=require('fs');
const dirs=['js/current/_app/immutable/nodes','js/current/_app/immutable/chunks'];
const hits=[];
for(const d of dirs){
 for(const f of fs.readdirSync(d)){
  const p=d+'/'+f; const s=fs.readFileSync(p,'utf8');
  if(/register/.test(s)){
   const idx=[...s.matchAll(/register/g)].map(m=>m.index);
   hits.push([p,idx.length]);
  }
 }
}
console.log(hits);
