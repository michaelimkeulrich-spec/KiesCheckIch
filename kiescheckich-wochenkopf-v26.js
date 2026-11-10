(()=>{'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const day=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
let busy=false;
async function refresh(){if(busy)return;busy=true;try{const app=document.getElementById('app'),header=document.querySelector('main header');if(!app||app.hidden||!header)return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const [{data:parents},{data:admins}]=await Promise.all([db.from('kc_family_parents').select('user_id').eq('user_id',user.id).limit(1),db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1)]);
 let bar=document.getElementById('kc-weekly-header');if(parents?.length||admins?.length){bar?.remove();return}
 const start=new Date();start.setDate(start.getDate()-(start.getDay()+6)%7);const end=new Date(start);end.setDate(end.getDate()+6);
 const [{data:b,error:be},{data:tx,error:te}]=await Promise.all([db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',user.id).maybeSingle(),db.from('transactions').select('amount_cents,kind').eq('user_id',user.id).gte('booked_on',day(start)).lte('booked_on',day(end))]);if(be||te)throw be||te;
 const limit=Number(b?.limit_cents||0),spent=(tx||[]).filter(t=>t.kind==='expense').reduce((n,t)=>n+Number(t.amount_cents),0);
 if(!bar){bar=document.createElement('div');bar.id='kc-weekly-header';bar.setAttribute('role','status');bar.style.cssText='margin:10px auto;padding:10px;border-radius:9px;max-width:600px;font-weight:700';header.appendChild(bar)}
 if(!limit){bar.textContent='💶 Wochenlimit noch nicht festgelegt';bar.style.background='#e9eef1';bar.style.color='#223';return}
 const pct=spent/limit;bar.style.background=pct>=1?'#ffe0e0':pct>=.8?'#fff0cb':'#e0f3e9';bar.style.color=pct>=1?'#8b0000':pct>=.8?'#704600':'#14532d';bar.textContent=pct>=1?'⛔ Wochenlimit erreicht/überschritten: '+euro(spent)+' von '+euro(limit):pct>=.8?'⚠️ Wochenlimit fast erreicht: '+euro(spent)+' von '+euro(limit):'💶 Wochenbudget: '+euro(spent)+' von '+euro(limit)+' ausgegeben';
 }catch(e){console.warn('Wochenkopf:',e)}finally{busy=false}}
setInterval(refresh,4500);window.addEventListener('kc-weekly-refresh',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
