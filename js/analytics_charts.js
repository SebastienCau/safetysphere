// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SafetySphere — Graphes d'accueil  v1.0
//  Canvas natif · Thème live · Préférences Supabase
//  Ordre de chargement : après conformite.js, avant gate.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

var DashCharts = (function () {

  // ── Catalogue ────────────────────────────────────────────────

  var CATALOG = {
    worker: {
      label: 'Activité Documents', subtitle: '{days} derniers jours · Habilitations',
      icon: '📄', accent: '#60A5FA', period: 30,
      elId: 'workerDashChart', afterEl: 'worker-stats-grid'
    },
    company: {
      label: 'Activité Intervenants', subtitle: '{days} derniers jours · Documents soumis',
      icon: '👷', accent: '#A78BFA', period: 30,
      elId: 'companyDashChart', afterEl: 'company-stats-grid'
    },
    hse: {
      label: 'Fréquentation Visiteurs', subtitle: '{days} derniers jours · Entrées sur site',
      icon: '🚪', accent: '#F97316', period: 30,
      elId: 'hseDashChart', afterEl: 'hse-stats-grid'
    },
    subcontractor: {
      label: 'Activité Documents', subtitle: '{days} derniers jours · Documents société',
      icon: '📋', accent: '#2DD4BF', period: 30,
      elId: 'stDashChart', afterEl: 'st-stats-grid'
    }
  };

  // Préférences (true = activé par défaut)
  var _prefs = { worker: true, company: true, hse: true, subcontractor: true };
  // Expose pour le toggle admin (inline onclick)
  window._dcPrefsRef = _prefs;

  // Store canvas par elId
  var _store = {};

  // ── Utilitaires ──────────────────────────────────────────────

  function _localKey(date) {
    return date.getFullYear() + '-'
      + String(date.getMonth() + 1).padStart(2, '0') + '-'
      + String(date.getDate()).padStart(2, '0');
  }

  function _buckets(days) {
    var b = {}, s = new Date();
    s.setDate(s.getDate() - (days - 1)); s.setHours(0, 0, 0, 0);
    for (var i = 0; i < days; i++) {
      var d = new Date(s); d.setDate(d.getDate() + i);
      b[_localKey(d)] = { a: 0, b: 0 };
    }
    return b;
  }

  function _hexRgb(h) {
    return parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16);
  }

  function _theme() {
    var L = document.body.classList.contains('theme-light');
    var fz = Math.max(0.8, Math.min(1.3,
      (parseFloat(document.documentElement.style.getPropertyValue('--ui-zoom') || '1') || 1) *
      (parseFloat(((document.getElementById('appContent') || {}).style || {}).zoom || '1') || 1)));
    return {
      L, fz,
      grid: L ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)',
      base: L ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)',
      axis: L ? '#94A3B8' : '#6B7280',
      muted: L ? '#64748B' : '#9CA3AF',
      panelBg: L ? 'rgba(255,255,255,.97)' : 'rgba(15,23,42,.9)',
      panelBdr: L ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.07)',
      kpiBg: L ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.03)',
      kpiBdr: L ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.05)',
      btnBg: L ? 'rgba(0,0,0,.04)' : 'rgba(255,255,255,.04)',
      btnBdr: L ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.07)',
      btnOff: L ? '#94A3B8' : '#4B5563',
      tipBg: 'rgba(8,16,28,.96)'
    };
  }

  // ── Rendu HTML ───────────────────────────────────────────────

  function _buildPanel(cfg, serA, serB, labelA, labelB, keys) {
    var T = _theme(), fz = T.fz, days = cfg.period;
    var ac = cfg.accent, acR = _hexRgb(ac);
    var n = keys.length;

    var totA = serA.reduce(function (s, v) { return s + v; }, 0);
    var totB = serB.reduce(function (s, v) { return s + v; }, 0);
    var peak = Math.max.apply(null, serA.concat([0]));
    var avg = totA > 0 ? (totA / days).toFixed(1) : '0';
    var peakIdx = serA.indexOf(peak);
    var peakFmt = peak > 0 && keys[peakIdx]
      ? new Date(keys[peakIdx] + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
      : null;

    var labels = keys.map(function (k) {
      var d = new Date(k + 'T12:00:00');
      return days <= 14
        ? d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
        : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });

    var canId = cfg.elId + '_canvas', tipId = cfg.elId + '_tip';

    _store[cfg.elId] = {
      canId, tipId, labels, keys,
      a: serA, b: serB, labelA, labelB,
      maxVal: Math.max.apply(null, serA.concat([1])),
      ac, acR, secR: '148,163,184', T
    };

    var subtitle = cfg.subtitle.replace('{days}', days);

    function btn(v, txt) {
      var a = days === v;
      return '<button onclick="DashCharts.setPeriod(\'' + cfg.elId + '\',' + v + ')" style="'
        + 'padding:4px 10px;font-size:' + Math.round(10 * fz) + 'px;font-weight:700;'
        + 'border:none;cursor:pointer;border-radius:6px;transition:all .15s;'
        + 'font-family:Barlow,sans-serif;'
        + 'background:' + (a ? 'rgba(' + acR + ',.18)' : 'transparent') + ';'
        + 'color:' + (a ? ac : T.btnOff) + '">' + txt + '</button>';
    }

    function kpi(val, sub, col, last) {
      return '<div style="padding:11px 8px;text-align:center;' + (last ? '' : 'border-right:1px solid ' + T.kpiBdr) + '">'
        + '<div style="font-size:' + Math.round(8 * fz) + 'px;font-weight:700;letter-spacing:1.2px;'
        + 'text-transform:uppercase;color:' + T.muted + ';margin-bottom:3px;font-family:Barlow,sans-serif">' + sub + '</div>'
        + '<div style="font-size:' + Math.round(17 * fz) + 'px;font-weight:900;color:' + col + ';'
        + 'line-height:1;font-family:Barlow,sans-serif">' + val + '</div>'
        + '</div>';
    }

    var h = '';
    h += '<div style="background:' + T.panelBg + ';border:1px solid ' + T.panelBdr + ';border-radius:16px;'
      + 'overflow:hidden;margin-top:20px;box-shadow:0 4px 24px rgba(0,0,0,.15),'
      + 'inset 0 1px 0 rgba(255,255,255,.04)">';

    // Header
    h += '<div style="padding:16px 20px 0;display:flex;align-items:center;'
      + 'justify-content:space-between;gap:8px;flex-wrap:wrap">';
    h += '<div style="display:flex;align-items:center;gap:9px">';
    h += '<div style="width:2px;height:16px;background:linear-gradient(180deg,' + ac + ',transparent);'
      + 'border-radius:1px;flex-shrink:0"></div>';
    h += '<div>';
    h += '<div style="font-size:' + Math.round(10 * fz) + 'px;font-weight:700;letter-spacing:2px;'
      + 'text-transform:uppercase;color:' + ac + ';font-family:Barlow,sans-serif">' + cfg.icon + ' ' + cfg.label + '</div>';
    h += '<div style="font-size:' + Math.round(11 * fz) + 'px;color:' + T.muted
      + ';font-family:Barlow,sans-serif;margin-top:2px">' + subtitle + '</div>';
    h += '</div></div>';

    h += '<div style="display:flex;background:' + T.btnBg + ';border:1px solid ' + T.btnBdr
      + ';border-radius:8px;overflow:hidden;padding:2px;gap:1px">'
      + btn(7, '7J') + btn(30, '30J') + '</div>';
    h += '</div>'; // end header

    // KPIs
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);margin:12px 20px 0;'
      + 'background:' + T.kpiBg + ';border:1px solid ' + T.kpiBdr + ';border-radius:10px;overflow:hidden">';
    h += kpi(totA, 'Total', ac, false);
    h += kpi(avg, 'Moy/jour', '#FCD34D', false);
    h += kpi(peak || '—', 'Pic', '#A5B4FC', false);
    h += kpi(totB || '—', labelB, '#4ADE80', true);
    h += '</div>';

    // Canvas
    h += '<div style="padding:10px 20px 4px;position:relative">';
    h += '<canvas id="' + canId + '" style="width:100%;height:120px;display:block;cursor:crosshair"></canvas>';
    h += '<div id="' + tipId + '" style="position:absolute;pointer-events:none;display:none;'
      + 'background:' + T.tipBg + ';border:1px solid rgba(' + acR + ',.2);border-radius:9px;'
      + 'padding:8px 12px;font-size:11px;color:#fff;white-space:nowrap;z-index:99;'
      + 'box-shadow:0 8px 24px rgba(0,0,0,.5)"></div>';
    h += '</div>';

    // Légende
    h += '<div style="padding:2px 20px 14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">';
    h += '<div style="display:flex;align-items:center;gap:5px">'
      + '<div style="width:12px;height:3px;background:' + ac + ';border-radius:2px"></div>'
      + '<span style="font-size:' + Math.round(9 * fz) + 'px;color:' + T.muted
      + ';font-family:Barlow,sans-serif">' + labelA + '</span></div>';
    if (totB > 0) {
      h += '<div style="display:flex;align-items:center;gap:5px">'
        + '<div style="width:12px;height:2px;background:#94A3B8;border-radius:2px;opacity:.5"></div>'
        + '<span style="font-size:' + Math.round(9 * fz) + 'px;color:' + T.muted
        + ';font-family:Barlow,sans-serif">' + labelB + '</span></div>';
    }
    h += peakFmt
      ? '<span style="font-size:' + Math.round(9 * fz) + 'px;color:' + T.muted + ';margin-left:auto;font-family:Barlow,sans-serif">Pic · <b style="color:#FCD34D">' + peakFmt + '</b></span>'
      : '<span style="font-size:' + Math.round(9 * fz) + 'px;color:' + T.muted + ';margin-left:auto;font-style:italic;font-family:Barlow,sans-serif">Aucune donnée</span>';
    h += '</div>';
    h += '</div>'; // end panel

    return h;
  }

  // ── Dessin Canvas ────────────────────────────────────────────

  function _draw(elId) {
    var D = _store[elId];
    if (!D) return;
    var canvas = document.getElementById(D.canId);
    if (!canvas) { setTimeout(function () { _draw(elId); }, 50); return; }
    if (!canvas.offsetWidth) { setTimeout(function () { _draw(elId); }, 50); return; }

    var tip = document.getElementById(D.tipId);
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.offsetWidth, H = 120;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);

    var T = D.T, fz = T.fz, n = D.a.length, maxY = D.maxVal;
    var pad = { l: 26, r: 8, t: 10, b: 26 };
    var gw = W - pad.l - pad.r, gh = H - pad.t - pad.b;
    var aR = D.acR, sR = D.secR;

    function vX(i) { return pad.l + i / (n - 1 || 1) * gw; }
    function vY(v) { return pad.t + gh * (1 - v / maxY); }

    // Grille horizontale
    var step = maxY <= 5 ? 1 : maxY <= 10 ? 2 : maxY <= 20 ? 5 : Math.ceil(maxY / 3);
    for (var yv = 0; yv <= maxY; yv += step) {
      ctx.beginPath(); ctx.moveTo(pad.l, vY(yv)); ctx.lineTo(pad.l + gw, vY(yv));
      ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.stroke();
      if (yv > 0) {
        ctx.fillStyle = T.axis;
        ctx.font = Math.round(7 * fz) + 'px Barlow,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(yv, pad.l - 3, vY(yv) + 3);
      }
    }
    ctx.beginPath(); ctx.moveTo(pad.l, pad.t + gh); ctx.lineTo(pad.l + gw, pad.t + gh);
    ctx.strokeStyle = T.base; ctx.lineWidth = 1; ctx.stroke();

    // Labels X
    var skip = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 8);
    D.labels.forEach(function (lbl, i) {
      if (i % skip !== 0 && i !== n - 1) return;
      ctx.fillStyle = T.axis;
      ctx.font = Math.round(8 * fz) + 'px Barlow,sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, vX(i), H - 4);
    });

    // Série B — pointillé discret
    if (D.b.some(function (v) { return v > 0; })) {
      var bPts = D.b.map(function (v, i) { return [vX(i), vY(v)]; });
      ctx.beginPath();
      bPts.forEach(function (p, i) { i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]); });
      ctx.strokeStyle = 'rgba(' + sR + ',.32)'; ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
    }

    // Série A — aire + courbe bezier
    var pts = D.a.map(function (v, i) { return [vX(i), vY(v)]; });
    var fg = ctx.createLinearGradient(0, pad.t, 0, pad.t + gh);
    fg.addColorStop(0, 'rgba(' + aR + ',.2)'); fg.addColorStop(1, 'rgba(' + aR + ',0)');

    function bezier(p) {
      ctx.beginPath();
      p.forEach(function (pt, i) {
        if (i === 0) { ctx.moveTo(pt[0], pt[1]); return; }
        var pr = p[i - 1], cx = (pr[0] + pt[0]) / 2;
        ctx.bezierCurveTo(cx, pr[1], cx, pt[1], pt[0], pt[1]);
      });
    }

    bezier(pts);
    ctx.lineTo(pts[n - 1][0], pad.t + gh); ctx.lineTo(pts[0][0], pad.t + gh);
    ctx.closePath(); ctx.fillStyle = fg; ctx.fill();

    bezier(pts);
    ctx.strokeStyle = D.ac; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // Points accentués
    D.a.forEach(function (v, i) {
      if (!v) return;
      ctx.beginPath(); ctx.arc(vX(i), vY(v), 3, 0, Math.PI * 2);
      ctx.fillStyle = D.ac; ctx.fill();
      ctx.strokeStyle = 'rgba(8,16,28,.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // Tooltip
    if (canvas._dcBound) return;
    canvas._dcBound = true;

    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect(), mx = e.clientX - r.left;
      var idx = -1, md = 9999;
      D.a.forEach(function (_, i) { var dx = Math.abs(vX(i) - mx); if (dx < md) { md = dx; idx = i; } });
      if (idx < 0 || idx >= n) { if (tip) tip.style.display = 'none'; return; }
      var va = D.a[idx], vb = D.b[idx];
      if (tip) {
        tip.innerHTML = '<div style="font-weight:700;color:' + D.ac + ';margin-bottom:4px;font-size:11px">'
          + D.labels[idx] + '</div>'
          + '<div style="color:#9CA3AF;line-height:1.8">'
          + '<b style="color:#F1F5F9">' + va + '</b> ' + D.labelA
          + (vb ? '<br><b style="color:#94A3B8">' + vb + '</b> ' + D.labelB : '')
          + '</div>';
        var cx = mx + 12; if (cx + 140 > W) cx = mx - 150;
        tip.style.left = cx + 'px';
        tip.style.top = (e.clientY - r.top - 50) + 'px';
        tip.style.display = 'block';
      }
    });
    canvas.addEventListener('mouseleave', function () { if (tip) tip.style.display = 'none'; });

    var _rt;
    window.addEventListener('resize', function () {
      clearTimeout(_rt); _rt = setTimeout(function () { _draw(elId); }, 120);
    });
  }

  // ── Chargement Supabase ──────────────────────────────────────

  async function _sinceISO(days) {
    var d = new Date(); d.setDate(d.getDate() - (days - 1)); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  async function _loadWorker(cfg) {
    if (!currentUser) return null;
    var bk = _buckets(cfg.period);
    var { data } = await sb.from('documents')
      .select('status,created_at').eq('owner_id', currentUser.id)
      .eq('category', 'worker').gte('created_at', await _sinceISO(cfg.period));
    (data || []).forEach(function (d) {
      var k = _localKey(new Date(d.created_at));
      if (!bk[k]) return; bk[k].a++;
      if (d.status === 'validated') bk[k].b++;
    });
    return { bk, labelA: 'Soumis', labelB: 'Validés' };
  }

  async function _loadCompany(cfg) {
    if (!currentProfile || !currentProfile.org_id) return null;
    var { data: wk } = await sb.from('profiles').select('id').eq('org_id', currentProfile.org_id);
    if (!wk || !wk.length) return null;
    var ids = wk.map(function (w) { return w.id; });
    var bk = _buckets(cfg.period);
    var { data } = await sb.from('documents')
      .select('status,created_at').in('owner_id', ids)
      .eq('category', 'worker').gte('created_at', await _sinceISO(cfg.period));
    (data || []).forEach(function (d) {
      var k = _localKey(new Date(d.created_at));
      if (!bk[k]) return; bk[k].a++;
      if (d.status === 'validated') bk[k].b++;
    });
    return { bk, labelA: 'Docs soumis', labelB: 'Validés' };
  }

  async function _loadHSE(cfg) {
    if (!currentProfile || !currentProfile.org_id) return null;
    var bk = _buckets(cfg.period);
    var { data } = await sb.from('visitor_log')
      .select('check_in,signed_at').eq('org_id', currentProfile.org_id)
      .gte('check_in', await _sinceISO(cfg.period));
    (data || []).forEach(function (v) {
      var k = _localKey(new Date(v.check_in));
      if (!bk[k]) return; bk[k].a++;
      if (v.signed_at) bk[k].b++;
    });
    return { bk, labelA: 'Visiteurs', labelB: 'Signés' };
  }

  async function _loadSubcontractor(cfg) {
    if (!currentUser) return null;
    var bk = _buckets(cfg.period);
    var { data } = await sb.from('documents')
      .select('status,created_at').eq('owner_id', currentUser.id)
      .gte('created_at', await _sinceISO(cfg.period));
    (data || []).forEach(function (d) {
      var k = _localKey(new Date(d.created_at));
      if (!bk[k]) return; bk[k].a++;
      if (d.status === 'validated') bk[k].b++;
    });
    return { bk, labelA: 'Docs soumis', labelB: 'Validés' };
  }

  // ── Render ───────────────────────────────────────────────────

  async function _render(role) {
    if (_prefs[role] === false) return;
    var cfg = CATALOG[role];
    if (!cfg) return;

    var el = document.getElementById(cfg.elId);
    if (!el) {
      var anchor = document.getElementById(cfg.afterEl);
      if (!anchor) return;
      el = document.createElement('div');
      el.id = cfg.elId;
      anchor.parentNode.insertBefore(el, anchor.nextSibling);
    }

    // Skeleton
    el.innerHTML = '<div style="height:200px;display:flex;align-items:center;'
      + 'justify-content:center;opacity:.3;font-size:11px;color:var(--muted);'
      + 'font-family:Barlow,sans-serif;border:1px solid rgba(255,255,255,.05);'
      + 'border-radius:16px;margin-top:20px">⏳ Chargement…</div>';

    try {
      var loaders = { worker: _loadWorker, company: _loadCompany, hse: _loadHSE, subcontractor: _loadSubcontractor };
      var result = await loaders[role](cfg);
      if (!result) { el.innerHTML = ''; return; }
      var keys = Object.keys(result.bk).sort();
      el.innerHTML = _buildPanel(cfg,
        keys.map(function (k) { return result.bk[k].a; }),
        keys.map(function (k) { return result.bk[k].b; }),
        result.labelA, result.labelB, keys
      );
      requestAnimationFrame(function () { _draw(cfg.elId); });
    } catch (e) {
      console.warn('[DashCharts]', role, e);
      el.innerHTML = '';
    }
  }

  // ── Préférences Supabase ─────────────────────────────────────

  function loadPrefs() {
    var saved = currentProfile
      && currentProfile.dashboard_layout
      && currentProfile.dashboard_layout._dashCharts;
    if (saved) {
      Object.keys(CATALOG).forEach(function (role) {
        _prefs[role] = saved[role] !== false;
      });
    }
  }

  async function savePrefs() {
    if (!currentUser || !currentProfile) return;
    var layout = currentProfile.dashboard_layout || {};
    layout._dashCharts = Object.assign({}, _prefs);
    currentProfile.dashboard_layout = layout;
    var { error } = await sb.from('profiles')
      .update({ dashboard_layout: layout }).eq('id', currentUser.id);
    if (error) console.warn('[DashCharts] save:', error.message);
  }

  // ── Panneau Admin ────────────────────────────────────────────

  function renderAdminSection() {
    var T = _theme(), fz = T.fz;
    var roles = [
      { role: 'worker',        icon: '👷', label: 'Dashboard Worker',        desc: 'Activité des habilitations personnelles' },
      { role: 'company',       icon: '🏢', label: 'Dashboard Entreprise',    desc: 'Documents soumis par les intervenants' },
      { role: 'hse',           icon: '🛡', label: 'Dashboard HSE',           desc: 'Fréquentation visiteurs (module Gate)' },
      { role: 'subcontractor', icon: '🔧', label: 'Dashboard Sous-Traitant', desc: 'Documents société soumis et validés' }
    ];

    var h = '<div class="section-card" style="margin-top:24px">';
    h += '<div class="section-title">📈 Graphes d\'accueil</div>';
    h += '<div class="section-subtitle" style="margin-bottom:20px">'
      + 'Activez ou désactivez le graphe affiché sur la page d\'accueil de chaque rôle. '
      + 'Activés par défaut pour tous les comptes.</div>';

    roles.forEach(function (m, idx) {
      var on = _prefs[m.role] !== false;
      var tid = 'dcToggle_' + m.role;
      var last = idx === roles.length - 1;
      h += '<label class="compliance-toggle-row" style="cursor:pointer;'
        + (last ? '' : 'border-bottom:1px solid rgba(255,255,255,.04);padding-bottom:14px;margin-bottom:2px') + '"'
        + ' onclick="_dcAdminToggle(\'' + m.role + '\',\'' + tid + '\');return false">';
      h += '<div class="compliance-toggle-info">';
      h += '<div class="compliance-toggle-label">' + m.icon + ' ' + m.label + '</div>';
      h += '<div class="compliance-toggle-desc">' + m.desc + '</div>';
      h += '</div>';
      // Toggle pill
      h += '<div style="position:relative;width:48px;height:28px;flex-shrink:0">';
      h += '<span id="' + tid + '_track" style="position:absolute;inset:0;border-radius:28px;'
        + 'transition:background .25s;background:' + (on ? '#22C55E' : 'rgba(255,255,255,.1)') + ';'
        + 'border:1px solid rgba(255,255,255,.1)"></span>';
      h += '<span id="' + tid + '_thumb" style="position:absolute;top:4px;left:' + (on ? '24' : '4') + 'px;'
        + 'width:18px;height:18px;border-radius:50%;background:#fff;'
        + 'transition:left .25s;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>';
      h += '</div>';
      h += '</label>';
    });

    h += '<div id="dcAdminStatus" style="margin-top:14px;font-size:12px;color:var(--success);'
      + 'min-height:18px;font-family:Barlow,sans-serif"></div>';
    h += '</div>';
    return h;
  }

  // ── Boot ─────────────────────────────────────────────────────

  function _patch(fnName, after) {
    var orig = window[fnName];
    window[fnName] = async function () {
      if (orig) await orig.apply(this, arguments);
      await after();
    };
  }

  function init() {
    // Les patches sont appliqués après DOMContentLoaded pour garantir
    // que workers.js, reports.js etc. sont déjà parsés et leurs fonctions définies
    function _applyPatches() {
      var _origLoad = window.loadDisplayPrefs;
      window.loadDisplayPrefs = function () {
        if (_origLoad) _origLoad.apply(this, arguments);
        loadPrefs();
      };

      _patch('loadWorkerStats',  function () { return _render('worker'); });
      _patch('loadCompanyStats', function () { return _render('company'); });
      _patch('loadHSEStats',     function () { return _render('hse'); });
      _patch('loadSTStats',      function () { return _render('subcontractor'); });

      var _origAdmin = window.loadAdminOverview;
      window.loadAdminOverview = async function () {
        if (_origAdmin) await _origAdmin.apply(this, arguments);
        var target = document.getElementById('adminDashChartsSection');
        if (!target) {
          var cards = document.querySelectorAll('#Admin-compliance .section-card');
          var anchor = cards.length ? cards[cards.length - 1] : null;
          if (!anchor) anchor = document.querySelector('#Admin-overview .stats-grid');
          if (anchor) {
            target = document.createElement('div');
            target.id = 'adminDashChartsSection';
            anchor.parentNode.insertBefore(target, anchor.nextSibling);
          }
        }
        if (target) target.innerHTML = renderAdminSection();
      };
    }

    // Les scripts sont en bas de <body> — DOMContentLoaded est peut-être déjà passé
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _applyPatches);
    } else {
      _applyPatches();
    }
  }

  return {
    init,
    loadPrefs,
    savePrefs,
    setPeriod: function (elId, days) {
      var role = Object.keys(CATALOG).find(function (r) { return CATALOG[r].elId === elId; });
      if (role) { CATALOG[role].period = days; _render(role); }
    },
    reload: function (role) { _render(role); }
  };

})();

// ── Toggle admin (appelé inline depuis le HTML du panneau) ──────
function _dcAdminToggle(role, toggleId) {
  var thumb = document.getElementById(toggleId + '_thumb');
  var track = document.getElementById(toggleId + '_track');
  var isOn  = thumb && thumb.style.left === '24px';
  var next  = !isOn;

  if (track) track.style.background = next ? '#22C55E' : 'rgba(255,255,255,.1)';
  if (thumb) thumb.style.left = next ? '24px' : '4px';

  window._dcPrefsRef[role] = next;

  DashCharts.savePrefs().then(function () {
    var s = document.getElementById('dcAdminStatus');
    if (s) { s.textContent = '✓ Préférence sauvegardée'; setTimeout(function () { s.textContent = ''; }, 2000); }
  });
}

// Boot
DashCharts.init();
