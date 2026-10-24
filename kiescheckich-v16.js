(()=>{
'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const get=async q=>{const {data,error}=await q;if(error)throw error;return data};
let child=false,homeObserver,goalsObserver,monthlyObserver;
function nav(tab){const b=document.querySelector('[data-tab="'+tab+'"]');if(b)b.click()}
function showTab(tab){
 document.querySelectorAll('#app nav [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 document.querySelectorAll('#app .tab').forEach(el=>el.hidden=el.id!==tab);
 if(tab==='monthOverview')setTimeout(splitMonthly,180);
}
function settings(){
 const app=document.getElementById('app'),family=document.getElementById('family');
 if(!document.getElementById('settings')){
  const panel=document.createElement('section');panel.id='settings';panel.className='tab card';panel.hidden=true;
  panel.innerHTML='<h2>⚙️ Einstellungen</h2><p class="muted">Hier kannst du deinen Anzeigenamen ändern.</p>';
  family.after(panel);
 }
 const form=document.getElementById('myNameForm'),panel=document.getElementById('settings');
 if(form&&form.parentElement!==panel)panel.appendChild(form);
 const n=document.querySelector('#app nav');
 if(!n.querySelector('[data-tab="settings"]')){
  const b=document.createElement('button');b.dataset.tab='settings';b.textContent='⚙️ Einstellungen';
  n.appendChild(b);b.onclick=()=>showTab('settings');
 }
}
function home(){
 const box=document.getElementById('home'),buy=document.getElementById('kc-v13-buy'),overview=document.getElementById('kc-v13-overview');
 if(!box)return;
 const name=document.getElementById('myNameForm');
 if(name&&name.parentElement===box)settings();
 if(overview){
  [...overview.querySelectorAll('h3')].filter(h=>h.textContent.trim()==='Dein Vermögen').forEach(h=>h.remove());
 }
 // Place purchase check directly below the visible balance, but keep the rest of the dashboard intact.
 const balance=document.getElementById('balance');
 if(buy&&balance&&buy.previousElementSibling!==balance)balance.after(buy);
}
function reorderGoals(){
 const panel=document.getElementById('savings'),form=document.getElementById('goalForm'),existing=document.getElementById('kc-v13-savings');
 if(!panel||!form||!existing)return;
 let section=document.getElementById('kc-v16-create');
 if(!section){
  section=document.createElement('section');section.id='kc-v16-create';
  const heading=document.createElement('h3');heading.textContent='➕ Neues Sparziel';
  section.appendChild(heading);section.appendChild(form);panel.appendChild(section);
 }
 let heading=document.getElementById('kc-v16-existing-title');
 if(!heading){heading=document.createElement('h3');heading.id='kc-v16-existing-title';heading.textContent='🎯 Meine Sparziele';}
 existing.before(heading);
 // The V1.3 panel already contains its own heading, which is redundant.
 const first=existing.querySelector('h3');if(first&&first.textContent.includes('Meine aktiven Sparziele'))first.style.display='none';
 if(section.previousElementSibling!==existing)existing.after(section);
}
function score(g,plan,entries){
 const remaining=Math.max(0,Number(g.target_cents)-Number(g.saved_cents));
 if(!remaining)return ['green','Erreicht'];
 if(!g.target_date)return ['yellow','Kein Wunschdatum'];
 const today=new Date();today.setHours(0,0,0,0);
 const deadline=new Date(g.target_date+'T12:00:00');
 if(deadline<today)return ['red','Wunschdatum überschritten'];
 if(!plan)return ['yellow','Kein Sparplan'];
 const paid=new Set(entries.filter(e=>e.goal_id===g.id).map(e=>e.plan_month));
 const first=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-01';
 let projected=Number(g.saved_cents),m=first,iterations=0;
 while(m<=g.target_date.slice(0,7)+'-01'&&iterations++<240){
  const dueDay=Math.min(Number(plan.due_day),new Date(Number(m.slice(0,4)),Number(m.slice(5,7)),0).getDate());
  const dueDate=m.slice(0,8)+String(dueDay).padStart(2,'0');
  if(m>=plan.start_month&&dueDate<=g.target_date&&dueDate>=today.toLocaleDateString('sv-SE')&&!paid.has(m))projected+=Number(plan.monthly_cents);
  const d=new Date(m+'T12:00:00');d.setMonth(d.getMonth()+1);m=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
 }
 return projected>=Number(g.target_cents)?['green','Im Plan']:['red','Ziel gefährdet'];
}
let scoring=false;
async function dots(){
 if(scoring||document.getElementById('app')?.hidden)return;scoring=true;
 try{
  const {data:{user}}=await db.auth.getUser();if(!user)return;
  const [goals,plans,entries]=await Promise.all([
   get(db.from('savings_goals').select('id,target_cents,saved_cents,target_date,status').eq('user_id',user.id)),
   get(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',user.id)),
   get(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',user.id).not('plan_month','is',null))
  ]);
  const byPlan=new Map(plans.map(x=>[x.goal_id,x]));
  const root=document.getElementById('kc-v13-savings');if(!root)return;
  root.querySelectorAll('[data-abandon]').forEach(b=>{
   const g=goals.find(x=>x.id===b.dataset.abandon&&x.status==='active');if(!g)return;
   const [color,label]=score(g,byPlan.get(g.id),entries);
   let dot=root.querySelector('[data-goal-dot="'+g.id+'"]');
   if(!dot){dot=document.createElement('span');dot.dataset.goalDot=g.id;dot.className='kc-v16-dot';const card=b.closest('.item');const h=card?.querySelector('h4');if(h)h.prepend(dot)}
   dot.className='kc-v16-dot '+color;dot.title=label;dot.setAttribute('aria-label',label);
   let text=root.querySelector('[data-goal-state="'+g.id+'"]');
   if(!text){text=document.createElement('small');text.dataset.goalState=g.id;dot.parentElement.after(text)}
   text.textContent=' · '+label;
  });
 }catch(e){console.warn('KiesCheckIch Zielstatus:',e)}finally{scoring=false}
}
function splitMonthly(){
 const monthly=document.getElementById('kc-v14-monthly'),overview=document.getElementById('monthOverview');
 if(!monthly||!overview)return;
 // V1.4 replaces its innerHTML when re-rendering. Move its sections again whenever necessary.
 const cashHeading=[...monthly.querySelectorAll('h3')].find(x=>x.textContent.includes('Cashflow'));
 const goals=document.getElementById('kc-v15-goals');
 if(!cashHeading)return;
 let cash=overview.querySelector('#kc-v16-cash');
 if(!cash){cash=document.createElement('div');cash.id='kc-v16-cash';overview.appendChild(cash)}
 cash.replaceChildren();
 cash.appendChild(cashHeading);
 let next=cashHeading.nextSibling;
 while(next&&!(next.nodeType===1&&next.tagName==='H3')){
  const current=next;next=next.nextSibling;cash.appendChild(current);
 }
 if(goals)overview.insertBefore(goals,cash);
 // Duplicate only the explanatory summary, not the interactive forms.
 let summary=overview.querySelector('#kc-v16-summary');
 if(!summary){summary=document.createElement('div');summary.id='kc-v16-summary';overview.insertBefore(summary,overview.firstChild)}
 const total=[...monthly.querySelectorAll('h3')].find(h=>h.textContent.includes('Aktuelles Vermögen'));
 const financial=total?.nextElementSibling;
 summary.innerHTML='<h2>📊 Monatsübersicht</h2>'+(total?'<h3>'+safe(total.textContent)+'</h3>':'')+(financial?.tagName==='P'?'<p>'+safe(financial.textContent)+'</p>':'');
}
function createTabs(){
 const navEl=document.querySelector('#app nav'),monthly=document.getElementById('kc-v14-monthly');
 if(!navEl||!monthly)return;
 const original=navEl.querySelector('[data-tab="monthly"]');
 if(original){const oldHandler=original.onclick;original.textContent='🔁 Einnahmen / Ausgaben';original.onclick=e=>{if(oldHandler)oldHandler.call(original,e);else showTab('monthly');setTimeout(()=>splitMonthly(),750)}}
 if(!navEl.querySelector('[data-tab="monthOverview"]')){
  const button=document.createElement('button');button.dataset.tab='monthOverview';button.textContent='📊 Monatsübersicht';
  navEl.insertBefore(button,original||navEl.querySelector('[data-tab="family"]'));
  button.onclick=()=>{showTab('monthOverview');setTimeout(()=>{if(!document.querySelector('#kc-v16-cash table')){original?.click();setTimeout(()=>showTab('monthOverview'),700)}},100)};
 }
 if(!document.getElementById('monthOverview')){
  const panel=document.createElement('section');panel.id='monthOverview';panel.className='tab card';panel.hidden=true;monthly.after(panel);
  panel.innerHTML='<h2>📊 Monatsübersicht</h2><p>Öffne zunächst „Einnahmen / Ausgaben“, um die Monatsdaten zu laden.</p>';
 }
}
function observe(){
 const homeEl=document.getElementById('home'),goalsEl=document.getElementById('savings'),monthlyEl=document.getElementById('kc-v14-monthly');
 if(homeEl){homeObserver=new MutationObserver(()=>{homeObserver.disconnect();home();homeObserver.observe(homeEl,{childList:true,subtree:true})});homeObserver.observe(homeEl,{childList:true,subtree:true})}
 if(goalsEl){goalsObserver=new MutationObserver(()=>{goalsObserver.disconnect();reorderGoals();goalsObserver.observe(goalsEl,{childList:true,subtree:true})});goalsObserver.observe(goalsEl,{childList:true,subtree:true})}
 if(monthlyEl){monthlyObserver=new MutationObserver(()=>{monthlyObserver.disconnect();if(!monthlyEl.hidden)splitMonthly();monthlyObserver.observe(monthlyEl,{childList:true})});monthlyObserver.observe(monthlyEl,{childList:true})}
}
function init(){
 const css=document.createElement('style');css.textContent=`
 .kc-v16-dot{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:middle;border:1px solid rgba(0,0,0,.12)}
 .kc-v16-dot.green{background:#1ca968}.kc-v16-dot.yellow{background:#e5b529}.kc-v16-dot.red{background:#df5a4c}
 #kc-v16-existing-title{margin-top:20px}
 #kc-v16-create{margin-top:28px;padding-top:16px;border-top:1px solid #ddd}
 #kc-v16-cash table{font-size:.9rem}#kc-v16-cash th,#kc-v16-cash td{padding:7px;text-align:right;white-space:nowrap}#kc-v16-cash th:first-child,#kc-v16-cash td:first-child{text-align:left}
 `;
 document.head.appendChild(css);
 createTabs();settings();home();reorderGoals();observe();
 document.querySelector('[data-tab="savings"]')?.addEventListener('click',()=>setTimeout(()=>{reorderGoals();dots()},850));
 document.querySelector('[data-tab="monthOverview"]')?.addEventListener('click',()=>setTimeout(splitMonthly,650));
 document.querySelector('[data-tab="monthly"]')?.addEventListener('click',()=>setTimeout(splitMonthly,850));
 setTimeout(()=>{home();reorderGoals();dots();splitMonthly()},2300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();