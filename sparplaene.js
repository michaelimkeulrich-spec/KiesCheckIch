(()=>{
'use strict';
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co';
const KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
const db=window.supabase.createClient(URL,KEY);
const euro=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const toCents=v=>{let s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Ungültiger Betrag');let n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n<=0)throw Error('Betrag muss größer als 0 sein');return n};
const check=async p=>{const {data,error}=await p;if(error)throw Error(error.message);return data};
const monthName=s=>new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(new Date(s+'T12:00:00'));
let busy=false;
function panel(){let p=document.getElementById('kc-savings-plans');if(!p){p=document.createElement('section');p.id='kc-savings-plans';document.getElementById('goalList').after(p)}return p}
async function render(){
 if(busy||document.getElementById('app')?.hidden)return;
 busy=true;const root=panel();root.innerHTML='<h3>📅 Sparpläne & Sparaufgaben</h3><p class="muted">Lade …</p>';
 try{
  const {data:{user}}=await db.auth.getUser();
  if(!user){root.innerHTML='';return}
  const [goals,plans,entries]=await Promise.all([
   check(db.from('savings_goals').select('id,title,target_cents,saved_cents,target_date').eq('user_id',user.id).order('created_at',{ascending:false})),
   check(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day,start_month').eq('user_id',user.id)),
   check(db.from('kc_savings_entries').select('goal_id,plan_month').eq('user_id',user.id).not('plan_month','is',null))
  ]);
  const planMap=new Map(plans.map(p=>[p.goal_id,p])),paid=new Set(entries.map(e=>e.goal_id+'|'+e.plan_month));
  const current=now().slice(0,7),today=now();
  root.innerHTML='<h3>📅 Sparpläne & Sparaufgaben</h3><p class="muted">Geplante Raten werden nicht automatisch als gespart gebucht. Du bestätigst jede Sparaufgabe selbst.</p>'+
   (goals.length?goals.map(g=>{
    const p=planMap.get(g.id),remaining=Math.max(0,Number(g.target_cents)-Number(g.saved_cents));
    let part='';
    if(p){
     let month=p.start_month.slice(0,7),tasks=[],count=0;
     while(month<=current&&count++<36){
      const due=month+'-'+String(p.due_day).padStart(2,'0');
      if(due<=today&&!paid.has(g.id+'|'+month+'-01'))tasks.push(month+'-01');
      const d=new Date(month+'-01T12:00:00');d.setMonth(d.getMonth()+1);month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
     }
     part='<p class="muted">Monatlich '+euro(p.monthly_cents)+' · fällig am '+p.due_day+'. · '+(remaining?`Noch ${Math.ceil(remaining/Number(p.monthly_cents))} Raten bis zum Ziel (bei voller Zahlung).`:'Ziel erreicht!')+'</p>'+
      (tasks.length?tasks.map(m=>'<div class="item"><span>🔔 '+esc(monthName(m))+' · '+euro(p.monthly_cents)+'</span><button type="button" data-confirm="'+esc(g.id)+'" data-month="'+m+'" data-amount="'+esc(p.monthly_cents)+'">Sparaufgabe bestätigen</button></div>').join(''):'<p class="muted">Keine fällige Sparaufgabe offen.</p>');
    }else part='<form class="kc-plan" data-goal="'+esc(g.id)+'"><label>Monatlich sparen (€)<input name="amount" inputmode="decimal" placeholder="20,00" required></label><label>Fälligkeitstag (1–28)<input type="number" name="day" min="1" max="28" value="1" required></label><button class="secondary">Regelmäßigen Sparplan anlegen</button></form>';
    return '<div class="item" style="display:block"><h3>'+esc(g.title)+'</h3><p>Gespart: '+euro(g.saved_cents)+' · noch offen: '+euro(remaining)+'</p>'+
     '<form class="kc-once" data-goal="'+esc(g.id)+'"><label>Spontan Geld zuordnen (€)<input name="amount" inputmode="decimal" placeholder="5,00" required></label><button>Jetzt sparen</button></form>'+part+'</div>';
   }).join(''):'<p class="muted">Lege oben zunächst ein Sparziel an.</p>');
  root.querySelectorAll('.kc-once').forEach(f=>f.addEventListener('submit',async e=>{
   e.preventDefault();await act(async()=>check(db.rpc('kc_save_to_goal',{p_goal:f.dataset.goal,p_amount:toCents(new FormData(f).get('amount')),p_month:null})));
  }));
  root.querySelectorAll('.kc-plan').forEach(f=>f.addEventListener('submit',async e=>{
   e.preventDefault();await act(async()=>check(db.from('kc_savings_plans').insert({goal_id:f.dataset.goal,user_id:user.id,monthly_cents:toCents(new FormData(f).get('amount')),due_day:Number(new FormData(f).get('day')),start_month:current+'-01'})));
  }));
  root.querySelectorAll('[data-confirm]').forEach(b=>b.addEventListener('click',async()=>{
   await act(async()=>check(db.rpc('kc_save_to_goal',{p_goal:b.dataset.confirm,p_amount:Number(b.dataset.amount),p_month:b.dataset.month})));
  }));
 }catch(e){root.innerHTML='<h3>Sparpläne</h3><p class="warning">'+esc(e.message)+'</p>'}
 finally{busy=false}
}
async function act(fn){
 try{await fn();sessionStorage.setItem('kc-open-savings','1');location.reload()}
 catch(e){alert('KiesCheckIch: '+e.message)}
}
document.addEventListener('DOMContentLoaded',()=>{
 document.querySelector('[data-tab="savings"]')?.addEventListener('click',()=>setTimeout(render,100));
 if(sessionStorage.getItem('kc-open-savings')){sessionStorage.removeItem('kc-open-savings');setTimeout(()=>{if(!document.getElementById('app').hidden){document.querySelector('[data-tab="savings"]').click();render()}},1300)}
});
})();