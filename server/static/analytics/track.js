/* ShopLab analytics (self-hosted, stands in for a third-party tracker).
 * Sends page-view and click events to the same-origin /analytics/collect endpoint, but only after the visitor
 * has allowed analytics in the cookie banner. Nothing leaves the site. The shop works the same without this file. */
(function () {
  'use strict';

  var ENDPOINT = '/analytics/collect';
  var CONSENT_KEY = 'shoplab.cookieConsent';
  var lastPath = null;

  function analyticsAllowed() {
    try {
      var raw = localStorage.getItem(CONSENT_KEY);
      if (!raw) return false;
      var choice = JSON.parse(raw);
      return !!choice && choice.analytics === true;
    } catch {
      return false;
    }
  }

  function send(type, detail) {
    if (!analyticsAllowed()) return;
    var payload = JSON.stringify({ type: type, path: location.pathname, detail: detail || null });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
      }
    } catch {
      /* ignore: analytics must never affect the page */
    }
  }

  function pageView() {
    var path = location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    send('page_view');
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
  window.addEventListener('shoplab:navigate', pageView);
  window.addEventListener('popstate', pageView);

  document.addEventListener(
    'click',
    function (event) {
      var target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      var label = (target.getAttribute('aria-label') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      send('click', label);
    },
    true,
  );

  pageView();
})();
