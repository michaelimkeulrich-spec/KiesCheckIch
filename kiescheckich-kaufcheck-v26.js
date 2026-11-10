(()=>{'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=c=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(c/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const start=()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return date(d)};
const end=()=>{const d=new Date(start()+'T12:00:00');d.setDate(d.getDate()+6);return date(d)};
const parse=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Ungültiger Betrag');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Preis muss größer als null sein');return n};
async function snapshot(){
 const {data:{user},error}=await db.auth.getUser();if(error)throw error;if(!user)throw Error('Bitte anmelden');
 const [budget,weekly,tx,goals,plans,entries]=await Promise.all([
 read(db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',user.id).maybeSingle()),
 read(db.from('transactions').select('kind,amount_cents').eq('user_id',user.id).gte('booked_on',start()).lte('booked_on',end())),
 read(db.from('transactions').select('kind,amount_cents').eq('user_id',user.id).order('booked_on',{ascending:false}).limit(10000)),
 read(db.from('savings_goals').select('saved_cents').eq('user_id',user.id)),
 read(db.from('kc_savings_plans').select('goal_id,monthly_cents,start_month').eq('user_id',user.id)),
 read(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',user.id).not('plan_month','is',null))]);
 const limit=Number(budget?.limit_cents||0),spent=weekly.filter(t=>t.kind==='expense').reduce((n,t)=>n+Number(t.amount_cents),0);
 const balance=tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0),saved=goals.reduce((n,g)=>n+Number(g.saved_cents),0);
 const month=date(new Date()).slice(0,7)+'-01',done=new Set(entries.map(e=>e.goal_id+'|'+e.plan_month));
 const due=plans.filter(p=>!p.start_month||p.start_month<=month).reduce((n,p)=>n+(done.has(p.goal_id+'|'+month)?0:Number(p.monthly_cents)),0);
 return {user,limit,spent,balance,saved,due};
}
function verdict(x,price){const projected=x.spent+price;const exceeds=x.limit>0&&projected>x.limit,near=x.limit>0&&projected>=x.limit*.8;
 const free=x.balance-x.saved-x.due;
 return {projected,exceeds,near,free,red:exceeds||price>x.balance,yellow:near||price>free};}
function init(){const form=document.getElementById('kc-afford-form'),result=document.getElementById('kc-afford-result');if(!form||!result)return;
 // Capture prevents the original purchase checker from approving a purchase without weekly-limit validation.
 form.addEventListener('submit',async e=>{e.preventDefault();e.stopImmediatePropagation();result.textContent='Prüfe Guthaben, Sparziele und Wochenlimit …';
 try{const f=new FormData(form),item=String(f.get('item')||'').trim(),price=parse(f.get('price'));if(!item)throw Error('Kaufwunsch fehlt');const x=await snapshot(),v=verdict(x,price);
 const reason=v.exceeds?'⛔ Wochenlimit würde um '+euro(v.projected-x.limit)+' überschritten!':v.red?'⛔ Dein Guthaben reicht nicht.':v.yellow?'⚠️ Achtung: Wochenbudget fast aufgebraucht oder Sparziele gefährdet.':'✅ Kauf liegt innerhalb deines Wochenlimits und deiner verfügbaren Mittel.';
 result.innerHTML='<div class="item" style="display:block"><h3>'+(v.red?'🔴 Nicht empfohlen':v.yellow?'🟡 Vorsicht':'🟢 Passt')+'</h3><p role="alert"><b>'+reason+'</b></p>'+(x.limit?'<p>Wochenlimit: <b>'+euro(x.limit)+'</b><br>Bereits diese Woche ausgegeben: '+euro(x.spent)+'<br>Mit diesem Kauf: <b>'+euro(v.projected)+'</b><br>Rest nach Kauf: <b>'+euro(x.limit-v.projected)+'</b></p>':'<p>Kein Wochenlimit festgelegt.</p>')+'<p>Guthaben: '+euro(x.balance)+' · Frei nach Sparzielen: '+euro(Math.max(0,v.free))+'</p><button type="button" id="kc-v26-book">Kauf trotzdem durchführen und buchen</button></div>';
 const button=document.getElementById('kc-v26-book');button.textContent=v.red?'Trotz Warnung kaufen und buchen':'Kauf durchführen und buchen';
 button.onclick=async()=>{button.disabled=true;try{const fresh=await snapshot();if(fresh.user.id!==x.user.id)throw Error('Benutzer gewechselt');const now=verdict(fresh,price);
 const message=now.exceeds?'ACHTUNG: Dein Wochenlimit von '+euro(fresh.limit)+' wird durch diesen Kauf um '+euro(now.projected-fresh.limit)+' überschritten. Trotzdem als Ausgabe buchen?':now.red?'Dein Guthaben reicht nicht. Trotzdem buchen?':now.yellow?'Warnung: Dein Budget oder deine Sparziele sind gefährdet. Trotzdem buchen?':'Kauf für '+euro(price)+' buchen?';
 if(!window.confirm(message)){button.disabled=false;return}
 const cats=await read(db.from('transaction_categories').select('name').eq('kind','expense').eq('active',true));const category=cats.some(c=>c.name==='Freizeit')?'Freizeit':cats[0]?.name;if(!category)throw Error('Keine Ausgabenkategorie vorhanden');
 await read(db.from('transactions').insert({user_id:x.user.id,kind:'expense',amount_cents:price,category,note:'Kaufcheck: '+item,booked_on:date(new Date())}));result.textContent='✅ Kauf gebucht. Wochenbudget wird aktualisiert.';window.dispatchEvent(new Event('kc-weekly-refresh'));setTimeout(()=>location.reload(),700);
 }catch(err){button.disabled=false;result.insertAdjacentHTML('beforeend','<p role="alert">'+esc(err.message)+'</p>')}};
 }catch(err){result.innerHTML='<p role="alert">'+esc(err.message)+'</p>'}
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
