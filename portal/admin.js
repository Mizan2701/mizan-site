/* Mizan portal: admin console. Organisations, data collection, records check, diagnosis, reports and the improvement plan. */
(function () {
  var M = window.Mizan, esc = M.esc;
  var view = document.getElementById('view');
  var S = {key:null, orgs:null, codes:null};

  function store(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  S.key = load('mizan_key');

  function api(action, p) {
    return M.call({action:action, key:S.key, p:p || {}}).then(function (r) {
      if (!r.ok && (r.error === 'denied' || r.error === 'locked' || r.error === 'no_password')) { S.key = null; store('mizan_key', null); route(); }
      return r;
    });
  }
  function msg(el, text, kind) { el.innerHTML = text ? '<p class="msg ' + (kind || '') + '">' + text + '</p>' : ''; }
  function busy(btn, on, label) { if (!btn) return; btn.disabled = on; if (label) btn.textContent = label; }
  function loading() { view.innerHTML = '<p class="note">Loading…</p>'; }
  function orgById(id) { return (S.orgs || []).filter(function (o) { return o.id === id; })[0]; }
  function refreshOrgs() { return api('admin.orgs').then(function (r) { if (r.ok) S.orgs = r.orgs; return r; }); }
  document.getElementById('signout').addEventListener('click', function () { S.key = null; store('mizan_key', null); location.hash = '#/'; route(); });

  /* ---------- Sign in ---------- */
  function signIn() {
    document.getElementById('signout').hidden = true;
    view.innerHTML = '<section class="panel" style="max-width:420px;margin:40px auto"><span class="eyebrow">Mizan staff only</span><h1>Sign in</h1>' +
      (M.endpoint() ? '' : '<p class="msg err">The Mizan service address is not set yet. Add it to /app-config.js.</p>') +
      '<form id="f" class="stack"><label class="field">Portal password<input type="password" id="pw" autocomplete="current-password" required></label>' +
      '<button class="btn primary" id="go">Sign in</button><div id="m" aria-live="polite"></div></form></section>';
    document.getElementById('pw').focus();
    document.getElementById('f').addEventListener('submit', function (e) {
      e.preventDefault();
      var b = document.getElementById('go'); busy(b, true, 'Checking…');
      M.call({action:'admin.ping', key:document.getElementById('pw').value}).then(function (r) {
        busy(b, false, 'Sign in');
        if (!r.ok) return msg(document.getElementById('m'), esc(M.errorText(r.error)), 'err');
        S.key = document.getElementById('pw').value; store('mizan_key', S.key); route();
      });
    });
  }

  /* ---------- Organisations ---------- */
  function orgsView() {
    loading();
    refreshOrgs().then(function (r) {
      if (!r.ok) { view.innerHTML = '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'; return; }
      view.innerHTML = '<div class="spread"><div><span class="eyebrow">Diagnostic portal</span><h1>Organisations</h1></div><a class="btn primary" href="#/new">New organisation</a></div>' +
        (S.orgs.length ? '<div class="orgs">' + S.orgs.map(function (o) {
          return '<a class="panel org" href="#/org/' + encodeURIComponent(o.id) + '/overview"><div class="spread"><h2>' + esc(o.name) + '</h2>' + statusChip(o.status) + '</div>' +
            '<dl class="kv"><dt>Wave</dt><dd>' + o.wave + '</dd><dt>Responses</dt><dd>' + o.responses + (o.headcount ? ' of ' + o.headcount + ' (' + o.rate + '%)' : '') + '</dd><dt>Codes used</dt><dd>' + o.codes.used + ' of ' + o.codes.issued + '</dd><dt>Reports</dt><dd>' + o.reports + '</dd></dl>' +
            '<div class="meter' + (o.rate >= 60 ? ' ok' : '') + '"><b style="width:' + Math.min(100, o.rate || 0) + '%"></b></div></a>';
        }).join('') + '</div>' : '<section class="panel"><h2>No organisations yet</h2><p class="lede">Add the first client to issue survey codes, record the HR records check and produce a report.</p><div><a class="btn primary" href="#/new">New organisation</a></div></section>');
    });
  }
  function statusChip(s) { return s === 'open' ? '<span class="chip good"><i></i>Survey open</span>' : '<span class="chip"><i></i>Survey closed</span>'; }

  function orgForm(o) {
    o = o || {};
    return '<form id="of" class="stack"><div class="grid2">' +
      '<label class="field">Organisation name<input type="text" name="name" required maxlength="120" value="' + esc(o.name) + '"></label>' +
      '<label class="field">Employees (headcount)<input type="number" name="headcount" min="1" value="' + esc(o.headcount || '') + '"></label>' +
      '<label class="field">Sector<input type="text" name="sector" maxlength="80" value="' + esc(o.sector) + '"></label>' +
      '<label class="field">Country<input type="text" name="country" maxlength="60" value="' + esc(o.country) + '"></label>' +
      '<label class="field">Client contact (name, role, email)<input type="text" name="contact" maxlength="160" value="' + esc(o.contact) + '"></label>' +
      '<label class="field">Survey<select name="status"><option value="closed"' + (o.status !== 'open' ? ' selected' : '') + '>Closed</option><option value="open"' + (o.status === 'open' ? ' selected' : '') + '>Open: codes accepted</option></select></label></div>' +
      '<label class="field">Departments, separated by commas<textarea name="depts">' + esc((o.depts || []).join(', ')) + '</textarea></label>' +
      '<p class="note">Departments appear in the survey as an optional choice. Departments with fewer than 8 respondents are never reported.</p>' +
      '<div class="row"><button class="btn primary" id="save">Save</button><span id="m" aria-live="polite"></span></div></form>';
  }
  function bindOrgForm(id) {
    document.getElementById('of').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, b = document.getElementById('save'); busy(b, true, 'Saving…');
      api('admin.orgSave', {id:id || '', name:f.name.value, headcount:f.headcount.value, sector:f.sector.value, country:f.country.value, contact:f.contact.value, status:f.status.value, depts:f.depts.value}).then(function (r) {
        busy(b, false, 'Save');
        if (!r.ok) return msg(document.getElementById('m'), esc(M.errorText(r.error)), 'err');
        refreshOrgs().then(function () { location.hash = '#/org/' + encodeURIComponent(r.org.id) + '/overview'; if (id) route(); });
      });
    });
  }
  function newOrgView() {
    view.innerHTML = '<nav class="crumbs"><a href="#/">Organisations</a><span>/</span><span>New</span></nav><section class="panel"><h1>New organisation</h1>' + orgForm({}) + '</section>';
    bindOrgForm('');
  }

  /* ---------- One organisation ---------- */
  var TABS = [['overview','Overview'],['collect','Collect'],['records','Records check'],['diagnosis','Diagnosis'],['reports','Reports'],['plan','Plan']];
  function orgShell(o, tab, body) {
    return '<nav class="crumbs"><a href="#/">Organisations</a><span>/</span><span>' + esc(o.name) + '</span></nav>' +
      '<div class="spread"><div><span class="eyebrow">Wave ' + o.wave + '</span><h1>' + esc(o.name) + '</h1></div>' + statusChip(o.status) + '</div>' +
      '<nav class="tabs" aria-label="Sections">' + TABS.map(function (t) { return '<a href="#/org/' + encodeURIComponent(o.id) + '/' + t[0] + '"' + (t[0] === tab ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>' + body;
  }

  function orgView(id, tab) {
    var go = function () {
      var o = orgById(id);
      if (!o) { view.innerHTML = '<p class="msg err">Organisation not found.</p>'; return; }
      ({overview:overview, collect:collect, records:records, diagnosis:diagnosis, reports:reports, plan:plan}[tab] || overview)(o);
    };
    if (S.orgs) go(); else { loading(); refreshOrgs().then(go); }
  }

  function overview(o) {
    view.innerHTML = orgShell(o, 'overview',
      '<section class="panel"><div class="grid2">' +
      '<div class="stat"><b>' + o.responses + '</b><span>responses this wave</span></div>' +
      '<div class="stat"><b>' + (o.rate === null ? '–' : o.rate + '%') + '</b><span>participation (60% needed for a rating)</span></div>' +
      '<div class="stat"><b>' + o.codes.used + ' / ' + o.codes.issued + '</b><span>codes used</span></div>' +
      '<div class="stat"><b>' + o.reports + '</b><span>reports this wave</span></div></div></section>' +
      '<section class="panel"><h2>Details</h2>' + orgForm(o) + '</section>' +
      '<section class="panel"><h2>Start a new wave</h2><p class="lede">For a repeat assessment. It closes the survey, retires every unused code from the current wave and starts collection again at wave ' + (o.wave + 1) + '. Earlier waves and their reports are kept.</p>' +
      '<div class="row"><button class="btn danger" id="wave">Start wave ' + (o.wave + 1) + '</button><span id="wm"></span></div></section>');
    bindOrgForm(o.id);
    document.getElementById('wave').addEventListener('click', function () {
      var b = this;
      if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again to confirm'; return; }
      busy(b, true, 'Starting…');
      api('admin.newWave', {orgId:o.id}).then(function (r) { if (!r.ok) { busy(b, false, 'Start wave'); return msg(document.getElementById('wm'), esc(M.errorText(r.error)), 'err'); } refreshOrgs().then(route); });
    });
  }

  function collect(o) {
    var fresh = S.codes && S.codes.orgId === o.id ? S.codes : null;
    view.innerHTML = orgShell(o, 'collect',
      '<section class="panel"><h2>Survey link</h2><p class="lede">Employees go to <b>mizanworkforce.com/survey</b> and enter their own code. No name, email or login is ever asked for.</p>' +
      (o.status !== 'open' ? '<p class="msg">The survey is closed. Open it in Overview before handing out codes.</p>' : '') +
      '<div class="meter' + (o.rate >= 60 ? ' ok' : '') + '"><b style="width:' + Math.min(100, o.rate || 0) + '%"></b></div><p class="note">' + o.responses + ' responses' + (o.headcount ? ' of ' + o.headcount + ' employees' : '') + '. A rating needs 60% participation.</p></section>' +
      '<section class="panel"><h2>Access codes</h2><p class="lede">Each code works once. Codes are shown only now: Mizan stores a fingerprint, never the code, so lost codes cannot be recovered. Hand them out at random, so nobody can match a code to a person.</p>' +
      '<div class="row"><label class="field" style="max-width:200px">How many<input type="number" id="n" min="1" max="5000" value="' + (o.headcount ? Math.ceil(o.headcount * 1.05) : '') + '"></label><button class="btn primary" id="gen" style="align-self:flex-end">Create codes</button></div><div id="m" aria-live="polite"></div>' +
      (fresh ? '<div class="stack"><p class="msg ok">' + fresh.codes.length + ' codes created for wave ' + fresh.wave + '. Download or print them now.</p><div class="row no-print"><button class="btn" id="csv">Download CSV</button><button class="btn" id="print">Print code slips</button></div><div class="codes">' + fresh.codes.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div></div>' : '') +
      '</section>');
    document.getElementById('gen').addEventListener('click', function () {
      var b = this; busy(b, true, 'Creating…');
      api('admin.codes', {orgId:o.id, n:document.getElementById('n').value}).then(function (r) {
        busy(b, false, 'Create codes');
        if (!r.ok) return msg(document.getElementById('m'), esc(M.errorText(r.error)), 'err');
        S.codes = {orgId:o.id, wave:r.wave, codes:r.codes};
        refreshOrgs().then(route);
      });
    });
    if (fresh) {
      document.getElementById('csv').addEventListener('click', function () {
        var blob = new Blob(['code\n' + fresh.codes.join('\n') + '\n'], {type:'text/csv'});
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'mizan-codes-' + o.id + '-wave' + fresh.wave + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      });
      document.getElementById('print').addEventListener('click', function () {
        var w = window.open('', '_blank'); if (!w) return;
        w.document.write('<!doctype html><meta charset="utf-8"><title>Mizan survey codes</title><style>body{font-family:Arial,sans-serif;margin:12mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:0}.s{border:1px dashed #999;padding:10px 12px;font-size:12px;line-height:1.4;break-inside:avoid}.c{font:700 18px monospace;letter-spacing:2px;margin:4px 0}</style><div class="g">' +
          fresh.codes.map(function (c) { return '<div class="s"><b>Mizan workforce survey</b><div class="c">' + c + '</div>Go to mizanworkforce.com/survey and enter this code. It is anonymous: nobody can link this code to you. It works once.</div>'; }).join('') + '</div>');
        w.document.close(); w.focus(); w.print();
      });
    }
  }

  function records(o) {
    view.innerHTML = orgShell(o, 'records', '<p class="note">Loading records…</p>');
    api('admin.records', {orgId:o.id}).then(function (r) {
      if (!r.ok) { view.innerHTML = orgShell(o, 'records', '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'); return; }
      var ev = r.evidence;
      view.innerHTML = orgShell(o, 'records',
        '<section class="panel"><div class="spread"><div><h2>HR records check</h2><p class="lede">Done on site from a sample of files Mizan chooses. At least 15 of 20 items must be reviewed, and the Evidence Score must reach 50, for the report to count as verified.</p></div>' +
        '<div class="stat"><b id="evs">' + (ev.score === null ? '–' : Math.round(ev.score)) + '</b><span id="evn">' + ev.reviewed + ' of 20 reviewed</span></div></div>' +
        '<form id="rf"><div>' + r.items.map(function (x) {
          return '<div class="rec"><span class="id">' + x.id + '</span><div>' + esc(x.text) + '<small>' + esc(x.basis) + (x.d ? ' · D' + x.d : '') + '</small></div>' +
            '<select name="' + x.id + '" aria-label="' + x.id + ' result">' + [['','Not reviewed'],['E','Evidenced'],['P','Partly evidenced'],['N','Not evidenced'],['X','Not applicable']].map(function (op) { return '<option value="' + op[0] + '"' + (x.s === op[0] ? ' selected' : '') + '>' + op[1] + '</option>'; }).join('') + '</select>' +
            '<textarea name="' + x.id + '_note" maxlength="500" placeholder="What the file showed (no names)" aria-label="' + x.id + ' note">' + esc(x.note) + '</textarea></div>';
        }).join('') + '</div><div class="row"><button class="btn primary" id="save">Save records</button><span id="m" aria-live="polite"></span></div></form></section>');
      document.getElementById('rf').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, items = {}, b = document.getElementById('save');
        r.items.forEach(function (x) { items[x.id] = {s:f[x.id].value, note:f[x.id + '_note'].value}; });
        busy(b, true, 'Saving…');
        api('admin.recordsSave', {orgId:o.id, items:items}).then(function (s) {
          busy(b, false, 'Save records');
          if (!s.ok) return msg(document.getElementById('m'), esc(M.errorText(s.error)), 'err');
          document.getElementById('evs').textContent = s.evidence.score === null ? '–' : Math.round(s.evidence.score);
          document.getElementById('evn').textContent = s.evidence.reviewed + ' of 20 reviewed';
          msg(document.getElementById('m'), 'Saved.', 'ok');
        });
      });
    });
  }

  function diagnosis(o) {
    view.innerHTML = orgShell(o, 'diagnosis', '<p class="note">Scoring live responses…</p>');
    api('admin.preview', {orgId:o.id}).then(function (r) {
      if (!r.ok) { view.innerHTML = orgShell(o, 'diagnosis', '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'); return; }
      var R = r.report;
      view.innerHTML = orgShell(o, 'diagnosis',
        '<section class="panel no-print"><div class="spread"><div><h2>Live diagnosis</h2><p class="lede">Recalculated from every response and the records check each time you open this tab. Nothing is shared with the client until you generate and publish a report.</p></div>' +
        '<button class="btn primary" id="gen"' + (R.n ? '' : ' disabled') + '>Generate report and plan</button></div><div id="m" aria-live="polite"></div></section>' +
        (R.n ? M.renderReport(R, {mode:'preview'}) : '<section class="panel"><h2>No responses yet</h2><p class="lede">Hand out codes from the Collect tab. Results appear once groups reach 8 respondents.</p></section>'));
      var b = document.getElementById('gen');
      b.addEventListener('click', function () {
        busy(b, true, 'Generating…');
        api('admin.generate', {orgId:o.id}).then(function (g) {
          busy(b, false, 'Generate report and plan');
          if (!g.ok) return msg(document.getElementById('m'), esc(M.errorText(g.error)), 'err');
          refreshOrgs().then(function () { location.hash = '#/report/' + g.token; });
        });
      });
    });
  }

  function clientLink(token) { return location.origin + '/portal/r/#' + token; }

  function reports(o) {
    view.innerHTML = orgShell(o, 'reports', '<p class="note">Loading reports…</p>');
    api('admin.reports', {orgId:o.id}).then(function (r) {
      if (!r.ok) { view.innerHTML = orgShell(o, 'reports', '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'); return; }
      view.innerHTML = orgShell(o, 'reports', '<section class="panel"><h2>Reports</h2><p class="lede">Each report is a frozen copy of the diagnosis on the day it was generated. Publish one to give the client a private link; withdraw it at any time.</p>' +
        (r.reports.length ? '<div class="tw"><table><thead><tr><th>Created</th><th>Wave</th><th class="l">Client access</th><th></th></tr></thead><tbody>' + r.reports.map(function (x) {
          return '<tr><td>' + esc(x.created) + '</td><td>' + x.wave + '</td><td class="l">' + (x.published ? '<span class="chip good"><i></i>Published</span>' : '<span class="chip"><i></i>Private</span>') + '</td>' +
            '<td><div class="row" style="justify-content:flex-end"><a class="btn small" href="#/report/' + x.token + '">Open</a>' + (x.published ? '<button class="btn small" data-copy="' + x.token + '">Copy client link</button>' : '') +
            '<button class="btn small" data-pub="' + x.token + '" data-on="' + (!x.published) + '">' + (x.published ? 'Withdraw' : 'Publish') + '</button></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="note">No reports yet. Generate one from the Diagnosis tab.</p>') + '<div id="m" aria-live="polite"></div></section>');
      view.querySelectorAll('[data-pub]').forEach(function (b) { b.addEventListener('click', function () {
        busy(b, true); api('admin.publish', {token:b.dataset.pub, on:b.dataset.on === 'true'}).then(function () { reports(o); });
      }); });
      view.querySelectorAll('[data-copy]').forEach(function (b) { b.addEventListener('click', function () {
        var link = clientLink(b.dataset.copy);
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { msg(document.getElementById('m'), 'Copied: ' + esc(link), 'ok'); }, function () { msg(document.getElementById('m'), 'Client link: ' + esc(link)); });
      }); });
    });
  }

  function plan(o) {
    view.innerHTML = orgShell(o, 'plan', '<p class="note">Loading plan…</p>');
    api('admin.actions', {orgId:o.id}).then(function (r) {
      if (!r.ok) { view.innerHTML = orgShell(o, 'plan', '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'); return; }
      var A = r.actions, done = A.filter(function (a) { return a.status === 'Done'; }).length;
      view.innerHTML = orgShell(o, 'plan', '<section class="panel plan"><div class="spread"><div><h2>Improvement plan</h2><p class="lede">Created from the report. Agree owners and dates with the client, then keep the status current: the client sees it live on their report link.</p></div>' +
        '<div class="stat"><b>' + done + ' / ' + A.length + '</b><span>actions done</span></div></div>' +
        (A.length ? '<div class="tw"><table><thead><tr><th>Tier</th><th class="l">Action</th><th class="l">Owner</th><th class="l">Due</th><th class="l">Status</th><th class="l">Internal note</th><th></th></tr></thead><tbody>' + A.map(function (a) {
          return '<tr data-id="' + a.id + '"><td>' + a.tier + '</td><td class="l"><b>' + esc(a.title) + '</b><br><span class="note">' + esc(a.firstStep) + '</span></td>' +
            '<td class="l"><input type="text" name="owner" value="' + esc(a.owner) + '" aria-label="Owner"></td><td class="l"><input type="date" name="due" value="' + esc(a.due) + '" aria-label="Due date"></td>' +
            '<td class="l"><select name="status" aria-label="Status">' + ['Not started','In progress','Done','Blocked'].map(function (s) { return '<option' + (a.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td>' +
            '<td class="l"><textarea name="note" aria-label="Internal note">' + esc(a.note) + '</textarea></td><td><button class="btn small" data-save>Save</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="note">No plan yet. Generate a report from the Diagnosis tab.</p>') + '</section>');
      view.querySelectorAll('[data-save]').forEach(function (b) { b.addEventListener('click', function () {
        var tr = b.closest('tr'), q = function (n) { return tr.querySelector('[name=' + n + ']').value; };
        busy(b, true, 'Saving…');
        api('admin.actionUpdate', {id:tr.dataset.id, owner:q('owner'), due:q('due'), status:q('status'), note:q('note')}).then(function (s) { busy(b, false, s.ok ? 'Saved' : 'Retry'); });
      }); });
    });
  }

  function reportView(token) {
    loading();
    api('admin.report', {token:token}).then(function (r) {
      if (!r.ok) { view.innerHTML = '<p class="msg err">' + esc(M.errorText(r.error)) + '</p>'; return; }
      var R = r.report, id = R.org.id;
      view.innerHTML = '<nav class="crumbs"><a href="#/">Organisations</a><span>/</span><a href="#/org/' + encodeURIComponent(id) + '/reports">' + esc(R.org.name) + '</a><span>/</span><span>Report ' + esc(R.created) + '</span></nav>' +
        '<div class="row no-print"><button class="btn" onclick="window.print()">Print or save as PDF</button>' + (r.published ? '<a class="btn" href="' + clientLink(token) + '" target="_blank" rel="noopener">Open client view</a>' : '<span class="note">Private: publish it from Reports to share with the client.</span>') + '</div>' +
        M.renderReport(R, {mode:'admin', actions:null});
    });
  }

  /* ---------- Router ---------- */
  function route() {
    window.scrollTo(0, 0);
    if (!S.key) return signIn();
    document.getElementById('signout').hidden = false;
    var h = location.hash.replace(/^#\/?/, '').split('/');
    if (h[0] === 'new') return newOrgView();
    if (h[0] === 'org' && h[1]) return orgView(decodeURIComponent(h[1]), h[2] || 'overview');
    if (h[0] === 'report' && h[1]) return reportView(h[1]);
    return orgsView();
  }
  window.addEventListener('hashchange', route);
  route();
})();
