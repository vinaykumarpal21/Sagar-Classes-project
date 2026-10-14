/* Sagar Classes – theme. LIGHT is the default; Dark is used only after the visitor switches it on.
   Loaded in <head> of every page, so the saved choice is applied before the page is painted and
   never "flashes" or flips to dark while moving between pages.
   The choice is saved in localStorage (+ sessionStorage and window.name as fall-backs for
   browsers that block storage on file:// pages). */
(function () {
  'use strict';
  var KEY = 'sc_theme', TAG = 'sc_theme=', root = document.documentElement;

  function fromName() {
    var n = ''; try { n = window.name || ''; } catch (e) {}
    var i = n.indexOf(TAG);
    return i === -1 ? null : n.substr(i + TAG.length, 5).replace(/;.*/, '');
  }
  function toName(t) {
    try { window.name = (window.name || '').replace(/(^|;)sc_theme=[a-z]*/g, '') + ';' + TAG + t; } catch (e) {}
  }
  function read() {
    var v = null;
    try { v = localStorage.getItem(KEY); } catch (e) {}
    if (!v) { try { v = sessionStorage.getItem(KEY); } catch (e) {} }
    if (!v) v = fromName();
    return v === 'dark' ? 'dark' : 'light';          // anything else (or nothing saved) = light
  }
  function write(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    try { sessionStorage.setItem(KEY, t); } catch (e) {}
    toName(t);
  }
  function apply(t) {
    root.setAttribute('data-theme', t);
    root.style.colorScheme = t;
    var pressed = String(t === 'dark');
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) btns[i].setAttribute('aria-pressed', pressed);
  }

  apply(read());

  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!b) return;
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    write(next); apply(next);
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(read()); });   // other open tabs
  window.addEventListener('pageshow', function () { apply(read()); });                      // back/forward cache
  document.addEventListener('DOMContentLoaded', function () { apply(read()); });
  window.SCTheme = { get: function () { return root.getAttribute('data-theme'); }, set: function (t) { t = t === 'dark' ? 'dark' : 'light'; write(t); apply(t); } };
})();
