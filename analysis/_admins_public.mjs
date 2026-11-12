const r=await fetch('https://ictfromabc.com/api/admins',{headers:{Accept:'application/json'}});
const j=await r.json();
console.log(JSON.stringify(j,null,2).slice(0,4000));
