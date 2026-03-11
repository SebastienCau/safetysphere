// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE FDS / PRODUITS CHIMIQUES v1.0
//  Fichier : js/fds.js
//  Rôles   : hse (création + gestion), company (consultation)
//  Tables  : chemical_products, chemical_exposures
//  Activation : org_modules { org_id, module_id:'fds', enabled }
// ════════════════════════════════════════════════════════════════════════════

// ── Constantes ────────────────────────────────────────────────────────────

var FDS_CATEGORIES = [
  { id: 'solvant',    label: 'Solvant',          icon: '🫧', color: '#818CF8' },
  { id: 'acide',      label: 'Acide',             icon: '⚗️', color: '#F87171' },
  { id: 'base',       label: 'Base',              icon: '🧪', color: '#60A5FA' },
  { id: 'oxydant',    label: 'Oxydant',           icon: '🔆', color: '#FCD34D' },
  { id: 'inflammable',label: 'Inflammable',       icon: '🔥', color: '#F97316' },
  { id: 'toxique',    label: 'Toxique',           icon: '☠️', color: '#A855F7' },
  { id: 'corrosif',   label: 'Corrosif',          icon: '🧫', color: '#EF4444' },
  { id: 'cmu',        label: 'CMR (cancérogène)', icon: '⚠️', color: '#DC2626' },
  { id: 'autre',      label: 'Autre',             icon: '📦', color: '#94A3B8' },
];

var FDS_STATUTS = [
  { id: 'actif',     label: 'Actif',      color: '#22C55E', icon: '✅' },
  { id: 'interdit',  label: 'Interdit',   color: '#EF4444', icon: '🚫' },
  { id: 'substitue', label: 'Substitué',  color: '#F59E0B', icon: '🔄' },
  { id: 'archive',   label: 'Archivé',    color: '#475569', icon: '📁' },
];

var FDS_PICTOGRAMMES = [
  { id: 'GHS01', label: 'Explosif',           emoji: '💥' },
  { id: 'GHS02', label: 'Inflammable',        emoji: '🔥' },
  { id: 'GHS03', label: 'Comburant',          emoji: '🔆' },
  { id: 'GHS04', label: 'Gaz sous pression',  emoji: '🫙' },
  { id: 'GHS05', label: 'Corrosif',           emoji: '⚗️' },
  { id: 'GHS06', label: 'Toxique',            emoji: '☠️' },
  { id: 'GHS07', label: 'Irritant/Nocif',     emoji: '⚠️' },
  { id: 'GHS08', label: 'Danger santé',       emoji: '🫁' },
  { id: 'GHS09', label: 'Dangereux env.',     emoji: '🌿' },
];

var FDS_EPI = [
  { id: 'gants_chimiques',  label: '🧤 Gants chimiques' },
  { id: 'lunettes',         label: '🥽 Lunettes/Visière' },
  { id: 'masque_vapeur',    label: '😷 Masque vapeurs' },
  { id: 'masque_ari',       label: '🫁 ARI / masque gaz' },
  { id: 'combinaison',      label: '👔 Combinaison étanche' },
  { id: 'tablier',          label: '🦺 Tablier protection' },
  { id: 'chaussures_s3',    label: '👢 Chaussures S3' },
  { id: 'ventilation',      label: '💨 Ventilation forcée' },
];

// ── État interne ──────────────────────────────────────────────────────────

var _fdsProducts       = [];
var _fdsView           = 'liste';   // 'liste' | 'saisie' | 'detail' | 'inventaire'
var _fdsEditId         = null;
var _fdsDetailId       = null;
var _fdsFilterCat      = '';
var _fdsFilterStatut   = '';
var _fdsSearch         = '';

// ════════════════════════════════════════════════════════════════════════════
//  ACTIVATION MODULE
// ════════════════════════════════════════════════════════════════════════════

async function checkFdsActivation() {
  if (!currentProfile || !currentProfile.org_id) return false;
  var res = await sb.from('org_modules')
    .select('enabled')
    .eq('org_id', currentProfile.org_id)
    .eq('module_id', 'fds')
    .maybeSingle();
  var enabled = (res.data === null) ? true : res.data.enabled;
  updateFdsTabVisibility(enabled);
  return enabled;
}

function updateFdsTabVisibility(visible) {
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var oc = tab.getAttribute('onclick') || '';
    if (oc.includes("'fds'") || oc.includes('"fds"')) {
      tab.style.display = '';
      var dot = tab.querySelector('.fds-status-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'fds-status-dot';
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle;flex-shrink:0';
        tab.appendChild(dot);
      }
      dot.style.background = visible ? '#06B6D4' : '#475569';
      dot.title = visible ? 'Module actif' : 'Module inactif — activez-le dans Admin';
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT
// ════════════════════════════════════════════════════════════════════════════

async function loadFds(role) {
  if (!currentProfile) {
    setTimeout(function() { loadFds(role); }, 400);
    return;
  }
  if (!currentProfile.org_id) return;
  var orgId = currentProfile.org_id;

  var actRes = await sb.from('org_modules')
    .select('enabled').eq('org_id', orgId).eq('module_id', 'fds').maybeSingle();
  if (actRes.data && actRes.data.enabled === false) {
    renderFdsDisabled(role); return;
  }

  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-fds-content');
  if (container) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div>'
      + '<div class="empty-state-text">Chargement des produits chimiques...</div></div>';
  }

  var res = await sb.from('chemical_products')
    .select('*')
    .eq('org_id', orgId)
    .order('nom', { ascending: true });

  _fdsProducts = res.data || [];
  renderFds(role);
  var kpiId = (role === 'hse') ? 'hse-fds-kpi' : 'company-fds-kpi';
  renderFdsKPI(kpiId);
}

// ════════════════════════════════════════════════════════════════════════════
//  KPI — Widget dashboard accueil
// ════════════════════════════════════════════════════════════════════════════

function renderFdsKPI(targetId) {
  var el = targetId
    ? document.getElementById(targetId)
    : (document.getElementById('hse-fds-kpi') || document.getElementById('company-fds-kpi'));
  if (!el) return;

  var actifs    = _fdsProducts.filter(function(p) { return p.statut === 'actif'; });
  var cmr       = _fdsProducts.filter(function(p) { return p.categorie === 'cmu'; });
  var interdits = _fdsProducts.filter(function(p) { return p.statut === 'interdit'; });
  var sansFds   = _fdsProducts.filter(function(p) { return !p.fds_url && p.statut === 'actif'; });
  var dashRole  = currentProfile && currentProfile.role === 'hse' ? 'HSE' : 'Company';
  var roleKey   = currentProfile ? currentProfile.role : 'hse';

  el.innerHTML = '<div style="margin:28px 0 8px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div style="width:3px;height:20px;background:linear-gradient(180deg,#06B6D4,#0EA5E9);border-radius:2px"></div>'
    + '<span style="font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#06B6D4">Produits Chimiques / FDS</span>'
    + '</div>'
    + '<button onclick="switchPage(\'' + dashRole + '\',\'fds\',this);loadFds(\'' + roleKey + '\')" '
    + 'style="font-size:11px;background:rgba(6,182,212,.12);border:1px solid rgba(6,182,212,.25);'
    + 'border-radius:8px;padding:5px 12px;color:#06B6D4;cursor:pointer;font-weight:600">Voir tout →</button>'
    + '</div>'
    + '<div class="stats-grid" style="margin:0">'
    + _fdsKpiCard('⚗️', actifs.length,    'Produits actifs',     actifs.length > 0 ? '#06B6D4' : '#94A3B8')
    + _fdsKpiCard('⚠️', cmr.length,       'CMR',                 cmr.length > 0 ? '#DC2626' : '#94A3B8')
    + _fdsKpiCard('🚫', interdits.length, 'Interdits',           interdits.length > 0 ? '#EF4444' : '#94A3B8')
    + _fdsKpiCard('📄', sansFds.length,   'FDS manquantes',      sansFds.length > 0 ? '#F59E0B' : '#22C55E')
    + '</div></div>';
}

function _fdsKpiCard(icon, val, label, color) {
  return '<div class="stat-card" style="border-top:2px solid ' + color + '">'
    + '<div class="stat-icon">' + icon + '</div>'
    + '<div class="stat-value" style="color:' + color + '">' + val + '</div>'
    + '<div class="stat-label">' + label + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDU PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

function renderFds(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-fds-content');
  if (!container) return;

  var alerts = _buildFdsAlerts();

  container.innerHTML = ''
    + (alerts ? '<div id="fds-alerts-zone">' + alerts + '</div>' : '')
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
    + '  <div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '    <button id="fdsTabListe"      onclick="switchFdsView(\'liste\',\'' + role + '\')"      class="conform-tab active">📋 Inventaire</button>'
    + (role === 'hse'
        ? '    <button id="fdsTabSaisie"    onclick="switchFdsView(\'saisie\',\'' + role + '\')"    class="conform-tab">➕ Ajouter produit</button>'
        : '')
    + '    <button id="fdsTabInventaire" onclick="switchFdsView(\'inventaire\',\'' + role + '\')" class="conform-tab">📊 Tableau de bord</button>'
    + '  </div>'
    + '  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '    <input type="text" placeholder="🔍 Rechercher produit..." oninput="_fdsSearch=this.value;renderFdsListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 12px;color:var(--text);font-size:12px;width:190px">'
    + '    <select onchange="_fdsFilterCat=this.value;renderFdsListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:12px">'
    + '      <option value="">Toutes catégories</option>'
    + FDS_CATEGORIES.map(function(c) { return '<option value="' + c.id + '">' + c.icon + ' ' + c.label + '</option>'; }).join('')
    + '    </select>'
    + '    <select onchange="_fdsFilterStatut=this.value;renderFdsListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:12px">'
    + '      <option value="">Tous statuts</option>'
    + FDS_STATUTS.map(function(s) { return '<option value="' + s.id + '">' + s.icon + ' ' + s.label + '</option>'; }).join('')
    + '    </select>'
    + '    <button onclick="exportFdsCSV()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 12px;color:var(--muted);font-size:12px;cursor:pointer">📥 CSV</button>'
    + '  </div>'
    + '</div>'
    + '<div id="fds-view-content"></div>';

  renderFdsListe(role);
}

function switchFdsView(view, role) {
  _fdsView = view;
  var dash = role === 'hse' ? 'HSE' : 'Company';
  document.querySelectorAll('#' + dash + '-fds-content .conform-tab')
    .forEach(function(t) { t.classList.remove('active'); });
  var btn = document.getElementById('fdsTab' + view.charAt(0).toUpperCase() + view.slice(1));
  if (btn) btn.classList.add('active');

  if (view === 'liste')      renderFdsListe(role);
  if (view === 'saisie')     renderFdsSaisie(role, _fdsEditId || null);
  if (view === 'inventaire') renderFdsInventaire(role);
}

// ── Liste ─────────────────────────────────────────────────────────────────

function renderFdsListe(role) {
  var vc = document.getElementById('fds-view-content');
  if (!vc) return;

  var list = _fdsProducts.filter(function(p) {
    if (_fdsFilterCat    && p.categorie !== _fdsFilterCat)   return false;
    if (_fdsFilterStatut && p.statut    !== _fdsFilterStatut) return false;
    if (_fdsSearch) {
      var q = _fdsSearch.toLowerCase();
      return (p.nom             || '').toLowerCase().includes(q)
          || (p.nom_commercial  || '').toLowerCase().includes(q)
          || (p.numero_cas      || '').toLowerCase().includes(q)
          || (p.fournisseur     || '').toLowerCase().includes(q);
    }
    return true;
  });

  if (!list.length) {
    vc.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚗️</div>'
      + '<div class="empty-state-text">Aucun produit chimique enregistré</div>'
      + '<div class="empty-state-sub">'
      + (role === 'hse' ? 'Ajoutez votre premier produit avec le bouton "Ajouter produit"' : 'Votre responsable HSE n\'a pas encore renseigné l\'inventaire')
      + '</div></div>';
    return;
  }

  vc.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">'
    + list.map(function(p) { return _renderFdsCard(p, role); }).join('')
    + '</div>';
}

function _renderFdsCard(p, role) {
  var cat    = FDS_CATEGORIES.find(function(c) { return c.id === p.categorie; }) || FDS_CATEGORIES[FDS_CATEGORIES.length-1];
  var statut = FDS_STATUTS.find(function(s)    { return s.id === p.statut;    }) || FDS_STATUTS[0];
  var isCmr  = p.categorie === 'cmu';
  var noFds  = !p.fds_url && p.statut === 'actif';
  var borderColor = p.statut === 'interdit' ? '#EF4444'
                  : (isCmr ? '#DC2626'
                  : (noFds ? '#F59E0B' : cat.color));

  var pictos = (p.pictogrammes || []).slice(0, 4).map(function(pid) {
    var pg = FDS_PICTOGRAMMES.find(function(x) { return x.id === pid; });
    return pg ? '<span title="' + pg.label + '" style="font-size:16px">' + pg.emoji + '</span>' : '';
  }).join('');

  return '<div onclick="openFdsDetail(\'' + p.id + '\',\'' + role + '\')" '
    + 'style="background:var(--inset-bg);border:1px solid var(--inset-border);border-left:3px solid ' + borderColor + ';'
    + 'border-radius:12px;padding:14px 18px;cursor:pointer;transition:all .2s" '
    + 'onmouseover="this.style.background=\'var(--inset-bg-hover,rgba(255,255,255,.05))\'" '
    + 'onmouseout="this.style.background=\'var(--inset-bg)\'">'+
    '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'
    + '<div style="width:40px;height:40px;border-radius:10px;background:' + cat.color + '22;'
    + 'border:1px solid ' + cat.color + '44;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'
    + cat.icon + '</div>'
    + '<div style="flex:1;min-width:160px">'
    + '  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">'
    + '    <span style="font-size:14px;font-weight:700">' + _fdsEsc(p.nom) + '</span>'
    + (p.nom_commercial ? '<span style="font-size:11px;color:var(--muted)">(' + _fdsEsc(p.nom_commercial) + ')</span>' : '')
    + (isCmr ? '<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(220,38,38,.15);color:#EF4444">CMR</span>' : '')
    + '  </div>'
    + '  <div style="font-size:12px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap">'
    + (p.numero_cas ? '<span>CAS: ' + _fdsEsc(p.numero_cas) + '</span>' : '')
    + (p.fournisseur ? '<span>🏭 ' + _fdsEsc(p.fournisseur) + '</span>' : '')
    + (p.lieu_stockage ? '<span>📍 ' + _fdsEsc(p.lieu_stockage) + '</span>' : '')
    + '  </div>'
    + '</div>'
    + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">'
    + '  <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;background:' + statut.color + '22;color:' + statut.color + '">'
    + statut.icon + ' ' + statut.label + '</span>'
    + '  <div style="display:flex;gap:4px">' + pictos + '</div>'
    + (noFds ? '<span style="font-size:10px;color:#F59E0B;font-weight:700">⚠️ FDS manquante</span>' : '')
    + (p.fds_url ? '<span style="font-size:10px;color:#22C55E;font-weight:700">✅ FDS disponible</span>' : '')
    + '</div>'
    + '</div></div>';
}

// ── Mise à jour visuelle des cartes catégorie ─────────────────────────────

function onFdsCatChange() {
  var selected = document.querySelector('input[name="fdsCategorie"]:checked');
  FDS_CATEGORIES.forEach(function(c) {
    var card = document.getElementById('fds-cat-card-' + c.id);
    if (!card) return;
    var isSel = selected && selected.value === c.id;
    card.style.border    = '2px solid ' + (isSel ? c.color : 'rgba(255,255,255,.1)');
    card.style.background = isSel ? c.color + '15' : 'transparent';
  });
}

// ── Formulaire saisie ─────────────────────────────────────────────────────

function renderFdsSaisie(role, editId) {
  _fdsEditId = editId || null;
  var vc = document.getElementById('fds-view-content');
  if (!vc) return;

  var p      = editId ? (_fdsProducts.find(function(x) { return x.id === editId; }) || {}) : {};
  var isEdit = !!editId;
  var selCat = p.categorie || '';

  vc.innerHTML = '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:16px;padding:24px 28px;max-width:760px">'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:20px">'
    + (isEdit ? '✏️ Modifier le produit' : '➕ Nouveau produit chimique') + '</div>'

    // Catégorie
    + '<div class="form-group"><label class="form-label">Catégorie *</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:4px">'
    + FDS_CATEGORIES.map(function(c) {
        var sel = selCat === c.id;
        return '<label style="cursor:pointer"><input type="radio" name="fdsCategorie" value="' + c.id + '"'
          + (sel ? ' checked' : '') + ' onchange="onFdsCatChange()" style="display:none">'
          + '<div id="fds-cat-card-' + c.id + '" style="padding:10px 8px;border-radius:10px;text-align:center;border:2px solid '
          + (sel ? c.color : 'rgba(255,255,255,.1)') + ';background:' + (sel ? c.color + '15' : 'transparent')
          + ';transition:all .2s;font-size:11px;font-weight:700;cursor:pointer">'
          + '<div style="font-size:18px;margin-bottom:3px">' + c.icon + '</div>' + c.label + '</div></label>';
      }).join('')
    + '</div></div>'

    // Identification
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Nom DCI / IUPAC *</label>'
    + '<input class="form-input" id="fdsNom" placeholder="Ex: Acétone" value="' + _fdsAttr(p.nom||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Nom commercial</label>'
    + '<input class="form-input" id="fdsNomCom" placeholder="Ex: Nail Polish Remover" value="' + _fdsAttr(p.nom_commercial||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">N° CAS</label>'
    + '<input class="form-input" id="fdsNumeroCas" placeholder="67-64-1" value="' + _fdsAttr(p.numero_cas||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">N° CE (EINECS)</label>'
    + '<input class="form-input" id="fdsNumeroCe" placeholder="200-662-2" value="' + _fdsAttr(p.numero_ce||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Fournisseur</label>'
    + '<input class="form-input" id="fdsFournisseur" placeholder="Nom du fournisseur" value="' + _fdsAttr(p.fournisseur||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Référence interne</label>'
    + '<input class="form-input" id="fdsRefInterne" placeholder="Ex: CHIM-042" value="' + _fdsAttr(p.reference_interne||'') + '"></div>'
    + '</div>'

    // Pictogrammes SGH
    + '<div class="form-group" style="margin-top:16px"><label class="form-label">Pictogrammes SGH</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-top:6px">'
    + FDS_PICTOGRAMMES.map(function(pg) {
        var chk = (p.pictogrammes || []).includes(pg.id);
        return '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;padding:7px 10px;'
          + 'border-radius:8px;border:1px solid ' + (chk ? 'rgba(6,182,212,.35)' : 'rgba(255,255,255,.1)') + ';'
          + 'background:' + (chk ? 'rgba(6,182,212,.08)' : 'transparent') + ';transition:all .2s">'
          + '<input type="checkbox" id="picto_' + pg.id + '" value="' + pg.id + '"' + (chk ? ' checked' : '')
          + ' style="accent-color:#06B6D4">'
          + pg.emoji + ' ' + pg.label + '</label>';
      }).join('')
    + '</div></div>'

    // Mentions H et P
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Mentions H <span style="color:var(--muted);font-weight:400">(danger)</span></label>'
    + '<input class="form-input" id="fdsMentionsH" placeholder="Ex: H225, H302, H336" value="' + _fdsAttr(p.mentions_h||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Mentions P <span style="color:var(--muted);font-weight:400">(prudence)</span></label>'
    + '<input class="form-input" id="fdsMentionsP" placeholder="Ex: P210, P260, P280" value="' + _fdsAttr(p.mentions_p||'') + '"></div>'
    + '</div>'
    + '<div class="form-group" style="margin-top:12px"><label class="form-label">Mention de danger principale</label>'
    + '<input class="form-input" id="fdsMentionDanger" placeholder="Ex: Liquide et vapeurs très inflammables" value="' + _fdsAttr(p.mention_danger||'') + '"></div>'

    // Stockage
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Lieu de stockage</label>'
    + '<input class="form-input" id="fdsLieuStockage" placeholder="Ex: Local chimie Bât C" value="' + _fdsAttr(p.lieu_stockage||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Quantité max stockée</label>'
    + '<input class="form-input" id="fdsQuantiteMax" placeholder="Ex: 25 L" value="' + _fdsAttr(p.quantite_max||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Zone d\'utilisation</label>'
    + '<input class="form-input" id="fdsZoneUtilisation" placeholder="Ex: Atelier peinture" value="' + _fdsAttr(p.zone_utilisation||'') + '"></div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Conditions de stockage</label>'
    + '<input class="form-input" id="fdsConditionsStockage" placeholder="Ex: Température < 25°C, à l\'abri de la lumière" value="' + _fdsAttr(p.conditions_stockage||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Fréquence d\'utilisation</label>'
    + '<select class="form-input" id="fdsFrequence">'
    + '<option value="">— Non précisé —</option>'
    + ['quotidienne','hebdomadaire','mensuelle','occasionnelle'].map(function(f) {
        return '<option value="' + f + '"' + (p.frequence_utilisation === f ? ' selected' : '') + '>'
          + f.charAt(0).toUpperCase() + f.slice(1) + '</option>';
      }).join('')
    + '</select></div>'
    + '</div>'

    // EPI requis
    + '<div class="form-group" style="margin-top:16px"><label class="form-label">EPI obligatoires</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:6px">'
    + FDS_EPI.map(function(e) {
        var chk = (p.epi_requis || []).includes(e.id);
        return '<label style="display:flex;align-items:center;gap:7px;font-size:12px;cursor:pointer;padding:7px 10px;'
          + 'border-radius:8px;border:1px solid ' + (chk ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.1)') + ';'
          + 'background:' + (chk ? 'rgba(249,115,22,.08)' : 'transparent') + ';transition:all .2s">'
          + '<input type="checkbox" id="fds_epi_' + e.id + '" value="' + e.id + '"' + (chk ? ' checked' : '')
          + ' style="accent-color:var(--orange)">' + e.label + '</label>';
      }).join('')
    + '</div></div>'

    // FDS document
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:14px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">URL de la FDS <span style="color:var(--muted);font-weight:400">(lien externe ou Supabase Storage)</span></label>'
    + '<input class="form-input" id="fdsFdsUrl" placeholder="https://..." value="' + _fdsAttr(p.fds_url||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Date édition FDS</label>'
    + '<input type="date" class="form-input" id="fdsFdsDate" value="' + (p.fds_date_edition || '') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Version FDS</label>'
    + '<input class="form-input" id="fdsFdsVersion" placeholder="Ex: v3.0 — janv. 2024" value="' + _fdsAttr(p.fds_version||'') + '"></div>'
    + '</div>'
    + '<div class="form-group" style="margin-top:10px"><label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px">'
    + '<input type="checkbox" id="fdsFdsVisible"' + (p.fds_visible_worker ? ' checked' : '') + ' style="accent-color:#22C55E;width:16px;height:16px">'
    + '<span>FDS accessible aux workers (via QR code badge) — <em style="color:var(--muted)">cochez uniquement si pertinent</em></span>'
    + '</label></div>'

    // Statut
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Statut</label>'
    + '<select class="form-input" id="fdsStatut">'
    + FDS_STATUTS.map(function(s) {
        return '<option value="' + s.id + '"' + ((p.statut||'actif') === s.id ? ' selected' : '') + '>'
          + s.icon + ' ' + s.label + '</option>';
      }).join('')
    + '</select></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Quantité seuil d\'alerte</label>'
    + '<input class="form-input" id="fdsQuantiteAlerte" placeholder="Ex: Alerte si < 5 L" value="' + _fdsAttr(p.quantite_alerte||'') + '"></div>'
    + '</div>'

    // Notes
    + '<div class="form-group" style="margin-top:12px"><label class="form-label">Notes / Remarques</label>'
    + '<textarea class="form-input" id="fdsNotes" style="height:80px;resize:vertical" placeholder="Conditions particulières, substitution en cours...">'
    + _fdsEsc(p.notes||'') + '</textarea></div>'

    + '<div style="display:flex;gap:10px;margin-top:20px">'
    + '<button onclick="saveFdsProduct(\'' + role + '\')" class="btn-upload" style="flex:1">💾 '
    + (isEdit ? 'Modifier' : 'Enregistrer le produit') + '</button>'
    + '<button onclick="switchFdsView(\'liste\',\'' + role + '\')" class="btn-sm btn-view" style="padding:10px 18px">Annuler</button>'
    + '</div>'
    + '</div>';
}

// ── Sauvegarde ─────────────────────────────────────────────────────────────

async function saveFdsProduct(role) {
  if (!currentProfile || !currentProfile.org_id) return;

  var catVal = document.querySelector('input[name="fdsCategorie"]:checked');
  var nom    = (document.getElementById('fdsNom') || {}).value || '';

  if (!catVal || !catVal.value) { showToast('Sélectionnez une catégorie', 'error'); return; }
  if (!nom.trim())              { showToast('Le nom du produit est obligatoire', 'error'); return; }

  // Pictogrammes
  var pictos = Array.from(document.querySelectorAll('input[id^="picto_"]:checked')).map(function(i) { return i.value; });

  // EPI
  var epiList = Array.from(document.querySelectorAll('input[id^="fds_epi_"]:checked')).map(function(i) { return i.value; });

  var fdsDateVal = (document.getElementById('fdsFdsDate') || {}).value || null;

  var payload = {
    org_id:               currentProfile.org_id,
    created_by:           currentProfile.id,
    nom:                  nom.trim(),
    nom_commercial:       _fdsVal('fdsNomCom')      || null,
    numero_cas:           _fdsVal('fdsNumeroCas')   || null,
    numero_ce:            _fdsVal('fdsNumeroCe')    || null,
    fournisseur:          _fdsVal('fdsFournisseur') || null,
    reference_interne:    _fdsVal('fdsRefInterne')  || null,
    categorie:            catVal.value,
    pictogrammes:         pictos,
    mentions_h:           _fdsVal('fdsMentionsH')         || null,
    mentions_p:           _fdsVal('fdsMentionsP')         || null,
    mention_danger:       _fdsVal('fdsMentionDanger')     || null,
    lieu_stockage:        _fdsVal('fdsLieuStockage')      || null,
    quantite_max:         _fdsVal('fdsQuantiteMax')       || null,
    conditions_stockage:  _fdsVal('fdsConditionsStockage')|| null,
    zone_utilisation:     _fdsVal('fdsZoneUtilisation')   || null,
    frequence_utilisation:(document.getElementById('fdsFrequence')||{}).value || null,
    epi_requis:           epiList,
    fds_url:              _fdsVal('fdsFdsUrl')    || null,
    fds_date_edition:     fdsDateVal,
    fds_version:          _fdsVal('fdsFdsVersion')|| null,
    fds_visible_worker:   !!(document.getElementById('fdsFdsVisible') || {}).checked,
    statut:               (document.getElementById('fdsStatut')||{}).value || 'actif',
    quantite_alerte:      _fdsVal('fdsQuantiteAlerte') || null,
    notes:                _fdsVal('fdsNotes')           || null,
    updated_at:           new Date().toISOString(),
  };

  var res;
  if (_fdsEditId) {
    res = await sb.from('chemical_products').update(payload).eq('id', _fdsEditId);
  } else {
    res = await sb.from('chemical_products').insert([payload]);
  }

  if (res.error) {
    showToast('Erreur : ' + res.error.message, 'error');
    console.error('[fds] save error', res.error);
    return;
  }

  showToast(_fdsEditId ? '✅ Produit modifié' : '✅ Produit enregistré', 'success');
  _fdsEditId = null;
  await loadFds(role);
  switchFdsView('liste', role);
}

// ── Détail produit ─────────────────────────────────────────────────────────

function openFdsDetail(id, role) {
  _fdsDetailId = id;
  var p = _fdsProducts.find(function(x) { return x.id === id; });
  if (!p) return;

  _fdsView = 'detail';
  var vc = document.getElementById('fds-view-content');
  if (!vc) return;

  var cat    = FDS_CATEGORIES.find(function(c) { return c.id === p.categorie; }) || FDS_CATEGORIES[FDS_CATEGORIES.length-1];
  var statut = FDS_STATUTS.find(function(s) { return s.id === p.statut; }) || FDS_STATUTS[0];
  var pictos = (p.pictogrammes || []).map(function(pid) {
    var pg = FDS_PICTOGRAMMES.find(function(x) { return x.id === pid; });
    return pg ? '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 12px;'
      + 'border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)">'
      + '<span style="font-size:24px">' + pg.emoji + '</span>'
      + '<span style="font-size:10px;color:var(--muted);text-align:center">' + pg.label + '</span></div>' : '';
  }).join('');

  vc.innerHTML = ''
    // Header
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">'
    + '  <button onclick="switchFdsView(\'liste\',\'' + role + '\')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 14px;color:var(--muted);font-size:12px;cursor:pointer">← Retour</button>'
    + '  <div style="flex:1">'
    + '    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '      <span style="font-size:22px">' + cat.icon + '</span>'
    + '      <span style="font-size:16px;font-weight:700">' + _fdsEsc(p.nom) + '</span>'
    + (p.nom_commercial ? '<span style="font-size:12px;color:var(--muted)">(' + _fdsEsc(p.nom_commercial) + ')</span>' : '')
    + '      <span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:10px;background:' + statut.color + '22;color:' + statut.color + '">'
    + statut.icon + ' ' + statut.label + '</span>'
    + (p.categorie === 'cmu' ? '<span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:10px;background:rgba(220,38,38,.15);color:#EF4444">⚠️ CMR — Précautions renforcées</span>' : '')
    + '    </div>'
    + '  </div>'
    + (role === 'hse' ? '  <div style="display:flex;gap:8px;flex-wrap:wrap">'
        + '<button onclick="_fdsEditId=\'' + id + '\';renderFdsSaisie(\'' + role + '\',\'' + id + '\');switchFdsView(\'saisie\',\'' + role + '\')" '
        + 'style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:7px 14px;color:#A5B4FC;font-size:12px;cursor:pointer">✏️ Modifier</button>'
        + (p.fds_url ? '<a href="' + _fdsEsc(p.fds_url) + '" target="_blank" '
          + 'style="background:rgba(6,182,212,.15);border:1px solid rgba(6,182,212,.3);border-radius:8px;padding:7px 14px;color:#06B6D4;font-size:12px;cursor:pointer;text-decoration:none">📄 Ouvrir FDS</a>' : '')
        + '</div>' : (p.fds_url ? '<a href="' + _fdsEsc(p.fds_url) + '" target="_blank" style="background:rgba(6,182,212,.15);border:1px solid rgba(6,182,212,.3);border-radius:8px;padding:7px 14px;color:#06B6D4;font-size:12px;cursor:pointer;text-decoration:none">📄 Consulter la FDS</a>' : ''))
    + '</div>'

    // 2 colonnes
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'

    // Col gauche
    + '<div style="display:flex;flex-direction:column;gap:12px">'
    + _fdsInfoCard('🔬 Identification', [
        ['Nom DCI',          p.nom],
        ['Nom commercial',   p.nom_commercial || '—'],
        ['N° CAS',           p.numero_cas || '—'],
        ['N° CE',            p.numero_ce || '—'],
        ['Fournisseur',      p.fournisseur || '—'],
        ['Réf. interne',     p.reference_interne || '—'],
        ['Catégorie',        cat.icon + ' ' + cat.label],
      ])
    + _fdsInfoCard('📦 Stockage & Usage', [
        ['Lieu stockage',    p.lieu_stockage || '—'],
        ['Quantité max',     p.quantite_max || '—'],
        ['Conditions',       p.conditions_stockage || '—'],
        ['Zone utilisation', p.zone_utilisation || '—'],
        ['Fréquence',        p.frequence_utilisation || '—'],
        ['Seuil alerte',     p.quantite_alerte || '—'],
      ])
    + '</div>'

    // Col droite
    + '<div style="display:flex;flex-direction:column;gap:12px">'

    // Pictogrammes
    + (pictos ? '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
        + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:12px">⚠️ Pictogrammes SGH</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + pictos + '</div>'
        + '</div>' : '')

    // Mentions
    + ((p.mentions_h || p.mentions_p || p.mention_danger)
        ? '<div style="background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.15);border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#EF4444;margin-bottom:10px">⚠️ Mentions de danger</div>'
          + (p.mention_danger ? '<div style="font-size:13px;font-weight:600;margin-bottom:8px">' + _fdsEsc(p.mention_danger) + '</div>' : '')
          + (p.mentions_h ? '<div style="font-size:12px;margin-bottom:4px"><span style="color:var(--muted)">H :</span> ' + _fdsEsc(p.mentions_h) + '</div>' : '')
          + (p.mentions_p ? '<div style="font-size:12px"><span style="color:var(--muted)">P :</span> ' + _fdsEsc(p.mentions_p) + '</div>' : '')
          + '</div>'
        : '')

    // EPI
    + (p.epi_requis && p.epi_requis.length
        ? '<div style="background:rgba(249,115,22,.05);border:1px solid rgba(249,115,22,.15);border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--orange);margin-bottom:10px">⛑️ EPI obligatoires</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
          + p.epi_requis.map(function(eid) {
              var e = FDS_EPI.find(function(x) { return x.id === eid; });
              return e ? '<span style="font-size:12px;padding:4px 10px;border-radius:10px;background:rgba(249,115,22,.12);color:var(--orange)">' + e.label + '</span>' : '';
            }).join('')
          + '</div></div>'
        : '')

    // FDS
    + '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:10px">📄 Fiche de Données de Sécurité</div>'
    + (p.fds_url
        ? '<div style="display:flex;flex-direction:column;gap:5px;font-size:12px">'
          + '<span style="color:#22C55E;font-weight:700">✅ FDS disponible</span>'
          + (p.fds_version ? '<span style="color:var(--muted)">Version : ' + _fdsEsc(p.fds_version) + '</span>' : '')
          + (p.fds_date_edition ? '<span style="color:var(--muted)">Date : ' + p.fds_date_edition + '</span>' : '')
          + (p.fds_visible_worker ? '<span style="color:#22C55E">🔓 Accessible aux workers</span>' : '<span style="color:var(--muted)">🔒 Interne HSE uniquement</span>')
          + '</div>'
        : '<div style="font-size:12px;color:#F59E0B;font-weight:600">⚠️ FDS non renseignée — à ajouter dès que possible</div>')
    + '</div>'

    + (p.notes ? '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
        + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:8px">📝 Notes</div>'
        + '<div style="font-size:13px;white-space:pre-wrap">' + _fdsEsc(p.notes) + '</div></div>' : '')

    + '</div></div>';
}

function _fdsInfoCard(title, rows) {
  return '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:12px">' + title + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:7px">'
    + rows.map(function(r) {
        return '<div style="display:flex;gap:10px;font-size:12px">'
          + '<span style="color:var(--muted);min-width:100px;flex-shrink:0">' + r[0] + '</span>'
          + '<span style="color:var(--text);font-weight:600">' + _fdsEsc(r[1] || '—') + '</span>'
          + '</div>';
      }).join('')
    + '</div></div>';
}

// ── Tableau de bord inventaire ─────────────────────────────────────────────

function renderFdsInventaire(role) {
  var vc = document.getElementById('fds-view-content');
  if (!vc) return;

  var total     = _fdsProducts.length;
  var actifs    = _fdsProducts.filter(function(p) { return p.statut === 'actif'; });
  var cmrList   = _fdsProducts.filter(function(p) { return p.categorie === 'cmu'; });
  var sansFds   = _fdsProducts.filter(function(p) { return !p.fds_url && p.statut === 'actif'; });
  var interdits = _fdsProducts.filter(function(p) { return p.statut === 'interdit'; });

  // Répartition par catégorie
  var byCat = {};
  FDS_CATEGORIES.forEach(function(c) { byCat[c.id] = 0; });
  _fdsProducts.forEach(function(p) {
    if (p.statut === 'actif') byCat[p.categorie] = (byCat[p.categorie] || 0) + 1;
  });

  vc.innerHTML = ''
    // Stats
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:24px">'
    + _fdsBigCard('⚗️', total,         'Produits au total',    '#06B6D4')
    + _fdsBigCard('✅', actifs.length, 'Produits actifs',      '#22C55E')
    + _fdsBigCard('⚠️', cmrList.length,'CMR / dangereux',      cmrList.length > 0 ? '#DC2626' : '#94A3B8')
    + _fdsBigCard('📄', sansFds.length, 'FDS manquantes',       sansFds.length > 0 ? '#F59E0B' : '#22C55E')
    + _fdsBigCard('🚫', interdits.length,'Interdits',           interdits.length > 0 ? '#EF4444' : '#94A3B8')
    + '</div>'

    // Répartition catégories
    + '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:16px;padding:20px;margin-bottom:16px">'
    + '<div style="font-size:13px;font-weight:700;margin-bottom:16px">📊 Répartition par catégorie (produits actifs)</div>'
    + '<div style="display:flex;flex-direction:column;gap:10px">'
    + FDS_CATEGORIES.filter(function(c) { return byCat[c.id] > 0; }).map(function(c) {
        var count = byCat[c.id];
        var pct   = actifs.length ? Math.round(count / actifs.length * 100) : 0;
        return '<div style="display:flex;align-items:center;gap:10px">'
          + '<span style="font-size:14px;width:24px;text-align:center">' + c.icon + '</span>'
          + '<span style="font-size:12px;min-width:100px;color:var(--text)">' + c.label + '</span>'
          + '<div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden">'
          + '<div style="height:100%;border-radius:4px;background:' + c.color + ';width:' + pct + '%"></div>'
          + '</div>'
          + '<span style="font-size:12px;font-weight:700;color:' + c.color + ';min-width:40px;text-align:right">'
          + count + ' (' + pct + '%)</span>'
          + '</div>';
      }).join('')
    + '</div></div>'

    // CMR list
    + (cmrList.length ? '<div style="background:rgba(220,38,38,.05);border:1px solid rgba(220,38,38,.2);border-radius:16px;padding:20px">'
        + '<div style="font-size:13px;font-weight:700;color:#EF4444;margin-bottom:14px">☠️ Produits CMR — Vigilance renforcée (' + cmrList.length + ')</div>'
        + '<div style="display:flex;flex-direction:column;gap:8px">'
        + cmrList.map(function(p) {
            return '<div onclick="openFdsDetail(\'' + p.id + '\',\'' + role + '\')" '
              + 'style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;'
              + 'background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.15);cursor:pointer">'
              + '<span style="font-weight:700;font-size:13px">' + _fdsEsc(p.nom) + '</span>'
              + (p.fournisseur ? '<span style="font-size:12px;color:var(--muted)">🏭 ' + _fdsEsc(p.fournisseur) + '</span>' : '')
              + (p.fds_url ? '<span style="margin-left:auto;font-size:11px;color:#22C55E;font-weight:700">✅ FDS OK</span>'
                           : '<span style="margin-left:auto;font-size:11px;color:#F59E0B;font-weight:700">⚠️ FDS manquante</span>')
              + '</div>';
          }).join('')
        + '</div></div>' : '');
}

function _fdsBigCard(icon, val, label, color) {
  return '<div class="stat-card" style="border-top:2px solid ' + color + ';padding:16px 14px">'
    + '<div class="stat-icon">' + icon + '</div>'
    + '<div class="stat-value" style="color:' + color + '">' + val + '</div>'
    + '<div class="stat-label">' + label + '</div>'
    + '</div>';
}

// ── Alertes ────────────────────────────────────────────────────────────────

function _buildFdsAlerts() {
  var alerts = [];
  var cmrSansFds = _fdsProducts.filter(function(p) {
    return p.categorie === 'cmu' && !p.fds_url && p.statut === 'actif';
  });
  var interditsActifs = _fdsProducts.filter(function(p) { return p.statut === 'interdit'; });
  var nbSansFds = _fdsProducts.filter(function(p) { return !p.fds_url && p.statut === 'actif'; }).length;

  if (cmrSansFds.length) {
    alerts.push({ type: 'error', msg: '☠️ <strong>' + cmrSansFds.length + ' produit(s) CMR sans FDS</strong> — obligation réglementaire urgente' });
  }
  if (interditsActifs.length) {
    alerts.push({ type: 'error', msg: '🚫 <strong>' + interditsActifs.length + ' produit(s) interdit(s)</strong> présent(s) dans l\'inventaire' });
  }
  if (nbSansFds > 0 && !cmrSansFds.length) {
    alerts.push({ type: 'warn', msg: '⚠️ <strong>' + nbSansFds + ' produit(s) actif(s)</strong> sans FDS renseignée' });
  }

  return alerts.map(function(a) {
    var bg = a.type === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)';
    var border = a.type === 'error' ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.25)';
    var color  = a.type === 'error' ? '#FCA5A5' : '#FCD34D';
    return '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:' + color + '">' + a.msg + '</div>';
  }).join('');
}

// ── Module désactivé ────────────────────────────────────────────────────────

function renderFdsDisabled(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-fds-content');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">'
    + '<div class="empty-state-icon">🔒</div>'
    + '<div class="empty-state-text">Module FDS désactivé</div>'
    + '<div class="empty-state-sub">Activez-le depuis le panneau Admin → Modules</div>'
    + '</div>';
}

// ── Export CSV ─────────────────────────────────────────────────────────────

function exportFdsCSV() {
  if (!_fdsProducts.length) { showToast('Aucun produit à exporter', 'warn'); return; }
  var headers = ['Nom','Nom commercial','N° CAS','N° CE','Catégorie','Fournisseur','Statut',
    'Pictogrammes','Mentions H','Mentions P','Lieu stockage','Quantité max','Zone utilisation',
    'Fréquence','EPI','FDS URL','Date FDS','Version FDS','Notes'];
  var rows = _fdsProducts.map(function(p) {
    return [
      p.nom,
      p.nom_commercial || '',
      p.numero_cas || '',
      p.numero_ce || '',
      p.categorie,
      p.fournisseur || '',
      p.statut,
      (p.pictogrammes || []).join('; '),
      p.mentions_h || '',
      p.mentions_p || '',
      p.lieu_stockage || '',
      p.quantite_max || '',
      p.zone_utilisation || '',
      p.frequence_utilisation || '',
      (p.epi_requis || []).join('; '),
      p.fds_url || '',
      p.fds_date_edition || '',
      p.fds_version || '',
      p.notes || '',
    ].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  });
  var csv  = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'inventaire_chimique_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export CSV généré', 'success');
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _fdsEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _fdsAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _fdsVal(id) {
  var el = document.getElementById(id);
  return el ? (el.value || '').trim() : '';
}

// ════════════════════════════════════════════════════════════════════════════
//  BOOT — polling currentProfile
// ════════════════════════════════════════════════════════════════════════════

(function _fdsBootstrap() {
  var attempts = 0;
  var MAX = 30;
  function tryBoot() {
    attempts++;
    if (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.org_id) {
      checkFdsActivation();
      return;
    }
    if (attempts < MAX) setTimeout(tryBoot, 400);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryBoot);
  } else {
    tryBoot();
  }
})();
