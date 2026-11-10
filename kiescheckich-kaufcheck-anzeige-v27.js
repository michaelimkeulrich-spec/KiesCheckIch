(()=>{'use strict';
/* V2.7: Die alte V1.3-Kaufprüfung ausblenden, den vorhandenen
   Kaufcheck mit Wochenlimit anzeigen. Keine Änderung an Buchungen/Sparzielen. */
function install(){
 if(document.getElementById('kc-kaufcheck-v27-style'))return;
 const style=document.createElement('style');
 style.id='kc-kaufcheck-v27-style';
 style.textContent=`
 #kc-v13-buy { display:none !important; }
 body #home #kc-afford { display:block !important; }
 `;
 document.head.appendChild(style);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
})();
