/* Sagar Classes – public pages: notice ticker, toppers, events, attendance and enquiry forms */
(function () {
  'use strict';

  var h = SCStore.h, img = SCStore.img;
  var $ = function (sel) { return document.querySelector(sel); };

  function getJSON(path) {
    return fetch(path, { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : Promise.reject(); });
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fill(box, nodes, emptyText) {
    box.textContent = '';
    if (!nodes.length) box.appendChild(h('p', { class: 'empty-note', text: emptyText }));
    nodes.forEach(function (n) { box.appendChild(n); });
  }

  /* ---------- 0. site images set from the admin panel: hero image, founder photo ---------- */
  var IMG_BASE = SCStore.logo.replace(/images\/logo\.jpe?g.*$/, '');
  var heroImg = $('#heroImg'), founderImg = $('#founderPhoto');
  if (heroImg || founderImg) {
    getJSON('/api/public/settings').then(function (st) {
      if (heroImg && st.hero_image) heroImg.src = st.hero_image;
      if (founderImg && st.profile_photo) { founderImg.src = st.profile_photo; founderImg.classList.remove('is-logo'); }
    }).catch(function (e) { console.error(e); });
  }

  /* ---------- 1. notice ticker ---------- */
  var ticker = $('.ticker-text');
  if (ticker) {
    getJSON('/api/public/notices').then(function (list) {
      if (list.length) ticker.textContent = list.map(function (n) { return n.text; }).join('   ·   ');
    }).catch(function (e) { console.error(e); });
  }

  /* ---------- 2. home page: one topper from every class ---------- */
  var strip = $('#homeAchieversStrip');
  if (strip) {
    getJSON('/api/public/home-toppers').then(function (list) {
      fill(strip, list.map(function (t) {
        return h('div', { class: 'achiever-chip' },
          h('span', { class: 'achiever-rank', text: '#' + t.rank }),
          img(t.photo_url, t.name),
          h('div', {}, h('strong', { text: t.name }), h('span', { text: t.class_name + ' · ' + t.score })));
      }), 'Toppers will appear here soon.');
    }).catch(function (e) { console.error(e); });
  }

  /* ---------- 3. toppers page: grouped by class, rank by score ---------- */
  var toppersBox = $('#toppersContainer');
  if (toppersBox) {
    var MEDAL = { 1: 'gold', 2: 'silver', 3: 'bronze' };
    var CHEER = { 1: 'Top rank in the class. Outstanding! 🎉', 2: 'Excellent performance and hard work! 🎉', 3: 'Great result, keep shining! 🎉' };
    var classIcon = function (c) { return /Science/.test(c) ? ['ri-flask-fill', 'green'] : /Commerce/.test(c) ? ['ri-bar-chart-box-fill', 'gold'] : ['ri-book-open-fill', 'indigo']; };

    getJSON('/api/public/toppers').then(function (list) {
      var groups = [], byClass = {};
      list.forEach(function (t) {
        if (!byClass[t.class_name]) groups.push(byClass[t.class_name] = { name: t.class_name, rows: [] });
        byClass[t.class_name].rows.push(t);
      });
      fill(toppersBox, groups.map(function (g) {
        var ic = classIcon(g.name), icon = h('i', { class: ic[0] + ' tone-' + ic[1] });
        return h('div', { class: 'category-block' },
          h('h3', { class: 'category-title' }, icon, ' ' + g.name + ' Toppers'),
          h('div', { class: 'card-grid' }, g.rows.map(function (t) {
            return h('article', { class: 'topper-card' },
              h('div', { class: 'topper-rank-top topper-rank-' + (MEDAL[t.rank] || 'other') },
                h('i', { class: 'ri-medal-2-fill', 'aria-hidden': 'true' }), h('span', { text: t.rank_label })),
              img(t.photo_url, t.name, 'topper-photo'),
              h('h3', { title: t.name, text: t.name }),
              h('div', { class: 'topper-class', text: t.class_name }),
              h('div', { class: 'topper-score-box' }, h('span', { text: 'Marks / Score' }), h('strong', { text: t.score })),
              h('p', { class: 'topper-congratulations', text: CHEER[t.rank] || 'Well done on this achievement! 🎉' }));
          })));
      }), 'Toppers will be announced soon.');
    }).catch(function (e) { console.error(e); });
  }

  /* ---------- 4. functions & events ---------- */
  var eventsBox = $('#functionsDisplayContainer');
  if (eventsBox) {
    var EVENT_ICON = { Picnic: 'ri-bus-fill', Sports: 'ri-run-fill',
                       Farewell: 'ri-graduation-cap-fill', Festival: 'ri-palette-fill', PTM: 'ri-parent-fill', 'National Day': 'ri-flag-fill' };
    /* every event gets a matching picture until the admin uploads its own */
    var EVENT_PIC = [[/picnic/i, 'picnic'], [/sport/i, 'sports'],
                     [/farewell/i, 'farewell'], [/parent|ptm/i, 'ptm'], [/independence/i, 'independence-day'], [/holi/i, 'holi']];
    var eventPic = function (e) {
      var hit = EVENT_PIC.filter(function (x) { return x[0].test(e.title) || x[0].test(e.category); })[0];
      return IMG_BASE + 'images/events/' + (hit ? hit[1] : 'general') + '.svg';
    };
    getJSON('/api/public/events').then(function (list) {
      fill(eventsBox, list.map(function (e) {
        var icon = h('i', { class: (EVENT_ICON[e.category] || 'ri-calendar-event-fill') + ' tone-orange' });
        return h('div', { class: 'event-tile-card' },
          h('div', { class: 'event-img-container' }, img(e.photo_url || eventPic(e), e.title), h('span', { class: 'event-floating-badge', text: e.category })),
          h('div', { class: 'event-content-body' },
            h('h3', { class: 'event-title', text: e.title }),
            h('p', { class: 'event-desc', text: e.description || '' }),
            h('div', { class: 'event-footer-row' }, h('span', { class: 'event-campus-tag' }, icon, ' Sagar Classes Campus'))));
      }), 'No events added yet.');
    }).catch(function (e) { console.error(e); });
  }

  /* ---------- 5. forms ---------- */
  function setMessage(form, text, ok) {
    var box = form.querySelector('.form-feedback');
    if (!box) { box = h('p', { class: 'form-feedback', role: 'status' }); form.appendChild(box); }
    box.classList.toggle('ok', ok);
    box.classList.toggle('bad', !ok);
    box.textContent = text;
  }

  /* Attendance forms: pick the person from the admin list (students by class, staff directly) */
  function setupPeople(form) {
    var groupSel = form.querySelector('[name="group"]'), personSel = form.querySelector('[name="person_id"]');
    var preview = form.querySelector('.person-preview'), people = [];

    function showPhoto() {
      var p = people.filter(function (x) { return String(x.id) === personSel.value; })[0];
      if (preview) { preview.src = SCStore.photo(p && p.photo_url); preview.classList.toggle('is-logo', !(p && p.photo_url)); }
    }
    function drawPeople() {
      var rows = groupSel ? people.filter(function (p) { return p.group === groupSel.value; }) : people;
      personSel.textContent = '';
      personSel.appendChild(h('option', { value: '', text: rows.length ? 'Select a name' : (groupSel && !groupSel.value ? 'Select a class first' : 'No records available') }));
      rows.forEach(function (p) { personSel.appendChild(h('option', { value: p.id, text: groupSel ? p.name : p.name + ' — ' + p.group })); });
      showPhoto();
    }

    getJSON('/api/public/people?type=' + form.dataset.people).then(function (list) {
      people = list;
      if (groupSel) {
        groupSel.textContent = '';
        groupSel.appendChild(h('option', { value: '', text: list.length ? 'Select a class' : 'No students have been added yet' }));
        list.map(function (p) { return p.group; }).filter(function (g, i, a) { return a.indexOf(g) === i; })
          .forEach(function (g) { groupSel.appendChild(h('option', { value: g, text: g })); });
      }
      drawPeople();
    }).catch(function () { setMessage(form, 'Unable to load the list. Please refresh the page and try again.', false); });

    if (groupSel) groupSel.addEventListener('change', drawPeople);
    personSel.addEventListener('change', showPhoto);
  }

  document.querySelectorAll('form[data-api]').forEach(function (form) {
    var dateInput = form.querySelector('input[type="date"]');
    if (dateInput) { dateInput.value = today(); dateInput.max = today(); }
    if (form.dataset.people) setupPeople(form);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var btn = form.querySelector('button[type="submit"]'), data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (btn) btn.disabled = true;
      setMessage(form, 'Submitting…', true);

      fetch(form.getAttribute('data-api'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (res) {
          if (!res.ok) return setMessage(form, res.body.error || 'Unable to submit the form. Please try again.', false);
          setMessage(form, res.body.message || 'Submitted. Thank you!', true);
          var keep = form.querySelector('[name="group"]') && form.querySelector('[name="group"]').value;
          form.reset();
          if (form.dataset.people) { if (keep) form.querySelector('[name="group"]').value = keep; form.querySelector('[name="person_id"]').dispatchEvent(new Event('change')); }
          if (dateInput) dateInput.value = today();
        })
        .catch(function () { setMessage(form, 'A network error occurred. Please check your connection and try again.', false); })
        .then(function () { if (btn) btn.disabled = false; });
    });
  });
})();
