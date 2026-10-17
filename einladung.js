(()=>{'use strict';
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co';
const KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
const $=s=>document.querySelector(s);
const inviteKey='kc_separate_invite_token';
const childNameKey='kc_invitation_child_name';
const tokenInUrl=new URLSearchParams(location.search).get('invite');
if(tokenInUrl){if(!/^[0-9a-f]{64}$/i.test(tokenInUrl)){$('#notice').textContent='Ungültiger Einladungslink.';return}localStorage.setItem(inviteKey,tokenInUrl);history.replaceState(null,'','/einladung.html')}
const token=localStorage.getItem(inviteKey);
if(!token){$('#notice').textContent='Kein Einladungslink gefunden. Bitte den Link aus der E-Mail öffnen.';return}
if(!window.supabase){$('#notice').textContent='Verbindung konnte nicht geladen werden.';return}
// Andere Speicherkennung als in app.js: Eltern-Sitzung wird weder gelesen noch überschrieben.
const db=window.supabase.createClient(URL,KEY,{auth:{storageKey:'kc_invitation_independent_auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let busy=false,complete=false,sessionUser=null,inviteKind=null;
const notice=(s,error=false)=>{$('#notice').textContent=s;$('#notice').classList.toggle('error',error)};
const toggle=(id,on)=>{$(id).hidden=!on};
const errorText=async(error)=>{if(error?.context?.json){try{const data=await error.context.json();if(data?.error)return data.error}catch{}}return error?.message||'Unbekannter Fehler'};
const invoke=async(action,body)=>{const {data,error}=await db.functions.invoke('admin-api',{body:{action,...body}});if(error)throw Error(await errorText(error));if(data?.error)throw Error(data.error);return data};
function choose(mode){toggle('#entry',true);toggle('#registerForm',mode==='new');toggle('#loginForm',mode==='existing');toggle('#logged',false)}
$('#newMode').onclick=()=>choose('new');
$('#existingMode').onclick=()=>choose('existing');
$('#registerForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{
 const f=new FormData(e.target),email=String(f.get('email')).trim().toLowerCase(),password=String(f.get('password'));
 if(password.length<8)throw Error('Das Passwort muss mindestens 8 Zeichen haben.');
 const name=String(f.get('child_name')||'').trim();if(name)localStorage.setItem(childNameKey,name.slice(0,80));
 const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/einladung.html'}});
 if(error)throw error;
 if(data.session){await renderUser(data.session.user);notice('Konto erstellt. Bitte Einladung annehmen.')}else{notice('Konto angelegt. Bitte die Bestätigungs-E-Mail öffnen. Danach führt dich der Link zu dieser Einladung zurück.');}
 }catch(err){notice('Registrierung nicht möglich: '+err.message,true)}finally{busy=false}};
$('#loginForm').onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;try{const f=new FormData(e.target);const {data,error}=await db.auth.signInWithPassword({email:String(f.get('email')).trim(),password:String(f.get('password'))});if(error)throw error;await renderUser(data.user)}catch(err){notice('Anmeldung nicht möglich: '+err.message,true)}finally{busy=false}};
$('#switch').onclick=async()=>{if(busy)return;busy=true;try{const {error}=await db.auth.signOut();if(error)throw error;sessionUser=null;choose('new');notice('Du kannst dich mit der eingeladenen Adresse neu registrieren oder mit einem bestehenden Konto anmelden.')}catch(e){notice(e.message,true)}finally{busy=false}};
async function renderUser(u){if(complete||!u)return;sessionUser=u;toggle('#entry',false);toggle('#logged',true);$('#who').textContent=u.email||'';$('#childName').value=localStorage.getItem(childNameKey)||u.user_metadata?.display_name||'';notice('Angemeldet. Bitte die Einladung mit diesem Konto annehmen. Falls die Adresse nicht passt, „Anderes Konto verwenden“ wählen.');}
$('#accept').onclick=async()=>{if(busy||complete)return;busy=true;$('#accept').disabled=true;try{
 const {data:{user},error}=await db.auth.getUser();if(error||!user)throw Error('Bitte zuerst anmelden und deine E-Mail-Adresse bestätigen.');
 if(!user.email_confirmed_at)throw Error('Bitte zuerst die E-Mail-Adresse über den Bestätigungslink bestätigen.');
 if(!$('#childFields').hidden && !$('#childName').value.trim())throw Error('Bitte den Namen des Kindes eingeben.');
 const payload={invite_token:token,family_name:$('#family').value.trim()||'Meine Familie',birth_date:$('#birth').value};
 const result=await invoke('accept_invite',payload);
 if(!result?.ok)throw Error('Einladung konnte nicht bestätigt werden.');
 complete=true;localStorage.removeItem(inviteKey);
 const childName=$('#childName').value.trim();
 if($('#childFields').hidden===false && childName){
   try{const {error:profileError}=await db.from('profiles').upsert({id:user.id,display_name:childName.slice(0,80)},{onConflict:'id'});if(profileError)throw profileError;localStorage.removeItem(childNameKey)}
   catch(profileErr){notice('Einladung angenommen, aber der Name konnte nicht gespeichert werden. Bitte später unter „Familie“ ergänzen: '+profileErr.message,true)}
 }
 toggle('#logged',false);toggle('#entry',false);toggle('#done',true);notice('Die Einladung wurde erfolgreich angenommen.');
 }catch(err){const m=err.message||String(err);if(/Geburtsdatum ungültig/.test(m)){toggle('#childFields',true);toggle('#parentFields',false);notice('Bitte dein Geburtsdatum eintragen und erneut bestätigen.')}else if(/nicht für diese E-Mail|abgelaufen/i.test(m)){notice('Diese Einladung passt nicht zum angemeldeten Konto oder ist abgelaufen. Bitte prüfe die eingeladene E-Mail-Adresse oder wechsle das Konto. '+m,true)}else{notice('Einladung nicht angenommen: '+m,true)}}finally{busy=false;$('#accept').disabled=false}};
async function boot(){try{const {data,error}=await db.auth.getSession();if(error)throw error;if(data.session?.user){await renderUser(data.session.user)}else{choose('new');notice('Bitte registrieren oder mit einem bestehenden Konto anmelden.')}}catch(e){choose('new');notice('Bitte registrieren oder anmelden. '+e.message,true)}}
db.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user)setTimeout(()=>renderUser(session.user),0);if(event==='SIGNED_OUT'&&!complete)setTimeout(()=>{choose('new');notice('Bitte registrieren oder anmelden.')},0)});
boot();
})();