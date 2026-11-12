const fs=require('fs');
const dir='js/current/_app/immutable';
function walk(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=d+'/'+f.name;if(f.isDirectory())walk(p);else{const s=fs.readFileSync(p,'utf8');if(/toggle-status-all|toggle-status|admin\/purchases/.test(s)){console.log('\n=== '+p);for(const kw of ['toggle-status-all','toggle-status','admin/purchases']){let i=-1;while((i=s.indexOf(kw,i+1))>=0){console.log('--- '+kw+' @'+i+'\n'+s.slice(Math.max(0,i-500),i+500));}}}}}}
walk(dir);
