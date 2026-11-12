import fs from 'fs';
const T=JSON.parse(fs.readFileSync('analysis/_live_token.json','utf8')).token;
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
const base={'Accept':'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/admin/courses',Authorization:'Bearer '+T};
const tests=[
 ['POST','/admin/videos',{}],['POST','/admin/courses',{}],['POST','/admin/lessons',{}],['POST','/admin/add-admin',{}],
 ['POST','/admin/admins/role',{}],['POST','/admin/courses/order',{}],['POST','/admin/tags',{}],['POST','/admin/past-papers',{}],
 ['POST','/admin/papers',{}],['POST','/admin/model-papers',{}],['POST','/admin/practical-sessions',{}],['POST','/admin/events',{}],
 ['POST','/admin/tutes',{}],['POST','/admin/tutes/csv',{}],['POST','/admin/tutes/package',{}],['POST','/admin/tutes/pdf',{}],
 ['POST','/admin/tutes/transfer',{}],['POST','/admin/tickets',{}],['POST','/admin/ticket-categories',{}],['POST','/admin/sms/send',{}],
 ['POST','/admin/sms/test',{}],['POST','/admin/sms/send-csv',{}],['POST','/admin/student-calls',{}],['POST','/admin/call-responses',{}],
 ['POST','/admin/purchases/999999',{}],['POST','/admin/new-year-purchases/999999',{}],['POST','/admin/event-purchases/999999/resend',{}],
 ['POST','/admin/event-tickets/XXXX/check',{}],['POST','/admin/zoom/',{}],['PATCH','/admin/videos/999999/toggle-status',{}],
 ['PATCH','/admin/users/999999',{}],['PATCH','/admin/practical-sessions/999999',{}],['PATCH','/admin/courses/999999/toggle-status-all',{}],
 ['PATCH','/admin/lessons/999999/toggle-status-all',{}],['PATCH','/admin/reviews/999999',{status:'x'}],['PATCH','/admin/tickets/999999/status',{}],
 ['PATCH','/admin/call-responses/999999/toggle-status',{}],['PATCH','/admin/papers/999999',{}],['PATCH','/admin/tutes/999999',{}],
 ['PUT','/admin/tags/999999',{}],['PUT','/admin/call-responses/999999',{}],['POST','/admin/papers/999999',{}],['POST','/admin/model-papers/999999',{}],
 ['POST','/admin/events/999999',{}],['POST','/admin/courses/999999',{_method:'PUT'}],['POST','/admin/lessons/999999',{}],['POST','/admin/videos/999999',{}]
];
const out=[];
for(const [m,p,body] of tests){
 const r=await fetch(B+p,{method:m,headers:{...base,'Content-Type':'application/json'},body:m==='GET'?undefined:JSON.stringify(body),redirect:'manual'});
 const t=await r.text();
 out.push({m,p,s:r.status,b:t.slice(0,160)});
 console.log(String(r.status).padEnd(4),m.padEnd(6),p.padEnd(45),t.slice(0,100).replace(/\s+/g,' '));
 await new Promise(r=>setTimeout(r,1050));
}
fs.writeFileSync('analysis/_admin_write_probe.json',JSON.stringify(out,null,2));
