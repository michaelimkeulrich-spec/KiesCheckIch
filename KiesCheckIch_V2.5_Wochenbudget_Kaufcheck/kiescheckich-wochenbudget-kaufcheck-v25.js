(()=>{'use strict';
if(!window.supabase)return;
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100);
const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const week=()=>{const a=new Date();a.setHours(12,0,0,0);a.setDate(a.getDate()-(a.getDay()+6)%7);const b=new Date(a);b.setDate(b.getDate()+6);return [date(a),date(b)]};
let state=null,fetching=null,lastFetch=0,lastUser='',lastWeek='';
async function getBudget(force=false){
 const {data:{user}}=await db.auth.getUser();if(!user){state=null;return null}
 const [start,end]=week();const now=Date.now();
 if(!force&&state&&lastUser===user.id&&lastWeek===start&&now-lastFetch<4000)return state;
 if(fetching)return fetching;
 fetching=(async()=>{
 const [p,a,b,t]=await Promise.all([
 db.from('kc_family_parents').select('user_id').eq('user_id',user.id).limit(1),
 db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1),
 db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',user.id).maybeSingle(),
 db.from('transactions').select('amount_cents,kind').eq('user_id',user.id).gte('booked_on',start).lte('booked_on',end)
 ]);
 for(const q of [p,a,b,t])if(q.error)throw q.error;
 lastUser=user.id;lastWeek=start;lastFetch=Date.now();
 if(p.data.length||a.data.length){state=null;return null}
 state={limit:Number(b.data?.limit_cents||0),spent:t.data.filter(x=>x.kind==='expense').reduce((s,x)=>s+Number(x.amount_cents),0)};
 return state;
 })();try{return await fetching}finally{fetching=null}
}
function banner(s){const header=document.querySelector('header');if(!header)return;let el=document.getElementById('kc-week-limit-header');if(!s||!s.limit){el?.remove();return}
 if(!el){el=document.createElement('div');el.id='kc-week-limit-header';el.setAttribute('role','status');el.style.cssText='margin:10px auto 0;padding:10px 12px;border-radius:10px;max-width:560px;font-weight:700;text-align:center';header.appendChild(el)}
 const ratio=s.spent/s.limit;el.style.background=ratio>=1?'#fee2e2':ratio>=.8?'#fff3cd':'#e6f4ea';el.style.color=ratio>=1?'#991b1b':ratio>=.8?'#795000':'#14532d';
 el.textContent=(ratio>=1?'⛔ Wochenlimit überschritten oder erreicht!':ratio>=.8?'⚠️ Wochenlimit fast erreicht':'💶 Wochenbudget')+' · '+euro(s.spent)+' / '+euro(s.limit);
}
async function refresh(){try{const app=document.getElementById('app');if(!app||app.hidden){banner(null);return}banner(await getBudget())}catch(e){console.warn('Wochenbudget:',e.message)}}
function priceFromForm(){const v=document.querySelector('#kc-afford-form [name="price"]')?.value||'';const s=v.trim().replace(/\s/g,'').replace(',','.');return /^\d+(\.\d{1,2})?$/.test(s)?Math.round(Number(s)*100):null}
let generation=0;
async function enhanceResult(){
 const result=document.getElementById('kc-afford-result');if(!result||!result.querySelector('#kc-afford-book'))return;
 const card=result.querySelector('.item');if(!card||card.dataset.weeklyEnhanced==='1')return;
 card.dataset.weeklyEnhanced='1';const id=++generation;
 try{
 const budget=await getBudget(true);if(id!==generation||!card.isConnected||!budget||!budget.limit)return;
 const price=priceFromForm();if(price===null)return;
 const next=budget.spent+price,ratio=next/budget.limit;
 const warning=document.createElement('p');warning.id='kc-weekly-purchase-warning';warning.style.cssText='font-weight:700;padding:10px;border-radius:8px;background:#fff3cd;color:#664d03';
 if(ratio>1){warning.textContent='⛔ Achtung: Mit diesem Kauf überschreitest du dein Wochenlimit um '+euro(next-budget.limit)+'.';}
 else if(ratio===1){warning.textContent='⛔ Dieser Kauf schöpft dein Wochenlimit vollständig aus.';}
 else if(ratio>=.8){warning.textContent='⚠️ Mit diesem Kauf erreichst du '+Math.round(ratio*100)+' % deines Wochenlimits.';}
 else{warning.style.background='#e6f4ea';warning.style.color='#14532d';warning.textContent='💶 Wochenbudget: Nach dem Kauf bleiben '+euro(budget.limit-next)+' übrig.'}
 const details=document.createElement('p');details.textContent='Wochenausgaben bisher: '+euro(budget.spent)+' · Wochenlimit: '+euro(budget.limit)+' · Nach Kauf: '+euro(next);
 const button=card.querySelector('#kc-afford-book');button.before(warning,details);
 if(ratio>=1){const heading=card.querySelector('h3');if(heading&&heading.textContent.includes('🟢'))heading.textContent='🟡 Achtung: Wochenlimit!'}
 }catch(e){console.warn('Wochenbudget-Kaufcheck:',e.message)}
}
function init(){const result=document.getElementById('kc-afford-result');if(result){new MutationObserver(()=>{if(result.querySelector('#kc-afford-book'))enhanceResult()}).observe(result,{childList:true,subtree:true})}
 const form=document.getElementById('kc-afford-form');form?.addEventListener('submit',()=>{generation++;lastFetch=0},true);
 document.getElementById('kc-weekly-budget')?.addEventListener('submit',()=>{lastFetch=0;setTimeout(refresh,700)});
 setInterval(refresh,4000);refresh();
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastFetch=0;refresh()}});
 document.addEventListener('click',e=>{if(e.target.closest?.('#kc-afford-book,#txForm button,#kc-weekly-form button')){lastFetch=0;setTimeout(refresh,1200)}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
