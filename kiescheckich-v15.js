(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const cents=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte einen gültigen Betrag eingeben');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<0)throw Error('Ungültiger Betrag');return n};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const month=s=>s.slice(0,7)+'-01';
const plus=(s,n)=>{const d=new Date(s+'T12:00:00');d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'};
const monthText=m=>new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(m+'T12:00:00'));
const dateText=d=>d?new Intl.DateTimeFormat('de-DE').format(new Date(d+'T12:00:00')):'Ohne Wunschdatum';
async function getUser(){const {data:{user},error}=await db.auth.getUser();if(error)throw error;return user}
function message(e){alert('KiesCheckIch: '+(e?.message||String(e)))}
function init(){
 const form=document.getElementById('goalForm');if(!form)return;
 const label=document.createElement('label');label.textContent='Bis wann möchtest du das Ziel erreichen? (optional)';
 const input=document.createElement('input');input.type='date';input.name='target_date';label.appendChild(input);
 form.insertBefore(label,form.querySelector('button'));
 // Capture on document runs before the V1.3 form handler and ensures target_date is saved.
 document.addEventListener('submit',async e=>{
  if(e.target!==form)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{
   const f=new FormData(form),u=await getUser();if(!u)throw Error('Bitte anmelden');
   const title=String(f.get('title')||'').trim(),target=cents(f.get('target')),saved=cents(f.get('saved')||'0'),deadline=f.get('target_date')||null;
   if(!title||target<=0)throw Error('Bitte Sparziel und positiven Zielbetrag angeben');
   if(deadline&&deadline<today())throw Error('Das Wunschdatum liegt in der Vergangenheit');
   const [tx,goals,reserve]=await Promise.all([
    read(db.from('transactions').select('kind,amount_cents').eq('user_id',u.id).limit(10000)),
    read(db.from('savings_goals').select('saved_cents,status').eq('user_id',u.id)),
    read(db.from('kc_general_reserves').select('amount_cents').eq('user_id',u.id))
   ]);
   const balance=tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
   const free=balance-goals.filter(g=>g.status==='active').reduce((n,g)=>n+Number(g.saved_cents),0)-reserve.reduce((n,r)=>n+Number(r.amount_cents),0);
   if(saved>free)throw Error('Startbetrag übersteigt das freie Vermögen');
   await read(db.from('savings_goals').insert({user_id:u.id,title,target_cents:target,saved_cents:saved,target_date:deadline,priority:'medium'}));
   sessionStorage.setItem('kc-v13-tab','savings');location.reload();
  }catch(err){message(err)}
 },true);
 document.querySelector('[data-tab="savings"]')?.addEventListener('click',()=>setTimeout(renderGoals,500));
 document.querySelector('[data-tab="monthly"]')?.addEventListener('click',()=>setTimeout(renderMonthly,550));
 const monthly=document.getElementById('kc-v14-monthly');
 if(monthly){
  const observer=new MutationObserver(()=>{if(!monthly.hidden&&!monthly.querySelector('#kc-v15-goals'))setTimeout(renderMonthly,50)});
  observer.observe(monthly,{childList:true});
 }
 setTimeout(()=>{if(!document.getElementById('app')?.hidden){renderGoals();if(!monthly?.hidden)renderMonthly()}},2200);
}
async function data(){
 const u=await getUser();if(!u)return null;
 const [goals,plans,entries]=await Promise.all([
  read(db.from('savings_goals').select('id,title,target_cents,saved_cents,target_date,status').eq('user_id',u.id)),
  read(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',u.id)),
  read(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',u.id).not('plan_month','is',null))
 ]);
 return {u,goals:goals.filter(g=>g.status==='active'),plans,entries};
}
function projection(g,p,entries){
 const current=month(today()),deadline=g.target_date;
 const remaining=Math.max(0,Number(g.target_cents)-Number(g.saved_cents));
 if(!deadline)return {remaining,monthly:null,status:'Bitte Wunschdatum festlegen'};
 if(remaining===0)return {remaining,monthly:0,status:'🟢 Sparziel bereits erreicht'};
 const end=month(deadline);
 let months=0,m=current;
 while(m<=end&&months<240){months++;m=plus(m,1)}
 if(end<current)return {remaining,monthly:null,status:'🔴 Wunschdatum überschritten'};
 const monthly=Math.ceil(remaining/months);
 if(!p)return {remaining,monthly,status:'🟡 Noch kein monatlicher Sparplan'};
 const paid=new Set(entries.map(x=>x.goal_id+'|'+x.plan_month));
 let projected=Number(g.saved_cents),n=0;
 for(let m=current;m<=end&&n++<240;m=plus(m,1)){
  if(m<p.start_month||paid.has(g.id+'|'+m))continue;
  if(m===current&&Number(today().slice(8))>Number(p.due_day))continue;
  if(m===end&&Number(deadline.slice(8))<Number(p.due_day))continue;
  projected+=Number(p.monthly_cents);
 }
 return {remaining,monthly,status:projected>=Number(g.target_cents)?'🟢 Mit deinem Sparplan voraussichtlich erreichbar':'🟠 Mit dem Sparplan voraussichtlich nicht erreichbar',projected};
}
let goalsBusy=false;
async function renderGoals(){
 if(goalsBusy||document.getElementById('app')?.hidden)return;goalsBusy=true;
 try{
  const d=await data();if(!d)return;
  const root=document.getElementById('kc-v13-savings');if(!root)return;
  root.querySelectorAll('.kc-v15-date').forEach(x=>x.remove());
  const pm=new Map(d.plans.map(p=>[p.goal_id,p]));
  const cards=[...root.querySelectorAll('[data-abandon]')];
  for(const b of cards){
   const g=d.goals.find(g=>g.id===b.dataset.abandon);if(!g)continue;
   const q=projection(g,pm.get(g.id),d.entries);
   const el=document.createElement('div');el.className='kc-v15-date';
   el.innerHTML=`<p><b>📅 Wunschdatum: ${esc(dateText(g.target_date))}</b><br>Bis zum Ziel fehlen ${euro(q.remaining)}.<br>${q.monthly===null?'':`Erforderlich: etwa ${euro(q.monthly)} pro Monat.<br>`}${esc(q.status)}</p><form data-deadline="${g.id}"><label>Wunschdatum ändern<input type="date" name="date" value="${esc(g.target_date||'')}" required></label><button type="submit" class="secondary">Datum speichern</button></form>`;
   b.before(el);
   el.querySelector('form').onsubmit=async e=>{e.preventDefault();try{
    const date=new FormData(e.target).get('date');
    if(!date)throw Error('Bitte Datum auswählen');
    await read(db.from('savings_goals').update({target_date:date}).eq('id',g.id).eq('user_id',d.u.id));
    await renderMonthly();el.querySelector('p').textContent='Datum gespeichert. Bitte Ansicht aktualisieren.'; 
   }catch(err){message(err)}};
  }
 }catch(e){message(e)}finally{goalsBusy=false}
}
let monthlyBusy=false;
async function renderMonthly(){
 if(monthlyBusy||document.getElementById('app')?.hidden)return;monthlyBusy=true;
 try{
  const root=document.getElementById('kc-v14-monthly');if(!root||root.hidden)return;
  const d=await data();if(!d)return;
  root.querySelector('#kc-v15-goals')?.remove();
  const el=document.createElement('section');el.id='kc-v15-goals';
  const pm=new Map(d.plans.map(p=>[p.goal_id,p]));
  el.innerHTML='<h3>🎯 Sparziele im Monatsplan</h3><p class="muted">Sparraten sind Geldreservierungen, keine Ausgaben. Die Cashflow-Tabelle oben berücksichtigt bestehende monatliche Sparpläne.</p>'+
   (d.goals.length?d.goals.map(g=>{const q=projection(g,pm.get(g.id),d.entries);
    return `<div class="item" style="display:block"><b>${esc(g.title)}</b> · Ziel ${euro(g.target_cents)}<p>Bereits gespart: ${euro(g.saved_cents)} · Offen: ${euro(q.remaining)}<br>Wunschdatum: ${esc(dateText(g.target_date))}<br>${q.monthly===null?'':`Nötige Monatsrate: ${euro(q.monthly)}<br>`}Aktueller Sparplan: ${pm.has(g.id)?euro(pm.get(g.id).monthly_cents)+' / Monat':'Keiner'}<br><b>${esc(q.status)}</b></p></div>`;
   }).join(''):'<p class="muted">Noch keine aktiven Sparziele.</p>');
  const tableHeader=[...root.querySelectorAll('h3')].find(h=>h.textContent.includes('Cashflow'));
  if(tableHeader)tableHeader.before(el);else root.appendChild(el);
 }catch(e){message(e)}finally{monthlyBusy=false}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();