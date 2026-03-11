// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SafetySphere Gate — Registre sécurité des visiteurs  v1.0.0
//  Chargement : après conformite.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

// ══════════════════════════════════════════════════════════════
//  ADMIN — Gestion activation modules par organisation
// ══════════════════════════════════════════════════════════════

var AVAILABLE_MODULES = [
  {
    id       : 'incidents',
    icon     : '🚨',
    name     : 'Incidents & Quasi-accidents',
    desc     : 'Déclaration, suivi et analyse des incidents de sécurité sur site',
    color    : '#F87171',
    roles    : ['hse', 'company']
  },
  {
    id       : 'gate',
    icon     : '🚪',
    name     : 'SafetySphere Gate',
    desc     : 'Registre sécurité des visiteurs — check-in/out, QR code, badge PDF',
    color    : '#4ADE80',
    roles    : ['hse', 'company']
  },
  {
    id       : 'signatures',
    icon     : '✍️',
    name     : 'Workflow Signature',
    desc     : 'Signature électronique des rapports — OTP, manuscrite, présentielle',
    color    : '#A5B4FC',
    roles    : ['hse', 'company']
  },
  {
    id       : 'conformite',
    icon     : '📋',
    name     : 'Rapports de Conformité',
    desc     : 'DUER, VGP, FDS, PDP — génération et archivage des rapports HSE',
    color    : '#FCD34D',
    roles    : ['hse', 'company']
  },
  {
    id       : 'formations',
    icon     : '🎓',
    name     : 'Formations & Habilitations',
    desc     : 'Gestion des sessions de formation, habilitations et attestations',
    color    : '#818CF8',
    roles    : ['hse', 'company']
  },
  {
    id       : 'permis',
    icon     : '🔑',
    name     : 'Permis de Travail',
    desc     : 'Émission, suivi et signature des permis de travail terrain',
    color    : '#F59E0B',
    roles    : ['hse', 'company']
  },
  {
    id       : 'fds',
    icon     : '⚗️',
    name     : 'Produits Chimiques / FDS',
    desc     : 'Inventaire des produits chimiques et gestion des Fiches de Données de Sécurité',
    color    : '#06B6D4',
    roles    : ['hse', 'company']
  }
];

async function loadAdminModules() {
  var container = document.getElementById('adminModulesList');
  if (!container) return;

  // Charger toutes les orgs + leurs settings modules
  var orgsRes    = await sb.from('organizations').select('id, name').order('name');
  var settingsRes = await sb.from('org_modules').select('org_id, module_id, enabled');

  var orgs     = orgsRes.data || [];
  var settings = settingsRes.data || [];

  // Construire un map : orgId_moduleId => enabled
  var enabledMap = {};
  settings.forEach(function(s) {
    enabledMap[s.org_id + '_' + s.module_id] = s.enabled;
  });

  if (!orgs.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏢</div><div class="empty-state-text">Aucune organisation</div></div>';
    return;
  }

  var html = '';

  orgs.forEach(function(org) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px;margin-bottom:12px">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
      + '<span style="font-size:18px">🏢</span>'
      + '<span style="font-size:13px;font-weight:700;color:var(--text)">' + escapeHtml(org.name) + '</span>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px">';

    AVAILABLE_MODULES.forEach(function(mod) {
      var key     = org.id + '_' + mod.id;
      var enabled = enabledMap.hasOwnProperty(key) ? enabledMap[key] : (mod.id !== 'gate'); // Gate desactive par defaut, autres actifs
      var toggleId = 'mod_' + org.id.slice(0,8) + '_' + mod.id;

      html += '<div style="display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,.02);border-radius:8px;border:1px solid rgba(255,255,255,.05)">'
        + '<span style="font-size:18px;flex-shrink:0">' + mod.icon + '</span>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:12px;font-weight:700;color:var(--text)">' + escapeHtml(mod.name) + '</div>'
        + '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + escapeHtml(mod.desc) + '</div>'
        + '</div>'
        + '<label style="position:relative;display:inline-block;width:42px;height:24px;flex-shrink:0;cursor:pointer">'
        + '<input type="checkbox" id="' + toggleId + '" ' + (enabled ? 'checked' : '') + ' '
        + 'onchange="toggleOrgModule(\'' + org.id + '\',\'' + mod.id + '\',this.checked,\'' + toggleId + '\')" '
        + 'style="opacity:0;width:0;height:0;position:absolute">'
        + '<span style="position:absolute;inset:0;border-radius:24px;transition:.3s;background:' + (enabled ? mod.color : 'rgba(255,255,255,.1)') + ';border:1px solid rgba(255,255,255,.1)" id="' + toggleId + '_track"></span>'
        + '<span style="position:absolute;top:3px;left:' + (enabled ? '20px' : '3px') + ';width:18px;height:18px;border-radius:50%;background:#fff;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,.3)" id="' + toggleId + '_thumb"></span>'
        + '</label>'
        + '<span style="font-size:11px;font-weight:700;color:' + (enabled ? mod.color : 'var(--muted)') + ';min-width:50px;text-align:right" id="' + toggleId + '_label">' + (enabled ? '✅ Actif' : '○ Inactif') + '</span>'
        + '</div>';
    });

    html += '</div></div>';
  });

  container.innerHTML = html;
}

async function toggleOrgModule(orgId, moduleId, enabled, toggleId) {
  // Pour Gate : écrire dans gate_config.active (pas signature_settings — RLS)
  if (moduleId === 'gate') {
    var mod = AVAILABLE_MODULES.find(function(m) { return m.id === 'gate'; });
    var color = mod ? mod.color : '#4ADE80';
    var track = document.getElementById(toggleId + '_track');
    var thumb = document.getElementById(toggleId + '_thumb');
    var label = document.getElementById(toggleId + '_label');
    if (track) track.style.background = enabled ? color : 'rgba(255,255,255,.1)';
    if (thumb) thumb.style.left = enabled ? '20px' : '3px';
    if (label) { label.textContent = enabled ? '✅ Actif' : '○ Inactif'; label.style.color = enabled ? color : 'var(--muted)'; }
    var ex = await sb.from('gate_config').select('id').eq('org_id', orgId).maybeSingle();
    var res;
    if (ex.data) {
      res = await sb.from('gate_config').update({ active: enabled }).eq('id', ex.data.id);
    } else {
      res = await sb.from('gate_config').insert({ org_id: orgId, site_name: 'Site principal', active: enabled, zones: ['Accueil'] });
    }
    if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
    showToast((enabled ? '✅ Gate activé' : '○ Gate désactivé') + ' pour cette organisation', 'success');
    if (currentProfile && currentProfile.org_id === orgId) updateGateTabVisibility(enabled);
    return;
  }
  var mod = AVAILABLE_MODULES.find(function(m) { return m.id === moduleId; });
  var color = mod ? mod.color : '#4ADE80';

  // Mettre à jour l'UI immédiatement
  var track = document.getElementById(toggleId + '_track');
  var thumb = document.getElementById(toggleId + '_thumb');
  var label = document.getElementById(toggleId + '_label');
  if (track) track.style.background = enabled ? color : 'rgba(255,255,255,.1)';
  if (thumb) thumb.style.left = enabled ? '20px' : '3px';
  if (label) { label.textContent = enabled ? '✅ Actif' : '○ Inactif'; label.style.color = enabled ? color : 'var(--muted)'; }

  // Sauvegarder dans org_modules
  var res = await sb.from('org_modules').upsert(
    { org_id: orgId, module_id: moduleId, enabled: enabled },
    { onConflict: 'org_id,module_id' }
  );

  if (res.error) {
    showToast('Erreur : ' + res.error.message, 'error');
    // Remettre l'état précédent
    var chk = document.getElementById(toggleId);
    if (chk) chk.checked = !enabled;
    return;
  }

  // Si Gate activé/désactivé : afficher/masquer l'onglet Gate dans les dashboards
  if (moduleId === 'gate') {
    showToast((enabled ? '✅ Gate activé' : '○ Gate désactivé') + ' pour cette organisation', 'success');
    // Rafraîchir la visibilité de l'onglet Gate si c'est l'org courante
    if (currentProfile && currentProfile.org_id === orgId) {
      updateGateTabVisibility(enabled);
    }
  } else {
    showToast((enabled ? '✅' : '○') + ' ' + (mod ? mod.name : moduleId) + (enabled ? ' activé' : ' désactivé'), 'success');
  }
}

function updateGateTabVisibility(visible) {
  // L'onglet Gate est TOUJOURS visible — c'est dans Gate que le responsable active le module
  // On met juste à jour l'indicateur visuel sur l'onglet
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(tab) {
    if (tab.textContent.includes('Gate') || (tab.getAttribute && tab.getAttribute('onclick') || '').includes('gate')) {
      tab.style.display = '';
      // Badge indicateur si inactif
      var badge = tab.querySelector('.gate-status-dot');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'gate-status-dot';
        badge.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle;flex-shrink:0';
        tab.appendChild(badge);
      }
      badge.style.background = visible ? '#4ADE80' : '#F97316';
      badge.title = visible ? 'Gate actif' : 'Gate inactif';
    }
  });
}

// Vérifier si Gate est activé pour l'org courante au chargement
async function checkGateActivation() {
  if (!currentProfile || !currentProfile.org_id) return;

  // Lire gate_config.active — pas de signature_settings (problème RLS)
  var res = await sb.from('gate_config')
    .select('active')
    .eq('org_id', currentProfile.org_id)
    .maybeSingle();

  var enabled = res.data ? (res.data.active === true) : false;
  _gateActivated = enabled;
  updateGateTabVisibility(enabled);
  return enabled;
}

// Charger les modules admin quand l'overview admin est ouvert
// Hooker sur loadAdminOverview ou appel direct
var _gateAdminHooked = false;
function hookAdminModules() {
  if (_gateAdminHooked) return;
  _gateAdminHooked = true;
  var orig = window.loadAdminOverview;
  window.loadAdminOverview = async function() {
    if (orig) await orig.apply(this, arguments);
    loadAdminModules();
  };
  // Si l'admin est déjà chargé
  if (document.getElementById('adminModulesList')) loadAdminModules();
}


// ── Globals Gate ─────────────────────────────────────────────
var _gateConfig   = null;   // config org courante
var _gateVisits   = [];     // visites chargées
var _gateSubView  = 'registre'; // registre | checkin | config
var _gateActivated = false;  // mis à jour par checkGateActivation

// ── Point d'entrée principal ──────────────────────────────────
async function loadGate(role) {
  // Normaliser le role : 'HSE' → 'hse', 'Company' → 'company'
  var roleKey = role.toLowerCase();
  var dash    = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  // Cas spéciaux : 'HSE' doit rester 'HSE' comme préfixe d'ID
  var idPrefix = role; // On garde tel quel pour les IDs HTML

  var container = document.getElementById(idPrefix + '-gate-content') || document.getElementById(idPrefix + '-gate');
  if (!container) {
    console.warn('[Gate] Container introuvable pour role:', role);
    return;
  }

  // Guard : currentProfile doit être prêt
  if (!currentProfile || !currentProfile.org_id) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Profil non chargé — veuillez rafraîchir la page</div></div>';
    return;
  }

  container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Chargement Gate...</div></div>';

  try {
    // Vérifier que Gate est activé via gate_config.active
    var activRes = await sb.from('gate_config')
      .select('active')
      .eq('org_id', currentProfile.org_id)
      .maybeSingle();

    var gateEnabled = activRes.data ? (activRes.data.active === true) : false;
    if (!gateEnabled) {
      // Gate inactif : afficher l'écran d'activation directement accessible
      _gateSubView = 'config';
      _gateConfig = null;
      _gateVisits = [];
      renderGate(role);
      return;
    }

    // Charger config + visites en parallèle
    var [cfgRes, visRes] = await Promise.all([
      sb.from('gate_config').select('*').eq('org_id', currentProfile.org_id).maybeSingle(),
      sb.from('visitor_log').select('*').eq('org_id', currentProfile.org_id)
        .order('check_in', { ascending: false }).limit(200)
    ]);

    if (cfgRes.error) throw cfgRes.error;

    _gateConfig = cfgRes.data || null;
    _gateVisits = visRes.data || [];

    renderGate(role);

  } catch(e) {
    console.error('[Gate] loadGate error:', e);
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erreur Gate : ' + (e.message || e) + '</div></div>';
  }
}

// ── Rendu principal avec sous-navigation ─────────────────────
function renderGate(role) {
  var container = document.getElementById(role + '-gate-content') || document.getElementById(role + '-gate');
  if (!container) return;

  var todayStr = new Date().toDateString();
  var todayVisits   = _gateVisits.filter(function(v) { return new Date(v.check_in).toDateString() === todayStr; });
  var presentCount  = todayVisits.filter(function(v) { return !v.check_out; }).length;
  var totalToday    = todayVisits.length;

  var html = '';

  // ── Barre de sous-navigation ──
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">'
    + subNavBtn('registre', '📋 Registre', role, presentCount)
    + subNavBtn('checkin',  '➕ Check-in manuel', role)
    + subNavBtn('config',   '⚙️ Configuration', role)
    + '<div style="margin-left:auto;display:flex;gap:8px;align-items:center">'
    + '<span style="font-size:11px;color:var(--muted)">' + presentCount + ' présent(s) · ' + totalToday + ' aujourd\'hui</span>'
    + (_gateConfig ? '<button class="btn-sm btn-upload" style="padding:6px 14px;font-size:11px" onclick="showGateQR()">📱 QR Code accueil</button>' : '')
    + '</div>'
    + '</div>';

  // ── Contenu selon sous-vue ──
  if (_gateSubView === 'registre')  html += renderGateRegistre(role);
  if (_gateSubView === 'checkin')   html += renderGateCheckin(role);
  if (_gateSubView === 'config')    html += renderGateConfig(role);

  try {
    container.innerHTML = html;
  } catch(e) {
    console.error('[Gate] renderGate innerHTML error:', e);
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erreur rendu Gate : ' + (e.message||e) + '</div></div>';
    return;
  }

  // Dessiner le canvas graphe après injection DOM
  if (_gateSubView === 'registre') {
    window._gateLastRole = role;
    requestAnimationFrame(function() { drawGateCanvas(); });
  }
}

function subNavBtn(view, label, role, badge) {
  var active = _gateSubView === view;
  return '<button onclick="switchGateView(\'' + view + '\',\'' + role + '\')" style="'
    + 'padding:8px 16px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid;'
    + 'font-family:\'Barlow\',sans-serif;'
    + (active
      ? 'background:rgba(249,115,22,.2);border-color:rgba(249,115,22,.4);color:#F97316'
      : 'background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);color:var(--muted)')
    + '">' + label
    + (badge ? ' <span style="background:#F97316;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;margin-left:4px">' + badge + '</span>' : '')
    + '</button>';
}

function switchGateView(view, role) {
  _gateSubView = view;
  renderGate(role);
}

// ══════════════════════════════════════════════════════════════
//  REGISTRE — vue principale
// ══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  ANALYTICS — Graphe fréquentation visiteurs
// ══════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════
//  Graphe fréquentation Gate — rendu inline, aucune dépendance
// ══════════════════════════════════════════════════════════════

var _gateChartPeriod = '7d';
var _gateChartType   = 'bar';

function renderGateFreqChart(visits) {
  var period   = _gateChartPeriod;
  var type     = _gateChartType;
  var accent   = '#F97316';
  var signCol  = '#4ADE80';
  var days     = period === '30d' ? 30 : period === '90d' ? 90 : 7;
  var canvasId = 'gateFreqCanvas';
  var tipId    = 'gateFreqTip';

  // ── Buckets par jour (heure locale partout) ──
  function localDateKey(date) {
    // YYYY-MM-DD en heure locale (évite le décalage UTC)
    var y = date.getFullYear();
    var m = String(date.getMonth()+1).padStart(2,'0');
    var d = String(date.getDate()).padStart(2,'0');
    return y+'-'+m+'-'+d;
  }
  var now   = new Date();
  var start = new Date(now); start.setDate(start.getDate() - (days-1)); start.setHours(0,0,0,0);
  var buckets = {};
  for (var d=0; d<days; d++) {
    var dt = new Date(start); dt.setDate(dt.getDate()+d);
    buckets[localDateKey(dt)] = {total:0, signed:0, durs:[]};
  }
  (visits||[]).forEach(function(v) {
    var k = v.check_in ? localDateKey(new Date(v.check_in)) : '';
    if (!buckets[k]) return;
    buckets[k].total++;
    if (v.signed_at) buckets[k].signed++;
    if (v.check_out) {
      var dur = (new Date(v.check_out)-new Date(v.check_in))/60000;
      if (dur>0) buckets[k].durs.push(dur);
    }
  });
  var keys    = Object.keys(buckets).sort();
  var totals  = keys.map(function(k){return buckets[k].total;});
  var signed  = keys.map(function(k){return buckets[k].signed;});
  var maxVal  = Math.max.apply(null, totals.concat([1]));
  var labels  = keys.map(function(k){
    var dt = new Date(k+'T12:00:00');
    if (days<=7)  return dt.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
    if (days<=30) return dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    return dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  });

  // ── KPIs ──
  var tot   = totals.reduce(function(a,b){return a+b;},0);
  var sig   = signed.reduce(function(a,b){return a+b;},0);
  var peak  = Math.max.apply(null,totals);
  var avg   = tot>0?(tot/days).toFixed(1):'0';
  var sigR  = tot>0?Math.round(sig/tot*100):0;
  var allD  = []; keys.forEach(function(k){allD=allD.concat(buckets[k].durs);});
  var avgDur= allD.length?Math.round(allD.reduce(function(a,b){return a+b;},0)/allD.length):0;
  var peakDay=''; if (peak>0) {
    var pi = totals.indexOf(peak);
    peakDay = new Date(keys[pi]+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  }

  // ── Thème live ──
  var isLight  = document.body.classList.contains('theme-light');
  var panelBg  = isLight ? 'rgba(248,250,252,.97)' : 'rgba(13,27,42,.97)';
  var border   = isLight ? 'rgba(249,115,22,.2)'   : 'rgba(249,115,22,.12)';
  var gridCol  = isLight ? 'rgba(0,0,0,.07)'        : 'rgba(255,255,255,.05)';
  var baseCol  = isLight ? 'rgba(0,0,0,.15)'        : 'rgba(255,255,255,.1)';
  var axisCol  = isLight ? '#64748B'                : '#6B7280';
  var labelCol = isLight ? '#0F172A'                : '#F1F5F9';
  var titleCol = isLight ? '#0F172A'                : '#F1F5F9';
  var mutedCol = isLight ? '#64748B'                : '#6B7280';
  var kpiBg    = isLight ? 'rgba(0,0,0,.03)'        : 'rgba(255,255,255,.02)';
  var kpiBdr   = isLight ? 'rgba(0,0,0,.07)'        : 'rgba(255,255,255,.05)';
  var btnBg    = isLight ? 'rgba(0,0,0,.04)'        : 'rgba(255,255,255,.04)';
  var btnBdr   = isLight ? 'rgba(0,0,0,.1)'         : 'rgba(255,255,255,.07)';
  var btnOff   = isLight ? '#94A3B8'                : '#4B5563';

  // Zoom police
  var rootZoom = parseFloat(document.documentElement.style.getPropertyValue('--ui-zoom')||'1')||1;
  var appZoom  = parseFloat((document.getElementById('appContent')||{style:{zoom:'1'}}).style.zoom||'1')||1;
  var fz = Math.max(0.8, Math.min(1.3, rootZoom * appZoom));

  function btn(val, cur, action) {
    var a = cur===val;
    return '<button onclick="'+action+'" style="padding:5px 13px;font-size:'+Math.round(11*fz)+'px;'
      +'font-weight:700;border:none;cursor:pointer;border-radius:7px;transition:all .15s;'
      +'font-family:Barlow,sans-serif;'
      +'background:'+(a?'rgba(249,115,22,.18)':'transparent')+';'
      +'color:'+(a?accent:btnOff)+'">'+val+'</button>';
  }

  function kpiCell(dot, val, sub, col, last) {
    return '<div style="padding:13px 8px;text-align:center;'+(last?'':('border-right:1px solid '+kpiBdr))+'">'
      +'<div style="font-size:'+Math.round(8*fz)+'px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:'+mutedCol+';margin-bottom:4px;font-family:Barlow,sans-serif">'+dot+' '+sub+'</div>'
      +'<div style="font-size:'+Math.round(18*fz)+'px;font-weight:900;color:'+col+';letter-spacing:-.5px;line-height:1;font-family:Barlow,sans-serif">'+val+'</div>'
      +'</div>';
  }

  var html = '<div style="background:'+panelBg+';border:1px solid '+border+';border-radius:20px;overflow:hidden;margin-bottom:20px;box-shadow:0 4px 32px rgba(0,0,0,.2)">';

  // Header
  html += '<div style="padding:18px 20px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">';
  html += '<div>';
  html += '<div style="display:flex;align-items:center;gap:7px;margin-bottom:2px">';
  html += '<div style="width:2px;height:14px;background:linear-gradient(180deg,'+accent+',transparent);border-radius:1px"></div>';
  html += '<span style="font-size:'+Math.round(10*fz)+'px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:'+accent+';font-family:Barlow,sans-serif">Fréquentation</span>';
  html += '</div>';
  html += '<div style="font-size:'+Math.round(18*fz)+'px;font-weight:900;color:'+titleCol+';letter-spacing:-.3px;padding-left:9px;font-family:Barlow,sans-serif">Analyse des visites</div>';
  html += '</div>';

  // Toolbar
  html += '<div style="display:flex;gap:5px;align-items:center;flex-shrink:0">';
  html += '<div style="display:flex;background:'+btnBg+';border:1px solid '+btnBdr+';border-radius:9px;overflow:hidden;padding:2px;gap:2px">';
  html += btn('bar', type, 'switchGateChart(\'type\',\'bar\')');
  html += btn('∿',   type==='line'?'∿':'bar', 'switchGateChart(\'type\',\'line\')');
  html += '</div>';
  html += '<div style="display:flex;background:'+btnBg+';border:1px solid '+btnBdr+';border-radius:9px;overflow:hidden;padding:2px;gap:2px">';
  html += btn('7d',  period, 'switchGateChart(\'period\',\'7d\')');
  html += btn('30d', period, 'switchGateChart(\'period\',\'30d\')');
  html += btn('90d', period, 'switchGateChart(\'period\',\'90d\')');
  html += '</div>';
  html += '</div>';
  html += '</div>'; // header

  // KPIs
  html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);margin:14px 20px 0;background:'+kpiBg+';border:1px solid '+kpiBdr+';border-radius:12px;overflow:hidden">';
  html += kpiCell('●', tot,               'Visites',       accent,    false);
  html += kpiCell('◆', avg,               'Moy/jour',      '#FCD34D', false);
  html += kpiCell('▲', peak||'—',         'Pic',           '#A5B4FC', false);
  html += kpiCell('✓', sigR+'%',          'Signé',         signCol,   false);
  html += kpiCell('◷', avgDur?avgDur+'m':'—', 'Durée moy', '#38BDF8', true);
  html += '</div>';

  // Canvas
  html += '<div style="padding:14px 20px 4px;position:relative">';
  html += '<canvas id="'+canvasId+'" style="width:100%;height:180px;display:block;cursor:crosshair"></canvas>';
  html += '<div id="'+tipId+'" style="position:absolute;pointer-events:none;display:none;'
    +'background:rgba(8,16,28,.95);border:1px solid rgba(249,115,22,.25);border-radius:10px;'
    +'padding:8px 12px;font-size:11px;color:#fff;white-space:nowrap;z-index:99;'
    +'box-shadow:0 8px 24px rgba(0,0,0,.5)"></div>';
  html += '</div>';

  // Légende
  html += '<div style="padding:2px 20px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:3px;background:'+accent+';border-radius:2px"></div><span style="font-size:'+Math.round(10*fz)+'px;color:'+mutedCol+';font-family:Barlow,sans-serif">Visites</span></div>';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:14px;height:2px;background:'+signCol+';border-radius:2px;opacity:.6"></div><span style="font-size:'+Math.round(10*fz)+'px;color:'+mutedCol+';font-family:Barlow,sans-serif">Signées</span></div>';
  if (peakDay) html += '<span style="font-size:'+Math.round(10*fz)+'px;color:'+mutedCol+';margin-left:auto;font-family:Barlow,sans-serif">Pic · <b style="color:#FCD34D">'+peakDay+'</b></span>';
  else         html += '<span style="font-size:'+Math.round(10*fz)+'px;color:'+mutedCol+';margin-left:auto;font-style:italic;font-family:Barlow,sans-serif">Aucune donnée</span>';
  html += '</div>';

  html += '</div>'; // panel

  // ── Données pour drawGateCanvas ──
  window._gateChartData = { labels:labels, totals:totals, signed:signed, maxVal:maxVal,
    type:type, canvasId:canvasId, tipId:tipId,
    accent:accent, signCol:signCol, gridCol:gridCol, baseCol:baseCol,
    axisCol:axisCol, labelCol:labelCol, fz:fz };

  return html;
}

function switchGateChart(key, val) {
  if (key === 'period') _gateChartPeriod = val;
  if (key === 'type')   _gateChartType   = val;
  // Re-rendre uniquement le graphe
  var outer = document.querySelector('[data-gate-chart]');
  if (outer) {
    outer.outerHTML = renderGateFreqChart(_gateVisits);
    drawGateCanvas();
  } else {
    // fallback : re-rendre tout le registre
    var role = window._gateLastRole || 'HSE';
    renderGate(role);
  }
  drawGateCanvas();
}

function drawGateCanvas() {
  var D = window._gateChartData;
  if (!D) return;
  var canvas = document.getElementById(D.canvasId);
  if (!canvas) { setTimeout(drawGateCanvas, 50); return; }
  if (!canvas.offsetWidth) { setTimeout(drawGateCanvas, 50); return; }

  var tip = document.getElementById(D.tipId);
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var W   = canvas.offsetWidth;
  var H   = 180;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  var n      = D.labels.length;
  var maxY   = Math.max(D.maxVal, 1);
  var pad    = {l:30, r:10, t:14, b:34};
  var gw     = W - pad.l - pad.r;
  var gh     = H - pad.t - pad.b;
  var fz     = D.fz || 1;
  var accent = D.accent;
  var signC  = D.signCol;
  var totals = D.totals;
  var signed = D.signed;
  var labels = D.labels;

  function hexRgb(h) {
    return parseInt(h.slice(1,3),16)+','+parseInt(h.slice(3,5),16)+','+parseInt(h.slice(5,7),16);
  }
  var aRgb = hexRgb(accent), sRgb = hexRgb(signC);
  function vX(i) { return pad.l + i/(n-1||1)*gw; }
  function vY(v) { return pad.t + gh*(1 - v/maxY); }

  // Grille
  var step = maxY<=5?1:maxY<=10?2:maxY<=20?5:Math.ceil(maxY/4);
  for (var yv=0; yv<=maxY; yv+=step) {
    ctx.beginPath(); ctx.moveTo(pad.l,vY(yv)); ctx.lineTo(pad.l+gw,vY(yv));
    ctx.strokeStyle=D.gridCol; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle=D.axisCol; ctx.font=Math.round(8*fz)+'px Barlow,sans-serif';
    ctx.textAlign='right'; ctx.fillText(yv, pad.l-4, vY(yv)+3);
  }
  ctx.beginPath(); ctx.moveTo(pad.l,pad.t+gh); ctx.lineTo(pad.l+gw,pad.t+gh);
  ctx.strokeStyle=D.baseCol; ctx.lineWidth=1; ctx.stroke();

  // Labels X
  var skip = n<=7?1:n<=30?Math.ceil(n/7):Math.ceil(n/8);
  labels.forEach(function(lbl,i) {
    if (i%skip!==0 && i!==n-1) return;
    var x = D.type==='bar' ? pad.l+(i+.5)*gw/n : vX(i);
    ctx.fillStyle=D.axisCol; ctx.font=Math.round(9*fz)+'px Barlow,sans-serif';
    ctx.textAlign='center'; ctx.fillText(lbl, x, H-6);
  });

  if (D.type === 'bar') {
    var bw = gw/n*.72;
    totals.forEach(function(v,i) {
      var x = pad.l + i*gw/n + gw/n*.14;
      if (v===0) { ctx.fillStyle=D.gridCol; ctx.beginPath(); ctx.roundRect(x,pad.t+gh-2,bw,2,1); ctx.fill(); return; }
      var y=vY(v), bh=gh-(y-pad.t);
      var grd=ctx.createLinearGradient(x,y,x,pad.t+gh);
      grd.addColorStop(0,'rgba('+aRgb+',.9)'); grd.addColorStop(1,'rgba('+aRgb+',.08)');
      ctx.fillStyle=grd; ctx.beginPath(); ctx.roundRect(x,y,bw,bh,4); ctx.fill();
      ctx.fillStyle='rgba('+aRgb+',.3)'; ctx.beginPath(); ctx.roundRect(x,y,bw,3,2); ctx.fill();
      if (signed[i]>0) {
        var sy=vY(signed[i]), sbh=gh-(sy-pad.t);
        var g2=ctx.createLinearGradient(x,sy,x,pad.t+gh);
        g2.addColorStop(0,'rgba('+sRgb+',.45)'); g2.addColorStop(1,'rgba('+sRgb+',.02)');
        ctx.fillStyle=g2; ctx.beginPath(); ctx.roundRect(x,sy,bw,sbh,4); ctx.fill();
      }
      if (bh>16) { ctx.fillStyle=D.labelCol; ctx.font='bold '+Math.round(9*fz)+'px Barlow,sans-serif'; ctx.textAlign='center'; ctx.fillText(v,x+bw/2,y+11); }
    });
  } else {
    function smooth(pts,close,fg,stroke,sw,dash) {
      if (!pts.length) return;
      ctx.beginPath();
      pts.forEach(function(p,i) {
        if (i===0){ctx.moveTo(p[0],p[1]);return;}
        var pr=pts[i-1],cx=(pr[0]+p[0])/2;
        ctx.bezierCurveTo(cx,pr[1],cx,p[1],p[0],p[1]);
      });
      if (close) { ctx.lineTo(pts[pts.length-1][0],pad.t+gh); ctx.lineTo(pts[0][0],pad.t+gh); ctx.closePath(); ctx.fillStyle=fg; ctx.fill(); }
      else { if(dash)ctx.setLineDash(dash); ctx.strokeStyle=stroke; ctx.lineWidth=sw; ctx.lineJoin='round'; ctx.stroke(); ctx.setLineDash([]); }
    }
    var tP=totals.map(function(v,i){return[vX(i),vY(v)];}), sP=signed.map(function(v,i){return[vX(i),vY(v)];});
    var fg=ctx.createLinearGradient(0,pad.t,0,pad.t+gh); fg.addColorStop(0,'rgba('+aRgb+',.22)'); fg.addColorStop(1,'rgba('+aRgb+',0)');
    var sg=ctx.createLinearGradient(0,pad.t,0,pad.t+gh); sg.addColorStop(0,'rgba('+sRgb+',.12)'); sg.addColorStop(1,'rgba('+sRgb+',0)');
    smooth(tP,true,fg); smooth(sP,true,sg);
    smooth(tP,false,null,accent,2.5); smooth(sP,false,null,'rgba('+sRgb+',.6)',1.5,[4,3]);
    totals.forEach(function(v,i){if(!v)return; ctx.beginPath();ctx.arc(vX(i),vY(v),3.5,0,Math.PI*2); ctx.fillStyle=accent;ctx.fill(); ctx.strokeStyle='rgba(8,16,28,.8)';ctx.lineWidth=1.5;ctx.stroke();});
  }

  // Tooltip
  if (canvas._tipBound) return;
  canvas._tipBound = true;
  canvas.addEventListener('mousemove', function(e) {
    var r=canvas.getBoundingClientRect(), mx=e.clientX-r.left;
    var idx=-1;
    if (D.type==='bar') idx=Math.floor((mx-pad.l)/(gw/n));
    else { var md=9999; totals.forEach(function(_,i){var dx=Math.abs(vX(i)-mx);if(dx<md){md=dx;idx=i;}});}
    if (idx<0||idx>=n) { if(tip)tip.style.display='none'; return; }
    var v=totals[idx],s=signed[idx];
    if (tip) {
      tip.innerHTML='<div style="font-weight:700;color:'+accent+';margin-bottom:4px;font-size:12px">'+labels[idx]+'</div>'
        +'<div style="color:#9CA3AF;line-height:1.8">👥 <b style="color:#F1F5F9">'+v+'</b> visite'+(v!==1?'s':'')+'<br>✅ <b style="color:'+signC+'">'+s+'</b> signée'+(s!==1?'s':'')+' · '+(v?Math.round(s/v*100):0)+'%</div>';
      var cx=mx+14; if(cx+140>W)cx=mx-150;
      tip.style.left=cx+'px'; tip.style.top=(e.clientY-r.top-48)+'px'; tip.style.display='block';
    }
  });
  canvas.addEventListener('mouseleave', function(){if(tip)tip.style.display='none';});
}

function renderGateRegistre(role) {
  if (!_gateConfig) {
    return '<div class="empty-state" style="padding:40px">'
      + '<div class="empty-state-icon">🚪</div>'
      + '<div class="empty-state-text">Gate n\'est pas encore configuré<br>'
      + '<small>Commencez par renseigner les informations de votre site dans Configuration</small></div>'
      + '<button class="btn-sm btn-upload" style="margin-top:16px;padding:10px 20px" onclick="switchGateView(\'config\',\'' + role + '\')">⚙️ Configurer Gate</button>'
      + '</div>';
  }

  var now      = new Date();
  var todayStr = now.toDateString();
  var todayVisits = _gateVisits.filter(function(v) { return new Date(v.check_in).toDateString() === todayStr; });
  var present     = todayVisits.filter(function(v) { return !v.check_out; });
  var departed    = todayVisits.filter(function(v) { return !!v.check_out; });

  var html = '';
  html += renderGateFreqChart(_gateVisits);

  // ── Stats du jour ──
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">'
    + statCard('👥', present.length, 'Présents', '#4ADE80')
    + statCard('✅', departed.length, 'Sorties', '#94A3B8')
    + statCard('📅', todayVisits.length, 'Aujourd\'hui', '#F97316')
    + '</div>';

  // ── Présents maintenant ──
  if (present.length) {
    html += '<div class="section-card" style="margin-bottom:16px">';
    html += '<div class="section-title" style="color:#4ADE80">🟢 Sur site en ce moment (' + present.length + ')</div>';
    present.forEach(function(v) {
      html += visitRow(v, true, role);
    });
    html += '</div>';
  }

  // ── Filtres historique ──
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">'
    + '<span style="font-size:12px;font-weight:700;color:var(--muted)">Historique</span>'
    + '<input type="date" id="gateFilterDate" value="' + now.toISOString().slice(0,10) + '" '
    + 'onchange="filterGateHistory(\'' + role + '\')" '
    + 'style="padding:5px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:var(--text);font-size:12px">'
    + '<input type="text" id="gateFilterSearch" placeholder="Rechercher nom / société..." '
    + 'oninput="filterGateHistory(\'' + role + '\')" '
    + 'style="padding:5px 12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:var(--text);font-size:12px;width:200px">'
    + '<button class="btn-sm" style="padding:5px 12px;font-size:11px" onclick="exportGateCSV()">📥 Export CSV</button>'
    + '</div>';

  // ── Historique du jour ──
  html += '<div id="gateHistoryList">';
  html += renderGateHistoryList(departed.concat(
    _gateVisits.filter(function(v) { return new Date(v.check_in).toDateString() !== todayStr; }).slice(0, 50)
  ));
  html += '</div>';

  return html;
}

function statCard(icon, val, label, color) {
  return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;text-align:center">'
    + '<div style="font-size:22px;margin-bottom:4px">' + icon + '</div>'
    + '<div style="font-size:24px;font-weight:900;color:' + color + '">' + val + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + label + '</div>'
    + '</div>';
}

function visitRow(v, isPresent, role) {
  var checkInTime  = new Date(v.check_in).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  var checkInDate  = new Date(v.check_in).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  var duration     = v.check_out
    ? durationLabel(new Date(v.check_in), new Date(v.check_out))
    : durationLabel(new Date(v.check_in), new Date());

  return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;margin-bottom:6px;flex-wrap:wrap">'
    + '<div style="width:8px;height:8px;border-radius:50%;background:' + (isPresent ? '#4ADE80' : '#475569') + ';flex-shrink:0"></div>'
    + '<div style="flex:1;min-width:0">'
    + '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(v.visitor_name) + '</div>'
    + '<div style="font-size:11px;color:var(--muted)">' + escapeHtml(v.visitor_company || '—') + ' · ' + escapeHtml(v.visited_person || '—') + '</div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);text-align:right;flex-shrink:0">'
    + '<div>' + checkInDate + ' ' + checkInTime + (v.check_out ? ' → ' + new Date(v.check_out).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ' →  🟢') + '</div>'
    + '<div style="color:' + (isPresent ? '#FCD34D' : 'var(--muted)') + '">' + duration + '</div>'
    + '</div>'
    + (v.zone ? '<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:rgba(99,102,241,.15);color:#A5B4FC;border:1px solid rgba(99,102,241,.2);flex-shrink:0">' + escapeHtml(v.zone) + '</span>' : '')
    + (v.signed_at ? '<span style="font-size:10px;color:#4ADE80;flex-shrink:0">✅ Signé</span>' : '<span style="font-size:10px;color:#FCA5A5;flex-shrink:0">⚠️ Non signé</span>')
    + '<div style="display:flex;gap:4px;flex-shrink:0">'
    + (isPresent ? '<button class="btn-sm btn-validate" style="padding:4px 10px;font-size:11px" onclick="gateCheckOut(\'' + v.id + '\',\'' + (role||'HSE') + '\')">🚪 Check-out</button>' : '')
    + '<button class="btn-sm" style="padding:4px 10px;font-size:11px" onclick="showVisitDetail(\'' + v.id + '\')">👁</button>'
    + '<button onclick="gatePrintBadge(\'' + v.id + '\')" style="background:none;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:4px 8px;cursor:pointer;font-size:11px;color:var(--muted)">🪪</button>'
    + '</div>'
    + '</div>';
}

function renderGateHistoryList(visits) {
  if (!visits.length) return '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">Aucune visite</div></div>';
  return visits.map(function(v) { return visitRow(v, false, null); }).join('');
}

function durationLabel(from, to) {
  var mins = Math.round((to - from) / 60000);
  if (mins < 60) return mins + ' min';
  var h = Math.floor(mins / 60); var m = mins % 60;
  return h + 'h' + (m ? String(m).padStart(2,'0') : '');
}

function filterGateHistory(role) {
  var dateVal   = (document.getElementById('gateFilterDate') || {}).value || '';
  var searchVal = ((document.getElementById('gateFilterSearch') || {}).value || '').toLowerCase();
  var filtered  = _gateVisits.filter(function(v) {
    var matchDate   = !dateVal   || v.check_in.slice(0,10) === dateVal;
    var matchSearch = !searchVal || (v.visitor_name||'').toLowerCase().includes(searchVal)
                                 || (v.visitor_company||'').toLowerCase().includes(searchVal);
    return matchDate && matchSearch;
  });
  var el = document.getElementById('gateHistoryList');
  if (el) el.innerHTML = renderGateHistoryList(filtered);
}

// ══════════════════════════════════════════════════════════════
//  CHECK-IN MANUEL (depuis le dashboard)
// ══════════════════════════════════════════════════════════════
function renderGateCheckin(role) {
  var zones = (_gateConfig && _gateConfig.zones) ? _gateConfig.zones : ['Accueil', 'Atelier', 'Bureau', 'Entrepôt'];

  return '<div class="section-card" style="max-width:560px">'
    + '<div class="section-title">➕ Enregistrer un visiteur</div>'
    + '<div class="section-subtitle">Check-in manuel depuis le poste d\'accueil</div>'
    + '<div style="display:flex;flex-direction:column;gap:14px;margin-top:20px">'

    + formField('Nom et prénom *', 'text', 'gci_name', 'Ex : Jean Dupont')
    + formField('Société / Organisation', 'text', 'gci_company', 'Ex : ACME Industries')
    + formField('Personne visitée *', 'text', 'gci_host', 'Ex : M. Martin — Responsable production')

    + '<div><label style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;display:block">Zone du site</label>'
    + '<select id="gci_zone" style="width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--text);font-size:13px">'
    + zones.map(function(z) { return '<option value="' + escapeHtml(z) + '">' + escapeHtml(z) + '</option>'; }).join('')
    + '</select></div>'

    + formField('Motif de la visite', 'text', 'gci_purpose', 'Ex : Livraison, Maintenance, Réunion...')
    + formField('Email visiteur (optionnel)', 'email', 'gci_email', 'pour envoi du badge')
    + formField('Téléphone (optionnel)', 'tel', 'gci_phone', '')

    + '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.15);border-radius:10px;padding:12px">'
    + '<input type="checkbox" id="gci_signed" style="margin-top:2px;width:16px;height:16px;accent-color:#4ADE80;flex-shrink:0">'
    + '<span style="font-size:12px;color:#CBD5E1;line-height:1.5">Le visiteur a <strong>pris connaissance des consignes de sécurité</strong> du site et s\'engage à les respecter.</span>'
    + '</label>'

    + '<button class="btn-validate" style="padding:12px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;width:100%;margin-top:4px" onclick="submitGateCheckin(\'' + role + '\')">✅ Enregistrer l\'arrivée</button>'
    + '</div></div>';
}

function formField(label, type, id, placeholder) {
  return '<div><label style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px;display:block">' + label + '</label>'
    + '<input type="' + type + '" id="' + id + '" placeholder="' + escapeHtml(placeholder) + '" '
    + 'style="width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--text);font-size:13px;box-sizing:border-box">'
    + '</div>';
}

async function submitGateCheckin(role) {
  var name    = (document.getElementById('gci_name')    || {}).value || '';
  var company = (document.getElementById('gci_company') || {}).value || '';
  var host    = (document.getElementById('gci_host')    || {}).value || '';
  var zone    = (document.getElementById('gci_zone')    || {}).value || '';
  var purpose = (document.getElementById('gci_purpose') || {}).value || '';
  var email   = (document.getElementById('gci_email')   || {}).value || '';
  var phone   = (document.getElementById('gci_phone')   || {}).value || '';
  var signed  = (document.getElementById('gci_signed')  || {}).checked || false;

  if (!name.trim())  { showToast('Le nom du visiteur est obligatoire', 'error'); return; }
  if (!host.trim())  { showToast('La personne visitée est obligatoire', 'error'); return; }

  var entry = {
    org_id         : currentProfile.org_id,
    visitor_name   : name.trim(),
    visitor_company: company.trim(),
    visited_person : host.trim(),
    zone           : zone,
    purpose        : purpose.trim(),
    visitor_email  : email.trim(),
    visitor_phone  : phone.trim(),
    check_in       : new Date().toISOString(),
    status         : 'present',
    signed_at      : signed ? new Date().toISOString() : null,
    created_by     : currentUser.id,
    entry_method   : 'manual'
  };

  var res = await sb.from('visitor_log').insert(entry).select().single();
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  showToast('✅ ' + name + ' enregistré(e) — bienvenue !', 'success');
  _gateVisits.unshift(res.data);

  // Proposer impression badge
  if (confirm('Visiteur enregistré !\nImprimer le badge d\'accès ?')) {
    gatePrintBadge(res.data.id);
  }

  _gateSubView = 'registre';
  renderGate(role);
}

// ══════════════════════════════════════════════════════════════
//  CHECK-OUT
// ══════════════════════════════════════════════════════════════
async function gateCheckOut(visitId, role) {
  var now = new Date().toISOString();
  var res = await sb.from('visitor_log').update({ check_out: now, status: 'departed' }).eq('id', visitId).select().single();
  if (res.error) { showToast('Erreur check-out : ' + res.error.message, 'error'); return; }

  _gateVisits = _gateVisits.map(function(v) { return v.id === visitId ? res.data : v; });
  showToast('🚪 Check-out enregistré', 'success');
  renderGate(role || 'HSE');
}

// ══════════════════════════════════════════════════════════════
//  CONFIGURATION GATE
// ══════════════════════════════════════════════════════════════

// ── Bloc activation Gate pour HSE/Company admin ───────────────
function renderGateActivationToggle(role) {
  // Priorité : gate_config.active (chargé par loadGate) > _gateActivated (boot)
  var active = (_gateConfig && _gateConfig.active === true) ? true
             : (typeof _gateActivated !== 'undefined') ? _gateActivated : false;

  return '<div class="section-card" style="border-color:rgba(' + (active ? '74,222,128' : '249,115,22') + ',.25)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + '<div style="width:48px;height:48px;border-radius:14px;background:rgba(' + (active ? '74,222,128' : '249,115,22') + ',.12);border:1px solid rgba(' + (active ? '74,222,128' : '249,115,22') + ',.25);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🚪</div>'
    + '<div>'
    + '<div style="font-size:14px;font-weight:900;color:#fff">SafetySphere Gate</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">Registre sécurité des visiteurs · Check-in/out · QR Code · Badge PDF</div>'
    + '</div>'
    + '</div>'
    + '<div style="display:flex;align-items:center;gap:12px">'
    + '<span style="font-size:12px;font-weight:700;color:' + (active ? '#4ADE80' : '#F97316') + '">' + (active ? '✅ Module actif' : '○ Module inactif') + '</span>'
    + '<label style="position:relative;display:inline-block;width:52px;height:28px;cursor:pointer">'
    + '<input type="checkbox" id="gateActivationToggle" ' + (active ? 'checked' : '') + ' onchange="toggleGateActivation(\'' + role + '\',this.checked)" style="opacity:0;width:0;height:0;position:absolute">'
    + '<span id="gateToggleTrack" style="position:absolute;inset:0;border-radius:28px;transition:.3s;background:' + (active ? '#4ADE80' : 'rgba(255,255,255,.1)') + ';border:1px solid rgba(255,255,255,.15)"></span>'
    + '<span id="gateToggleThumb" style="position:absolute;top:4px;left:' + (active ? '26px' : '4px') + ';width:20px;height:20px;border-radius:50%;background:#fff;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>'
    + '</label>'
    + '</div>'
    + '</div>'
    + (active ? '' : '<div style="margin-top:10px;padding:10px 12px;background:rgba(249,115,22,.06);border-radius:8px;font-size:11px;color:#FCD34D">⚠️ Gate est désactivé — les onglets Registre visiteurs sont masqués pour votre organisation.</div>')
    + '</div>';
}

async function toggleGateActivation(role, enabled) {
  // Mettre à jour l'UI immédiatement
  var track = document.getElementById('gateToggleTrack');
  var thumb = document.getElementById('gateToggleThumb');
  if (track) track.style.background = enabled ? '#4ADE80' : 'rgba(255,255,255,.1)';
  if (thumb) thumb.style.left = enabled ? '26px' : '4px';

  // Récupérer la config existante en base
  var existingRes = await sb.from('gate_config').select('id').eq('org_id', currentProfile.org_id).maybeSingle();
  var existingId  = existingRes.data ? existingRes.data.id : null;

  var res;
  if (existingId) {
    // Mettre à jour active dans gate_config
    res = await sb.from('gate_config').update({ active: enabled, updated_at: new Date().toISOString() }).eq('id', existingId);
  } else {
    // Créer une config minimale
    res = await sb.from('gate_config').insert({
      org_id    : currentProfile.org_id,
      site_name : currentProfile.company_name || 'Site principal',
      active    : enabled,
      zones     : ['Accueil', 'Atelier', 'Bureau', 'Entrepôt']
    });
  }

  if (res.error) {
    showToast('Erreur : ' + res.error.message, 'error');
    var chk = document.getElementById('gateActivationToggle');
    if (chk) chk.checked = !enabled;
    return;
  }

  _gateActivated = enabled;
  updateGateTabVisibility(enabled);
  showToast(enabled ? '✅ Gate activé pour votre organisation' : '○ Gate désactivé', enabled ? 'success' : 'info');

  // Recharger Gate complètement
  _gateSubView = 'config';
  _gateConfig  = null;
  _gateVisits  = [];
  loadGate(role);
}

function renderGateConfig(role) {
  var cfg = _gateConfig || {};
  var zones = (cfg.zones || ['Accueil','Atelier','Bureau','Entrepôt','Quai','Zone extérieure']).join('\n');

  return '<div style="display:flex;flex-direction:column;gap:16px;max-width:640px">'

    // ── Bloc activation Gate ──
    + renderGateActivationToggle(role)

    // ── Infos site ──
    + '<div class="section-card">'
    + '<div class="section-title">🏭 Informations du site</div>'
    + '<div style="display:flex;flex-direction:column;gap:12px;margin-top:16px">'
    + formField('Nom du site *', 'text', 'gcfg_site', 'Ex : Site de production Nord')
    + formField('Email de notification arrivées', 'email', 'gcfg_email', 'accueil@entreprise.fr')
    + formField('Message d\'accueil (affiché au visiteur)', 'text', 'gcfg_welcome', 'Bienvenue ! Merci de vous équiper d\'un EPI...')
    + '<div id="gcfg_site" style="display:none"></div>'
    + '</div>'
    + '</div>'

    // ── Zones ──
    + '<div class="section-card">'
    + '<div class="section-title">📍 Zones du site</div>'
    + '<div class="section-subtitle">Une zone par ligne</div>'
    + '<textarea id="gcfg_zones" rows="6" style="width:100%;margin-top:12px;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box;font-family:\'Barlow\',sans-serif">' + escapeHtml(zones) + '</textarea>'
    + '</div>'

    // ── Consignes sécurité ──
    + '<div class="section-card">'
    + '<div class="section-title">⚠️ Consignes de sécurité</div>'
    + '<div class="section-subtitle">Affichées au visiteur avant signature — HTML supporté</div>'
    + '<textarea id="gcfg_instructions" rows="10" style="width:100%;margin-top:12px;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--text);font-size:12px;resize:vertical;box-sizing:border-box;font-family:monospace">' + escapeHtml(cfg.safety_instructions || defaultSafetyInstructions()) + '</textarea>'
    + '</div>'

    // ── QR Code ──
    + '<div class="section-card">'
    + '<div class="section-title">📱 QR Code d\'accueil</div>'
    + '<div class="section-subtitle">À afficher à l\'entrée du site — les visiteurs scannent pour s\'enregistrer en autonomie</div>'
    + '<div style="margin-top:16px;text-align:center">'
    + '<canvas id="gateQrCanvas" style="border-radius:12px;background:#fff;padding:12px"></canvas>'
    + '<div style="margin-top:10px;font-size:11px;color:var(--muted)" id="gateQrUrl">—</div>'
    + '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">'
    + '<button class="btn-sm btn-upload" style="padding:7px 16px;font-size:12px" onclick="downloadGateQR()">⬇️ Télécharger QR</button>'
    + '<button class="btn-sm" style="padding:7px 16px;font-size:12px" onclick="copyGateLink()">🔗 Copier le lien</button>'
    + '</div></div></div>'

    + '<button class="btn-validate" style="padding:12px;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;width:100%" onclick="saveGateConfig(\'' + role + '\')">💾 Enregistrer la configuration</button>'
    + '</div>';
}

function defaultSafetyInstructions() {
  return '<h3>⚠️ Consignes de sécurité — Site industriel</h3>'
    + '<ul>'
    + '<li>Port des EPI obligatoire dans les zones de production (casque, gilet, chaussures de sécurité)</li>'
    + '<li>Respectez le plan de circulation et les marquages au sol</li>'
    + '<li>Interdiction de fumer sur l\'ensemble du site</li>'
    + '<li>En cas d\'alarme incendie : évacuez immédiatement par les issues de secours</li>'
    + '<li>Point de rassemblement : <strong>parking visiteurs</strong></li>'
    + '<li>Vitesse limitée à 10 km/h sur le site</li>'
    + '<li>Ne pénétrez pas dans les zones non autorisées sans accompagnement</li>'
    + '<li>Signalez tout incident ou situation dangereuse à l\'accueil</li>'
    + '</ul>';
}

async function saveGateConfig(role) {
  var siteName     = '';
  var notifyEmail  = '';
  var welcome      = '';
  var zonesRaw     = (document.getElementById('gcfg_zones')        || {}).value || '';
  var instructions = (document.getElementById('gcfg_instructions') || {}).value || '';

  // Récupérer les champs par placeholder (les IDs étaient en conflit)
  var siteInput    = document.querySelector('input[placeholder="Ex : Site de production Nord"]');
  var welcomeInput = document.querySelector('input[placeholder*="Bienvenue"]');
  var emailInput   = document.querySelector('input[placeholder="accueil@entreprise.fr"]');
  if (siteInput)    siteName    = siteInput.value;
  if (welcomeInput) welcome     = welcomeInput.value;
  if (emailInput)   notifyEmail = emailInput.value;

  var zones = zonesRaw.split('\n').map(function(z){ return z.trim(); }).filter(Boolean);

  // Toujours récupérer la config existante en base avant d'écrire
  var existingRes = await sb.from('gate_config').select('id').eq('org_id', currentProfile.org_id).maybeSingle();
  var existingId  = existingRes.data ? existingRes.data.id : null;
  if (existingId && (!_gateConfig || !_gateConfig.id)) {
    _gateConfig = { id: existingId };
  }

  var payload = {
    org_id               : currentProfile.org_id,
    site_name            : siteName.trim() || 'Site principal',
    notify_email         : notifyEmail.trim(),
    welcome_message      : welcome.trim(),
    zones                : zones,
    safety_instructions  : instructions,
    active               : true,
    updated_at           : new Date().toISOString()
  };

  var res;
  if (_gateConfig && _gateConfig.id) {
    res = await sb.from('gate_config').update(payload).eq('id', _gateConfig.id).select().single();
  } else {
    res = await sb.from('gate_config').insert(payload).select().single();
  }

  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  _gateConfig = res.data;
  showToast('\u2705 Configuration Gate enregistrée', 'success');
  _gateSubView = 'registre';
  renderGate(role);
}

// ══════════════════════════════════════════════════════════════
//  QR CODE & LIEN D'ACCUEIL
// ══════════════════════════════════════════════════════════════
function getGateUrl() {
  return window.location.origin + window.location.pathname + '?gate=' + currentProfile.org_id;
}

function showGateQR() {
  var url = getGateUrl();
  // Modale QR
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  modal.innerHTML = '<div style="background:#1E2D3D;border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px;max-width:380px;width:90%;text-align:center">'
    + '<div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:4px">📱 QR Code d\'accueil</div>'
    + '<div style="font-size:12px;color:#94A3B8;margin-bottom:20px">À afficher à l\'entrée du site</div>'
    + '<canvas id="gateModalQr" style="background:#fff;border-radius:12px;padding:12px;margin-bottom:16px"></canvas>'
    + '<div style="font-size:11px;color:#64748B;word-break:break-all;margin-bottom:16px">' + escapeHtml(url) + '</div>'
    + '<div style="display:flex;gap:8px;justify-content:center">'
    + '<button onclick="downloadGateQRModal()" style="padding:9px 18px;background:#F97316;border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:13px">⬇️ Télécharger</button>'
    + '<button onclick="copyGateLink()" style="padding:9px 18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:13px">🔗 Copier</button>'
    + '<button onclick="gatePrintQRPage()" style="padding:9px 18px;background:rgba(99,102,241,.2);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:#A5B4FC;font-weight:700;cursor:pointer;font-size:13px">🖨️ Imprimer</button>'
    + '</div>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="margin-top:16px;background:none;border:none;color:#64748B;cursor:pointer;font-size:12px">✕ Fermer</button>'
    + '</div>';

  document.body.appendChild(modal);
  setTimeout(function() { renderQRCode('gateModalQr', url, 200); }, 100);
}

function renderQRCode(canvasId, url, size) {
  // QR Code via API Google Charts (pas de lib externe requise)
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    canvas.width  = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
  };
  img.onerror = function() {
    // Fallback texte si API indisponible
    canvas.width = size; canvas.height = size;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,size,size);
    ctx.fillStyle = '#1E2D3D'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('QR Code', size/2, size/2 - 6);
    ctx.font = '9px monospace';
    ctx.fillText(url.slice(0, 40), size/2, size/2 + 10);
  };
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(url) + '&bgcolor=ffffff&color=0D1B2A&margin=1';
}

function downloadGateQRModal() {
  var canvas = document.getElementById('gateModalQr');
  if (!canvas) return;
  var a = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = 'SafetySphere-Gate-QR.png';
  a.click();
}

function downloadGateQR() {
  var canvas = document.getElementById('gateQrCanvas');
  if (!canvas) return;
  var a = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = 'SafetySphere-Gate-QR.png';
  a.click();
}

function copyGateLink() {
  var url = getGateUrl();
  navigator.clipboard.writeText(url).then(function() {
    showToast('🔗 Lien copié !', 'success');
  });
}

function gatePrintQRPage() {
  var url  = getGateUrl();
  var site = (_gateConfig && _gateConfig.site_name) || 'Site';
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>QR Gate - ' + escapeHtml(site) + '</title>'
    + '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Segoe UI",sans-serif;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px}'
    + '.logo{font-size:28px;font-weight:900;margin-bottom:8px}span.o{color:#F97316}'
    + 'h1{font-size:22px;font-weight:700;margin-bottom:6px;color:#1E293B}'
    + 'p{font-size:14px;color:#64748B;margin-bottom:24px;text-align:center}'
    + 'img{width:240px;height:240px;border:4px solid #F97316;border-radius:16px;padding:8px}'
    + '.url{margin-top:16px;font-size:11px;color:#94A3B8;word-break:break-all;max-width:300px;text-align:center}'
    + '.footer{margin-top:32px;font-size:12px;color:#CBD5E1}'
    + '</style></head><body>'
    + '<div class="logo">Safety<span class="o">Sphere</span> Gate</div>'
    + '<h1>📱 Registre visiteurs</h1>'
    + '<p>Scannez le QR code pour vous enregistrer<br>et prendre connaissance des consignes de sécurité</p>'
    + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=' + encodeURIComponent(url) + '&bgcolor=ffffff&color=0D1B2A&margin=2">'
    + '<div class="url">' + escapeHtml(url) + '</div>'
    + '<div class="footer">Site : ' + escapeHtml(site) + ' · SafetySphere v2.0</div>'
    + '</body></html>';

  var w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(function() { w.print(); }, 800);
}

// ══════════════════════════════════════════════════════════════
//  BADGE VISITEUR PDF / IMPRESSION
// ══════════════════════════════════════════════════════════════
function gatePrintBadge(visitId) {
  var v    = _gateVisits.find(function(x) { return x.id === visitId; });
  if (!v) return;
  var site = (_gateConfig && _gateConfig.site_name) || 'Site';
  var checkInFmt = new Date(v.check_in).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });
  var checkoutUrl = window.location.origin + window.location.pathname + '?gate_out=' + v.id;

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Badge — ' + escapeHtml(v.visitor_name) + '</title>'
    + '<style>'
    + '@page{size:A5 landscape;margin:0}'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:"Segoe UI",sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;print-color-adjust:exact;-webkit-print-color-adjust:exact}'
    + '.badge{width:148mm;border:3px solid #F97316;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}'
    + '.badge-header{background:linear-gradient(135deg,#0D1B2A,#1E3A5F);padding:14px 18px;display:flex;align-items:center;justify-content:space-between}'
    + '.logo{font-size:16px;font-weight:900;color:#fff}span.o{color:#F97316}'
    + '.badge-site{font-size:11px;color:#94A3B8}'
    + '.badge-body{padding:16px 18px;background:#fff}'
    + '.badge-type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#F97316;margin-bottom:6px}'
    + '.badge-name{font-size:22px;font-weight:900;color:#1E293B;margin-bottom:2px}'
    + '.badge-company{font-size:13px;color:#64748B;margin-bottom:12px}'
    + '.badge-row{display:flex;gap:6px;align-items:baseline;font-size:12px;margin-bottom:4px;color:#475569}'
    + '.badge-row strong{color:#1E293B;font-size:13px}'
    + '.badge-footer{background:#F8FAFC;border-top:1px solid #E2E8F0;padding:10px 18px;display:flex;align-items:center;justify-content:space-between}'
    + '.badge-sig{font-size:10px;color:' + (v.signed_at ? '#16A34A' : '#DC2626') + ';font-weight:700}'
    + '.badge-id{font-size:9px;color:#94A3B8;font-family:monospace}'
    + 'img.qr{width:64px;height:64px;border:1px solid #E2E8F0;border-radius:6px;padding:2px}'
    + '@media print{body{margin:0}.badge{box-shadow:none}}'
    + '</style></head><body>'
    + '<div class="badge">'
    + '<div class="badge-header">'
    + '<div><div class="logo">Safety<span class="o">Sphere</span> Gate</div><div class="badge-site">' + escapeHtml(site) + '</div></div>'
    + '<div style="text-align:right"><div style="font-size:28px">🪪</div></div>'
    + '</div>'
    + '<div class="badge-body" style="display:flex;gap:16px;align-items:flex-start">'
    + '<div style="flex:1">'
    + '<div class="badge-type">Badge visiteur · ACCÈS TEMPORAIRE</div>'
    + '<div class="badge-name">' + escapeHtml(v.visitor_name) + '</div>'
    + '<div class="badge-company">' + escapeHtml(v.visitor_company || '—') + '</div>'
    + '<div class="badge-row"><span>👤 Visite :</span><strong>' + escapeHtml(v.visited_person || '—') + '</strong></div>'
    + (v.zone ? '<div class="badge-row"><span>📍 Zone :</span><strong>' + escapeHtml(v.zone) + '</strong></div>' : '')
    + (v.purpose ? '<div class="badge-row"><span>📋 Motif :</span><strong>' + escapeHtml(v.purpose) + '</strong></div>' : '')
    + '<div class="badge-row"><span>🕐 Arrivée :</span><strong>' + checkInFmt + '</strong></div>'
    + '</div>'
    + '<div style="text-align:center;flex-shrink:0">'
    + '<img class="qr" src="https://api.qrserver.com/v1/create-qr-code/?size=64x64&data=' + encodeURIComponent(checkoutUrl) + '&bgcolor=ffffff&color=0D1B2A&margin=1" alt="QR Check-out">'
    + '<div style="font-size:9px;color:#94A3B8;margin-top:3px">Scan → Check-out</div>'
    + '</div>'
    + '</div>'
    + '<div class="badge-footer">'
    + '<div class="badge-sig">' + (v.signed_at ? '✅ Consignes signées' : '⚠️ Consignes non signées') + '</div>'
    + '<div class="badge-id">Réf : ' + v.id.slice(0,8).toUpperCase() + '</div>'
    + '</div>'
    + '</div>'
    + '<script>window.onload=function(){window.print()}<\/script>'
    + '</body></html>';

  var w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
}

// ══════════════════════════════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportGateCSV() {
  var rows = [['Date', 'Heure arrivée', 'Heure départ', 'Durée (min)', 'Nom', 'Société', 'Visite', 'Zone', 'Motif', 'Consignes signées', 'Méthode']];
  _gateVisits.forEach(function(v) {
    var dur = v.check_out ? Math.round((new Date(v.check_out) - new Date(v.check_in)) / 60000) : '';
    rows.push([
      new Date(v.check_in).toLocaleDateString('fr-FR'),
      new Date(v.check_in).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'}),
      v.check_out ? new Date(v.check_out).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : '',
      dur,
      v.visitor_name || '',
      v.visitor_company || '',
      v.visited_person || '',
      v.zone || '',
      v.purpose || '',
      v.signed_at ? 'Oui' : 'Non',
      v.entry_method || 'manual'
    ]);
  });

  var csv = rows.map(function(r) {
    return r.map(function(c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(';');
  }).join('\n');

  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'gate-registre-' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════════════════════
//  PAGE PUBLIQUE VISITEUR (QR Code → ?gate=ORG_ID)
// ══════════════════════════════════════════════════════════════
async function loadPublicGatePage(orgId) {
  // Charger la config de l'org
  var cfgRes = await sb.from('gate_config')
    .select('*').eq('org_id', orgId).eq('active', true).maybeSingle();

  if (!cfgRes.data) {
    document.open(); document.write(gateErrorPage('Ce site n\'est pas configuré pour l\'accueil en ligne.')); document.close();
    return;
  }

  var html = gatePublicFormHTML(cfgRes.data, orgId);
  document.open();
  document.write(html);
  document.close();
}

async function loadPublicGateCheckout(visitId) {
  var res = await sb.from('visitor_log').select('*').eq('id', visitId).maybeSingle();
  if (!res.data) { document.open(); document.write(gateErrorPage('Visite introuvable.')); document.close(); return; }

  var v = res.data;
  if (v.check_out) {
    document.open(); document.write(gateAlreadyOutPage(v)); document.close();
    return;
  }

  // Check-out automatique
  await sb.from('visitor_log').update({ check_out: new Date().toISOString(), status: 'departed' }).eq('id', visitId);
  document.open(); document.write(gateCheckoutConfirmPage(v)); document.close();
}

function gatePublicFormHTML(cfg, orgId) {
  var zones = (cfg.zones || ['Accueil']).map(function(z) {
    return '<option value="' + escapeHtml(z) + '">' + escapeHtml(z) + '</option>';
  }).join('');

  return '<!DOCTYPE html><html lang="fr"><head>'
    + '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Accueil visiteurs — ' + escapeHtml(cfg.site_name || 'Site') + '</title>'
    + gatePublicCSS()
    + '</head><body>'
    + '<div class="ss-header">'
    + '<div class="ss-logo">S</div>'
    + '<div><div class="ss-brand">Safety<span>Sphere</span> Gate</div>'
    + '<div class="ss-sub">Registre sécurité des visiteurs</div></div>'
    + '<div style="margin-left:auto;font-size:12px;color:#94A3B8">' + escapeHtml(cfg.site_name || '') + '</div>'
    + '</div>'
    + '<div class="ss-wrap">'

    // Message d'accueil
    + (cfg.welcome_message ? '<div class="welcome-box"><span style="font-size:20px">👋</span><span>' + escapeHtml(cfg.welcome_message) + '</span></div>' : '')

    // Étape 1 : Formulaire
    + '<div id="gateStep1">'
    + '<div class="card" style="margin-bottom:16px">'
    + '<div class="card-title">① Vos informations</div>'
    + '<div class="field-group">'
    + pubField('Nom et prénom *', 'text', 'pub_name', 'Jean Dupont', true)
    + pubField('Société / Organisation', 'text', 'pub_company', 'ACME Industries', false)
    + pubField('Personne visitée *', 'text', 'pub_host', 'M. Martin', true)
    + pubField('Email (pour recevoir votre badge)', 'email', 'pub_email', 'vous@email.fr', false)
    + '<div class="field"><label>Zone du site</label>'
    + '<select id="pub_zone" class="input">' + zones + '</select></div>'
    + pubField('Motif de la visite', 'text', 'pub_purpose', 'Livraison, Maintenance, Réunion...', false)
    + '</div></div>'

    // Étape 2 : Consignes
    + '<div class="card" id="gateConsignesCard">'
    + '<div class="card-title">② Consignes de sécurité</div>'
    + '<div class="card-sub">Lisez attentivement avant de signer</div>'
    + '<div id="gateConsignes" style="background:#fff;border-radius:8px;padding:16px;color:#1E293B;font-size:13px;line-height:1.7;max-height:300px;overflow-y:auto;margin:12px 0;border:1px solid #E2E8F0">'
    + (cfg.safety_instructions || defaultSafetyInstructions())
    + '</div>'
    + '<div class="progress-wrap"><div id="gateReadProgress" style="font-size:11px;color:#FCD34D;font-weight:600">Défilement : 0%</div></div>'
    + '<label id="gateSignLabel" class="sign-gate locked">'
    + '<input type="checkbox" id="gateSigned" disabled>'
    + '<span>J\'ai <strong>lu et accepté</strong> les consignes de sécurité du site. Je m\'engage à les respecter.</span>'
    + '</label>'
    + '</div>'

    + '<button id="gateSubmitBtn" disabled onclick="submitPublicGate(\'' + escapeHtml(orgId) + '\')" class="btn-primary" style="margin-top:16px;opacity:.5">✅ M\'enregistrer</button>'
    + '</div>'

    // Succès (masqué)
    + '<div id="gateSuccess" style="display:none;text-align:center;padding:32px 0">'
    + '<div style="font-size:64px;margin-bottom:16px">✅</div>'
    + '<div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:8px">Bienvenue !</div>'
    + '<div style="font-size:13px;color:#94A3B8;margin-bottom:24px" id="gateSuccessDetail">—</div>'
    + '<div id="gateBadgeQR" style="margin-bottom:16px"></div>'
    + '<button onclick="gatePrintVisitorBadge()" class="btn-primary" style="max-width:280px;margin:0 auto">🪪 Imprimer mon badge</button>'
    + '</div>'
    + '</div>'

    + '<script>'
    + '(function(){'
    + '  var scrolled=false;'
    + '  function unlock(){'
    + '    if(scrolled)return;scrolled=true;'
    + '    var p=document.getElementById(\"gateReadProgress\");'
    + '    var c=document.getElementById(\"gateSigned\");'
    + '    var l=document.getElementById(\"gateSignLabel\");'
    + '    if(p)p.textContent=\"✅ Lu complet\";'
    + '    if(c){c.disabled=false;c.addEventListener(\"change\",check);}'
    + '    if(l)l.className=\"sign-gate unlocked\";'
    + '  }'
    + '  function check(){'
    + '    var n=document.getElementById(\"pub_name\"),h=document.getElementById(\"pub_host\"),'
    + '        s=document.getElementById(\"gateSigned\"),b=document.getElementById(\"gateSubmitBtn\");'
    + '    var ok=s&&s.checked&&n&&n.value.trim()&&h&&h.value.trim();'
    + '    if(b){b.disabled=!ok;b.style.opacity=ok?\"1\":\"0.5\";}'
    + '  }'
    + '  window.updateGateSubmitBtn=check;'
    + '  function init(){'
    + '    var el=document.getElementById(\"gateConsignes\");'
    + '    if(!el){setTimeout(init,50);return;}'
    + '    if(el.scrollHeight<=el.clientHeight+10){unlock();return;}'
    + '    el.addEventListener(\"scroll\",function(){'
    + '      var pct=Math.min(100,Math.round((el.scrollTop+el.clientHeight)/el.scrollHeight*100));'
    + '      var p=document.getElementById(\"gateReadProgress\");'
    + '      if(p)p.textContent=\"Défilement : \"+pct+\"%\";'
    + '      if(pct>=80)unlock();'
    + '    });'
    + '    [\"pub_name\",\"pub_host\"].forEach(function(id){'
    + '      var e=document.getElementById(id);'
    + '      if(e)e.addEventListener(\"input\",check);'
    + '    });'
    + '  }'
    + '  init();'
    + '})();'
    + '<\/script>'
    + '</body></html>';
}

function pubField(label, type, id, placeholder, required) {
  return '<div class="field"><label>' + label + '</label>'
    + '<input type="' + type + '" id="' + id + '" placeholder="' + escapeHtml(placeholder) + '" class="input"'
    + (required ? ' required' : '') + '></div>';
}

// ── Scroll tracker page publique visiteur (attaché après rendu DOM) ──
var _gateScrolled = false;

function setupGatePublicScroll() {
  _gateScrolled = false;
  window._gateVisitId   = null;
  window._gateVisitData = null;

  var consignes = document.getElementById('gateConsignes');
  var progress  = document.getElementById('gateReadProgress');
  var chk       = document.getElementById('gateSigned');
  var lbl       = document.getElementById('gateSignLabel');
  var submitBtn = document.getElementById('gateSubmitBtn');

  if (!consignes) return;

  // Vérifier si le contenu est assez court pour ne pas nécessiter de scroll
  function checkScrollNeeded() {
    if (consignes.scrollHeight <= consignes.clientHeight + 10) {
      // Pas assez de contenu pour scroller — débloquer directement
      unlockSignature();
    }
  }

  function unlockSignature() {
    if (_gateScrolled) return;
    _gateScrolled = true;
    if (progress) progress.textContent = '✅ Lu complet';
    if (chk) {
      chk.disabled = false;
      chk.addEventListener('change', updateGateSubmitBtn);
    }
    if (lbl) lbl.className = 'sign-gate unlocked';
  }

  function updateGateSubmitBtn() {
    var ok = chk && chk.checked
      && (document.getElementById('pub_name')  || {value:''}).value.trim()
      && (document.getElementById('pub_host')  || {value:''}).value.trim();
    if (submitBtn) {
      submitBtn.disabled    = !ok;
      submitBtn.style.opacity = ok ? '1' : '0.5';
    }
  }

  window.updateGateSubmitBtn = updateGateSubmitBtn;

  consignes.addEventListener('scroll', function() {
    var pct = Math.min(100, Math.round(
      (consignes.scrollTop + consignes.clientHeight) / consignes.scrollHeight * 100
    ));
    if (progress) progress.textContent = 'Défilement : ' + pct + '%';
    if (pct >= 80) unlockSignature();
  });

  // Attacher les inputs nom + hôte
  ['pub_name', 'pub_host'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('input', updateGateSubmitBtn);
  });

  // Vérifier immédiatement si scroll nécessaire
  checkScrollNeeded();
}

async function submitPublicGate(orgId) {
  var name    = (document.getElementById('pub_name')    || {}).value || '';
  var company = (document.getElementById('pub_company') || {}).value || '';
  var host    = (document.getElementById('pub_host')    || {}).value || '';
  var email   = (document.getElementById('pub_email')   || {}).value || '';
  var zone    = (document.getElementById('pub_zone')    || {}).value || '';
  var purpose = (document.getElementById('pub_purpose') || {}).value || '';

  if (!name.trim() || !host.trim()) return;

  var btn = document.getElementById('gateSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enregistrement...'; }

  var entry = {
    org_id         : orgId,
    visitor_name   : name.trim(),
    visitor_company: company.trim(),
    visited_person : host.trim(),
    visitor_email  : email.trim(),
    zone           : zone,
    purpose        : purpose.trim(),
    check_in       : new Date().toISOString(),
    status         : 'present',
    signed_at      : new Date().toISOString(),
    entry_method   : 'qr_code'
  };

  var res = await sb.from('visitor_log').insert(entry).select().single();
  if (res.error) {
    alert('Erreur : ' + res.error.message);
    if (btn) { btn.disabled = false; btn.textContent = '✅ M\'enregistrer'; }
    return;
  }

  // Stocker pour le badge
  if (typeof _gateVisitId !== 'undefined') { _gateVisitId = res.data.id; _gateVisitData = res.data; }
  window._gateVisitId   = res.data.id;
  window._gateVisitData = res.data;

  // Afficher succès
  document.getElementById('gateStep1').style.display    = 'none';
  document.getElementById('gateSuccess').style.display  = '';
  document.getElementById('gateSuccessDetail').textContent =
    'Votre arrivée a été enregistrée. Bonne visite, ' + name.split(' ')[0] + ' !';

  // QR de check-out
  var checkoutUrl = window.location.origin + window.location.pathname + '?gate_out=' + res.data.id;
  var qrDiv = document.getElementById('gateBadgeQR');
  if (qrDiv) {
    qrDiv.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data='
      + encodeURIComponent(checkoutUrl) + '&bgcolor=ffffff&color=0D1B2A&margin=1" '
      + 'style="border-radius:8px;border:2px solid rgba(255,255,255,.2);padding:4px;background:#fff">'
      + '<div style="font-size:10px;color:#64748B;margin-top:6px">Scannez à votre départ</div>';
  }
}

function gatePrintVisitorBadge() {
  var v = window._gateVisitData;
  if (!v) return;
  // Construire le badge comme gatePrintBadge mais depuis la page publique
  var checkoutUrl = window.location.origin + window.location.pathname + '?gate_out=' + v.id;
  var checkInFmt  = new Date(v.check_in).toLocaleString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' });

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Badge visiteur</title>'
    + '<style>@page{size:A5 landscape;margin:0}*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:"Segoe UI",sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;print-color-adjust:exact;-webkit-print-color-adjust:exact}'
    + '.badge{width:148mm;border:3px solid #F97316;border-radius:12px;overflow:hidden}'
    + '.bh{background:linear-gradient(135deg,#0D1B2A,#1E3A5F);padding:14px 18px;display:flex;align-items:center;justify-content:space-between}'
    + '.logo{font-size:16px;font-weight:900;color:#fff}.o{color:#F97316}'
    + '.bb{padding:16px 18px;display:flex;gap:16px;background:#fff}'
    + '.type{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#F97316;margin-bottom:4px}'
    + '.name{font-size:22px;font-weight:900;color:#1E293B;margin-bottom:2px}'
    + '.co{font-size:13px;color:#64748B;margin-bottom:10px}'
    + '.row{font-size:12px;color:#475569;margin-bottom:3px}'
    + '.bf{background:#F8FAFC;border-top:1px solid #E2E8F0;padding:10px 18px;display:flex;justify-content:space-between}'
    + '@media print{body{margin:0}}</style></head><body>'
    + '<div class="badge">'
    + '<div class="bh"><div><div class="logo">Safety<span class="o">Sphere</span> Gate</div><div style="font-size:10px;color:#94A3B8">Badge temporaire</div></div><div style="font-size:28px">🪪</div></div>'
    + '<div class="bb"><div style="flex:1">'
    + '<div class="type">Visiteur · Accès temporaire</div>'
    + '<div class="name">' + escapeHtml(v.visitor_name) + '</div>'
    + '<div class="co">' + escapeHtml(v.visitor_company || '—') + '</div>'
    + '<div class="row">👤 Visite : <strong>' + escapeHtml(v.visited_person) + '</strong></div>'
    + (v.zone ? '<div class="row">📍 Zone : <strong>' + escapeHtml(v.zone) + '</strong></div>' : '')
    + '<div class="row">🕐 Arrivée : <strong>' + checkInFmt + '</strong></div>'
    + '</div>'
    + '<div style="text-align:center;flex-shrink:0">'
    + '<img src="https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=' + encodeURIComponent(checkoutUrl) + '&bgcolor=ffffff&color=0D1B2A&margin=1" style="width:72px;height:72px;border-radius:6px;border:1px solid #E2E8F0;padding:2px">'
    + '<div style="font-size:9px;color:#94A3B8;margin-top:3px">Check-out</div>'
    + '</div></div>'
    + '<div class="bf"><div style="font-size:10px;color:#16A34A;font-weight:700">✅ Consignes acceptées</div>'
    + '<div style="font-size:9px;color:#94A3B8;font-family:monospace">Réf : ' + v.id.slice(0,8).toUpperCase() + '</div></div>'
    + '</div><script>window.onload=function(){window.print()}<\/script></body></html>';

  var w = window.open('', '_blank'); w.document.write(html); w.document.close();
}

function gateErrorPage(msg) {
  return '<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#0D1B2A;color:#fff;text-align:center">'
    + '<div><div style="font-size:48px;margin-bottom:16px">⚠️</div>'
    + '<div style="font-size:18px;font-weight:700;margin-bottom:8px">Accès impossible</div>'
    + '<div style="font-size:13px;color:#94A3B8">' + escapeHtml(msg) + '</div></div></body></html>';
}

function gateCheckoutConfirmPage(v) {
  var dur = durationLabel(new Date(v.check_in), new Date());
  return '<html><body style="font-family:\'Segoe UI\',sans-serif;background:#0D1B2A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px">'
    + '<div><div style="font-size:64px;margin-bottom:16px">👋</div>'
    + '<div style="font-size:22px;font-weight:900;margin-bottom:8px">Bonne journée, ' + escapeHtml((v.visitor_name||'').split(' ')[0]) + ' !</div>'
    + '<div style="font-size:14px;color:#94A3B8;margin-bottom:4px">Votre sortie a été enregistrée.</div>'
    + '<div style="font-size:12px;color:#64748B">Durée de visite : ' + dur + '</div>'
    + '<div style="margin-top:24px;font-size:12px;color:#F97316;font-weight:700">Safety<span style="color:#fff">Sphere</span> Gate</div>'
    + '</div></body></html>';
}

function gateAlreadyOutPage(v) {
  return '<html><body style="font-family:\'Segoe UI\',sans-serif;background:#0D1B2A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px">'
    + '<div><div style="font-size:48px;margin-bottom:16px">✅</div>'
    + '<div style="font-size:18px;font-weight:700;margin-bottom:8px">Sortie déjà enregistrée</div>'
    + '<div style="font-size:13px;color:#94A3B8">Ce badge a déjà été utilisé pour le check-out.</div></div></body></html>';
}

function gatePublicCSS() {
  return '<style>'
    + '*{box-sizing:border-box;margin:0;padding:0}'
    + 'body{font-family:"Segoe UI",sans-serif;background:#0D1B2A;color:#E2E8F0;min-height:100vh}'
    + '.ss-header{background:linear-gradient(135deg,#0D1B2A,#1E3A5F);border-bottom:3px solid #F97316;padding:12px 20px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}'
    + '.ss-logo{width:32px;height:32px;background:#F97316;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:13px;flex-shrink:0}'
    + '.ss-brand{font-weight:900;color:#fff;font-size:14px}.ss-brand span{color:#F97316}'
    + '.ss-sub{font-size:10px;color:#94A3B8}'
    + '.ss-wrap{max-width:600px;margin:0 auto;padding:20px 16px}'
    + '.welcome-box{background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);border-radius:12px;padding:14px 16px;display:flex;gap:10px;align-items:center;font-size:13px;margin-bottom:16px}'
    + '.card{background:rgba(30,58,95,.4);border:1px solid rgba(99,162,241,.15);border-radius:14px;padding:18px}'
    + '.card-title{font-size:13px;font-weight:700;color:#fff;margin-bottom:4px}'
    + '.card-sub{font-size:11px;color:#94A3B8;margin-bottom:12px}'
    + '.field-group{display:flex;flex-direction:column;gap:12px;margin-top:12px}'
    + '.field label{font-size:11px;font-weight:700;color:#94A3B8;display:block;margin-bottom:5px}'
    + '.input{width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#E2E8F0;font-size:13px;font-family:"Segoe UI",sans-serif}'
    + '.progress-wrap{display:flex;justify-content:flex-end;margin:4px 0}'
    + '.sign-gate{display:flex;align-items:flex-start;gap:12px;border-radius:10px;padding:12px;cursor:not-allowed;transition:all .3s}'
    + '.sign-gate input{width:16px;height:16px;flex-shrink:0;margin-top:2px}'
    + '.sign-gate span{font-size:12px;line-height:1.5;color:#CBD5E1}'
    + '.sign-gate.locked{background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.2);opacity:.6}'
    + '.sign-gate.unlocked{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.3);cursor:pointer;opacity:1}'
    + '.btn-primary{display:block;width:100%;padding:13px;background:#F97316;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer;font-family:"Segoe UI",sans-serif;transition:opacity .2s}'
    + '</style>';
}

// ══════════════════════════════════════════════════════════════
//  DÉTAIL D'UNE VISITE (modale)
// ══════════════════════════════════════════════════════════════
function showVisitDetail(visitId) {
  var v = _gateVisits.find(function(x) { return x.id === visitId; });
  if (!v) return;

  var checkInFmt  = new Date(v.check_in).toLocaleString('fr-FR');
  var checkOutFmt = v.check_out ? new Date(v.check_out).toLocaleString('fr-FR') : '—';
  var dur         = v.check_out ? durationLabel(new Date(v.check_in), new Date(v.check_out)) : durationLabel(new Date(v.check_in), new Date()) + ' (en cours)';

  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
  modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

  modal.innerHTML = '<div style="background:#1E2D3D;border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:24px;max-width:420px;width:100%">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
    + '<div style="font-size:15px;font-weight:900;color:#fff">🪪 ' + escapeHtml(v.visitor_name) + '</div>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:18px">✕</button>'
    + '</div>'
    + detailRow('Société', v.visitor_company)
    + detailRow('Visite', v.visited_person)
    + detailRow('Zone', v.zone)
    + detailRow('Motif', v.purpose)
    + detailRow('Email', v.visitor_email)
    + detailRow('Arrivée', checkInFmt)
    + detailRow('Départ', checkOutFmt)
    + detailRow('Durée', dur)
    + detailRow('Consignes', v.signed_at ? '✅ Signées le ' + new Date(v.signed_at).toLocaleString('fr-FR') : '⚠️ Non signées')
    + detailRow('Méthode', v.entry_method === 'qr_code' ? '📱 QR Code' : '⌨️ Manuel')
    + detailRow('Réf.', v.id.slice(0,8).toUpperCase())
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    + '<button onclick="gatePrintBadge(\'' + v.id + '\')" class="btn-sm btn-upload" style="flex:1;padding:8px">🪪 Badge</button>'
    + (!v.check_out ? '<button onclick="gateCheckOut(\'' + v.id + '\',\'HSE\');this.closest(\'[style*=fixed]\').remove()" class="btn-sm btn-validate" style="flex:1;padding:8px">🚪 Check-out</button>' : '')
    + '</div>'
    + '</div>';

  document.body.appendChild(modal);
}

function detailRow(label, val) {
  if (!val) return '';
  return '<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:12px">'
    + '<span style="color:#64748B;width:80px;flex-shrink:0">' + label + '</span>'
    + '<span style="color:#E2E8F0;flex:1">' + escapeHtml(String(val)) + '</span>'
    + '</div>';
}

// ══════════════════════════════════════════════════════════════
//  ROUTING — intercepter ?gate= et ?gate_out=
// ══════════════════════════════════════════════════════════════
(function initGateRouting() {
  var params = new URLSearchParams(window.location.search);
  var gateOrg = params.get('gate');
  var gateOut = params.get('gate_out');

  // Au boot : vérifier l'état d'activation (pour le dot coloré) + hook admin
  document.addEventListener('DOMContentLoaded', function() {
    var _waitAuth = setInterval(function() {
      if (typeof currentProfile !== 'undefined' && currentProfile && typeof sb !== 'undefined') {
        clearInterval(_waitAuth);
        checkGateActivation();
        hookAdminModules();
      }
    }, 300);
  });

  if (gateOrg) {
    // Page publique visiteur
    document.addEventListener('DOMContentLoaded', function() {
      // Attendre que Supabase soit initialisé (sb défini dans core.js)
      var _wait = setInterval(function() {
        if (typeof sb !== 'undefined') {
          clearInterval(_wait);
          loadPublicGatePage(gateOrg);
        }
      }, 100);
    });
  } else if (gateOut) {
    document.addEventListener('DOMContentLoaded', function() {
      var _wait = setInterval(function() {
        if (typeof sb !== 'undefined') {
          clearInterval(_wait);
          loadPublicGateCheckout(gateOut);
        }
      }, 100);
    });
  }
})();
