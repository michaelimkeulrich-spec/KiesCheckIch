/* Kompaktes Layout für angemeldete Administratoren, ohne Änderungen an den Admin-Funktionen. */
(() => {
  'use strict';
  const sync = () => {
    const app = document.getElementById('app');
    const adminTab = document.getElementById('adminTab');
    const isAdmin = !!app && !app.hidden && !!adminTab && !adminTab.hidden;
    document.body.classList.toggle('kc-admin-compact', isAdmin);
  };
  const start = () => {
    sync();
    const app = document.getElementById('app');
    const tab = document.getElementById('adminTab');
    if (app) new MutationObserver(sync).observe(app, {attributes: true, attributeFilter: ['hidden']});
    if (tab) new MutationObserver(sync).observe(tab, {attributes: true, attributeFilter: ['hidden']});
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
