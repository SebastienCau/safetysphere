// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE PERMIS DE TRAVAIL v1.0
//  Fichier : js/permis.js
//  Rôles   : hse (création + validation), company (consultation + signature)
//  Tables  : work_permits, permit_checklists
//  Activation : org_modules { org_id, module_id:'permis', enabled }
//  Dépendances : incidents (lien optionnel incident_id)
// ════════════════════════════════════════════════════════════════════════════

// ── Constantes ────────────────────────────────────────────────────────────

var PERMIT_TYPES = [
  { id: 'feu',        label: 'Permis Feu',              icon: '🔥', color: '#EF4444',
    habilitations: ['soudure','meulage','point_chaud'],
    checklist: [
      { id: 'extincteur',    label: 'Extincteur à moins de 5m', required: true },
      { id: 'inflammables',  label: 'Matières inflammables éloignées', required: true },
      { id: 'surveillance',  label: 'Surveillance 1h après travaux', required: true },
      { id: 'permis_affiche',label: 'Permis affiché sur le lieu', required: true },
      { id: 'signalement',   label: 'Zone signalée (ruban, panneaux)', required: true },
      { id: 'ventilation',   label: 'Ventilation adaptée', required: false },
    ]
  },
  { id: 'hauteur',    label: 'Travail en Hauteur',       icon: '🪜', color: '#F97316',
    habilitations: ['travail_hauteur','harnais'],
    checklist: [
      { id: 'harnais',       label: 'Harnais antichute vérifié et porté', required: true },
      { id: 'ancrage',       label: 'Point d\'ancrage certifié', required: true },
      { id: 'balisage',      label: 'Zone au sol balisée', required: true },
      { id: 'echafaudage',   label: 'Échafaudage / nacelle contrôlé(e)', required: true },
      { id: 'plan_chute',    label: 'Plan de sauvetage défini', required: true },
      { id: 'conditions_meteo', label: 'Conditions météo compatibles', required: true },
      { id: 'supervision',   label: 'Superviseur présent sur site', required: false },
    ]
  },
  { id: 'confine',    label: 'Espace Confiné',           icon: '🕳️', color: '#8B5CF6',
    habilitations: ['espace_confine'],
    checklist: [
      { id: 'analyse_atm',   label: 'Analyse atmosphère OK (O2, CO, H2S)', required: true },
      { id: 'ventilation',   label: 'Ventilation forcée active', required: true },
      { id: 'gardien',       label: 'Gardien / vigie extérieur présent', required: true },
      { id: 'communication', label: 'Moyen de communication fonctionnel', required: true },
      { id: 'plan_secours',  label: 'Plan de secours défini', required: true },
      { id: 'epi_confine',   label: 'EPI spécifiques (ARI, équipement)', required: true },
      { id: 'consignation',  label: 'Consignation énergie effectuée', required: true },
    ]
  },
  { id: 'consignation', label: 'Consignation / Déconsignation', icon: '⚡', color: '#F59E0B',
    habilitations: ['habilitation_elec'],
    checklist: [
      { id: 'identification', label: 'Équipement(s) identifié(s) et étiquetés', required: true },
      { id: 'mise_hors',      label: 'Mise hors énergie confirmée', required: true },
      { id: 'verrou',         label: 'Verrouillage effectué (cadenas)', required: true },
      { id: 'signalisation',  label: 'Signalisation "NE PAS MANŒUVRER"', required: true },
      { id: 'verification',   label: 'Absence d\'énergie résiduelle vérifiée', required: true },
      { id: 'ordre_consign',  label: 'Ordre de consignation signé', required: true },
      { id: 'deconsign_ok',   label: 'Déconsignation autorisée par responsable', required: false },
    ]
  },
  { id: 'fouille',    label: 'Fouille / Excavation',     icon: '⛏️', color: '#10B981',
    habilitations: [],
    checklist: [
      { id: 'detect_reseaux', label: 'Détection réseaux souterrains', required: true },
      { id: 'blindage',       label: 'Blindage parois si profondeur > 1,3m', required: true },
      { id: 'acces_securise', label: 'Accès / sortie sécurisé(e)', required: true },
      { id: 'balisage_fouille', label: 'Zone balisée et clôturée', required: true },
      { id: 'supervision_fouille', label: 'Superviseur présent', required: true },
    ]
  },
  { id: 'chimique',   label: 'Risque Chimique',          icon: '⚗️', color: '#06B6D4',
    habilitations: ['risque_chimique'],
    checklist: [
      { id: 'fds_lue',        label: 'FDS consultée et connue', required: true },
      { id: 'epi_chimique',   label: 'EPI chimiques adaptés portés', required: true },
      { id: 'ventilation_chim', label: 'Ventilation et captation active', required: true },
      { id: 'kit_deversement', label: 'Kit anti-déversement disponible', required: true },
      { id: 'douche_securite', label: 'Douche de sécurité accessible', required: false },
    ]
  },
  { id: 'autre',      label: 'Autre permis',             icon: '📋', color: '#94A3B8',
    habilitations: [],
    checklist: []
  },
];

var PERMIT_STATUS = [
  { id: 'brouillon',  label: 'Brouillon',   color: '#94A3B8', icon: '✏️' },
  { id: 'en_attente', label: 'En attente de signature', color: '#F59E0B', icon: '⏳' },
  { id: 'actif',      label: 'Actif',       color: '#22C55E', icon: '✅' },
  { id: 'suspendu',   label: 'Suspendu',    color: '#EF4444', icon: '🔴' },
  { id: 'cloture',    label: 'Clôturé',     color: '#60A5FA', icon: '🔒' },
  { id: 'annule',     label: 'Annulé',      color: '#475569', icon: '✕' },
];

// ── État interne ──────────────────────────────────────────────────────────

var _permits           = [];
var _permitView        = 'liste';   // 'liste' | 'saisie' | 'detail'
var _permitEditId      = null;
var _permitDetailId    = null;
var _permitFilterType  = '';
var _permitFilterStatus = '';
var _permitSearch      = '';
var _permitChecklist   = {};  // { checklistItemId: true/false }

// ════════════════════════════════════════════════════════════════════════════
//  SQL — À exécuter dans Supabase SQL Editor
// ════════════════════════════════════════════════════════════════════════════
/*
CREATE TABLE IF NOT EXISTS work_permits (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  created_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  type             text NOT NULL,
  status           text DEFAULT 'brouillon',
  reference        text,
  title            text NOT NULL,
  location         text,
  description      text,
  date_debut       timestamptz NOT NULL,
  date_fin         timestamptz NOT NULL,
  intervenants     text,
  responsable_nom  text,
  responsable_email text,
  epi_requis       text[],
  checklist_data   jsonb DEFAULT '{}',
  notes            text,
  incident_id      uuid REFERENCES incidents(id) ON DELETE SET NULL,
  signed_executant     jsonb,
  signed_donneur_ordre jsonb,
  signed_at            timestamptz,
  suspension_reason    text,
  suspended_at         timestamptz,
  closed_at            timestamptz,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),

  CONSTRAINT work_permits_type_check CHECK (
    type IN ('feu','hauteur','confine','consignation','fouille','chimique','autre')
  ),
  CONSTRAINT work_permits_status_check CHECK (
    status IN ('brouillon','en_attente','actif','suspendu','cloture','annule')
  )
);

ALTER TABLE work_permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permits_org" ON work_permits FOR ALL
  USING (org_id IN (SELECT org_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "permits_admin" ON work_permits FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Index
CREATE INDEX IF NOT EXISTS idx_work_permits_org    ON work_permits(org_id);
CREATE INDEX IF NOT EXISTS idx_work_permits_status ON work_permits(status);
CREATE INDEX IF NOT EXISTS idx_work_permits_type   ON work_permits(type);

-- Insertion dans org_modules (actif par défaut)
INSERT INTO org_modules (org_id, module_id, enabled)
  SELECT id, 'permis', true FROM organizations
  ON CONFLICT (org_id, module_id) DO NOTHING;
*/

// ════════════════════════════════════════════════════════════════════════════
//  ACTIVATION MODULE
// ════════════════════════════════════════════════════════════════════════════

async function checkPermisActivation() {
  if (!currentProfile || !currentProfile.org_id) return false;
  var res = await sb.from('org_modules')
    .select('enabled')
    .eq('org_id', currentProfile.org_id)
    .eq('module_id', 'permis')
    .maybeSingle();
  var enabled = (res.data === null) ? true : res.data.enabled;
  updatePermisTabVisibility(enabled);
  return enabled;
}

function updatePermisTabVisibility(visible) {
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var oc = tab.getAttribute('onclick') || '';
    if (oc.includes("'permis'") || oc.includes('"permis"')) {
      tab.style.display = '';
      var dot = tab.querySelector('.permis-status-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'permis-status-dot';
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle;flex-shrink:0';
        tab.appendChild(dot);
      }
      dot.style.background = visible ? '#F59E0B' : '#475569';
      dot.title = visible ? 'Module actif' : 'Module inactif — activez-le dans Admin';
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════
//  CHARGEMENT DONNÉES
// ════════════════════════════════════════════════════════════════════════════

async function loadPermis(role) {
  if (!currentProfile) {
    // Polling si profil pas encore chargé
    setTimeout(function() { loadPermis(role); }, 400);
    return;
  }
  if (!currentProfile.org_id) return;
  var orgId = currentProfile.org_id;

  // Vérifier activation
  var actRes = await sb.from('org_modules')
    .select('enabled').eq('org_id', orgId).eq('module_id', 'permis').maybeSingle();
  if (actRes.data && actRes.data.enabled === false) {
    renderPermisDisabled(role); return;
  }

  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-permis-content');
  if (container) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div>'
      + '<div class="empty-state-text">Chargement des permis...</div></div>';
  }

  var res = await sb.from('work_permits')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  _permits = res.data || [];
  renderPermis(role);
  var kpiId = (role === 'hse') ? 'hse-permis-kpi' : 'company-permis-kpi';
  renderPermisKPI(kpiId);
}

// ════════════════════════════════════════════════════════════════════════════
//  KPI — Widget dashboard accueil
// ════════════════════════════════════════════════════════════════════════════

function renderPermisKPI(targetId) {
  // Support appel direct avec targetId (ex: 'hse-permis-kpi') OU sans argument (cherche le div existant)
  var el = targetId
    ? document.getElementById(targetId)
    : (document.getElementById('hse-permis-kpi') || document.getElementById('company-permis-kpi'));
  if (!el) return;

  var now  = new Date();
  var actifs    = _permits.filter(function(p) { return p.status === 'actif'; });
  var attente   = _permits.filter(function(p) { return p.status === 'en_attente'; });
  var suspendus = _permits.filter(function(p) { return p.status === 'suspendu'; });
  var expirantBientot = actifs.filter(function(p) {
    var fin = new Date(p.date_fin);
    return (fin - now) < 24 * 3600 * 1000 && fin > now;
  });
  var dashRole = currentProfile && currentProfile.role === 'hse' ? 'HSE' : 'Company';

  el.innerHTML = '<div style="margin:28px 0 8px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;gap:10px">'
    + '<div style="width:3px;height:20px;background:linear-gradient(180deg,#F59E0B,#F97316);border-radius:2px"></div>'
    + '<span style="font-family:\'Barlow\',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#F59E0B">Permis de Travail</span>'
    + '</div>'
    + '<button onclick="switchPage(\'' + dashRole + '\',\'permis\',this);loadPermis(\'' + (currentProfile ? currentProfile.role : 'hse') + '\')" '
    + 'style="font-size:11px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.25);'
    + 'border-radius:8px;padding:5px 12px;color:#F59E0B;cursor:pointer;font-weight:600">Voir tout →</button>'
    + '</div>'
    + '<div class="stats-grid" style="margin:0">'
    + _permisKpiCard('✅', actifs.length,         'Actifs',            actifs.length > 0 ? '#22C55E' : '#94A3B8')
    + _permisKpiCard('⏳', attente.length,         'En attente',        attente.length > 0 ? '#F59E0B' : '#94A3B8')
    + _permisKpiCard('🔴', suspendus.length,       'Suspendus',         suspendus.length > 0 ? '#EF4444' : '#94A3B8')
    + _permisKpiCard('⚠️', expirantBientot.length, 'Expirent < 24h',   expirantBientot.length > 0 ? '#F97316' : '#94A3B8')
    + '</div></div>';
}

function _permisKpiCard(icon, val, label, color) {
  return '<div class="stat-card" style="border-top:2px solid ' + color + '">'
    + '<div class="stat-icon">' + icon + '</div>'
    + '<div class="stat-value" style="color:' + color + '">' + val + '</div>'
    + '<div class="stat-label">' + label + '</div>'
    + '</div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  RENDU PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

function renderPermis(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-permis-content');
  if (!container) return;

  // Alertes permis actifs expirant bientôt ou dépassés
  var alerts = _buildPermisAlerts();

  // En-tête + sous-vues
  container.innerHTML = ''
    + (alerts ? '<div id="permis-alerts-zone">' + alerts + '</div>' : '')
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
    + '  <div style="display:flex;gap:8px;flex-wrap:wrap">'
    + '    <button id="permisTabListe"  onclick="switchPermisView(\'liste\',\'' + role + '\')"  class="conform-tab active">📋 Registre</button>'
    + '    <button id="permisTabSaisie" onclick="switchPermisView(\'saisie\',\'' + role + '\')" class="conform-tab">➕ Nouveau permis</button>'
    + '  </div>'
    + '  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">'
    + '    <input type="text" placeholder="🔍 Rechercher..." oninput="_permitSearch=this.value;renderPermisListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 12px;color:var(--text);font-size:12px;width:180px">'
    + '    <select onchange="_permitFilterType=this.value;renderPermisListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:12px">'
    + '      <option value="">Tous types</option>'
    + PERMIT_TYPES.map(function(t) { return '<option value="' + t.id + '">' + t.icon + ' ' + t.label + '</option>'; }).join('')
    + '    </select>'
    + '    <select onchange="_permitFilterStatus=this.value;renderPermisListe(\'' + role + '\')"'
    + '      style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;padding:7px 10px;color:var(--text);font-size:12px">'
    + '      <option value="">Tous statuts</option>'
    + PERMIT_STATUS.map(function(s) { return '<option value="' + s.id + '">' + s.icon + ' ' + s.label + '</option>'; }).join('')
    + '    </select>'
    + '    <button onclick="exportPermisCSV()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 12px;color:var(--muted);font-size:12px;cursor:pointer">📥 CSV</button>'
    + '  </div>'
    + '</div>'
    + '<div id="permis-view-content"></div>';

  renderPermisListe(role);
}

function switchPermisView(view, role) {
  _permitView = view;
  document.querySelectorAll('#' + (role === 'hse' ? 'HSE' : 'Company') + '-permis-content .conform-tab')
    .forEach(function(t) { t.classList.remove('active'); });
  var btn = document.getElementById('permisTab' + view.charAt(0).toUpperCase() + view.slice(1));
  if (btn) btn.classList.add('active');

  if (view === 'liste')  renderPermisListe(role);
  if (view === 'saisie') renderPermisSaisie(role, _permitEditId || null);
}

// ── Liste ─────────────────────────────────────────────────────────────────

function renderPermisListe(role) {
  var vc = document.getElementById('permis-view-content');
  if (!vc) return;

  var list = _permits.filter(function(p) {
    if (_permitFilterType   && p.type   !== _permitFilterType)   return false;
    if (_permitFilterStatus && p.status !== _permitFilterStatus) return false;
    if (_permitSearch) {
      var q = _permitSearch.toLowerCase();
      return (p.title    || '').toLowerCase().includes(q)
          || (p.location || '').toLowerCase().includes(q)
          || (p.reference|| '').toLowerCase().includes(q);
    }
    return true;
  });

  if (!list.length) {
    vc.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div>'
      + '<div class="empty-state-text">Aucun permis de travail</div>'
      + '<div class="empty-state-sub">Créez votre premier permis avec le bouton "Nouveau permis"</div></div>';
    return;
  }

  vc.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">'
    + list.map(function(p) { return _renderPermisCard(p, role); }).join('')
    + '</div>';
}

function _renderPermisCard(p, role) {
  var typeObj   = PERMIT_TYPES.find(function(t) { return t.id === p.type; }) || PERMIT_TYPES[PERMIT_TYPES.length-1];
  var statusObj = PERMIT_STATUS.find(function(s) { return s.id === p.status; }) || PERMIT_STATUS[0];
  var now     = new Date();
  var dateFin = new Date(p.date_fin);
  var isExpired = dateFin < now && p.status === 'actif';
  var isSoonExp = !isExpired && (dateFin - now) < 24 * 3600 * 1000 && p.status === 'actif';

  var borderColor = isExpired ? '#EF4444' : (isSoonExp ? '#F97316' : statusObj.color);

  // Checklist progress
  var typeChecklist = typeObj.checklist || [];
  var checkedCount  = 0;
  if (p.checklist_data && typeChecklist.length) {
    typeChecklist.forEach(function(ci) {
      if (p.checklist_data[ci.id]) checkedCount++;
    });
  }
  var checkPct = typeChecklist.length ? Math.round(checkedCount / typeChecklist.length * 100) : 100;

  return '<div onclick="openPermisDetail(\'' + p.id + '\',\'' + role + '\')" '
    + 'style="background:var(--inset-bg);border:1px solid var(--inset-border);border-left:3px solid ' + borderColor + ';'
    + 'border-radius:12px;padding:16px 18px;cursor:pointer;transition:all .2s" '
    + 'onmouseover="this.style.background=\'var(--inset-bg-hover,rgba(255,255,255,.05))\'" '
    + 'onmouseout="this.style.background=\'var(--inset-bg)\'">'
    + '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">'
    + '  <div style="width:40px;height:40px;border-radius:10px;background:' + typeObj.color + '22;'
    + '    border:1px solid ' + typeObj.color + '44;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">'
    + typeObj.icon + '</div>'
    + '  <div style="flex:1;min-width:160px">'
    + '    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'
    + '      <span style="font-size:14px;font-weight:700">' + _escHtml(p.title) + '</span>'
    + (p.reference ? '<span style="font-size:11px;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px">' + _escHtml(p.reference) + '</span>' : '')
    + '    </div>'
    + '    <div style="font-size:12px;color:var(--muted);display:flex;gap:12px;flex-wrap:wrap">'
    + (p.location ? '<span>📍 ' + _escHtml(p.location) + '</span>' : '')
    + '      <span>📅 ' + _fmtDate(p.date_debut) + ' → ' + _fmtDate(p.date_fin) + '</span>'
    + (isExpired ? '<span style="color:#EF4444;font-weight:700">⚠️ EXPIRÉ</span>' : '')
    + (isSoonExp ? '<span style="color:#F97316;font-weight:700">⚠️ Expire bientôt</span>' : '')
    + '    </div>'
    + '  </div>'
    + '  <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">'
    + '    <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:10px;background:' + statusObj.color + '22;color:' + statusObj.color + '">'
    + statusObj.icon + ' ' + statusObj.label + '</span>'
    + (typeChecklist.length ? '<div style="font-size:11px;color:var(--muted)">'
        + '<span style="color:' + (checkPct===100?'#22C55E':'#F59E0B') + ';font-weight:700">' + checkPct + '%</span>'
        + ' checklist</div>' : '')
    + '  </div>'
    + '</div>'
    + (p.suspension_reason ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:8px;font-size:12px;color:#EF4444">🔴 Suspendu : ' + _escHtml(p.suspension_reason) + '</div>' : '')
    + '</div>';
}

// ── Saisie / Formulaire ────────────────────────────────────────────────────

function renderPermisSaisie(role, editId) {
  _permitEditId = editId || null;
  var vc = document.getElementById('permis-view-content');
  if (!vc) return;

  var p    = editId ? (_permits.find(function(x) { return x.id === editId; }) || {}) : {};
  var isEdit = !!editId;
  var now  = new Date();
  var iso  = function(d) { return d ? d.slice(0,16) : ''; };

  vc.innerHTML = '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:16px;padding:24px 28px;max-width:720px">'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:20px">'
    + (isEdit ? '✏️ Modifier le permis' : '➕ Nouveau permis de travail') + '</div>'

    // Type
    + '<div class="form-group"><label class="form-label">Type de permis *</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-top:4px">'
    + PERMIT_TYPES.map(function(t) {
        var sel = (p.type || '') === t.id;
        return '<label style="cursor:pointer"><input type="radio" name="permitType" value="' + t.id + '"'
          + (sel ? ' checked' : '') + ' onchange="onPermitTypeChange(this.value);onPermitTypeCardChange()" style="display:none">'
          + '<div id="permit-type-card-' + t.id + '" style="padding:12px 10px;border-radius:10px;text-align:center;border:2px solid '
          + (sel ? t.color : 'rgba(255,255,255,.1)') + ';background:' + (sel ? t.color + '15' : 'transparent')
          + ';transition:all .2s;font-size:12px;font-weight:700;cursor:pointer">'
          + '<div style="font-size:20px;margin-bottom:4px">' + t.icon + '</div>' + t.label + '</div></label>';
      }).join('')
    + '</div></div>'

    // Infos générales
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px">'
    + '<div class="form-group" style="margin:0"><label class="form-label">Titre / Objet *</label>'
    + '<input class="form-input" id="permitTitle" placeholder="Ex: Soudure chaudière Bât A" value="' + _escAttr(p.title||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Référence interne</label>'
    + '<input class="form-input" id="permitRef" placeholder="Ex: PDT-2024-042" value="' + _escAttr(p.reference||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Lieu / Zone *</label>'
    + '<input class="form-input" id="permitLocation" placeholder="Ex: Atelier mécanique — Zone B2" value="' + _escAttr(p.location||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Intervenants</label>'
    + '<input class="form-input" id="permitIntervenants" placeholder="Noms des intervenants" value="' + _escAttr(p.intervenants||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Date et heure de début *</label>'
    + '<input type="datetime-local" class="form-input" id="permitDateDebut" value="' + iso(p.date_debut) + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Date et heure de fin *</label>'
    + '<input type="datetime-local" class="form-input" id="permitDateFin" value="' + iso(p.date_fin) + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Responsable (nom)</label>'
    + '<input class="form-input" id="permitRespNom" placeholder="Nom du donneur d\'ordre" value="' + _escAttr(p.responsable_nom||'') + '"></div>'
    + '<div class="form-group" style="margin:0"><label class="form-label">Responsable (email)</label>'
    + '<input type="email" class="form-input" id="permitRespEmail" placeholder="donneur@ordre.fr" value="' + _escAttr(p.responsable_email||'') + '"></div>'
    + '</div>'

    // EPI requis
    + '<div class="form-group" style="margin-top:16px"><label class="form-label">EPI requis</label>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-top:6px">'
    + _renderEpiCheckboxes(p.epi_requis || [])
    + '</div></div>'

    // Checklist dynamique (se charge selon type)
    + '<div id="permitChecklistBlock" style="margin-top:16px"></div>'

    // Lien incident optionnel
    + '<div class="form-group" style="margin-top:16px"><label class="form-label">Incident lié <span style="color:var(--muted);font-weight:400">(optionnel)</span></label>'
    + '<select class="form-input" id="permitIncidentId">'
    + '<option value="">— Aucun —</option>'
    + (_incidents || []).map(function(i) {
        return '<option value="' + i.id + '"' + (p.incident_id === i.id ? ' selected' : '') + '>'
          + _escHtml(i.title) + ' (' + _fmtDate(i.occurred_at) + ')</option>';
      }).join('')
    + '</select></div>'

    // Notes
    + '<div class="form-group" style="margin-top:12px"><label class="form-label">Notes / Remarques</label>'
    + '<textarea class="form-input" id="permitNotes" style="height:80px;resize:vertical" placeholder="Conditions particulières, consignes...">'
    + _escHtml(p.notes||'') + '</textarea></div>'

    // Boutons
    + '<div style="display:flex;gap:10px;margin-top:20px">'
    + '<button onclick="savePermit(\'' + role + '\')" class="btn-upload" style="flex:1">💾 '
    + (isEdit ? 'Modifier' : 'Créer le permis') + '</button>'
    + '<button onclick="switchPermisView(\'liste\',\'' + role + '\')" class="btn-sm btn-view" style="padding:10px 18px">Annuler</button>'
    + '</div>'
    + '</div>';

  // Charger checklist si type déjà sélectionné
  if (p.type) onPermitTypeChange(p.type, p.checklist_data || {});
}

function _renderEpiCheckboxes(selected) {
  var epis = [
    { id: 'casque',       label: '⛑️ Casque' },
    { id: 'gants',        label: '🧤 Gants' },
    { id: 'gilet',        label: '🦺 Gilet HV' },
    { id: 'chaussures',   label: '👢 Chaussures S3' },
    { id: 'lunettes',     label: '🥽 Lunettes' },
    { id: 'harnais',      label: '🪢 Harnais' },
    { id: 'masque',       label: '😷 Masque resp.' },
    { id: 'antibruit',    label: '🎧 Anti-bruit' },
    { id: 'combinaison',  label: '👔 Combinaison' },
    { id: 'ari',          label: '🫁 ARI' },
  ];
  return epis.map(function(e) {
    var chk = selected.includes(e.id);
    return '<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;padding:6px 10px;'
      + 'border-radius:8px;border:1px solid ' + (chk ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.1)') + ';'
      + 'background:' + (chk ? 'rgba(249,115,22,.08)' : 'transparent') + ';transition:all .2s">'
      + '<input type="checkbox" id="epi_' + e.id + '" value="' + e.id + '"' + (chk ? ' checked' : '')
      + ' style="accent-color:var(--orange)">' + e.label + '</label>';
  }).join('');
}

function onPermitTypeCardChange() {
  var selected = document.querySelector('input[name="permitType"]:checked');
  PERMIT_TYPES.forEach(function(t) {
    var card = document.getElementById('permit-type-card-' + t.id);
    if (!card) return;
    var isSel = selected && selected.value === t.id;
    card.style.border     = '2px solid ' + (isSel ? t.color : 'rgba(255,255,255,.1)');
    card.style.background = isSel ? t.color + '15' : 'transparent';
  });
}

function onPermitTypeChange(typeId, existingData) {
  var typeObj = PERMIT_TYPES.find(function(t) { return t.id === typeId; });
  var block   = document.getElementById('permitChecklistBlock');
  if (!block) return;

  if (!typeObj || !typeObj.checklist.length) {
    block.innerHTML = '';
    return;
  }

  var data = existingData || _permitChecklist;

  block.innerHTML = '<div style="background:rgba(249,115,22,.05);border:1px solid rgba(249,115,22,.15);'
    + 'border-radius:12px;padding:16px 18px">'
    + '<div style="font-size:12px;font-weight:700;color:var(--orange);margin-bottom:12px;'
    + 'text-transform:uppercase;letter-spacing:.8px">✔ Checklist ' + typeObj.icon + ' ' + typeObj.label + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + typeObj.checklist.map(function(ci) {
        var checked = data[ci.id] === true || data[ci.id] === 'true';
        return '<label style="display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;'
          + 'padding:8px 12px;border-radius:8px;border:1px solid ' + (checked ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.08)') + ';'
          + 'background:' + (checked ? 'rgba(34,197,94,.06)' : 'transparent') + ';transition:all .2s">'
          + '<input type="checkbox" id="cl_' + ci.id + '" value="' + ci.id + '"' + (checked ? ' checked' : '')
          + ' style="accent-color:#22C55E;width:16px;height:16px;flex-shrink:0">'
          + '<span style="flex:1">' + ci.label + '</span>'
          + (ci.required ? '<span style="font-size:10px;color:#EF4444;font-weight:700;padding:2px 6px;background:rgba(239,68,68,.1);border-radius:8px">REQ.</span>' : '')
          + '</label>';
      }).join('')
    + '</div></div>';
}

// ── Sauvegarde ─────────────────────────────────────────────────────────────

async function savePermit(role) {
  if (!currentProfile || !currentProfile.org_id) return;

  var typeVal   = document.querySelector('input[name="permitType"]:checked');
  var title     = (document.getElementById('permitTitle')       || {}).value || '';
  var location  = (document.getElementById('permitLocation')     || {}).value || '';
  var dateDebut = (document.getElementById('permitDateDebut')    || {}).value || '';
  var dateFin   = (document.getElementById('permitDateFin')      || {}).value || '';

  if (!typeVal || !typeVal.value) { showToast('Sélectionnez un type de permis', 'error'); return; }
  if (!title.trim())              { showToast('Le titre est obligatoire', 'error'); return; }
  if (!location.trim())           { showToast('Le lieu est obligatoire', 'error'); return; }
  if (!dateDebut || !dateFin)     { showToast('Les dates sont obligatoires', 'error'); return; }
  if (new Date(dateFin) <= new Date(dateDebut)) { showToast('La date de fin doit être après le début', 'error'); return; }

  // Collecter EPI
  var epiInputs = document.querySelectorAll('input[id^="epi_"]:checked');
  var epiList   = Array.from(epiInputs).map(function(i) { return i.value; });

  // Collecter checklist
  var typeObj     = PERMIT_TYPES.find(function(t) { return t.id === typeVal.value; });
  var checkData   = {};
  if (typeObj) {
    typeObj.checklist.forEach(function(ci) {
      var inp = document.getElementById('cl_' + ci.id);
      if (inp) checkData[ci.id] = inp.checked;
    });
    // Vérifier items obligatoires
    var missing = typeObj.checklist.filter(function(ci) {
      return ci.required && !checkData[ci.id];
    });
    if (missing.length) {
      showToast('Checklist incomplète : ' + missing.length + ' item(s) requis non cochés', 'warn');
      // On laisse sauvegarder en brouillon — le statut ne peut pas passer à "actif" sans checklist complète
    }
  }

  var incidentId = (document.getElementById('permitIncidentId') || {}).value || null;

  var payload = {
    org_id:           currentProfile.org_id,
    created_by:       currentProfile.id,
    type:             typeVal.value,
    title:            title.trim(),
    reference:        ((document.getElementById('permitRef')          || {}).value || '').trim() || null,
    location:         location.trim(),
    intervenants:     ((document.getElementById('permitIntervenants') || {}).value || '').trim() || null,
    date_debut:       new Date(dateDebut).toISOString(),
    date_fin:         new Date(dateFin).toISOString(),
    responsable_nom:  ((document.getElementById('permitRespNom')      || {}).value || '').trim() || null,
    responsable_email:((document.getElementById('permitRespEmail')    || {}).value || '').trim() || null,
    epi_requis:       epiList,
    checklist_data:   checkData,
    notes:            ((document.getElementById('permitNotes')        || {}).value || '').trim() || null,
    incident_id:      incidentId || null,
    status:           'brouillon',
    updated_at:       new Date().toISOString(),
  };

  var res;
  if (_permitEditId) {
    res = await sb.from('work_permits').update(payload).eq('id', _permitEditId);
  } else {
    res = await sb.from('work_permits').insert([payload]);
  }

  if (res.error) {
    showToast('Erreur : ' + res.error.message, 'error');
    console.error('[permis] save error', res.error);
    return;
  }

  showToast(_permitEditId ? '✅ Permis modifié' : '✅ Permis créé', 'success');
  _permitEditId = null;
  await loadPermis(role);
  switchPermisView('liste', role);
}

// ── Détail ──────────────────────────────────────────────────────────────────

async function openPermisDetail(id, role) {
  _permitDetailId = id;
  var p = _permits.find(function(x) { return x.id === id; });
  if (!p) return;

  _permitView = 'detail';
  var vc = document.getElementById('permis-view-content');
  if (!vc) return;

  var typeObj   = PERMIT_TYPES.find(function(t) { return t.id === p.type; }) || PERMIT_TYPES[PERMIT_TYPES.length-1];
  var statusObj = PERMIT_STATUS.find(function(s) { return s.id === p.status; }) || PERMIT_STATUS[0];
  var now       = new Date();
  var dateFin   = new Date(p.date_fin);
  var isExpired = dateFin < now && p.status === 'actif';

  // Calcul checklist
  var checkItems = typeObj.checklist || [];
  var checkedOk  = checkItems.filter(function(ci) { return p.checklist_data && p.checklist_data[ci.id]; });
  var allRequired = checkItems.filter(function(ci) { return ci.required; });
  var reqOk      = allRequired.filter(function(ci) { return p.checklist_data && p.checklist_data[ci.id]; });
  var checklistComplete = allRequired.length === 0 || reqOk.length === allRequired.length;

  // Signatures
  var sigExec  = p.signed_executant     ? JSON.parse(typeof p.signed_executant     === 'string' ? p.signed_executant     : JSON.stringify(p.signed_executant))     : null;
  var sigDO    = p.signed_donneur_ordre ? JSON.parse(typeof p.signed_donneur_ordre === 'string' ? p.signed_donneur_ordre : JSON.stringify(p.signed_donneur_ordre)) : null;

  vc.innerHTML = ''
    // Header détail
    + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">'
    + '  <button onclick="switchPermisView(\'liste\',\'' + role + '\')" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 14px;color:var(--muted);font-size:12px;cursor:pointer">← Retour</button>'
    + '  <div style="flex:1">'
    + '    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">'
    + '      <span style="font-size:22px">' + typeObj.icon + '</span>'
    + '      <span style="font-size:16px;font-weight:700">' + _escHtml(p.title) + '</span>'
    + (p.reference ? '<span style="font-size:11px;color:var(--muted);background:rgba(255,255,255,.06);padding:2px 8px;border-radius:10px">' + _escHtml(p.reference) + '</span>' : '')
    + '      <span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:10px;background:' + statusObj.color + '22;color:' + statusObj.color + '">'
    + statusObj.icon + ' ' + statusObj.label + '</span>'
    + (isExpired ? '<span style="font-size:12px;font-weight:700;padding:4px 12px;border-radius:10px;background:rgba(239,68,68,.15);color:#EF4444">⚠️ EXPIRÉ</span>' : '')
    + '    </div>'
    + '  </div>'
    + '  <div style="display:flex;gap:8px;flex-wrap:wrap">'
    + (p.status === 'brouillon' || p.status === 'en_attente'
        ? '<button onclick="_permitEditId=\'' + id + '\';renderPermisSaisie(\'' + role + '\',\'' + id + '\');switchPermisView(\'saisie\',\'' + role + '\')" '
          + 'style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:7px 14px;color:#A5B4FC;font-size:12px;cursor:pointer">✏️ Modifier</button>'
        : '')
    + (p.status === 'brouillon' && checklistComplete
        ? '<button onclick="updatePermitStatus(\'' + id + '\',\'en_attente\',\'' + role + '\')" '
          + 'style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:7px 14px;color:#F59E0B;font-size:12px;cursor:pointer">📤 Soumettre pour signature</button>'
        : '')
    + (p.status === 'en_attente'
        ? '<button onclick="openPermisSignModal(\'' + id + '\',\'executant\',\'' + role + '\')" '
          + 'style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:7px 14px;color:#22C55E;font-size:12px;cursor:pointer">✍️ Signer (Exécutant)</button>'
          + '<button onclick="openPermisSignModal(\'' + id + '\',\'donneur_ordre\',\'' + role + '\')" '
          + 'style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:7px 14px;color:#A5B4FC;font-size:12px;cursor:pointer">✍️ Signer (Donneur d\'ordre)</button>'
        : '')
    + (p.status === 'actif'
        ? '<button onclick="openPermisSuspendModal(\'' + id + '\',\'' + role + '\')" '
          + 'style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:7px 14px;color:#EF4444;font-size:12px;cursor:pointer">🔴 Suspendre</button>'
          + '<button onclick="updatePermitStatus(\'' + id + '\',\'cloture\',\'' + role + '\')" '
          + 'style="background:rgba(96,165,250,.15);border:1px solid rgba(96,165,250,.3);border-radius:8px;padding:7px 14px;color:#60A5FA;font-size:12px;cursor:pointer">🔒 Clôturer</button>'
        : '')
    + (p.status === 'suspendu'
        ? '<button onclick="updatePermitStatus(\'' + id + '\',\'actif\',\'' + role + '\')" '
          + 'style="background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);border-radius:8px;padding:7px 14px;color:#22C55E;font-size:12px;cursor:pointer">▶️ Reprendre</button>'
        : '')
    + (p.status !== 'annule' && p.status !== 'cloture'
        ? '<button onclick="updatePermitStatus(\'' + id + '\',\'annule\',\'' + role + '\')" '
          + 'style="background:rgba(71,85,105,.15);border:1px solid rgba(71,85,105,.3);border-radius:8px;padding:7px 14px;color:#94A3B8;font-size:12px;cursor:pointer">✕ Annuler</button>'
        : '')
    + '  </div>'
    + '</div>'

    // Infos + Checklist (2 colonnes)
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">'

    // Colonne gauche : infos
    + '<div style="display:flex;flex-direction:column;gap:12px">'
    + _permitInfoCard('📋 Détails', [
        ['Type',         typeObj.icon + ' ' + typeObj.label],
        ['Lieu',         p.location || '—'],
        ['Intervenants', p.intervenants || '—'],
        ['Début',        _fmtDateTime(p.date_debut)],
        ['Fin',          _fmtDateTime(p.date_fin)],
        ['Responsable',  (p.responsable_nom || '—') + (p.responsable_email ? ' (' + p.responsable_email + ')' : '')],
        ['Incident lié', p.incident_id ? '🚨 ' + _getIncidentLabel(p.incident_id) : '—'],
        ['Créé le',      _fmtDate(p.created_at)],
      ])
    // EPI
    + (p.epi_requis && p.epi_requis.length
        ? '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:10px">⛑️ EPI requis</div>'
          + '<div style="display:flex;flex-wrap:wrap;gap:6px">'
          + p.epi_requis.map(function(e) {
              return '<span style="font-size:12px;padding:3px 10px;border-radius:10px;background:rgba(249,115,22,.12);color:var(--orange)">' + e + '</span>';
            }).join('')
          + '</div></div>'
        : '')
    // Notes
    + (p.notes
        ? '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:8px">📝 Notes</div>'
          + '<div style="font-size:13px;color:var(--text);white-space:pre-wrap">' + _escHtml(p.notes) + '</div></div>'
        : '')
    + '</div>'

    // Colonne droite : checklist + signatures
    + '<div style="display:flex;flex-direction:column;gap:12px">'
    // Checklist
    + (checkItems.length
        ? '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
          + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted)">✔ Checklist</div>'
          + '<span style="font-size:12px;font-weight:700;color:' + (checklistComplete ? '#22C55E' : '#F59E0B') + '">'
          + checkedOk.length + '/' + checkItems.length + ' — '
          + (checklistComplete ? 'COMPLÈTE ✅' : 'INCOMPLÈTE ⚠️') + '</span>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;gap:6px">'
          + checkItems.map(function(ci) {
              var checked = p.checklist_data && p.checklist_data[ci.id];
              return '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:'
                + (checked ? 'rgba(34,197,94,.06)' : 'rgba(255,255,255,.02)') + '">'
                + '<span style="font-size:14px">' + (checked ? '✅' : (ci.required ? '❌' : '⬜')) + '</span>'
                + '<span style="font-size:12px;flex:1">' + ci.label + '</span>'
                + (ci.required && !checked ? '<span style="font-size:10px;color:#EF4444;font-weight:700">REQ.</span>' : '')
                + '</div>';
            }).join('')
          + '</div></div>'
        : '')
    // Signatures
    + '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:12px">✍️ Signatures</div>'
    + _renderSigBlock('Exécutant', sigExec)
    + _renderSigBlock('Donneur d\'ordre', sigDO)
    + (sigExec && sigDO ? '<div style="margin-top:10px;padding:8px 12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);border-radius:8px;font-size:12px;font-weight:700;color:#22C55E;text-align:center">✅ PERMIS DOUBLE-SIGNÉ — VALIDE</div>' : '')
    + '</div>'
    // Suspension
    + (p.suspension_reason
        ? '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#EF4444;margin-bottom:8px">🔴 Motif de suspension</div>'
          + '<div style="font-size:13px;color:var(--text)">' + _escHtml(p.suspension_reason) + '</div>'
          + '<div style="font-size:11px;color:var(--muted);margin-top:4px">Suspendu le ' + _fmtDateTime(p.suspended_at) + '</div>'
          + '</div>'
        : '')
    + '</div></div>';
}

function _renderSigBlock(label, sig) {
  if (!sig) {
    return '<div style="padding:10px 12px;margin-bottom:8px;border-radius:8px;border:1px dashed rgba(255,255,255,.12);background:rgba(255,255,255,.02)">'
      + '<div style="font-size:12px;color:var(--muted)">⬜ ' + label + ' — non signé</div></div>';
  }
  return '<div style="padding:10px 12px;margin-bottom:8px;border-radius:8px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2)">'
    + '<div style="font-size:12px;font-weight:700;color:#22C55E">✅ ' + label + ' — signé</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:3px">' + _escHtml(sig.name || '—') + ' · ' + _fmtDateTime(sig.timestamp) + '</div>'
    + '</div>';
}

function _permitInfoCard(title, rows) {
  return '<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:14px 16px">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:12px">' + title + '</div>'
    + '<div style="display:flex;flex-direction:column;gap:7px">'
    + rows.map(function(r) {
        return '<div style="display:flex;gap:10px;font-size:12px">'
          + '<span style="color:var(--muted);min-width:90px;flex-shrink:0">' + r[0] + '</span>'
          + '<span style="color:var(--text);font-weight:600">' + r[1] + '</span>'
          + '</div>';
      }).join('')
    + '</div></div>';
}

function _getIncidentLabel(id) {
  var inc = (_incidents || []).find(function(i) { return i.id === id; });
  return inc ? inc.title : id.slice(0, 8) + '…';
}

// ── Actions statut ─────────────────────────────────────────────────────────

async function updatePermitStatus(id, newStatus, role) {
  var confirmMessages = {
    'en_attente': 'Soumettre ce permis pour signature ?',
    'actif':      'Activer ce permis ? Il sera opérationnel.',
    'cloture':    'Clôturer définitivement ce permis ?',
    'annule':     'Annuler ce permis ? Cette action est irréversible.',
    'suspendu':   null  // géré par modal
  };
  var msg = confirmMessages[newStatus];
  if (msg && !confirm(msg)) return;

  var extra = { updated_at: new Date().toISOString() };
  if (newStatus === 'cloture') extra.closed_at = new Date().toISOString();

  // Si on passe à 'actif' depuis 'en_attente' : vérifier double signature
  if (newStatus === 'actif') {
    var p = _permits.find(function(x) { return x.id === id; });
    if (!p || !p.signed_executant || !p.signed_donneur_ordre) {
      showToast('Le permis doit être signé par l\'exécutant ET le donneur d\'ordre', 'error');
      return;
    }
  }

  var res = await sb.from('work_permits')
    .update(Object.assign({ status: newStatus }, extra))
    .eq('id', id);

  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  showToast('✅ Statut mis à jour', 'success');
  await loadPermis(role);
  openPermisDetail(id, role);
}

// ── Modal signature "double-lock" ──────────────────────────────────────────

function openPermisSignModal(id, sigType, role) {
  var p = _permits.find(function(x) { return x.id === id; });
  if (!p) return;

  // Vérifier que la checklist obligatoire est complète
  var typeObj = PERMIT_TYPES.find(function(t) { return t.id === p.type; });
  if (typeObj && typeObj.checklist.length) {
    var reqMissing = typeObj.checklist.filter(function(ci) {
      return ci.required && !(p.checklist_data && p.checklist_data[ci.id]);
    });
    if (reqMissing.length) {
      showToast('❌ Checklist incomplète — ' + reqMissing.length + ' item(s) requis manquants. Modifiez le permis d\'abord.', 'error');
      return;
    }
  }

  var typeLabel = sigType === 'executant' ? 'Exécutant' : 'Donneur d\'ordre';
  var alreadySigned = sigType === 'executant' ? p.signed_executant : p.signed_donneur_ordre;

  if (alreadySigned) {
    showToast('Ce permis est déjà signé par le ' + typeLabel, 'warn');
    return;
  }

  // Mini-modal inline
  var vc = document.getElementById('permis-view-content');
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = '<div style="background:var(--bg,#0D1B2A);border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px;max-width:400px;width:100%;text-align:center">'
    + '<div style="font-size:32px;margin-bottom:8px">✍️</div>'
    + '<div style="font-size:15px;font-weight:700;margin-bottom:6px">Signature — ' + typeLabel + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:20px">En signant, vous confirmez avoir pris connaissance des conditions du permis et de la checklist de sécurité.</div>'
    + '<div class="form-group" style="text-align:left;margin-bottom:14px"><label class="form-label">Votre nom complet *</label>'
    + '<input type="text" id="signPermitName" class="form-input" placeholder="Prénom Nom" value="' + _escAttr((currentProfile ? currentProfile.full_name : '') || '') + '"></div>'
    + '<div style="display:flex;gap:10px">'
    + '<button onclick="submitPermitSignature(\'' + id + '\',\'' + sigType + '\',\'' + role + '\')" class="btn-upload" style="flex:1">✅ Confirmer la signature</button>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" class="btn-sm btn-view" style="padding:10px 16px">Annuler</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
}

async function submitPermitSignature(id, sigType, role) {
  var nameInput = document.getElementById('signPermitName');
  var name = nameInput ? nameInput.value.trim() : '';
  if (!name) { showToast('Votre nom est obligatoire', 'error'); return; }

  var sigData = JSON.stringify({
    user_id:       currentProfile ? currentProfile.id : null,
    name:          name,
    role_at_time:  currentProfile ? currentProfile.role : null,
    timestamp:     new Date().toISOString(),
  });

  var field = sigType === 'executant' ? 'signed_executant' : 'signed_donneur_ordre';
  var update = { updated_at: new Date().toISOString() };
  update[field] = sigData;

  // Si les deux seront signées → passer à actif automatiquement
  var p = _permits.find(function(x) { return x.id === id; });
  var otherField = sigType === 'executant' ? 'signed_donneur_ordre' : 'signed_executant';
  if (p && p[otherField]) {
    update.status   = 'actif';
    update.signed_at = new Date().toISOString();
  }

  var res = await sb.from('work_permits').update(update).eq('id', id);
  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }

  // Fermer l'overlay
  var overlay = document.querySelector('[style*="position:fixed"][style*="inset:0"]');
  if (overlay) overlay.remove();

  var msg = update.status === 'actif'
    ? '✅ Permis double-signé — ACTIF !'
    : '✅ Signature enregistrée — en attente de la seconde signature';
  showToast(msg, 'success');
  await loadPermis(role);
  openPermisDetail(id, role);
}

// ── Modal suspension ────────────────────────────────────────────────────────

function openPermisSuspendModal(id, role) {
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = '<div style="background:var(--bg,#0D1B2A);border:1px solid rgba(239,68,68,.3);border-radius:16px;padding:28px;max-width:420px;width:100%">'
    + '<div style="font-size:15px;font-weight:700;color:#EF4444;margin-bottom:6px">🔴 Suspendre le permis</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-bottom:16px">Précisez le motif de suspension. Le permis sera immédiatement inaccessible.</div>'
    + '<div class="form-group"><label class="form-label">Motif de suspension *</label>'
    + '<textarea id="suspendReason" class="form-input" style="height:90px;resize:vertical" placeholder="Ex: Alerte météo, incident sur zone adjacente, co-activité imprévue..."></textarea></div>'
    + '<div style="display:flex;gap:10px;margin-top:14px">'
    + '<button onclick="submitPermitSuspend(\'' + id + '\',\'' + role + '\')" style="flex:1;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:10px;color:#EF4444;font-weight:700;font-size:13px;cursor:pointer">🔴 Confirmer la suspension</button>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" class="btn-sm btn-view" style="padding:10px 16px">Annuler</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
}

async function submitPermitSuspend(id, role) {
  var reason = (document.getElementById('suspendReason') || {}).value || '';
  if (!reason.trim()) { showToast('Le motif est obligatoire', 'error'); return; }

  var res = await sb.from('work_permits').update({
    status:           'suspendu',
    suspension_reason: reason.trim(),
    suspended_at:     new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }).eq('id', id);

  if (res.error) { showToast('Erreur : ' + res.error.message, 'error'); return; }
  var overlay = document.querySelector('[style*="position:fixed"][style*="inset:0"]');
  if (overlay) overlay.remove();
  showToast('🔴 Permis suspendu', 'warn');
  await loadPermis(role);
  openPermisDetail(id, role);
}

// ── Alertes ─────────────────────────────────────────────────────────────────

function _buildPermisAlerts() {
  var now = new Date();
  var alerts = [];

  _permits.forEach(function(p) {
    if (p.status !== 'actif' && p.status !== 'suspendu') return;
    var fin = new Date(p.date_fin);
    if (fin < now && p.status === 'actif') {
      alerts.push({ type: 'error', msg: '⚠️ Permis <strong>' + _escHtml(p.title) + '</strong> expiré depuis le ' + _fmtDate(p.date_fin) });
    } else if ((fin - now) < 4 * 3600 * 1000 && p.status === 'actif') {
      alerts.push({ type: 'warn', msg: '⏰ Permis <strong>' + _escHtml(p.title) + '</strong> expire dans moins de 4h (' + _fmtDateTime(p.date_fin) + ')' });
    }
    if (p.status === 'suspendu') {
      alerts.push({ type: 'error', msg: '🔴 Permis <strong>' + _escHtml(p.title) + '</strong> suspendu — ' + _escHtml(p.suspension_reason || '') });
    }
  });

  if (!alerts.length) return '';
  return alerts.map(function(a) {
    var bg = a.type === 'error' ? 'rgba(239,68,68,.08)' : 'rgba(245,158,11,.08)';
    var border = a.type === 'error' ? 'rgba(239,68,68,.25)' : 'rgba(245,158,11,.25)';
    var color  = a.type === 'error' ? '#FCA5A5' : '#FCD34D';
    return '<div style="background:' + bg + ';border:1px solid ' + border + ';border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:' + color + '">' + a.msg + '</div>';
  }).join('');
}

// ── Module désactivé ─────────────────────────────────────────────────────────

function renderPermisDisabled(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-permis-content');
  if (!container) return;
  container.innerHTML = '<div class="empty-state">'
    + '<div class="empty-state-icon">🔒</div>'
    + '<div class="empty-state-text">Module Permis de travail désactivé</div>'
    + '<div class="empty-state-sub">Activez-le depuis le panneau Admin → Modules</div>'
    + '</div>';
}

// ── Export CSV ────────────────────────────────────────────────────────────────

function exportPermisCSV() {
  if (!_permits.length) { showToast('Aucun permis à exporter', 'warn'); return; }
  var headers = ['Référence','Type','Titre','Lieu','Statut','Date début','Date fin','Intervenants','Responsable','Signé exécutant','Signé DO','Créé le'];
  var rows = _permits.map(function(p) {
    var sigExec = p.signed_executant ? (typeof p.signed_executant === 'string' ? JSON.parse(p.signed_executant) : p.signed_executant) : null;
    var sigDO   = p.signed_donneur_ordre ? (typeof p.signed_donneur_ordre === 'string' ? JSON.parse(p.signed_donneur_ordre) : p.signed_donneur_ordre) : null;
    return [
      p.reference || '',
      p.type,
      p.title,
      p.location || '',
      p.status,
      _fmtDate(p.date_debut),
      _fmtDate(p.date_fin),
      p.intervenants || '',
      p.responsable_nom || '',
      sigExec ? (sigExec.name + ' ' + _fmtDateTime(sigExec.timestamp)) : '',
      sigDO   ? (sigDO.name   + ' ' + _fmtDateTime(sigDO.timestamp))   : '',
      _fmtDate(p.created_at),
    ].map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(',');
  });
  var csv  = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'permis_travail_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Export CSV généré', 'success');
}

// ── Helpers locaux ─────────────────────────────────────────────────────────

function _escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _escAttr(s) {
  return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function _fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function _fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ════════════════════════════════════════════════════════════════════════════
//  BOOT — polling currentProfile identique aux autres modules
// ════════════════════════════════════════════════════════════════════════════

(function _permisBootstrap() {
  var attempts = 0;
  var MAX = 30;
  function tryBoot() {
    attempts++;
    if (typeof currentProfile !== 'undefined' && currentProfile && currentProfile.org_id) {
      checkPermisActivation();
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
