/* Sagar Classes – ONE shared navigation bar, mobile menu and footer for every page.
   Every page sits in the same folder and only contains:
     <script src="…/js/layout.js" data-part="nav"></script>      (inside .app-container, before <main>)
     <script src="…/js/layout.js" data-part="footer"></script>   (after .app-container)
   Edit the lists below to change the menu / footer everywhere at once. */
(function () {
  'use strict';
  var me = document.currentScript;
  var part = me.getAttribute('data-part');
  var base = (me.getAttribute('src') || '').replace(/js\/layout\.js.*$/, '');   // '' because every page sits in the same folder
  var file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

  /* `also` = other files that should keep this menu item highlighted */
  var PAGES = [
    { file: 'index.html',      label: 'Home',                  icon: 'ri-home-smile-2-fill',       tone: 'indigo' },
    { file: 'facility.html',   label: 'Facilities',            icon: 'ri-building-4-fill',         tone: 'sky' },
    { file: 'functions.html',  label: 'Events & Celebrations', icon: 'ri-calendar-event-fill',     tone: 'orange' },
    { file: 'about.html',      label: 'About Us',              icon: 'ri-information-fill',        tone: 'violet' },
    { file: 'attendance.html', label: 'Attendance',            icon: 'ri-user-follow-fill',        tone: 'green', also: ['academic.html', 'staff.html'] },
    { file: 'toppers.html',    label: 'Toppers & Results',     icon: 'ri-trophy-fill',             tone: 'gold' },
    { file: 'contact.html',    label: 'Contact & Branches',    icon: 'ri-customer-service-2-fill', tone: 'red' }
  ];
  PAGES.forEach(function (p) { p.href = base + p.file; });
  var ADMIN = { file: 'admin.html', href: base + 'admin.html' };

  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
  function link(p) {
    var on = p.file === file || (p.also || []).indexOf(file) !== -1;
    return '<a href="' + p.href + '" class="nav-link' + (on ? ' active' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' +
           '<i class="' + p.icon + ' tone-' + p.tone + '"></i> ' + esc(p.label) + '</a>';
  }
  var logo = base + 'images/logo.jpeg';

  if (part === 'nav') {
    var adminOn = file === ADMIN.file;
    document.write(
      '<input type="checkbox" id="navToggle" class="css-switch" hidden>' +
      '<label for="navToggle" class="sidebar-overlay" aria-label="Close menu"></label>' +

      '<aside class="sidebar" id="sidebar">' +
        '<a class="brand" href="' + base + 'index.html"><img src="' + logo + '" alt="Sagar Classes Logo" class="sagar-logo-img">' +
          '<div>SAGAR <span>CLASSES</span><p class="brand-sub">Excellence in Education</p></div></a>' +
        '<nav class="side-nav" aria-label="Main">' + PAGES.map(link).join('') +
          '<div class="divider"></div>' +
          '<a href="' + ADMIN.href + '" class="nav-link admin-btn' + (adminOn ? ' active' : '') + '"><i class="ri-shield-user-fill tone-gold"></i> Admin Panel</a>' +
        '</nav>' +
        '<div class="theme-toggle-box"><button type="button" class="theme-btn" data-theme-toggle aria-label="Switch light / dark mode">' +
          '<span class="to-light"><i class="ri-sun-fill tone-gold"></i> Light Mode</span><span class="to-dark"><i class="ri-moon-fill tone-indigo"></i> Dark Mode</span></button></div>' +
      '</aside>' +

      '<header class="floating-menu-bar">' +
        '<a class="floating-brand" href="' + base + 'index.html"><img src="' + logo + '" alt="" class="sagar-logo-img-small"> SAGAR <span>CLASSES</span></a>' +
        '<div class="floating-actions-mobile">' +
          '<button type="button" class="menu-action-icon-btn" data-theme-toggle title="Switch light / dark mode" aria-label="Switch light / dark mode"><i class="ri-contrast-2-fill tone-indigo"></i></button>' +
          '<a href="' + ADMIN.href + '" class="menu-action-icon-btn admin-mobile-icon" title="Admin Panel" aria-label="Admin Panel"><i class="ri-shield-user-fill tone-gold"></i></a>' +
          '<label for="navToggle" class="menu-toggle-btn" title="Menu" role="button" aria-label="Open or close menu"><i class="ri-menu-3-fill"></i></label>' +
        '</div>' +
      '</header>');

    /* mobile menu: Esc closes it, and it never stays open when coming back with the Back button */
    var closeMenu = function () { var t = document.getElementById('navToggle'); if (t) t.checked = false; };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });
    window.addEventListener('pageshow', closeMenu);
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.sidebar .nav-link')) closeMenu(); });
  }

  if (part === 'footer') {
    document.write(
      '<footer class="site-footer"><div class="footer-inner">' +

        '<div class="footer-top">' +
          '<a class="brand footer-brand" href="' + base + 'index.html"><img src="' + logo + '" alt="Sagar Classes Logo" class="sagar-logo-img">' +
            '<div><h3>Sagar Classes<span>.</span></h3><span class="brand-sub">Excellence in Education</span></div></a>' +
          '<p class="footer-desc">Empowering students with quality education, conceptual clarity and dedicated mentorship to achieve academic brilliance.</p>' +
        '</div>' +

        '<div class="footer-bottom"><span>&copy; ' + new Date().getFullYear() + ' Sagar Classes. All rights reserved.</span>' +
          '<span>Admissions open for 2026-27 <i class="ri-graduation-cap-fill tone-gold"></i></span></div>' +
      '</div></footer>');
  }

  /* Anonymous page-view beacon for Prometheus (served by the backend through nginx at /track/pageview).
     Silent no-op when there is no backend, e.g. when the folder is opened directly or hosted statically. */
  if (part === 'footer' && /^https?:$/.test(location.protocol) && navigator.sendBeacon) {
    try {
      navigator.sendBeacon('/track/pageview', new Blob([JSON.stringify({ page: file })], { type: 'application/json' }));
    } catch (e) { /* ignore */ }
  }
})();
