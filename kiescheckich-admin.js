(()=>{
'use strict';
// Isolated administrator navigation. Does not modify child or parent accounts.
const URL='https://dlvcfaplkidgcsvyiiai.supabase.co';
const KEY='sb_publishable_vd7Fkm2Ze8WJPo7XBEPPSA_zTl8NKMN';
if(!window.supabase)return;
const db=window.supabase.createClient(URL,KEY);
let currentId=null, sequence=0, adminMode=false, checkTimer=null;
const app=()=>document.getElementById('app');
const adminButton=()=>document.getElementById('adminTab');
const adminPanel=()=>document.getElementById('admin');
function reset(){
  adminMode=false;
  document.documentElement.classList.remove('kc-admin-only');
  const style=document.getElementById('kc-admin-only-css');if(style)style.remove();
}
function activate(){
  if(adminMode)return;
  const root=app(),button=adminButton(),panel=adminPanel();
  if(!root||root.hidden||!button||!panel||button.hidden)return;
  let style=document.getElementById('kc-admin-only-css');
  if(!style){
    style=document.createElement('style');style.id='kc-admin-only-css';
    style.textContent='html.kc-admin-only #app nav [data-tab]:not([data-tab="admin"]){display:none!important}';
    document.head.appendChild(style);
  }
  document.documentElement.classList.add('kc-admin-only');
  // Use the original app navigation so existing administrator handlers continue working.
  button.click();
  adminMode=true;
}
async function inspect(){
  const token=++sequence;
  try{
    const {data:{user},error}=await db.auth.getUser();
    if(error||token!==sequence)return;
    if(!user){currentId=null;reset();return;}
    if(currentId!==user.id){currentId=user.id;reset();}
    const {data,error:roleError}=await db.from('app_admins').select('user_id').eq('user_id',user.id).limit(1);
    if(roleError||token!==sequence)return;
    if(!data?.length){reset();return;}
    // app.js loads role and unhides Admin asynchronously; wait for it without touching other accounts.
    let attempts=0;
    clearInterval(checkTimer);
    checkTimer=setInterval(()=>{
      if(token!==sequence){clearInterval(checkTimer);return;}
      if(!app()?.hidden&&!adminButton()?.hidden){clearInterval(checkTimer);activate();}
      if(++attempts>=80)clearInterval(checkTimer);
    },150);
  }catch(e){console.warn('Admin-Start:',e)}
}
function init(){
  db.auth.onAuthStateChange((event)=>{
    if(event==='SIGNED_OUT'){sequence++;currentId=null;clearInterval(checkTimer);reset();}
    else if(event==='SIGNED_IN'||event==='INITIAL_SESSION')setTimeout(inspect,100);
  });
  inspect();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
