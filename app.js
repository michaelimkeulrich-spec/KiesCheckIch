(()=>{'use strict';
// Einladungen in eigenständiger Sitzung öffnen; Eltern-Anmeldung bleibt erhalten.
const invitation=new URLSearchParams(location.search).get('invite');
if(invitation){location.replace('/einladung.html?invite='+encodeURIComponent(invitation));return}
// Alte, automatisch angenommene Einladungen nicht erneut auf dem Elternkonto versuchen.
localStorage.removeItem('kc_pending_invite');
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co',KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
const $=s=>document.querySelector(s),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(Number(n)/100);
const cents=v=>{const s=String(v).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('Bitte gültigen Betrag eingeben');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n))throw Error('Betrag zu groß');return n};
const msg=(s,error=false)=>{$('#status').textContent=s;$('#status').classList.toggle('error',error);if(error)window.scrollTo({top:0,behavior:'smooth'})};
if(!window.supabase){msg('Supabase konnte nicht geladen werden. Internet prüfen.',true);return}
const db=window.supabase.createClient(URL,KEY);
const pendingKey='kc_pending_invite';
const getPendingInvite=()=>{try{return JSON.parse(localStorage.getItem(pendingKey)||'null')}catch{return null}};
const clearPendingInvite=()=>localStorage.removeItem(pendingKey);
let user=null,tx=[],goals=[],cats=[],families=[],children=[],isAdmin=false;
const invoke=async(action,body={})=>{const {data,error}=await db.functions.invoke('admin-api',{body:{action,...body}});if(error){let detail=data?.error;if(!detail&&error.context?.json){try{const result=await error.context.json();detail=result?.error}catch{}}throw Error(detail||error.message)}if(data?.error)throw Error(data.error);return data};
const check=async(p)=>{const {data,error}=await p;if(error)throw Error(error.message);return data};
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const renderTx=items=>items.length?items.map(t=>`<div class="item"><span><b>${safe(t.category)}</b><br><small>${safe(t.booked_on)} · ${safe(t.note)}</small></span><b>${t.kind==='income'?'+':'−'}${money(t.amount_cents)}</b></div>`).join(''):'<p class="muted">Noch keine Buchungen.</p>';
async function loadMoney(){[tx,goals,cats]=await Promise.all([
 check(db.from('transactions').select('id,user_id,amount_cents,kind,category,note,booked_on').eq('user_id',user.id).order('booked_on',{ascending:false}).limit(500)),
 check(db.from('savings_goals').select('id,title,target_cents,saved_cents').eq('user_id',user.id).order('created_at',{ascending:false}).limit(200)),
 check(db.from('transaction_categories').select('kind,name').eq('active',true).order('sort_order'))]);
 const sum=tx.reduce((s,t)=>s+(t.kind==='income'?1:-1)*Number(t.amount_cents),0);$('#balance').textContent=money(sum);$('#recent').innerHTML=renderTx(tx.slice(0,5));$('#allTx').innerHTML=renderTx(tx);
 $('#goalList').innerHTML=goals.length?goals.map(g=>`<div class="item"><div style="flex:1"><b>${safe(g.title)}</b><p>${money(g.saved_cents)} / ${money(g.target_cents)}</p><progress value="${Math.min(Number(g.saved_cents),Number(g.target_cents))}" max="${Number(g.target_cents)}"></progress></div></div>`).join(''):'<p class="muted">Noch keine Sparziele.</p>';
 renderCategories();}
function renderCategories(){const kind=$('#txForm [name=kind]').value;const list=cats.filter(c=>c.kind===kind);$('#category').innerHTML=list.map(c=>`<option value="${safe(c.name)}">${safe(c.name)}</option>`).join('')||'<option>Sonstiges</option>'}
async function loadFamily(){families=await check(db.from('kc_family_parents').select('family_id,kc_families(id,name)').eq('user_id',user.id));children=await check(db.from('kc_family_children').select('user_id,birth_date,family_id').in('family_id',families.length?families.map(f=>f.family_id):['00000000-0000-0000-0000-000000000000']));
 $('#familyList').innerHTML=families.length?families.map(f=>`<p><b>${safe(f.kc_families?.name||'Familie')}</b> – ${children.filter(c=>c.family_id===f.family_id).length} Kinder angemeldet</p>`).join(''):'<p class="muted">Noch kein Elternkonto verknüpft. Falls du eingeladen wurdest, löse unten deinen Einladungscode ein.</p>';
 const ownChildRows=await check(db.from('kc_family_children').select('family_id,birth_date').eq('user_id',user.id));
 const isChild=ownChildRows.length>0 && families.length===0;
 const familyTab=document.querySelector('[data-tab="family"]');
 familyTab.hidden=isChild;
 if(isChild){
   const familyInfo=document.getElementById('childFamilyInfo')||document.createElement('div');
   familyInfo.id='childFamilyInfo';
   familyInfo.innerHTML='<h3>Mein Familienkonto</h3><p>Du bist mit einer Familie verbunden. Deine Eltern verwalten die Familienkonten.</p>';
   $('#home').appendChild(familyInfo);
   if(nameEditor.parentElement!==$('#home'))$('#home').appendChild(nameEditor);
   $('#acceptBox').hidden=true;
   if($('#family').hidden){document.querySelector('[data-tab="home"]').click()}
 }else{
   document.getElementById('childFamilyInfo')?.remove();
   if(nameEditor.parentElement!==$('#family'))$('#family').insertBefore(nameEditor,$('#familyList').nextSibling);
   $('#acceptBox').hidden=!!families.length;
 }
 $('#parentBox').hidden=!families.length;$('#familyChoice').innerHTML=families.map(f=>`<option value="${f.family_id}">${safe(f.kc_families?.name||'Familie')}</option>`).join('');
 const childNames=children.length?await check(db.from('profiles').select('id,display_name').in('id',children.map(c=>c.user_id))):[];
 const namesById=new Map(childNames.map(p=>[p.id,p.display_name]));
 $('#childChoice').innerHTML=children.map(c=>`<option value="${c.user_id}">${safe(namesById.get(c.user_id)||'Kind '+c.user_id.slice(0,8))} · ${safe(c.birth_date)}</option>`).join('');
 await loadChildFinance();}
async function loadChildFinance(){if(!children.length){$('#childFinance').innerHTML='<p class="muted">Noch keine Kinderkonten verbunden.</p>';return}
 const ids=children.map(c=>c.user_id);const nameRows=await check(db.from('profiles').select('id,display_name').in('id',ids));const namesById=new Map(nameRows.map(p=>[p.id,p.display_name]));const all=await check(db.from('transactions').select('user_id,amount_cents,kind,category,note,booked_on').in('user_id',ids).order('booked_on',{ascending:false}).limit(500));
 const gs=await check(db.from('savings_goals').select('user_id,title,target_cents,saved_cents').in('user_id',ids));
 $('#childFinance').innerHTML=children.map(c=>{const t=all.filter(x=>x.user_id===c.user_id),g=gs.filter(x=>x.user_id===c.user_id),sum=t.reduce((s,x)=>s+(x.kind==='income'?1:-1)*Number(x.amount_cents),0);return `<details><summary><b>${safe(namesById.get(c.user_id)||'Kind '+c.user_id.slice(0,8))}</b> · ${money(sum)} · ${t.length} Buchungen</summary><h4>Buchungen</h4>${renderTx(t)}<h4>Sparziele</h4>${g.map(x=>`<p>${safe(x.title)}: ${money(x.saved_cents)} / ${money(x.target_cents)}</p>`).join('')||'Keine'}</details>`}).join('');}
async function loadFeedback(){const f=await check(db.from('kc_feedback').select('id,category,message,state,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50));$('#myFeedback').innerHTML=f.map(x=>`<div class="item"><div><b>${safe(x.category)} · ${safe(x.state)}</b><p>${safe(x.message)}</p></div></div>`).join('')||'<p class="muted">Noch kein Feedback.</p>';}
async function loadAdminFeedback(){if(!isAdmin)return;const f=await check(db.from('kc_feedback').select('id,category,message,state,created_at').order('created_at',{ascending:false}).limit(100));$('#adminFeedback').innerHTML=f.map(x=>`<div class="item"><div><b>${safe(x.category)}</b> · ${safe(x.state)}<p>${safe(x.message)}</p></div><select data-feedback="${x.id}"><option value="offen" ${x.state==='offen'?'selected':''}>Offen</option><option value="in_arbeit" ${x.state==='in_arbeit'?'selected':''}>In Arbeit</option><option value="erledigt" ${x.state==='erledigt'?'selected':''}>Erledigt</option></select></div>`).join('')||'<p class="muted">Noch kein Feedback.</p>';document.querySelectorAll('[data-feedback]').forEach(el=>el.onchange=async()=>{try{await check(db.from('kc_feedback').update({state:el.value}).eq('id',el.dataset.feedback));msg('Status gespeichert')}catch(e){msg(e.message,true)}})}
const nameEditor=document.createElement('form');
nameEditor.id='myNameForm';
nameEditor.innerHTML='<h3>Mein Name</h3><label>Name des Kindes / Anzeigename<input name="display_name" maxlength="80" required placeholder="Name eingeben"></label><button type="submit">Namen speichern</button>';
$('#familyList').parentNode.insertBefore(nameEditor,$('#familyList').nextSibling);
nameEditor.onsubmit=async e=>{e.preventDefault();try{const display_name=String(new FormData(nameEditor).get('display_name')||'').trim();if(!display_name)throw Error('Bitte einen Namen eingeben.');const {error}=await db.from('profiles').upsert({id:user.id,display_name},{onConflict:'id'});if(error)throw error;msg('Name gespeichert.');$('#signedIn').textContent=display_name;const greeting=document.getElementById('personalGreeting');if(greeting)greeting.textContent='Hallo, '+display_name+'!';await loadFamily()}catch(err){msg('Name konnte nicht gespeichert werden: '+err.message,true)}};
const invitePanel=document.createElement('section');invitePanel.className='card';invitePanel.id='inviteGuidance';invitePanel.hidden=true;$('#loginPanel').parentNode.insertBefore(invitePanel,$('#loginPanel'));
const inviteGuidance=(html,canSwitch=false)=>{invitePanel.hidden=false;invitePanel.innerHTML='<h2>Persönliche Einladung</h2><p>'+html+'</p>'+(canSwitch?'<button type="button" id="switchInviteAccount">Mit eingeladenem Konto fortfahren</button>':'');const b=$('#switchInviteAccount');if(b)b.onclick=async()=>{b.disabled=true;const {error}=await db.auth.signOut();if(error){msg(error.message,true);b.disabled=false;return}inviteGuidance('Bitte mit der E-Mail-Adresse aus der Einladung anmelden oder ein neues Konto erstellen. Die Einladung bleibt erhalten.');$('#authForm').hidden=false;$('#loginPanel').hidden=false;$('#authForm [name=email]').focus()}};
async function showSession(s){if(recoveryMode){$('#loginPanel').hidden=false;$('#authForm').hidden=true;$('#app').hidden=true;return}user=s?.user||null;$('#loginPanel').hidden=!!user;$('#app').hidden=!user;const pendingBefore=getPendingInvite();invitePanel.hidden=true;if(!user){if(pendingBefore?.token)inviteGuidance('Dein Einladungslink ist gespeichert. Melde dich mit der eingeladenen E-Mail-Adresse an oder erstelle damit ein neues Konto. Nach Bestätigung der E-Mail wird die Einladung angenommen.');return}$('#signedIn').textContent=user.email;
 try{const {data:ownProfile}=await db.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
 const displayName=String(ownProfile?.display_name||'').trim();
 nameEditor.querySelector('input').value=displayName;
 $('#signedIn').textContent=displayName||user.email;
 const greeting=document.getElementById('personalGreeting')||document.createElement('h2');
 greeting.id='personalGreeting';greeting.textContent=displayName?'Hallo, '+displayName+'!':'Hallo!';
 $('#home').insertBefore(greeting,$('#home').firstChild);
 }catch{}if(pendingBefore?.token)inviteGuidance('Angemeldet als <b>'+safe(user.email)+'</b>. Ist das nicht die eingeladene E-Mail-Adresse, wechsle hier das Konto.',true);
 try{const a=await check(db.from('app_admins').select('user_id').eq('user_id',user.id));isAdmin=a.length>0;$('#adminTab').hidden=!isAdmin;await loadMoney();await loadFamily();
 const pending=getPendingInvite();
 if(pending?.token && (!pending.email || pending.email===user.email?.toLowerCase())){
  $('#inviteToken').value=pending.token;
  try{
   await invoke('accept_invite',{invite_token:pending.token,family_name:'Meine Familie'});
   clearPendingInvite();invitePanel.hidden=true;await loadFamily();msg('Einladung angenommen. Willkommen in deiner Familie!');
  }catch(e){
   if(/Geburtsdatum ungültig/.test(e.message)){
    msg('Fast geschafft: Bitte unter Familie dein Geburtsdatum eintragen und die Einladung bestätigen.');
   }else if(/nicht für diese E-Mail|abgelaufen/i.test(e.message)){inviteGuidance('Diese Einladung passt nicht zum angemeldeten Konto <b>'+safe(user.email)+'</b> oder ist abgelaufen. Falls die Einladung noch gültig ist, wähle „Mit eingeladenem Konto fortfahren“.',true);msg('Einladung nicht angenommen. Bitte Kontozuordnung prüfen.',true)}else if(/Bestätigtes Benutzerkonto erforderlich|401|JWT/i.test(e.message)){inviteGuidance('Zur Annahme ist eine bestätigte Anmeldung mit der eingeladenen E-Mail-Adresse erforderlich. Bitte E-Mail-Bestätigung abschließen und erneut anmelden.',true);msg('Einladung wartet auf bestätigte Anmeldung.',true)}else{msg('Einladung noch nicht angenommen: '+e.message,true)}
  }
 }
 await loadFeedback();if(isAdmin)await loadAdminFeedback();}catch(e){msg('Daten konnten nicht geladen werden: '+e.message,true)}}
async function submit(e,fn){e.preventDefault();try{await fn(new FormData(e.target));msg('Gespeichert.');}catch(err){msg(err.message,true)}}
$('#authForm').onsubmit=e=>submit(e,async f=>{await check(db.auth.signInWithPassword({email:f.get('email'),password:f.get('password')}));msg('Angemeldet.')});
$('#register').onclick=async()=>{try{if(user)throw Error('Bitte zuerst mit „Mit eingeladenem Konto fortfahren“ das Konto wechseln.');const f=new FormData($('#authForm'));if(!getPendingInvite()?.token)throw Error('Registrierung nur mit persönlichem Einladungslink.');const {error}=await db.auth.signUp({email:f.get('email'),password:f.get('password')});if(error)throw error;const pending=getPendingInvite();if(pending){pending.email=String(f.get('email')).trim().toLowerCase();localStorage.setItem(pendingKey,JSON.stringify(pending))}msg('Registrierung gestartet. Bitte E-Mail bestätigen und danach anmelden.')}catch(e){msg(e.message,true)}};
$('#forgotPassword').onclick=async()=>{try{
 const email=String(new FormData($('#authForm')).get('email')||'').trim();
 if(!email)throw Error('Bitte zuerst deine E-Mail-Adresse eingeben.');
 const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
 if(error)throw error;
 msg('Falls ein Konto existiert, erhältst du eine E-Mail zum Zurücksetzen des Passworts.');
}catch(e){msg(e.message,true)}};
const resetForm=$('#resetPasswordForm');
const resetStatus=document.createElement('p');resetStatus.id='resetStatus';resetStatus.setAttribute('role','status');resetStatus.style.marginTop='12px';resetForm.appendChild(resetStatus);
const resetNotice=(text,isError=false)=>{resetStatus.textContent=text;resetStatus.style.color=isError?'#b42318':'#087f8c';msg(text,isError)};
resetForm.onsubmit=async e=>{e.preventDefault();
 const button=resetForm.querySelector('button[type=submit]');
 const password=String(new FormData(resetForm).get('new_password')||'');
 if(password.length<8){resetNotice('Das Passwort muss mindestens 8 Zeichen haben.',true);return}
 button.disabled=true;button.textContent='Passwort wird gespeichert …';resetNotice('Verbindung wird geprüft …');
 try{
  const {data:sessionData,error:sessionError}=await db.auth.getSession();
  if(sessionError)throw sessionError;
  if(!sessionData.session)throw Error('Der Wiederherstellungslink ist nicht mehr gültig. Bitte fordere eine neue E-Mail an.');
  resetNotice('Neues Passwort wird gespeichert …');
  const {error}=await db.auth.updateUser({password});if(error)throw error;
  resetNotice('Passwort erfolgreich geändert. Du kannst dich jetzt mit dem neuen Passwort anmelden.');
  recoveryMode=false;resetForm.hidden=true;
  history.replaceState(null,'',location.pathname);
  $('#authForm').hidden=false;$('#loginPanel').hidden=false;$('#app').hidden=true;
  await db.auth.signOut();
  msg('Passwort erfolgreich geändert. Bitte mit dem neuen Passwort anmelden.');
 }catch(err){resetNotice('Passwort konnte nicht gespeichert werden: '+(err?.message||String(err)),true)}
 finally{button.disabled=false;button.textContent='Neues Passwort speichern'}
};
$('#logout').onclick=async()=>{const {error}=await db.auth.signOut();msg(error?error.message:(getPendingInvite()?.token?'Abgemeldet. Jetzt mit der eingeladenen E-Mail-Adresse anmelden oder registrieren.':'Abgemeldet.'),!!error)};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.tab').forEach(x=>x.hidden=x.id!==b.dataset.tab)});
$('#txForm [name=booked_on]').value=today();$('#txForm [name=kind]').onchange=renderCategories;
$('#txForm').onsubmit=e=>submit(e,async f=>{const n=cents(f.get('amount'));if(!n)throw Error('Betrag muss größer als 0 sein');await check(db.from('transactions').insert({user_id:user.id,kind:f.get('kind'),amount_cents:n,category:f.get('category'),note:f.get('note'),booked_on:f.get('booked_on')}));e.target.reset();$('#txForm [name=booked_on]').value=today();await loadMoney()});
$('#goalForm').onsubmit=e=>submit(e,async f=>{const n=cents(f.get('target'));if(!n)throw Error('Zielbetrag muss größer als 0 sein');await check(db.from('savings_goals').insert({user_id:user.id,title:f.get('title'),target_cents:n,saved_cents:cents(f.get('saved')),priority:'medium'}));e.target.reset();await loadMoney()});
$('#feedbackForm').onsubmit=e=>submit(e,async f=>{await check(db.from('kc_feedback').insert({user_id:user.id,category:f.get('category'),message:f.get('message')}));e.target.reset();await loadFeedback();if(isAdmin)await loadAdminFeedback()});
const link=token=>`${location.origin}${location.pathname}?invite=${encodeURIComponent(token)}`;
const showLink=(id,token)=>{$(id).innerHTML=`<p class="invite"><b>Persönlicher Einladungslink:</b><br><a href="${safe(link(token))}">${safe(link(token))}</a></p><p class="warning">Link nur an die eingeladene Person weitergeben. Nach 7 Tagen ungültig.</p>`};
$('#parentInvite').onsubmit=e=>submit(e,async f=>{const d=await invoke('invite_parent',{email:f.get('email')});showLink('#parentInviteResult',d.invite_token);msg(d.email_sent?'Einladung per E-Mail verschickt.':('Link erstellt, E-Mail noch nicht verschickt: '+(d.email_error||'Unbekannter Fehler')),!d.email_sent)});
$('#childInvite').onsubmit=e=>submit(e,async f=>{const d=await invoke('invite_child',{family_id:f.get('family_id'),email:f.get('email')});showLink('#childInviteResult',d.invite_token);msg(d.email_sent?'Einladung per E-Mail verschickt.':('Link erstellt, E-Mail noch nicht verschickt: '+(d.email_error||'Unbekannter Fehler')),!d.email_sent)});
$('#acceptForm').onsubmit=e=>submit(e,async f=>{await invoke('accept_invite',{invite_token:f.get('token'),family_name:f.get('family_name'),birth_date:f.get('birth_date')});clearPendingInvite();await loadFamily();msg('Einladung angenommen!')});
$('#childSetup').onsubmit=e=>submit(e,async f=>{const child=f.get('child_id'),family=children.find(c=>c.user_id===child)?.family_id;if(!family)throw Error('Bitte Kind auswählen');if(!confirm('Startguthaben und Taschengeld für dieses Kind speichern? Nur einmal ausführen.'))return;await invoke('setup_child',{child_id:child,family_id:family,start_cents:cents(f.get('start')),allowance_cents:cents(f.get('allowance'))});await loadChildFinance()});
$('#loadUsers').onclick=async()=>{try{const data=await invoke('admin_users');$('#users').innerHTML=data.users.map(u=>`<div class="item"><div><b>${safe(u.email)}</b><br><small>${safe(u.id)}</small></div><div><button data-delete-data="${u.id}" class="secondary">Finanzen zurücksetzen</button> <button data-delete-account="${u.id}">Konto löschen</button></div></div>`).join('');document.querySelectorAll('[data-delete-data],[data-delete-account]').forEach(b=>b.onclick=async()=>{const id=b.dataset.deleteData||b.dataset.deleteAccount,act=b.dataset.deleteAccount?'delete_account':'delete_child_data';const typed=prompt(`ACHTUNG: ${act==='delete_account'?'Konto und Daten':'Alle Finanzdaten'} unwiderruflich löschen!\nZur Bestätigung exakt eingeben:\nLOESCHEN ${id}`);if(typed!==`LOESCHEN ${id}`){msg('Abgebrochen');return}try{await invoke(act,{target_id:id,confirm:typed});msg('Löschvorgang ausgeführt.');$('#loadUsers').click()}catch(e){msg(e.message,true)}})}catch(e){msg(e.message,true)}};
const inviteToken=new URLSearchParams(location.search).get('invite');
if(inviteToken){
 localStorage.setItem(pendingKey,JSON.stringify({token:inviteToken,email:null}));
 $('#inviteToken').value=inviteToken;
 history.replaceState(null,'',location.pathname);
}else{
 const pending=getPendingInvite();if(pending?.token)$('#inviteToken').value=pending.token;
}
const recoveryInUrl=()=>{const q=new URLSearchParams(location.search),h=new URLSearchParams(location.hash.slice(1));return q.get('type')==='recovery'||h.get('type')==='recovery'};
let recoveryMode=recoveryInUrl();
const showRecovery=()=>{recoveryMode=true;$('#resetPasswordForm').hidden=false;$('#authForm').hidden=true;$('#loginPanel').hidden=false;$('#app').hidden=true;msg('Bitte jetzt ein neues Passwort festlegen.')};
if(recoveryMode){showRecovery();resetNotice('Wiederherstellungslink wird geprüft …')}
db.auth.onAuthStateChange((event,s)=>{if(event==='PASSWORD_RECOVERY')showRecovery();setTimeout(()=>{showSession(s);if(recoveryMode)showRecovery()},0)});
db.auth.getSession().then(({data,error})=>{if(error)msg(error.message,true);else{showSession(data.session);if(recoveryMode){showRecovery();resetNotice(data.session?'Link bestätigt. Du kannst dein neues Passwort speichern.':'Der Link ist nicht bestätigt. Bitte fordere eine neue Passwort-E-Mail an.',!data.session)}}});
})();
