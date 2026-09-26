import { randomUUID, timingSafeEqual } from 'node:crypto';

const prices = { cbc:450, fbs:180, hba1c:650, lipid:850, lft:750, kft:750, thyroid:800, urine:250, vitd:1200, b12:950, crp:600, ecg:350 };
const send = (res, status, data) => res.status(status).json(data);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Kolkata', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());

async function db(path, method='GET', data) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: { apikey:process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization:`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
    body:data && JSON.stringify(data)
  });
  if (!r.ok) throw Error(`Database ${r.status}`);
  return method === 'GET' ? r.json() : null;
}
async function post(url, body, headers={}) {
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  return r.ok ? 'sent' : 'failed';
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return send(res,503,{error:'Booking service is not configured.'});
  if (req.method === 'GET') {
    const a=Buffer.from(req.headers['x-staff-key']||''), b=Buffer.from(process.env.STAFF_ACCESS_KEY||'');
    if (!b.length || a.length!==b.length || !timingSafeEqual(a,b)) return send(res,401,{error:'Invalid staff access key.'});
    try { return send(res,200,{bookings:await db(`lab_bookings?date=eq.${today()}&select=id,name,tests,slot,status&order=created_at.desc&limit=100`)}); }
    catch { return send(res,503,{error:'Could not load bookings.'}); }
  }
  if (req.method !== 'POST') return send(res,405,{error:'Method not allowed.'});
  const p=req.body||{}, name=String(p.name||'').trim(), phone=String(p.phone||'').trim(), email=String(p.email||'').trim(), notes=String(p.notes||'').trim(), date=String(p.date||''), slot=String(p.slot||''), age=Number(p.age), selected=p.tests;
  if (p.website || name.length<2 || name.length>100 || !/^\+?[\d\s()-]{10,18}$/.test(phone) || email.length>200 || (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || notes.length>500 || !Number.isInteger(age) || age<0 || age>120 || !['Female','Male','Other','Prefer not to say'].includes(p.gender) || !Array.isArray(selected) || !selected.length || selected.length>12 || new Set(selected).size!==selected.length || selected.some(t=>!Object.hasOwn(prices,t)) || !Array.from({length:10},(_,i)=>`${String(i+7).padStart(2,'0')}:00`).includes(slot) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || date<today() || date>new Date(Date.now()+90*86400000).toISOString().slice(0,10) || p.consent!==true) return send(res,400,{error:'Please check patient details, tests, date and consent.'});
  const id=`LAB-${date.replaceAll('-','')}-${randomUUID().slice(0,8).toUpperCase()}`, total=selected.reduce((n,t)=>n+prices[t],0);
  try { await db('lab_bookings','POST',{id,name,phone,email,notes,age,gender:p.gender,date,slot,tests:selected,total,status:'requested',telegram_status:'pending',whatsapp_status:'pending'}); }
  catch { return send(res,503,{error:'Could not save booking. Please try again.'}); }
  const names={cbc:'Complete blood count',fbs:'Fasting blood sugar',hba1c:'HbA1c',lipid:'Lipid profile',lft:'Liver function test',kft:'Kidney function test',thyroid:'Thyroid profile',urine:'Urine routine',vitd:'Vitamin D',b12:'Vitamin B12',crp:'C-reactive protein',ecg:'ECG'}; const testNames=selected.map(t=>names[t]).join(', ');
  const lab=`New booking ${id}\nPatient: ${name}, ${age}, ${p.gender}\nPhone: ${phone}\nEmail: ${email||'—'}\nTests: ${testNames}\nRequested: ${date} ${slot}\nEstimated: ₹${total}\nNotes: ${notes||'—'}`;
  const patient=`${name}, booking ${id} for ${testNames} on ${date} at ${slot}. Estimated ₹${total}. The lab will confirm availability.`;
  const digits=phone.replace(/\D/g,'');
  const tg=process.env.TELEGRAM_BOT_TOKEN&&process.env.TELEGRAM_CHAT_ID ? post(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{chat_id:process.env.TELEGRAM_CHAT_ID,text:lab}) : Promise.resolve('not_configured');
  const wa=process.env.WHATSAPP_ACCESS_TOKEN&&process.env.WHATSAPP_PHONE_NUMBER_ID&&process.env.WHATSAPP_TEMPLATE_NAME ? post(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION||'v23.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{messaging_product:'whatsapp',to:digits.length===10?`91${digits}`:digits,type:'template',template:{name:process.env.WHATSAPP_TEMPLATE_NAME,language:{code:process.env.WHATSAPP_TEMPLATE_LANGUAGE||'en'},components:[{type:'body',parameters:[{type:'text',text:patient}]}]}},{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`}) : Promise.resolve('not_configured');
  const outcomes=await Promise.allSettled([tg,wa]);
  const notifications={telegram:outcomes[0].status==='fulfilled'?outcomes[0].value:'failed',whatsapp:outcomes[1].status==='fulfilled'?outcomes[1].value:'failed'};
  try { await db(`lab_bookings?id=eq.${id}`,'PATCH',{telegram_status:notifications.telegram,whatsapp_status:notifications.whatsapp}); } catch {}
  return send(res,201,{booking:{id,date,slot,total,status:'requested'},notifications});
}
