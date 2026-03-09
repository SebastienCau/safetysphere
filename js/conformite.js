// ============================================================
// SafetySphere — conformite.js  (v2.0.0)
// DUER · VGP · FDS · PDP · Personnalisation sections conformité
// ============================================================
// Dépendances : core.js · reports.js (buildReportMeta, reportCSS,
//   reportHeaderHTML, reportFooterHTML, openReportWindow, archiveReport,
//   renderInlineReportHistory) · signatures.js (openSendForSignatureModal,
//   buildSignatureStampHTML)
// ============================================================

const DUER_TEMPLATES = {
  BTP: { label:'BTP — Bâtiment & Travaux Publics', icon:'🏗️', unites:[
    { id:'btp_hauteur', unite:'Travaux en hauteur (échafaudages, toiture, nacelle)', risques:['Chute de hauteur','Chute d\'objet','Basculement d\'échafaudage'], mesures:['Port du harnais obligatoire','Vérification journalière des échafaudages','Filets de protection','Formation CACES nacelle'], gravite:4, probabilite:3 },
    { id:'btp_elec', unite:'Travaux à proximité de réseaux électriques', risques:['Électrocution','Arc électrique','Brûlures'], mesures:['Habilitation électrique BR minimum','Consignation LOTO','Détecteur de réseau','EPI isolants'], gravite:5, probabilite:2 },
    { id:'btp_confine', unite:'Travaux en espace confiné (tranchées, regards, cuves)', risques:['Asphyxie','Intoxication','Ensevelissement'], mesures:['Attestation espace confiné obligatoire','Détecteur 4 gaz','Système de récupération','Surveillance extérieure permanente'], gravite:5, probabilite:2 },
    { id:'btp_manut', unite:'Manutention manuelle et mécanique', risques:['TMS','Écrasement','Renversement d\'engin'], mesures:['Formation gestes et postures','CACES requis','Zone de manœuvre balisée','Signaleur lors des manœuvres'], gravite:3, probabilite:4 },
    { id:'btp_pouss', unite:'Découpe, ponçage, démolition (poussières)', risques:['Silicose','Amiante si bâti avant 1997','Troubles respiratoires'], mesures:['Diagnostic amiante avant travaux','Masque FFP3','Aspiration à la source','Arrosage anti-poussières'], gravite:4, probabilite:3 },
  ]},
  Logistique: { label:'Logistique & Entrepôt', icon:'📦', unites:[
    { id:'log_chariot', unite:'Conduite de chariots élévateurs', risques:['Renversement du chariot','Collision piéton/chariot','Chute de charges'], mesures:['CACES 3 obligatoire','Séparation flux piétons/engins','Vitesse limitée à 10 km/h','Visite médicale aptitude'], gravite:4, probabilite:3 },
    { id:'log_manut', unite:'Manutention manuelle de charges lourdes', risques:['Lombalgies','Hernies discales','Chute de colis'], mesures:['Formation gestes et postures','Ceinture lombaire','Aide mécanique si > 25 kg','Rotation des postes'], gravite:3, probabilite:5 },
    { id:'log_stock', unite:'Stockage en hauteur (rayonnages)', risques:['Effondrement de rayonnage','Chute de marchandises'], mesures:['Contrôle annuel des rayonnages','Charge maximale affichée','Ceinture sur nacelle de picking'], gravite:4, probabilite:2 },
    { id:'log_quai', unite:'Quais de chargement / déchargement', risques:['Collision avec PL','Chute dans le vide du quai','Coincement'], mesures:['Cales de roue obligatoires','Éclairage renforcé','Procédure accueil chauffeurs','Barrières de sécurité'], gravite:4, probabilite:3 },
  ]},
  Menuiserie: { label:'Menuiserie & Travail du Bois', icon:'🪵', unites:[
    { id:'men_machines', unite:'Utilisation de machines-outils (scie, toupie, dégauchisseuse)', risques:['Coupure','Amputation','Projection d\'éclats','Bruit > 85 dB'], mesures:['Protecteurs de lame en place','Poussoir/guide obligatoire','Protections auditives','Formation machines'], gravite:4, probabilite:3 },
    { id:'men_pouss', unite:'Production de poussières de bois', risques:['Cancers des fosses nasales (bois durs)','Irritations respiratoires'], mesures:['Aspiration centralisée','Masque P3 pour bois durs','Surveillance médicale renforcée'], gravite:4, probabilite:4 },
    { id:'men_chim', unite:'Utilisation de colles, vernis, solvants', risques:['Intoxication aux solvants','Dermatites','Incendie/explosion'], mesures:['FDS à jour et consultées','Port de gants nitrile','Ventilation du local','Armoire coupe-feu'], gravite:3, probabilite:3 },
  ]},
  Garage: { label:'Garage & Mécanique Automobile', icon:'🔧', unites:[
    { id:'gar_fosse', unite:'Travaux en fosse', risques:['Chute dans la fosse','Intoxication CO','Basculement du véhicule'], mesures:['Garde-corps fosse','Détecteur CO','Calage véhicule obligatoire','Ventilation forcée'], gravite:4, probabilite:2 },
    { id:'gar_chim', unite:'Manipulation de fluides (huile, liquide de frein, réfrigérant)', risques:['Brûlures chimiques','Intoxication','Pollution environnementale'], mesures:['FDS affichées au poste','Gants résistants aux huiles','Récupérateur de fluides'], gravite:3, probabilite:4 },
    { id:'gar_levage', unite:'Levage de véhicules (pont élévateur, cric)', risques:['Écrasement','Basculement','Chute de pièces'], mesures:['VGP pont élévateur annuelle','Vérification des points de levage','Béquilles de sécurité'], gravite:5, probabilite:2 },
  ]},
  Bureaux: { label:'Bureaux & Tertiaire', icon:'🏢', unites:[
    { id:'bur_ecran', unite:'Travail sur écran prolongé', risques:['TMS (poignet, nuque)','Fatigue visuelle','Stress'], mesures:['Réglage du poste ergonomique','Pause 5 min / heure','Visite médecine du travail écran'], gravite:2, probabilite:5 },
    { id:'bur_incendie', unite:'Risque incendie bâtiment tertiaire', risques:['Incendie','Panique','Intoxication fumées'], mesures:['Plan d\'évacuation affiché','Exercice évacuation annuel','Extincteurs vérifiés annuellement'], gravite:4, probabilite:1 },
    { id:'bur_depl', unite:'Déplacements professionnels (voiture)', risques:['Accident de trajet','Fatigue','Malaise'], mesures:['Politique risque routier','Interdiction téléphone au volant','Limitation du temps de conduite'], gravite:4, probabilite:3 },
  ]},
  Restauration: { label:'Restauration & Cuisine', icon:'🍽️', unites:[
    { id:'res_coupe', unite:'Utilisation de couteaux et équipements tranchants', risques:['Coupures','Blessures graves'], mesures:['Gants anti-coupure','Formation gestes','Rangement sécurisé'], gravite:3, probabilite:4 },
    { id:'res_chaleur', unite:'Travail en cuisine chaude (fours, friteuses, plaques)', risques:['Brûlures','Coup de chaleur','Incendie'], mesures:['Maniques/protection thermique','Ventilation cuisine','Hotte et extraction propres'], gravite:3, probabilite:4 },
    { id:'res_glissade', unite:'Sols mouillés en cuisine', risques:['Glissade','Chute','Fracture'], mesures:['Chaussures antidérapantes obligatoires','Signalisation sol glissant','Nettoyage immédiat des déversements'], gravite:3, probabilite:5 },
    { id:'res_chim', unite:'Produits de nettoyage et désinfection', risques:['Brûlures chimiques','Irritations respiratoires','Intoxication'], mesures:['FDS affichées','Gants et lunettes','Ne jamais mélanger les produits'], gravite:3, probabilite:3 },
  ]},
};

const VGP_EQUIPEMENTS = [
  { key:'extincteurs',       label:'Extincteurs',                  icon:'🧯', categorie:'Incendie',    periodicite:12, legalRef:'Arrêté du 25/06/1980' },
  { key:'sssi',              label:'Système de Sécurité Incendie', icon:'🚨', categorie:'Incendie',    periodicite:12, legalRef:'NFS 61-933' },
  { key:'portes_coupe_feu',  label:'Portes coupe-feu',             icon:'🚪', categorie:'Incendie',    periodicite:12, legalRef:'Article R123-43' },
  { key:'installation_elec', label:'Installation électrique',      icon:'⚡', categorie:'Électricité', periodicite:12, legalRef:'Décret 88-1056' },
  { key:'tableau_elec',      label:'Tableau électrique TGBT',      icon:'🔌', categorie:'Électricité', periodicite:12, legalRef:'NF C 15-100' },
  { key:'pont_elevateur',    label:'Pont élévateur',               icon:'🚗', categorie:'Levage',      periodicite:12, legalRef:'Décret 98-1084' },
  { key:'chariot_elevateur', label:'Chariots élévateurs',          icon:'🏭', categorie:'Levage',      periodicite:12, legalRef:'Décret 98-1084' },
  { key:'chaudiere',         label:'Chaudière / chauffage',        icon:'🔥', categorie:'Thermique',   periodicite:12, legalRef:'Arrêté du 02/08/1977' },
  { key:'clim',              label:'Climatisation (> 12 kW)',      icon:'❄️', categorie:'Thermique',   periodicite:12, legalRef:'Arrêté du 16/04/2010' },
  { key:'portes_auto',       label:'Portes automatiques',          icon:'🚪', categorie:'Équipements', periodicite:12, legalRef:'EN 12635' },
  { key:'ascenseur',         label:'Ascenseur',                    icon:'🛗', categorie:'Équipements', periodicite:6,  legalRef:'Décret 2004-964' },
  { key:'epi_incendie',      label:'EPI Incendie (combinaison)',   icon:'🧥', categorie:'EPI',         periodicite:12, legalRef:'R. 4543-13' },
];

let _conformRole = 'Company';
let _conformTab  = 'duer';
let _vgpFile     = null;
let _fdsFile     = null;

// ── Navigation ──────────────────────────────────────────
async function loadConformite(role) {
  _conformRole = role;
  _conformTab  = 'duer';
  ['duer','vgp','fds'].forEach(function(t) {
    var s = document.getElementById(role + '-conform-' + t);
    if (s) s.classList.toggle('active', t === 'duer');
  });
  var tabs = document.querySelectorAll('#conformTabs-' + role + ' .conform-tab');
  tabs.forEach(function(b, i) { b.classList.toggle('active', i === 0); });
  await renderDuerSection(role);
}

function switchConformTab(role, tab, btn) {
  _conformTab = tab;
  ['duer','vgp','fds','pdp','historique'].forEach(function(t) {
    var s = document.getElementById(role + '-conform-' + t);
    if (s) s.classList.toggle('active', t === tab);
  });
  document.querySelectorAll('#conformTabs-' + role + ' .conform-tab').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  _histShowTrash = false;
  if (tab === 'duer')       renderDuerSection(role);
  if (tab === 'vgp')        renderVgpSection(role);
  if (tab === 'fds')        renderFdsSection(role);
  if (tab === 'pdp')        renderPdpSection(role);
  if (tab === 'historique') renderHistoriqueSection(role);
}

// ══════════════════════════════
// 12.1 — DUER
// ══════════════════════════════

function duerCotationInfo(g, p) {
  var c = g * p;
  if (c >= 16) return { label:'Critique', cls:'duer-risk-critique', color:'#EF4444' };
  if (c >= 9)  return { label:'Élevé',    cls:'duer-risk-eleve',    color:'#F97316' };
  if (c >= 4)  return { label:'Modéré',   cls:'duer-risk-modere',   color:'#F59E0B' };
  return             { label:'Faible',   cls:'duer-risk-faible',   color:'#22C55E' };
}

async function renderDuerSection(role) {
  var ctn = document.getElementById(role + '-conform-duer');
  if (!ctn) return;
  ctn.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div></div>';

  var result = await sb.from('duer_entries').select('*').eq('org_id', currentProfile.org_id).order('created_at');
  var entries = result.data;
  var err = result.error;
  if (err) { ctn.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erreur : ' + escapeHtml(err.message) + '</div></div>'; return; }

  var hasDuer = entries && entries.length > 0;
  var actionBtns = '<button class="btn-sm btn-view" onclick="openDuerTemplateModal(\'' + role + '\')">📋 Importer un modèle</button>'
    + '<button class="btn-sm btn-upload" onclick="openDuerModal(null,\'' + role + '\')">➕ Ajouter une unité</button>'
    + (hasDuer ? '<button class="btn-sm" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#A5B4FC" onclick="generateDuerPDFSigned()">📥 Rapport</button>' : '');

  var ids = buildConformSectionHeader('duer', role, 'DUER', actionBtns,
    "Document Unique d\'Évaluation des Risques",
    'Obligation légale — Art. R4121-1 du Code du Travail');
  ctn.innerHTML = ids.html;

  renderConformKpiStrip('duer', ids.kpiId);
  renderConformLastReport('DUER', ids.lastRptId);

  var cctn = document.getElementById(ids.contentId);
  if (cctn) {
    var html = '';
    if (hasDuer) {
      entries.forEach(function(e) { html += renderDuerCard(e, role); });
    } else {
      html = '<div class="empty-state"><div class="empty-state-icon">📄</div>'
        + '<div class="empty-state-text">Aucune unité de travail.<br>Importez un modèle sectoriel ou créez votre première unité.</div></div>';
    }
    html += '<div id="duer-inline-history-' + role + '" style="margin-top:32px"></div>';
    cctn.innerHTML = html;
    renderInlineReportHistory('DUER', role, 'duer-inline-history-' + role);
  }
}

function renderDuerCard(e, role) {
  var info = duerCotationInfo(e.gravite || 1, e.probabilite || 1);
  var cot  = (e.gravite || 1) * (e.probabilite || 1);
  var pct  = Math.round((cot / 25) * 100);
  var risques = Array.isArray(e.risques) ? e.risques : (e.risques ? JSON.parse(e.risques) : []);
  var mesures = Array.isArray(e.mesures) ? e.mesures : (e.mesures ? JSON.parse(e.mesures) : []);

  var rTags = risques.map(function(r) { return '<span class="duer-tag">⚠️ ' + escapeHtml(r) + '</span>'; }).join('');
  var mTags = mesures.map(function(m) { return '<span class="duer-tag" style="border-color:rgba(34,197,94,.2);color:var(--success)">✓ ' + escapeHtml(m) + '</span>'; }).join('');

  return '<div class="duer-card">'
    + '<div class="duer-card-header">'
    + '<div class="duer-card-icon">⚠️</div>'
    + '<div class="duer-card-title">'
    + '<div class="duer-card-name">' + escapeHtml(e.unite_travail) + '</div>'
    + '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">'
    + '<span class="duer-risk-badge ' + info.cls + '">' + info.label + ' — ' + cot + '/25</span>'
    + '<span style="font-size:11px;color:var(--muted)">G:' + e.gravite + ' × P:' + e.probabilite + '</span>'
    + '</div></div>'
    + '<div style="display:flex;gap:6px;flex-shrink:0">'
    + '<button class="btn-sm btn-view" onclick="openDuerModal(\'' + e.id + '\',\'' + role + '\')">✏️</button>'
    + '<button class="btn-sm btn-reject" onclick="deleteDuerEntry(\'' + e.id + '\',\'' + role + '\')">🗑</button>'
    + '</div></div>'
    + '<div class="duer-score-bar"><div class="duer-score-fill" style="width:' + pct + '%;background:' + info.color + '"></div></div>'
    + (rTags ? '<div class="duer-tags" style="margin-top:12px">' + rTags + '</div>' : '')
    + (mTags ? '<div class="duer-tags">' + mTags + '</div>' : '')
    + '</div>';
}

async function openDuerModal(entryId, role) {
  _conformRole = role || _conformRole;
  document.getElementById('duerEntryId').value = entryId || '';
  document.getElementById('duerModalTitle').textContent = entryId ? '✏️ Modifier l\'unité' : '➕ Nouvelle unité de travail';
  document.getElementById('duerGravite').value = '3';
  document.getElementById('duerProbabilite').value = '2';
  document.getElementById('duerGraviteVal').textContent = '3';
  document.getElementById('duerProbabiliteVal').textContent = '2';
  document.getElementById('duerUniteName').value = '';
  document.getElementById('duerRisques').value = '';
  document.getElementById('duerMesures').value = '';
  updateDuerCotation();

  if (entryId) {
    var r = await sb.from('duer_entries').select('*').eq('id', entryId).single();
    var data = r.data;
    if (data) {
      document.getElementById('duerUniteName').value   = data.unite_travail || '';
      document.getElementById('duerGravite').value     = data.gravite || 3;
      document.getElementById('duerProbabilite').value = data.probabilite || 2;
      document.getElementById('duerGraviteVal').textContent    = data.gravite || 3;
      document.getElementById('duerProbabiliteVal').textContent = data.probabilite || 2;
      var risques = Array.isArray(data.risques) ? data.risques : (data.risques ? JSON.parse(data.risques) : []);
      var mesures = Array.isArray(data.mesures) ? data.mesures : (data.mesures ? JSON.parse(data.mesures) : []);
      document.getElementById('duerRisques').value = risques.join('\n');
      document.getElementById('duerMesures').value = mesures.join('\n');
      updateDuerCotation();
    }
  }
  document.getElementById('duerEntryModal').classList.add('open');
}

function closeDuerModal() { document.getElementById('duerEntryModal').classList.remove('open'); }

function updateDuerCotation() {
  var g = parseInt(document.getElementById('duerGravite').value);
  var p = parseInt(document.getElementById('duerProbabilite').value);
  var info = duerCotationInfo(g, p);
  document.getElementById('duerCotationScore').textContent = g * p;
  document.getElementById('duerCotationLabel').textContent = info.label;
  var el = document.getElementById('duerCotationDisplay');
  var colorMap = { 'Critique':'239,68,68', 'Élevé':'249,115,22', 'Modéré':'245,158,11', 'Faible':'34,197,94' };
  var rgb = colorMap[info.label] || '245,158,11';
  el.style.background   = 'rgba(' + rgb + ',.1)';
  el.style.borderColor  = 'rgba(' + rgb + ',.25)';
  var textMap = { 'Critique':'#FCA5A5', 'Élevé':'#FED7AA', 'Modéré':'#FCD34D', 'Faible':'#86EFAC' };
  el.style.color = textMap[info.label] || '#FCD34D';
}

async function saveDuerEntry() {
  var name = document.getElementById('duerUniteName').value.trim();
  if (!name) { showToast('Donnez un nom à l\'unité de travail', 'error'); return; }
  var btn = document.getElementById('duerSaveBtn');
  btn.disabled = true; btn.textContent = '⏳';

  var entryId    = document.getElementById('duerEntryId').value;
  var risquesRaw = document.getElementById('duerRisques').value;
  var mesuresRaw = document.getElementById('duerMesures').value;

  var payload = {
    org_id:        currentProfile.org_id,
    unite_travail: name,
    gravite:       parseInt(document.getElementById('duerGravite').value),
    probabilite:   parseInt(document.getElementById('duerProbabilite').value),
    risques:       risquesRaw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean),
    mesures:       mesuresRaw.split('\n').map(function(s) { return s.trim(); }).filter(Boolean),
    updated_at:    new Date().toISOString(),
  };

  var result;
  if (entryId) {
    result = await sb.from('duer_entries').update(payload).eq('id', entryId);
  } else {
    payload.created_at = new Date().toISOString();
    result = await sb.from('duer_entries').insert(payload);
  }
  btn.disabled = false; btn.textContent = '✓ Enregistrer';
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast(entryId ? 'Unité mise à jour' : 'Unité ajoutée au DUER', 'success');
  closeDuerModal();
  renderDuerSection(_conformRole);
}

async function deleteDuerEntry(id, role) {
  if (!confirm('Supprimer cette unité de travail du DUER ?')) return;
  var result = await sb.from('duer_entries').delete().eq('id', id);
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast('Unité supprimée', 'success');
  renderDuerSection(role || _conformRole);
}

function openDuerTemplateModal(role) {
  _conformRole = role || _conformRole;
  var sectors = Object.entries(DUER_TEMPLATES);
  var html = '<div class="modal-overlay open" id="duerTemplateModal" style="z-index:1100">'
    + '<div class="modal" style="max-width:660px">'
    + '<button class="modal-close" onclick="document.getElementById(\'duerTemplateModal\').remove()">✕</button>'
    + '<div class="modal-title">📋 Modèles sectoriels</div>'
    + '<div class="modal-subtitle">Sélectionnez votre secteur pour pré-remplir le DUER avec les risques types</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-top:16px">'
    + sectors.map(function(e) {
        var key = e[0], s = e[1];
        return '<div onclick="importDuerTemplate(\'' + key + '\')" style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:16px 12px;text-align:center;cursor:pointer;transition:all .15s" onmouseover="this.style.borderColor=\'rgba(249,115,22,.4)\'" onmouseout="this.style.borderColor=\'var(--inset-border)\'">'
          + '<div style="font-size:28px;margin-bottom:8px">' + s.icon + '</div>'
          + '<div style="font-size:12px;font-weight:700;color:var(--text)">' + escapeHtml(s.label.split('—')[0].trim()) + '</div>'
          + '<div style="font-size:11px;color:var(--muted);margin-top:4px">' + (s.unites ? s.unites.length : 0) + ' unités</div>'
          + '</div>';
      }).join('')
    + '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

async function importDuerTemplate(sectorKey) {
  var tmpl = DUER_TEMPLATES[sectorKey];
  if (!tmpl) return;
  if (!confirm('Importer ' + tmpl.unites.length + ' unités de travail du secteur "' + tmpl.label + '" ?\nLes unités existantes sont conservées.')) return;
  document.getElementById('duerTemplateModal') && document.getElementById('duerTemplateModal').remove();
  showToast('Importation en cours...', 'success');
  var inserts = tmpl.unites.map(function(u) {
    return {
      org_id: currentProfile.org_id,
      unite_travail: u.unite,
      gravite: u.gravite,
      probabilite: u.probabilite,
      risques: u.risques,
      mesures: u.mesures,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  var result = await sb.from('duer_entries').insert(inserts);
  if (result.error) { showToast('Erreur import : ' + result.error.message, 'error'); return; }
  showToast(inserts.length + ' unités importées avec succès !', 'success');
  renderDuerSection(_conformRole);
}

// ── Métadonnées partagées pour tous les rapports ──────
async function buildReportMeta(typeCode) {
  // Charger les infos org depuis Supabase
  var orgRow = null;
  if (currentProfile.org_id) {
    var r = await sb.from('organizations').select('name,siret,address,legal_form').eq('id', currentProfile.org_id).single();
    orgRow = r.data;
  }
  var now        = new Date();
  var isoDate    = now.toISOString();
  // Numéro de rapport : TYPE-YYYYMMDD-HHMMSS-ORGID4
  var pad        = function(n){ return String(n).padStart(2,'0'); };
  var datePart   = now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate());
  var timePart   = pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  var orgSuffix  = (currentProfile.org_id || 'XXXX').slice(-4).toUpperCase();
  var reportNum  = typeCode + '-' + datePart + '-' + timePart + '-' + orgSuffix;
  // Version de l'application
  var appVersion = document.querySelector('meta[name="app-version"]')?.content || '1.3.0';

  return {
    orgName    : (orgRow && orgRow.name)       || 'Entreprise non renseignée',
    siret      : (orgRow && orgRow.siret)      || '',
    address    : (orgRow && orgRow.address)    || '',
    legalForm  : (orgRow && orgRow.legal_form) || '',
    responsable: currentProfile.full_name      || currentProfile.email || 'Utilisateur inconnu',
    email      : currentProfile.email          || '',
    reportNum  : reportNum,
    appVersion : appVersion,
    dateStr    : now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }),
    timeStr    : pad(now.getHours()) + 'h' + pad(now.getMinutes()),
    isoDate    : isoDate,
  };
}

// ── CSS commun à tous les rapports ────────────────────
function reportCSS(landscape) {
  return '<style>'
    + '@page { size: A4 ' + (landscape ? 'landscape' : 'portrait') + '; margin: 15mm 14mm 20mm 14mm; }'
    + 'body { font-family:"Segoe UI",Arial,sans-serif; color:#111827; margin:0; padding:0; background:#fff; font-size:13px; }'
    + 'table { width:100%; border-collapse:collapse; }'
    + 'th { background:#1E3A5F; color:#fff; padding:10px 13px; font-size:11px; text-align:left; font-weight:700; text-transform:uppercase; letter-spacing:.4px; }'
    + 'tr:nth-child(even) td { background:#F9FAFB; }'
    + 'td { border-bottom:1px solid #E5E7EB; vertical-align:top; }'
    /* ── Bandeau SafetySphere supérieur ── */
    + '.ss-topbar { background:linear-gradient(135deg,#0D1B2A 0%,#1E3A5F 100%); padding:8px 18px; display:flex; align-items:center; justify-content:space-between; margin-bottom:0; }'
    + '.ss-topbar-brand { display:flex; align-items:center; gap:10px; }'
    + '.ss-hex { width:28px; height:28px; background:#F97316; clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:12px; flex-shrink:0; }'
    + '.ss-brand-name { font-size:15px; font-weight:900; color:#fff; letter-spacing:.5px; }'
    + '.ss-brand-name span { color:#F97316; }'
    + '.ss-brand-tag { font-size:9px; color:rgba(255,255,255,.55); letter-spacing:.3px; margin-top:1px; }'
    + '.ss-topbar-trust { display:flex; align-items:center; gap:18px; }'
    + '.ss-trust-item { display:flex; align-items:center; gap:5px; font-size:9px; color:rgba(255,255,255,.7); font-weight:600; letter-spacing:.2px; }'
    + '.ss-trust-icon { font-size:11px; }'
    + '.ss-version { font-size:9px; color:rgba(255,255,255,.4); letter-spacing:.3px; font-family:monospace; }'
    /* ── En-tête document ── */
    + '.report-header { border-bottom:3px solid #F97316; padding:14px 0; margin-bottom:0; display:flex; align-items:stretch; gap:0; }'
    + '.report-header-left { flex:1; display:flex; align-items:center; gap:14px; }'
    + '.report-header-right { width:220px; background:#F8FAFC; border:1px solid #E5E7EB; border-radius:8px; padding:12px 14px; font-size:11px; }'
    + '.hex { width:44px; height:44px; background:#F97316; clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:18px; flex-shrink:0; }'
    + '.report-title { font-size:20px; font-weight:900; color:#1E3A5F; line-height:1.2; margin-bottom:3px; }'
    + '.report-subtitle { font-size:11px; color:#6B7280; }'
    + '.org-block { margin:14px 0; padding:14px; background:#F0F4FF; border:1px solid #C7D7FD; border-radius:8px; display:flex; gap:24px; flex-wrap:wrap; }'
    + '.org-field { display:flex; flex-direction:column; gap:2px; min-width:160px; }'
    + '.org-field-lbl { font-size:9px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:.5px; }'
    + '.org-field-val { font-size:12px; font-weight:600; color:#111827; }'
    + '.meta-row { display:flex; gap:4px; align-items:baseline; margin-bottom:4px; }'
    + '.meta-lbl { font-size:9px; font-weight:700; color:#9CA3AF; text-transform:uppercase; letter-spacing:.4px; width:72px; flex-shrink:0; }'
    + '.meta-val { font-size:11px; color:#111827; font-weight:600; }'
    + '.report-num { font-family:monospace; font-size:10px; background:#1E3A5F; color:#fff; padding:2px 7px; border-radius:4px; letter-spacing:.5px; }'
    + '.stat-row { display:flex; gap:12px; margin:14px 0; }'
    + '.stat-box { flex:1; border-radius:8px; padding:12px 14px; }'
    + '.stat-box-val { font-size:26px; font-weight:900; line-height:1; }'
    + '.stat-box-lbl { font-size:10px; margin-top:4px; font-weight:700; text-transform:uppercase; letter-spacing:.3px; }'
    /* ── Pied de page ── */
    + '.report-footer { margin-top:16px; padding-top:10px; border-top:1px solid #E5E7EB; font-size:10px; color:#9CA3AF; display:flex; justify-content:space-between; align-items:center; }'
    /* ── Signatures ── */
    + '.signature-block { margin-top:20px; display:flex; gap:20px; }'
    + '.signature-box { flex:1; border:1px solid #D1D5DB; border-radius:8px; padding:14px 16px; }'
    + '.signature-box-title { font-size:10px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:.5px; margin-bottom:36px; }'
    + '.signature-box-line { border-top:1px solid #374151; padding-top:6px; font-size:10px; color:#6B7280; }'
    /* ── Bandeau marketing bas de page ── */
    + '.ss-footer-bar { margin-top:18px; background:linear-gradient(135deg,#0D1B2A,#1E3A5F); border-radius:10px; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px; }'
    + '.ss-footer-left { display:flex; align-items:center; gap:12px; }'
    + '.ss-footer-hex { width:32px; height:32px; background:#F97316; clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%); display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:13px; flex-shrink:0; }'
    + '.ss-footer-brand { font-size:14px; font-weight:900; color:#fff; }'
    + '.ss-footer-brand span { color:#F97316; }'
    + '.ss-footer-sub { font-size:9px; color:rgba(255,255,255,.5); margin-top:2px; }'
    + '.ss-footer-badges { display:flex; gap:10px; flex-wrap:wrap; }'
    + '.ss-badge { display:flex; align-items:center; gap:4px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); border-radius:6px; padding:4px 10px; font-size:9px; color:rgba(255,255,255,.8); font-weight:600; white-space:nowrap; }'
    + '.ss-badge-icon { font-size:10px; }'
    + '.ss-footer-url { font-size:9px; color:rgba(249,115,22,.8); font-weight:700; letter-spacing:.3px; white-space:nowrap; }'
    + '@media print { .no-print { display:none !important; } body { font-size:11px; } .report-title { font-size:17px; } .ss-footer-bar { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .ss-topbar { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }'
    + '</style>';
}

// ── En-tête commun (HTML) ─────────────────────────────
function reportHeaderHTML(meta, docTitle, legalRef) {
  var siretFmt = meta.siret ? meta.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : '—';
  return ''
    /* Bandeau SafetySphere supérieur */
    + '<div class="ss-topbar">'
    + '<div class="ss-topbar-brand">'
    + '<div class="ss-hex">S</div>'
    + '<div><div class="ss-brand-name">Safety<span>Sphere</span></div><div class="ss-brand-tag">Plateforme de conformité HSE · Traçabilité numérique des obligations réglementaires</div></div>'
    + '</div>'
    + '<div class="ss-topbar-trust">'
    + '<div class="ss-trust-item"><span class="ss-trust-icon">🔒</span>Chiffrement TLS + stockage sécurisé</div>'
    + '<div class="ss-trust-item"><span class="ss-trust-icon">✅</span>Traçabilité horodatée</div>'
    + '<div class="ss-trust-item"><span class="ss-trust-icon">🇪🇺</span>Données hébergées en Europe</div>'
    + '<div class="ss-version">v' + escapeHtml(meta.appVersion) + '</div>'
    + '</div>'
    + '</div>'
    /* En-tête document */
    + '<div class="report-header">'
    + '<div class="report-header-left">'
    + '<div class="hex">S</div>'
    + '<div>'
    + '<div class="report-title">' + escapeHtml(docTitle) + '</div>'
    + '<div class="report-subtitle">' + escapeHtml(legalRef) + '</div>'
    + '</div>'
    + '</div>'
    + '<div class="report-header-right">'
    + '<div class="meta-row"><span class="meta-lbl">Réf.</span><span class="report-num">' + escapeHtml(meta.reportNum) + '</span></div>'
    + '<div class="meta-row"><span class="meta-lbl">Date</span><span class="meta-val">' + escapeHtml(meta.dateStr) + ' à ' + meta.timeStr + '</span></div>'
    + '<div class="meta-row"><span class="meta-lbl">Responsable</span><span class="meta-val">' + escapeHtml(meta.responsable) + '</span></div>'
    + '<div class="meta-row"><span class="meta-lbl">Email</span><span class="meta-val" style="font-size:10px">' + escapeHtml(meta.email) + '</span></div>'
    + '</div>'
    + '</div>'
    + '<div class="org-block">'
    + '<div class="org-field"><span class="org-field-lbl">Raison sociale</span><span class="org-field-val">' + escapeHtml(meta.orgName) + '</span></div>'
    + (meta.legalForm ? '<div class="org-field"><span class="org-field-lbl">Forme juridique</span><span class="org-field-val">' + escapeHtml(meta.legalForm) + '</span></div>' : '')
    + '<div class="org-field"><span class="org-field-lbl">SIRET</span><span class="org-field-val" style="font-family:monospace">' + escapeHtml(siretFmt) + '</span></div>'
    + (meta.address ? '<div class="org-field"><span class="org-field-lbl">Adresse</span><span class="org-field-val">' + escapeHtml(meta.address) + '</span></div>' : '')
    + '</div>';
}

// ── Pied de page + bloc signature + bandeau marketing ─
function reportFooterHTML(meta, docTitle, hideSigBlock) {
  return '<div class="report-footer">'
    + '<span>SafetySphere v' + escapeHtml(meta.appVersion) + ' · ' + escapeHtml(meta.orgName) + ' · Réf. ' + escapeHtml(meta.reportNum) + '</span>'
    + '<span>Généré le ' + escapeHtml(meta.dateStr) + ' · Document confidentiel</span>'
    + '</div>'
    + (hideSigBlock ? '' :
        '<div class="signature-block">'
      + '<div class="signature-box"><div class="signature-box-title">Établi par</div><div class="signature-box-line">' + escapeHtml(meta.responsable) + ' — ' + escapeHtml(meta.dateStr) + '</div></div>'
      + '<div class="signature-box"><div class="signature-box-title">Vérifié / Validé par</div><div class="signature-box-line">Signature et cachet</div></div>'
      + '<div class="signature-box"><div class="signature-box-title">Archivé le</div><div class="signature-box-line">&nbsp;</div></div>'
      + '</div>')
    /* Bandeau marketing SafetySphere */
    + '<div class="ss-footer-bar">'
    + '<div class="ss-footer-left">'
    + '<div class="ss-footer-hex">S</div>'
    + '<div><div class="ss-footer-brand">Safety<span>Sphere</span></div><div class="ss-footer-sub">Ce document a été généré et certifié par SafetySphere — Plateforme HSE tiers de confiance</div></div>'
    + '</div>'
    + '<div class="ss-footer-badges">'
    + '<div class="ss-badge"><span class="ss-badge-icon">🔒</span>Chiffrement TLS en transit · stockage sécurisé</div>'
    + '<div class="ss-badge"><span class="ss-badge-icon">📋</span>Archive horodatée · numéro de référence unique</div>'
    + '<div class="ss-badge"><span class="ss-badge-icon">🇪🇺</span>Données hébergées en Europe (UE)</div>'
    + '<div class="ss-badge"><span class="ss-badge-icon">⚖️</span>Droit à l&#39;effacement · RLS · RGPD Art. 17</div>'
    + '</div>'
    + '<div class="ss-footer-url">safetysphere.fr</div>'
    + '</div>'
    + '<div class="no-print" style="margin-top:20px;text-align:center">'
    + '<button onclick="window.print()" style="background:#F97316;color:#fff;border:none;padding:11px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>'
    + '&nbsp;&nbsp;<button onclick="window.close()" style="background:#E5E7EB;color:#374151;border:none;padding:11px 20px;border-radius:8px;font-size:13px;cursor:pointer">Fermer</button>'
    + '</div>';
}

// ── Ouvrir le rapport dans un nouvel onglet ────────────
function openReportWindow(html, title, meta) {
  // Afficher dans la visionneuse iframe intégrée
  var modal   = document.getElementById('reportViewerModal');
  var frame   = document.getElementById('reportViewerFrame');
  var titleEl = document.getElementById('reportViewerTitle');
  if (!modal || !frame) return false;

  // Panneau signataires : masquer (pas d'archiveId connu à ce stade)
  var sigPanel  = document.getElementById('viewerSigPanel');
  var sigToggle = document.getElementById('viewerSigPanelToggle');
  if (sigPanel)  { sigPanel.style.display = 'none'; sigPanel.dataset.open = '0'; }
  if (sigToggle) { sigToggle.style.display = 'none'; }

  // Construire le blob et l'injecter dans l'iframe
  var blob    = new Blob([html], { type:'text/html;charset=utf-8' });
  var blobUrl = URL.createObjectURL(blob);

  titleEl.textContent = (meta ? meta.reportNum + ' — ' : '') + (title || 'Rapport');
  frame.src = 'about:blank';

  // Révoquer l'ancien blob éventuel
  if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); }
  frame._blobUrl = blobUrl;
  frame.src = blobUrl;
  frame.onload = function() {
    setTimeout(function() { URL.revokeObjectURL(blobUrl); frame._blobUrl = null; }, 30000);
  };

  modal.classList.add('open');
  showToast('Rapport prêt — utilisez 🖨️ pour enregistrer en PDF', 'success');

  // Archivage automatique en arrière-plan
  if (meta && title) {
    archiveReport(meta, title, html).then(function(archived) {
      // Une fois archivé, activer le bouton signataires si archive_id dispo
      if (archived && archived.id) {
        var toggle = document.getElementById('viewerSigPanelToggle');
        if (toggle) { toggle.style.display = ''; toggle.dataset.archiveId = archived.id; toggle.onclick = function() { loadViewerSigPanel(archived.id); toggleViewerSigPanel(); }; }
      }
    }).catch(function(e){ console.warn('Archive background error:', e); });
  }
  return true;
}

// ══════════════════════════════════════════════════════
// RAPPORT DUER
// ══════════════════════════════════════════════════════
function buildDuerHTML(entries, meta, stampHtml) {
  var totalEntries = entries.length;
  var critiques = entries.filter(function(e){ return e.gravite*e.probabilite>=12; }).length;
  var eleves    = entries.filter(function(e){ var c=e.gravite*e.probabilite; return c>=6&&c<12; }).length;
  var maitris   = totalEntries - critiques - eleves;
  function riskColor(g,p){ var c=g*p; if(c>=16)return{bg:'#FEE2E2',border:'#EF4444',text:'#991B1B',label:'Critique'}; if(c>=9)return{bg:'#FFEDD5',border:'#F97316',text:'#9A3412',label:'Élevé'}; if(c>=4)return{bg:'#FEF3C7',border:'#F59E0B',text:'#92400E',label:'Modéré'}; return{bg:'#DCFCE7',border:'#22C55E',text:'#166534',label:'Faible'}; }
  var tableRows = entries.map(function(e,i){
    var g=e.gravite||1; var p=e.probabilite||1; var c=g*p;
    var rc=riskColor(g,p); var pct=Math.round((c/25)*100);
    var risques=Array.isArray(e.risques)?e.risques:(e.risques?JSON.parse(e.risques):[]);
    var mesures=Array.isArray(e.mesures)?e.mesures:(e.mesures?JSON.parse(e.mesures):[]);
    return '<tr>'
      +'<td style="padding:10px 12px;font-weight:600;border-right:1px solid #E5E7EB;width:22%">'+(i+1)+'. '+escapeHtml(e.unite_travail)+'</td>'
      +'<td style="padding:10px 12px;text-align:center;border-right:1px solid #E5E7EB;width:15%">'
        +'<div style="background:#E5E7EB;border-radius:4px;height:6px;margin-bottom:5px"><div style="height:6px;border-radius:4px;background:'+rc.border+';width:'+pct+'%"></div></div>'
        +'<span style="display:inline-block;padding:2px 8px;background:'+rc.bg+';color:'+rc.text+';border:1px solid '+rc.border+';border-radius:10px;font-size:10px;font-weight:700">'+rc.label+' '+c+'/25</span>'
        +'<div style="font-size:10px;color:#6B7280;margin-top:3px">G:'+g+' × P:'+p+'</div>'
      +'</td>'
      +'<td style="padding:10px 12px;font-size:11px;border-right:1px solid #E5E7EB;width:31%">'+(risques.length?risques.map(function(r){return'<div style="margin-bottom:3px">&#9888; '+escapeHtml(r)+'</div>';}).join(''):'<span style="color:#9CA3AF">&#8212;</span>')+'</td>'
      +'<td style="padding:10px 12px;font-size:11px;width:31%">'+(mesures.length?mesures.map(function(m){return'<div style="margin-bottom:3px;color:#166534">&#10003; '+escapeHtml(m)+'</div>';}).join(''):'<span style="color:#9CA3AF">&#8212;</span>')+'</td>'
      +'</tr>';
  }).join('');
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>DUER &#8212; '+escapeHtml(meta.reportNum)+'</title>'
    + reportCSS(true)
    + '</head><body>'
    + reportHeaderHTML(meta, 'Document Unique d\'Evaluation des Risques (DUER)', 'Art. R4121-1 Code du Travail - Obligation annuelle')
    + '<div class="stat-row">'
    + '<div class="stat-box" style="background:#EFF6FF;border:1px solid #BFDBFE"><div class="stat-box-val" style="color:#1D4ED8">'+totalEntries+'</div><div class="stat-box-lbl" style="color:#1D4ED8">Unites de travail</div></div>'
    + '<div class="stat-box" style="background:#FEE2E2;border:1px solid #FECACA"><div class="stat-box-val" style="color:#DC2626">'+critiques+'</div><div class="stat-box-lbl" style="color:#DC2626">Risques critiques (&gt;=12)</div></div>'
    + '<div class="stat-box" style="background:#FEF3C7;border:1px solid #FDE68A"><div class="stat-box-val" style="color:#B45309">'+eleves+'</div><div class="stat-box-lbl" style="color:#B45309">Risques eleves (6-11)</div></div>'
    + '<div class="stat-box" style="background:#DCFCE7;border:1px solid #BBF7D0"><div class="stat-box-val" style="color:#15803D">'+maitris+'</div><div class="stat-box-lbl" style="color:#15803D">Risques maitris (&lt;6)</div></div>'
    + '</div>'
    + '<table><thead><tr>'
    + '<th style="width:22%">N - Unite de travail</th>'
    + '<th style="width:15%;text-align:center">Criticite (GxP)</th>'
    + '<th style="width:31%">Risques identifies</th>'
    + '<th style="width:31%">Mesures de prevention</th>'
    + '</tr></thead><tbody>'+tableRows+'</tbody></table>'
    + (stampHtml || '')
    + reportFooterHTML(meta, 'DUER', !!(stampHtml && stampHtml.indexOf('SIGN') >= 0))
    + '</body></html>';
}

async function generateDuerPDF() {
  var result = await sb.from('duer_entries').select('*').eq('org_id', currentProfile.org_id).order('created_at');
  var entries = result.data;
  if (!entries || entries.length === 0) { showToast('Aucune unite a exporter', 'error'); return; }
  var meta = await buildReportMeta('DUER');
  openReportWindow(buildDuerHTML(entries, meta, ''), 'DUER', meta);
}

// ══════════════════════════════
// 12.2 — REGISTRE VGP
// ══════════════════════════════

async function renderVgpSection(role) {
  var ctn = document.getElementById(role + '-conform-vgp');
  if (!ctn) return;
  ctn.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div></div>';

  var result = await sb.from('registre_vgp').select('*').eq('org_id', currentProfile.org_id);
  var records = result.data || [];
  var today    = new Date();
  var soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 30);

  function getVgpStatus(equip, record) {
    if (!record || !record.derniere_verification) return 'non_planifie';
    var derniere  = new Date(record.derniere_verification);
    var prochaine = new Date(derniere);
    prochaine.setMonth(prochaine.getMonth() + equip.periodicite);
    if (prochaine < today)    return 'critique';
    if (prochaine < soonDate) return 'alerte';
    return 'ok';
  }

  var actionBtns = '<button class="btn-sm" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#A5B4FC" onclick="generateVgpPDFSigned()">📥 Rapport</button>';
  var ids = buildConformSectionHeader('vgp', role, 'VGP', actionBtns,
    'Registre de Sécurité &amp; Vérifications Périodiques',
    'Contrôles réglementaires obligatoires avec alertes J-30');
  ctn.innerHTML = ids.html;

  renderConformKpiStrip('vgp', ids.kpiId);
  renderConformLastReport('VGP', ids.lastRptId);

  var cctn = document.getElementById(ids.contentId);
  if (cctn) {
    var html = '';
    var cats = [];
    VGP_EQUIPEMENTS.forEach(function(e) { if (cats.indexOf(e.categorie) < 0) cats.push(e.categorie); });
    cats.forEach(function(cat) {
      html += '<div class="section-title">' + escapeHtml(cat) + '</div>';
      VGP_EQUIPEMENTS.filter(function(e) { return e.categorie === cat; }).forEach(function(eq) {
        var record   = records.find(function(r) { return r.equipement === eq.key; });
        var status   = getVgpStatus(eq, record);
        var iconCls  = 'vgp-icon-' + (status === 'non_planifie' ? 'np' : status);
        var badgeCls = 'vgp-badge-' + (status === 'non_planifie' ? 'np' : status);
        var badgeTxt = status === 'ok' ? '✅ À jour' : status === 'alerte' ? '⚠️ Échéance proche' : status === 'critique' ? '🔴 En retard' : '⏸️ Non planifié';
        var dateInfo = 'Jamais vérifié';
        var prochaineInfo = '';
        if (record && record.derniere_verification) {
          var d = new Date(record.derniere_verification);
          var p = new Date(d); p.setMonth(p.getMonth() + eq.periodicite);
          var daysLeft = Math.ceil((p - today) / 86400000);
          dateInfo = 'Dernière : ' + d.toLocaleDateString('fr-FR');
          prochaineInfo = ' — Prochaine : ' + p.toLocaleDateString('fr-FR') + (daysLeft > 0 ? ' (' + daysLeft + 'j)' : ' (DÉPASSÉ)');
        }
        var rapportBtn = (record && record.rapport_url)
          ? '<button class="btn-sm btn-view" style="margin-top:8px" onclick="window.open(\'' + escapeHtml(record.rapport_url) + '\',\'_blank\')">📄 Voir le rapport</button>' : '';
        html += '<div class="vgp-card">'
          + '<div class="vgp-icon ' + iconCls + '">' + eq.icon + '</div>'
          + '<div class="vgp-info">'
          + '<div class="vgp-name">' + escapeHtml(eq.label) + '</div>'
          + '<div class="vgp-meta">' + escapeHtml(dateInfo + prochaineInfo) + ' · Périodicité : ' + eq.periodicite + ' mois · ' + eq.legalRef + '</div>'
          + rapportBtn + '</div>'
          + '<div class="vgp-status"><span class="vgp-badge ' + badgeCls + '">' + badgeTxt + '</span>'
          + '<button class="btn-sm btn-upload" onclick="openVgpModal(\'' + eq.key + '\',\'' + role + '\')">📅 Saisir vérif.</button>'
          + '</div></div>';
      });
    });
    html += '<div id="vgp-inline-history-' + role + '" style="margin-top:32px"></div>';
    cctn.innerHTML = html;
    renderInlineReportHistory('VGP', role, 'vgp-inline-history-' + role);
  }
}

function buildVgpHTML(records, meta, stampHtml) {
  var today    = new Date();
  var soonDate = new Date(); soonDate.setDate(soonDate.getDate() + 30);
  function getVgpStatusForReport(equip, record) {
    if (!record || !record.derniere_verification) return 'non_planifie';
    var d = new Date(record.derniere_verification);
    var p = new Date(d); p.setMonth(p.getMonth() + equip.periodicite);
    if (p < today)    return 'critique';
    if (p < soonDate) return 'alerte';
    return 'ok';
  }
  function statusStyle(s) {
    if (s==='critique') return{bg:'#FEE2E2',border:'#EF4444',text:'#991B1B',label:'En retard'};
    if (s==='alerte')   return{bg:'#FEF3C7',border:'#F59E0B',text:'#92400E',label:'Echeance proche'};
    if (s==='ok')       return{bg:'#DCFCE7',border:'#22C55E',text:'#166534',label:'A jour'};
    return                    {bg:'#F3F4F6',border:'#D1D5DB',text:'#6B7280',label:'Non planifie'};
  }
  var critCount=0,alertCount=0,okCount=0,npCount=0;
  VGP_EQUIPEMENTS.forEach(function(eq){
    var r=records.find(function(x){return x.equipement===eq.key;});
    var s=getVgpStatusForReport(eq,r);
    if(s==='critique')critCount++;else if(s==='alerte')alertCount++;else if(s==='ok')okCount++;else npCount++;
  });
  var cats=[];
  VGP_EQUIPEMENTS.forEach(function(e){if(cats.indexOf(e.categorie)<0)cats.push(e.categorie);});
  var tableRows=''; var rowIdx=0;
  cats.forEach(function(cat){
    tableRows+='<tr><td colspan="6" style="background:#1E3A5F;color:#fff;font-weight:700;font-size:11px;padding:7px 12px;letter-spacing:.5px">'+cat.toUpperCase()+'</td></tr>';
    VGP_EQUIPEMENTS.filter(function(e){return e.categorie===cat;}).forEach(function(eq){
      var record=records.find(function(r){return r.equipement===eq.key;});
      var status=getVgpStatusForReport(eq,record); var st=statusStyle(status);
      var rowBg=rowIdx%2===0?'#ffffff':'#F9FAFB'; rowIdx++;
      var derniereStr='--',prochaineStr='--',daysLeftStr='--';
      if(record&&record.derniere_verification){
        var d=new Date(record.derniere_verification);
        var p=new Date(d); p.setMonth(p.getMonth()+eq.periodicite);
        var dl=Math.ceil((p-today)/86400000);
        derniereStr=d.toLocaleDateString('fr-FR');
        prochaineStr=p.toLocaleDateString('fr-FR');
        daysLeftStr=dl>0?dl+' j':'DEPASSE ('+Math.abs(dl)+'j)';
      }
      var rapportCell=(record&&record.rapport_url)
        ?'<a href="'+record.rapport_url+'" target="_blank" style="color:#2563EB;font-size:10px">Rapport</a>'
        :'<span style="color:#9CA3AF;font-size:10px">--</span>';
      tableRows+='<tr style="background:'+rowBg+'">'
        +'<td style="padding:9px 12px;font-size:12px;font-weight:600">'+eq.icon+' '+escapeHtml(eq.label)+'</td>'
        +'<td style="padding:9px 12px;font-size:10px;color:#6B7280">'+eq.legalRef+'</td>'
        +'<td style="padding:9px 12px;font-size:11px;text-align:center">'+eq.periodicite+' mois</td>'
        +'<td style="padding:9px 12px;font-size:11px;text-align:center">'+derniereStr+'</td>'
        +'<td style="padding:9px 12px;font-size:11px;text-align:center">'+prochaineStr+'<br><span style="font-size:10px">'+daysLeftStr+'</span></td>'
        +'<td style="padding:9px 12px;text-align:center">'
          +'<span style="display:inline-block;padding:2px 8px;background:'+st.bg+';color:'+st.text+';border:1px solid '+st.border+';border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap">'+st.label+'</span>'
          +'<br>'+rapportCell
        +'</td>'
        +'</tr>';
    });
  });
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>VGP -- '+escapeHtml(meta.reportNum)+'</title>'
    + reportCSS(true)
    + '</head><body>'
    + reportHeaderHTML(meta, 'Registre de Securite -- Verifications Generales Periodiques', 'Decret 98-1084 - Art. R4323-22 Code du Travail - Alertes J-30')
    + '<div class="stat-row">'
    + '<div class="stat-box" style="background:#DCFCE7;border:1px solid #BBF7D0"><div class="stat-box-val" style="color:#15803D">'+okCount+'</div><div class="stat-box-lbl" style="color:#15803D">A jour</div></div>'
    + '<div class="stat-box" style="background:#FEF3C7;border:1px solid #FDE68A"><div class="stat-box-val" style="color:#B45309">'+alertCount+'</div><div class="stat-box-lbl" style="color:#B45309">Echeance &lt; 30j</div></div>'
    + '<div class="stat-box" style="background:#FEE2E2;border:1px solid #FECACA"><div class="stat-box-val" style="color:#DC2626">'+critCount+'</div><div class="stat-box-lbl" style="color:#DC2626">En retard</div></div>'
    + '<div class="stat-box" style="background:#F3F4F6;border:1px solid #E5E7EB"><div class="stat-box-val" style="color:#6B7280">'+npCount+'</div><div class="stat-box-lbl" style="color:#6B7280">Non planifies</div></div>'
    + '</div>'
    + '<table><thead><tr>'
    + '<th style="width:19%">Equipement</th>'
    + '<th style="width:17%">Reference legale</th>'
    + '<th style="width:10%;text-align:center">Periodicite</th>'
    + '<th style="width:13%;text-align:center">Derniere verif.</th>'
    + '<th style="width:15%;text-align:center">Prochaine verif.</th>'
    + '<th style="width:12%;text-align:center">Statut / Rapport</th>'
    + '</tr></thead><tbody>'+tableRows+'</tbody></table>'
    + (stampHtml || '')
    + reportFooterHTML(meta, 'Registre VGP', !!(stampHtml && stampHtml.indexOf('SIGN') >= 0))
    + '</body></html>';
}

async function generateVgpPDF() {
  var result  = await sb.from('registre_vgp').select('*').eq('org_id', currentProfile.org_id);
  var records = result.data || [];
  var meta    = await buildReportMeta('VGP');
  openReportWindow(buildVgpHTML(records, meta, ''), 'VGP', meta);
}

function openVgpModal(equipKey, role) {
  _conformRole = role || _conformRole;
  _vgpFile = null;
  var equip = VGP_EQUIPEMENTS.find(function(e) { return e.key === equipKey; });
  if (!equip) return;
  document.getElementById('vgpModalTitle').textContent    = '🔧 ' + equip.label;
  document.getElementById('vgpModalSubtitle').textContent = 'Périodicité légale : ' + equip.periodicite + ' mois — ' + equip.legalRef;
  document.getElementById('vgpEquipementKey').value = equipKey;
  document.getElementById('vgpEntryId').value       = '';
  document.getElementById('vgpDerniereVerif').value  = '';
  document.getElementById('vgpFilePreview').textContent = '';
  document.getElementById('vgpRapportFile').value   = '';
  document.getElementById('vgpEntryModal').classList.add('open');
}

function closeVgpModal() { document.getElementById('vgpEntryModal').classList.remove('open'); _vgpFile = null; }

function onVgpFileSelect(input) {
  _vgpFile = input.files[0];
  document.getElementById('vgpFilePreview').textContent = _vgpFile ? '✓ ' + _vgpFile.name : '';
}

async function saveVgpEntry() {
  var date = document.getElementById('vgpDerniereVerif').value;
  if (!date) { showToast('Saisissez la date de la vérification', 'error'); return; }
  var btn = document.getElementById('vgpSaveBtn');
  btn.disabled = true; btn.textContent = '⏳';

  var equipKey = document.getElementById('vgpEquipementKey').value;
  var equip    = VGP_EQUIPEMENTS.find(function(e) { return e.key === equipKey; });
  var rapportUrl = null;

  if (_vgpFile) {
    var ext  = _vgpFile.name.split('.').pop();
    var path = currentProfile.org_id + '/vgp/' + equipKey + '_' + Date.now() + '.' + ext;
    var upResult = await sb.storage.from('documents').upload(path, _vgpFile);
    if (upResult.error) {
      showToast('Erreur upload rapport : ' + upResult.error.message, 'error');
      btn.disabled = false; btn.textContent = '✓ Enregistrer';
      return;
    }
    rapportUrl = sb.storage.from('documents').getPublicUrl(path).data.publicUrl;
  }

  var derniere  = new Date(date);
  var prochaine = new Date(derniere);
  prochaine.setMonth(prochaine.getMonth() + (equip ? equip.periodicite : 12));

  var payload = {
    org_id:                 currentProfile.org_id,
    equipement:             equipKey,
    categorie:              equip ? equip.categorie : '',
    periodicite_mois:       equip ? equip.periodicite : 12,
    derniere_verification:  date,
    prochaine_verification: prochaine.toISOString().split('T')[0],
    statut:                 'ok',
  };
  if (rapportUrl) payload.rapport_url = rapportUrl;

  var result = await sb.from('registre_vgp').upsert(payload, { onConflict: 'org_id,equipement' });
  btn.disabled = false; btn.textContent = '✓ Enregistrer';
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast('Vérification enregistrée', 'success');
  closeVgpModal();
  renderVgpSection(_conformRole);
}

// ══════════════════════════════
// 12.3 — BIBLIOTHÈQUE FDS
// ══════════════════════════════

async function renderFdsSection(role) {
  var ctn = document.getElementById(role + '-conform-fds');
  if (!ctn) return;
  ctn.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div></div>';

  var result = await sb.from('fds_library').select('*').eq('org_id', currentProfile.org_id).order('produit');
  var fiches = result.data;
  if (result.error) { ctn.innerHTML = '<div class="empty-state"><div class="empty-state-text">Erreur : ' + escapeHtml(result.error.message) + '</div></div>'; return; }

  var today   = new Date();
  var limit3y = new Date(); limit3y.setFullYear(limit3y.getFullYear() - 3);

  function getFdsStatus(f) {
    if (!f.fds_url)      return { label:'⚠️ FDS manquante', badge:'vgp-badge-critique' };
    if (!f.version_date) return { label:'📅 Date inconnue',  badge:'vgp-badge-alerte' };
    if (new Date(f.version_date) < limit3y) return { label:'♻️ À renouveler (> 3 ans)', badge:'vgp-badge-alerte' };
    return { label:'✅ À jour', badge:'vgp-badge-ok' };
  }

  var actionBtns = '<button class="btn-sm btn-upload" onclick="openFdsModal(null)">➕ Ajouter un produit</button>';
  var ids = buildConformSectionHeader('fds', role, 'FDS', actionBtns,
    'Bibliothèque des Fiches de Données de Sécurité',
    'Produits chimiques utilisés sur site — Règlement REACH · Directive 67/548/CE');
  ctn.innerHTML = ids.html;

  renderConformKpiStrip('fds', ids.kpiId);

  var cctn = document.getElementById(ids.contentId);
  if (cctn) {
    var html = '';
    if (fiches && fiches.length > 0) {
      fiches.forEach(function(f) {
        var st  = getFdsStatus(f);
        var vd  = f.version_date ? new Date(f.version_date).toLocaleDateString('fr-FR') : 'Date inconnue';
        var meta = (f.fournisseur ? escapeHtml(f.fournisseur) + ' · ' : '') + 'Version : ' + vd;
        var fdsBtn = f.fds_url ? '<button class="btn-sm btn-view" onclick="window.open(\'' + escapeHtml(f.fds_url) + '\',\'_blank\')">📄 FDS</button>' : '';
        html += '<div class="fds-card">'
          + '<div class="fds-icon">⚗️</div>'
          + '<div class="fds-info">'
          + '<div class="fds-name">' + escapeHtml(f.produit) + '</div>'
          + '<div class="fds-meta">' + meta + '</div>'
          + '<div style="margin-top:6px"><span class="vgp-badge ' + st.badge + '" style="font-size:11px">' + st.label + '</span></div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">'
          + fdsBtn
          + '<button class="btn-sm" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#A5B4FC" onclick="openFdsModal(\'' + f.id + '\')">✏️</button>'
          + '<button class="btn-sm btn-reject" onclick="deleteFdsEntry(\'' + f.id + '\')">🗑</button>'
          + '</div></div>';
      });
    } else {
      html = '<div class="empty-state"><div class="empty-state-icon">⚗️</div>'
        + '<div class="empty-state-text">Aucun produit chimique référencé.<br>Ajoutez vos premiers produits et uploadez leurs FDS.</div></div>';
    }
    cctn.innerHTML = html;
  }
}

async function openFdsModal(fdsId) {
  _fdsFile = null;
  document.getElementById('fdsEntryId').value   = fdsId || '';
  document.getElementById('fdsModalTitle').textContent = fdsId ? '✏️ Modifier le produit' : '⚗️ Nouveau produit chimique';
  document.getElementById('fdsProduit').value    = '';
  document.getElementById('fdsFournisseur').value = '';
  document.getElementById('fdsVersionDate').value = '';
  document.getElementById('fdsFilePreview').textContent = '';
  document.getElementById('fdsFichier').value   = '';

  if (fdsId) {
    var r = await sb.from('fds_library').select('*').eq('id', fdsId).single();
    if (r.data) {
      document.getElementById('fdsProduit').value     = r.data.produit || '';
      document.getElementById('fdsFournisseur').value  = r.data.fournisseur || '';
      document.getElementById('fdsVersionDate').value  = r.data.version_date || '';
    }
  }
  document.getElementById('fdsEntryModal').classList.add('open');
}

function closeFdsModal() { document.getElementById('fdsEntryModal').classList.remove('open'); _fdsFile = null; }

function onFdsFileSelect(input) {
  _fdsFile = input.files[0];
  document.getElementById('fdsFilePreview').textContent = _fdsFile ? '✓ ' + _fdsFile.name : '';
}

async function saveFdsEntry() {
  var produit = document.getElementById('fdsProduit').value.trim();
  if (!produit) { showToast('Saisissez le nom du produit', 'error'); return; }
  var btn = document.getElementById('fdsSaveBtn');
  btn.disabled = true; btn.textContent = '⏳';

  var fdsUrl = null;
  if (_fdsFile) {
    var path = currentProfile.org_id + '/fds/' + Date.now() + '_' + _fdsFile.name;
    var upResult = await sb.storage.from('documents').upload(path, _fdsFile);
    if (upResult.error) {
      showToast('Erreur upload FDS : ' + upResult.error.message, 'error');
      btn.disabled = false; btn.textContent = '✓ Enregistrer';
      return;
    }
    fdsUrl = sb.storage.from('documents').getPublicUrl(path).data.publicUrl;
  }

  var fdsId   = document.getElementById('fdsEntryId').value;
  var payload = {
    org_id:       currentProfile.org_id,
    produit:      produit,
    fournisseur:  document.getElementById('fdsFournisseur').value.trim() || null,
    version_date: document.getElementById('fdsVersionDate').value || null,
  };
  if (fdsUrl) payload.fds_url = fdsUrl;

  var result = fdsId
    ? await sb.from('fds_library').update(payload).eq('id', fdsId)
    : await sb.from('fds_library').insert(payload);

  btn.disabled = false; btn.textContent = '✓ Enregistrer';
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast(fdsId ? 'Produit mis à jour' : 'Produit ajouté à la bibliothèque', 'success');
  closeFdsModal();
  renderFdsSection(_conformRole);
}

async function deleteFdsEntry(id) {
  if (!confirm('Supprimer ce produit de la bibliothèque FDS ?')) return;
  var result = await sb.from('fds_library').delete().eq('id', id);
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast('Produit supprimé', 'success');
  renderFdsSection(_conformRole);
}





// ══════════════════════════════════════════════════
// 12.4 — PLAN DE PRÉVENTION (PdP)
// Art. R4512-6 à R4512-12 Code du Travail
// ══════════════════════════════════════════════════

var _pdpRisques      = [];  // [{ id, description, gravite, mesure }]
var _pdpIntervenants = [];  // [{ id, nom, poste, habilitations }]
var _pdpCurrentStep  = 1;

async function renderPdpSection(role) {
  var ctn = document.getElementById(role + '-conform-pdp');
  if (!ctn) return;
  ctn.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div></div>';

  var result = await sb.from('pdp_entries').select('*').eq('org_id', currentProfile.org_id).order('created_at', { ascending: false });
  var pdps = result.data;
  if (result.error) { ctn.innerHTML = '<div class="empty-state"><div class="empty-state-text">Erreur : ' + escapeHtml(result.error.message) + '</div></div>'; return; }

  var today = new Date();
  function getPdpStatus(p) {
    if (!p.date_debut || !p.date_fin) return { label:'📋 En préparation', badge:'vgp-badge-np' };
    var debut = new Date(p.date_debut), fin = new Date(p.date_fin);
    if (today < debut)  return { label:'⏳ À venir',   badge:'vgp-badge-alerte' };
    if (today <= fin)   return { label:'🟢 En cours',  badge:'vgp-badge-ok' };
    return                     { label:'✅ Terminé',   badge:'vgp-badge-np' };
  }

  var actionBtns = '<button class="btn-sm btn-upload" onclick="openPdpModal(null)">➕ Nouveau PdP</button>';
  var ids = buildConformSectionHeader('pdp', role, 'PDP', actionBtns,
    'Plans de Prévention',
    'Obligation légale EU/ST — coactivité ≥ 400h/an ou travaux dangereux · Art. R4512-6 Code du Travail');
  ctn.innerHTML = ids.html;

  renderConformKpiStrip('pdp', ids.kpiId);
  renderConformLastReport('PDP', ids.lastRptId);

  var cctn = document.getElementById(ids.contentId);
  if (cctn) {
    var html = '';
    if (pdps && pdps.length > 0) {
      pdps.forEach(function(p) {
        var st = getPdpStatus(p);
        var dateRange = (p.date_debut ? new Date(p.date_debut).toLocaleDateString('fr-FR') : '?')
                      + ' → ' + (p.date_fin ? new Date(p.date_fin).toLocaleDateString('fr-FR') : '?');
        var risques = p.risques ? (typeof p.risques === 'string' ? JSON.parse(p.risques) : p.risques) : [];
        var travDangereux = p.travaux_dangereux ? (typeof p.travaux_dangereux === 'string' ? JSON.parse(p.travaux_dangereux) : p.travaux_dangereux) : [];
        var riskTags = risques.slice(0, 3).map(function(r) { return '<span class="pdp-risque-tag">⚠️ ' + escapeHtml(r.description || r) + '</span>'; }).join('');
        if (risques.length > 3) riskTags += '<span class="pdp-risque-tag" style="background:rgba(148,163,184,.08);color:var(--muted);border-color:rgba(148,163,184,.2)">+' + (risques.length - 3) + '</span>';
        var tdTags = travDangereux.map(function(td) { return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(239,68,68,.08);color:#FCA5A5;border:1px solid rgba(239,68,68,.15);margin:2px">🔥 ' + escapeHtml(td) + '</span>'; }).join('');
        html += '<div class="pdp-card">'
          + '<div class="pdp-card-header">'
          + '<div class="pdp-card-icon">📋</div>'
          + '<div class="pdp-card-title">'
          + '<div class="pdp-card-name">' + escapeHtml(p.nature_travaux || 'PdP sans titre') + '</div>'
          + '<div class="pdp-card-meta">🏭 ' + escapeHtml(p.site || '') + ' · 📅 ' + dateRange + (p.duree_h ? ' · ⏱ ' + p.duree_h + 'h' : '') + '</div>'
          + '</div>'
          + '<span class="vgp-badge ' + st.badge + '">' + st.label + '</span>'
          + '</div>'
          + '<div class="pdp-card-parties">'
          + '<div class="pdp-party"><span class="pdp-party-label">🏭 EU :</span><span class="pdp-party-val">' + escapeHtml(p.eu_nom || '—') + '</span></div>'
          + '<div class="pdp-party"><span class="pdp-party-label">🤝 ST :</span><span class="pdp-party-val">' + escapeHtml(p.st_nom || '—') + '</span></div>'
          + (p.sps_nom ? '<div class="pdp-party"><span class="pdp-party-label">👷 SPS :</span><span class="pdp-party-val">' + escapeHtml(p.sps_nom) + '</span></div>' : '')
          + '</div>'
          + (riskTags ? '<div style="margin-top:8px">' + riskTags + '</div>' : '')
          + (tdTags ? '<div style="margin-top:6px">' + tdTags + '</div>' : '')
          + '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">'
          + '<button class="btn-sm" style="background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.25);color:var(--orange)" onclick="generatePdpReport(\'' + p.id + '\')">📄 Rapport PDF</button>'
          + '<button class="btn-sm btn-view" onclick="openPdpModal(\'' + p.id + '\')">✏️ Modifier</button>'
          + '<button class="btn-sm btn-reject" onclick="deletePdp(\'' + p.id + '\')">🗑 Supprimer</button>'
          + '</div>'
          + '</div>';
      });
    } else {
      html = '<div class="empty-state"><div class="empty-state-icon">📋</div>'
        + '<div class="empty-state-text">Aucun Plan de Prévention enregistré.<br>Créez votre premier PdP pour une intervention extérieure.</div></div>';
    }
    cctn.innerHTML = html;
  }
}

// ── Modale PDP ────────────────────────────────────────────────
function pdpShowStep(n) {
  _pdpCurrentStep = n;
  [1, 2, 3, 4].forEach(function(i) {
    var s = document.getElementById('pdpStep' + i);
    var b = document.getElementById('pdpStep' + i + 'Btn');
    if (s) s.style.display = (i === n) ? '' : 'none';
    if (b) {
      b.className = i === n
        ? 'btn-sm btn-validate'
        : 'btn-sm btn-view';
      b.style.flex = '1';
      b.style.minWidth = '120px';
      b.style.fontSize = '11px';
    }
  });
}

function pdpAddRisque() {
  var id = 'r' + Date.now();
  _pdpRisques.push({ id: id, description: '', mesure: '' });
  pdpRenderRisques();
}

function pdpRemoveRisque(id) {
  _pdpRisques = _pdpRisques.filter(function(r) { return r.id !== id; });
  pdpRenderRisques();
}

function pdpRenderRisques() {
  var ctn = document.getElementById('pdpRisquesList');
  if (!ctn) return;
  if (_pdpRisques.length === 0) {
    ctn.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:12px">Aucun risque identifié. Cliquez sur "Ajouter un risque".</div>';
    return;
  }
  ctn.innerHTML = _pdpRisques.map(function(r) {
    return '<div class="pdp-risque-row" id="risqueRow_' + r.id + '">'
      + '<div style="flex:1;display:flex;flex-direction:column;gap:6px">'
      + '<input type="text" class="form-input" style="margin:0;padding:6px 10px;font-size:12px" placeholder="Description du risque (ex: Chute d\'objet depuis l\'échafaudage)" value="' + escapeHtml(r.description) + '" oninput="pdpUpdateRisque(\'' + r.id + '\',\'description\',this.value)">'
      + '<input type="text" class="form-input" style="margin:0;padding:6px 10px;font-size:12px" placeholder="Mesure de prévention associée (ex: Balisage zone, permis de travail)" value="' + escapeHtml(r.mesure) + '" oninput="pdpUpdateRisque(\'' + r.id + '\',\'mesure\',this.value)">'
      + '</div>'
      + '<button class="btn-sm btn-reject" style="padding:6px 10px;align-self:flex-start" onclick="pdpRemoveRisque(\'' + r.id + '\')">🗑</button>'
      + '</div>';
  }).join('');
}

function pdpUpdateRisque(id, field, val) {
  var r = _pdpRisques.find(function(x) { return x.id === id; });
  if (r) r[field] = val;
}

function pdpAddIntervenant() {
  var id = 'i' + Date.now();
  _pdpIntervenants.push({ id: id, nom: '', poste: '', habilitations: '' });
  pdpRenderIntervenants();
}

function pdpRemoveIntervenant(id) {
  _pdpIntervenants = _pdpIntervenants.filter(function(i) { return i.id !== id; });
  pdpRenderIntervenants();
}

function pdpRenderIntervenants() {
  var ctn = document.getElementById('pdpIntervenantsList');
  if (!ctn) return;
  if (_pdpIntervenants.length === 0) {
    ctn.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:12px">Aucun intervenant ajouté.</div>';
    return;
  }
  ctn.innerHTML = _pdpIntervenants.map(function(inv) {
    return '<div class="pdp-intervenant-row">'
      + '<div style="flex:1;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">'
      + '<input type="text" class="form-input" style="margin:0;padding:6px 10px;font-size:12px" placeholder="Nom Prénom" value="' + escapeHtml(inv.nom) + '" oninput="pdpUpdateIntervenant(\'' + inv.id + '\',\'nom\',this.value)">'
      + '<input type="text" class="form-input" style="margin:0;padding:6px 10px;font-size:12px" placeholder="Poste / Qualification" value="' + escapeHtml(inv.poste) + '" oninput="pdpUpdateIntervenant(\'' + inv.id + '\',\'poste\',this.value)">'
      + '<input type="text" class="form-input" style="margin:0;padding:6px 10px;font-size:12px" placeholder="Habilitations (ex: H0B0, CACES)" value="' + escapeHtml(inv.habilitations) + '" oninput="pdpUpdateIntervenant(\'' + inv.id + '\',\'habilitations\',this.value)">'
      + '</div>'
      + '<button class="btn-sm btn-reject" style="padding:6px 10px" onclick="pdpRemoveIntervenant(\'' + inv.id + '\')">🗑</button>'
      + '</div>';
  }).join('');
}

function pdpUpdateIntervenant(id, field, val) {
  var inv = _pdpIntervenants.find(function(x) { return x.id === id; });
  if (inv) inv[field] = val;
}

function pdpGetTravDangereux() {
  var list = [];
  var map = { pdpTD_elec:'Travaux électriques HT/BT', pdpTD_hauteur:'Travaux en hauteur', pdpTD_feu:'Travaux par points chauds', pdpTD_espaceconfine:'Espaces confinés', pdpTD_chimique:'Risque chimique / CMR', pdpTD_levage:'Levage / manutention lourde', pdpTD_demolition:'Démolition / structure', pdpTD_amiante:'Risque amiante / plomb' };
  Object.keys(map).forEach(function(id) {
    var el = document.getElementById(id);
    if (el && el.checked) list.push(map[id]);
  });
  return list;
}

function pdpSetTravDangereux(list) {
  var map = { 'Travaux électriques HT/BT':'pdpTD_elec', 'Travaux en hauteur':'pdpTD_hauteur', 'Travaux par points chauds':'pdpTD_feu', 'Espaces confinés':'pdpTD_espaceconfine', 'Risque chimique / CMR':'pdpTD_chimique', 'Levage / manutention lourde':'pdpTD_levage', 'Démolition / structure':'pdpTD_demolition', 'Risque amiante / plomb':'pdpTD_amiante' };
  Object.values(map).forEach(function(id) { var el = document.getElementById(id); if (el) el.checked = false; });
  (list || []).forEach(function(td) { var id = map[td]; var el = id && document.getElementById(id); if (el) el.checked = true; });
}

function pdpGetEpi() {
  var list = [];
  var map = { pdpEPI_casque:'Casque de protection', pdpEPI_gilet:'Gilet haute visibilité', pdpEPI_gants:'Gants de protection', pdpEPI_chaussures:'Chaussures de sécurité S3', pdpEPI_lunettes:'Lunettes de protection', pdpEPI_harnais:'Harnais antichute', pdpEPI_masque:'Masque respiratoire', pdpEPI_antibruit:'Protection auditive' };
  Object.keys(map).forEach(function(id) { var el = document.getElementById(id); if (el && el.checked) list.push(map[id]); });
  return list;
}

function pdpSetEpi(list) {
  var map = { 'Casque de protection':'pdpEPI_casque', 'Gilet haute visibilité':'pdpEPI_gilet', 'Gants de protection':'pdpEPI_gants', 'Chaussures de sécurité S3':'pdpEPI_chaussures', 'Lunettes de protection':'pdpEPI_lunettes', 'Harnais antichute':'pdpEPI_harnais', 'Masque respiratoire':'pdpEPI_masque', 'Protection auditive':'pdpEPI_antibruit' };
  Object.values(map).forEach(function(id) { var el = document.getElementById(id); if (el) el.checked = false; });
  (list || []).forEach(function(epi) { var id = map[epi]; var el = id && document.getElementById(id); if (el) el.checked = true; });
}

async function openPdpModal(pdpId) {
  _pdpRisques      = [];
  _pdpIntervenants = [];

  // Reset fields
  ['pdpEntryId','pdpEuNom','pdpEuContact','pdpSite','pdpNatureTravaux','pdpStNom','pdpStContact',
   'pdpSpsNom','pdpSpsContact','pdpMesures','pdpDateDebut','pdpDateFin','pdpDureeH','pdpNbTravST','pdpRemarques'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  pdpSetTravDangereux([]);
  pdpSetEpi([]);
  pdpRenderRisques();
  pdpRenderIntervenants();

  document.getElementById('pdpEntryId').value = pdpId || '';
  document.getElementById('pdpModalTitle').textContent = pdpId ? '✏️ Modifier le Plan de Prévention' : '📋 Nouveau Plan de Prévention';
  pdpShowStep(1);

  if (pdpId) {
    var r = await sb.from('pdp_entries').select('*').eq('id', pdpId).single();
    var p = r.data;
    if (p) {
      document.getElementById('pdpEuNom').value        = p.eu_nom || '';
      document.getElementById('pdpEuContact').value    = p.eu_contact || '';
      document.getElementById('pdpSite').value         = p.site || '';
      document.getElementById('pdpNatureTravaux').value= p.nature_travaux || '';
      document.getElementById('pdpStNom').value        = p.st_nom || '';
      document.getElementById('pdpStContact').value    = p.st_contact || '';
      document.getElementById('pdpSpsNom').value       = p.sps_nom || '';
      document.getElementById('pdpSpsContact').value   = p.sps_contact || '';
      document.getElementById('pdpMesures').value      = p.mesures || '';
      document.getElementById('pdpDateDebut').value    = p.date_debut || '';
      document.getElementById('pdpDateFin').value      = p.date_fin || '';
      document.getElementById('pdpDureeH').value       = p.duree_h || '';
      document.getElementById('pdpNbTravST').value     = p.nb_trav_st || '';
      document.getElementById('pdpRemarques').value    = p.remarques || '';
      var risques = p.risques ? (typeof p.risques === 'string' ? JSON.parse(p.risques) : p.risques) : [];
      _pdpRisques = risques.map(function(r) { return { id: 'r' + Math.random(), description: r.description || '', mesure: r.mesure || '' }; });
      var intervenants = p.intervenants ? (typeof p.intervenants === 'string' ? JSON.parse(p.intervenants) : p.intervenants) : [];
      _pdpIntervenants = intervenants.map(function(inv) { return { id: 'i' + Math.random(), nom: inv.nom || '', poste: inv.poste || '', habilitations: inv.habilitations || '' }; });
      pdpSetTravDangereux(p.travaux_dangereux || []);
      pdpSetEpi(p.epi || []);
      pdpRenderRisques();
      pdpRenderIntervenants();
    }
  }
  document.getElementById('pdpModal').classList.add('open');
}

function closePdpModal() { document.getElementById('pdpModal').classList.remove('open'); }

async function savePdp() {
  var euNom         = document.getElementById('pdpEuNom').value.trim();
  var natureTravaux = document.getElementById('pdpNatureTravaux').value.trim();
  var stNom         = document.getElementById('pdpStNom').value.trim();
  if (!euNom || !natureTravaux || !stNom) {
    showToast('Renseignez EU, ST et la nature des travaux (étape 1)', 'error'); return;
  }
  var btn = document.getElementById('pdpSaveBtn');
  btn.disabled = true; btn.textContent = '⏳';

  var payload = {
    org_id:           currentProfile.org_id,
    created_by:       currentProfile.id,
    eu_nom:           euNom,
    eu_contact:       document.getElementById('pdpEuContact').value.trim() || null,
    site:             document.getElementById('pdpSite').value.trim() || null,
    nature_travaux:   natureTravaux,
    st_nom:           stNom,
    st_contact:       document.getElementById('pdpStContact').value.trim() || null,
    sps_nom:          document.getElementById('pdpSpsNom').value.trim() || null,
    sps_contact:      document.getElementById('pdpSpsContact').value.trim() || null,
    mesures:          document.getElementById('pdpMesures').value.trim() || null,
    date_debut:       document.getElementById('pdpDateDebut').value || null,
    date_fin:         document.getElementById('pdpDateFin').value || null,
    duree_h:          parseInt(document.getElementById('pdpDureeH').value) || null,
    nb_trav_st:       parseInt(document.getElementById('pdpNbTravST').value) || null,
    remarques:        document.getElementById('pdpRemarques').value.trim() || null,
    risques:          JSON.stringify(_pdpRisques.filter(function(r) { return r.description; })),
    intervenants:     JSON.stringify(_pdpIntervenants.filter(function(i) { return i.nom; })),
    travaux_dangereux:JSON.stringify(pdpGetTravDangereux()),
    epi:              JSON.stringify(pdpGetEpi()),
    updated_at:       new Date().toISOString()
  };

  var pdpId  = document.getElementById('pdpEntryId').value;
  var result = pdpId
    ? await sb.from('pdp_entries').update(payload).eq('id', pdpId)
    : await sb.from('pdp_entries').insert(payload);

  btn.disabled = false; btn.textContent = '✓ Enregistrer le PdP';
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast(pdpId ? 'PdP mis à jour' : 'Plan de Prévention créé', 'success');
  closePdpModal();
  renderPdpSection(_conformRole);
}

async function deletePdp(id) {
  if (!confirm('Supprimer ce Plan de Prévention ? Cette action est irréversible.')) return;
  var result = await sb.from('pdp_entries').delete().eq('id', id);
  if (result.error) { showToast('Erreur : ' + result.error.message, 'error'); return; }
  showToast('PdP supprimé', 'success');
  renderPdpSection(_conformRole);
}

// ── Générateur rapport PDF PdP ──────────────────────────────
async function generatePdpReport(pdpId) {
  var r = await sb.from('pdp_entries').select('*').eq('id', pdpId).single();
  if (r.error || !r.data) { showToast('PdP introuvable', 'error'); return; }
  var p = r.data;
  var meta = await buildReportMeta('PDP');
  // Enrichir le meta avec les infos PDP
  meta.euNom = p.eu_nom || ''; meta.site = p.site || '';
  meta.label = 'PDP — ' + (p.nature_travaux || p.eu_nom || p.site || 'Plan de Prévention');
  var html = buildPdpHTML(p, '');
  openReportWindow(html, 'PDP', meta);
}

function buildPdpHTML(p, stampHtml) {
  var risques      = p.risques      ? (typeof p.risques === 'string'       ? JSON.parse(p.risques)       : p.risques)      : [];
  var intervenants = p.intervenants ? (typeof p.intervenants === 'string'  ? JSON.parse(p.intervenants)  : p.intervenants) : [];
  var travDang     = p.travaux_dangereux ? (typeof p.travaux_dangereux === 'string' ? JSON.parse(p.travaux_dangereux) : p.travaux_dangereux) : [];
  var epi          = p.epi          ? (typeof p.epi === 'string'           ? JSON.parse(p.epi)           : p.epi)          : [];

  var now = new Date();
  var fmt = function(d) { return d ? new Date(d).toLocaleDateString('fr-FR') : '—'; };

  var risqueRows = risques.map(function(r, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + (r.description || '') + '</td><td>' + (r.mesure || '—') + '</td></tr>';
  }).join('');

  var intervenantRows = intervenants.map(function(inv, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + (inv.nom || '') + '</td><td>' + (inv.poste || '—') + '</td><td>' + (inv.habilitations || '—') + '</td></tr>';
  }).join('');

  var tdList = travDang.length ? travDang.map(function(td) { return '<li>' + td + '</li>'; }).join('') : '<li><em>Aucun travail dangereux identifié</em></li>';
  var epiList = epi.length    ? epi.map(function(e) { return '<li>' + e + '</li>'; }).join('') : '<li><em>Non renseigné</em></li>';

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Plan de Prévention — ${p.nature_travaux || ''}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; margin: 0; padding: 30px; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #F97316; padding-bottom: 18px; margin-bottom: 24px; }
  .brand { font-family: Arial Black, sans-serif; font-size: 22px; font-weight: 900; color: #0D1B2A; }
  .brand span { color: #F97316; }
  .doc-meta { text-align: right; font-size: 11px; color: #64748B; }
  .doc-num { font-size: 16px; font-weight: 700; color: #0D1B2A; margin-bottom: 4px; }
  h1 { font-size: 20px; text-align: center; color: #0D1B2A; margin: 0 0 6px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .subtitle { text-align: center; font-size: 11px; color: #64748B; margin-bottom: 28px; }
  h2 { font-size: 13px; font-weight: 700; background: #0D1B2A; color: #fff; padding: 6px 12px; border-radius: 4px; margin: 22px 0 10px; text-transform: uppercase; letter-spacing: .5px; }
  .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .partie-box { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 14px; }
  .partie-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #F97316; margin-bottom: 8px; }
  .partie-row { display: flex; gap: 8px; margin-bottom: 4px; }
  .partie-label { font-size: 11px; color: #64748B; min-width: 70px; }
  .partie-val { font-size: 11px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
  th { background: #1B3A5C; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; }
  td { padding: 6px 10px; border-bottom: 1px solid #E2E8F0; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .empty-row td { text-align: center; color: #94A3B8; font-style: italic; padding: 14px; }
  .td-list { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .td-item { background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 600; color: #DC2626; }
  .epi-item { background: #F0FDF4; border: 1px solid #86EFAC; border-radius: 4px; padding: 4px 8px; font-size: 11px; font-weight: 600; color: #15803D; }
  ul.td-list-ul { padding-left: 18px; margin: 4px 0; }
  .mesures-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 12px; font-size: 11px; white-space: pre-wrap; line-height: 1.6; }
  .sig-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 8px; }
  .sig-box { border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center; min-height: 90px; }
  .sig-role { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748B; margin-bottom: 6px; }
  .sig-name { font-size: 11px; font-weight: 600; margin-bottom: 4px; }
  .sig-date { font-size: 10px; color: #94A3B8; }
  .sig-line { border-bottom: 1px dashed #CBD5E0; margin: 10px 0; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; }
  @media print { body { padding: 15px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="brand">Safety<span>Sphere</span></div>
    <div style="font-size:10px;color:#64748B;margin-top:4px">Plateforme de conformité HSE</div>
  </div>
  <div class="doc-meta">
    <div class="doc-num">PLAN DE PRÉVENTION</div>
    <div>Généré le ${now.toLocaleDateString('fr-FR')}</div>
    <div>Art. R4512-6 à R4512-12 du Code du Travail</div>
  </div>
</div>

<h1>📋 Plan de Prévention</h1>
<div class="subtitle">${p.nature_travaux || ''} — ${p.site || ''}</div>

<h2>1. Identification des parties</h2>
<div class="parties-grid">
  <div class="partie-box">
    <div class="partie-title">🏭 Entreprise Utilisatrice (EU)</div>
    <div class="partie-row"><span class="partie-label">Raison sociale :</span><span class="partie-val">${p.eu_nom || '—'}</span></div>
    <div class="partie-row"><span class="partie-label">Responsable :</span><span class="partie-val">${p.eu_contact || '—'}</span></div>
    <div class="partie-row"><span class="partie-label">Site :</span><span class="partie-val">${p.site || '—'}</span></div>
  </div>
  <div class="partie-box">
    <div class="partie-title">🤝 Entreprise Extérieure (ST)</div>
    <div class="partie-row"><span class="partie-label">Raison sociale :</span><span class="partie-val">${p.st_nom || '—'}</span></div>
    <div class="partie-row"><span class="partie-label">Responsable :</span><span class="partie-val">${p.st_contact || '—'}</span></div>
    ${p.sps_nom ? '<div class="partie-row" style="margin-top:8px;padding-top:8px;border-top:1px solid #E2E8F0"><span class="partie-label">👷 SPS :</span><span class="partie-val">' + p.sps_nom + (p.sps_contact ? ' · ' + p.sps_contact : '') + '</span></div>' : ''}
  </div>
</div>

<h2>2. Dates & informations intervention</h2>
<table>
  <tr><th>Début</th><th>Fin</th><th>Durée estimée</th><th>Nb travailleurs ST</th></tr>
  <tr><td>${fmt(p.date_debut)}</td><td>${fmt(p.date_fin)}</td><td>${p.duree_h ? p.duree_h + 'h' : '—'}</td><td>${p.nb_trav_st || '—'}</td></tr>
</table>

<h2>3. Travaux dangereux (Art. R4534-120)</h2>
${travDang.length ? '<div class="td-list">' + travDang.map(function(td) { return '<div class="td-item">🔥 ' + td + '</div>'; }).join('') + '</div>' : '<p style="color:#64748B;font-style:italic;font-size:11px">Aucun travail dangereux identifié pour cette intervention.</p>'}

<h2>4. Risques liés à la coactivité</h2>
${risques.length ? '<table><thead><tr><th>#</th><th>Risque identifié</th><th>Mesure de prévention associée</th></tr></thead><tbody>' + risqueRows + '</tbody></table>' : '<p style="color:#64748B;font-style:italic;font-size:11px">Aucun risque spécifique identifié.</p>'}

<h2>5. Mesures de prévention communes</h2>
<div class="mesures-box">${p.mesures || 'Non renseignées.'}</div>

<h2>6. Équipements de Protection Individuelle requis</h2>
${epi.length ? '<div class="td-list">' + epi.map(function(e) { return '<div class="epi-item">🦺 ' + e + '</div>'; }).join('') + '</div>' : '<p style="color:#64748B;font-style:italic;font-size:11px">Non renseignés.</p>'}

<h2>7. Liste des intervenants ST</h2>
${intervenants.length
  ? '<table><thead><tr><th>#</th><th>Nom Prénom</th><th>Poste / Qualification</th><th>Habilitations</th></tr></thead><tbody>' + intervenantRows + '</tbody></table>'
  : '<p style="color:#64748B;font-style:italic;font-size:11px">Aucun intervenant renseigné.</p>'}

${p.remarques ? '<h2>8. Remarques / Conditions particulières</h2><div class="mesures-box">' + p.remarques + '</div>' : ''}

<h2>${p.remarques ? '9' : '8'}. Signatures</h2>
${stampHtml || '<div class="sig-grid"><div class="sig-box"><div class="sig-role">🏭 Représentant EU</div><div class="sig-name">' + (p.eu_contact || '&nbsp;') + '</div><div class="sig-line"></div><div class="sig-date">Date : ___/___/______</div></div><div class="sig-box"><div class="sig-role">🤝 Représentant ST</div><div class="sig-name">' + (p.st_contact || '&nbsp;') + '</div><div class="sig-line"></div><div class="sig-date">Date : ___/___/______</div></div><div class="sig-box"><div class="sig-role">👷 Coordinateur SPS</div><div class="sig-name">' + (p.sps_nom || '&nbsp;') + '</div><div class="sig-line"></div><div class="sig-date">Date : ___/___/______</div></div><div class="sig-box"><div class="sig-role">🏢 Dirigeant</div><div class="sig-name">&nbsp;</div><div class="sig-line"></div><div class="sig-date">Date : ___/___/______</div></div></div>'}

<div class="footer">
  <span>SafetySphere — Plan de Prévention généré le ${now.toLocaleDateString('fr-FR')} à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
  <span>Réf. Art. R4512-6 à R4512-12 du Code du Travail</span>
</div>
</body></html>`;
}

// ── Archiver automatiquement le PdP avec le système report_archive ──
async function archivePdpReport(p) {
  var html = buildPdpHTML(p, '');
  var orgId = currentProfile.org_id;
  var num = 'PDP-' + new Date().getFullYear() + '-' + (p.st_nom || 'ST').substring(0, 6).toUpperCase().replace(/\s/g, '');
  var payload = {
    org_id:      orgId,
    created_by:  currentProfile.id,
    report_type: 'PDP',
    report_num:  num,
    report_label: 'Plan de Prévention — ' + (p.nature_travaux || ''),
    report_author: currentProfile.full_name || '',
    report_date:  new Date().toISOString().split('T')[0],
    report_html:  html,
    source:       'safetysphere',
    sig_status:   'none'
  };
  await sb.from('report_archive').insert(payload);
}


// ══════════════════════════════════════════════════════
// CATALOGUE KPI — Indicateurs de performance dynamiques
// ══════════════════════════════════════════════════════

const KPI_CATALOG = {
  worker: [
    { id:'kw-docs-total',    icon:'📄', name:'Total documents',         desc:'Nombre total de documents déposés',                                          color:'#6366F1',
      fetch: async function() { var r = await sb.from('documents').select('id',{count:'exact'}).eq('owner_id',currentUser.id); return { value: r.count||0, trend:null }; } },
    { id:'kw-docs-valid',    icon:'✅', name:'Documents validés',        desc:'Documents avec statut "validé"',                                            color:'#22C55E',
      fetch: async function() { var r = await sb.from('documents').select('id',{count:'exact'}).eq('owner_id',currentUser.id).eq('status','validated'); return { value:r.count||0, trend:null }; } },
    { id:'kw-docs-expiry60', icon:'📅', name:'Expirent dans 60j',        desc:'Documents arrivant à échéance dans les 60 prochains jours',                 color:'#F59E0B',
      fetch: async function() { var now=new Date(); var d60=new Date(); d60.setDate(d60.getDate()+60); var r=await sb.from('documents').select('expires_at').eq('owner_id',currentUser.id); var cnt=(r.data||[]).filter(function(d){return d.expires_at&&new Date(d.expires_at)>now&&new Date(d.expires_at)<d60;}).length; return {value:cnt,trend:null}; } },
    { id:'kw-shares-active', icon:'📤', name:'Partages actifs',          desc:'Nombre de documents partagés en cours',                                     color:'#14B8A6',
      fetch: async function() { var r=await sb.from('mission_doc_shares').select('id',{count:'exact'}).eq('worker_id',currentUser.id); return {value:r.count||0,trend:null}; } },
  ],
  company: [
    { id:'kc-workers-total',   icon:'👷', name:'Total intervenants',      desc:'Ensemble des intervenants liés à l\'entreprise',                           color:'#6366F1',
      fetch: async function() { var r=await sb.from('profiles').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id).eq('role','worker'); return {value:r.count||0,trend:null}; } },
    { id:'kc-docs-valid-pct',  icon:'📊', name:'Taux conformité docs',    desc:'% de documents société validés sur total attendu',                          color:'#22C55E',
      fetch: async function() { var r=await sb.from('documents').select('status').eq('owner_id',currentUser.id).eq('category','company'); var d=r.data||[]; var pct=d.length?Math.round(d.filter(function(x){return x.status==='validated';}).length/d.length*100):0; return {value:pct+'%',trend:null}; } },
    { id:'kc-st-total',        icon:'🤝', name:'Sous-traitants actifs',   desc:'Nombre de sociétés sous-traitantes liées',                                  color:'#A855F7',
      fetch: async function() { var r=await sb.from('organizations').select('id',{count:'exact'}).eq('parent_org_id',currentProfile.org_id); return {value:r.count||0,trend:null}; } },
    { id:'kc-duer-unites',     icon:'📋', name:'Unités DUER',             desc:'Nombre d\'unités de travail dans le DUER',                                  color:'#F97316',
      fetch: async function() { var r=await sb.from('duer_entries').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return {value:r.count||0,trend:null}; } },
    { id:'kc-duer-critiques',  icon:'🔴', name:'Risques critiques DUER',  desc:'Unités de travail avec criticité ≥ 12',                                    color:'#EF4444',
      fetch: async function() { var r=await sb.from('duer_entries').select('gravite,probabilite').eq('org_id',currentProfile.org_id); var cnt=(r.data||[]).filter(function(e){return e.gravite*e.probabilite>=12;}).length; return {value:cnt,trend:null}; } },
    { id:'kc-vgp-retard',      icon:'⏰', name:'VGP en retard',           desc:'Équipements dont la vérification réglementaire est dépassée',               color:'#EF4444',
      fetch: async function() {
        var records=await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id);
        var today=new Date(); var cnt=0;
        (records.data||[]).forEach(function(r){
          var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;});
          if(!eq||!r.derniere_verification) return;
          var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite);
          if(p<today) cnt++;
        });
        return {value:cnt,trend:null};
      } },
    { id:'kc-vgp-ok',          icon:'✅', name:'VGP à jour',              desc:'Équipements dont la vérification est en cours de validité',                 color:'#22C55E',
      fetch: async function() {
        var records=await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id);
        var today=new Date(); var cnt=0;
        (records.data||[]).forEach(function(r){
          var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;});
          if(!eq||!r.derniere_verification) return;
          var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite);
          if(p>=today) cnt++;
        });
        return {value:cnt,trend:null};
      } },
    { id:'kc-fds-total',       icon:'⚗️', name:'Produits FDS référencés', desc:'Nombre de produits chimiques dans la bibliothèque FDS',                    color:'#6366F1',
      fetch: async function() { var r=await sb.from('fds_library').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return {value:r.count||0,trend:null}; } },
    { id:'kc-fds-renouveler',  icon:'♻️', name:'FDS à renouveler',        desc:'FDS de plus de 3 ans nécessitant une mise à jour',                          color:'#F59E0B',
      fetch: async function() { var r=await sb.from('fds_library').select('version_date').eq('org_id',currentProfile.org_id); var limit=new Date(); limit.setFullYear(limit.getFullYear()-3); var cnt=(r.data||[]).filter(function(d){return d.version_date&&new Date(d.version_date)<limit;}).length; return {value:cnt,trend:null}; } },
  ],
  hse: [
    { id:'kh-st-total',        icon:'🏢', name:'Sociétés ST',             desc:'Nombre de sous-traitants dans le périmètre HSE',                           color:'#6366F1',
      fetch: async function() { var r=await sb.from('profiles').select('org_id',{count:'exact',head:true}).eq('role','company'); return {value:r.count||0,trend:null}; } },
    { id:'kh-duer-unites',     icon:'📋', name:'Unités DUER',             desc:'Unités de travail dans le DUER de l\'organisation',                         color:'#F97316',
      fetch: async function() { var r=await sb.from('duer_entries').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return {value:r.count||0,trend:null}; } },
    { id:'kh-duer-critiques',  icon:'🔴', name:'Risques critiques',       desc:'Risques DUER de criticité ≥ 12 nécessitant action prioritaire',            color:'#EF4444',
      fetch: async function() { var r=await sb.from('duer_entries').select('gravite,probabilite').eq('org_id',currentProfile.org_id); var cnt=(r.data||[]).filter(function(e){return e.gravite*e.probabilite>=12;}).length; return {value:cnt,trend:null}; } },
    { id:'kh-vgp-retard',      icon:'⏰', name:'VGP en retard',           desc:'Équipements réglementaires dont la vérification est dépassée',              color:'#EF4444',
      fetch: async function() {
        var records=await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id);
        var today=new Date(); var cnt=0;
        (records.data||[]).forEach(function(r){
          var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;});
          if(!eq||!r.derniere_verification) return;
          var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite);
          if(p<today) cnt++;
        });
        return {value:cnt,trend:null};
      } },
    { id:'kh-fds-total',       icon:'⚗️', name:'Produits chimiques',      desc:'Produits dans la bibliothèque FDS',                                         color:'#6366F1',
      fetch: async function() { var r=await sb.from('fds_library').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return {value:r.count||0,trend:null}; } },
  ],
  subcontractor: [
    { id:'ks-docs-total',      icon:'📄', name:'Documents totaux',        desc:'Documents déposés par l\'organisation',                                     color:'#6366F1',
      fetch: async function() { var r=await sb.from('documents').select('id',{count:'exact'}).eq('owner_id',currentUser.id); return {value:r.count||0,trend:null}; } },
    { id:'ks-workers-total',   icon:'👷', name:'Intervenants',             desc:'Nombre d\'intervenants dans l\'équipe',                                     color:'#F97316',
      fetch: async function() { var r=await sb.from('profiles').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id).eq('role','worker'); return {value:r.count||0,trend:null}; } },
    { id:'ks-eu-total',        icon:'🏭', name:'EU partenaires',           desc:'Entreprises utilisatrices partenaires',                                     color:'#A855F7',
      fetch: async function() { var r=await sb.from('mission_doc_shares').select('company_id').eq('st_org_id',currentProfile.org_id); var ids=new Set((r.data||[]).map(function(x){return x.company_id;})); return {value:ids.size,trend:null}; } },
  ],
  trainer: [
    { id:'kt-pending',         icon:'📋', name:'Demandes en attente',     desc:'Formations en attente de validation',                                       color:'#F59E0B',
      fetch: async function() { var r=await sb.from('documents').select('id',{count:'exact'}).eq('training_center_id',currentProfile.org_id).eq('center_status','pending'); return {value:r.count||0,trend:null}; } },
    { id:'kt-validated-month', icon:'✅', name:'Validations ce mois',     desc:'Formations validées au cours du mois en cours',                             color:'#22C55E',
      fetch: async function() { var start=new Date(); start.setDate(1); var r=await sb.from('documents').select('id',{count:'exact'}).eq('training_center_id',currentProfile.org_id).eq('center_status','validated').gte('updated_at',start.toISOString()); return {value:r.count||0,trend:null}; } },
    { id:'kt-stagiaires',      icon:'👷', name:'Stagiaires suivis',        desc:'Nombre de travailleurs avec formation en cours',                            color:'#6366F1',
      fetch: async function() { var r=await sb.from('documents').select('owner_id').eq('training_center_id',currentProfile.org_id); var ids=new Set((r.data||[]).map(function(x){return x.owner_id;})); return {value:ids.size,trend:null}; } },
  ],
};

var _kpiSelected = []; // IDs sélectionnés dans la modale

// ── Ouvrir la modale catalogue ─────────────────────────

// ══════════════════════════════════════════════════════════════
// CONFORM SECTIONS — KPI + LAST REPORT + LAYOUT PERSONALIZATION
// ══════════════════════════════════════════════════════════════

// ── Catalogue KPI par onglet conformité ──────────────────────
const CONFORM_KPI = {
  duer: [
    { id:'cd-unites',    icon:'📋', color:'#6366F1', name:'Unités de travail',  desc:'Unités dans le DUER',
      fetch: async function() { var r = await sb.from('duer_entries').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return r.count||0; } },
    { id:'cd-critiques', icon:'🔴', color:'#EF4444', name:'Risques critiques',  desc:'Criticité ≥ 12 (G×P)',
      fetch: async function() { var r = await sb.from('duer_entries').select('gravite,probabilite').eq('org_id',currentProfile.org_id); return (r.data||[]).filter(function(e){return e.gravite*e.probabilite>=12;}).length; } },
    { id:'cd-eleves',    icon:'🟡', color:'#F97316', name:'Risques élevés',     desc:'Criticité 6–11',
      fetch: async function() { var r = await sb.from('duer_entries').select('gravite,probabilite').eq('org_id',currentProfile.org_id); return (r.data||[]).filter(function(e){var c=e.gravite*e.probabilite;return c>=6&&c<12;}).length; } },
    { id:'cd-maitris',   icon:'✅', color:'#22C55E', name:'Risques maîtrisés',  desc:'Criticité < 6',
      fetch: async function() { var r = await sb.from('duer_entries').select('gravite,probabilite').eq('org_id',currentProfile.org_id); return (r.data||[]).filter(function(e){return e.gravite*e.probabilite<6;}).length; } },
    { id:'cd-rapports',  icon:'📁', color:'#A855F7', name:'Rapports archivés',  desc:'DUER générés et archivés',
      fetch: async function() { var r = await sb.from('report_archive').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id).eq('report_type','DUER'); return r.count||0; } },
  ],
  vgp: [
    { id:'cv-ok',        icon:'✅', color:'#22C55E', name:'À jour',             desc:'Vérifications valides',
      fetch: async function() { var records = await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id); var today=new Date(),cnt=0; (records.data||[]).forEach(function(r){var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;}); if(!eq||!r.derniere_verification)return; var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite); if(p>=today)cnt++;}); return cnt; } },
    { id:'cv-alerte',    icon:'⚠️', color:'#F59E0B', name:'Échéance < 30j',     desc:'À renouveler prochainement',
      fetch: async function() { var records = await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id); var today=new Date(),soon=new Date(); soon.setDate(soon.getDate()+30); var cnt=0; (records.data||[]).forEach(function(r){var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;}); if(!eq||!r.derniere_verification)return; var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite); if(p>=today&&p<soon)cnt++;}); return cnt; } },
    { id:'cv-retard',    icon:'🔴', color:'#EF4444', name:'En retard',          desc:'Vérifications dépassées',
      fetch: async function() { var records = await sb.from('registre_vgp').select('equipement,derniere_verification').eq('org_id',currentProfile.org_id); var today=new Date(),cnt=0; (records.data||[]).forEach(function(r){var eq=VGP_EQUIPEMENTS.find(function(e){return e.key===r.equipement;}); if(!eq||!r.derniere_verification)return; var p=new Date(r.derniere_verification); p.setMonth(p.getMonth()+eq.periodicite); if(p<today)cnt++;}); return cnt; } },
    { id:'cv-np',        icon:'⏸️', color:'#94A3B8', name:'Non planifiés',      desc:'Jamais saisis',
      fetch: async function() { var records = await sb.from('registre_vgp').select('equipement').eq('org_id',currentProfile.org_id); var saisis=new Set((records.data||[]).map(function(r){return r.equipement;})); return VGP_EQUIPEMENTS.filter(function(e){return !saisis.has(e.key);}).length; } },
    { id:'cv-rapports',  icon:'📁', color:'#A855F7', name:'Rapports archivés',  desc:'VGP générés et archivés',
      fetch: async function() { var r = await sb.from('report_archive').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id).eq('report_type','VGP'); return r.count||0; } },
  ],
  fds: [
    { id:'cf-total',     icon:'⚗️', color:'#6366F1', name:'Produits référencés',desc:'Fiches dans la bibliothèque',
      fetch: async function() { var r = await sb.from('fds_library').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return r.count||0; } },
    { id:'cf-renouveler',icon:'♻️', color:'#F59E0B', name:'À renouveler',       desc:'FDS de plus de 3 ans',
      fetch: async function() { var r = await sb.from('fds_library').select('version_date').eq('org_id',currentProfile.org_id); var lim=new Date(); lim.setFullYear(lim.getFullYear()-3); return (r.data||[]).filter(function(d){return d.version_date&&new Date(d.version_date)<lim;}).length; } },
    { id:'cf-ok',        icon:'✅', color:'#22C55E', name:'À jour',             desc:'FDS valides (< 3 ans)',
      fetch: async function() { var r = await sb.from('fds_library').select('version_date,fds_url').eq('org_id',currentProfile.org_id); var lim=new Date(); lim.setFullYear(lim.getFullYear()-3); return (r.data||[]).filter(function(d){return d.fds_url&&d.version_date&&new Date(d.version_date)>=lim;}).length; } },
    { id:'cf-manquantes',icon:'⚠️', color:'#EF4444', name:'FDS manquantes',     desc:'Sans document joint',
      fetch: async function() { var r = await sb.from('fds_library').select('fds_url').eq('org_id',currentProfile.org_id); return (r.data||[]).filter(function(d){return !d.fds_url;}).length; } },
  ],
  pdp: [
    { id:'cp-total',     icon:'📋', color:'#6366F1', name:'Total PdP',          desc:'Plans de prévention créés',
      fetch: async function() { var r = await sb.from('pdp_entries').select('id',{count:'exact'}).eq('org_id',currentProfile.org_id); return r.count||0; } },
    { id:'cp-encours',   icon:'🟢', color:'#22C55E', name:'En cours',           desc:'Interventions actives',
      fetch: async function() { var r = await sb.from('pdp_entries').select('date_debut,date_fin').eq('org_id',currentProfile.org_id); var t=new Date(); return (r.data||[]).filter(function(p){return p.date_debut&&p.date_fin&&new Date(p.date_debut)<=t&&new Date(p.date_fin)>=t;}).length; } },
    { id:'cp-avenir',    icon:'⏳', color:'#F59E0B', name:'À venir',            desc:'Interventions planifiées',
      fetch: async function() { var r = await sb.from('pdp_entries').select('date_debut').eq('org_id',currentProfile.org_id); var t=new Date(); return (r.data||[]).filter(function(p){return p.date_debut&&new Date(p.date_debut)>t;}).length; } },
    { id:'cp-termines',  icon:'✅', color:'#94A3B8', name:'Terminés',           desc:'Interventions closes',
      fetch: async function() { var r = await sb.from('pdp_entries').select('date_fin').eq('org_id',currentProfile.org_id); var t=new Date(); return (r.data||[]).filter(function(p){return p.date_fin&&new Date(p.date_fin)<t;}).length; } },
    { id:'cp-dangereux', icon:'☢️', color:'#EF4444', name:'Travaux dangereux',  desc:'PdP avec travaux listés R4512',
      fetch: async function() { var r = await sb.from('pdp_entries').select('travaux_dangereux').eq('org_id',currentProfile.org_id); return (r.data||[]).filter(function(p){return Array.isArray(p.travaux_dangereux)&&p.travaux_dangereux.length>0;}).length; } },
  ],
};

// ── Clé localStorage préférences par user + onglet ───────────
function _conformPrefKey(tab) {
  var uid = currentUser && currentUser.id ? currentUser.id.slice(0,8) : 'anon';
  return 'ss_conform_pref_' + uid + '_' + tab;
}

// Valeur par défaut : KPI activés = tous, order = [kpi, lastReport, content]
function getConformPrefs(tab) {
  var key = _conformPrefKey(tab);
  try {
    var raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  var catalog = CONFORM_KPI[tab] || [];
  return {
    order: ['kpi', 'lastReport', 'content'],
    kpiVisible: catalog.map(function(k){ return k.id; }),
    showKpi: true,
    showLastReport: true,
  };
}

function saveConformPrefs(tab, prefs) {
  try { localStorage.setItem(_conformPrefKey(tab), JSON.stringify(prefs)); } catch(e) {}
}

// ── Rendre la bande KPI d'un onglet ──────────────────────────
async function renderConformKpiStrip(tab, containerId) {
  var ctn = document.getElementById(containerId);
  if (!ctn) return;
  var prefs   = getConformPrefs(tab);
  var catalog = (CONFORM_KPI[tab] || []).filter(function(k){ return prefs.kpiVisible.indexOf(k.id) >= 0; });
  if (!catalog.length) { ctn.innerHTML = ''; return; }

  // Squelette instantané
  ctn.innerHTML = '<div class="conform-kpi-strip">'
    + catalog.map(function(k) {
        return '<div class="conform-kpi-card" id="ckpi-' + k.id + '">'
          + '<div class="conform-kpi-top"><span class="conform-kpi-icon">' + k.icon + '</span>'
          + '<span class="conform-kpi-name">' + escapeHtml(k.name) + '</span></div>'
          + '<div class="conform-kpi-value" style="color:' + k.color + '">…</div>'
          + '<div class="conform-kpi-desc">' + escapeHtml(k.desc) + '</div>'
          + '</div>';
      }).join('')
    + '</div>';

  // Charger les valeurs en parallèle
  catalog.forEach(function(k) {
    k.fetch().then(function(val) {
      var el = document.getElementById('ckpi-' + k.id);
      if (el) el.querySelector('.conform-kpi-value').textContent = val !== undefined ? val : '—';
    }).catch(function() {
      var el = document.getElementById('ckpi-' + k.id);
      if (el) el.querySelector('.conform-kpi-value').textContent = '—';
    });
  });
}

// ── Rendre la bande "Dernier rapport" ────────────────────────
async function renderConformLastReport(reportType, containerId) {
  var ctn = document.getElementById(containerId);
  if (!ctn) return;
  ctn.innerHTML = '';

  var res = await sb.from('report_archive')
    .select('*')
    .eq('org_id', currentProfile.org_id)
    .eq('report_type', reportType)
    .is('parent_id', null)
    .order('generated_at', { ascending: false })
    .limit(1);

  var a = res.data && res.data[0];
  if (!a) return;

  var genDate  = new Date(a.generated_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});
  var genTime  = new Date(a.generated_at).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  var sigSt    = a.sig_status || 'none';
  var sigBadge = sigSt === 'signed_all' ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,.12);color:#4ADE80;border:1px solid rgba(34,197,94,.25)">✅ Tous signés</span>'
    : sigSt === 'pending'               ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.12);color:#FCD34D;border:1px solid rgba(245,158,11,.25)">⏳ ' + (a.sig_signed||0) + '/' + (a.sig_total||'?') + '</span>'
    : sigSt === 'refused'               ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(239,68,68,.12);color:#FCA5A5;border:1px solid rgba(239,68,68,.25)">❌ Refusé</span>'
    : '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(148,163,184,.1);color:var(--muted);border:1px solid rgba(148,163,184,.2)">Non envoyé</span>';

  var consultUrl = a.signed_file_url || a.file_url;
  var consultBtn = consultUrl
    ? '<button class="btn-sm btn-view" style="font-size:11px;padding:5px 12px" onclick="openReportViewer(\'' + consultUrl.replace(/'/g,"\\'") + '\',\'' + escapeHtml(a.report_num||reportType) + '\',\'ext\',\'' + a.id + '\')">📄 Consulter</button>'
    : '';
  var sendBtn = (!sigSt || sigSt === 'none')
    ? '<button class="btn-sm" style="font-size:11px;padding:5px 12px;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.25);color:#FCD34D" onclick="openSendForSignatureModal(\'' + a.id + '\',\'' + escapeHtml(a.report_num||'') + '\',\'' + reportType + '\',null,null)">✉️ Envoyer</button>'
    : '';

  ctn.innerHTML = '<div class="conform-last-report">'
    + '<span class="conform-last-report-label">Dernier rapport</span>'
    + '<div class="conform-last-report-info">'
    + '<div class="conform-last-report-ref">' + escapeHtml(a.report_num || '—') + '</div>'
    + '<div class="conform-last-report-sub">' + genDate + ' à ' + genTime + ' · ' + escapeHtml(a.responsable || '—') + ' ' + sigBadge + '</div>'
    + '</div>'
    + '<div class="conform-last-report-actions">' + consultBtn + sendBtn + '</div>'
    + '</div>';
}

// ── Panneau personnalisation (toggle inline) ──────────────────
var _conformPersoOpen = {};

function toggleConformPerso(tab, role) {
  var panelId = 'conform-perso-panel-' + tab + '-' + role;
  var existing = document.getElementById(panelId);
  if (existing) {
    existing.remove();
    _conformPersoOpen[tab + role] = false;
    return;
  }
  _conformPersoOpen[tab + role] = true;

  var prefs   = getConformPrefs(tab);
  var catalog = CONFORM_KPI[tab] || [];

  // Noms lisibles pour les blocs
  var BLOCK_LABELS = { kpi: '📊 Indicateurs (KPI)', lastReport: '📄 Dernier rapport généré', content: '📋 Contenu principal' };

  var panel = document.createElement('div');
  panel.className = 'conform-perso-panel';
  panel.id = panelId;


  // ── Section ordre des blocs ──
  var blocksHtml = '<div class="conform-perso-section-label">Ordre des sections</div>'
    + '<div class="conform-perso-blocks" id="conform-blocks-' + tab + '-' + role + '">';
  prefs.order.forEach(function(b) {
    var isOn = b === 'kpi' ? prefs.showKpi : b === 'lastReport' ? prefs.showLastReport : true;
    var isTogglable = b !== 'content';
    var toggleHtml = isTogglable
      ? '<button class="conform-perso-block-toggle ' + (isOn ? 'on' : '') + '" data-tab="' + tab + '" data-role="' + role + '" data-block="' + b + '" onclick="conformToggleBlockEl(this)">' + (isOn ? '✓ Visible' : '✕ Masqué') + '</button>'
      : '<span style="font-size:11px;color:var(--muted);padding:3px 8px">Toujours visible</span>';
    blocksHtml += '<div class="conform-perso-block" draggable="true" data-block="' + b + '">'
      + '<span class="conform-perso-block-handle">⠿</span>'
      + '<span class="conform-perso-block-name">' + BLOCK_LABELS[b] + '</span>'
      + toggleHtml
      + '</div>';
  });
  blocksHtml += '</div>';

  // ── Section KPI à afficher ──
  var kpiHtml = '';
  if (catalog.length) {
    kpiHtml = '<div class="conform-perso-section-label" style="margin-top:16px">Indicateurs à afficher</div>'
      + '<div class="conform-kpi-checkgrid">';
    catalog.forEach(function(k) {
      var active = prefs.kpiVisible.indexOf(k.id) >= 0;
      kpiHtml += '<div class="conform-kpi-check ' + (active ? 'active' : '') + '" data-tab="' + tab + '" data-role="' + role + '" data-kpi="' + k.id + '" onclick="conformToggleKpiEl(this)">'
        + '<span class="conform-kpi-check-icon">' + k.icon + '</span>'
        + '<span class="conform-kpi-check-lbl"><div class="conform-kpi-check-name">' + escapeHtml(k.name) + '</div>'
        + '<div class="conform-kpi-check-desc">' + escapeHtml(k.desc) + '</div></span>'
        + '<span class="conform-kpi-check-tick">' + (active ? '✓' : '○') + '</span>'
        + '</div>';
    });
    kpiHtml += '</div>';
  }

  var closeBtnId = 'cperso-close-' + tab + '-' + role;
  var applyBtnId = 'cperso-apply-' + tab + '-' + role;
  var resetBtnId = 'cperso-reset-' + tab + '-' + role;
  panel.innerHTML = '<div class="conform-perso-title">✏️ Personnaliser cet onglet'
    + '<button id="' + closeBtnId + '" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:16px;color:var(--muted)">✕</button>'
    + '</div>'
    + blocksHtml + kpiHtml
    + '<div style="display:flex;gap:8px;margin-top:16px">'
    + '<button id="' + applyBtnId + '" class="btn-sm btn-validate" style="flex:1">✓ Appliquer</button>'
    + '<button id="' + resetBtnId + '" class="btn-sm" style="color:var(--muted)">↺ Réinitialiser</button>'
    + '</div>';

  // Insérer avant le contenu principal
  var ctn = document.getElementById(role + '-conform-' + tab);
  if (ctn) ctn.insertBefore(panel, ctn.firstChild);

  // Wire up buttons after DOM insertion
  document.getElementById(closeBtnId).onclick = function() { panel.remove(); };
  document.getElementById(applyBtnId).onclick = function() { saveConformPersoAndRefresh(tab, role); };
  document.getElementById(resetBtnId).onclick = function() { resetConformPrefs(tab, role); };

  // Drag & drop ordre blocs
  initConformBlockDrag(tab, role);
}

function conformToggleBlockEl(btn) {
  var tab = btn.dataset.tab, role = btn.dataset.role, blockName = btn.dataset.block;
  conformToggleBlock(tab, role, blockName, btn);
}

function conformToggleKpiEl(card) {
  var tab = card.dataset.tab, role = card.dataset.role, kpiId = card.dataset.kpi;
  conformToggleKpi(tab, role, kpiId, card);
}


function conformToggleBlock(tab, role, blockName, btn) {
  var prefs = getConformPrefs(tab);
  if (blockName === 'kpi')        { prefs.showKpi = !prefs.showKpi; }
  if (blockName === 'lastReport') { prefs.showLastReport = !prefs.showLastReport; }
  var isOn = blockName === 'kpi' ? prefs.showKpi : prefs.showLastReport;
  btn.textContent = isOn ? '✓ Visible' : '✕ Masqué';
  btn.classList.toggle('on', isOn);
  saveConformPrefs(tab, prefs);
}

function conformToggleKpi(tab, role, kpiId, card) {
  var prefs = getConformPrefs(tab);
  var idx   = prefs.kpiVisible.indexOf(kpiId);
  if (idx >= 0) prefs.kpiVisible.splice(idx, 1);
  else          prefs.kpiVisible.push(kpiId);
  card.classList.toggle('active', idx < 0);
  var tick = card.querySelector('.conform-kpi-check-tick');
  if (tick) tick.textContent = idx < 0 ? '✓' : '○';
  saveConformPrefs(tab, prefs);
}

function saveConformPersoAndRefresh(tab, role) {
  // L'ordre est lu depuis le DOM (drag & drop peut l'avoir modifié)
  var blocksEl = document.getElementById('conform-blocks-' + tab + '-' + role);
  if (blocksEl) {
    var prefs = getConformPrefs(tab);
    var newOrder = [];
    blocksEl.querySelectorAll('.conform-perso-block').forEach(function(b) { newOrder.push(b.dataset.block); });
    prefs.order = newOrder;
    saveConformPrefs(tab, prefs);
  }
  // Fermer le panel et re-render
  var panelId = 'conform-perso-panel-' + tab + '-' + role;
  var p = document.getElementById(panelId);
  if (p) p.remove();
  _conformPersoOpen[tab + role] = false;

  if (tab === 'duer')       renderDuerSection(role);
  else if (tab === 'vgp')   renderVgpSection(role);
  else if (tab === 'fds')   renderFdsSection(role);
  else if (tab === 'pdp')   renderPdpSection(role);
}

function resetConformPrefs(tab, role) {
  try { localStorage.removeItem(_conformPrefKey(tab)); } catch(e) {}
  saveConformPersoAndRefresh(tab, role);
}

// Drag & drop pour réordonner les blocs
function initConformBlockDrag(tab, role) {
  var container = document.getElementById('conform-blocks-' + tab + '-' + role);
  if (!container) return;
  var dragged = null;
  container.querySelectorAll('.conform-perso-block').forEach(function(block) {
    block.addEventListener('dragstart', function() { dragged = block; setTimeout(function(){ block.style.opacity='.4'; }, 0); });
    block.addEventListener('dragend',   function() { block.style.opacity=''; dragged = null; container.querySelectorAll('.conform-perso-block').forEach(function(b){ b.classList.remove('drag-over-block'); }); });
    block.addEventListener('dragover',  function(e) { e.preventDefault(); container.querySelectorAll('.conform-perso-block').forEach(function(b){ b.classList.remove('drag-over-block'); }); block.classList.add('drag-over-block'); });
    block.addEventListener('drop',      function(e) { e.preventDefault(); if (dragged && dragged !== block) { var allBlocks = [...container.querySelectorAll('.conform-perso-block')]; var fromIdx = allBlocks.indexOf(dragged); var toIdx   = allBlocks.indexOf(block); if (fromIdx < toIdx) container.insertBefore(dragged, block.nextSibling); else container.insertBefore(dragged, block); } block.classList.remove('drag-over-block'); });
  });
}

// ── Injecteur de blocs dans une section ──────────────────────
// Appelé par chaque render*Section AVANT le rendu du contenu.
// Retourne { kpiId, lastReportId, order } pour positionner les divs
function buildConformSectionHeader(tab, role, reportType, actionBtnsHtml, title, subtitle) {
  var prefs = getConformPrefs(tab);
  var containerId = role + '-conform-' + tab;

  // Construction des IDs
  var kpiId        = 'conform-kpi-' + tab + '-' + role;
  var lastRptId    = 'conform-lastrpt-' + tab + '-' + role;
  var inlineHistId = tab + '-inline-history-' + role;

  // Bouton personnaliser
  var persoBtn = '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(148,163,184,.1);border-color:rgba(148,163,184,.2);color:var(--muted)" data-tab="' + tab + '" data-role="' + role + '" onclick="toggleConformPerso(this.dataset.tab,this.dataset.role)">✏️ Personnaliser</button>';

  // Header section (titre + boutons actions)
  var headerHtml = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px">'
    + '<div><div class="section-title" style="margin:0">' + title + '</div>'
    + '<div style="font-size:12px;color:var(--muted);margin-top:4px">' + subtitle + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap">' + actionBtnsHtml + persoBtn + '</div>'
    + '</div>';

  // Blocs ordonnés selon préfs
  var blocksHtml = '';
  prefs.order.forEach(function(b) {
    if (b === 'kpi' && prefs.showKpi)               blocksHtml += '<div id="' + kpiId + '"></div>';
    if (b === 'lastReport' && prefs.showLastReport)  blocksHtml += '<div id="' + lastRptId + '"></div>';
    if (b === 'content')                             blocksHtml += '<div id="conform-content-' + tab + '-' + role + '"></div>';
  });

  return { html: headerHtml + blocksHtml, kpiId, lastRptId, contentId: 'conform-content-' + tab + '-' + role, inlineHistId };
}

var _lastArchivedId = null;
