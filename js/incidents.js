// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE INCIDENTS v1.0
//  Fichier : js/incidents.js
//  Rôles   : hse (saisie + vue complète), company (lecture), admin (global)
//  Tables  : incidents, incident_actions
//  Activation : org_modules { org_id, module_id:'incidents', enabled }
// ════════════════════════════════════════════════════════════════════════════

// ── Constantes ────────────────────────────────────────────────────────────

var INCIDENT_TYPES = [
  { id: 'accident',       label: 'Accident avec arrêt',   icon: '🚑', color: '#EF4444' },
  { id: 'accident_sans',  label: 'Accident sans arrêt',   icon: '🤕', color: '#F97316' },
  { id: 'quasi',          label: 'Quasi-accident',         icon: '⚠️', color: '#F59E0B' },
  { id: 'situation_dang', label: 'Situation dangereuse',  icon: '🔶', color: '#EAB308' },
  { id: 'presqu_accident',label: "Presqu'accident",        icon: '🟡', color: '#FCD34D' },
  { id: 'dommage_mat',    label: 'Dommage matériel',       icon: '🔧', color: '#94A3B8' }
];

var INCIDENT_GRAVITY = [
  { id: '1', label: 'Mineure',  color: '#4ADE80' },
  { id: '2', label: 'Modérée',  color: '#FCD34D' },
  { id: '3', label: 'Grave',    color: '#F97316' },
  { id: '4', label: 'Critique', color: '#EF4444' }
];

var INCIDENT_STATUS = [
  { id: 'ouvert',   label: 'Ouvert',   color: '#F97316' },
  { id: 'en_cours', label: 'En cours', color: '#60A5FA' },
  { id: 'cloture',  label: 'Clôturé',  color: '#4ADE80' }
];

// ── État interne ──────────────────────────────────────────────────────────

var _incidents       = [];
var _incidentActions = [];
var _incidentPeriod  = '30';
var _incidentView    = 'liste';   // 'liste' | 'saisie' | 'detail'
var _incidentEditId  = null;
var _incidentChartType = 'bar';

// ════════════════════════════════════════════════════════════════════════════
//  SQL — Script à exécuter dans Supabase SQL Editor
// ════════════════════════════════════════════════════════════════════════════
/*
CREATE TABLE IF NOT EXISTS incidents (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type             text NOT NULL,
  gravity          text NOT NULL,
  status           text DEFAULT 'ouvert',
  title            text NOT NULL,
  description      text,
  location         text,
  occurred_at      timestamptz NOT NULL,
  reported_at      timestamptz DEFAULT now(),
  closed_at        timestamptz,
  victims_count    integer DEFAULT 0,
  work_stoppage    boolean DEFAULT false,
  stoppage_days    integer DEFAULT 0,
  root_cause       text,
  immediate_action text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incident_actions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id uuid REFERENCES incidents(id) ON DELETE CASCADE NOT NULL,
  org_id      uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date    date,
  status      text DEFAULT 'ouverte',
  closed_at   timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incidents_org" ON incidents FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "incidents_admin" ON incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "inc_actions_org" ON incident_actions FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "inc_actions_admin" ON incident_actions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
*/

// ════════════════════════════════════════════════════════════════════════════
//  ACTIVATION MODULE
// ════════════════════════════════════════════════════════════════════════════

async function checkIncidentsActivation() {
  if (!currentProfile || !currentProfile.org_id) return false;
  var res = await sb.from('org_modules')
    .select('enabled')
    .eq('org_id', currentProfile.org_id)
    .eq('module_id', 'incidents')
    .maybeSingle();
  var enabled = res.data ? res.data.enabled : false;
  updateIncidentsTabVisibility(enabled);
  return enabled;
}

function updateIncidentsTabVisibility(visible) {
  // Onglet TOUJOURS visible — même logique que Gate
  // Dot coloré : rouge = actif, gris = inactif
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var oc = tab.getAttribute('onclick') || '';
    if (oc.includes("'incidents'") || oc.includes('"incidents"')) {
      tab.style.display = '';
      var dot = tab.querySelector('.inc-status-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'inc-status-dot';
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle;flex-shrink:0';
        tab.appendChild(dot);
      }
      dot.style.background = visible ? '#F87171' : '#475569';
      dot.title = visible ? 'Module actif' : 'Module inactif — activez-le dans Admin';
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT DONNÉES
// ════════════════════════════════════════════════════════════════════════════

async function loadIncidents(role) {
  if (!currentProfile || !currentProfile.org_id) return;
  var orgId = currentProfile.org_id;

  // Vérifier activation (si false → page désactivée)
  var scopeId = orgId + '_incidents';
  var actRes = await sb.from('org_modules')
    .select('enabled').eq('org_id', currentProfile.org_id).eq('module_id','incidents').maybeSingle();
  if (actRes.data && actRes.data.enabled === false) {
    renderIncidentsDisabled(role); return;
  }

  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-incidents-content');
  if (container) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div>'
      + '<div class="empty-state-text">Chargement...</div></div>';
  }

  var results = await Promise.all([
    sb.from('incidents').select('*').eq('org_id', orgId).order('occurred_at', { ascending: false }),
    sb.from('incident_actions').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
  ]);

  _incidents       = results[0].data || [];
  _incidentActions = results[1].data || [];
  renderIncidents(role);
  renderIncidentsKPI();
}

// ════════════════════════════════════════════════════════════════════════════
//  WIDGET KPI — Dashboard accueil
// ════════════════════════════════════════════════════════════════════════════

function renderIncidentsKPI() {
  var el = document.getElementById('hse-incidents-kpi');
  if (!el) return;

  var now  = new Date();
  var d30  = new Date(now); d30.setDate(d30.getDate()  - 30);
  var d365 = new Date(now); d365.setDate(d365.getDate() - 365);

  var last30  = _incidents.filter(function(i) { return new Date(i.occurred_at) >= d30; });
  var last365 = _incidents.filter(function(i) { return new Date(i.occurred_at) >= d365; });

  var totalInc    = last30.filter(function(i) { return i.type === 'accident' || i.type === 'accident_sans'; }).length;
  var totalQuasi  = last30.filter(function(i) { return i.type === 'quasi' || i.type === 'presqu_accident'; }).length;
  var totalDang   = last30.filter(function(i) { return i.type === 'situation_dang'; }).length;
  var openActions = _incidentActions.filter(function(a) { return a.status !== 'terminee'; }).length;
  var totalYear   = last365.filter(function(i) { return i.type === 'accident' || i.type === 'accident_sans'; }).length;
  var closedInc   = _incidents.filter(function(i) { return i.status === 'cloture'; }).length;
  var resolRate   = _incidents.length ? Math.round(closedInc / _incidents.length * 100) : 100;

  var dashRole = currentProfile && currentProfile.role === 'hse' ? 'HSE' : 'Company';

  el.innerHTML = '<div style="margin:28px 0 8px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div style="width:3px;height:20px;background:linear-gradient(180deg,#EF4444,#F97316);border-radius:2px"></div>'
    + '<span style="font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#EF4444">Incidents & Sécurité</span>'
    + '</div>'
    + '<button onclick="switchPage(\'' + dashRole + '\',\'incidents\',this);loadIncidents(\'' + (currentProfile ? currentProfile.role : 'hse') + '\')" '
    + 'style="font-size:11px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);'
    + 'border-radius:8px;padding:5px 12px;color:#EF4444;cursor:pointer;font-weight:600">Voir tout →</button>'
    + '</div>'
    + '<div class="stats-grid" style="margin:0">'
    + _incKpiCard('🚑', totalInc,         'Incidents (30j)',      totalInc   > 0 ? '#EF4444' : '#4ADE80')
    + _incKpiCard('⚠️', totalQuasi,       'Quasi-accidents (30j)', totalQuasi > 2 ? '#F97316' : '#FCD34D')
    + _incKpiCard('🔶', totalDang,        'Sit. danger. (30j)',   '#EAB308')
    + _incKpiCard('🔧', openActions,      'Actions ouvertes',     openActions > 0 ? '#60A5FA' : '#4ADE80')
    + _incKpiCard('📅', totalYear,        'Accidents (12 mois)',  '#94A3B8')
    + _incKpiCard('✅', resolRate + '%',  'Taux résolution',      resolRate >= 80 ? '#4ADE80' : '#F97316')
    + '</div>'
    + '</div>';
}

function _incKpiCard(icon, val, label, color) {
  return '<div class="stat-card" style="border-left:3px solid ' + color + '">'
    + '<div class="stat-icon">' + icon + '</div>'
    + '<div class="stat-value" style="color:' + color + '">' + val + '</div>'
    + '<div class="stat-label">' + label + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDU PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

function renderIncidents(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-incidents-content');
  if (!container) return;

  if (_incidentView === 'saisie') {
    container.innerHTML = renderIncidentForm(role); return;
  }
  if (_incidentView === 'detail' && _incidentEditId) {
    var inc = _incidents.find(function(i) { return i.id === _incidentEditId; });
    if (inc) { container.innerHTML = renderIncidentDetail(inc, role); return; }
  }

  var isReadOnly = role === 'company';
  container.innerHTML = _renderIncidentHeader(role, isReadOnly)
    + renderIncidentChart()
    + renderIncidentList(role);
  setTimeout(function() { _drawIncidentCanvas(); }, 0);
}

function _renderIncidentHeader(role, isReadOnly) {
  var openAct = _incidentActions.filter(function(a) { return a.status !== 'terminee'; }).length;
  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
    + '<div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
    + '<div style="width:3px;height:22px;background:linear-gradient(180deg,#EF4444,#F97316);border-radius:2px"></div>'
    + '<span style="font-size:22px;font-weight:900;color:var(--text)">Incidents & Sécurité</span>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-left:13px">'
    + _incidents.length + ' enregistrement(s) · ' + openAct + ' action(s) ouverte(s)'
    + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + (!isReadOnly
      ? '<button onclick="_incidentView=\'saisie\';_incidentEditId=null;renderIncidents(\'' + role + '\')" '
        + 'class="btn-primary" style="padding:9px 18px;font-size:13px;font-weight:700">+ Déclarer un incident</button>'
      : '')
    + '<button onclick="_exportIncidentsCSV()" '
    + 'style="padding:9px 16px;font-size:12px;font-weight:600;background:rgba(255,255,255,.06);'
    + 'border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--muted);cursor:pointer">📥 Export CSV</button>'
    + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  GRAPHE TENDANCE
// ════════════════════════════════════════════════════════════════════════════

function renderIncidentChart() {
  var days  = parseInt(_incidentPeriod, 10);
  var now   = new Date();
  var start = new Date(now); start.setDate(start.getDate() - (days - 1)); start.setHours(0, 0, 0, 0);
  var useWeeks = days > 30;

  var buckets = {};
  var keys    = [];

  if (useWeeks) {
    var weeks = Math.ceil(days / 7);
    for (var w = 0; w < weeks; w++) {
      var ws = new Date(start); ws.setDate(ws.getDate() + w * 7);
      var we = new Date(ws.getTime() + 6 * 86400000);
      var k  = 'S' + (w + 1);
      buckets[k] = { incidents: 0, quasi: 0, dang: 0, label: k, from: ws, to: we };
      keys.push(k);
    }
    _incidents.forEach(function(inc) {
      var d = new Date(inc.occurred_at);
      keys.forEach(function(k) {
        var b = buckets[k];
        if (d >= b.from && d <= b.to) {
          if (inc.type === 'accident' || inc.type === 'accident_sans') b.incidents++;
          else if (inc.type === 'quasi' || inc.type === 'presqu_accident') b.quasi++;
          else b.dang++;
        }
      });
    });
  } else {
    for (var d2 = 0; d2 < days; d2++) {
      var dt  = new Date(start); dt.setDate(dt.getDate() + d2);
      var key = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
      var lbl = dt.toLocaleDateString('fr-FR', days <= 7 ? { weekday: 'short', day: 'numeric' } : { day: 'numeric', month: 'short' });
      buckets[key] = { incidents: 0, quasi: 0, dang: 0, label: lbl };
      keys.push(key);
    }
    _incidents.forEach(function(inc) {
      var raw = inc.occurred_at.slice(0, 10);
      if (buckets[raw]) {
        if (inc.type === 'accident' || inc.type === 'accident_sans') buckets[raw].incidents++;
        else if (inc.type === 'quasi' || inc.type === 'presqu_accident') buckets[raw].quasi++;
        else buckets[raw].dang++;
      }
    });
  }

  var incidents = keys.map(function(k) { return buckets[k].incidents; });
  var quasis    = keys.map(function(k) { return buckets[k].quasi; });
  var dangs     = keys.map(function(k) { return buckets[k].dang; });
  var labels    = keys.map(function(k) { return buckets[k].label; });
  var maxVal    = Math.max.apply(null, incidents.concat(quasis).concat(dangs).concat([1]));

  window._incChartData = { labels: labels, incidents: incidents, quasis: quasis, dangs: dangs, maxVal: maxVal, type: _incidentChartType, n: keys.length };

  var tAcc   = incidents.reduce(function(a, b) { return a + b; }, 0);
  var tQuasi = quasis.reduce(function(a, b) { return a + b; }, 0);
  var tDang  = dangs.reduce(function(a, b) { return a + b; }, 0);
  var noData = tAcc === 0 && tQuasi === 0 && tDang === 0;

  return '<div style="background:linear-gradient(135deg,rgba(13,27,42,.95),rgba(15,23,42,.98));'
    + 'border:1px solid rgba(239,68,68,.15);border-radius:20px;overflow:hidden;margin-bottom:24px">'

    + '<div style="padding:20px 24px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
    + '<div>'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
    + '<div style="width:3px;height:18px;background:linear-gradient(180deg,#EF4444,#F97316);border-radius:2px"></div>'
    + '<span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#EF4444;font-family:\'Barlow\',sans-serif">Tendance</span>'
    + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px">Incidents sur la période</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px;align-items:center">'
    + '<div style="display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden">'
    + _incChartBtn('bar',  '▐▐▐', _incidentChartType, 'type')
    + _incChartBtn('line', '∿',   _incidentChartType, 'type')
    + '</div>'
    + '<div style="display:flex;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;overflow:hidden">'
    + _incChartBtn('7',   '7J',  _incidentPeriod, 'period')
    + _incChartBtn('30',  '30J', _incidentPeriod, 'period')
    + _incChartBtn('90',  '90J', _incidentPeriod, 'period')
    + _incChartBtn('365', '12M', _incidentPeriod, 'period')
    + '</div>'
    + '</div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:16px 24px;'
    + 'background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden">'
    + _incStrip('🚑', tAcc,   'Accidents',         '#EF4444', 0)
    + _incStrip('⚠️', tQuasi, 'Quasi-accidents',   '#F97316', 1)
    + _incStrip('🔶', tDang,  'Sit. dangereuses',  '#EAB308', 2)
    + '</div>'

    + '<div style="padding:0 24px 8px"><canvas id="incidentChartCanvas" height="180" style="width:100%;height:180px;display:block"></canvas></div>'

    + '<div style="padding:0 24px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap">'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#EF4444;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Accidents</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#F97316;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Quasi-accidents</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#EAB308;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Situations dangereuses</span></div>'
    + (noData ? '<span style="font-size:10px;color:#475569;margin-left:auto;font-style:italic">Aucun événement sur la période 🟢</span>' : '')
    + '</div>'
    + '</div>';
}

function _incChartBtn(val, label, current, kind) {
  var active = current === val;
  var cb = kind === 'type'
    ? '_incidentChartType=\'' + val + '\';_refreshIncChart()'
    : '_incidentPeriod=\'' + val + '\';_refreshIncChart()';
  return '<button onclick="' + cb + '" style="padding:6px 12px;font-size:11px;font-weight:700;border:none;cursor:pointer;'
    + 'font-family:\'Barlow\',sans-serif;background:' + (active ? 'rgba(239,68,68,.2)' : 'transparent') + ';'
    + 'color:' + (active ? '#EF4444' : '#64748B') + ';transition:.2s">' + label + '</button>';
}

function _incStrip(icon, val, label, color, idx) {
  return '<div style="padding:14px 12px;text-align:center;' + (idx < 2 ? 'border-right:1px solid rgba(255,255,255,.06);' : '') + '">'
    + '<div style="font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#475569;margin-bottom:4px">' + icon + ' ' + label + '</div>'
    + '<div style="font-size:22px;font-weight:900;color:' + color + ';letter-spacing:-.5px;line-height:1">' + val + '</div>'
    + '</div>';
}

function _refreshIncChart() {
  renderIncidents(currentProfile ? currentProfile.role : 'hse');
}

function _drawIncidentCanvas() {
  var D = window._incChartData;
  if (!D) return;
  var canvas = document.getElementById('incidentChartCanvas');
  if (!canvas) return;
  var W = canvas.offsetWidth;
  if (!W) { setTimeout(_drawIncidentCanvas, 50); return; }

  var dpr = window.devicePixelRatio || 1;
  var H   = 180;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var pad  = { l: 32, r: 12, t: 16, b: 36 };
  var gw   = W - pad.l - pad.r;
  var gh   = H - pad.t - pad.b;
  var n    = D.n;
  var maxY = Math.max(D.maxVal, 1);
  var stepY = maxY <= 5 ? 1 : maxY <= 10 ? 2 : maxY <= 20 ? 5 : Math.ceil(maxY / 5);

  function vX(i) { return pad.l + (n <= 1 ? gw / 2 : i / (n - 1) * gw); }
  function vY(v) { return pad.t + gh * (1 - v / maxY); }

  // Grille
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
  for (var yv = 0; yv <= maxY; yv += stepY) {
    var y = vY(yv);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + gw, y); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(yv, pad.l - 5, y + 3);
  }

  // Labels X
  var skip = n <= 7 ? 1 : n <= 14 ? 2 : Math.ceil(n / 10);
  D.labels.forEach(function(lbl, i) {
    if (i % skip !== 0 && i !== n - 1) return;
    var x = D.type === 'bar' ? pad.l + (i + 0.5) * gw / n : vX(i);
    ctx.fillStyle = '#475569'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(lbl, x, H - 6);
  });

  var series = [
    { data: D.incidents, color: '#EF4444', alpha: 'rgba(239,68,68,' },
    { data: D.quasis,    color: '#F97316', alpha: 'rgba(249,115,22,' },
    { data: D.dangs,     color: '#EAB308', alpha: 'rgba(234,179,8,' }
  ];

  if (D.type === 'bar') {
    var gW  = gw / n;
    var bw  = gW * 0.27;
    var off = [-bw - 1, 0, bw + 1];
    series.forEach(function(s, si) {
      s.data.forEach(function(v, i) {
        if (v === 0) return;
        var cx = pad.l + (i + 0.5) * gW;
        var x  = cx + off[si] - bw / 2;
        var yt = vY(v);
        var bh = gh - (yt - pad.t);
        var gr = ctx.createLinearGradient(x, pad.t, x, pad.t + gh);
        gr.addColorStop(0, s.alpha + '.9)');
        gr.addColorStop(1, s.alpha + '.1)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, yt, bw, bh, 2); else ctx.rect(x, yt, bw, bh);
        ctx.fill();
      });
    });
  } else {
    series.forEach(function(s) {
      // Zone fill
      ctx.beginPath();
      s.data.forEach(function(v, i) { i === 0 ? ctx.moveTo(vX(i), vY(v)) : ctx.lineTo(vX(i), vY(v)); });
      ctx.lineTo(vX(n - 1), pad.t + gh); ctx.lineTo(vX(0), pad.t + gh); ctx.closePath();
      ctx.fillStyle = s.alpha + '0.08)'; ctx.fill();
      // Ligne
      ctx.beginPath();
      s.data.forEach(function(v, i) { i === 0 ? ctx.moveTo(vX(i), vY(v)) : ctx.lineTo(vX(i), vY(v)); });
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
      // Points
      s.data.forEach(function(v, i) {
        if (v === 0) return;
        ctx.beginPath(); ctx.arc(vX(i), vY(v), 3, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.fill();
        ctx.strokeStyle = '#0D1B2A'; ctx.lineWidth = 1.5; ctx.stroke();
      });
    });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  LISTE DES INCIDENTS
// ════════════════════════════════════════════════════════════════════════════

function renderIncidentList(role) {
  if (_incidents.length === 0) {
    return '<div class="empty-state" style="margin-top:32px">'
      + '<div class="empty-state-icon">🟢</div>'
      + '<div class="empty-state-text">Aucun incident enregistré</div>'
      + '<div class="empty-state-sub">Déclarez un incident ou quasi-accident pour démarrer le suivi</div>'
      + '</div>';
  }

  var html = '<div class="section-card" style="padding:0;overflow:hidden">';

  // Filtres rapides
  html += '<div style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.06);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
  html += '<span style="font-size:11px;color:var(--muted);font-weight:600">Filtrer :</span>';
  ['all'].concat(INCIDENT_STATUS.map(function(s){ return s.id; })).forEach(function(sid) {
    var s      = sid === 'all' ? { id:'all', label:'Tous', color:'var(--muted)' } : INCIDENT_STATUS.find(function(x){ return x.id === sid; });
    var count  = sid === 'all' ? _incidents.length : _incidents.filter(function(i){ return i.status === sid; }).length;
    html += '<span onclick="_filterInc(\'' + sid + '\',\'' + role + '\')" style="cursor:pointer;padding:4px 11px;border-radius:20px;'
      + 'font-size:11px;font-weight:700;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:' + s.color + '">'
      + s.label + ' <span style="opacity:.6">(' + count + ')</span></span>';
  });
  html += '</div>';

  // Tableau
  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead>'
    + '<tr style="border-bottom:1px solid rgba(255,255,255,.06)">';
  ['Date', 'Type', 'Titre', 'Zone', 'Gravité', 'Statut', 'Actions', ''].forEach(function(h) {
    html += '<th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';

  _incidents.forEach(function(inc, idx) {
    var T  = INCIDENT_TYPES.find(function(t){ return t.id === inc.type; })    || INCIDENT_TYPES[0];
    var G  = INCIDENT_GRAVITY.find(function(g){ return g.id === inc.gravity; }) || INCIDENT_GRAVITY[0];
    var S  = INCIDENT_STATUS.find(function(s){ return s.id === inc.status; })  || INCIDENT_STATUS[0];
    var aAll = _incidentActions.filter(function(a){ return a.incident_id === inc.id; }).length;
    var aOpen= _incidentActions.filter(function(a){ return a.incident_id === inc.id && a.status !== 'terminee'; }).length;
    var date = new Date(inc.occurred_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    var bg   = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)';

    html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04);background:' + bg + ';cursor:pointer;transition:.15s" '
      + 'onmouseover="this.style.background=\'rgba(239,68,68,.04)\'" onmouseout="this.style.background=\'' + bg + '\'" '
      + 'onclick="_viewInc(\'' + inc.id + '\',\'' + role + '\')">'
      + '<td style="padding:12px 16px;white-space:nowrap;color:var(--muted);font-size:12px">' + date + '</td>'
      + '<td style="padding:12px 16px"><span style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;'
      + 'background:' + T.color + '20;border-radius:6px;font-size:11px;font-weight:700;color:' + T.color + '">' + T.icon + ' ' + T.label + '</span></td>'
      + '<td style="padding:12px 16px;font-weight:600;color:var(--text);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _esc(inc.title) + '</td>'
      + '<td style="padding:12px 16px;color:var(--muted);font-size:12px">' + _esc(inc.location || '—') + '</td>'
      + '<td style="padding:12px 16px"><span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:' + G.color + '20;color:' + G.color + '">' + G.label + '</span></td>'
      + '<td style="padding:12px 16px"><span style="padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700;background:' + S.color + '20;color:' + S.color + '">' + S.label + '</span></td>'
      + '<td style="padding:12px 16px;font-size:12px;color:' + (aOpen > 0 ? '#60A5FA' : 'var(--muted)') + '">'
      + aAll + ' action(s)' + (aOpen > 0 ? ' · <strong>' + aOpen + ' ouverte(s)</strong>' : '') + '</td>'
      + '<td style="padding:12px 16px;text-align:right">'
      + '<button onclick="event.stopPropagation();_editInc(\'' + inc.id + '\',\'' + role + '\')" '
      + 'style="padding:5px 10px;font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:var(--muted);cursor:pointer">✏️</button>'
      + '</td>'
      + '</tr>';
  });

  html += '</tbody></table></div></div>';
  return html;
}

function _filterInc(status, role) {
  var all = _incidents.slice();
  if (status !== 'all') _incidents = all.filter(function(i){ return i.status === status; });
  renderIncidents(role);
  _incidents = all;
}

// ════════════════════════════════════════════════════════════════════════════
//  FORMULAIRE DE SAISIE
// ════════════════════════════════════════════════════════════════════════════

function renderIncidentForm(role) {
  var inc    = _incidentEditId ? _incidents.find(function(i){ return i.id === _incidentEditId; }) : null;
  var nowStr = new Date().toISOString().slice(0, 16);

  var html = '<div style="max-width:740px;margin:0 auto">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">'
    + '<button onclick="_incidentView=\'liste\';renderIncidents(\'' + role + '\')" '
    + 'style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:var(--muted);cursor:pointer;font-size:13px">← Retour</button>'
    + '<div>'
    + '<div style="font-size:20px;font-weight:900;color:var(--text)">' + (inc ? 'Modifier l\'incident' : 'Déclarer un incident') + '</div>'
    + '<div style="font-size:12px;color:var(--muted)">' + (inc ? 'Ref. ' + inc.id.slice(0, 8).toUpperCase() : 'Nouveau signalement') + '</div>'
    + '</div></div>'
    + '<div class="section-card" style="padding:28px">';

  // Type événement
  html += '<div style="margin-bottom:22px"><label class="form-label">Type d\'événement *</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:8px;margin-top:8px">';
  INCIDENT_TYPES.forEach(function(t) {
    var sel = inc ? inc.type === t.id : false;
    html += '<label id="incTypeLabel_' + t.id + '" onclick="_pickIncType(this,\'' + t.id + '\',\'' + t.color + '\')" style="cursor:pointer;padding:10px 12px;border-radius:10px;'
      + 'border:2px solid ' + (sel ? t.color : 'rgba(255,255,255,.08)') + ';'
      + 'background:' + (sel ? t.color + '18' : 'rgba(255,255,255,.02)') + ';'
      + 'display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:var(--text);transition:.2s">'
      + '<input type="radio" name="inc_type" value="' + t.id + '"' + (sel ? ' checked' : '') + ' style="display:none">'
      + '<span style="font-size:16px">' + t.icon + '</span><span>' + t.label + '</span></label>';
  });
  html += '</div></div>';

  // Gravité
  html += '<div style="margin-bottom:22px"><label class="form-label">Gravité *</label>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">';
  INCIDENT_GRAVITY.forEach(function(g) {
    var sel = inc ? inc.gravity === g.id : g.id === '1';
    html += '<label id="incGravLabel_' + g.id + '" onclick="_pickIncGrav(this,\'' + g.id + '\',\'' + g.color + '\')" style="cursor:pointer;padding:8px 18px;border-radius:20px;'
      + 'border:2px solid ' + (sel ? g.color : 'rgba(255,255,255,.1)') + ';'
      + 'background:' + (sel ? g.color + '20' : 'transparent') + ';'
      + 'font-size:12px;font-weight:700;color:' + g.color + ';transition:.2s">'
      + '<input type="radio" name="inc_gravity" value="' + g.id + '"' + (sel ? ' checked' : '') + ' style="display:none">'
      + g.label + '</label>';
  });
  html += '</div></div>';

  // Titre + date
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">'
    + '<div><label class="form-label">Intitulé *</label>'
    + '<input type="text" id="incTitle" class="form-input" placeholder="Ex : Chute en zone A" value="' + _esc(inc ? inc.title : '') + '" style="margin-top:6px"></div>'
    + '<div><label class="form-label">Date & heure *</label>'
    + '<input type="datetime-local" id="incDate" class="form-input" value="' + (inc ? inc.occurred_at.slice(0,16) : nowStr) + '" style="margin-top:6px"></div>'
    + '</div>';

  // Zone, victimes, arrêt
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px">'
    + '<div><label class="form-label">Localisation / Zone</label>'
    + '<input type="text" id="incLocation" class="form-input" placeholder="Ex : Atelier B" value="' + _esc(inc ? inc.location || '' : '') + '" style="margin-top:6px"></div>'
    + '<div><label class="form-label">Nb de victimes</label>'
    + '<input type="number" id="incVictims" class="form-input" min="0" value="' + (inc ? inc.victims_count || 0 : 0) + '" style="margin-top:6px"></div>'
    + '<div><label class="form-label">Arrêt de travail</label>'
    + '<div style="margin-top:10px;display:flex;align-items:center;gap:10px">'
    + '<label style="cursor:pointer;display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text)">'
    + '<input type="checkbox" id="incStoppage"' + (inc && inc.work_stoppage ? ' checked' : '')
    + ' onchange="var d=document.getElementById(\'incStopDays\');d.style.display=this.checked?\'block\':\'none\'"> Oui</label>'
    + '<input type="number" id="incStopDays" class="form-input" min="1" placeholder="jours" value="' + (inc ? inc.stoppage_days || '' : '') + '" '
    + 'style="margin-top:0;width:80px;' + (inc && inc.work_stoppage ? '' : 'display:none') + '"></div></div>'
    + '</div>';

  // Description
  html += '<div style="margin-bottom:20px"><label class="form-label">Description détaillée</label>'
    + '<textarea id="incDesc" class="form-input" rows="4" placeholder="Circonstances de l\'événement..." style="margin-top:6px;resize:vertical">' + _esc(inc ? inc.description || '' : '') + '</textarea></div>';

  // Cause + action immédiate
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">'
    + '<div><label class="form-label">Cause racine</label>'
    + '<textarea id="incCause" class="form-input" rows="3" placeholder="Cause principale..." style="margin-top:6px;resize:vertical">' + _esc(inc ? inc.root_cause || '' : '') + '</textarea></div>'
    + '<div><label class="form-label">Action immédiate</label>'
    + '<textarea id="incImmediate" class="form-input" rows="3" placeholder="Mesure conservatoire..." style="margin-top:6px;resize:vertical">' + _esc(inc ? inc.immediate_action || '' : '') + '</textarea></div>'
    + '</div>';

  // Statut (édition)
  if (inc) {
    html += '<div style="margin-bottom:20px"><label class="form-label">Statut</label>'
      + '<select id="incStatus" class="form-input" style="margin-top:6px">';
    INCIDENT_STATUS.forEach(function(s) {
      html += '<option value="' + s.id + '"' + (inc.status === s.id ? ' selected' : '') + '>' + s.label + '</option>';
    });
    html += '</select></div>';
  }

  html += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px">'
    + '<button onclick="_incidentView=\'liste\';renderIncidents(\'' + role + '\')" '
    + 'style="padding:10px 20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--muted);cursor:pointer;font-size:13px;font-weight:600">Annuler</button>'
    + '<button onclick="_saveIncident(\'' + role + '\')" class="btn-primary" style="padding:10px 24px;font-size:13px;font-weight:700">'
    + (inc ? '💾 Enregistrer' : '📋 Déclarer l\'incident') + '</button>'
    + '</div></div></div>';

  return html;
}

function _pickIncType(el, id, color) {
  document.querySelectorAll('[name="inc_type"]').forEach(function(r) {
    var l = r.closest('label');
    l.style.borderColor = 'rgba(255,255,255,.08)';
    l.style.background  = 'rgba(255,255,255,.02)';
    r.checked = false;
  });
  el.style.borderColor = color;
  el.style.background  = color + '18';
  el.querySelector('input').checked = true;
}

function _pickIncGrav(el, id, color) {
  document.querySelectorAll('[name="inc_gravity"]').forEach(function(r) {
    var l = r.closest('label');
    l.style.borderColor = 'rgba(255,255,255,.1)';
    l.style.background  = 'transparent';
    r.checked = false;
  });
  el.style.borderColor = color;
  el.style.background  = color + '20';
  el.querySelector('input').checked = true;
}

// ════════════════════════════════════════════════════════════════════════════
//  SAUVEGARDE
// ════════════════════════════════════════════════════════════════════════════

async function _saveIncident(role) {
  var typeEl    = document.querySelector('[name="inc_type"]:checked');
  var gravityEl = document.querySelector('[name="inc_gravity"]:checked');
  var titleEl   = document.getElementById('incTitle');
  var dateEl    = document.getElementById('incDate');

  if (!typeEl || !gravityEl || !titleEl || !titleEl.value.trim() || !dateEl || !dateEl.value) {
    showToast('Champs obligatoires : type, gravité, titre, date', 'error'); return;
  }

  var payload = {
    org_id          : currentProfile.org_id,
    created_by      : currentProfile.id,
    type            : typeEl.value,
    gravity         : gravityEl.value,
    title           : titleEl.value.trim(),
    occurred_at     : dateEl.value,
    location        : (document.getElementById('incLocation')?.value  || '').trim() || null,
    victims_count   : parseInt(document.getElementById('incVictims')?.value  || '0', 10),
    work_stoppage   : !!(document.getElementById('incStoppage')?.checked),
    stoppage_days   : parseInt(document.getElementById('incStopDays')?.value || '0', 10),
    description     : (document.getElementById('incDesc')?.value       || '').trim() || null,
    root_cause      : (document.getElementById('incCause')?.value      || '').trim() || null,
    immediate_action: (document.getElementById('incImmediate')?.value  || '').trim() || null
  };

  var res;
  if (_incidentEditId) {
    payload.status     = document.getElementById('incStatus')?.value || 'ouvert';
    payload.updated_at = new Date().toISOString();
    if (payload.status === 'cloture') payload.closed_at = new Date().toISOString();
    res = await sb.from('incidents').update(payload).eq('id', _incidentEditId);
    if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
    showToast('✅ Incident mis à jour', 'success');
  } else {
    payload.status = 'ouvert';
    res = await sb.from('incidents').insert(payload);
    if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
    showToast('✅ Incident déclaré', 'success');
  }

  _incidentView = 'liste'; _incidentEditId = null;
  loadIncidents(role);
}

// ════════════════════════════════════════════════════════════════════════════
//  VUE DÉTAIL
// ════════════════════════════════════════════════════════════════════════════

function renderIncidentDetail(inc, role) {
  var T = INCIDENT_TYPES.find(function(t){ return t.id === inc.type; })    || INCIDENT_TYPES[0];
  var G = INCIDENT_GRAVITY.find(function(g){ return g.id === inc.gravity; }) || INCIDENT_GRAVITY[0];
  var S = INCIDENT_STATUS.find(function(s){ return s.id === inc.status; })  || INCIDENT_STATUS[0];
  var actions = _incidentActions.filter(function(a){ return a.incident_id === inc.id; });
  var dateStr = new Date(inc.occurred_at).toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  var html = '<div style="max-width:740px;margin:0 auto">'
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap">'
    + '<button onclick="_incidentView=\'liste\';renderIncidents(\'' + role + '\')" '
    + 'style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:var(--muted);cursor:pointer;font-size:13px">← Retour</button>'
    + '<div style="flex:1">'
    + '<div style="font-size:18px;font-weight:900;color:var(--text)">' + T.icon + ' ' + _esc(inc.title) + '</div>'
    + '<div style="font-size:12px;color:var(--muted)">' + dateStr + '</div>'
    + '</div>'
    + '<span style="padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:' + S.color + '20;color:' + S.color + '">' + S.label + '</span>'
    + '<button onclick="_editInc(\'' + inc.id + '\',\'' + role + '\')" '
    + 'style="padding:8px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:var(--muted);cursor:pointer;font-size:13px">✏️ Modifier</button>'
    + '</div>';

  // Fiche synthèse
  html += '<div class="section-card" style="padding:24px;margin-bottom:16px">'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">'
    + _df('Type',      '<span style="color:' + T.color + ';font-weight:700">' + T.icon + ' ' + T.label + '</span>')
    + _df('Gravité',   '<span style="color:' + G.color + ';font-weight:700">' + G.label + '</span>')
    + _df('Zone',      _esc(inc.location || '—'))
    + _df('Victimes',  (inc.victims_count || 0) + ' personne(s)')
    + (inc.work_stoppage ? _df('Arrêt de travail', '✅ ' + (inc.stoppage_days || 0) + ' jour(s)') : '')
    + '</div>';

  if (inc.description)      html += _dblock('Description',   inc.description);
  if (inc.root_cause)       html += _dblock('Cause racine',  inc.root_cause);
  if (inc.immediate_action) html += _dblock('Action immédiate', inc.immediate_action);
  html += '</div>';

  // Actions correctives
  html += '<div class="section-card" style="padding:24px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'
    + '<div style="font-weight:700;font-size:15px;color:var(--text)">🔧 Actions correctives (' + actions.length + ')</div>'
    + '<button onclick="_addIncidentAction(\'' + inc.id + '\',\'' + role + '\')" '
    + 'style="padding:7px 14px;background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.3);'
    + 'border-radius:8px;color:#60A5FA;cursor:pointer;font-size:12px;font-weight:700">+ Ajouter</button>'
    + '</div>';

  if (actions.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Aucune action corrective définie</div>';
  } else {
    actions.forEach(function(a) {
      var aS = a.status === 'terminee' ? { color:'#4ADE80', label:'Terminée' }
             : a.status === 'en_cours' ? { color:'#60A5FA', label:'En cours' }
             : { color:'#F97316', label:'Ouverte' };
      var due     = a.due_date ? new Date(a.due_date).toLocaleDateString('fr-FR') : '—';
      var overdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'terminee';
      html += '<div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<div style="flex:1">'
        + '<div style="font-size:13px;font-weight:600;color:var(--text)">' + _esc(a.title) + '</div>'
        + '<div style="font-size:11px;color:var(--muted);margin-top:2px">Échéance : <span style="color:' + (overdue ? '#EF4444' : 'var(--muted)') + '">' + due + (overdue ? ' ⚠️' : '') + '</span></div>'
        + '</div>'
        + '<span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + aS.color + '20;color:' + aS.color + '">' + aS.label + '</span>'
        + (a.status !== 'terminee'
          ? '<button onclick="_closeIncidentAction(\'' + a.id + '\',\'' + inc.id + '\',\'' + role + '\')" '
            + 'style="padding:5px 10px;font-size:11px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.3);border-radius:6px;color:#4ADE80;cursor:pointer">✓ Clore</button>'
          : '')
        + '</div>';
    });
  }

  html += '</div></div>';
  return html;
}

function _df(label, val) {
  return '<div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:4px">' + label + '</div>'
    + '<div style="font-size:13px;color:var(--text);font-weight:500">' + val + '</div></div>';
}

function _dblock(label, val) {
  return '<div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,.06)">'
    + '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px">' + label + '</div>'
    + '<div style="font-size:13px;color:var(--text);line-height:1.6">' + _esc(val) + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ACTIONS CORRECTIVES
// ════════════════════════════════════════════════════════════════════════════

async function _addIncidentAction(incidentId, role) {
  var title = prompt("Titre de l'action corrective :");
  if (!title || !title.trim()) return;
  var due = prompt('Date d\'échéance (AAAA-MM-JJ, laisser vide si inconnue) :') || null;
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) due = null;

  var res = await sb.from('incident_actions').insert({
    incident_id : incidentId,
    org_id      : currentProfile.org_id,
    title       : title.trim(),
    due_date    : due,
    status      : 'ouverte'
  });

  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showToast('✅ Action ajoutée', 'success');
  _incidentView = 'detail'; _incidentEditId = incidentId;
  loadIncidents(role);
}

async function _closeIncidentAction(actionId, incidentId, role) {
  var res = await sb.from('incident_actions').update({
    status    : 'terminee',
    closed_at : new Date().toISOString()
  }).eq('id', actionId);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showToast('✅ Action clôturée', 'success');
  _incidentView = 'detail'; _incidentEditId = incidentId;
  loadIncidents(role);
}

// Navigation
function _viewInc(id, role)  { _incidentView = 'detail'; _incidentEditId = id; renderIncidents(role); }
function _editInc(id, role)  { _incidentView = 'saisie'; _incidentEditId = id; renderIncidents(role); }

// Module désactivé
function renderIncidentsDisabled(role) {
  var el = document.getElementById((role === 'hse' ? 'HSE' : 'Company') + '-incidents-content');
  if (el) el.innerHTML = '<div class="empty-state" style="margin-top:60px">'
    + '<div class="empty-state-icon">🔒</div>'
    + '<div class="empty-state-text">Module Incidents non activé</div>'
    + '<div class="empty-state-sub">Contactez votre administrateur pour activer ce module.</div>'
    + '</div>';
}

// Utilitaire escape HTML
function _esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════════════════
//  EXPORT CSV
// ════════════════════════════════════════════════════════════════════════════

function _exportIncidentsCSV() {
  if (!_incidents.length) { showToast('Aucun incident à exporter', 'error'); return; }

  var cols = ['Date événement','Type','Gravité','Titre','Zone','Victimes','Arrêt travail','Jours arrêt','Statut','Description','Cause racine','Action immédiate','Date déclaration'];
  var rows = _incidents.map(function(i) {
    var T = INCIDENT_TYPES.find(function(t){ return t.id === i.type; });
    var G = INCIDENT_GRAVITY.find(function(g){ return g.id === i.gravity; });
    var S = INCIDENT_STATUS.find(function(s){ return s.id === i.status; });
    return [
      new Date(i.occurred_at).toLocaleDateString('fr-FR'),
      T ? T.label : i.type,
      G ? G.label : i.gravity,
      i.title, i.location || '', i.victims_count || 0,
      i.work_stoppage ? 'Oui' : 'Non', i.stoppage_days || 0,
      S ? S.label : i.status,
      (i.description     || '').replace(/\n/g,' '),
      (i.root_cause      || '').replace(/\n/g,' '),
      (i.immediate_action|| '').replace(/\n/g,' '),
      new Date(i.reported_at || i.created_at).toLocaleDateString('fr-FR')
    ].map(function(v) {
      var s = String(v);
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
    });
  });

  var csv  = [cols].concat(rows).map(function(r){ return r.join(','); }).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'incidents_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('📥 Export CSV téléchargé', 'success');
}

// ════════════════════════════════════════════════════════════════════════════
//  BOOT
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  var _t = setInterval(function() {
    if (typeof currentProfile !== 'undefined' && currentProfile && typeof sb !== 'undefined') {
      clearInterval(_t);
      checkIncidentsActivation();
    }
  }, 300);
});
