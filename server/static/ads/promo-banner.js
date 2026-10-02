/* ShopLab promo overlay (self-hosted, stands in for a third-party ad script).
 * Shows a promotion 3 seconds after arriving on the home page or the product listing.
 * Closing it is remembered for the rest of the browser session. The shop works the same without this file. */
(function () {
  'use strict';

  var DELAY_MS = 3000;
  var CLOSED_KEY = 'shoplab.promoClosed';
  var timer = null;
  var overlay = null;
  var lastPath = null;

  function currentPath() {
    return location.pathname.replace(/\/+$/, '') || '/';
  }

  function isPromoPage() {
    var path = currentPath();
    return path === '/' || path === '/products';
  }

  function closedThisSession() {
    try {
      return sessionStorage.getItem(CLOSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  function addStyles() {
    if (document.getElementById('shoplab-promo-style')) return;
    var style = document.createElement('style');
    style.id = 'shoplab-promo-style';
    style.textContent =
      '.shoplab-promo{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1000;width:min(26rem,calc(100vw - 2rem));' +
      'background:#fffbeb;color:#1f2937;border:2px solid #b45309;border-radius:12px;padding:1.25rem 1.5rem;box-shadow:0 12px 40px rgba(0,0,0,.35);font-family:system-ui,sans-serif}' +
      '.shoplab-promo h2{margin:0 2rem .5rem 0;font-size:1.25rem}' +
      '.shoplab-promo p{margin:0 0 .75rem}' +
      '.shoplab-promo a{display:inline-block;background:#1d4ed8;color:#fff;padding:.5rem 1rem;border-radius:8px;text-decoration:none;font-weight:600}' +
      '.shoplab-promo button{position:absolute;top:.5rem;right:.5rem;width:2rem;height:2rem;border:0;border-radius:50%;background:#e5e7eb;color:#1f2937;font-size:1rem;cursor:pointer}';
    document.head.appendChild(style);
  }

  function removeOverlay() {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    overlay = null;
  }

  function cancelTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function showOverlay() {
    timer = null;
    if (!isPromoPage() || closedThisSession() || overlay) return;
    addStyles();
    overlay = document.createElement('div');
    overlay.className = 'shoplab-promo';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Promotion');
    overlay.innerHTML =
      '<h2>Weekend offer</h2>' +
      '<p>Free standard shipping on orders of $100 or more. Demo offer, nothing is shipped.</p>' +
      '<a href="/products">Browse products</a>' +
      '<button type="button" aria-label="Close promotion">&#10005;</button>';
    overlay.querySelector('button').addEventListener('click', function () {
      try {
        sessionStorage.setItem(CLOSED_KEY, '1');
      } catch {
        /* storage blocked: the overlay just closes */
      }
      removeOverlay();
    });
    document.body.appendChild(overlay);
  }

  function evaluate() {
    var path = currentPath();
    if (path === lastPath) return;
    lastPath = path;
    cancelTimer();
    removeOverlay();
    if (isPromoPage() && !closedThisSession()) timer = setTimeout(showOverlay, DELAY_MS);
  }

  if (!window.__shoplabNav) {
    window.__shoplabNav = true;
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = history[method];
      history[method] = function () {
        var result = original.apply(this, arguments);
        window.dispatchEvent(new Event('shoplab:navigate'));
        return result;
      };
    });
  }
  window.addEventListener('shoplab:navigate', evaluate);
  window.addEventListener('popstate', evaluate);
  evaluate();
})();
