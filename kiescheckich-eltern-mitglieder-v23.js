(()=>{'use strict';
const db=window.supabase?.createClient('https://dlvcfaplkidgcsvyiiai.supabase.co','sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN');
if(!db)return;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,last=0;
async function refresh(){
 const box=document.getElementById('kc-parent-family');
 if(!box||!document.body.classList.contains('kc-parent-mode')||busy||Date.now()-last<2000)return;
 busy=true;last=Date.now();
 try{
  const {data,error}=await db.rpc('kc_parent_family_members');if(error)throw error;
  const rows=data||[];
  let panel=document.getElementById('kc-parent-members');
  if(!panel){panel=document.createElement('section');panel.id='kc-parent-members';box.insertBefore(panel,box.children[1]||null)}
  const {data:auth}=await db.auth.getUser();const me=auth?.user?.id;
  panel.innerHTML='<h3>👥 Eltern</h3>'+(rows.length?rows.map(r=>'<div class="item"><div><b>'+esc(r.parent_name||'Elternteil')+(r.parent_id===me?' (du)':'')+'</b><br><small>'+esc(r.parent_email)+'</small></div></div>').join(''):'<p>Keine Elternkonten gefunden.</p>');
 }catch(e){let panel=document.getElementById('kc-parent-members');if(panel)panel.textContent='Eltern konnten nicht geladen werden: '+e.message}
 finally{busy=false}
}
setInterval(refresh,1800);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=0;refresh()}});
})();
