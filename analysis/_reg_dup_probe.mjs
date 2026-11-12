const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const B='https://ictfromabc.com/api';
async function reg(f,label){
 const fd=new FormData(); for(const k in f) if(f[k]!==undefined&&f[k]!==null) fd.append(k,f[k]);
 const r=await fetch(B+'/register',{method:'POST',headers:{Accept:'application/json','User-Agent':UA,Origin:'https://ictfromabc.com',Referer:'https://ictfromabc.com/auth/register'},body:fd,redirect:'manual'});
 console.log(label,r.status,(await r.text()).slice(0,900));
}
const base={firstName:'REDACTED_NAME',lastName:'REDACTED_NAME',birthday:'REDACTED_BIRTHDAY',school:'REDACTED_SCHOOL',address:'REDACTED_ADDRESS',email:'REDACTED_EMAIL',phoneNumber:'REDACTED_PHONE',whatsappNumber:'REDACTED_PHONE',telegramNumber:'REDACTED_PHONE',courseId:'2027-al',district:'Colombo',password:'TestPass123#',password_confirmation:'TestPass123#',medium:'S',nearestCity:'homagama',instituteId:'2',idNumber:'200812345678'};
await reg(base,'dup phone+email no otp:');
await new Promise(r=>setTimeout(r,1200));
await reg({...base,email:'newmail'+Date.now()+'@example.com'},'dup phone new email no otp:');
