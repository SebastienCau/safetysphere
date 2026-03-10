// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE INCIDENTS v1.0
//  Gestion des incidents & quasi-accidents
// ════════════════════════════════════════════════════════════════════════════
//
//  ARCHITECTURE
//  ─────────────────────────────────────────────────────────────────────────
//  • Fichier autonome, pattern identique à gate.js
//  • Activation par org via signature_settings (scope='org_module', scope_id='{orgId}_incidents')
//  • Rôles : hse (saisie + vue complète), company (saisie + vue org), worker (lecture seule)
//  • Tables Supabase : incidents, incident_actions
//  • Onglets injectés dans index.html : HSE-incidents, Company-incidents
//
//  DÉPLOIEMENT
//  ─────────────────────────────────────────────────────────────────────────
//  1. Exécuter le SQL de création des tables (voir README_INCIDENTS_SQL.md)
//  2. Ajouter dans AVAILABLE_MODULES (gate.js) :
//       { id:'incidents', icon:'🚨', name:'Incidents & Quasi-accidents',
//         desc:'Déclaration, suivi et analyse des incidents de sécurité',
//         color:'#F87171', roles:['hse','company'] }
//  3. Ajouter dans index.html les onglets + page-sections (voir README ci-dessous)
//  4. Charger incidents.js AVANT gate.js dans index.html
//
//  ORDRE DE CHARGEMENT dans index.html :
//  core → analytics → workers → signatures → reports → conformite →
//  analytics_charts → chart → incidents → gate
//
// ════════════════════════════════════════════════════════════════════════════

// ── État du module ──────────────────────────────────────────────────────────
var _incSubView    = 'registre';   // 'registre' | 'nouveau' | 'stats' | 'actions'
var _incList       = [];           // incidents chargés
var _incActions    = [];           // actions correctives chargées
var _incActivated  = false;        // activé pour l'org courante
var _incLoading    = false;
var _incCurrentId  = null;         // incident sélectionné pour détail/édition

// ── Constantes ──────────────────────────────────────────────────────────────
var INC_TYPES = [
  { id: 'accident',      label: 'Accident avec arrêt',       color: '#EF4444', icon: '🔴' },
  { id: 'accident_sans', label: 'Accident sans arrêt',       color: '#F97316', icon: '🟠' },
  { id: 'quasi',         label: 'Quasi-accident',            color: '#EAB308', icon: '🟡' },
  { id: 'presqu',        label: 'Situation dangereuse',      color: '#A78BFA', icon: '🟣' },
  { id: 'materiel',      label: 'Dommage matériel',          color: '#60A5FA', icon: '🔵' },
  { id: 'environnement', label: 'Impact environnemental',    color: '#34D399', icon: '🟢' }
];

var INC_GRAVITY = [
  { id: 1, label: 'Mineur',    color: '#4ADE80' },
  { id: 2, label: 'Modéré',   color: '#EAB308' },
  { id: 3, label: 'Grave',    color: '#F97316' },
  { id: 4, label: 'Critique', color: '#EF4444' }
];

var INC_STATUS = [
  { id: 'ouvert',      label: 'Ouvert',      color: '#EF4444' },
  { id: 'en_cours',   label: 'En cours',    color: '#F97316' },
  { id: 'resolu',     label: 'Résolu',      color: '#4ADE80' },
  { id: 'clos',       label: 'Clos',        color: '#64748B' }
];

// ── Activation / vérification ────────────────────────────────────────────────
async function checkIncidentsActivation() {
  if (!currentProfile || !currentProfile.org_id) return false;
  var orgId   = currentProfile.org_id;
  var scopeId = orgId + '_incidents';
  var res = await sb.from('signature_settings')
    .select('enabled')
    .eq('scope', 'org_module')
    .eq('scope_id', scopeId)
    .maybeSingle();
  var enabled = res.data ? (res.data.enabled === true) : false;
  _incActivated = enabled;
  updateIncidentsTabVisibility(enabled);
  return enabled;
}

function updateIncidentsTabVisibility(visible) {
  var roles = ['HSE', 'Company'];
  roles.forEach(function(r) {
    var tabs = document.querySelectorAll('#dash' + r + ' .nav-tab');
    tabs.forEach(function(tab) {
      if ((tab.getAttribute('onclick') || '').includes('incidents')) {
        tab.style.display = visible ? '' : 'none';
      }
    });
  });
}

// ── Point d'entrée principal ─────────────────────────────────────────────────
async function loadIncidents(role) {
  var dash = role === 'hse' ? 'HSE' : role === 'company' ? 'Company' : null;
  if (!dash) return;
  var container = document.getElementById(dash + '-incidents-content');
  if (!container) return;

  container.innerHTML = _incLoadingHTML();
  _incLoading = true;

  try {
    var orgId = currentProfile.org_id;

    // Charger incidents selon le rôle
    var query = sb.from('incidents')
      .select('*, profiles(full_name, role), incident_actions(id, status)')
      .order('occurred_at', { ascending: false });

    if (role === 'hse') {
      query = query.eq('org_id', orgId);
    } else if (role === 'company') {
      query = query.eq('org_id', orgId);
    } else if (role === 'worker') {
      query = query.eq('reported_by', currentProfile.id);
    }

    var { data: incidents, error } = await query.limit(200);
    if (error) throw error;

    _incList = incidents || [];

    // Charger actions correctives
    if (_incList.length > 0) {
      var incIds = _incList.map(function(i) { return i.id; });
      var { data: actions } = await sb.from('incident_actions')
        .select('*')
        .in('incident_id', incIds)
        .order('due_date', { ascending: true });
      _incActions = actions || [];
    } else {
      _incActions = [];
    }

    _incLoading = false;
    renderIncidents(role);

  } catch(e) {
    _incLoading = false;
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erreur de chargement : ' + (e.message || e) + '</div></div>';
  }
}

// ── Rendu principal ──────────────────────────────────────────────────────────
function renderIncidents(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-incidents-content');
  if (!container) return;

  var html = '';

  // ── Barre de sous-navigation ──
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">';
  html += _incSubBtn('registre', '📋 Registre', role, _incList.filter(function(i){return i.status==='ouvert';}).length);
  html += _incSubBtn('nouveau',  '➕ Déclarer', role);
  html += _incSubBtn('stats',    '📈 Statistiques', role);
  html += _incSubBtn('actions',  '✅ Actions correctives', role, _incActions.filter(function(a){return a.status!=='clos';}).length);

  // Stats rapides à droite
  var total   = _incList.length;
  var ouverts = _incList.filter(function(i){return i.status==='ouvert';}).length;
  html += '<div style="margin-left:auto;display:flex;gap:12px;align-items:center">';
  html += '<span style="font-size:11px;color:var(--muted)">' + total + ' incident' + (total>1?'s':'') + ' · ';
  html += '<span style="color:#EF4444;font-weight:700">' + ouverts + ' ouvert' + (ouverts>1?'s':'') + '</span></span>';

  // Export CSV
  if (total > 0) {
    html += '<button onclick="exportIncidentsCSV(\'' + role + '\')" style="padding:6px 14px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);border-radius:8px;color:#4ADE80;font-size:11px;font-weight:700;cursor:pointer">⬇ Export CSV</button>';
  }
  html += '</div>';
  html += '</div>';

  // ── Contenu selon sous-vue ──
  if (_incSubView === 'registre') html += _renderIncRegistre(role);
  if (_incSubView === 'nouveau')  html += _renderIncForm(role, null);
  if (_incSubView === 'stats')    html += _renderIncStats(role);
  if (_incSubView === 'actions')  html += _renderIncActions(role);

  container.innerHTML = html;

  // Canvas graphe si stats
  if (_incSubView === 'stats') {
    requestAnimationFrame(function() { _drawIncCharts(); });
  }
}

// ── Registre ─────────────────────────────────────────────────────────────────
function _renderIncRegistre(role) {
  var html = '';

  if (_incList.length === 0) {
    return '<div class="empty-state" style="margin-top:40px">'
      + '<div class="empty-state-icon">🎯</div>'
      + '<div class="empty-state-text">Aucun incident déclaré — c\'est une excellente nouvelle !</div>'
      + '<button onclick="_incSwitchView(\'nouveau\',\'' + role + '\')" style="margin-top:16px;padding:10px 24px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:10px;color:#F87171;font-weight:700;cursor:pointer">➕ Déclarer le premier incident</button>'
      + '</div>';
  }

  // Filtres
  html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">';
  html += '<select id="incFilterType" onchange="filterIncidents(\'' + role + '\')" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">';
  html += '<option value="">Tous types</option>';
  INC_TYPES.forEach(function(t) {
    html += '<option value="' + t.id + '">' + t.icon + ' ' + t.label + '</option>';
  });
  html += '</select>';

  html += '<select id="incFilterStatus" onchange="filterIncidents(\'' + role + '\')" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">';
  html += '<option value="">Tous statuts</option>';
  INC_STATUS.forEach(function(s) {
    html += '<option value="' + s.id + '">' + s.label + '</option>';
  });
  html += '</select>';

  html += '<select id="incFilterGravity" onchange="filterIncidents(\'' + role + '\')" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">';
  html += '<option value="">Toutes gravités</option>';
  INC_GRAVITY.forEach(function(g) {
    html += '<option value="' + g.id + '">G' + g.id + ' — ' + g.label + '</option>';
  });
  html += '</select>';

  html += '<input type="month" id="incFilterMonth" onchange="filterIncidents(\'' + role + '\')" style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px">';
  html += '</div>';

  // Table
  html += '<div id="incRegistreTable">' + _buildIncTable(_incList, role) + '</div>';
  return html;
}

function _buildIncTable(list, role) {
  if (list.length === 0) return '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Aucun résultat pour ces filtres</div></div>';

  var html = '<div style="overflow-x:auto">';
  html += '<table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
  ['Date', 'Type', 'Gravité', 'Description', 'Lieu', 'Déclaré par', 'Statut', 'Actions'].forEach(function(h) {
    html += '<th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);white-space:nowrap">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';

  list.forEach(function(inc) {
    var type    = INC_TYPES.find(function(t){return t.id===inc.type;}) || INC_TYPES[0];
    var gravity = INC_GRAVITY.find(function(g){return g.id===inc.gravity;}) || INC_GRAVITY[0];
    var status  = INC_STATUS.find(function(s){return s.id===inc.status;}) || INC_STATUS[0];
    var date    = new Date(inc.occurred_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});
    var reporter = inc.profiles ? inc.profiles.full_name : '—';
    var desc    = (inc.description || '').substring(0, 60) + ((inc.description||'').length > 60 ? '…' : '');
    var nbActions = _incActions.filter(function(a){return a.incident_id===inc.id;}).length;

    html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04);transition:background .15s" '
      + 'onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" '
      + 'onmouseout="this.style.background=\'\'">';

    html += '<td style="padding:10px 12px;white-space:nowrap;color:var(--muted);font-size:12px">' + date + '</td>';

    html += '<td style="padding:10px 12px;white-space:nowrap">'
      + '<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,.05);font-size:11px;font-weight:700">'
      + type.icon + ' ' + type.label + '</span></td>';

    html += '<td style="padding:10px 12px">'
      + '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:' + gravity.color + '22;color:' + gravity.color + '">G' + gravity.id + ' — ' + gravity.label + '</span>'
      + '</td>';

    html += '<td style="padding:10px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + (inc.description||'').replace(/"/g,'&quot;') + '">' + desc + '</td>';

    html += '<td style="padding:10px 12px;color:var(--muted);font-size:12px">' + (inc.location || '—') + '</td>';

    html += '<td style="padding:10px 12px;color:var(--muted);font-size:12px">' + reporter + '</td>';

    html += '<td style="padding:10px 12px">'
      + '<span style="display:inline-block;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;background:' + status.color + '22;color:' + status.color + '">'
      + status.label + '</span></td>';

    html += '<td style="padding:10px 12px">'
      + '<div style="display:flex;gap:6px">'
      + '<button onclick="openIncidentDetail(\'' + inc.id + '\',\'' + role + '\')" style="padding:4px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:var(--text);font-size:11px;cursor:pointer">👁 Voir</button>';

    if (role !== 'worker') {
      html += '<button onclick="openIncidentEdit(\'' + inc.id + '\',\'' + role + '\')" style="padding:4px 10px;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);border-radius:6px;color:#A5B4FC;font-size:11px;cursor:pointer">✏️</button>';
    }

    if (nbActions > 0) {
      html += '<span style="padding:3px 8px;background:rgba(74,222,128,.1);border-radius:6px;color:#4ADE80;font-size:10px;font-weight:700">' + nbActions + ' action' + (nbActions>1?'s':'') + '</span>';
    }

    html += '</div></td>';
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── Formulaire de déclaration ─────────────────────────────────────────────────
function _renderIncForm(role, editData) {
  var isEdit = !!editData;
  var d = editData || {};

  var html = '<div style="max-width:720px">';
  html += '<div style="background:linear-gradient(135deg,rgba(248,113,113,.08),rgba(239,68,68,.04));border:1px solid rgba(248,113,113,.15);border-radius:20px;padding:28px">';
  html += '<div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:4px">' + (isEdit ? '✏️ Modifier l\'incident' : '🚨 Déclarer un incident / quasi-accident') + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-bottom:24px">Tous les champs marqués * sont obligatoires</div>';

  // Ligne 1 : Date + Heure + Lieu
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:16px">';
  html += _incField('Date de l\'incident *', '<input type="date" id="incDate" value="' + (d.occurred_at ? d.occurred_at.slice(0,10) : new Date().toISOString().slice(0,10)) + '" style="' + _incInputStyle() + '">');
  html += _incField('Heure', '<input type="time" id="incTime" value="' + (d.occurred_at ? d.occurred_at.slice(11,16) : new Date().toTimeString().slice(0,5)) + '" style="' + _incInputStyle() + '">');
  html += _incField('Lieu / Zone *', '<input type="text" id="incLocation" placeholder="Ex : Atelier B, Quai 3…" value="' + (d.location||'') + '" style="' + _incInputStyle() + '">');
  html += '</div>';

  // Ligne 2 : Type + Gravité
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';

  html += _incField('Type d\'incident *', '<select id="incType" style="' + _incInputStyle() + '">'
    + INC_TYPES.map(function(t){ return '<option value="' + t.id + '"' + (d.type===t.id?' selected':'') + '>' + t.icon + ' ' + t.label + '</option>'; }).join('')
    + '</select>');

  html += _incField('Gravité *', '<select id="incGravity" style="' + _incInputStyle() + '">'
    + INC_GRAVITY.map(function(g){ return '<option value="' + g.id + '"' + (d.gravity===g.id?' selected':'') + '>G' + g.id + ' — ' + g.label + '</option>'; }).join('')
    + '</select>');

  html += '</div>';

  // Description
  html += _incField('Description de l\'incident *',
    '<textarea id="incDesc" rows="4" placeholder="Décrivez les circonstances, les causes apparentes, les personnes impliquées…" style="' + _incInputStyle() + 'resize:vertical">' + (d.description||'') + '</textarea>',
    true);
  html += '<div style="margin-bottom:16px"></div>';

  // Ligne 3 : Blessés + Témoins
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">';
  html += _incField('Personne(s) blessée(s)', '<input type="text" id="incInjured" placeholder="Noms, postes" value="' + (d.injured_persons||'') + '" style="' + _incInputStyle() + '">');
  html += _incField('Témoin(s)', '<input type="text" id="incWitnesses" placeholder="Noms" value="' + (d.witnesses||'') + '" style="' + _incInputStyle() + '">');
  html += '</div>';

  // Causes identifiées
  html += _incField('Causes identifiées',
    '<textarea id="incCauses" rows="3" placeholder="Causes immédiates, causes profondes, facteurs organisationnels…" style="' + _incInputStyle() + 'resize:vertical">' + (d.causes||'') + '</textarea>',
    true);
  html += '<div style="margin-bottom:16px"></div>';

  // Actions immédiates
  html += _incField('Actions immédiates prises',
    '<textarea id="incImmediate" rows="2" placeholder="Premiers secours, mise en sécurité, arrêt machine…" style="' + _incInputStyle() + 'resize:vertical">' + (d.immediate_actions||'') + '</textarea>',
    true);
  html += '<div style="margin-bottom:16px"></div>';

  // Statut (uniquement en édition ou pour HSE)
  if (isEdit || role === 'hse') {
    html += _incField('Statut', '<select id="incStatus" style="' + _incInputStyle() + '">'
      + INC_STATUS.map(function(s){ return '<option value="' + s.id + '"' + (d.status===s.id||(!d.status&&s.id==='ouvert')?' selected':'') + '>' + s.label + '</option>'; }).join('')
      + '</select>', false);
    html += '<div style="margin-bottom:16px"></div>';
  }

  // Boutons
  html += '<div style="display:flex;gap:12px;margin-top:8px">';
  if (isEdit) {
    html += '<button onclick="saveIncident(\'' + role + '\',\'' + d.id + '\')" style="padding:12px 28px;background:rgba(248,113,113,.2);border:1px solid rgba(248,113,113,.4);border-radius:10px;color:#F87171;font-weight:700;cursor:pointer;font-size:14px">💾 Enregistrer</button>';
  } else {
    html += '<button onclick="saveIncident(\'' + role + '\',null)" style="padding:12px 28px;background:rgba(248,113,113,.2);border:1px solid rgba(248,113,113,.4);border-radius:10px;color:#F87171;font-weight:700;cursor:pointer;font-size:14px">🚨 Déclarer l\'incident</button>';
  }
  html += '<button onclick="_incSwitchView(\'registre\',\'' + role + '\')" style="padding:12px 20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--muted);font-weight:700;cursor:pointer;font-size:14px">Annuler</button>';
  html += '</div>';

  html += '</div></div>';
  return html;
}

// ── Statistiques ──────────────────────────────────────────────────────────────
function _renderIncStats(role) {
  var list = _incList;
  var total     = list.length;
  var accidents = list.filter(function(i){return i.type==='accident';}).length;
  var quasis    = list.filter(function(i){return i.type==='quasi';}).length;
  var resolus   = list.filter(function(i){return i.status==='resolu'||i.status==='clos';}).length;
  var tauxResol = total > 0 ? Math.round(resolus / total * 100) : 0;
  var critiques = list.filter(function(i){return i.gravity===4;}).length;

  // KPI cards
  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;margin-bottom:28px">';
  var kpis = [
    { val: total,      label: 'Total incidents',     color: '#F87171', icon: '🚨' },
    { val: accidents,  label: 'Accidents',           color: '#EF4444', icon: '🔴' },
    { val: quasis,     label: 'Quasi-accidents',     color: '#EAB308', icon: '🟡' },
    { val: critiques,  label: 'Critiques (G4)',      color: '#A78BFA', icon: '⚡' },
    { val: tauxResol + '%', label: 'Taux résolution', color: '#4ADE80', icon: '✅' },
    { val: _incActions.filter(function(a){return a.status!=='clos';}).length, label: 'Actions ouvertes', color: '#60A5FA', icon: '📋' }
  ];

  kpis.forEach(function(k) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:16px;text-align:center">';
    html += '<div style="font-size:22px;margin-bottom:4px">' + k.icon + '</div>';
    html += '<div style="font-size:26px;font-weight:900;color:' + k.color + ';letter-spacing:-.5px">' + k.val + '</div>';
    html += '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:3px">' + k.label + '</div>';
    html += '</div>';
  });
  html += '</div>';

  // Graphe évolution 12 mois
  html += '<div style="background:linear-gradient(135deg,rgba(13,27,42,.95),rgba(15,23,42,.98));border:1px solid rgba(248,113,113,.15);border-radius:20px;overflow:hidden;margin-bottom:20px">';
  html += '<div style="padding:20px 24px 12px">';
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:3px">';
  html += '<div style="width:3px;height:20px;background:linear-gradient(180deg,#F87171,#EF4444);border-radius:2px"></div>';
  html += '<span style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F87171">Évolution</span>';
  html += '</div>';
  html += '<div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-.5px">Incidents sur 12 mois</div>';
  html += '</div>';
  html += '<div style="padding:0 24px 8px"><canvas id="incChartMonths" height="160" style="width:100%;height:160px;display:block"></canvas></div>';
  html += '<div style="padding:0 24px 20px;display:flex;gap:16px">';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:3px;background:#F87171;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Accidents</span></div>';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:3px;background:#EAB308;border-radius:2px;opacity:.7"></div><span style="font-size:10px;color:#64748B">Quasi-accidents</span></div>';
  html += '</div></div>';

  // Répartition par type
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">';

  // Tableau répartition types
  html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px">';
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">📊 Répartition par type</div>';
  INC_TYPES.forEach(function(t) {
    var nb  = list.filter(function(i){return i.type===t.id;}).length;
    var pct = total > 0 ? Math.round(nb / total * 100) : 0;
    if (nb === 0) return;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
    html += '<span>' + t.icon + ' ' + t.label + '</span><span style="color:var(--muted)">' + nb + ' (' + pct + '%)</span>';
    html += '</div>';
    html += '<div style="height:6px;background:rgba(255,255,255,.05);border-radius:3px">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + t.color + ';border-radius:3px;transition:.5s"></div>';
    html += '</div></div>';
  });
  html += '</div>';

  // Tableau répartition gravité
  html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:20px">';
  html += '<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:14px">⚡ Répartition par gravité</div>';
  INC_GRAVITY.forEach(function(g) {
    var nb  = list.filter(function(i){return i.gravity===g.id;}).length;
    var pct = total > 0 ? Math.round(nb / total * 100) : 0;
    if (nb === 0) return;
    html += '<div style="margin-bottom:10px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">';
    html += '<span style="color:' + g.color + ';font-weight:700">G' + g.id + ' ' + g.label + '</span><span style="color:var(--muted)">' + nb + ' (' + pct + '%)</span>';
    html += '</div>';
    html += '<div style="height:6px;background:rgba(255,255,255,.05);border-radius:3px">';
    html += '<div style="height:100%;width:' + pct + '%;background:' + g.color + ';border-radius:3px;transition:.5s"></div>';
    html += '</div></div>';
  });
  html += '</div>';

  html += '</div>';
  return html;
}

// ── Actions correctives ───────────────────────────────────────────────────────
function _renderIncActions(role) {
  var actions = _incActions;

  var html = '';

  // Bouton ajouter action
  if (role !== 'worker') {
    html += '<button onclick="openNewActionModal(\'' + role + '\')" style="margin-bottom:16px;padding:8px 18px;background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:10px;color:#4ADE80;font-weight:700;cursor:pointer;font-size:13px">➕ Nouvelle action corrective</button>';
  }

  if (actions.length === 0) {
    return html + '<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Aucune action corrective — déclarez un incident pour en créer</div></div>';
  }

  // Grouper par statut
  var grouped = {};
  INC_STATUS.forEach(function(s) { grouped[s.id] = []; });
  actions.forEach(function(a) { if (grouped[a.status]) grouped[a.status].push(a); });

  ['ouvert','en_cours','resolu','clos'].forEach(function(sid) {
    var list = grouped[sid];
    if (list.length === 0) return;
    var s = INC_STATUS.find(function(x){return x.id===sid;});

    html += '<div style="margin-bottom:20px">';
    html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:' + s.color + ';margin-bottom:10px">';
    html += s.label + ' <span style="opacity:.5">(' + list.length + ')</span></div>';

    list.forEach(function(a) {
      var inc = _incList.find(function(i){return i.id===a.incident_id;});
      var due = a.due_date ? new Date(a.due_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '—';
      var overdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== 'clos';

      html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:14px 16px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px">';

      // Priorité indicateur
      html += '<div style="width:4px;min-height:40px;background:' + s.color + ';border-radius:2px;flex-shrink:0"></div>';

      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px">' + (a.description||'Sans description') + '</div>';
      html += '<div style="font-size:11px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap">';
      html += '<span>👤 ' + (a.assigned_to_name||'Non assigné') + '</span>';
      html += '<span style="color:' + (overdue?'#EF4444':'var(--muted)') + '">📅 ' + due + (overdue?' ⚠️ En retard':'') + '</span>';
      if (inc) html += '<span>🔗 Incident : ' + (inc.description||'').substring(0,40) + '</span>';
      html += '</div></div>';

      if (role !== 'worker') {
        html += '<div style="display:flex;gap:6px;flex-shrink:0">';
        html += '<select onchange="updateActionStatus(\'' + a.id + '\',this.value,\'' + role + '\')" style="padding:4px 8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:6px;color:var(--text);font-size:11px">';
        INC_STATUS.forEach(function(s2) {
          html += '<option value="' + s2.id + '"' + (a.status===s2.id?' selected':'') + '>' + s2.label + '</option>';
        });
        html += '</select>';
        html += '</div>';
      }

      html += '</div>';
    });
    html += '</div>';
  });

  return html;
}

// ── Graphe canvas 12 mois ─────────────────────────────────────────────────────
function _drawIncCharts() {
  var canvas = document.getElementById('incChartMonths');
  if (!canvas || canvas.offsetWidth === 0) {
    setTimeout(_drawIncCharts, 60);
    return;
  }

  // Construire buckets 12 mois
  var now    = new Date();
  var months = [];
  for (var m = 11; m >= 0; m--) {
    var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    months.push({
      key     : d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'),
      label   : d.toLocaleDateString('fr-FR',{month:'short'}),
      accidents: 0,
      quasis  : 0
    });
  }

  _incList.forEach(function(inc) {
    var key = inc.occurred_at ? inc.occurred_at.slice(0,7) : null;
    if (!key) return;
    var bucket = months.find(function(m){return m.key===key;});
    if (!bucket) return;
    if (inc.type === 'accident' || inc.type === 'accident_sans') bucket.accidents++;
    else if (inc.type === 'quasi' || inc.type === 'presqu') bucket.quasis++;
  });

  var maxVal = Math.max.apply(null, months.map(function(m){return m.accidents + m.quasis;}).concat([1]));
  var dpr    = window.devicePixelRatio || 1;
  var W      = canvas.offsetWidth;
  var H      = 160;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var pad  = { l: 28, r: 12, t: 16, b: 32 };
  var gw   = W - pad.l - pad.r;
  var gh   = H - pad.t - pad.b;
  var n    = months.length;
  var barW = gw / n * 0.65;
  var gap  = gw / n * 0.175;

  // Grille
  ctx.strokeStyle = 'rgba(255,255,255,.04)';
  ctx.lineWidth   = 1;
  for (var yv = 0; yv <= maxVal; yv += Math.max(1, Math.ceil(maxVal/4))) {
    var y = pad.t + gh * (1 - yv / maxVal);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + gw, y); ctx.stroke();
    ctx.fillStyle = '#475569'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(yv, pad.l - 4, y + 3);
  }

  // Barres groupées
  months.forEach(function(m, i) {
    var x0 = pad.l + i * gw / n + gap;
    var bw = barW / 2 - 1;

    // Accidents (rouge)
    if (m.accidents > 0) {
      var ya  = pad.t + gh * (1 - m.accidents / maxVal);
      var bha = gh - (ya - pad.t);
      var grd = ctx.createLinearGradient(x0, pad.t, x0, pad.t + gh);
      grd.addColorStop(0, 'rgba(248,113,113,.9)');
      grd.addColorStop(1, 'rgba(248,113,113,.1)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.roundRect(x0, ya, bw, bha, 2); ctx.fill();
    }

    // Quasi-accidents (jaune)
    if (m.quasis > 0) {
      var yq  = pad.t + gh * (1 - m.quasis / maxVal);
      var bhq = gh - (yq - pad.t);
      var grd2 = ctx.createLinearGradient(x0 + bw + 2, pad.t, x0 + bw + 2, pad.t + gh);
      grd2.addColorStop(0, 'rgba(234,179,8,.9)');
      grd2.addColorStop(1, 'rgba(234,179,8,.1)');
      ctx.fillStyle = grd2;
      ctx.beginPath(); ctx.roundRect(x0 + bw + 2, yq, bw, bhq, 2); ctx.fill();
    }

    // Label mois
    ctx.fillStyle = '#475569'; ctx.font = '9px Barlow,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.label, x0 + barW / 2, H - 6);
  });
}

// ── Sauvegarde incident ───────────────────────────────────────────────────────
async function saveIncident(role, editId) {
  var date     = document.getElementById('incDate')?.value;
  var time     = document.getElementById('incTime')?.value || '00:00';
  var location = document.getElementById('incLocation')?.value?.trim();
  var type     = document.getElementById('incType')?.value;
  var gravity  = parseInt(document.getElementById('incGravity')?.value);
  var desc     = document.getElementById('incDesc')?.value?.trim();
  var status   = document.getElementById('incStatus')?.value || 'ouvert';

  if (!date || !location || !desc) {
    showToast('⚠️ Veuillez remplir tous les champs obligatoires (*)', 'error');
    return;
  }

  var payload = {
    org_id           : currentProfile.org_id,
    reported_by      : currentProfile.id,
    occurred_at      : date + 'T' + time + ':00',
    location         : location,
    type             : type,
    gravity          : gravity,
    description      : desc,
    injured_persons  : document.getElementById('incInjured')?.value?.trim() || null,
    witnesses        : document.getElementById('incWitnesses')?.value?.trim() || null,
    causes           : document.getElementById('incCauses')?.value?.trim() || null,
    immediate_actions: document.getElementById('incImmediate')?.value?.trim() || null,
    status           : status
  };

  var res;
  if (editId) {
    res = await sb.from('incidents').update(payload).eq('id', editId);
  } else {
    res = await sb.from('incidents').insert(payload);
  }

  if (res.error) {
    showToast('❌ Erreur : ' + res.error.message, 'error');
    return;
  }

  showToast(editId ? '✅ Incident modifié' : '🚨 Incident déclaré avec succès', 'success');
  _incSubView = 'registre';
  loadIncidents(role);
}

// ── Mise à jour statut action ─────────────────────────────────────────────────
async function updateActionStatus(actionId, newStatus, role) {
  var res = await sb.from('incident_actions').update({ status: newStatus }).eq('id', actionId);
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  showToast('✅ Statut mis à jour', 'success');
  loadIncidents(role);
}

// ── Modal nouvelle action ─────────────────────────────────────────────────────
function openNewActionModal(role) {
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';

  // Select incidents
  var incOptions = _incList.filter(function(i){return i.status!=='clos';}).map(function(i) {
    var d = new Date(i.occurred_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
    return '<option value="' + i.id + '">' + d + ' — ' + (i.description||'').substring(0,40) + '</option>';
  }).join('');

  modal.innerHTML = '<div style="background:var(--bg);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;width:100%;max-width:500px">'
    + '<div style="font-size:16px;font-weight:800;margin-bottom:20px">➕ Nouvelle action corrective</div>'
    + '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Incident associé *</label>'
    + '<select id="actIncident" style="' + _incInputStyle() + '">' + incOptions + '</select></div>'
    + '<div style="margin-bottom:12px"><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Description de l\'action *</label>'
    + '<textarea id="actDesc" rows="3" style="' + _incInputStyle() + 'resize:vertical"></textarea></div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">'
    + '<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Assigné à</label><input type="text" id="actAssigned" placeholder="Nom du responsable" style="' + _incInputStyle() + '"></div>'
    + '<div><label style="font-size:11px;color:var(--muted);display:block;margin-bottom:5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px">Échéance</label><input type="date" id="actDue" style="' + _incInputStyle() + '"></div>'
    + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:8px">'
    + '<button onclick="saveNewAction(\'' + role + '\',this.closest(\'[style*=fixed]\')" style="flex:1;padding:10px;background:rgba(74,222,128,.15);border:1px solid rgba(74,222,128,.3);border-radius:10px;color:#4ADE80;font-weight:700;cursor:pointer">Enregistrer</button>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:10px 16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--muted);cursor:pointer">Annuler</button>'
    + '</div></div>';

  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
}

async function saveNewAction(role, modal) {
  var incId   = document.getElementById('actIncident')?.value;
  var desc    = document.getElementById('actDesc')?.value?.trim();
  var assigned = document.getElementById('actAssigned')?.value?.trim();
  var due     = document.getElementById('actDue')?.value;

  if (!incId || !desc) { showToast('⚠️ Champs obligatoires manquants', 'error'); return; }

  var res = await sb.from('incident_actions').insert({
    incident_id     : incId,
    org_id          : currentProfile.org_id,
    description     : desc,
    assigned_to_name: assigned || null,
    due_date        : due || null,
    status          : 'ouvert',
    created_by      : currentProfile.id
  });

  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  if (modal) modal.remove();
  showToast('✅ Action créée', 'success');
  loadIncidents(role);
}

// ── Détail incident (modal) ───────────────────────────────────────────────────
function openIncidentDetail(incId, role) {
  var inc = _incList.find(function(i){return i.id===incId;});
  if (!inc) return;

  var type    = INC_TYPES.find(function(t){return t.id===inc.type;}) || INC_TYPES[0];
  var gravity = INC_GRAVITY.find(function(g){return g.id===inc.gravity;}) || INC_GRAVITY[0];
  var status  = INC_STATUS.find(function(s){return s.id===inc.status;}) || INC_STATUS[0];
  var actions = _incActions.filter(function(a){return a.incident_id===incId;});
  var date    = new Date(inc.occurred_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';

  var html = '<div style="background:var(--bg);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:28px;width:100%;max-width:600px;max-height:90vh;overflow-y:auto">';
  html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px">';
  html += '<div><div style="font-size:18px;font-weight:800">' + type.icon + ' ' + type.label + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-top:3px">' + date + '</div></div>';
  html += '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 12px;cursor:pointer;color:var(--muted)">✕ Fermer</button>';
  html += '</div>';

  // Badges
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px">';
  html += '<span style="padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;background:' + gravity.color + '22;color:' + gravity.color + '">G' + gravity.id + ' — ' + gravity.label + '</span>';
  html += '<span style="padding:4px 12px;border-radius:8px;font-size:12px;font-weight:700;background:' + status.color + '22;color:' + status.color + '">' + status.label + '</span>';
  if (inc.location) html += '<span style="padding:4px 12px;border-radius:8px;font-size:12px;background:rgba(255,255,255,.06);color:var(--muted)">📍 ' + inc.location + '</span>';
  html += '</div>';

  var rows = [
    ['Description', inc.description],
    ['Personnes blessées', inc.injured_persons],
    ['Témoins', inc.witnesses],
    ['Causes identifiées', inc.causes],
    ['Actions immédiates', inc.immediate_actions]
  ];

  rows.forEach(function(r) {
    if (!r[1]) return;
    html += '<div style="margin-bottom:14px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:5px">' + r[0] + '</div>';
    html += '<div style="font-size:13px;color:var(--text);background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;white-space:pre-wrap">' + r[1] + '</div></div>';
  });

  // Actions correctives liées
  if (actions.length > 0) {
    html += '<div style="font-size:13px;font-weight:700;margin:16px 0 10px">✅ Actions correctives (' + actions.length + ')</div>';
    actions.forEach(function(a) {
      var s = INC_STATUS.find(function(x){return x.id===a.status;});
      html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">';
      html += '<span style="font-size:12px">' + (a.description||'') + '</span>';
      html += '<span style="font-size:11px;padding:3px 8px;border-radius:6px;background:' + (s?s.color:'#fff') + '22;color:' + (s?s.color:'#fff') + '">' + (s?s.label:'') + '</span>';
      html += '</div>';
    });
  }

  html += '</div>';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
}

function openIncidentEdit(incId, role) {
  var inc = _incList.find(function(i){return i.id===incId;});
  if (!inc) return;
  _incSubView = 'nouveau';
  _incCurrentId = incId;
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-incidents-content');
  if (!container) return;

  var nav = container.querySelector('[style*="display:flex"]');
  container.innerHTML = (nav ? nav.outerHTML : '') + _renderIncForm(role, inc);
}

// ── Filtre ────────────────────────────────────────────────────────────────────
function filterIncidents(role) {
  var type    = document.getElementById('incFilterType')?.value;
  var status  = document.getElementById('incFilterStatus')?.value;
  var gravity = document.getElementById('incFilterGravity')?.value;
  var month   = document.getElementById('incFilterMonth')?.value;

  var filtered = _incList.filter(function(i) {
    if (type    && i.type !== type) return false;
    if (status  && i.status !== status) return false;
    if (gravity && String(i.gravity) !== String(gravity)) return false;
    if (month   && i.occurred_at && !i.occurred_at.startsWith(month)) return false;
    return true;
  });

  var table = document.getElementById('incRegistreTable');
  if (table) table.innerHTML = _buildIncTable(filtered, role);
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportIncidentsCSV(role) {
  var headers = ['Date','Heure','Type','Gravité','Statut','Lieu','Description','Blessés','Témoins','Causes','Actions immédiates','Déclaré par'];
  var rows = _incList.map(function(inc) {
    var type    = INC_TYPES.find(function(t){return t.id===inc.type;});
    var gravity = INC_GRAVITY.find(function(g){return g.id===inc.gravity;});
    var status  = INC_STATUS.find(function(s){return s.id===inc.status;});
    var dt      = inc.occurred_at ? new Date(inc.occurred_at) : new Date();
    var esc     = function(v){ return '"' + (v||'').toString().replace(/"/g,'""') + '"'; };
    return [
      esc(dt.toLocaleDateString('fr-FR')),
      esc(dt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})),
      esc(type ? type.label : inc.type),
      esc(gravity ? 'G' + gravity.id + ' ' + gravity.label : inc.gravity),
      esc(status ? status.label : inc.status),
      esc(inc.location),
      esc(inc.description),
      esc(inc.injured_persons),
      esc(inc.witnesses),
      esc(inc.causes),
      esc(inc.immediate_actions),
      esc(inc.profiles ? inc.profiles.full_name : '')
    ].join(',');
  });

  var csv  = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'incidents_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('⬇ Export CSV téléchargé', 'success');
}

// ── KPI injectés dans le dashboard accueil ────────────────────────────────────
// Appelé par loadHSEStats / loadCompanyStats (via monkey-patch dans analytics_charts.js
// OU appelé directement depuis showDashboard si analytics_charts non chargé)
async function loadIncidentsDashKPI(role) {
  if (!currentProfile || !currentProfile.org_id) return;
  var containerId = role + '-incidents-kpi';
  var container   = document.getElementById(containerId);
  if (!container) return;

  try {
    var orgId = currentProfile.org_id;
    var now   = new Date();
    var m30   = new Date(now); m30.setDate(m30.getDate() - 30);
    var m12   = new Date(now); m12.setMonth(m12.getMonth() - 12);

    var { data } = await sb.from('incidents')
      .select('id, type, status, gravity, occurred_at')
      .eq('org_id', orgId)
      .gte('occurred_at', m12.toISOString());

    var list       = data || [];
    var recent     = list.filter(function(i){return new Date(i.occurred_at)>=m30;});
    var ouverts    = list.filter(function(i){return i.status==='ouvert';}).length;
    var accRecent  = recent.filter(function(i){return i.type==='accident'||i.type==='accident_sans';}).length;
    var quasiRecent= recent.filter(function(i){return i.type==='quasi'||i.type==='presqu';}).length;

    container.innerHTML = ''
      + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">'
      + _incKpiCard('🚨', ouverts, 'Incidents ouverts', '#EF4444')
      + _incKpiCard('🔴', accRecent, 'Accidents (30j)', '#F97316')
      + _incKpiCard('🟡', quasiRecent, 'Quasi-acc. (30j)', '#EAB308')
      + '</div>';
  } catch(e) {
    container.innerHTML = '';
  }
}

function _incKpiCard(icon, val, label, color) {
  return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-left:3px solid ' + color + ';border-radius:10px;padding:12px;cursor:pointer" onclick="switchPage(\'' + (currentProfile&&currentProfile.role==='hse'?'HSE':'Company') + '\',\'incidents\',null);loadIncidents(\'' + (currentProfile&&currentProfile.role) + '\')">'
    + '<div style="font-size:18px">' + icon + '</div>'
    + '<div style="font-size:22px;font-weight:900;color:' + color + ';letter-spacing:-.5px;margin:4px 0">' + val + '</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700">' + label + '</div>'
    + '</div>';
}

// ── Navigation sous-vues ──────────────────────────────────────────────────────
function _incSwitchView(view, role) {
  _incSubView = view;
  renderIncidents(role);
}

// Exposé globalement pour les onclick inline
window._incSwitchView = _incSwitchView;

function _incSubBtn(view, label, role, badge) {
  var active = _incSubView === view;
  return '<button onclick="_incSwitchView(\'' + view + '\',\'' + role + '\')" style="'
    + 'padding:7px 14px;font-size:12px;font-weight:700;border-radius:8px;cursor:pointer;transition:.2s;'
    + 'background:' + (active ? 'rgba(248,113,113,.2)' : 'rgba(255,255,255,.04)') + ';'
    + 'border:1px solid ' + (active ? 'rgba(248,113,113,.4)' : 'rgba(255,255,255,.08)') + ';'
    + 'color:' + (active ? '#F87171' : 'var(--muted)') + '">'
    + label
    + (badge ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;background:#EF4444;color:#fff;font-size:9px;margin-left:4px">' + badge + '</span>' : '')
    + '</button>';
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function _incInputStyle() {
  return 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:inherit;outline:none;';
}

function _incField(label, input, fullWidth) {
  return '<div' + (fullWidth ? '' : '') + '>'
    + '<label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);display:block;margin-bottom:6px">' + label + '</label>'
    + input
    + '</div>';
}

function _incLoadingHTML() {
  return '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Chargement des incidents…</div></div>';
}

// ── Boot : vérification activation au login ───────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var _waitAuth = setInterval(function() {
    if (typeof currentProfile !== 'undefined' && currentProfile && typeof sb !== 'undefined') {
      clearInterval(_waitAuth);
      checkIncidentsActivation();
    }
  }, 300);
});

// ════════════════════════════════════════════════════════════════════════════
//  FIN DU MODULE incidents.js
// ════════════════════════════════════════════════════════════════════════════
