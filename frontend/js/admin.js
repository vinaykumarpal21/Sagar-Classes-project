/* Sagar Classes admin panel – login, add/edit/delete with photo upload, attendance register, downloads */
(function () {
  'use strict';

  var h = SCStore.h, img = SCStore.img;
  var $ = function (id) { return document.getElementById(id); };
  var TOKEN_KEY = 'sc_admin_token';
  var token = sessionStorage.getItem(TOKEN_KEY) || '';
  var schema = null, current = 'students';

  var TABS = [
    { id: 'students',  label: 'Students',           icon: 'ri-user-star-fill',         color: '#818cf8', type: 'entity' },
    { id: 'staff',     label: 'Staff',              icon: 'ri-group-fill',             color: '#34d399', type: 'entity' },
    { id: 'stuatt',    label: 'Student Attendance', icon: 'ri-user-location-fill',     color: '#38bdf8', type: 'att', person: 'Student', list: 'students' },
    { id: 'staffatt',  label: 'Staff Attendance',   icon: 'ri-calendar-check-fill',    color: '#a78bfa', type: 'att', person: 'Staff',   list: 'staff' },
    { id: 'toppers',   label: 'Toppers',            icon: 'ri-award-fill',             color: '#fbbf24', type: 'entity' },
    { id: 'events',    label: 'Functions',          icon: 'ri-calendar-schedule-fill', color: '#f97316', type: 'entity' },
    { id: 'notices',   label: 'Notices',            icon: 'ri-megaphone-fill',         color: '#f87171', type: 'entity' },
    { id: 'inquiries', label: 'Admission Enquiries',          icon: 'ri-mail-star-fill',         color: '#22c1e8', type: 'entity' },
    { id: 'site',      label: 'Website Images',  icon: 'ri-image-edit-fill',        color: '#ec4899', type: 'site' }
  ];
  var STATS = [
    { key: 'students', label: 'Total Students', icon: 'ri-user-star-fill', color: '#818cf8' },
    { key: 'staff', label: 'Total Staff Members', icon: 'ri-group-fill', color: '#34d399' },
    { key: 'toppers', label: 'Toppers', icon: 'ri-award-fill', color: '#fbbf24' },
    { key: 'events', label: 'Events', icon: 'ri-calendar-schedule-fill', color: '#f97316' }
  ];

  function icon(cls, color) { var i = h('i', { class: cls }); if (color) i.style.color = color; return i; }
  function toast(msg, isErr) {
    var t = h('div', { class: 'adm-toast' + (isErr ? ' err' : ''), role: 'status', text: msg });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 3200);
  }
  function monthNow() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

  /* ---------- API ---------- */
  function logout(msg) { token = ''; sessionStorage.removeItem(TOKEN_KEY); schema = null; showLogin(msg); }
  function api(path, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json', Authorization: 'Bearer ' + token };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) {
        if (r.status === 401) { logout('Session expired. Please log in again.'); return Promise.reject(new Error('auth')); }
        return r.json().catch(function () { return {}; }).then(function (j) { return r.ok ? j : Promise.reject(new Error(j.error || 'Request failed')); });
      });
  }
  function fail(e) { if (e && e.message !== 'auth') toast(e.message || 'Something went wrong', true); }
  function download(path, name) { try { SCStore.download(path, name); } catch (e) { fail(e); } }

  /* ---------- photo upload: choose a file, it is cropped/resized in the browser and stored with the record ---------- */
  function resizeImage(file, wide, spec) {   // spec = { w, h, fit: 'cover' | 'contain', q } overrides the defaults
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error('Please choose an image file.'));
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        spec = spec || {};
        var w = spec.w || (wide ? 800 : 256), ht = spec.h || (wide ? 500 : 256);
        var s = spec.fit === 'contain' ? Math.min(w / im.width, ht / im.height) : Math.max(w / im.width, ht / im.height);   // cover-crop (or fit whole picture)
        var c = document.createElement('canvas'); c.width = w; c.height = ht;
        var x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, w, ht);
        x.drawImage(im, (w - im.width * s) / 2, (ht - im.height * s) / 2, im.width * s, im.height * s);
        resolve(c.toDataURL('image/jpeg', spec.q || 0.82));
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
      im.src = url;
    });
  }
  function photoField(f, value) {
    var state = { value: value || '' };
    var preview = h('div', { class: 'photo-preview' + (f.wide ? ' wide' : '') });
    var file = h('input', { type: 'file', accept: 'image/*', class: 'photo-file', hidden: true });
    var pick = h('button', { type: 'button', class: 'adm-btn sm' }, icon('ri-upload-2-fill'), ' Upload photo');
    var clear = h('button', { type: 'button', class: 'adm-btn sm danger' }, icon('ri-delete-bin-6-fill'), ' Remove');
    function draw() { preview.textContent = ''; preview.appendChild(img(state.value, 'Image Preview')); clear.hidden = !state.value; }
    pick.addEventListener('click', function () { file.click(); });
    clear.addEventListener('click', function () { state.value = ''; file.value = ''; draw(); });
    file.addEventListener('change', function () {
      if (!file.files[0]) return;
      resizeImage(file.files[0], f.wide).then(function (data) { state.value = data; draw(); }).catch(fail);
    });
    draw();
    return {
      state: state,
      node: h('div', { class: 'photo-field' }, preview,
        h('div', { class: 'photo-actions' }, pick, clear, h('small', { text: 'No photo? The class logo is used automatically.' })), file)
    };
  }

  /* ---------- login / logout ---------- */
  function showLogin(msg) {
    $('adminApp').hidden = true; $('loginView').hidden = false;
    var err = $('loginError'); err.hidden = !msg; err.textContent = msg || '';
    $('loginPass').value = '';
  }
  function showApp() {
    $('loginView').hidden = true; $('adminApp').hidden = false;
    api('/api/admin-schema').then(function (s) { schema = s; buildTabs(); loadStats(); openTab(current); }).catch(fail);
  }
  $('loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = ev.target.querySelector('button[type="submit"]'); btn.disabled = true;
    fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: $('loginUser').value, password: $('loginPass').value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok) return showLogin(res.body.error || 'Login failed. Please check your credentials and try again.');
        token = res.body.token; sessionStorage.setItem(TOKEN_KEY, token); showApp();
      })
      .catch(function () { showLogin('Login failed. Please check your credentials and try again.'); })
      .then(function () { btn.disabled = false; });
  });
  $('btnLogout').addEventListener('click', function () { logout(''); });
  $('btnAllExcel').addEventListener('click', function () { download('/api/admin/export/all/xlsx', 'sagar-classes-all-data'); });

  /* ---------- tabs + stats ---------- */
  function buildTabs() {
    var nav = $('adminTabs'); nav.textContent = '';
    TABS.forEach(function (t) {
      nav.appendChild(h('button', { type: 'button', class: 'admin-tab-btn' + (t.id === current ? ' active' : ''), 'data-tab': t.id,
        onclick: function () { openTab(t.id); } }, icon(t.icon, t.color), ' ' + t.label));
    });
  }
  function loadStats() {
    api('/api/admin/stats').then(function (s) {
      var grid = $('statsGrid'); grid.textContent = '';
      STATS.forEach(function (x) {
        grid.appendChild(h('div', { class: 'admin-stat-card' }, icon(x.icon, x.color),
          h('div', {}, h('strong', { text: String(s[x.key] || 0) }), h('span', { text: x.label }))));
      });
    }).catch(fail);
  }
  function openTab(id) {
    current = id;
    document.querySelectorAll('#adminTabs .admin-tab-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === id); });
    var tab = TABS.filter(function (t) { return t.id === id; })[0];
    if (tab.type === 'entity') renderEntity(tab);
    else if (tab.type === 'site') renderSite(tab);
    else renderAttendance(tab);
  }

  /* ---------- modal form (text, select, textarea and photo fields) ---------- */
  function openModal(title, fields, values, onSave) {
    var form = h('form', { class: 'modal-content form-modal', novalidate: true });
    var err = h('p', { class: 'adm-error', role: 'alert', hidden: true });
    var inputs = {}, photos = {};
    form.appendChild(h('h3', { class: 'modal-title', text: title }));

    fields.forEach(function (f) {
      var initial = values && values[f.key] != null ? values[f.key] : (f.default || ''), el;
      if (f.type === 'photo') {
        photos[f.key] = photoField(f, initial);
        form.appendChild(h('div', { class: 'photo-label' }, h('span', { text: f.label }), photos[f.key].node));
        return;
      }
      if (f.type === 'select') {
        el = h('select', { class: 'pill-input', name: f.key });
        el.appendChild(h('option', { value: '', text: 'Select…' }));
        f.options.forEach(function (o) {
          var opt = typeof o === 'string' ? { value: o, label: o } : o;
          el.appendChild(h('option', { value: opt.value, text: opt.label }));
        });
      } else if (f.long) el = h('textarea', { class: 'pill-input', name: f.key, maxlength: f.max });
      else el = h('input', { class: 'pill-input', name: f.key, type: f.type || 'text', maxlength: f.max });
      el.value = initial;
      if (f.disabled) el.disabled = true;
      inputs[f.key] = el;
      form.appendChild(h('label', {}, f.label + (f.required ? ' *' : ''), el));
    });

    form.appendChild(err);
    var cancel = h('button', { type: 'button', class: 'adm-btn', text: 'Cancel' });
    var save = h('button', { type: 'submit', class: 'adm-btn primary' }, icon('ri-save-3-fill'), ' Save');
    form.appendChild(h('div', { class: 'modal-actions' }, cancel, save));

    var overlay = h('div', { class: 'modal active', role: 'dialog', 'aria-modal': 'true' }, form);
    function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    cancel.addEventListener('click', close);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var data = {};
      Object.keys(inputs).forEach(function (k) { data[k] = inputs[k].value; });
      Object.keys(photos).forEach(function (k) { data[k] = photos[k].state.value; });
      save.disabled = true; err.hidden = true;
      onSave(data).then(close).catch(function (e) {
        if (e && e.message === 'auth') return;
        err.textContent = e.message || 'Unable to save the record. Please try again.'; err.hidden = false; save.disabled = false;
      });
    });
    document.body.appendChild(overlay);
    var first = form.querySelector('input:not([type=file]),textarea,select'); if (first) first.focus();
  }

  /* ---------- table helpers ---------- */
  function cell(label, content, cls) {   /* data-label lets the CSS turn rows into cards on phones */
    var td = h('td', { 'data-label': label, class: cls || '' });
    if (typeof content === 'string') td.textContent = content; else if (content) td.appendChild(content);
    return td;
  }
  function actions(onEdit, onDelete) {
    return h('div', { class: 'adm-row-actions' },
      onEdit ? h('button', { type: 'button', class: 'adm-btn sm', onclick: onEdit }, icon('ri-edit-2-fill'), ' Edit') : null,
      h('button', { type: 'button', class: 'adm-btn sm danger', onclick: onDelete }, icon('ri-delete-bin-6-fill'), ' Delete'));
  }
  function exportButtons(slug, month) {
    var q = month ? '?month=' + month : '';
    return [
      h('button', { type: 'button', class: 'adm-btn', onclick: function () { download('/api/admin/export/' + slug + '/xlsx' + q, slug); } }, icon('ri-file-excel-2-fill', '#34d399'), ' Excel'),
      h('button', { type: 'button', class: 'adm-btn', onclick: function () { download('/api/admin/export/' + slug + '/pdf' + q, slug); } }, icon('ri-file-pdf-2-fill', '#f87171'), ' PDF')
    ];
  }

  /* ---------- students / staff / toppers / events / notices / enquiries ---------- */
  function renderEntity(tab) {
    var def = schema[tab.id], panel = $('adminPanel'), rows = [], query = '';
    var hasPhoto = def.fields.some(function (f) { return f.type === 'photo'; });
    var cols = def.lead.concat(def.fields.filter(function (f) { return f.type !== 'photo'; }), def.extra);
    var tbody = h('tbody'), count = h('span', { class: 'adm-count' });

    var search = h('input', { class: 'pill-input', type: 'search', placeholder: 'Search records…', 'aria-label': 'Search',
      oninput: function () { query = search.value.trim().toLowerCase(); draw(); } });
    var toolbar = h('div', { class: 'adm-toolbar' }, search);
    if (!def.readOnlyCreate) toolbar.appendChild(h('button', { type: 'button', class: 'adm-btn primary', onclick: function () { edit(null); } }, icon('ri-add-circle-fill'), ' Add'));
    toolbar.appendChild(h('span', { class: 'spacer' }));
    exportButtons(tab.id).forEach(function (b) { toolbar.appendChild(b); });

    var head = h('tr');
    if (hasPhoto) head.appendChild(h('th', { class: 'col-photo', text: 'Photo' }));
    cols.forEach(function (c) { head.appendChild(h('th', { text: c.label })); });
    head.appendChild(h('th', { text: 'Actions' }));

    panel.textContent = '';
    panel.appendChild(h('h3', { class: 'form-title' }, icon(tab.icon, tab.color), ' ' + def.label, count));
    panel.appendChild(toolbar);
    panel.appendChild(h('div', { class: 'table-responsive-wrapper' }, h('table', { class: 'adm-table' }, h('thead', {}, head), tbody)));

    function draw() {
      tbody.textContent = '';
      var shown = rows.filter(function (r) {
        return !query || cols.concat(def.fields).some(function (f) { return String(r[f.key] == null ? '' : r[f.key]).toLowerCase().indexOf(query) !== -1; });
      });
      count.textContent = '(' + shown.length + ')';
      if (!shown.length) { tbody.appendChild(h('tr', {}, h('td', { class: 'adm-empty', colspan: cols.length + 2, text: 'No records found.' }))); return; }
      shown.forEach(function (r) {
        var tr = h('tr');
        if (hasPhoto) tr.appendChild(cell('Photo', img(r.photo_url, r.name || r.title, 'admin-avatar')));
        cols.forEach(function (c) { tr.appendChild(cell(c.label, r[c.key] == null ? '' : String(r[c.key]), c.long ? 'long' : '')); });
        tr.appendChild(cell('Actions', actions(def.readOnlyCreate ? null : function () { edit(r); }, function () { remove(r); })));
        tbody.appendChild(tr);
      });
    }
    function load() { api('/api/admin/' + tab.id).then(function (d) { rows = d; draw(); }).catch(fail); }
    function edit(row) {
      openModal(row ? 'Edit record' : 'Add ' + def.label.replace(/s$/, ''), def.fields, row, function (data) {
        var p = row ? api('/api/admin/' + tab.id + '/' + row.id, { method: 'PUT', body: data }) : api('/api/admin/' + tab.id, { method: 'POST', body: data });
        return p.then(function () { toast(row ? 'Updated' : 'Added'); load(); loadStats(); });
      });
    }
    function remove(row) {
      var label = row.name || row.title || row.text || ('#' + row.id);
      var extra = tab.id === 'students' || tab.id === 'staff' ? ' Their attendance records will be deleted too.' : '';
      if (!window.confirm('Delete "' + String(label).slice(0, 60) + '"?' + extra + ' This cannot be undone.')) return;
      api('/api/admin/' + tab.id + '/' + row.id, { method: 'DELETE' }).then(function () { toast('Deleted'); load(); loadStats(); }).catch(fail);
    }
    load();
  }


  /* ---------- site images: home hero picture, about-page profile photo (upload / change / remove) ---------- */
  function renderSite(tab) {
    var panel = $('adminPanel'), grid = h('div', { class: 'site-grid' }), st = {};
    var base = SCStore.logo.replace(/logo\.jpe?g.*$/, '');
    var ITEMS = [
      { key: 'hero_image', title: 'Homepage Hero Image', note: 'Main image displayed beside the homepage heading.',
        spec: { w: 1000, h: 625, fit: 'cover', q: 0.85 }, shape: 'wide', fallback: base + 'hero.svg', fallbackNote: 'Default illustration is shown.' },
      { key: 'profile_photo', title: 'Founder Profile Image', note: 'Photo of the founder or director displayed on the About page.',
        spec: { w: 480, h: 480, fit: 'cover', q: 0.85 }, shape: 'round', fallback: SCStore.logo, fallbackNote: 'Class logo is shown.' }
    ];

    panel.textContent = '';
    panel.appendChild(h('h3', { class: 'form-title' }, icon(tab.icon, tab.color), ' ' + tab.label));
    panel.appendChild(grid);

    function card(it) {
      var preview = h('div', { class: 'site-preview ' + it.shape });
      var file = h('input', { type: 'file', accept: 'image/*', hidden: true });
      var pick = h('button', { type: 'button', class: 'adm-btn primary' });
      var clear = h('button', { type: 'button', class: 'adm-btn danger' }, icon('ri-delete-bin-6-fill'), ' Remove');
      var hint = h('small', { class: 'adm-muted' });

      function draw() {
        var v = st[it.key];
        preview.textContent = '';
        if (v || it.fallback) { var im = img(v || it.fallback, it.title); if (!v && it.fallback === SCStore.logo) im.classList.add('is-logo'); preview.appendChild(im); }
        else preview.appendChild(h('div', { class: 'site-empty' }, icon('ri-image-line'), h('span', { text: 'Not uploaded' })));
        pick.textContent = ''; pick.appendChild(icon(v ? 'ri-edit-2-fill' : 'ri-upload-2-fill')); pick.appendChild(document.createTextNode(v ? ' Change' : ' Upload'));
        clear.hidden = !v;
        hint.textContent = v ? 'This custom image is currently displayed on the website.' : it.fallbackNote;
      }
      function save(value, msg) {
        var body = {}; body[it.key] = value;
        return api('/api/admin/settings', { method: 'PUT', body: body }).then(function () { st[it.key] = value; draw(); toast(msg); });
      }
      pick.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        var f = file.files[0]; file.value = '';
        if (!f) return;
        pick.disabled = true;
        resizeImage(f, false, it.spec).then(function (data) { return save(data, 'Image updated'); }).catch(fail).then(function () { pick.disabled = false; });
      });
      clear.addEventListener('click', function () {
        if (window.confirm('Are you sure you want to remove this image?')) save('', 'Image removed successfully.').catch(fail);
      });
      draw();
      return h('article', { class: 'site-card' },
        preview,
        h('div', { class: 'site-info' }, h('h4', { text: it.title }), h('p', { class: 'adm-muted', text: it.note }), hint,
          h('div', { class: 'site-actions' }, pick, clear)), file);
    }

    api('/api/admin/settings').then(function (s) { st = s; ITEMS.forEach(function (it) { grid.appendChild(card(it)); }); }).catch(fail);
  }

  /* ---------- attendance (only people from the Students / Staff lists) ---------- */
  function renderAttendance(tab) {
    var panel = $('adminPanel'), person = tab.person, month = monthNow(), people = [];
    var groupLabel = person === 'Student' ? 'Class' : 'Department';
    var regBox = h('div', { class: 'table-responsive-wrapper' }), recBox = h('div', { class: 'table-responsive-wrapper' });
    var slug = person === 'Student' ? 'student-attendance' : 'staff-attendance';

    var monthInput = h('input', { class: 'pill-input month-input', type: 'month', value: month, 'aria-label': 'Month',
      onchange: function () { if (monthInput.value) { month = monthInput.value; load(); } } });
    var toolbar = h('div', { class: 'adm-toolbar' }, monthInput,
      h('button', { type: 'button', class: 'adm-btn primary', onclick: function () { edit(null); } }, icon('ri-add-circle-fill'), ' Add record'),
      h('span', { class: 'spacer' }));
    var exp = exportButtons(slug, month);
    exp.forEach(function (b) { toolbar.appendChild(b); });
    /* export buttons must use the month chosen at click time */
    exp[0].onclick = function () { download('/api/admin/export/' + slug + '/xlsx?month=' + month, slug); };
    exp[1].onclick = function () { download('/api/admin/export/' + slug + '/pdf?month=' + month, slug); };

    panel.textContent = '';
    panel.appendChild(h('h3', { class: 'form-title' }, icon(tab.icon, tab.color), ' ' + tab.label));
    panel.appendChild(toolbar); panel.appendChild(regBox);
    panel.appendChild(h('h4', { class: 'adm-sub', text: 'Individual records' }));
    panel.appendChild(recBox);

    function nameCell(r) { return h('div', { class: 'who' }, img(r.photo_url, r.name, 'admin-avatar sm'), h('div', {}, h('span', { text: r.name }), h('small', { text: r.group || r.group_name }))); }

    function drawRegister(reg) {
      var head = h('tr', {}, h('th', { class: 'reg-name', text: person }));
      for (var d = 1; d <= reg.days; d++) head.appendChild(h('th', { class: reg.sundays.indexOf(d) !== -1 ? 'sun' : '', text: String(d) }));
      head.appendChild(h('th', { text: 'P' })); head.appendChild(h('th', { text: 'A' }));
      var body = h('tbody');
      reg.rows.forEach(function (r) {
        var tr = h('tr', {}, h('td', { class: 'reg-name' }, nameCell(r)));
        r.cells.forEach(function (c, i) { tr.appendChild(h('td', { class: (reg.sundays.indexOf(i + 1) !== -1 ? 'sun ' : '') + (c === 'P' ? 'cp' : c === 'A' ? 'ca' : ''), text: c || '–' })); });
        tr.appendChild(h('td', { class: 'cp', text: String(r.present) })); tr.appendChild(h('td', { class: 'ca', text: String(r.absent) }));
        body.appendChild(tr);
      });
      if (!reg.rows.length) body.appendChild(h('tr', {}, h('td', { class: 'adm-empty', colspan: reg.days + 3, text: 'Add ' + person.toLowerCase() + 's in the ' + person + 's tab first.' })));
      regBox.textContent = ''; regBox.appendChild(h('table', { class: 'register' }, h('thead', {}, head), body));
    }
    function drawRecords(reg) {
      var body = h('tbody');
      reg.records.slice().reverse().forEach(function (r) {
        body.appendChild(h('tr', {},
          cell('Date', r.att_date), cell(person, nameCell(r)), cell(groupLabel, r.group_name),
          cell('Status', h('span', { class: 'adm-pill ' + (r.status === 'Present' ? 'p' : 'a'), text: r.status })),
          cell('Actions', actions(function () { edit(r); }, function () { remove(r); }))));
      });
      if (!reg.records.length) body.appendChild(h('tr', {}, h('td', { class: 'adm-empty', colspan: 5, text: 'No attendance records for this month.' })));
      recBox.textContent = '';
      recBox.appendChild(h('table', { class: 'adm-table' },
        h('thead', {}, h('tr', {}, ['Date', person, groupLabel, 'Status', 'Actions'].map(function (t) { return h('th', { text: t }); }))), body));
    }
    function load() {
      api('/api/admin/attendance?type=' + person + '&month=' + month).then(function (reg) { drawRegister(reg); drawRecords(reg); }).catch(fail);
    }
    function edit(rec) {
      var today = new Date().toISOString().slice(0, 10);
      var options = people.map(function (p) { return { value: String(p.id), label: p.name + ' (' + (p.class_name || p.department) + ')' }; });
      if (!options.length) return toast('Add ' + person.toLowerCase() + 's in the ' + person + 's tab first.', true);
      var fields = [
        { key: 'person_id', label: person, type: 'select', options: options, required: true },
        { key: 'att_date', label: 'Date', type: 'date', required: true, default: month === today.slice(0, 7) ? today : month + '-01' },
        { key: 'status', label: 'Status', type: 'select', options: ['Present', 'Absent'], required: true }
      ];
      openModal(rec ? 'Edit attendance' : 'Add attendance', fields, rec && { person_id: String(rec.person_id), att_date: rec.att_date, status: rec.status }, function (data) {
        data.person_type = person;
        var p = rec ? api('/api/admin/attendance/' + rec.id, { method: 'PUT', body: data }) : api('/api/admin/attendance', { method: 'POST', body: data });
        return p.then(function () { toast(rec ? 'Updated' : 'Saved'); load(); });
      });
    }
    function remove(rec) {
      if (!window.confirm('Delete the attendance record for ' + rec.name + ' on ' + rec.att_date + '?')) return;
      api('/api/admin/attendance/' + rec.id, { method: 'DELETE' }).then(function () { toast('Deleted'); load(); }).catch(fail);
    }
    api('/api/admin/' + tab.list).then(function (list) { people = list; }).catch(fail);
    load();
  }

  /* ---------- start ---------- */
  if (token) api('/api/admin/me').then(showApp).catch(function (e) { if (e && e.message !== 'auth') showLogin(''); });
  else showLogin('');
})();
