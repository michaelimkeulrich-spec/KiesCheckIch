// Deploy als Supabase Edge Function `admin-api`, JWT-Prüfung aktiviert.
import { createClient } from 'npm:@supabase/supabase-js@2.57.0';
const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, secret, {auth:{autoRefreshToken:false,persistSession:false}});
const cors = {'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') || 'https://example.invalid', 'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
const fail=(message:string,status=400)=>json({error:message},status);
const sha=async(t:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');
const validEmail=(s:unknown)=>typeof s==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length<=254;
const check=async(p:PromiseLike<{error:any}>)=>{const r=await p;if(r.error)throw Error(r.error.message);return r;};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return fail('Methode nicht erlaubt',405);
 try{
  const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
  if(!token)return fail('Nicht angemeldet',401);
  const {data:{user},error:authError}=await admin.auth.getUser(token);
  if(authError||!user||!user.email||!user.email_confirmed_at)return fail('Bestätigtes Benutzerkonto erforderlich',401);
  const {data:role}=await admin.from('app_admins').select('user_id').eq('user_id',user.id).maybeSingle();
  const isAdmin=!!role;
  const body=await req.json(); const action=body.action;
  const familyFor=async(familyId:string)=>{const {data}=await admin.from('kc_family_parents').select('user_id').eq('family_id',familyId).eq('user_id',user.id).maybeSingle();return !!data;};
  if(action==='invite_parent'){
   if(!isAdmin)return fail('Nur Administratoren',403);
   if(!validEmail(body.email))return fail('E-Mail ungültig');
   const raw=random(); await check(admin.from('kc_invitations').insert({token_hash:await sha(raw),email:body.email.trim().toLowerCase(),kind:'parent',created_by:user.id,expires_at:new Date(Date.now()+7*864e5).toISOString()}));
   return json({invite_token:raw});
  }
  if(action==='invite_child'){
   if(typeof body.family_id!=='string'||!await familyFor(body.family_id))return fail('Keine Berechtigung',403);
   if(!validEmail(body.email))return fail('E-Mail ungültig');
   const raw=random();await check(admin.from('kc_invitations').insert({token_hash:await sha(raw),email:body.email.trim().toLowerCase(),kind:'child',family_id:body.family_id,created_by:user.id,expires_at:new Date(Date.now()+7*864e5).toISOString()}));
   return json({invite_token:raw});
  }
  if(action==='accept_invite'){
   if(typeof body.invite_token!=='string'||body.invite_token.length!==64)return fail('Einladung ungültig');
   const {data:i}=await admin.from('kc_invitations').select('*').eq('token_hash',await sha(body.invite_token)).is('used_at',null).gt('expires_at',new Date().toISOString()).maybeSingle();
   if(!i||i.email!==user.email.toLowerCase())return fail('Einladung abgelaufen oder nicht für diese E-Mail');
   if(i.kind==='parent'){
    const familyName=String(body.family_name||'Meine Familie').trim().slice(0,80);
    if(!familyName)return fail('Familienname fehlt');
    const {data:f,error}=await admin.from('kc_families').insert({name:familyName}).select('id').single();if(error)throw error;
    await check(admin.from('kc_family_parents').insert({family_id:f.id,user_id:user.id}));
   }else{
    const birth=String(body.birth_date||'');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||Number.isNaN(Date.parse(birth))||birth>new Date().toISOString().slice(0,10))return fail('Geburtsdatum ungültig');
    const {data:existing}=await admin.from('kc_family_children').select('user_id').eq('user_id',user.id).maybeSingle();
    if(existing)return fail('Konto ist bereits einer Familie zugeordnet');
    await check(admin.from('kc_family_children').insert({family_id:i.family_id,user_id:user.id,birth_date:birth}));
   }
   // bedingtes Update verhindert doppeltes Einlösen bei konkurrierenden Anfragen nicht vollständig;
   // vor breitem Rollout transaktionale Datenbankfunktion ergänzen.
   await check(admin.from('kc_invitations').update({used_at:new Date().toISOString()}).eq('id',i.id).is('used_at',null));
   return json({ok:true});
  }
  if(action==='setup_child'){
   const child=String(body.child_id||''),family=String(body.family_id||'');
   if(!await familyFor(family))return fail('Keine Berechtigung',403);
   const {data:link}=await admin.from('kc_family_children').select('birth_date').eq('family_id',family).eq('user_id',child).maybeSingle();
   if(!link||link.birth_date <= new Date(new Date().setFullYear(new Date().getFullYear()-18)).toISOString().slice(0,10))return fail('Nur für verknüpfte minderjährige Kinder',403);
   const start=Number(body.start_cents),allowance=Number(body.allowance_cents);
   if(!Number.isSafeInteger(start)||start<0||start>1e9||!Number.isSafeInteger(allowance)||allowance<0||allowance>1e8)return fail('Ungültiger Betrag');
   // Einmalige Einrichtung: zweite Ausführung wird abgelehnt.
   const {data:previous}=await admin.from('kc_child_setups').select('child_id').eq('child_id',child).maybeSingle();
   if(previous)return fail('Kind wurde bereits eingerichtet');
   await check(admin.from('kc_child_setups').insert({child_id:child,configured_by:user.id}));
   // Taschengeld ist Vereinbarung, keine automatische fiktive Buchung.
   if(start>0)await check(admin.from('transactions').insert({user_id:child,kind:'income',amount_cents:start,category:'Startguthaben',note:'Gemeinsam eingerichteter Anfangsbestand'}));
   await check(admin.from('kc_allowances').upsert({child_id:child,monthly_cents:allowance,updated_by:user.id},{onConflict:'child_id'}));
   return json({ok:true});
  }
  if(action==='delete_child_data'||action==='delete_account'){
   if(!isAdmin)return fail('Nur Administratoren',403);
   const target=String(body.target_id||'');
   if(!/^[0-9a-f-]{36}$/i.test(target)||target===user.id||body.confirm!==`LOESCHEN ${target}`)return fail('Bestätigung ungültig');
   const {data:targetAdmin}=await admin.from('app_admins').select('user_id').eq('user_id',target).maybeSingle();
   if(targetAdmin)return fail('Administratorkonten können hier nicht gelöscht werden',403);
   const {data:targetUser,error:findErr}=await admin.auth.admin.getUserById(target);
   if(findErr||!targetUser.user)return fail('Konto nicht gefunden',404);
   // Nicht transaktional: bei Fehlern abbrechen und Adminprotokoll prüfen.
   for(const table of ['savings_rewards','budgets','transactions','savings_goals']){
    const col=table==='savings_rewards'?'child_id':'user_id';
    await check(admin.from(table).delete().eq(col,target));
   }
   await check(admin.from('kc_admin_audit').insert({actor_id:user.id,action:'delete_financial_data',target_id:target}));
   if(action==='delete_account'){
    await check(admin.from('savings_rewards').delete().eq('parent_id',target));
    await check(admin.from('parent_links').delete().or(`parent_id.eq.${target},child_id.eq.${target}`));
    await check(admin.from('kc_invitations').delete().eq('created_by',target));
    const {error}=await admin.auth.admin.deleteUser(target);if(error)throw error;
    await check(admin.from('kc_admin_audit').insert({actor_id:user.id,action:'delete_account',target_id:target}));
   }
   return json({ok:true});
  }
  if(action==='admin_users'){
   if(!isAdmin)return fail('Nur Administratoren',403);
   const {data,error}=await admin.auth.admin.listUsers({page:1,perPage:100});if(error)throw error;
   return json({users:data.users.map(u=>({id:u.id,email:u.email,created_at:u.created_at}))});
  }
  return fail('Unbekannte Aktion',404);
 }catch(e){console.error('admin-api',e);return fail('Serverfehler. Bitte Protokoll prüfen.',500)}
});
