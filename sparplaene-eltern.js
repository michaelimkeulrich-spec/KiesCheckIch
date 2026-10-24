(()=>{'use strict';
const db=window.supabase.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=async q=>{const {data,error}=await q;if(error)throw error;return data};
let loading=false;
async function show(){const box=document.getElementById('parentBox');if(!box||box.hidden||loading)return;loading=true;
let area=document.getElementById('kc-parent-savings');if(!area){area=document.createElement('section');area.id='kc-parent-savings';box.appendChild(area)}
area.innerHTML='<h3>🎯 Sparpläne der Kinder</h3><p class="muted">Lade …</p>';
try{const {data:{user}}=await db.auth.getUser();if(!user)return;
const families=await get(db.from('kc_family_parents').select('family_id').eq('user_id',user.id));if(!families.length)return;
const children=await get(db.from('kc_family_children').select('user_id').in('family_id',families.map(f=>f.family_id)));
if(!children.length){area.innerHTML='<h3>🎯 Sparpläne der Kinder</h3><p>Keine Kinder sichtbar.</p>';return}
const ids=children.map(c=>c.user_id);
const [names,goals,plans,entries]=await Promise.all([
get(db.from('profiles').select('id,display_name').in('id',ids)),
get(db.from('savings_goals').select('id,user_id,title,target_cents,saved_cents').in('user_id',ids)),
get(db.from('kc_savings_plans').select('goal_id,monthly_cents,due_day').in('user_id',ids)),
get(db.from('kc_savings_entries').select('goal_id,plan_month').in('user_id',ids).not('plan_month','is',null))]);
const nm=new Map(names.map(n=>[n.id,n.display_name])),pm=new Map(plans.map(p=>[p.goal_id,p])),paid=new Set(entries.map(e=>e.goal_id+'|'+e.plan_month));
const d=new Date(),month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
area.innerHTML='<h3>🎯 Sparpläne der Kinder</h3><p class="muted">Nur zur Ansicht – Sparaufgaben bestätigt das Kind.</p>'+children.map(c=>{
const gs=goals.filter(g=>g.user_id===c.user_id);
return '<div class="item" style="display:block"><h4>'+safe(nm.get(c.user_id)||'Kind')+'</h4>'+(gs.length?gs.map(g=>{const p=pm.get(g.id);return '<div style="padding:10px 0"><b>'+safe(g.title)+'</b><p>'+money(g.saved_cents)+' / '+money(g.target_cents)+'</p><progress value="'+Math.min(Number(g.saved_cents),Number(g.target_cents))+'" max="'+Math.max(1,Number(g.target_cents))+'"></progress>'+(p?'<p class="muted">Monatlich '+money(p.monthly_cents)+' · fällig am '+p.due_day+'. · '+(paid.has(g.id+'|'+month)?'Diesen Monat bestätigt':'Diesen Monat noch nicht bestätigt')+'</p>':'<p class="muted">Noch kein monatlicher Sparplan.</p>')+'</div>'}).join(''):'<p class="muted">Noch keine Sparziele.</p>')+'</div>'}).join('');
}catch(e){area.innerHTML='<h3>Sparpläne der Kinder</h3><p class="warning">'+safe(e.message)+'</p>'}finally{loading=false}}
document.addEventListener('DOMContentLoaded',()=>{document.querySelector('[data-tab="family"]')?.addEventListener('click',()=>setTimeout(show,300));});
})();
