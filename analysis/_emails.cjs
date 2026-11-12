const fs=require('fs'),path=require('path');
const roots=['js/current','analysis/pretty','bundles','userpannel','ict-toolkit'];
const re=/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const found=new Map();
function walk(p){let st;try{st=fs.statSync(p)}catch{return}if(st.isDirectory()){for(const f of fs.readdirSync(p))walk(path.join(p,f));}else if(/\.(js|json|html|txt|md)$/.test(p)){let s;try{s=fs.readFileSync(p,'utf8')}catch{return}for(const m of s.matchAll(re)){const e=m[0];if(!/\.(png|jpg|jpeg|webp|svg|css|js|woff|ttf)$/i.test(e)&&!e.includes('svelte')&&!e.includes('example')&&!e.includes('w3.org')){if(!found.has(e))found.set(e,[]);found.get(e).push(p)}}}}
for(const r of roots)walk(r);
for(const [e,ps] of [...found].sort()) console.log(e,'  <-',ps.slice(0,3).join(', '));
