/* Sagar Classes – browser data store.
   Every /api/... request made by script.js and admin.js is answered here from localStorage.
   Data lives in THIS browser only. */
(function () {
  'use strict';

  var DB_KEY = 'sc_db_v2';
  var DB_VERSION = 6;
  var SETTING_KEYS = ['hero_image', 'profile_photo'];
  var SESSION_VALUE = 'local-admin-session';
  var DEFAULT_ADMIN = { user: 'admin', pass: 'admin@123' };   // change: SCStore.setAdmin('user','password')

  /* Class logo = default picture everywhere a photo is missing. */
  var LOGO = (function () {
    var s = document.currentScript;
    return s && s.src ? s.src.replace(/js\/store\.js.*$/, 'images/logo.jpeg') : 'images/logo.jpeg';
  })();

  /* ---------- small helpers ---------- */
  var PHONE = /^[0-9+()\-\s]{6,20}$/;
  var DATA_IMG = /^data:image\/(jpeg|png|webp|gif);base64,/;
  var MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

  function range(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }
  var STUDENT_CLASSES = range(1, 12).map(function (n) { return 'Class ' + n; });
  var TOPPER_CLASSES = range(1, 10).map(function (n) { return 'Class ' + n; })
    .concat(['Class 11 (Science)', 'Class 11 (Commerce)', 'Class 12 (Science)', 'Class 12 (Commerce)']);

  function now() { return new Date().toISOString().slice(0, 19).replace('T', ' '); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function currentMonth() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function isValidDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var d = new Date(s + 'T00:00:00Z');
    return !isNaN(d) && d.toISOString().slice(0, 10) === s;
  }
  function HttpError(status, message) { this.status = status; this.message = message; }

  /* Natural sort: "Class 2" comes before "Class 10". */
  function sorted(list, order) {
    return list.slice().sort(function (a, b) {
      for (var i = 0; i < order.length; i++) {
        var k = order[i], desc = k[0] === '-'; if (desc) k = k.slice(1);
        var x = a[k], y = b[k];
        var c = typeof x === 'number' ? x - y : String(x || '').localeCompare(String(y || ''), undefined, { numeric: true });
        if (c) return desc ? -c : c;
      }
      return 0;
    });
  }

  /* ---------- toppers: rank is calculated from the score, inside each class ---------- */
  function num(score) { return parseFloat(score) || 0; }
  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function rankToppers(list) {
    var byClass = {};
    list.map(function (t) { return Object.assign({}, t); }).forEach(function (t) { (byClass[t.class_name] = byClass[t.class_name] || []).push(t); });
    var out = [];
    Object.keys(byClass).forEach(function (cls) {
      var rank = 0, prev = null;
      byClass[cls].sort(function (a, b) { return num(b.score) - num(a.score) || a.id - b.id; }).forEach(function (t, i) {
        if (num(t.score) !== prev) { rank = i + 1; prev = num(t.score); }   // equal scores share a rank
        t.rank = rank; t.rank_label = ordinal(rank); out.push(t);
      });
    });
    var pos = function (t) { var i = TOPPER_CLASSES.indexOf(t.class_name); return i < 0 ? 999 : i; };
    return out.sort(function (a, b) { return pos(a) - pos(b) || a.class_name.localeCompare(b.class_name) || a.rank - b.rank || a.id - b.id; });
  }
  function homeToppers(list) {   // one topper for every class
    var seen = {};
    return rankToppers(list).filter(function (t) { return seen[t.class_name] ? false : (seen[t.class_name] = true); });
  }

  /* ---------- entity definitions (validation + labels) ---------- */
  var PHOTO = { key: 'photo_url', label: 'Photo', type: 'photo', noExport: true };
  var ENTITIES = {
    students: { label: 'Students', order: ['class_name', 'name'], fields: [
      { key: 'name', label: 'Name', max: 100, required: true },
      { key: 'phone', label: 'Phone Number', max: 20, pattern: PHONE },
      { key: 'class_name', label: 'Class', type: 'select', options: STUDENT_CLASSES, required: true },
      PHOTO] },
    staff: { label: 'Staff', order: ['name'], fields: [
      { key: 'name', label: 'Name', max: 100, required: true },
      { key: 'phone', label: 'Phone Number', max: 20, pattern: PHONE },
      { key: 'department', label: 'Department', max: 80, required: true },
      PHOTO] },
    toppers: { label: 'Toppers', order: ['id'], lead: [{ key: 'rank_label', label: 'Rank' }], fields: [
      { key: 'name', label: 'Name', max: 100, required: true },
      { key: 'class_name', label: 'Class', type: 'select', options: TOPPER_CLASSES, required: true },
      { key: 'score', label: 'Score (%)', max: 10, required: true, pattern: /^\d{1,3}(\.\d+)?\s*%?$/, percent: true },
      PHOTO] },
    events: { label: 'Events & Celebrations', order: ['id'], fields: [
      { key: 'title', label: 'Event', max: 120, required: true },
      { key: 'category', label: 'Category', max: 50, required: true },
      { key: 'description', label: 'Description', max: 500, long: true },
      { key: 'photo_url', label: 'Photo', type: 'photo', wide: true, noExport: true }] },
    notices: { label: 'Notices', order: ['id'], fields: [
      { key: 'text', label: 'Notice Message', max: 300, required: true, long: true }] },
    inquiries: { label: 'Admission Enquiries', order: ['-id'], readOnlyCreate: true, extra: [{ key: 'created_at', label: 'Received' }], fields: [
      { key: 'name', label: 'Name', max: 100, required: true },
      { key: 'phone', label: 'Phone', max: 20, required: true, pattern: PHONE },
      { key: 'standard', label: 'Interested in', max: 60 },
      { key: 'message', label: 'Message', max: 1000, long: true }] }
  };

  /* ---------- sample data (no photos: the class logo is used automatically) ---------- */
  function seed() {
    var db = {
      students: [
        { name: 'Aarav Sharma', phone: '+91 98111 22331', class_name: 'Class 10' },
        { name: 'Priya Mehta', phone: '+91 98222 33442', class_name: 'Class 10' },
        { name: 'Rohan Patil', phone: '+91 98333 44553', class_name: 'Class 9' },
        { name: 'Sneha Joshi', phone: '+91 98444 55664', class_name: 'Class 12' },
        { name: 'Aryan Gupta', phone: '+91 98555 66775', class_name: 'Class 8' },
        { name: 'Ishaan Verma', phone: '+91 98666 78886', class_name: 'Class 11' }],
      staff: [
        { name: 'Sagar Sir', phone: '+91 99111 00111', department: 'Mathematics' },
        { name: "Pooja Ma'am", phone: '+91 99222 00222', department: 'Science' },
        { name: 'Rahul Sir', phone: '+91 99888 00888', department: 'English' },
        { name: "Anita Ma'am", phone: '+91 99999 00999', department: 'Social Science' }],
      toppers: [
        { name: 'Aarav Sharma', class_name: 'Class 10', score: '95%' },
        { name: 'Priya Mehta', class_name: 'Class 10', score: '93%' },
        { name: 'Sneha Joshi', class_name: 'Class 12 (Science)', score: '97%' },
        { name: 'Ishaan Verma', class_name: 'Class 12 (Science)', score: '91%' },
        { name: 'Rohan Kapoor', class_name: 'Class 12 (Commerce)', score: '94%' },
        { name: 'Ananya Sen', class_name: 'Class 12 (Commerce)', score: '90%' }],
      events: [
        ['Annual Picnic', 'Picnic', 'A fun-filled educational picnic with games, teamwork and memorable activities.'],
        ['Sports Day', 'Sports', 'Track, field and team activities that encourage fitness, discipline and sportsmanship.'],
        ['Farewell', 'Farewell', 'A warm send-off for our outgoing students with memories, messages, awards and best wishes for the road ahead.'],
        ['Parent-Teacher Meeting', 'PTM', 'A constructive interaction between parents and teachers to review student progress.'],
        ['Independence Day', 'National Day', 'Patriotic activities, student performances and a special assembly celebrating India.'],
        ['Holi', 'Festival', 'A colourful, joyful celebration of Holi with safe organic colours, music, sweets and plenty of fun together.']
      ].map(function (e) { return { title: e[0], category: e[1], description: e[2] }; }),
      notices: [
        { text: '🎓 Admissions are open for the 2026–27 academic year. Enquire today!' },
        { text: '📝 Unit Test scheduled for Class 10 on 1st September 2026.' },
        { text: '🏆 Congratulations to all Board toppers of 2025-26 batch!' },
        { text: '📅 Parent-Teacher Meeting on 10th September 2026 at 10:00 AM.' }],
      inquiries: [], attendance: [], seq: {}, settings: {}, v: DB_VERSION, admin: { user: DEFAULT_ADMIN.user, hash: hash(DEFAULT_ADMIN.pass) }
    };
    ['students', 'staff', 'toppers', 'events', 'notices'].forEach(function (k) {
      db[k].forEach(function (r) { r.photo_url = r.photo_url || null; r.id = (db.seq[k] = (db.seq[k] || 0) + 1); r.created_at = now(); });
    });
    return db;
  }

  /* ---------- storage ---------- */
  function migrate(db) {   // older saved data gets the new parts (settings, events) without losing anything
    if (db.v >= DB_VERSION) return db;
    db.settings = db.settings || {}; delete db.settings.upi_qr;
    db.events = db.events.filter(function (e) { return !/^(Diwali Celebration|Science Exhibition)$/.test(e.title); });
    db.events.forEach(function (e) {
      if (e.title === 'Republic Day') { e.title = 'Holi'; e.category = 'Festival'; e.description = 'A colourful, joyful celebration of Holi with safe organic colours, music, sweets and plenty of fun together.'; }
      if (e.title === 'Annual Day') { e.title = 'Farewell'; e.category = 'Farewell'; e.description = 'A warm send-off for our outgoing students with memories, messages, awards and best wishes for the road ahead.'; }
    });
    db.v = DB_VERSION;
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { memoryFallback = db; }
    return db;
  }
  var memoryFallback = null;   // used only if localStorage is blocked
  function load() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) { var old = migrate(JSON.parse(raw)); return old; }
      var db = seed(); localStorage.setItem(DB_KEY, JSON.stringify(db)); return db;
    } catch (e) { return memoryFallback || (memoryFallback = seed()); }
  }
  function save(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.code === 22)) throw new HttpError(507, 'Browser storage is full. Remove some images and try again.');
      memoryFallback = db;
    }
  }
  function nextId(db, k) { db.seq[k] = (db.seq[k] || 0) + 1; return db.seq[k]; }

  /* ---------- validation ---------- */
  function cleanBody(ent, body) {
    var values = {};
    for (var i = 0; i < ent.fields.length; i++) {
      var f = ent.fields[i], v = body[f.key];
      v = v === undefined || v === null ? '' : String(v).trim();
      if (f.required && !v) return { error: f.label + ' is required.' };
      if (f.type === 'photo') {
        if (v && (!DATA_IMG.test(v) || v.length > 600000)) return { error: 'Photo is invalid or too large.' };
      } else {
        if (v.length > (f.max || 100)) return { error: f.label + ' must be at most ' + f.max + ' characters.' };
        if (v && f.pattern && !f.pattern.test(v)) return { error: f.label + ' is not valid.' };
        if (v && f.options && f.options.indexOf(v) < 0) return { error: f.label + ' is not valid.' };
        if (v && f.percent) v = parseFloat(v) + '%';
      }
      values[f.key] = v === '' ? null : v;
    }
    return { values: values };
  }

  /* ---------- attendance (only people that exist in the admin lists) ---------- */
  var typeOf = function (t) { return String(t).toLowerCase() === 'staff' ? 'Staff' : 'Student'; };
  var listOf = function (db, type) { return type === 'Staff' ? db.staff : db.students; };
  var groupOf = function (p, type) { return type === 'Staff' ? p.department : p.class_name; };

  function parseAttendance(db, body, type) {
    var id = +body.person_id, date = String(body.date || body.att_date || '').trim(), status = String(body.status || '').trim();
    var person = listOf(db, type).filter(function (p) { return p.id === id; })[0];
    if (!person) return { error: 'Please select ' + (type === 'Staff' ? 'a staff member' : 'a student') + ' from the list.' };
    if (!isValidDate(date)) return { error: 'Please choose a valid date.' };
    if (status !== 'Present' && status !== 'Absent') return { error: 'Choose Present or Absent.' };
    return { type: type, person_id: id, date: date, status: status };
  }
  function upsertAttendance(db, a) {
    var ex = db.attendance.filter(function (r) { return r.person_type === a.type && r.person_id === a.person_id && r.att_date === a.date; })[0];
    if (ex) { ex.status = a.status; return; }
    db.attendance.push({ id: nextId(db, 'attendance'), person_type: a.type, person_id: a.person_id, att_date: a.date, status: a.status, created_at: now() });
  }

  function buildRegister(db, type, month) {
    var p = month.split('-'), y = +p[0], m = +p[1], days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var byId = {};
    var master = type === 'Staff' ? sorted(db.staff, ['name']) : sorted(db.students, ['class_name', 'name']);
    var rows = master.map(function (s) {
      return (byId[s.id] = { id: s.id, name: s.name, group: groupOf(s, type), photo_url: s.photo_url || null, cells: new Array(days).fill('') });
    });
    var records = db.attendance.filter(function (r) { return r.person_type === type && byId[r.person_id] && r.att_date.slice(0, 7) === month; })
      .sort(function (a, b) { return a.att_date.localeCompare(b.att_date) || byId[a.person_id].name.localeCompare(byId[b.person_id].name); })
      .map(function (r) {
        var q = byId[r.person_id]; q.cells[+r.att_date.slice(8, 10) - 1] = r.status === 'Present' ? 'P' : 'A';
        return { id: r.id, person_id: r.person_id, name: q.name, group_name: q.group, photo_url: q.photo_url, att_date: r.att_date, status: r.status };
      });
    rows.forEach(function (q) {
      q.present = q.cells.filter(function (c) { return c === 'P'; }).length;
      q.absent = q.cells.filter(function (c) { return c === 'A'; }).length;
    });
    var sundays = [];
    for (var d = 1; d <= days; d++) if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) sundays.push(d);
    return { month: month, days: days, sundays: sundays, rows: rows, records: records };
  }

  /* ---------- API router ---------- */
  function listFor(db, key) {
    var ent = ENTITIES[key];
    return key === 'toppers' ? rankToppers(db.toppers) : sorted(db[key], ent.order);
  }
  function cascadeDelete(db, key, id) {
    if (key !== 'students' && key !== 'staff') return;
    var type = key === 'staff' ? 'Staff' : 'Student';
    db.attendance = db.attendance.filter(function (r) { return !(r.person_type === type && r.person_id === id); });
  }

  function publicSettings(db) {
    var out = {}; SETTING_KEYS.forEach(function (k) { out[k] = (db.settings && db.settings[k]) || null; });
    return out;
  }

  function route(method, url, body, init) {
    var u = new URL(url, location.href), path = u.pathname.replace(/^.*?\/api\//, '/api/'), q = u.searchParams, m;
    var db = load();

    if (method === 'POST' && path === '/api/auth/login') {
      var user = String(body.username || '').trim(), pass = String(body.password || '');
      if (user !== db.admin.user || hash(pass) !== db.admin.hash) throw new HttpError(401, 'Invalid username or password.');
      return { token: SESSION_VALUE, username: user };
    }

    /* public */
    if (method === 'GET' && path === '/api/public/notices') return sorted(db.notices, ['id']).map(function (n) { return { text: n.text }; });
    if (method === 'GET' && path === '/api/public/toppers') return rankToppers(db.toppers);
    if (method === 'GET' && path === '/api/public/home-toppers') return homeToppers(db.toppers);
    if (method === 'GET' && path === '/api/public/events') return sorted(db.events, ['id']);
    if (method === 'GET' && path === '/api/public/people') {
      var pt = typeOf(q.get('type'));
      return (pt === 'Staff' ? sorted(db.staff, ['name']) : sorted(db.students, ['class_name', 'name']))
        .map(function (p) { return { id: p.id, name: p.name, group: groupOf(p, pt), photo_url: p.photo_url || null }; });
    }
    if (method === 'GET' && path === '/api/public/settings') return publicSettings(db);
    if (method === 'POST' && path === '/api/public/contact') {
      var cb = { name: body.visitorName != null ? body.visitorName : body.name, phone: body.visitorPhone != null ? body.visitorPhone : body.phone,
                 standard: body.visitorStandard != null ? body.visitorStandard : body.standard, message: body.visitorMessage != null ? body.visitorMessage : body.message };
      var c = cleanBody(ENTITIES.inquiries, cb);
      if (c.error) throw new HttpError(400, c.error);
      c.values.id = nextId(db, 'inquiries'); c.values.created_at = now();
      db.inquiries.push(c.values); save(db);
      return { ok: true, message: 'Thank you for contacting Sagar Classes. Our team will get in touch with you soon.' };
    }
    if (method === 'POST' && (m = /^\/api\/public\/attendance\/(student|staff)$/.exec(path))) {
      var a = parseAttendance(db, body, typeOf(m[1]));
      if (a.error) throw new HttpError(400, a.error);
      if (new Date(a.date + 'T00:00:00Z') > new Date(Date.now() + 36 * 3600 * 1000)) throw new HttpError(400, 'Attendance cannot be marked for a future date.');
      upsertAttendance(db, a); save(db);
      return { ok: true, message: 'Attendance submitted successfully.' };
    }


    /* admin (login required) */
    if (path.indexOf('/api/admin') !== 0) throw new HttpError(404, 'Not found.');
    var auth = (init && init.headers && (init.headers.Authorization || init.headers.authorization)) || '';
    if (auth !== 'Bearer ' + SESSION_VALUE) throw new HttpError(401, 'Sign In required.');

    if (path === '/api/admin-schema') {
      var out = {};
      Object.keys(ENTITIES).forEach(function (k) {
        var e = ENTITIES[k];
        out[k] = { label: e.label, readOnlyCreate: !!e.readOnlyCreate, lead: e.lead || [], extra: e.extra || [], fields: e.fields.map(function (f) {
          return { key: f.key, label: f.label, type: f.type || '', options: f.options || null, wide: !!f.wide, long: !!f.long, required: !!f.required, max: f.max }; }) };
      });
      return out;
    }
    if (path === '/api/admin/settings' && method === 'GET') return publicSettings(db);
    if (path === '/api/admin/settings' && method === 'PUT') {
      SETTING_KEYS.forEach(function (k) {
        if (!(k in body)) return;
        var v = String(body[k] || '').trim();
        if (v && (!DATA_IMG.test(v) || v.length > 1400000)) throw new HttpError(400, 'Image is invalid or too large.');
        db.settings[k] = v || null;
      });
      save(db); return { ok: true };
    }
    if (path === '/api/admin/me') return { username: db.admin.user };
    if (path === '/api/admin/stats') {
      var st = {}; ['students', 'staff', 'toppers', 'events', 'notices', 'inquiries'].forEach(function (k) { st[k] = db[k].length; });
      return st;
    }

    if (path === '/api/admin/attendance' && method === 'GET') {
      return buildRegister(db, typeOf(q.get('type')), MONTH_RE.test(q.get('month') || '') ? q.get('month') : currentMonth());
    }
    if (path === '/api/admin/attendance' && method === 'POST') {
      var n = parseAttendance(db, body, typeOf(body.person_type)); if (n.error) throw new HttpError(400, n.error);
      upsertAttendance(db, n); save(db); return { ok: true, _status: 201 };
    }
    if ((m = /^\/api\/admin\/attendance\/(\d+)$/.exec(path))) {
      var id = +m[1], rec = db.attendance.filter(function (r) { return r.id === id; })[0];
      if (!rec) throw new HttpError(404, 'Record not found.');
      if (method === 'DELETE') { db.attendance = db.attendance.filter(function (r) { return r.id !== id; }); save(db); return { ok: true }; }
      if (method === 'PUT') {
        var p = parseAttendance(db, body, rec.person_type); if (p.error) throw new HttpError(400, p.error);
        var dup = db.attendance.some(function (r) { return r.id !== id && r.person_type === p.type && r.person_id === p.person_id && r.att_date === p.date; });
        if (dup) throw new HttpError(409, 'Another record already exists for that person and date.');
        rec.person_id = p.person_id; rec.att_date = p.date; rec.status = p.status; save(db);
        return { ok: true };
      }
    }

    if ((m = /^\/api\/admin\/([a-z]+)(?:\/(\d+))?$/.exec(path)) && ENTITIES[m[1]]) {
      var key = m[1], ent = ENTITIES[key], rid = m[2] ? +m[2] : null;
      if (method === 'GET' && !rid) return listFor(db, key);
      if (method === 'POST' && !rid) {
        if (ent.readOnlyCreate) throw new HttpError(405, 'Not allowed.');
        var cr = cleanBody(ent, body); if (cr.error) throw new HttpError(400, cr.error);
        cr.values.id = nextId(db, key); cr.values.created_at = now(); db[key].push(cr.values); save(db);
        return { ok: true, id: cr.values.id, _status: 201 };
      }
      if (rid) {
        var row = db[key].filter(function (r) { return r.id === rid; })[0];
        if (!row) throw new HttpError(404, 'Record not found.');
        if (method === 'PUT') {
          var up = cleanBody(ent, body); if (up.error) throw new HttpError(400, up.error);
          Object.assign(row, up.values); save(db); return { ok: true }; }
        if (method === 'DELETE') { db[key] = db[key].filter(function (r) { return r.id !== rid; }); cascadeDelete(db, key, rid); save(db); return { ok: true }; }
      }
    }
    throw new HttpError(404, 'Not found.');
  }

  /* ---------- fetch shim ---------- */
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!/(^|\/)api\//.test(url.split('?')[0]) && url.indexOf('/api') !== 0) return realFetch ? realFetch(input, init) : Promise.reject(new TypeError('fetch unavailable'));
    init = init || {};
    var status = 200, payload;
    try {
      payload = route((init.method || 'GET').toUpperCase(), url, init.body ? JSON.parse(init.body) : {}, init);
      if (payload && payload._status) { status = payload._status; delete payload._status; }
    } catch (e) {
      if (e instanceof HttpError) { status = e.status; payload = { error: e.message }; }
      else { console.error(e); status = 500; payload = { error: 'Something went wrong.' }; }
    }
    return Promise.resolve(new Response(JSON.stringify(payload), { status: status, headers: { 'Content-Type': 'application/json' } }));
  };

  /* ---------- Excel / PDF export (done in the browser) ---------- */
  function table(title, head, rows) {
    return '<h2>' + esc(title) + '</h2><table border="1" cellspacing="0" cellpadding="4"><thead><tr>' +
      head.map(function (h) { return '<th style="background:#4338ca;color:#fff">' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }
  function entityTable(db, key) {
    var e = ENTITIES[key];
    var cols = (e.lead || []).concat(e.fields.filter(function (f) { return !f.noExport; }), e.extra || []);
    var rows = listFor(db, key).map(function (r, i) { return [i + 1].concat(cols.map(function (c) { return r[c.key]; })); });
    return table(e.label, ['#'].concat(cols.map(function (c) { return c.label; })), rows);
  }
  function registerTables(db, type, month) {
    var reg = buildRegister(db, type, month), days = range(1, reg.days).map(String), grp = type === 'Staff' ? 'Department' : 'Class';
    return table(type + ' Attendance Register – ' + month, [type, grp].concat(days, ['Present', 'Absent']),
        reg.rows.map(function (r) { return [r.name, r.group].concat(r.cells, [r.present, r.absent]); })) +
      table(type + ' Attendance Records – ' + month, ['Date', type, grp, 'Status'],
        reg.records.map(function (r) { return [r.att_date, r.name, r.group_name, r.status]; }));
  }

  function download(path, fallbackName) {
    var u = new URL(path, location.href), m = /\/export\/([a-z\-]+)\/(xlsx|pdf)$/.exec(u.pathname);
    if (!m) return false;
    var name = m[1], fmt = m[2], db = load();
    var month = MONTH_RE.test(u.searchParams.get('month') || '') ? u.searchParams.get('month') : currentMonth();
    var html, title;
    if (name === 'all') {
      title = 'Sagar Classes – all data';
      html = Object.keys(ENTITIES).map(function (k) { return entityTable(db, k); }).join('<br>') + '<br>' + registerTables(db, 'Student', month) + '<br>' + registerTables(db, 'Staff', month);
    } else if (name === 'student-attendance' || name === 'staff-attendance') {
      var t = name.indexOf('staff') === 0 ? 'Staff' : 'Student';
      title = t + ' attendance ' + month; html = registerTables(db, t, month);
    } else if (ENTITIES[name]) { title = ENTITIES[name].label; html = entityTable(db, name); }
    else return false;

    var doc = '<html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>body{font-family:Arial,sans-serif;font-size:12px}' +
      'table{border-collapse:collapse;margin-bottom:16px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}h2{font-size:15px}' +
      '@page{size:landscape;margin:10mm}</style></head><body>' + html + '</body></html>';

    if (fmt === 'pdf') {   // opens a print view: choose "Save as PDF"
      var w = window.open('', '_blank');
      if (!w) throw new Error('Please allow pop-ups in your browser to export the PDF.');
      w.document.open(); w.document.write(doc); w.document.close(); w.focus();
      setTimeout(function () { w.print(); }, 400);
      return true;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + doc], { type: 'application/vnd.ms-excel' }));
    a.download = (fallbackName || name).replace(/\.xlsx$/, '') + '-' + new Date().toISOString().slice(0, 10) + '.xls';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    return true;
  }

  /* ---------- tiny DOM helpers shared by script.js and admin.js (text is always set as textContent) ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    (function add(list) {   // children may be nodes, strings or arrays of them
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) return add(c);
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    })([].slice.call(arguments, 2));
    return el;
  }
  /* <img> that shows the class logo when there is no photo (or the photo fails to load) */
  function img(src, alt, cls) {
    var el = h('img', { alt: alt || '', loading: 'lazy', class: cls || '' });
    var useLogo = function () { el.src = LOGO; el.classList.add('is-logo'); };
    if (src) { el.src = src; el.addEventListener('error', useLogo); } else useLogo();
    return el;
  }

  window.SCStore = {
    logo: LOGO, h: h, img: img, download: download,
    photo: function (src) { return src || LOGO; },
    setAdmin: function (user, pass) {
      if (!user || !pass || pass.length < 8) throw new Error('Enter a username and a password containing at least 8 characters.');
      var db = load(); db.admin = { user: user, hash: hash(pass) }; save(db); return 'Admin login updated.';
    },
    exportJSON: function () { return JSON.stringify(load(), null, 2); },
    reset: function () { try { localStorage.removeItem(DB_KEY); } catch (e) {} memoryFallback = null; return 'Data reset to sample data.'; }
  };
})();
