(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const eur=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const cents=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Ungültiger Betrag');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Betrag muss positiv sein');return n};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const mstart=s=>s.slice(0,7)+'-01';
const shift=(m,n)=>{const d=new Date(m+'T12:00:00');d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'};
const monthLabel=m=>new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(m+'T12:00:00'));
const due=(m,d)=>{const last=new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate();return m.slice(0,8)+String(Math.min(d,last)).padStart(2,'0')};
const active=(r,m)=>r.active&&r.start_month<=m&&(!r.end_month||r.end_month>=m);
let busy=false;
async function user(){const {data:{user},error}=await db.auth.getUser();if(error)throw error;return user}
async function state(id){
 const [items,conf,tx,goals,reserves,plans,entries]=await Promise.all([
  read(db.from('kc_recurring_items').select('*').eq('user_id',id).order('created_at',{ascending:false})),
  read(db.from('kc_recurring_confirmations').select('recurring_id,plan_month,transaction_id').eq('user_id',id)),
  read(db.from('transactions').select('kind,amount_cents,booked_on,id').eq('user_id',id).order('booked_on',{ascending:false}).limit(10000)),
  read(db.from('savings_goals').select('id,saved_cents,status').eq('user_id',id)),
  read(db.from('kc_general_reserves').select('amount_cents').eq('user_id',id)),
  read(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',id)),
  read(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',id).not('plan_month','is',null))
 ]);
 const total=tx.reduce((s,t)=>s+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
 const allocated=goals.filter(g=>g.status==='active').reduce((s,g)=>s+Number(g.saved_cents),0);
 const reserve=reserves.reduce((s,g)=>s+Number(g.amount_cents),0);
 return {items,conf,tx,goals,plans,entries,total,allocated,reserve,free:total-allocated-reserve};
}
function forecast(s){
 const now=mstart(today()),paid=new Set(s.conf.map(c=>c.recurring_id+'|'+c.plan_month));
 const saved=new Set(s.entries.map(c=>c.goal_id+'|'+c.plan_month));
 let balance=s.total,reserved=s.allocated+s.reserve;
 const rows=[];
 for(let i=0;i<12;i++){
  const m=shift(now,i),initial=balance;
  let income=0,expense=0,saving=0;
  for(const r of s.items){
   if(!active(r,m)||paid.has(r.id+'|'+m))continue;
   if(r.kind==='income')income+=Number(r.amount_cents);else expense+=Number(r.amount_cents);
  }
  for(const p of s.plans){
   if(p.start_month>m||saved.has(p.goal_id+'|'+m))continue;
   if(!s.goals.some(g=>g.id===p.goal_id&&g.status==='active'))continue;
   saving+=Number(p.monthly_cents);
  }
  balance+=income-expense;reserved+=saving;
  rows.push({m,initial,income,expense,saving,balance,free:balance-reserved});
 }
 return rows;
}
function table(rows){return '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr><th>Monat</th><th>Start</th><th>Einnahmen</th><th>Ausgaben</th><th>Sparen</th><th>Endvermögen</th><th>Frei</th></tr></thead><tbody>'+rows.map(r=>`<tr style="border-top:1px solid #ccc;${r.free<0?'background:#fff1e9':''}"><td>${esc(monthLabel(r.m))}</td><td>${eur(r.initial)}</td><td>${eur(r.income)}</td><td>${eur(r.expense)}</td><td>${eur(r.saving)}</td><td><b>${eur(r.balance)}</b></td><td><b>${eur(r.free)}</b></td></tr>`).join('')+'</tbody></table></div><p class="muted">Prognose: ab heute, auf Basis der erfassten Buchungen und wiederkehrenden Beträge. Einmalige zukünftige Ausgaben, Änderungen bei Beträgen und weitere spontane Käufe sind nicht vorhersehbar. Bereits bestätigte Buchungen des aktuellen Monats sind im Startvermögen enthalten.</p>'}
function reload(){sessionStorage.setItem('kc-v14-tab','monthly');location.reload()}
function error(e){alert('KiesCheckIch: '+(e?.message||String(e)))}
async function render(){
 if(busy||document.getElementById('app')?.hidden)return;busy=true;
 const panel=document.getElementById('kc-v14-monthly');panel.innerHTML='<h2>📅 Monatsfinanzen</h2><p>Lade …</p>';
 try{
  const u=await user();if(!u)return;
  const s=await state(u.id),now=mstart(today()),paid=new Set(s.conf.map(c=>c.recurring_id+'|'+c.plan_month));
  const dueList=s.items.filter(r=>active(r,now)&&!paid.has(r.id+'|'+now)&&due(now,r.due_day)<=today());
  const forecastRows=forecast(s);
  panel.innerHTML=`<h2>📅 Monatsfinanzen</h2><p class="muted">Regelmäßige Einnahmen und Ausgaben – erst nach Bestätigung tatsächlich gebucht.</p>
  <h3>Aktuelles Vermögen: ${eur(s.total)}</h3><p>🎯 Sparziele: ${eur(s.allocated)} · 🏦 Rücklagen: ${eur(s.reserve)} · 🟢 Frei: <b>${eur(s.free)}</b></p>
  <h3>🔔 Jetzt fällig (${dueList.length})</h3>${dueList.length?dueList.map(r=>`<div class="item"><span>${r.kind==='income'?'➕':'➖'} <b>${esc(r.title)}</b><br><small>${esc(due(now,r.due_day))} · ${eur(r.amount_cents)}</small></span><button type="button" data-confirm="${r.id}">Buchung bestätigen</button></div>`).join(''):'<p class="muted">Keine offenen fälligen regelmäßigen Buchungen.</p>'}
  <h3>➕ Regelmäßige Buchung anlegen</h3>
  <form id="kc-v14-form"><label>Art<select name="kind"><option value="expense">Ausgabe</option><option value="income">Einnahme</option></select></label>
  <label>Bezeichnung<input name="title" maxlength="100" placeholder="z. B. Monatskarte" required></label>
  <label>Betrag (€)<input name="amount" inputmode="decimal" required placeholder="49,00"></label>
  <label>Kategorie<select name="category" required></select></label>
  <label>Monatlicher Buchungstag (1–31)<input name="day" type="number" min="1" max="31" value="1" required></label>
  <label>Beginn (Monat)<input name="start" type="month" value="${now.slice(0,7)}" required></label>
  <label>Ende (optional)<input name="end" type="month"></label>
  <button type="submit">Regelmäßige Buchung speichern</button></form>
  <h3>📋 Meine regelmäßigen Buchungen</h3>${s.items.length?s.items.map(r=>`<div class="item"><span><b>${esc(r.title)}</b> · ${r.kind==='income'?'+':'−'}${eur(r.amount_cents)}<br><small>${esc(r.category)} · Tag ${r.due_day} · ab ${esc(r.start_month.slice(0,7))}${r.end_month?' bis '+esc(r.end_month.slice(0,7)):''} · ${r.active?'Aktiv':'Pausiert'}</small></span><div><button class="secondary" data-toggle="${r.id}">${r.active?'Pausieren':'Aktivieren'}</button> <button class="secondary" data-remove="${r.id}">Löschen</button></div></div>`).join(''):'<p class="muted">Noch keine regelmäßigen Buchungen.</p>'}
  <h3>📊 Cashflow – nächste 12 Monate</h3>${table(forecastRows)}`;
  const f=panel.querySelector('#kc-v14-form'),cats=await read(db.from('transaction_categories').select('kind,name').eq('active',true).order('sort_order'));
  const setCats=()=>{f.elements.category.innerHTML=cats.filter(c=>c.kind===f.elements.kind.value).map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('')||'<option value="Sonstiges">Sonstiges</option>'};
  f.elements.kind.onchange=setCats;setCats();
  f.onsubmit=async e=>{
   e.preventDefault();try{
    const x=new FormData(f),start=x.get('start')+'-01',end=x.get('end')?x.get('end')+'-01':null;
    if(end&&end<start)throw Error('Ende darf nicht vor dem Beginn liegen');
    await read(db.from('kc_recurring_items').insert({user_id:u.id,kind:x.get('kind'),title:String(x.get('title')).trim(),amount_cents:cents(x.get('amount')),category:x.get('category'),due_day:Number(x.get('day')),start_month:start,end_month:end}));
    reload();
   }catch(err){error(err)}
  };
  panel.querySelectorAll('[data-confirm]').forEach(b=>b.onclick=async()=>{
   const r=s.items.find(x=>x.id===b.dataset.confirm);
   if(!confirm(`${r.title}: ${eur(r.amount_cents)} als ${r.kind==='income'?'Einnahme':'Ausgabe'} für ${monthLabel(now)} buchen?`))return;
   b.disabled=true;try{await read(db.rpc('kc_confirm_recurring',{p_id:r.id,p_month:now}));reload()}catch(err){b.disabled=false;error(err)}
  });
  panel.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=async()=>{const r=s.items.find(x=>x.id===b.dataset.toggle);try{await read(db.from('kc_recurring_items').update({active:!r.active}).eq('id',r.id).eq('user_id',u.id));reload()}catch(err){error(err)}});
  panel.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirm('Regelmäßige Buchung löschen? Bereits bestätigte Einnahmen/Ausgaben bleiben erhalten.'))return;try{await read(db.from('kc_recurring_items').delete().eq('id',b.dataset.remove).eq('user_id',u.id));reload()}catch(err){error(err)}});
 }catch(e){panel.innerHTML='<h2>Monatsfinanzen</h2><p role="alert">'+esc(e.message)+'</p>'}finally{busy=false}
}
function init(){
 const nav=document.querySelector('#app nav'),bookings=document.getElementById('bookings');
 if(!nav||!bookings)return;
 const button=document.createElement('button');button.dataset.tab='monthly';button.textContent='📅 Monatsfinanzen';nav.insertBefore(button,nav.querySelector('[data-tab="family"]'));
 const panel=document.createElement('section');panel.id='kc-v14-monthly';panel.className='tab card';panel.hidden=true;bookings.after(panel);
 // app.js uses onclick for navigation. Add an independent handler for the new tab.
 button.onclick=()=>{document.querySelectorAll('#app nav [data-tab]').forEach(b=>b.classList.toggle('active',b===button));document.querySelectorAll('#app .tab').forEach(t=>t.hidden=t!==panel);render()};
 if(sessionStorage.getItem('kc-v14-tab')==='monthly'){sessionStorage.removeItem('kc-v14-tab');setTimeout(()=>{if(!document.getElementById('app').hidden)button.click()},1500)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();