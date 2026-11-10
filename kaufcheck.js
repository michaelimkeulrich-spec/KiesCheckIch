(()=>{'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(n/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=async q=>{const {data,error}=await q;if(error)throw error;return data};
const cents=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte gültigen Betrag eingeben.');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Der Betrag muss größer als null sein.');return n};
const date=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const monday=()=>{const d=new Date();d.setDate(d.getDate()-(d.getDay()+6)%7);return date(d)};
async function state(){const {data:{user},error}=await db.auth.getUser();if(error)throw error;if(!user)throw Error('Bitte anmelden.');
const [tx,goals,plans,entries,budget,weekly]=await Promise.all([
read(db.from('transactions').select('kind,amount_cents').eq('user_id',user.id).limit(10000)),
read(db.from('savings_goals').select('id,saved_cents').eq('user_id',user.id)),
read(db.from('kc_savings_plans').select('goal_id,monthly_cents,start_month').eq('user_id',user.id)),
read(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',user.id).not('plan_month','is',null)),
read(db.from('kc_weekly_budgets').select('limit_cents').eq('user_id',user.id).maybeSingle()),
read(db.from('transactions').select('kind,amount_cents').eq('user_id',user.id).gte('booked_on',monday()).lte('booked_on',date(new Date())))
]);
const balance=tx.reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount_cents),0),saved=goals.reduce((n,g)=>n+Number(g.saved_cents),0);
const month=date(new Date()).slice(0,7)+'-01',done=new Set(entries.map(e=>e.goal_id+'|'+e.plan_month));
const due=plans.filter(p=>!p.start_month||p.start_month<=month).reduce((n,p)=>n+(done.has(p.goal_id+'|'+month)?0:Number(p.monthly_cents)),0);
return {user,balance,saved,due,limit:Number(budget?.limit_cents||0),spent:weekly.filter(t=>t.kind==='expense').reduce((n,t)=>n+Number(t.amount_cents),0)};
}
function assess(s,price){const after=s.spent+price,over=s.limit>0&&after>s.limit,near=s.limit>0&&after>=s.limit*.8;
const balanceFail=price>s.balance,savingsFail=price>s.balance-s.saved-s.due;
return {after,over,near,level:over||balanceFail?'🔴 Lieber nicht!':near||savingsFail?'🟡 Vorsicht!':'🟢 Passt!',reasons:[over?`Der Kauf würde dein Wochenlimit um ${euro(after-s.limit)} überschreiten.`:s.limit>0&&near?'Mit diesem Kauf erreichst du mindestens 80 % deines Wochenlimits.':'',balanceFail?'Der Kauf übersteigt dein erfasstes Guthaben.':'',savingsFail?'Der Kauf könnte deine Sparziele oder geplanten Sparraten gefährden.':''].filter(Boolean)};
}
function init(){const home=document.getElementById('home');if(!home)return;document.getElementById('kc-afford')?.remove();const section=document.createElement('section');section.id='kc-afford';section.innerHTML='<h3>🛍️ Kann ich mir das leisten?</h3><p class="muted">Prüfe deinen Kaufwunsch. Erst mit deiner Bestätigung wird eine Ausgabe gebucht.</p><form id="kc-afford-form"><label>Was möchtest du kaufen?<input name="item" maxlength="100" required placeholder="z. B. Kopfhörer"></label><label>Preis in €<input name="price" inputmode="decimal" required placeholder="80,00"></label><button type="submit">Kauf prüfen</button></form><div id="kc-afford-result" aria-live="polite"></div>';home.appendChild(section);
const form=section.querySelector('form'),result=section.querySelector('#kc-afford-result');let latest=null;
form.onsubmit=async e=>{e.preventDefault();latest=null;result.textContent='Prüfe deinen Kaufwunsch …';try{const f=new FormData(form),item=String(f.get('item')||'').trim(),price=cents(f.get('price'));if(!item)throw Error('Bitte Kaufwunsch eingeben.');const s=await state(),a=assess(s,price);latest={item,price,userId:s.user.id};
result.innerHTML=`<div class="item" style="display:block;margin-top:14px"><h3>${a.level}</h3>${a.reasons.length?a.reasons.map(x=>`<p role="alert"><b>${esc(x)}</b></p>`).join(''):'<p>Guthaben, Sparziele und Wochenbudget erlauben den Kauf rechnerisch.</p>'}<p>Wochenlimit: <b>${s.limit?euro(s.limit):'Nicht eingestellt'}</b><br>Diese Woche ausgegeben: ${euro(s.spent)}<br>Nach dem geplanten Kauf: <b>${euro(a.after)}</b><br>${s.limit?`Verbleibendes Wochenbudget: <b>${euro(s.limit-a.after)}</b><br>`:''}Erfasstes Guthaben: ${euro(s.balance)}<br>Für Sparziele zurückgelegt: ${euro(s.saved)}<br>Offene Monatsraten: ${euro(s.due)}<br>Frei verfügbar: ${euro(Math.max(0,s.balance-s.saved-s.due))}<br>Guthaben nach Kauf: ${euro(s.balance-price)}</p><p class="muted">Nur erfasste Buchungen werden berücksichtigt. Das Wochenlimit gilt Montag bis Sonntag.</p><button type="button" id="kc-afford-book">Kauf durchführen und als Ausgabe buchen</button></div>`;
result.querySelector('#kc-afford-book').onclick=async()=>{const b=result.querySelector('#kc-afford-book');if(!latest)return;b.disabled=true;try{const now=await state();if(now.user.id!==latest.userId)throw Error('Das Konto hat sich geändert.');const check=assess(now,latest.price);const warning=check.over?`ACHTUNG: Das Wochenlimit wird um ${euro(check.after-now.limit)} überschritten!\n\n`:check.near?'Achtung: Das Wochenbudget ist fast ausgeschöpft.\n\n':'';if(!confirm(`${warning}Möchtest du „${latest.item}“ für ${euro(latest.price)} wirklich buchen?`)){b.disabled=false;return}
const cats=await read(db.from('transaction_categories').select('name').eq('kind','expense').eq('active',true));const category=cats.some(c=>c.name==='Freizeit')?'Freizeit':cats[0]?.name;if(!category)throw Error('Keine Ausgabenkategorie vorhanden.');await read(db.from('transactions').insert({user_id:now.user.id,kind:'expense',amount_cents:latest.price,category,note:'Kaufcheck: '+latest.item,booked_on:date(new Date())}));latest=null;result.innerHTML='<p>✅ Kauf gebucht. Übersicht wird aktualisiert …</p>';setTimeout(()=>location.reload(),900)}catch(err){b.disabled=false;result.insertAdjacentHTML('beforeend',`<p role="alert">${esc(err.message)}</p>`)}};
}catch(err){result.innerHTML=`<p role="alert">${esc(err.message)}</p>`}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
