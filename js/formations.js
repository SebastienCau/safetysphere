// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE FORMATIONS v1.0
//  Gestion des formations & habilitations
// ════════════════════════════════════════════════════════════════════════════
//
//  PATTERN : identique à incidents.js
//  TABLES   : formations, formation_participants
//  ROLES    : hse (gestion complète), company (gestion complète), worker (lecture)
//  ACTIVATION : org_modules { module_id: 'formations' }
//
//  ORDRE DE CHARGEMENT :
//  ... -> analytics_charts -> chart -> incidents -> formations -> gate
//
// ════════════════════════════════════════════════════════════════════════════

// ── État ─────────────────────────────────────────────────────────────────────
var _formations        = [];
var _formParticipants  = [];
var _formView          = 'liste';
var _formEditId        = null;
var _formPeriod        = '90';

// ── Constantes ────────────────────────────────────────────────────────────────
var FORM_TYPES = [
  { id: 'habilitation',    label: 'Habilitation électrique', icon: '⚡', color: '#F59E0B' },
  { id: 'caces',           label: 'CACES',                   icon: '🚜', color: '#60A5FA' },
  { id: 'sst',             label: 'SST / Secourisme',        icon: '🩺', color: '#34D399' },
  { id: 'incendie',        label: 'Lutte incendie',          icon: '🔥', color: '#F97316' },
  { id: 'travail_hauteur', label: 'Travail en hauteur',      icon: '🪜', color: '#A78BFA' },
  { id: 'chimique',        label: 'Risque chimique',         icon: '⚗️', color: '#F87171' },
  { id: 'autre',           label: 'Autre formation',         icon: '📚', color: '#94A3B8' }
];

var FORM_STATUS = [
  { id: 'planifiee', label: 'Planifiée',  color: '#60A5FA' },
  { id: 'en_cours',  label: 'En cours',   color: '#F59E0B' },
  { id: 'realisee',  label: 'Réalisée',   color: '#4ADE80' },
  { id: 'annulee',   label: 'Annulée',    color: '#64748B' }
];

var FORM_RESULTS = [
  { id: 'en_attente', label: 'En attente', color: '#F59E0B' },
  { id: 'obtenu',     label: 'Obtenu',     color: '#4ADE80' },
  { id: 'recale',     label: 'Recalé',     color: '#EF4444' }
];

// ── Activation ────────────────────────────────────────────────────────────────
async function checkFormationsActivation() {
  if (!currentProfile || !currentProfile.org_id) return false;
  var res = await sb.from('org_modules')
    .select('enabled')
    .eq('org_id', currentProfile.org_id)
    .eq('module_id', 'formations')
    .maybeSingle();
  var enabled = res.data ? res.data.enabled : false;
  updateFormationsTabVisibility(enabled);
  return enabled;
}

function updateFormationsTabVisibility(visible) {
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var oc = tab.getAttribute('onclick') || '';
    if (oc.includes("'formations'") || oc.includes('"formations"')) {
      tab.style.display = '';
      var dot = tab.querySelector('.form-status-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'form-status-dot';
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle;flex-shrink:0';
        tab.appendChild(dot);
      }
      dot.style.background = visible ? '#34D399' : '#475569';
      dot.title = visible ? 'Module actif' : 'Module inactif';
    }
  });
}

// ── Chargement ────────────────────────────────────────────────────────────────
async function loadFormations(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-formations-content');
  if (!container) return;

  if (!currentProfile || !currentProfile.org_id) {
    container.innerHTML = _formEmptyState('⚠️', 'Profil non chargé');
    return;
  }

  container.innerHTML = _formEmptyState('⏳', 'Chargement…');

  try {
    var orgId = currentProfile.org_id;

    var fRes = await sb.from('formations')
      .select('*, formation_participants(id, status, result)')
      .eq('org_id', orgId)
      .order('date_debut', { ascending: false });
    if (fRes.error) throw fRes.error;
    _formations = fRes.data || [];

    var ids = _formations.map(function(f) { return f.id; });
    if (ids.length > 0) {
      var pRes = await sb.from('formation_participants')
        .select('*')
        .in('formation_id', ids);
      _formParticipants = pRes.data || [];
    } else {
      _formParticipants = [];
    }

    renderFormations(role);
  } catch(e) {
    container.innerHTML = _formEmptyState('⚠️', 'Erreur : ' + (e.message || e));
  }
}

// ── Rendu principal ───────────────────────────────────────────────────────────
function renderFormations(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-formations-content');
  if (!container) return;

  if (_formView === 'saisie') {
    container.innerHTML = renderFormationForm(role);
    return;
  }
  if (_formView === 'detail' && _formEditId) {
    var f = _formations.find(function(x) { return x.id === _formEditId; });
    if (f) { container.innerHTML = renderFormationDetail(f, role); return; }
  }

  container.innerHTML = _renderFormHeader(role)
    + _renderFormKPI()
    + _renderFormChart()
    + _renderFormList(role);

  setTimeout(function() { _drawFormCanvas(); }, 0);
}

// ── En-tête ───────────────────────────────────────────────────────────────────
function _renderFormHeader(role) {
  var expiresSoon = _formations.filter(function(f) {
    if (!f.date_expiration || f.status === 'annulee') return false;
    var diff = (new Date(f.date_expiration) - new Date()) / 86400000;
    return diff >= 0 && diff <= 60;
  }).length;

  return '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
    + '<div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">'
    + '<div style="width:3px;height:22px;background:linear-gradient(180deg,#34D399,#60A5FA);border-radius:2px"></div>'
    + '<span style="font-size:22px;font-weight:900;color:var(--text)">Formations & Habilitations</span>'
    + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-left:13px">'
    + _formations.length + ' formation(s)'
    + (expiresSoon ? ' · <span style="color:#F59E0B;font-weight:700">⚠️ ' + expiresSoon + ' expirent dans 60j</span>' : '')
    + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<button onclick="_formView=\'saisie\';_formEditId=null;renderFormations(\'' + role + '\')" '
    + 'class="btn-primary" style="padding:9px 18px;font-size:13px;font-weight:700">+ Nouvelle formation</button>'
    + '<button onclick="_exportFormationsCSV()" '
    + 'style="padding:9px 16px;font-size:12px;font-weight:600;background:rgba(255,255,255,.06);'
    + 'border:1px solid rgba(255,255,255,.12);border-radius:10px;color:var(--muted);cursor:pointer">📥 Export CSV</button>'
    + '</div></div>';
}

// ── KPI ───────────────────────────────────────────────────────────────────────
function _renderFormKPI() {
  var total     = _formations.length;
  var planif    = _formations.filter(function(f) { return f.status === 'planifiee'; }).length;
  var realisees = _formations.filter(function(f) { return f.status === 'realisee'; }).length;
  var expires   = _formations.filter(function(f) {
    if (!f.date_expiration) return false;
    var diff = (new Date(f.date_expiration) - new Date()) / 86400000;
    return diff >= 0 && diff <= 60;
  }).length;
  var nbPart  = _formParticipants.length;
  var obtenus = _formParticipants.filter(function(p) { return p.result === 'obtenu'; }).length;
  var taux    = nbPart > 0 ? Math.round(obtenus / nbPart * 100) : 0;

  var kpis = [
    { icon: '📚', val: total,      label: 'Total formations',   color: '#60A5FA' },
    { icon: '📅', val: planif,     label: 'Planifiées',         color: '#F59E0B' },
    { icon: '✅', val: realisees,  label: 'Réalisées',          color: '#4ADE80' },
    { icon: '⚠️', val: expires,    label: 'Expirent < 60j',     color: '#F97316' },
    { icon: '👥', val: nbPart,     label: 'Participants',        color: '#A78BFA' },
    { icon: '🎯', val: taux + '%', label: 'Taux de réussite',   color: '#34D399' }
  ];

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:24px">';
  kpis.forEach(function(k) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);'
      + 'border-left:3px solid ' + k.color + ';border-radius:12px;padding:14px 16px">'
      + '<div style="font-size:20px;margin-bottom:4px">' + k.icon + '</div>'
      + '<div style="font-size:24px;font-weight:900;color:' + k.color + ';letter-spacing:-.5px">' + k.val + '</div>'
      + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-top:2px">' + k.label + '</div>'
      + '</div>';
  });
  return html + '</div>';
}

// ── Graphe ────────────────────────────────────────────────────────────────────
function _renderFormChart() {
  var btns = ['30', '60', '90', '180'].map(function(v) {
    var active = _formPeriod === v;
    return '<button onclick="_formPeriod=\'' + v + '\';_drawFormCanvas()" '
      + 'style="padding:4px 10px;font-size:11px;font-weight:700;border-radius:6px;cursor:pointer;border:1px solid;'
      + (active
        ? 'background:rgba(52,211,153,.2);border-color:rgba(52,211,153,.4);color:#34D399'
        : 'background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:var(--muted)')
      + '">' + v + 'j</button>';
  }).join('');

  return '<div style="background:linear-gradient(135deg,rgba(13,27,42,.95),rgba(15,23,42,.98));'
    + 'border:1px solid rgba(52,211,153,.15);border-radius:20px;overflow:hidden;margin-bottom:24px">'
    + '<div style="padding:18px 22px 10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">'
    + '<div>'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">'
    + '<div style="width:3px;height:18px;background:linear-gradient(180deg,#34D399,#60A5FA);border-radius:2px"></div>'
    + '<span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#34D399">Tendance</span>'
    + '</div>'
    + '<div style="font-size:17px;font-weight:900;color:#fff">Formations sur la période</div>'
    + '</div>'
    + '<div style="display:flex;gap:6px">' + btns + '</div>'
    + '</div>'
    + '<div style="padding:0 22px 8px"><canvas id="formChart" height="140" style="width:100%;height:140px;display:block"></canvas></div>'
    + '<div style="padding:0 22px 16px;display:flex;gap:16px">'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:#34D399"></div><span style="font-size:10px;color:#64748B">Réalisées</span></div>'
    + '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;border-radius:2px;background:#60A5FA"></div><span style="font-size:10px;color:#64748B">Planifiées</span></div>'
    + '</div></div>';
}

function _drawFormCanvas() {
  var canvas = document.getElementById('formChart');
  if (!canvas || canvas.offsetWidth === 0) { setTimeout(_drawFormCanvas, 60); return; }

  var days = parseInt(_formPeriod, 10);
  var now  = new Date();
  var step = days <= 30 ? 1 : days <= 90 ? 7 : 14;
  var buckets = [];
  for (var i = days; i >= 0; i -= step) {
    var d = new Date(now); d.setDate(d.getDate() - i);
    buckets.push({
      date: d,
      label: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
      realise: 0, planifie: 0
    });
  }

  _formations.forEach(function(f) {
    var fd = new Date(f.date_debut);
    var cutoff = new Date(now); cutoff.setDate(cutoff.getDate() - days);
    if (fd < cutoff) return;
    var best = null, bestDiff = Infinity;
    buckets.forEach(function(b) {
      var diff = Math.abs(fd - b.date);
      if (diff < bestDiff) { bestDiff = diff; best = b; }
    });
    if (!best) return;
    if (f.status === 'realisee') best.realise++;
    else if (f.status === 'planifiee' || f.status === 'en_cours') best.planifie++;
  });

  var maxVal = Math.max.apply(null, buckets.map(function(b) { return b.realise + b.planifie; }).concat([1]));
  var dpr = window.devicePixelRatio || 1;
  var W = canvas.offsetWidth, H = 140;
  canvas.width = W * dpr; canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var pad = { l: 28, r: 8, t: 12, b: 28 };
  var gw = W - pad.l - pad.r;
  var gh = H - pad.t - pad.b;
  var n  = buckets.length;
  var bw = Math.max(4, gw / n * 0.55);

  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
  for (var yi = 0; yi <= maxVal; yi += Math.max(1, Math.ceil(maxVal / 4))) {
    var yy = pad.t + gh * (1 - yi / maxVal);
    ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(pad.l + gw, yy); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(yi, pad.l - 4, yy + 3);
  }

  buckets.forEach(function(b, i) {
    var x = pad.l + i * gw / n + (gw / n - bw) / 2;
    if (b.realise > 0) {
      var yr = pad.t + gh * (1 - b.realise / maxVal);
      var g1 = ctx.createLinearGradient(0, pad.t, 0, pad.t + gh);
      g1.addColorStop(0, 'rgba(52,211,153,.9)'); g1.addColorStop(1, 'rgba(52,211,153,.1)');
      ctx.fillStyle = g1;
      ctx.beginPath(); ctx.roundRect(x, yr, bw / 2 - 1, gh - (yr - pad.t), 2); ctx.fill();
    }
    if (b.planifie > 0) {
      var yp = pad.t + gh * (1 - b.planifie / maxVal);
      var g2 = ctx.createLinearGradient(0, pad.t, 0, pad.t + gh);
      g2.addColorStop(0, 'rgba(96,165,250,.9)'); g2.addColorStop(1, 'rgba(96,165,250,.1)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.roundRect(x + bw / 2 + 1, yp, bw / 2 - 1, gh - (yp - pad.t), 2); ctx.fill();
    }
    if (n <= 14 || i % 2 === 0) {
      ctx.fillStyle = '#475569'; ctx.font = '8px Barlow,sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label, x + bw / 2, H - 6);
    }
  });
}

// ── Liste ─────────────────────────────────────────────────────────────────────
function _renderFormList(role) {
  var html = '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">';

  html += '<select id="formFilterType" onchange="_filterForm(\'' + role + '\')" '
    + 'style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">'
    + '<option value="">Tous types</option>'
    + FORM_TYPES.map(function(t) { return '<option value="' + t.id + '">' + t.icon + ' ' + t.label + '</option>'; }).join('')
    + '</select>';

  html += '<select id="formFilterStatus" onchange="_filterForm(\'' + role + '\')" '
    + 'style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">'
    + '<option value="">Tous statuts</option>'
    + FORM_STATUS.map(function(s) { return '<option value="' + s.id + '">' + s.label + '</option>'; }).join('')
    + '</select>';

  html += '<input type="text" id="formFilterSearch" oninput="_filterForm(\'' + role + '\')" placeholder="🔍 Intitulé, organisme…" '
    + 'style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;min-width:160px">';

  html += '</div><div id="formListContainer">' + _buildFormTable(_formations, role) + '</div>';
  return html;
}

function _buildFormTable(list, role) {
  if (list.length === 0) {
    return '<div style="text-align:center;padding:48px 0;color:var(--muted)">'
      + '<div style="font-size:40px;margin-bottom:12px">🎓</div>'
      + '<div style="font-size:14px;font-weight:600">Aucune formation enregistrée</div>'
      + '<div style="font-size:12px;margin-top:4px">Cliquez sur "+ Nouvelle formation" pour commencer</div>'
      + '</div>';
  }

  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
  ['Type', 'Intitulé', 'Organisme', 'Date début', 'Expiration', 'Participants', 'Statut', 'Actions'].forEach(function(h) {
    html += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;'
      + 'letter-spacing:1px;text-transform:uppercase;color:var(--muted);white-space:nowrap">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';

  list.forEach(function(f) {
    var T   = FORM_TYPES.find(function(t) { return t.id === f.type; }) || FORM_TYPES[FORM_TYPES.length - 1];
    var S   = FORM_STATUS.find(function(s) { return s.id === f.status; }) || FORM_STATUS[0];
    var dD  = f.date_debut ? new Date(f.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    var dE  = f.date_expiration ? new Date(f.date_expiration) : null;
    var dEs = dE ? dE.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    var diff = dE ? (dE - new Date()) / 86400000 : null;
    var expColor = diff !== null ? (diff < 0 ? '#EF4444' : diff < 30 ? '#F97316' : diff < 60 ? '#F59E0B' : 'var(--muted)') : 'var(--muted)';
    var nbP = f.formation_participants ? f.formation_participants.length : 0;

    html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s" '
      + 'onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">';

    html += '<td style="padding:10px 12px"><span style="font-size:18px" title="' + T.label + '">' + T.icon + '</span></td>';
    html += '<td style="padding:10px 12px;font-weight:600;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _esc(f.intitule || '—') + '</td>';
    html += '<td style="padding:10px 12px;color:var(--muted);font-size:12px">' + _esc(f.organisme || '—') + '</td>';
    html += '<td style="padding:10px 12px;color:var(--muted);font-size:12px;white-space:nowrap">' + dD + '</td>';
    html += '<td style="padding:10px 12px;font-size:12px;white-space:nowrap;color:' + expColor + ';font-weight:' + (diff !== null && diff < 60 ? '700' : '400') + '">'
      + dEs + (diff !== null && diff < 0 ? ' ⚠️' : '') + '</td>';
    html += '<td style="padding:10px 12px;text-align:center">'
      + '<span style="background:rgba(167,139,250,.12);color:#A78BFA;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:700">' + nbP + '</span></td>';
    html += '<td style="padding:10px 12px">'
      + '<span style="padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700;background:' + S.color + '22;color:' + S.color + '">' + S.label + '</span></td>';
    html += '<td style="padding:10px 12px"><div style="display:flex;gap:6px">'
      + '<button onclick="_formView=\'detail\';_formEditId=\'' + f.id + '\';renderFormations(\'' + role + '\')" '
      + 'style="padding:4px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:var(--text);font-size:11px;cursor:pointer">👁 Voir</button>'
      + '<button onclick="_formView=\'saisie\';_formEditId=\'' + f.id + '\';renderFormations(\'' + role + '\')" '
      + 'style="padding:4px 10px;background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.2);border-radius:6px;color:#34D399;font-size:11px;cursor:pointer">✏️</button>'
      + '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

function _filterForm(role) {
  var type   = (document.getElementById('formFilterType')   || {}).value || '';
  var status = (document.getElementById('formFilterStatus') || {}).value || '';
  var search = ((document.getElementById('formFilterSearch') || {}).value || '').toLowerCase();
  var filtered = _formations.filter(function(f) {
    if (type   && f.type   !== type)   return false;
    if (status && f.status !== status) return false;
    if (search && !((f.intitule || '').toLowerCase().includes(search) || (f.organisme || '').toLowerCase().includes(search))) return false;
    return true;
  });
  var c = document.getElementById('formListContainer');
  if (c) c.innerHTML = _buildFormTable(filtered, role);
}

// ── Formulaire ────────────────────────────────────────────────────────────────
function renderFormationForm(role) {
  var isEdit = !!_formEditId;
  var f = isEdit ? (_formations.find(function(x) { return x.id === _formEditId; }) || {}) : {};

  var html = '<div style="max-width:680px">';
  html += '<button onclick="_formView=\'liste\';renderFormations(\'' + role + '\')" '
    + 'style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);'
    + 'border-radius:8px;padding:7px 14px;color:var(--muted);font-size:12px;cursor:pointer;margin-bottom:20px">← Retour</button>';

  html += '<div style="background:linear-gradient(135deg,rgba(52,211,153,.06),rgba(96,165,250,.03));'
    + 'border:1px solid rgba(52,211,153,.15);border-radius:20px;padding:28px">';
  html += '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">'
    + (isEdit ? '✏️ Modifier la formation' : '🎓 Nouvelle formation') + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:22px">Champs * obligatoires</div>';

  // Type
  html += '<div style="margin-bottom:18px"><label style="' + _formLabelStyle() + '">Type *</label><div style="display:flex;flex-wrap:wrap;gap:8px">';
  FORM_TYPES.forEach(function(t) {
    var sel = f.type === t.id;
    html += '<label style="display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:8px;cursor:pointer;'
      + 'background:' + (sel ? t.color + '22' : 'rgba(255,255,255,.04)') + ';'
      + 'border:1px solid ' + (sel ? t.color + '55' : 'rgba(255,255,255,.1)') + ';transition:.15s" '
      + 'onclick="_pickFormType(this,\'' + t.id + '\',\'' + t.color + '\')">'
      + '<input type="radio" name="form_type" value="' + t.id + '"' + (sel ? ' checked' : '') + ' style="display:none">'
      + '<span>' + t.icon + '</span><span style="font-size:12px;font-weight:600;color:var(--text)">' + t.label + '</span></label>';
  });
  html += '</div></div>';

  // Intitulé
  html += '<div style="margin-bottom:16px"><label style="' + _formLabelStyle() + '">Intitulé *</label>'
    + '<input type="text" id="formIntitule" value="' + _esc(f.intitule || '') + '" '
    + 'placeholder="Ex : Habilitation B1V, CACES R489…" style="' + _formInputStyle() + '"></div>';

  // Organisme + Lieu
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
    + '<div><label style="' + _formLabelStyle() + '">Organisme</label>'
    + '<input type="text" id="formOrganisme" value="' + _esc(f.organisme || '') + '" placeholder="APAVE, AFPA…" style="' + _formInputStyle() + '"></div>'
    + '<div><label style="' + _formLabelStyle() + '">Lieu</label>'
    + '<input type="text" id="formLieu" value="' + _esc(f.lieu || '') + '" placeholder="Site Lyon, En ligne…" style="' + _formInputStyle() + '"></div>'
    + '</div>';

  // Dates
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">'
    + '<div><label style="' + _formLabelStyle() + '">Date début *</label>'
    + '<input type="date" id="formDateDebut" value="' + (f.date_debut ? f.date_debut.slice(0, 10) : '') + '" style="' + _formInputStyle() + '"></div>'
    + '<div><label style="' + _formLabelStyle() + '">Date fin</label>'
    + '<input type="date" id="formDateFin" value="' + (f.date_fin ? f.date_fin.slice(0, 10) : '') + '" style="' + _formInputStyle() + '"></div>'
    + '<div><label style="' + _formLabelStyle() + '">Expiration</label>'
    + '<input type="date" id="formDateExp" value="' + (f.date_expiration ? f.date_expiration.slice(0, 10) : '') + '" style="' + _formInputStyle() + '"></div>'
    + '</div>';

  // Durée + Coût
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">'
    + '<div><label style="' + _formLabelStyle() + '">Durée (heures)</label>'
    + '<input type="number" id="formDuree" min="0" value="' + (f.duree_heures || '') + '" placeholder="Ex : 14" style="' + _formInputStyle() + '"></div>'
    + '<div><label style="' + _formLabelStyle() + '">Coût total (€)</label>'
    + '<input type="number" id="formCout" min="0" step="0.01" value="' + (f.cout_total || '') + '" placeholder="Ex : 850" style="' + _formInputStyle() + '"></div>'
    + '</div>';

  // Statut (édition)
  if (isEdit) {
    html += '<div style="margin-bottom:16px"><label style="' + _formLabelStyle() + '">Statut</label>'
      + '<select id="formStatus" style="' + _formInputStyle() + '">'
      + FORM_STATUS.map(function(s) { return '<option value="' + s.id + '"' + (f.status === s.id ? ' selected' : '') + '>' + s.label + '</option>'; }).join('')
      + '</select></div>';
  }

  // Notes
  html += '<div style="margin-bottom:18px"><label style="' + _formLabelStyle() + '">Notes / Objectifs</label>'
    + '<textarea id="formNotes" rows="3" placeholder="Objectifs, prérequis, matériel…" '
    + 'style="' + _formInputStyle() + 'resize:vertical">' + _esc(f.notes || '') + '</textarea></div>';

  // Participants
  html += '<div style="margin-bottom:22px"><label style="' + _formLabelStyle() + '">Participants (un par ligne)</label>'
    + '<textarea id="formParticipants" rows="4" placeholder="Jean Dupont\nMarie Martin" '
    + 'style="' + _formInputStyle() + 'resize:vertical">';
  if (isEdit) {
    var parts = _formParticipants.filter(function(p) { return p.formation_id === _formEditId; });
    html += parts.map(function(p) { return p.nom_participant || ''; }).join('\n');
  }
  html += '</textarea></div>';

  // Boutons
  html += '<div style="display:flex;gap:12px;align-items:center">'
    + '<button onclick="_saveFormation(\'' + role + '\')" '
    + 'style="padding:12px 28px;background:rgba(52,211,153,.18);border:1px solid rgba(52,211,153,.35);'
    + 'border-radius:10px;color:#34D399;font-weight:700;cursor:pointer;font-size:14px">'
    + (isEdit ? '💾 Enregistrer' : '🎓 Créer') + '</button>'
    + '<button onclick="_formView=\'liste\';renderFormations(\'' + role + '\')" '
    + 'style="padding:12px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);'
    + 'border-radius:10px;color:var(--muted);font-weight:700;cursor:pointer">Annuler</button>';

  if (isEdit) {
    html += '<button onclick="_deleteFormation(\'' + f.id + '\',\'' + role + '\')" '
      + 'style="margin-left:auto;padding:12px 20px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.2);'
      + 'border-radius:10px;color:#EF4444;font-weight:700;cursor:pointer">🗑 Supprimer</button>';
  }
  html += '</div></div></div>';
  return html;
}

function _pickFormType(el, id, color) {
  el.closest('div').querySelectorAll('label').forEach(function(l) {
    l.style.background = 'rgba(255,255,255,.04)';
    l.style.borderColor = 'rgba(255,255,255,.1)';
  });
  el.style.background = color + '22';
  el.style.borderColor = color + '55';
  el.querySelector('input').checked = true;
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────
async function _saveFormation(role) {
  if (!currentProfile || !currentProfile.org_id) { showToast('❌ Session expirée', 'error'); return; }

  var typeEl  = document.querySelector('[name="form_type"]:checked');
  var intitul = (document.getElementById('formIntitule')?.value || '').trim();
  var dateDeb = document.getElementById('formDateDebut')?.value;

  if (!typeEl || !intitul || !dateDeb) {
    showToast('⚠️ Type, intitulé et date de début sont obligatoires', 'error'); return;
  }

  var userId  = currentProfile.id || (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null);

  var payload = {
    org_id          : currentProfile.org_id,
    created_by      : userId,
    type            : typeEl.value,
    intitule        : intitul,
    organisme       : (document.getElementById('formOrganisme')?.value || '').trim() || null,
    lieu            : (document.getElementById('formLieu')?.value      || '').trim() || null,
    date_debut      : dateDeb,
    date_fin        : document.getElementById('formDateFin')?.value    || null,
    date_expiration : document.getElementById('formDateExp')?.value    || null,
    duree_heures    : parseInt(document.getElementById('formDuree')?.value  || '0') || null,
    cout_total      : parseFloat(document.getElementById('formCout')?.value || '0') || null,
    notes           : (document.getElementById('formNotes')?.value || '').trim() || null,
    status          : document.getElementById('formStatus')?.value || 'planifiee'
  };

  var res, formId;
  if (_formEditId) {
    payload.updated_at = new Date().toISOString();
    res = await sb.from('formations').update(payload).eq('id', _formEditId);
    if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
    formId = _formEditId;
  } else {
    res = await sb.from('formations').insert(payload).select('id').single();
    if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
    formId = res.data.id;
  }

  // Participants
  var partText = (document.getElementById('formParticipants')?.value || '').trim();
  if (partText) {
    var noms = partText.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (noms.length > 0) {
      if (_formEditId) await sb.from('formation_participants').delete().eq('formation_id', formId);
      var inserts = noms.map(function(nom) {
        return { formation_id: formId, org_id: currentProfile.org_id, nom_participant: nom, status: 'inscrit', result: 'en_attente' };
      });
      var pRes = await sb.from('formation_participants').insert(inserts);
      if (pRes.error) console.warn('[Formations] participants:', pRes.error);
    }
  }

  showToast(_formEditId ? '✅ Formation mise à jour' : '🎓 Formation créée', 'success');
  _formView = 'liste'; _formEditId = null;
  loadFormations(role);
}

async function _deleteFormation(id, role) {
  if (!confirm('Supprimer cette formation et tous ses participants ?')) return;
  var res = await sb.from('formations').delete().eq('id', id);
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  showToast('🗑 Formation supprimée', 'success');
  _formView = 'liste'; _formEditId = null;
  loadFormations(role);
}

// ── Détail ────────────────────────────────────────────────────────────────────
function renderFormationDetail(f, role) {
  var T = FORM_TYPES.find(function(t) { return t.id === f.type; }) || FORM_TYPES[FORM_TYPES.length - 1];
  var S = FORM_STATUS.find(function(s) { return s.id === f.status; }) || FORM_STATUS[0];
  var parts = _formParticipants.filter(function(p) { return p.formation_id === f.id; });

  var html = '<div style="max-width:700px">';
  html += '<button onclick="_formView=\'liste\';renderFormations(\'' + role + '\')" '
    + 'style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);'
    + 'border-radius:8px;padding:7px 14px;color:var(--muted);font-size:12px;cursor:pointer;margin-bottom:20px">← Retour</button>';

  html += '<div style="background:linear-gradient(135deg,rgba(52,211,153,.06),rgba(96,165,250,.03));'
    + 'border:1px solid rgba(52,211,153,.15);border-radius:20px;padding:28px;margin-bottom:20px">';
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">';
  html += '<div>'
    + '<div style="font-size:28px;margin-bottom:8px">' + T.icon + '</div>'
    + '<div style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px">' + _esc(f.intitule || '—') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '<span style="padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;background:' + T.color + '22;color:' + T.color + '">' + T.label + '</span>'
    + '<span style="padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;background:' + S.color + '22;color:' + S.color + '">' + S.label + '</span>'
    + '</div></div>';
  html += '<button onclick="_formView=\'saisie\';_formEditId=\'' + f.id + '\';renderFormations(\'' + role + '\')" '
    + 'style="padding:8px 16px;background:rgba(52,211,153,.12);border:1px solid rgba(52,211,153,.25);border-radius:8px;color:#34D399;font-size:12px;font-weight:700;cursor:pointer">✏️ Modifier</button>';
  html += '</div></div>';

  // Infos
  var rows = [
    ['Organisme', f.organisme], ['Lieu', f.lieu],
    ['Date de début', f.date_debut ? new Date(f.date_debut).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null],
    ['Date de fin',   f.date_fin   ? new Date(f.date_fin).toLocaleDateString('fr-FR',   { day: 'numeric', month: 'long', year: 'numeric' }) : null],
    ['Expiration',    f.date_expiration ? new Date(f.date_expiration).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null],
    ['Durée', f.duree_heures ? f.duree_heures + ' heures' : null],
    ['Coût total', f.cout_total ? f.cout_total + ' €' : null],
    ['Notes', f.notes]
  ];

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">';
  rows.forEach(function(r) {
    if (!r[1]) return;
    html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:4px">' + r[0] + '</div>'
      + '<div style="font-size:13px;color:var(--text)">' + _esc(String(r[1])) + '</div>'
      + '</div>';
  });
  html += '</div>';

  // Participants
  html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px">';
  html += '<div style="font-size:14px;font-weight:700;margin-bottom:14px">👥 Participants (' + parts.length + ')</div>';
  if (parts.length === 0) {
    html += '<div style="text-align:center;padding:20px;color:var(--muted);font-size:13px">Aucun participant</div>';
  } else {
    html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
    html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
    ['Participant', 'Statut', 'Résultat'].forEach(function(h) {
      html += '<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">' + h + '</th>';
    });
    html += '</tr></thead><tbody>';
    parts.forEach(function(p) {
      var R = FORM_RESULTS.find(function(r) { return r.id === p.result; });
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04)">'
        + '<td style="padding:9px 10px;font-weight:600">' + _esc(p.nom_participant || '—') + '</td>'
        + '<td style="padding:9px 10px"><span style="font-size:11px;background:rgba(255,255,255,.06);padding:2px 8px;border-radius:5px">' + (p.status || '—') + '</span></td>'
        + '<td style="padding:9px 10px">'
        + '<select onchange="_updatePartResult(\'' + p.id + '\',this.value)" '
        + 'style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:3px 8px;'
        + 'color:' + (R ? R.color : 'var(--text)') + ';font-size:11px;font-weight:700">'
        + FORM_RESULTS.map(function(r) { return '<option value="' + r.id + '"' + (p.result === r.id ? ' selected' : '') + '>' + r.label + '</option>'; }).join('')
        + '</select></td></tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div></div>';
  return html;
}

async function _updatePartResult(partId, result) {
  var res = await sb.from('formation_participants').update({ result: result }).eq('id', partId);
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  var p = _formParticipants.find(function(x) { return x.id === partId; });
  if (p) p.result = result;
  showToast('✅ Résultat mis à jour', 'success');
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function _exportFormationsCSV() {
  var cols = ['Type', 'Intitulé', 'Organisme', 'Lieu', 'Date début', 'Date fin', 'Expiration', 'Durée (h)', 'Coût (€)', 'Statut', 'Nb participants', 'Notes'];
  var rows = _formations.map(function(f) {
    var T  = FORM_TYPES.find(function(t) { return t.id === f.type; });
    var S  = FORM_STATUS.find(function(s) { return s.id === f.status; });
    var nb = _formParticipants.filter(function(p) { return p.formation_id === f.id; }).length;
    var e  = function(v) { var s = String(v || ''); return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return [
      e(T ? T.label : f.type), e(f.intitule), e(f.organisme), e(f.lieu),
      e(f.date_debut        ? new Date(f.date_debut).toLocaleDateString('fr-FR')        : ''),
      e(f.date_fin          ? new Date(f.date_fin).toLocaleDateString('fr-FR')          : ''),
      e(f.date_expiration   ? new Date(f.date_expiration).toLocaleDateString('fr-FR')   : ''),
      e(f.duree_heures || ''), e(f.cout_total || ''),
      e(S ? S.label : f.status), e(nb), e(f.notes)
    ].join(',');
  });
  var csv  = [cols.join(',')].concat(rows).join('\n');
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'formations_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click(); URL.revokeObjectURL(url);
  showToast('📥 Export CSV téléchargé', 'success');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _formLabelStyle() {
  return 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);display:block;margin-bottom:6px';
}
function _formInputStyle() {
  return 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:inherit;outline:none;';
}
function _formEmptyState(icon, text) {
  return '<div class="empty-state"><div class="empty-state-icon">' + icon + '</div><div class="empty-state-text">' + text + '</div></div>';
}
function _esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var _t = setInterval(function() {
    if (typeof currentProfile !== 'undefined' && currentProfile && typeof sb !== 'undefined') {
      clearInterval(_t);
      checkFormationsActivation();
    }
  }, 300);
});
