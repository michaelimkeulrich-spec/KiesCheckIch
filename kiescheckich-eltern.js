(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const check=async q=>{const {data,error}=await q;if(error)throw error;return data};
const month=d=>d.slice(0,7)+'-01';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const advance=(m,n)=>{const d=new Date(m+'T12:00:00');d.setMonth(d.getMonth()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'};
const label=m=>new Intl.DateTimeFormat('de-DE',{month:'short',year:'numeric'}).format(new Date(m+'T12:00:00'));
let parent=false,children=[],selected=null,subtab='bookings',loading=false;
function go(id){document.querySelectorAll('#app nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('#app .tab').forEach(s=>s.hidden=s.id!==id)}
function setup(){
 const nav=document.querySelector('#app nav'),family=document.getElementById('family');
 if(!nav||!family)return;
 for(const b of nav.querySelectorAll('[data-tab]'))b.hidden=b.dataset.tab!=='family';
 nav.querySelector('[data-tab="family"]').textContent='👨‍👩‍👧 Familie';
 document.getElementById('kc-parent-app')?.remove();
 const shell=document.createElement('section');shell.id='kc-parent-app';shell.className='tab card';shell.hidden=true;family.after(shell);
 // Hide the existing setup/admin forms only for parent sessions; keep child and admin views untouched.
 const style=document.createElement('style');style.id='kc-parent-css';style.textContent=`
 body.kc-parent-mode #home,body.kc-parent-mode #bookings,body.kc-parent-mode #savings,body.kc-parent-mode #kc-v14-monthly,body.kc-parent-mode #monthOverview,body.kc-parent-mode #settings,body.kc-parent-mode #feedback{display:none!important}
 body.kc-parent-mode #family>*{display:none!important}
 body.kc-parent-mode #family #kc-parent-family{display:block!important}
 body.kc-parent-mode #kc-parent-app .kc-subnav{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
 body.kc-parent-mode #kc-parent-app .kc-subnav button.active{font-weight:700;outline:2px solid currentColor}
 body.kc-parent-mode #kc-parent-app table{width:100%;border-collapse:collapse;font-size:.9rem}
 body.kc-parent-mode #kc-parent-app th,body.kc-parent-mode #kc-parent-app td{padding:7px;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap}
 body.kc-parent-mode #kc-parent-app th:first-child,body.kc-parent-mode #kc-parent-app td:first-child{text-align:left}
 body.kc-parent-mode #kc-parent-app .kc-table{overflow:auto}
 body.kc-parent-mode #kc-parent-app .kc-readonly{padding:8px;border-radius:8px;background:#eaf3f5}
 `;
 document.head.appendChild(style);
 let container=document.getElementById('kc-parent-family');
 if(!container){container=document.createElement('div');container.id='kc-parent-family';family.appendChild(container)}
 go('family');
}
function directory(){
 const el=document.getElementById('kc-parent-family');if(!el)return;
 el.innerHTML='<h2>👨‍👩‍👧 Meine Familie</h2><p class="kc-readonly">Finanzen der Kinder: nur lesen. Lediglich der Anzeigename darf hier geändert werden.</p>'+
 (children.length?children.map(c=>`<div class="item" style="display:block"><h3>${esc(c.child_name||'Kind')}</h3><p>📧 ${esc(c.child_email||'Keine E-Mail hinterlegt')}</p><form data-rename="${c.child_id}"><label>Anzeigename ändern<input name="name" maxlength="80" value="${esc(c.child_name||'')}" required></label><button type="submit" class="secondary">Namen speichern</button></form><button type="button" data-open="${c.child_id}">📊 Finanzbereich öffnen</button></div>`).join(''):'<p>Keine minderjährigen Kinderkonten gefunden.</p>');
 // Existing invitation form and its original app.js submit handler are reused.
 // Moving the DOM nodes preserves event listeners, family selection and email/link handling.
 const invite=document.createElement('section');
 invite.id='kc-parent-invite';
 invite.innerHTML='<h3>✉️ Kind einladen</h3><p>E-Mail-Adresse eingeben und einen persönlichen Einladungslink erstellen. Die Einladung kann per E-Mail versendet werden.</p>';
 const form=document.getElementById('childInvite');
 const result=document.getElementById('childInviteResult');
 if(form&&result){
  invite.appendChild(form);
  invite.appendChild(result);
  el.appendChild(invite);
 }
 el.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openChild(b.dataset.open));
 el.querySelectorAll('[data-rename]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();const name=String(new FormData(f).get('name')||'').trim();if(!name)return;try{await check(db.rpc('kc_parent_rename_child',{p_child:f.dataset.rename,p_name:name}));children=await check(db.rpc('kc_parent_child_directory'));directory();alert('Name gespeichert.')}catch(err){alert('Name konnte nicht gespeichert werden: '+err.message)}});
}
function openChild(id){
 selected=children.find(c=>c.child_id===id);if(!selected)return;
 subtab='bookings';go('kc-parent-app');renderChild();
}
function forecast(s){
 const current=month(today()),paid=new Set(s.conf.map(c=>c.recurring_id+'|'+c.plan_month)),saved=new Set(s.entries.map(c=>c.goal_id+'|'+c.plan_month));
 let balance=s.tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
 let allocated=s.goals.filter(g=>g.status==='active').reduce((n,g)=>n+Number(g.saved_cents),0)+s.reserves.reduce((n,r)=>n+Number(r.amount_cents),0);
 const rows=[];
 for(let i=0;i<12;i++){
  const m=advance(current,i),start=balance;let income=0,expense=0,saving=0;
  for(const r of s.recurring){
   if(!r.active||r.start_month>m||(r.end_month&&r.end_month<m)||paid.has(r.id+'|'+m))continue;
   if(r.kind==='income')income+=Number(r.amount_cents);else expense+=Number(r.amount_cents);
  }
  for(const p of s.plans){
   if(p.start_month>m||saved.has(p.goal_id+'|'+m)||!s.goals.some(g=>g.id===p.goal_id&&g.status==='active'))continue;
   saving+=Number(p.monthly_cents);
  }
  balance+=income-expense;allocated+=saving;
  rows.push({m,start,income,expense,saving,balance,free:balance-allocated});
 }
 return rows;
}
async function data(id){
 const [tx,goals,plans,entries,recurring,conf,reserves]=await Promise.all([
  check(db.from('transactions').select('id,kind,amount_cents,category,note,booked_on').eq('user_id',id).order('booked_on',{ascending:false}).limit(10000)),
  check(db.from('savings_goals').select('id,title,target_cents,saved_cents,target_date,status').eq('user_id',id)),
  check(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',id)),
  check(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',id).not('plan_month','is',null)),
  check(db.from('kc_recurring_items').select('id,title,kind,amount_cents,category,due_day,start_month,end_month,active').eq('user_id',id)),
  check(db.from('kc_recurring_confirmations').select('recurring_id,plan_month').eq('user_id',id)),
  check(db.from('kc_general_reserves').select('amount_cents').eq('user_id',id))
 ]);
 return {tx,goals,plans,entries,recurring,conf,reserves};
}
function renderContent(s){
 const out=document.getElementById('kc-parent-content'),balance=s.tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
 const allocated=s.goals.filter(g=>g.status==='active').reduce((n,g)=>n+Number(g.saved_cents),0);
 const reserve=s.reserves.reduce((n,r)=>n+Number(r.amount_cents),0);
 if(subtab==='bookings'){
  out.innerHTML='<h3>📒 Buchungen</h3><p>Erfasstes Gesamtvermögen: <b>'+euro(balance)+'</b></p>'+
   (s.tx.length?s.tx.map(t=>`<div class="item"><span><b>${esc(t.category)}</b><br><small>${esc(t.booked_on)} · ${esc(t.note)}</small></span><b>${t.kind==='income'?'+':'−'}${euro(t.amount_cents)}</b></div>`).join(''):'<p>Keine Buchungen vorhanden.</p>');
 }
 if(subtab==='goals'){
  const pm=new Map(s.plans.map(p=>[p.goal_id,p]));
  out.innerHTML='<h3>🎯 Sparziele</h3>'+(s.goals.filter(g=>g.status==='active').length?s.goals.filter(g=>g.status==='active').map(g=>{
   const p=pm.get(g.id);return `<div class="item" style="display:block"><b>${esc(g.title)}</b><p>${euro(g.saved_cents)} von ${euro(g.target_cents)} · Wunschdatum: ${esc(g.target_date||'Keines')}</p><progress value="${Math.min(g.saved_cents,g.target_cents)}" max="${Math.max(1,g.target_cents)}"></progress><p>${p?'Sparrate: '+euro(p.monthly_cents)+' / Monat':'Kein monatlicher Sparplan'}</p></div>`;
  }).join(''):'<p>Keine aktiven Sparziele.</p>');
 }
 if(subtab==='recurring'){
  const paid=new Set(s.conf.map(c=>c.recurring_id+'|'+c.plan_month)),now=month(today());
  out.innerHTML='<h3>🔁 Regelmäßige Einnahmen und Ausgaben</h3>'+(s.recurring.length?s.recurring.map(r=>`<div class="item"><span><b>${esc(r.title)}</b><br><small>${esc(r.category)} · Tag ${r.due_day} · ab ${esc(r.start_month.slice(0,7))}${r.end_month?' bis '+esc(r.end_month.slice(0,7)):''} · ${r.active?'Aktiv':'Pausiert'}</small></span><b>${r.kind==='income'?'+':'−'}${euro(r.amount_cents)}</b></div>`).join(''):'<p>Keine regelmäßigen Buchungen.</p>')+
  '<h4>Bestätigungen im aktuellen Monat</h4><p>'+s.recurring.filter(r=>paid.has(r.id+'|'+now)).length+' von '+s.recurring.filter(r=>r.active&&r.start_month<=now&&(!r.end_month||r.end_month>=now)).length+' aktiven Positionen bestätigt.</p>';
 }
 if(subtab==='monthly'){
  const rows=forecast(s);
  out.innerHTML='<h3>📊 Monatsübersicht</h3><p>Gesamtvermögen: <b>'+euro(balance)+'</b> · Sparziele: '+euro(allocated)+' · Rücklagen: '+euro(reserve)+' · Frei: <b>'+euro(balance-allocated-reserve)+'</b></p><div class="kc-table"><table><thead><tr><th>Monat</th><th>Start</th><th>Einnahmen</th><th>Ausgaben</th><th>Sparen</th><th>Endvermögen</th><th>Frei</th></tr></thead><tbody>'+rows.map(r=>`<tr${r.free<0?' style="background:#ffe8e8"':''}><td>${esc(label(r.m))}</td><td>${euro(r.start)}</td><td>${euro(r.income)}</td><td>${euro(r.expense)}</td><td>${euro(r.saving)}</td><td><b>${euro(r.balance)}</b></td><td><b>${euro(r.free)}</b></td></tr>`).join('')+'</tbody></table></div><h3>🎯 Sparziele im Monatsplan</h3>'+s.goals.filter(g=>g.status==='active').map(g=>`<p><b>${esc(g.title)}</b>: ${euro(g.saved_cents)} / ${euro(g.target_cents)} · Wunschdatum: ${esc(g.target_date||'Keines')}</p>`).join('')+'<p class="muted">Prognose aus bekannten regelmäßigen Buchungen und Sparplänen; keine automatische Buchung.</p>';
 }
}
async function renderChild(){
 if(!selected||loading)return;loading=true;
 const el=document.getElementById('kc-parent-app');el.innerHTML=`<button type="button" id="kc-back" class="secondary">← Familie</button><h2>👤 ${esc(selected.child_name||'Kind')}</h2><p>📧 ${esc(selected.child_email||'')}</p><p class="kc-readonly">🔒 Nur Lesezugriff auf Finanzdaten</p><div class="kc-subnav">${[['bookings','📒 Buchungen'],['goals','🎯 Sparziele'],['recurring','🔁 Ein- und Ausgaben'],['monthly','📊 Monatsübersicht']].map(([id,title])=>`<button type="button" data-sub="${id}" class="${subtab===id?'active':'secondary'}">${title}</button>`).join('')}</div><div id="kc-parent-content">Lade Daten …</div>`;
 el.querySelector('#kc-back').onclick=()=>go('family');
 el.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{subtab=b.dataset.sub;el.querySelectorAll('[data-sub]').forEach(x=>{x.className=x===b?'active':'secondary'});renderContent(currentData)});
 let currentData;
 try{currentData=await data(selected.child_id);renderContent(currentData)}
 catch(e){el.querySelector('#kc-parent-content').innerHTML='<p role="alert">Daten konnten nicht geladen werden: '+esc(e.message)+'</p>'}
 finally{loading=false}
}
async function activate(){
 if(document.getElementById('app')?.hidden)return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const [parents,admins]=await Promise.all([
  check(db.from('kc_family_parents').select('family_id').eq('user_id',user.id).limit(1)),
  check(db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1))
 ]);
 if(!parents.length||admins.length)return;
 children=await check(db.rpc('kc_parent_child_directory'));
 parent=true;document.body.classList.add('kc-parent-mode');setup();directory();
}
function init(){
 let tries=0;const timer=setInterval(async()=>{if(parent){clearInterval(timer);return}if(document.getElementById('app')?.hidden){if(++tries>90)clearInterval(timer);return}clearInterval(timer);try{await activate()}catch(e){console.error('Elternansicht:',e)}},400);
 db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_IN')setTimeout(()=>{if(!parent)activate().catch(console.error)},1100);if(event==='SIGNED_OUT'){parent=false;document.body.classList.remove('kc-parent-mode')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();