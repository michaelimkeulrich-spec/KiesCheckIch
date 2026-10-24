(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const eur=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','&quot;':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const query=async p=>{const {data,error}=await p;if(error)throw error;return data};
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const month=s=>s.slice(0,7)+'-01';
const addMonth=(m,n)=>{const d=new Date(m+'T12:00:00');d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'};
const monthName=m=>new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(m+'T12:00:00'));
const dateName=d=>d?new Intl.DateTimeFormat('de-DE').format(new Date(d+'T12:00:00')):'Kein Wunschdatum';
const active=(r,m)=>r.active&&r.start_month<=m&&(!r.end_month||r.end_month>=m);
let request=0;
async function load(){
 const {data:{user},error}=await db.auth.getUser();if(error)throw error;if(!user)throw Error('Bitte zuerst anmelden.');
 const id=user.id;
 const [recurring,confirmed,tx,goals,reserves,plans,entries]=await Promise.all([
  query(db.from('kc_recurring_items').select('id,kind,amount_cents,start_month,end_month,active').eq('user_id',id)),
  query(db.from('kc_recurring_confirmations').select('recurring_id,plan_month').eq('user_id',id)),
  query(db.from('transactions').select('kind,amount_cents').eq('user_id',id).limit(10000)),
  query(db.from('savings_goals').select('id,title,target_cents,saved_cents,target_date,status').eq('user_id',id)),
  query(db.from('kc_general_reserves').select('amount_cents').eq('user_id',id)),
  query(db.from('kc_savings_plans').select('goal_id,monthly_cents,start_month,due_day').eq('user_id',id)),
  query(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',id).not('plan_month','is',null))
 ]);
 return {recurring,confirmed,tx,goals:goals.filter(g=>g.status==='active'),reserves,plans,entries};
}
function build(s){
 const confirmed=new Set(s.confirmed.map(x=>x.recurring_id+'|'+x.plan_month));
 const saved=new Set(s.entries.map(x=>x.goal_id+'|'+x.plan_month));
 const total=s.tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
 const goalReserved=s.goals.reduce((n,g)=>n+Number(g.saved_cents),0);
 const reserves=s.reserves.reduce((n,r)=>n+Number(r.amount_cents),0);
 let balance=total,held=goalReserved+reserves;
 const now=month(today()),rows=[];
 for(let i=0;i<12;i++){
  const m=addMonth(now,i),start=balance;let income=0,expense=0,saving=0;
  for(const r of s.recurring){if(!active(r,m)||confirmed.has(r.id+'|'+m))continue;if(r.kind==='income')income+=Number(r.amount_cents);else expense+=Number(r.amount_cents)}
  for(const p of s.plans){if(p.start_month>m||saved.has(p.goal_id+'|'+m)||!s.goals.some(g=>g.id===p.goal_id))continue;saving+=Number(p.monthly_cents)}
  balance+=income-expense;held+=saving;
  rows.push({m,start,income,expense,saving,balance,free:balance-held});
 }
 const table=`<div style="overflow-x:auto"><table class="kc-v17-table"><thead><tr><th>Monat</th><th>Start</th><th>Einnahmen</th><th>Ausgaben</th><th>Sparen</th><th>Endvermögen</th><th>Frei</th></tr></thead><tbody>${rows.map(r=>`<tr ${r.free<0?'class="kc-v17-negative"':''}><td>${esc(monthName(r.m))}</td><td>${eur(r.start)}</td><td>${eur(r.income)}</td><td>${eur(r.expense)}</td><td>${eur(r.saving)}</td><td><b>${eur(r.balance)}</b></td><td><b>${eur(r.free)}</b></td></tr>`).join('')}</tbody></table></div>`;
 const plans=new Map(s.plans.map(p=>[p.goal_id,p]));
 const goalCards=s.goals.map(g=>{
  const p=plans.get(g.id),remaining=Math.max(0,Number(g.target_cents)-Number(g.saved_cents));
  let need='Kein Wunschdatum angegeben',status='🟡 Termin offen';
  if(g.target_date){
   const deadline=month(g.target_date);let months=0;
   for(let m=now;m<=deadline&&months<240;m=addMonth(m,1))months++;
   if(remaining===0){need='Ziel erreicht';status='🟢 Erreicht'}
   else if(months===0){need='Wunschdatum ist überschritten';status='🔴 Termin überschritten'}
   else{
    need='Benötigt: etwa '+eur(Math.ceil(remaining/months))+' pro Monat';
    if(!p)status='🟡 Noch kein Sparplan';
    else{
     const done=new Set(s.entries.filter(x=>x.goal_id===g.id).map(x=>x.plan_month));
     let projected=Number(g.saved_cents),n=0;
     for(let m=now;m<=deadline&&n++<240;m=addMonth(m,1)){
      if(m<p.start_month||done.has(m))continue;
      const maxDay=new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate();
      const payDate=m.slice(0,8)+String(Math.min(maxDay,Number(p.due_day))).padStart(2,'0');
      if(payDate<today()||payDate>g.target_date)continue;
      projected+=Number(p.monthly_cents);
     }
     status=projected>=Number(g.target_cents)?'🟢 Voraussichtlich erreichbar':'🔴 Mit aktuellem Sparplan nicht erreichbar';
    }
   }
  }
  return `<div class="kc-v17-goal"><b>${esc(g.title)}</b><p>Ziel: ${eur(g.target_cents)} · Gespart: ${eur(g.saved_cents)} · Offen: ${eur(remaining)}<br>Wunschdatum: ${esc(dateName(g.target_date))}<br>${esc(need)}<br>Sparplan: ${p?eur(p.monthly_cents)+'/Monat':'Keiner'}<br><strong>${status}</strong></p></div>`;
 }).join('')||'<p class="muted">Noch keine aktiven Sparziele.</p>';
 return `<h2>📊 Monatsübersicht</h2><p>Gesamtvermögen: <b>${eur(total)}</b> · Für Sparziele: <b>${eur(goalReserved)}</b> · Rücklagen: <b>${eur(reserves)}</b> · Frei: <b>${eur(total-goalReserved-reserves)}</b></p><h3>Cashflow – nächste 12 Monate</h3>${table}<p class="muted">Prognose ab heute. Bereits bestätigte regelmäßige Buchungen sind im Startvermögen enthalten und werden nicht doppelt gezählt. Sparraten reservieren Geld, sie sind keine Ausgaben. Unbekannte künftige Einzelbuchungen sind nicht enthalten.</p><h3>🎯 Sparziele im Monatsplan</h3>${goalCards}`;
}
async function show(){
 const panel=document.getElementById('monthOverview');if(!panel)return;
 const ticket=++request;
 document.querySelectorAll('#app nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='monthOverview'));
 document.querySelectorAll('#app .tab').forEach(el=>el.hidden=el!==panel);
 panel.innerHTML='<h2>📊 Monatsübersicht</h2><p>Berechne deinen Cashflow …</p>';
 try{const s=await load();if(ticket===request&&!panel.hidden)panel.innerHTML=build(s)}
 catch(e){if(ticket===request)panel.innerHTML='<h2>📊 Monatsübersicht</h2><p role="alert">Die Daten konnten nicht geladen werden: '+esc(e.message)+'</p><button id="kc-v17-retry" type="button">Erneut versuchen</button>';panel.querySelector('#kc-v17-retry')?.addEventListener('click',show)}
}
function init(){
 const button=document.querySelector('[data-tab="monthOverview"]'),panel=document.getElementById('monthOverview');if(!button||!panel)return;
 // Capture phase prevents V1.6 from trying to move DOM nodes out of the bookings view.
 document.addEventListener('click',e=>{
  const target=e.target.closest?.('[data-tab="monthOverview"]');if(target!==button)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();show();
 },true);
 const css=document.createElement('style');css.textContent='.kc-v17-table{width:100%;border-collapse:collapse;font-size:.9rem}.kc-v17-table th,.kc-v17-table td{padding:8px 6px;border-bottom:1px solid #dce3e7;text-align:right;white-space:nowrap}.kc-v17-table th:first-child,.kc-v17-table td:first-child{text-align:left}.kc-v17-negative{background:#fff0ed}.kc-v17-goal{padding:12px 0;border-bottom:1px solid #dce3e7}.kc-v17-goal p{line-height:1.7}';document.head.appendChild(css);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
