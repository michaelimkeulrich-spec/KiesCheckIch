(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const cents=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte gültigen Betrag eingeben');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Betrag muss positiv sein');return n};
const date=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const month=()=>date().slice(0,7)+'-01';
let busy=false;
async function me(){const {data:{user},error}=await db.auth.getUser();if(error)throw error;return user}
async function ledger(ids){
 const [tx,goals,reserves,plans,entries]=await Promise.all([
  read(db.from('transactions').select('user_id,kind,amount_cents').in('user_id',ids).limit(10000)),
  read(db.from('savings_goals').select('id,user_id,title,target_cents,saved_cents,status').in('user_id',ids)),
  read(db.from('kc_general_reserves').select('user_id,amount_cents').in('user_id',ids)),
  read(db.from('kc_savings_plans').select('goal_id,user_id,monthly_cents,due_day,start_month').in('user_id',ids)),
  read(db.from('kc_savings_entries').select('goal_id,user_id,plan_month').in('user_id',ids).not('plan_month','is',null))
 ]);
 const map=new Map(ids.map(id=>[id,{total:0,goal:0,reserve:0,free:0,due:0,goals:[],plans:[],entries:[]}]));
 tx.forEach(t=>{if(map.has(t.user_id))map.get(t.user_id).total+=(t.kind==='income'?1:-1)*Number(t.amount_cents)});
 goals.filter(g=>g.status==='active').forEach(g=>{if(map.has(g.user_id)){const a=map.get(g.user_id);a.goals.push(g);a.goal+=Number(g.saved_cents)}});
 reserves.forEach(r=>{if(map.has(r.user_id))map.get(r.user_id).reserve+=Number(r.amount_cents)});
 plans.forEach(r=>{if(map.has(r.user_id))map.get(r.user_id).plans.push(r)});
 entries.forEach(r=>{if(map.has(r.user_id))map.get(r.user_id).entries.push(r)});
 for(const a of map.values()){
  a.free=a.total-a.goal-a.reserve;
  const paid=new Set(a.entries.map(e=>e.goal_id+'|'+e.plan_month));
  a.due=a.plans.filter(x=>!x.start_month||x.start_month<=month()).reduce((n,x)=>n+(paid.has(x.goal_id+'|'+month())?0:Number(x.monthly_cents)),0);
 }
 return map;
}
function boxes(a){return `<div class="item" style="display:block"><h3>💰 Gesamtvermögen: ${euro(a.total)}</h3><p>🎯 Für Sparziele: <b>${euro(a.goal)}</b><br>🏦 Allgemeine Rücklagen: <b>${euro(a.reserve)}</b><br>🟢 Freies Vermögen: <b>${euro(a.free)}</b></p><p class="muted">Erfasstes Vermögen, kein Bankkontostand. Offene geplante Monatsraten: ${euro(a.due)} (noch nicht abgezogen).</p>${a.free<0?'<p class="warning">Achtung: Reservierungen übersteigen das erfasste Guthaben. Bitte Buchungen und Sparzuordnungen prüfen.</p>':''}</div>`}
function reload(tab){sessionStorage.setItem('kc-v13-tab',tab);location.reload()}
function notify(e){alert('KiesCheckIch: '+(e?.message||e))}
async function savings(){
 const user=await me();if(!user)return;
 const a=(await ledger([user.id])).get(user.id);
 let root=document.getElementById('kc-v13-savings');if(!root){root=document.createElement('section');root.id='kc-v13-savings';document.getElementById('goalList').after(root)}
 const archive=await read(db.from('kc_goal_archive').select('title,amount_cents,disposition,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20));
 const plans=new Map(a.plans.map(x=>[x.goal_id,x]));
 const paid=new Set(a.entries.map(x=>x.goal_id+'|'+x.plan_month));
 const now=date();
 root.innerHTML='<h3>🎯 Meine aktiven Sparziele</h3>'+boxes(a)+a.goals.map(g=>{
 const plan=plans.get(g.id);
 let tasks='';
 if(plan){
  let m=plan.start_month.slice(0,7),count=0;
  while(m<=now.slice(0,7)&&count++<36){
   const due=m+'-'+String(plan.due_day).padStart(2,'0');
   if(due<=now&&!paid.has(g.id+'|'+m+'-01'))tasks+=`<button type="button" data-pay="${safe(g.id)}" data-month="${m}-01" data-amount="${plan.monthly_cents}">Rate ${safe(m)} bestätigen (${euro(plan.monthly_cents)})</button> `;
   const d=new Date(m+'-01T12:00:00');d.setMonth(d.getMonth()+1);m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  }
 }
 return `<div class="item" style="display:block"><h4>${safe(g.title)}</h4><p>${euro(g.saved_cents)} von ${euro(g.target_cents)}</p><progress max="${Math.max(1,g.target_cents)}" value="${Math.min(g.saved_cents,g.target_cents)}"></progress>
 <form data-save="${g.id}"><label>Geld zuordnen (euro)<input name="amount" inputmode="decimal" required placeholder="5,00"></label><button>Jetzt sparen</button></form>
 ${plan?`<p class="muted">Monatlicher Sparplan: ${euro(plan.monthly_cents)} am ${plan.due_day}.</p>${tasks||'<p class="muted">Keine fällige Rate offen.</p>'}`:
 `<form data-plan="${g.id}"><label>Monatliche Rate (euro)<input name="amount" inputmode="decimal" required></label><label>Fälligkeitstag (1–28)<input name="day" type="number" min="1" max="28" value="1" required></label><button class="secondary">Sparplan anlegen</button></form>`}
 <button type="button" class="secondary" data-abandon="${g.id}">Sparziel aufgeben</button><div id="kc-abandon-${g.id}"></div></div>`;
 }).join('')+'<h3>🏦 Allgemeine Rücklagen</h3><p>Aktuell reserviert: '+euro(a.reserve)+'</p>'+(a.reserve>0?'<form id="kc-release"><label>Davon wieder freigeben (euro)<input name="amount" inputmode="decimal" required></label><button class="secondary">Rücklage freigeben</button></form>':'')+
 '<details><summary>Aufgegebene Sparziele ('+archive.length+')</summary>'+archive.map(x=>'<p>'+safe(x.title)+' · '+euro(x.amount_cents)+' · '+({free:'freigegeben',reserve:'als Rücklage',transfer:'übertragen'}[x.disposition]||'')+'</p>').join('')+'</details>';
 root.querySelectorAll('[data-save]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await read(db.rpc('kc_v13_save',{p_goal:f.dataset.save,p_amount:cents(new FormData(f).get('amount')),p_month:null}));reload('savings')}catch(err){notify(err)}});
 root.querySelectorAll('[data-plan]').forEach(f=>f.onsubmit=async e=>{e.preventDefault();try{await read(db.from('kc_savings_plans').insert({goal_id:f.dataset.plan,user_id:user.id,monthly_cents:cents(new FormData(f).get('amount')),due_day:Number(new FormData(f).get('day')),start_month:month()}));reload('savings')}catch(err){notify(err)}});
 root.querySelectorAll('[data-pay]').forEach(b=>b.onclick=async()=>{try{await read(db.rpc('kc_v13_save',{p_goal:b.dataset.pay,p_amount:Number(b.dataset.amount),p_month:b.dataset.month}));reload('savings')}catch(err){notify(err)}});
 root.querySelectorAll('[data-abandon]').forEach(b=>b.onclick=()=>{
  const g=a.goals.find(g=>g.id===b.dataset.abandon),div=document.getElementById('kc-abandon-'+g.id);
  const others=a.goals.filter(x=>x.id!==g.id);
  div.innerHTML=`<p>😔 Schade, dass du „${safe(g.title)}“ aufgibst! Wünsche ändern sich. Was soll mit deinen ${euro(g.saved_cents)} passieren?</p>
  <form data-abandon-form="${g.id}"><label>Entscheidung<select name="mode"><option value="free">💰 Freies Vermögen</option><option value="reserve">🏦 Allgemeine Rücklage</option>${others.length?'<option value="transfer">🎯 Anderes Sparziel</option>':''}</select></label>
  <label class="kc-destination" hidden>Neues Sparziel<select name="destination">${others.map(x=>`<option value="${x.id}">${safe(x.title)}</option>`).join('')}</select></label>
  <button type="submit">Sparziel endgültig aufgeben</button></form>`;
  const f=div.querySelector('form'),mode=f.elements.mode;
  mode.onchange=()=>f.querySelector('.kc-destination').hidden=mode.value!=='transfer';
  f.onsubmit=async e=>{e.preventDefault();if(!confirm(`Sparziel „${g.title}“ wirklich aufgeben?`))return;try{await read(db.rpc('kc_v13_abandon',{p_goal:g.id,p_mode:mode.value,p_destination:mode.value==='transfer'?f.elements.destination.value:null}));alert('Dein Sparziel wurde archiviert. Dein Geld wurde wie gewünscht zugeordnet.');reload('savings')}catch(err){notify(err)}};
 });
 const release=root.querySelector('#kc-release');
 if(release)release.onsubmit=async e=>{e.preventDefault();try{await read(db.rpc('kc_v13_release_reserve',{p_amount:cents(new FormData(release).get('amount'))}));reload('savings')}catch(err){notify(err)}};
}
async function overview(){
 const user=await me();if(!user)return;
 const a=(await ledger([user.id])).get(user.id),home=document.getElementById('home');
 let box=document.getElementById('kc-v13-overview');if(!box){box=document.createElement('div');box.id='kc-v13-overview';home.insertBefore(box,home.querySelector('#balance'))}
 box.innerHTML='<h3>Dein Vermögen</h3>'+boxes(a);
 let panel=document.getElementById('kc-v13-buy');if(!panel){panel=document.createElement('section');panel.id='kc-v13-buy';home.appendChild(panel)}
 panel.innerHTML='<h3>🛍️ Kann ich mir das leisten?</h3><form id="kc-v13-check"><label>Was möchtest du kaufen?<input name="item" maxlength="100" required></label><label>Preis (euro)<input name="price" inputmode="decimal" required></label><button>Kauf prüfen</button></form><div id="kc-v13-result"></div>';
 panel.querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  try{
   const item=String(new FormData(e.target).get('item')).trim(),price=cents(new FormData(e.target).get('price'));
   const fresh=(await ledger([user.id])).get(user.id),available=fresh.free-Math.max(0,fresh.due);
   const verdict=price>fresh.total?'🔴 Lieber nicht – das Guthaben reicht nicht.':price>available?'🟡 Vorsicht – Rücklagen oder Sparraten könnten gefährdet sein.':'🟢 Passt – deine Rücklagen bleiben geschützt.';
   const result=panel.querySelector('#kc-v13-result');
   result.innerHTML=`<p><b>${verdict}</b></p><p>Gesamt: ${euro(fresh.total)} · Frei: ${euro(fresh.free)} · Offene Monatsraten: ${euro(fresh.due)} · Nach Kauf: ${euro(fresh.total-price)}</p><button type="button" id="kc-v13-book">Kauf durchführen und als Ausgabe buchen</button>`;
   result.querySelector('button').onclick=async()=>{
    if(!confirm(`„${item}“ für ${euro(price)} als Ausgabe buchen?`))return;
    const b=result.querySelector('button');b.disabled=true;
    try{
     const current=await me();if(current?.id!==user.id)throw Error('Bitte erneut anmelden.');
     const cats=await read(db.from('transaction_categories').select('name').eq('kind','expense').eq('active',true));
     const category=cats.some(x=>x.name==='Freizeit')?'Freizeit':cats[0]?.name;if(!category)throw Error('Keine Ausgabenkategorie');
     await read(db.from('transactions').insert({user_id:user.id,kind:'expense',amount_cents:price,category,note:'Kaufcheck: '+item,booked_on:date()}));
     reload('home');
    }catch(err){b.disabled=false;notify(err)}
   };
  }catch(err){notify(err)}
 };
}
async function parents(){
 const user=await me();if(!user||document.getElementById('parentBox')?.hidden)return;
 const families=await read(db.from('kc_family_parents').select('family_id').eq('user_id',user.id));
 if(!families.length)return;
 const children=await read(db.from('kc_family_children').select('user_id').in('family_id',families.map(x=>x.family_id)));
 if(!children.length)return;
 const ids=[...new Set(children.map(x=>x.user_id))],map=await ledger(ids);
 const names=await read(db.from('profiles').select('id,display_name').in('id',ids));
 const nm=new Map(names.map(x=>[x.id,x.display_name]));
 let box=document.getElementById('kc-v13-parents');if(!box){box=document.createElement('section');box.id='kc-v13-parents';document.getElementById('parentBox').appendChild(box)}
 box.innerHTML='<h3>📊 Vermögen und Sparziele der Kinder</h3><p class="muted">Nur zur Ansicht.</p>'+ids.map(id=>{
  const a=map.get(id);return '<div class="item" style="display:block"><h4>'+safe(nm.get(id)||'Kind')+'</h4>'+boxes(a)+'<h4>Sparziele</h4>'+a.goals.map(g=>'<p>'+safe(g.title)+': '+euro(g.saved_cents)+' / '+euro(g.target_cents)+'</p>').join('')+'</div>';
 }).join('');
}
async function run(tab){if(busy||document.getElementById('app')?.hidden)return;busy=true;try{if(tab==='home')await overview();if(tab==='savings')await savings();if(tab==='family')await parents()}catch(e){notify(e)}finally{busy=false}}
function init(){
 const css=document.createElement('style');css.textContent='#kc-savings-plans,#kc-parent-savings,#kc-afford,#goalList{display:none!important}';document.head.appendChild(css);
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTimeout(()=>run(b.dataset.tab),220)));
 const goalForm=document.getElementById('goalForm');
 if(goalForm)goalForm.addEventListener('submit',async e=>{
  e.preventDefault();e.stopImmediatePropagation();
  try{
   const f=new FormData(goalForm),title=String(f.get('title')||'').trim();
   const target=cents(f.get('target'));
   const raw=String(f.get('saved')||'0').trim().replace(',','.');
   if(!/^\d+(\.\d{1,2})?$/.test(raw))throw Error('Ungültiger Startbetrag');
   const saved=Math.round(Number(raw)*100);
   if(!title)throw Error('Bitte Sparziel benennen');
   const user=await me();if(!user)throw Error('Bitte anmelden');
   const a=(await ledger([user.id])).get(user.id);
   if(saved>a.free)throw Error('Startbetrag übersteigt das freie Vermögen. Bitte zuerst Guthaben erfassen.');
   await read(db.from('savings_goals').insert({user_id:user.id,title,target_cents:target,saved_cents:saved,priority:'medium'}));
   goalForm.reset();reload('savings');
  }catch(err){notify(err)}
 },true);
 const prior=sessionStorage.getItem('kc-v13-tab');if(prior)sessionStorage.removeItem('kc-v13-tab');
 setTimeout(()=>{if(document.getElementById('app')?.hidden)return;const tab=prior||'home';if(prior)document.querySelector(`[data-tab="${tab}"]`)?.click();else run('home')},1600);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();