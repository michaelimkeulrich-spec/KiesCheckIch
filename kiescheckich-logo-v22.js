/* KiesCheckIch V2.2 – Original-Logo einbinden, ohne bestehende Ansichten zu verändern */
(() => {
  'use strict';
  const addLink = (rel, href, attrs = {}) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); document.head.appendChild(el); }
    el.rel = rel;
    el.href = href;
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k,v));
  };
  const init = () => {
    addLink('icon', '/favicon.png', {type:'image/png'});
    addLink('apple-touch-icon', '/apple-touch-icon.png');
    addLink('manifest', '/manifest.webmanifest');
    const brand = document.querySelector('header .brand');
    if (brand && !brand.querySelector('.kc-brand-icon')) {
      const text = brand.textContent.replace(/^\s*💰\s*/, '').trim();
      brand.textContent = '';
      const img = document.createElement('img');
      img.className = 'kc-brand-icon';
      img.src = '/icon-192.png';
      img.alt = '';
      img.width = 42;
      img.height = 42;
      img.style.cssText = 'width:42px;height:42px;object-fit:contain;border-radius:11px;flex:none';
      brand.style.display = 'flex';
      brand.style.alignItems = 'center';
      brand.style.gap = '10px';
      brand.append(img, document.createTextNode(text));
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
