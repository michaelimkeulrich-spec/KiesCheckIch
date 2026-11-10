(()=>{'use strict';
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co',KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
if(!window.supabase)return;
const db=window.supabase.createClient(URL,KEY);
const euro=c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100);
let currentUser=null,loading=false,lastUpdate=0;
const weekStart=()=>{const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const endOfWeek=start=>{const d=new Date(start+'T12:00:00');d.setDate(d.getDate()+6);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
function ui(){const home=document.getElementById('home');if(!home)return null;let panel=document.getElementById('kc-weekly-budget');if(!panel){panel=document.createElement('section');panel.id='kc-weekly-budget';panel.className='card';home.appendChild(panel)}return panel}
async function update(force=false){
if(loading||(!force&&Date.now()-lastUpdate<3500))return;loading=true;lastUpdate=Date.now();
try{
const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user){document.getElementById('kc-weekly-budget')?.remove();currentUser=null;return}
const [{data:parentRows,error:parentError},{data:adminRows,error:adminError}]=await Promise.all([db.from('kc_family_parents').select('user_id').eq('user_id',user.id).limit(1),db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1)]);
if(parentError||adminError)throw parentError||adminError;
if(parentRows?.length||adminRows?.length){document.getElementById('kc-weekly-budget')?.remove();return}
currentUser=user.id;const panel=ui();if(!panel)return;
const start=weekStart(),end=endOfWeek(start);
const [{data:budget,error:budgetError},{data:tx,error:txError}]=await Promise.all([db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',user.id).maybeSingle(),db.from('transactions').select('amount_cents,kind').eq('user_id',user.id).gte('booked_on',start).lte('booked_on',end)]);
if(budgetError||txError)throw budgetError||txError;
const limit=Number(budget?.limit_cents||0),spent=(tx||[]).filter(t=>t.kind==='expense').reduce((s,t)=>s+Number(t.amount_cents),0),ratio=limit?spent/limit:0;
const warning=limit&&(ratio>=1?'⛔ Wochenlimit erreicht oder überschritten!':ratio>=.8?'⚠️ Achtung, dein Wochenlimit ist fast erreicht!':'');
panel.innerHTML='<h3>💶 Mein Wochenbudget</h3><p>Dein Limit gilt von Montag bis Sonntag.</p><form id="kc-weekly-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end"><label>Wochenlimit in Euro<input type="number" name="limit" min="0" max="1000000" step="0.01" required value="'+(limit/100).toFixed(2)+'"></label><button type="submit">Limit speichern</button></form>'+(limit?'<p><b>Diese Woche ausgegeben: '+euro(spent)+' von '+euro(limit)+'</b></p><progress style="width:100%" value="'+Math.min(100,Math.round(ratio*100))+'" max="100"></progress><p>Diese Woche noch verfügbar: <b>'+euro(Math.max(0,limit-spent))+'</b></p>':'<p>Lege dein Wochenlimit fest. Mit 0 € schaltest du die Überwachung aus.</p>')+(warning?'<p role="alert" style="font-weight:bold">'+warning+'</p>':'');
panel.querySelector('form').onsubmit=async e=>{e.preventDefault();const input=e.currentTarget.elements.limit;const cents=Math.round(Number(input.value)*100);if(!Number.isSafeInteger(cents)||cents<0||cents>100000000){alert('Bitte gültiges Wochenlimit eingeben.');return}const button=e.currentTarget.querySelector('button');button.disabled=true;const {error}=await db.from('kc_weekly_budgets').upsert({user_id:currentUser,limit_cents:cents,updated_at:new Date().toISOString()},{onConflict:'user_id'});button.disabled=false;if(error){alert('Wochenlimit konnte nicht gespeichert werden: '+error.message);return}await update(true)};
}catch(err){const panel=ui();if(panel)panel.innerHTML='<h3>💶 Mein Wochenbudget</h3><p>Wochenbudget konnte nicht geladen werden: '+String(err.message||err).replace(/[<>&]/g,'')+'</p>'}finally{loading=false}
}
setInterval(()=>{const app=document.getElementById('app');if(app&&!app.hidden)update()},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update(true)});
document.addEventListener('click',e=>{if(e.target.closest?.('#txForm button[type="submit"], #txForm button:not([type]), [data-tab="home"]'))setTimeout(()=>update(true),900)});
})();
