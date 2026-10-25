/* KiesCheckIch V2.3 – zusätzliche Elternkonten; Kinderbereich unverändert. */
(()=>{'use strict';
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co';
const KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
const db=window.supabase?.createClient(URL,KEY);
if(!db)return;
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const call=async(name,args)=>{const {data,error}=await db.rpc(name,args);if(error)throw error;return data};
let active=false;
async function offerJoin(){
 const token=new URLSearchParams(location.search).get('parent_join');
 if(!token||$('kc-parent-join'))return;
 const box=document.createElement('section');box.id='kc-parent-join';box.className='card';
 box.innerHTML='<h2>👨‍👩‍👧 Einladung als Elternteil</h2><p>Melde dich mit der E-Mail-Adresse an, an die die Einladung gerichtet ist. Nach der Anmeldung kannst du die bestehende Familie übernehmen – ohne Daten zu kopieren.</p><button type="button" id="kc-parent-accept">Der Familie beitreten</button><p id="kc-parent-join-status" role="status"></p>';
 ($('app')||$('loginPanel'))?.after(box);
 $('kc-parent-accept').onclick=async()=>{
  const status=$('kc-parent-join-status');
  try{
   const {data:{user}}=await db.auth.getUser();if(!user)throw Error('Bitte zuerst anmelden und dann erneut auf „Der Familie beitreten“ klicken.');
   $('kc-parent-accept').disabled=true;
   status.textContent=await call('kc_accept_second_parent',{p_token:token});
   history.replaceState(null,'',location.pathname);
   setTimeout(()=>location.reload(),900);
  }catch(e){status.textContent='Beitritt nicht möglich: '+e.message;$('kc-parent-accept').disabled=false;}
 };
}
async function showInvite(){
 const root=$('kc-parent-family');if(!root||!document.body.classList.contains('kc-parent-mode'))return;
 if($('kc-v23-parent-invite'))return;
 const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {data:families,error}=await db.from('kc_family_parents').select('family_id,kc_families(name)').eq('user_id',user.id);
 if(error||!families?.length)return;
 const section=document.createElement('section');section.id='kc-v23-parent-invite';
 section.innerHTML='<hr><h3>👥 Weiteren Elternteil einladen</h3><p>Der eingeladene Elternteil erhält denselben Lesezugriff auf die Kinder dieser Familie.</p><form id="kc-v23-parent-form"><label>Familie<select name="family_id" required></select></label><label>E-Mail des zweiten Elternteils<input type="email" name="email" required></label><button type="submit">Einladungslink erstellen</button></form><div id="kc-v23-parent-result" aria-live="polite"></div>';
 const sel=section.querySelector('select');
 families.forEach(f=>{const o=document.createElement('option');o.value=f.family_id;o.textContent=f.kc_families?.name||'Meine Familie';sel.appendChild(o)});
 section.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const result=$('kc-v23-parent-result');const btn=section.querySelector('button');btn.disabled=true;
  try{
   const fd=new FormData(e.target);
   const token=await call('kc_invite_second_parent',{p_family:fd.get('family_id'),p_email:fd.get('email')});
   const link=new URL(location.origin+location.pathname);link.searchParams.set('parent_join',token);
   result.innerHTML='<p>Einladung erstellt (7 Tage gültig). Kopiere den Link und sende ihn ausschließlich an die eingeladene Person:</p><p class="invite"><a id="kc-v23-link" rel="noopener noreferrer" target="_blank"></a></p><button type="button" id="kc-v23-copy" class="secondary">Link kopieren</button>';
   $('kc-v23-link').href=link.href;$('kc-v23-link').textContent=link.href;
   $('kc-v23-copy').onclick=()=>navigator.clipboard.writeText(link.href).then(()=>{$('kc-v23-copy').textContent='Kopiert!'}).catch(()=>{result.insertAdjacentHTML('beforeend','<p>Bitte Link markieren und kopieren.</p>')});
  }catch(err){result.textContent='Einladung fehlgeschlagen: '+err.message}finally{btn.disabled=false}
 };
 root.appendChild(section);
}
function init(){offerJoin();setInterval(()=>{if(document.body.classList.contains('kc-parent-mode'))showInvite().catch(console.error)},1200)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
