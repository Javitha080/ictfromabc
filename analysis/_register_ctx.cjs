const fs=require('fs');
const s=fs.readFileSync('js/current/_app/immutable/nodes/59.J3VPFEjb.js','utf8');
// print segments around 'register' occurrences and form fields
const kws=['register(','role','admin','phoneNumber','first_name','last_name','id_number','institute_id','visitorId','confidenceScore','FormData','password'];
for(const k of kws){let i=-1,c=0;while((i=s.indexOf(k,i+1))>=0&&c<4){console.log('\n### '+k+' @'+i+'\n'+s.slice(Math.max(0,i-350),i+450));c++;}}
