/* Southbridge theme kit — light/dark that follows the device, with a one-tap override.
   Same behaviour as southbridge.group (docs/dark-mode.md there):
   - load in <head> WITHOUT defer/async, before the stylesheet: sets <html data-theme="light|dark"> before
     first paint (no flash). Works under CSP script-src 'self' (no inline script needed);
   - any <button data-theme-toggle> becomes the toggle (empty buttons get the sun/moon icon);
     tapping onto the device's own theme forgets the override (Lea Verou's two-state model);
   - follows the device live while there is no override, syncs other tabs, circular reveal
     (View Transitions) unless reduced motion.
   Options on the <script> tag: data-key (localStorage key), data-light / data-dark (theme-color values),
   data-attr (attribute on <html>, default data-theme; use another one when the site already uses data-theme),
   data-lock (selector on <html> meaning "the page sets the theme itself", e.g. a lab mode: the kit then leaves it alone).
   CSS: write the dark palette under :root[data-theme="dark"]. Without JS the page shows its default theme. */
(function () {
  var s = document.currentScript, root = document.documentElement, d = (s && s.dataset) || {};
  var KEY = d.key || 'theme', ATTR = d.attr || 'data-theme';
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };
  var get = function () { try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; } };
  var set = function (v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) {} };
  var device = function () { return mq.matches ? 'dark' : 'light'; };
  var current = function () { return get() || device(); };
  var lang = (root.lang || 'en').slice(0, 2);
  var T = {
    en: ['Dark theme', 'Switch to dark theme', 'Switch to light theme', 'Back to dark (your device setting)', 'Back to light (your device setting)'],
    pt: ['Tema escuro', 'Mudar para o tema escuro', 'Mudar para o tema claro', 'Voltar ao escuro (ajuste do aparelho)', 'Voltar ao claro (ajuste do aparelho)'],
    es: ['Tema oscuro', 'Cambiar al tema oscuro', 'Cambiar al tema claro', 'Volver al oscuro (ajuste del dispositivo)', 'Volver al claro (ajuste del dispositivo)']
  }[lang] || null;
  if (!T) T = ['Dark theme', 'Switch to dark theme', 'Switch to light theme', 'Back to dark (your device setting)', 'Back to light (your device setting)'];

  function sync() {   // buttons and browser bar follow whatever theme the page shows (a site's lab mode may set it too)
    var a = root.getAttribute(ATTR), t = a === 'dark' || a === 'light' ? a : device();
    var m = document.querySelectorAll('meta[name="theme-color"]');
    if (d.light && d.dark) for (var i = 0; i < m.length; i++) { m[i].removeAttribute('media'); m[i].setAttribute('content', t === 'dark' ? d.dark : d.light); }
    var b = document.querySelectorAll('[data-theme-toggle]');
    for (var j = 0; j < b.length; j++) {
      var next = t === 'dark' ? 'light' : 'dark';
      b[j].setAttribute('aria-pressed', String(t === 'dark'));
      b[j].setAttribute('title', next === device() ? (next === 'dark' ? T[3] : T[4]) : (next === 'dark' ? T[1] : T[2]));
    }
  }
  var painted = null;   // what the kit last painted; if the page changed it since (a lab mode), the kit leaves it alone
  function paint(t) { root.setAttribute(ATTR, t); painted = t; sync(); }
  var ours = function () { return !(d.lock && root.matches(d.lock)) && root.getAttribute(ATTR) === painted; };
  paint(current());

  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
    '<g class="sbt-sun"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></g>' +
    '<path class="sbt-moon" d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';

  function change(t, from) {
    var go = function () { paint(t); };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('sbt-switching');
    var done = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('sbt-switching', 'sbt-vt'); }); }); };
    if (!document.startViewTransition || reduce || !from) { go(); done(); return; }
    var r = from.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add('sbt-vt');
    var vt = document.startViewTransition(go);
    vt.ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + rad + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
    }).catch(function () {});
    vt.finished.then(done, done);
  }

  function bind() {
    var b = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < b.length; i++) {
      var el = b[i];
      if (el.__sbt) continue; el.__sbt = 1;
      if (!el.innerHTML.trim()) el.innerHTML = ICON;
      if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', T[0]);
      el.classList.add('sbt-toggle');
      el.addEventListener('click', function (e) {
        var a = root.getAttribute(ATTR), shown = a === 'dark' || a === 'light' ? a : device(), next = shown === 'dark' ? 'light' : 'dark';
        set(next === device() ? null : next);           // landing on the device theme forgets the override
        change(next, e.currentTarget);
      });
    }
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
  var follow = function () { if (!get() && ours()) change(device()); else sync(); };
  mq.addEventListener ? mq.addEventListener('change', follow) : mq.addListener && mq.addListener(follow);
  addEventListener('storage', function (e) { if (e.key !== KEY) return; if (ours()) change(current()); else sync(); });
  window.sbTheme = { get: current, set: function (v) { set(v === 'system' ? null : v); change(current()); }, bind: bind };
})();
