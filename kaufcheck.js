(()=>{
'use strict';
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co',KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
const db=window.supabase.createClient(URL,KEY);
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const toCents=v=>{let s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte einen gültigen Betrag eingeben.');let n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Der Betrag muss größer als null sein.');return n};
let latest=null;
function init(){
 const home=document.getElementById('home'),app=document.getElementById('app');if(!home||!app)return;
 const section=document.createElement('section');section.id='kc-afford';section.innerHTML=`
 <h3>🛍️ Kann ich mir das leisten?</h3>
 <p class="muted">Prüfe deinen Kaufwunsch. Erst mit deiner Bestätigung wird eine Ausgabe gebucht.</p>
 <form id="kc-afford-form">
 <label>Was möchtest du kaufen?<input name="item" maxlength="100" required placeholder="z. B. Kopfhörer"></label>
 <label>Preis in €<input name="price" inputmode="decimal" required placeholder="80,00"></label>
 <button type="submit">Kauf prüfen</button></form>
 <div id="kc-afford-result" aria-live="polite"></div>`;
 home.appendChild(section);
 const form=section.querySelector('form'),result=section.querySelector('#kc-afford-result');
 async function current(){
  const {data:{user},error}=await db.auth.getUser();if(error)throw error;if(!user)throw Error('Bitte zuerst anmelden.');
  const [tx,goals,plans,entries]=await Promise.all([
   read(db.from('transactions').select('kind,amount_cents,category').eq('user_id',user.id).order('booked_on',{ascending:false}).limit(10000)),
   read(db.from('savings_goals').select('id,saved_cents').eq('user_id',user.id)),
   read(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',user.id)),
   read(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',user.id).not('plan_month','is',null))
  ]);
  const balance=tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);
  const saved=goals.reduce((n,g)=>n+Number(g.saved_cents),0);
  const month=new Date().toISOString().slice(0,7)+'-01';
  const done=new Set(entries.map(e=>e.goal_id+'|'+e.plan_month));
  const due=plans.filter(p=>!p.start_month||p.start_month<=month).reduce((n,p)=>n+(done.has(p.goal_id+'|'+month)?0:Number(p.monthly_cents)),0);
  return {user,balance,saved,due};
 }
 form.onsubmit=async e=>{
  e.preventDefault();latest=null;result.textContent='Prüfe deinen Kaufwunsch …';
  try{
   const item=String(new FormData(form).get('item')).trim(),price=toCents(new FormData(form).get('price'));
   if(!item)throw Error('Bitte Kaufwunsch eingeben.');
   const x=await current(),free=x.balance-x.saved-x.due;
   const level=price>x.balance?'🔴 Lieber nicht!':price>free?'🟡 Vorsicht!':'🟢 Passt!';
   const reason=price>x.balance?'Der Kauf übersteigt dein erfasstes Guthaben.':price>free?'Der Kauf könnte deine Ersparnisse oder geplanten Sparraten gefährden.':'Deine erfassten Rücklagen und Sparraten bleiben rechnerisch geschützt.';
   latest={item,price,userId:x.user.id};
   result.innerHTML=`<div class="item" style="display:block;margin-top:14px"><h3>${level}</h3>
   <p>${esc(reason)}</p><p>Erfasstes Guthaben: <b>${euro(x.balance)}</b><br>
   Für Sparziele zurückgelegt: ${euro(x.saved)}<br>Offene Monatsraten: ${euro(x.due)}<br>
   Frei verfügbar: <b>${euro(Math.max(0,free))}</b><br>
   Nach Kauf: <b>${euro(x.balance-price)}</b></p>
   <p class="muted">Die Rechnung basiert nur auf erfassten Buchungen. Bereits gespartes Geld wird als reserviert behandelt, sofern es nicht schon als Ausgabe gebucht wurde.</p>
   <button type="button" id="kc-afford-book">Kauf durchführen und als Ausgabe buchen</button></div>`;
   result.querySelector('#kc-afford-book').onclick=async()=>{
    const button=result.querySelector('#kc-afford-book');
    if(!latest)return;
    if(!window.confirm(`Möchtest du "${latest.item}" für ${euro(latest.price)} wirklich als Ausgabe buchen?`))return;
    button.disabled=true;
    try{
     const {data:{user}}=await db.auth.getUser();if(user?.id!==latest.userId)throw Error('Das Konto hat sich geändert.');
     const cats=await read(db.from('transaction_categories').select('name').eq('kind','expense').eq('active',true));
     const category=cats.some(c=>c.name==='Freizeit')?'Freizeit':cats[0]?.name;
     if(!category)throw Error('Keine Ausgabenkategorie vorhanden.');
     await read(db.from('transactions').insert({user_id:user.id,kind:'expense',amount_cents:latest.price,category,note:'Kaufcheck: '+latest.item,booked_on:new Date().toLocaleDateString('en-CA')}));
     latest=null;result.innerHTML='<p>✅ Kauf als Ausgabe gespeichert. Die Übersicht wird aktualisiert …</p>';
     setTimeout(()=>location.reload(),900);
    }catch(err){button.disabled=false;result.insertAdjacentHTML('beforeend','<p role="alert">'+esc(err.message)+'</p>')}
   };
  }catch(err){result.innerHTML='<p role="alert">'+esc(err.message)+'</p>'}
 };
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();