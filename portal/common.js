/* Mizan portal: service calls and the report renderer, shared by the admin console and the client view.
   The scoring itself runs on the private Mizan service; this file only displays its results. */
(function () {
  var M = window.Mizan = {};

  M.esc = function (s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var esc = M.esc;
  var r0 = M.r0 = function (v) { return v === null || v === undefined ? '–' : String(Math.round(v)); };

  M.endpoint = function () { return window.MIZAN_ENDPOINT || ''; };
  M.call = function (payload) {
    var url = M.endpoint();
    if (!url) return Promise.resolve({ok:false, error:'no_service'});
    return fetch(url, {method:'POST', body:JSON.stringify(payload)})
      .then(function (r) { return r.json(); })
      .catch(function () { return {ok:false, error:'network'}; });
  };
  M.errorText = function (e) {
    return ({no_service:'The Mizan service address is not set yet.', network:'Could not reach the Mizan service. Check the connection and try again.',
      denied:'Wrong password.', locked:'Too many wrong attempts. Wait 15 minutes and try again.', no_password:'Set the portal password from the Mizan menu in the Google Sheet first.',
      server:'The service hit an error. Try again; if it repeats, check the Apps Script executions log.', not_found:'This report link is not valid or has been withdrawn.'})[e] || String(e || 'Something went wrong.');
  };

  var BANDS = {A:['Thriving','good'], B:['Healthy','good'], C:['Strained','warn'], D:['At risk','serious'], E:['Critical','crit']};
  M.chip = function (l, big, prefix) {
    if (!l) return '<span class="chip' + (big ? ' big' : '') + '"><i></i>No score</span>';
    return '<span class="chip ' + BANDS[l][1] + (big ? ' big' : '') + '"><i></i>' + (prefix || '') + l + ' ' + BANDS[l][0] + '</span>';
  };
  function bandOf(s) { return s === null ? null : s >= 85 ? 'A' : s >= 70 ? 'B' : s >= 55 ? 'C' : s >= 40 ? 'D' : 'E'; }
  var TIER = {1:['Stop the harm','Within 30 days · CEO or owner'], 2:['Fix the system','Within 90 days · HR head with department heads'], 3:['Build','Within 180 days · department heads and line managers']};
  var STATUS_CLS = {'Done':'good', 'In progress':'warn', 'Blocked':'crit', 'Not started':''};

  function groupTable(title, groups, R) {
    if (!groups || !groups.length) return '';
    var head = '<tr><th>Group</th><th>n</th><th>Score</th>' + R.dims.map(function (d) { return '<th title="' + esc(d.name) + '">D' + d.id + '</th>'; }).join('') + '</tr>';
    var org = '<tr><td><b>Organisation</b></td><td>' + R.n + '</td><td><b>' + r0(R.health) + '</b></td>' + R.dims.map(function (d) { return '<td>' + r0(d.score) + '</td>'; }).join('') + '</tr>';
    var rows = groups.map(function (g) {
      if (g.hidden) return '<tr><td>' + esc(g.label) + '</td><td>' + g.n + '</td><td class="hid" colspan="11">Hidden: fewer than ' + R.minGroup + ' respondents</td></tr>';
      return '<tr><td>' + esc(g.label) + '</td><td>' + g.n + '</td><td><b>' + r0(g.health) + '</b></td>' + g.dims.map(function (s, i) {
        var o = R.dims[i].score; return '<td class="' + (s !== null && o !== null && o - s >= 15 ? 'low' : '') + '">' + r0(s) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    return '<section class="panel"><h2>' + title + '</h2><div class="tw"><table><thead>' + head + '</thead><tbody>' + org + rows + '</tbody></table></div><p class="note">D1–D10 are the ten dimensions above. Red marks a group 15 or more points below the organisation.</p></section>';
  }

  /** opts: {actions: [...] live plan or null, mode: 'admin'|'client'|'preview'} */
  M.renderReport = function (R, opts) {
    opts = opts || {};
    var shown = R.rated ? R.rating : null;
    var h = [];
    h.push('<div class="report">');
    h.push('<section class="panel"><span class="eyebrow">' + esc(R.org ? R.org.name : '') + ' · Wave ' + (R.wave || 1) + (R.created ? ' · ' + esc(R.created) : ' · live preview') + '</span>' +
      '<div class="verdict"><div class="score">' + (R.health === null ? '–' : R.health.toFixed(1)) + '<small> / 100</small></div><div class="stack">' +
      '<div class="row">' + (R.rated ? M.chip(shown, true, 'Rating ') : '<span class="chip big"><i></i>Not rated</span>') +
      (!R.rated && R.rating ? '<span class="note">Indicative: ' + R.rating + ' ' + BANDS[R.rating][0] + '</span>' : '') +
      (R.rated && R.base !== R.rating ? '<span class="note">The score alone would be ' + R.base + '</span>' : '') + '</div>' +
      '<div class="facts"><span><b>' + R.n + '</b> responses</span><span><b>' + (R.headcount || '–') + '</b> employees</span><span><b>' + (R.rate === null ? '–' : Math.round(R.rate) + '%') + '</b> participation</span>' +
      '<span><b>' + (R.evidence.score === null ? '–' : Math.round(R.evidence.score)) + '</b> records evidence</span><span><b>' + R.flags.length + '</b> red flags</span></div></div></div>' +
      (R.unverified ? '<p class="unverified"><b>Unverified.</b> ' + esc((R.gates.filter(function (g) { return g.why === 'Report unverified'; })[0] || {}).effect || '') + '. Treat results as indicative until this is resolved.</p>' : '') +
      (R.gates.length ? '<ul class="gates">' + R.gates.filter(function (g) { return g.why !== 'Report unverified'; }).map(function (g) { return '<li><b>' + esc(g.why) + '</b>: ' + esc(g.effect) + '.</li>'; }).join('') + '</ul>' : '<p class="note">No safeguard applied. The rating follows the score.</p>') +
      '</section>');

    h.push('<section class="panel"><h2>Red flags</h2>' + (R.flags.length ? '<div>' + R.flags.map(function (f) {
      return '<div class="flag"><div><b>' + esc(f.text) + '</b><p class="note">' + f.unf + ' of ' + f.n + ' valid answers were unfavourable. The red-flag line for this question is ' + f.thr + '%.' +
        (f.escalate ? ' <b>Serious harm: the top executive must be told within 5 working days.</b>' : '') + '</p></div><span class="chip crit"><i></i>' + f.pct + '% unfavourable</span></div>';
    }).join('') + '</div><p class="note">A red flag means the issue is widespread enough to act on now. It does not establish that any individual did anything wrong.</p>' : '<p class="lede">None. No critical question crossed its red-flag line.</p>') + '</section>');

    h.push('<section class="panel"><h2>Score by dimension</h2><div class="bars">' + R.dims.map(function (d) {
      return '<div class="bar"><div class="lab">' + d.id + '. ' + esc(d.name) + '<small>' + esc(d.law) + '</small></div><div class="track">' + [40,55,70,85].map(function (x) { return '<s style="left:' + x + '%"></s>'; }).join('') +
        '<b style="width:' + (d.score || 0) + '%"></b></div><div class="val">' + r0(d.score) + '</div>' + M.chip(d.band) + '</div>';
    }).join('') + '</div><p class="note">Bands: A 85+, B 70–84, C 55–69, D 40–54, E below 40. Tick marks show the band lines.</p></section>');

    if (R.gap) h.push('<section class="panel"><h2>Perception gap</h2><p class="lede">' + R.predN + ' senior leaders predicted each score before seeing results. A gap of 20 or more means leadership is not seeing the problem.</p><div class="tw"><table><thead><tr><th>Dimension</th><th>Leaders predicted</th><th>Employees scored</th><th>Gap</th></tr></thead><tbody>' +
      R.gap.map(function (x) { return x ? '<tr><td>' + esc(x.name) + '</td><td>' + r0(x.pred) + '</td><td>' + r0(x.actual) + '</td><td class="' + (x.gap >= 20 ? 'low' : '') + '">' + (x.gap > 0 ? '+' : '') + r0(x.gap) + '</td></tr>' : ''; }).join('') + '</tbody></table></div></section>');

    h.push('<section class="panel"><h2>Records evidence</h2><p class="lede">Evidence Score ' + (R.evidence.score === null ? 'not available' : '<b>' + Math.round(R.evidence.score) + ' / 100</b>') + ' from ' + R.evidence.reviewed + ' of 20 records reviewed. Below 50, or a contradiction on a critical item, marks the report unverified.</p>' +
      (R.contradictions.length ? '<div class="stack">' + R.contradictions.map(function (c) { return '<p class="unverified">' + esc(c.text) + '</p>'; }).join('') + '</div>' : '') +
      '<details><summary>All 20 records</summary><div class="tw"><table><thead><tr><th>Item</th><th class="l">Evidence</th><th class="l">Result</th><th class="l">Note</th></tr></thead><tbody>' +
      R.evidence.items.map(function (x) { return '<tr><td>' + x.id + '</td><td class="l">' + esc(x.text) + '<br><small class="muted">' + esc(x.basis) + '</small></td><td class="l">' + esc(x.label) + '</td><td class="l">' + esc(x.note) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details></section>');

    h.push(groupTable('Results by level', R.byLevel, R));
    h.push(groupTable('Results by department', R.byDept, R));

    /* Solutions */
    if (opts.actions && opts.actions.length) {
      h.push('<section class="panel"><h2>Improvement plan</h2><p class="lede">Every finding has an owner, a deadline and a status. Status is kept up to date by Mizan with your team.</p>' + [1,2,3].map(function (t) {
        var list = opts.actions.filter(function (a) { return a.tier === t; }); if (!list.length) return '';
        return '<div class="stack"><div class="tier-h"><h3>Tier ' + t + ': ' + TIER[t][0] + '</h3><span>' + TIER[t][1] + '</span></div>' + list.map(function (a) {
          return '<div class="find"><div class="spread"><b>' + esc(a.title) + '</b><span class="chip ' + (STATUS_CLS[a.status] || '') + '"><i></i>' + esc(a.status) + '</span></div><dl><dt>First step</dt><dd>' + esc(a.firstStep) + '</dd><dt>Owner</dt><dd>' + esc(a.owner) + '</dd><dt>Due</dt><dd>' + esc(a.due) + '</dd></dl></div>';
        }).join('') + '</div>';
      }).join('') + '</section>');
    } else {
      h.push('<section class="panel"><h2>What to treat first</h2>' + (R.priorities.length ? [1,2,3].map(function (t) {
        var list = R.priorities.filter(function (p) { return p.tier === t; }); if (!list.length) return '';
        return '<div class="stack"><div class="tier-h"><h3>Tier ' + t + ': ' + TIER[t][0] + '</h3><span>' + TIER[t][1] + '</span></div>' + list.map(function (p) {
          return '<div class="find"><b>' + esc(p.title) + '</b><dl>' + (p.said ? '<dt>Employees</dt><dd>' + esc(p.said) + '</dd>' : '') + (p.records ? '<dt>Records</dt><dd>' + esc(p.records) + '</dd>' : '') +
            (p.where ? '<dt>Where</dt><dd>' + esc(p.where) + '</dd>' : '') + '<dt>Basis</dt><dd>' + esc(p.law) + '</dd><dt>First step</dt><dd>' + esc(p.act) + '</dd></dl></div>';
        }).join('') + '</div>';
      }).join('') : '<p class="lede">Nothing crossed a priority line.</p>') + '</section>');
    }

    var o = R.outcome;
    h.push('<section class="panel"><h2>Outcomes</h2><p class="note">Reported beside the score, not inside it.</p><div class="grid2">' +
      '<div class="stat"><b>' + (o.o1avg === null ? '–' : o.o1avg.toFixed(1)) + '</b><span>Would recommend, average of 0–10 (' + o.o1n + ' answers; promoters minus detractors ' + (o.enps === null ? '–' : (o.enps > 0 ? '+' : '') + o.enps) + ')</span></div>' +
      '<div class="stat"><b>' + r0(o.o2) + '</b><span>Expect to be here in 12 months (out of 100)</span></div>' +
      '<div class="stat"><b>' + r0(o.o3) + '</b><span>Proud to work here (out of 100)</span></div></div></section>');

    h.push('<section class="panel"><h2>Detail</h2><div>' + R.modules.filter(function (m) { return m.n; }).map(function (m) {
      return '<details><summary>Role questions: ' + esc(m.name) + ' (' + m.n + ')</summary>' + (m.hidden ? '<p class="note">Hidden: fewer than ' + R.minGroup + ' respondents.</p>' :
        '<div class="tw"><table><thead><tr><th>Question</th><th>Answers</th><th>Unfavourable</th><th>Score</th></tr></thead><tbody>' + m.items.map(function (q) { return '<tr><td>' + esc(q.text) + (q.rev ? ' <em>(reverse)</em>' : '') + '</td><td>' + q.n + '</td><td>' + (q.unfPct === null ? '–' : q.unfPct + '%') + '</td><td><b>' + r0(q.score) + '</b></td></tr>'; }).join('') + '</tbody></table></div>') + '</details>';
    }).join('') + R.dims.map(function (d) {
      var items = R.items.filter(function (q) { return q.d === d.id; });
      return '<details><summary>' + d.id + '. ' + esc(d.name) + ' · ' + r0(d.score) + '</summary><div class="tw"><table><thead><tr><th>Question</th><th>Valid</th><th>Not sure</th><th>Unfavourable</th><th>Score</th></tr></thead><tbody>' +
        items.map(function (q) { return '<tr><td>' + esc(q.text) + (q.crit ? ' <b title="Critical">●</b>' : '') + (q.rev ? ' <em>(reverse)</em>' : '') + '</td><td>' + q.n + '</td><td>' + q.notSure + '</td><td>' + (q.unfPct === null ? '–' : q.unfPct + '%') + '</td><td><b>' + (q.score === null ? 'too few' : r0(q.score)) + '</b></td></tr>'; }).join('') +
        '</tbody></table></div></details>';
    }).join('') + '</div><p class="note">● marks a critical question. Groups under ' + R.minGroup + ' people are never shown. No answer can be traced to a person.</p></section>');
    h.push('</div>');
    return h.join('');
  };

  /* Expand every collapsed section when printing or saving as PDF. */
  window.addEventListener('beforeprint', function () { document.querySelectorAll('details').forEach(function (d) { d.setAttribute('data-was', d.open ? '1' : '0'); d.open = true; }); });
  window.addEventListener('afterprint', function () { document.querySelectorAll('details[data-was]').forEach(function (d) { d.open = d.getAttribute('data-was') === '1'; d.removeAttribute('data-was'); }); });
})();
