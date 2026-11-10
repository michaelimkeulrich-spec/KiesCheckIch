(()=>{'use strict';
const db=window.supabase?.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');if(!db)return;
const euro=c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100);
const day=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const monday=()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return day(d)};
let loading=false,saving=false,last=0,uid=null;
async function update(force=false){
 const app=document.getElementById('app');if(!app||app.hidden||loading||saving||(!force&&Date.now()-last<12000))return;
 const existing=document.getElementById('kc-weekly-budget');if(existing?.contains(document.activeElement))return;
 loading=true;last=Date.now();
 try{
 const {data:{user},error:ae}=await db.auth.getUser();if(ae)throw ae;
 if(!user){existing?.remove();return}
 const [pr,ar]=await Promise.all([db.from('kc_family_parents').select('user_id').eq('user_id',user.id).limit(1),db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1)]);
 if(pr.error||ar.error)throw pr.error||ar.error;
 if(pr.data?.length||ar.data?.length){existing?.remove();return}
 uid=user.id;
 let panel=document.getElementById('kc-weekly-budget');if(!panel){panel=document.createElement('section');panel.id='kc-weekly-budget';panel.className='card';document.getElementById('home')?.appendChild(panel)}if(!panel)return;
 const start=monday(),end=new Date(start+'T12:00:00');end.setDate(end.getDate()+6);
 const [br,tr]=await Promise.all([db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',uid).maybeSingle(),db.from('transactions').select('amount_cents,kind').eq('user_id',uid).gte('booked_on',start).lte('booked_on',day(end))]);
 if(br.error||tr.error)throw br.error||tr.error;
 if(panel.contains(document.activeElement))return;
 const limit=Number(br.data?.limit_cents||0),spent=(tr.data||[]).filter(t=>t.kind==='expense').reduce((s,t)=>s+Number(t.amount_cents),0);
 const ratio=limit?spent/limit:0;
 panel.innerHTML='<h3>💶 Mein Wochenbudget</h3><p>Dein Limit gilt von Montag bis Sonntag und kann jederzeit geändert werden.</p><form id="kc-weekly-form"><label>Wochenlimit in Euro<input type="number" name="limit" min="0" max="1000000" step="0.01" required value="'+(limit/100).toFixed(2)+'"></label><button type="submit">Limit speichern</button></form>'+(limit?'<p><b>Diese Woche ausgegeben: '+euro(spent)+' von '+euro(limit)+'</b></p><progress style="width:100%" value="'+Math.min(100,Math.round(ratio*100))+'" max="100"></progress><p>Diese Woche noch verfügbar: <b>'+euro(Math.max(0,limit-spent))+'</b></p>':'<p>Mit 0 € schaltest du die Überwachung aus.</p>')+(ratio>=1?'⛔ Wochenlimit erreicht oder überschritten!':ratio>=.8?'⚠️ Wochenlimit fast erreicht!':'');
 panel.querySelector('form').addEventListener('submit',async e=>{
 e.preventDefault();if(saving)return;const form=e.currentTarget,input=form.elements.namedItem('limit'),amount=Number(input.value),cents=Math.round(amount*100);
 if(!Number.isFinite(amount)||!Number.isSafeInteger(cents)||cents<0||cents>100000000){alert('Bitte gültiges Wochenlimit eingeben.');return}
 saving=true;const button=form.querySelector('button');button.disabled=true;
 try{const {error}=await db.from('kc_weekly_budgets').upsert({user_id:uid,limit_cents:cents,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;
 input.blur();last=0;
 }catch(err){alert('Wochenlimit konnte nicht gespeichert werden: '+err.message);button.disabled=false;return}finally{saving=false}
 await update(true);
 });
 }catch(err){let panel=document.getElementById('kc-weekly-budget');if(panel&&!panel.contains(document.activeElement))panel.textContent='Wochenbudget konnte nicht geladen werden: '+err.message}
 finally{loading=false}
}
setInterval(()=>update(),5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update(true)});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab="home"],#txForm button'))setTimeout(()=>update(true),900)});
})();
