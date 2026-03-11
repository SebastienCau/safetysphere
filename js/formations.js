// ════════════════════════════════════════════════════════════════════════════
//  SAFETYSPHERE — MODULE FORMATIONS v1.0
//  Gestion des formations & habilitations
// ════════════════════════════════════════════════════════════════════════════
//
//  ORDRE DE CHARGEMENT dans index.html :
//  core → analytics → workers → signatures → reports → conformite →
//  analytics_charts → chart → incidents → formations → gate
//
// ════════════════════════════════════════════════════════════════════════════

var _frmSubView     = 'catalogue';
var _frmList        = [];
var _frmParticipants = [];
var _frmEditId      = null;

// ── Constantes ───────────────────────────────────────────────────────────────
var FRM_TYPES = [
  { id: 'securite',     label: 'Sécurité',               icon: '🦺', color: '#F87171' },
  { id: 'habilitation', label: 'Habilitation électrique', icon: '⚡', color: '#FCD34D' },
  { id: 'caces',        label: 'CACES / Engins',          icon: '🏗️', color: '#F97316' },
  { id: 'incendie',     label: 'Incendie / SST',          icon: '🔥', color: '#EF4444' },
  { id: 'chimique',     label: 'Risque chimique',         icon: '⚗️', color: '#A78BFA' },
  { id: 'travaux_haut', label: 'Travail en hauteur',      icon: '🧗', color: '#60A5FA' },
  { id: 'premiers_sec', label: 'Premiers secours',        icon: '🩺', color: '#34D399' },
  { id: 'autre',        label: 'Autre',                   icon: '📚', color: '#94A3B8' }
];

var FRM_STATUS = [
  { id: 'planifiee', label: 'Planifiée',  color: '#60A5FA' },
  { id: 'en_cours',  label: 'En cours',   color: '#F97316' },
  { id: 'terminee',  label: 'Terminée',   color: '#4ADE80' },
  { id: 'annulee',   label: 'Annulée',    color: '#64748B' }
];

var FRM_RESULT = [
  { id: 'en_attente', label: 'En attente', color: '#F97316' },
  { id: 'obtenu',     label: 'Obtenu',     color: '#4ADE80' },
  { id: 'recale',     label: 'Recalé',     color: '#EF4444' },
];

// ── Activation ───────────────────────────────────────────────────────────────
async function checkFormationsActivation() {
  if (!currentProfile || !currentProfile.org_id) { updateFormationsTabVisibility(true); return true; }
  var res = await sb.from('org_modules')
    .select('enabled')
    .eq('org_id', currentProfile.org_id)
    .eq('module_id', 'formations')
    .maybeSingle();
  // Par defaut actif si aucun enregistrement
  var enabled = (res.data === null) ? true : res.data.enabled;
  updateFormationsTabVisibility(enabled);
  return enabled;
}

function updateFormationsTabVisibility(visible) {
  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    var oc = tab.getAttribute('onclick') || '';
    if (oc.includes("'formations'") || oc.includes('"formations"')) {
      tab.style.display = '';
      var dot = tab.querySelector('.frm-dot');
      if (!dot) {
        dot = document.createElement('span');
        dot.className = 'frm-dot';
        dot.style.cssText = 'display:inline-block;width:6px;height:6px;border-radius:50%;margin-left:5px;vertical-align:middle';
        tab.appendChild(dot);
      }
      dot.style.background = visible ? '#818CF8' : '#475569';
    }
  });
}

// ── Chargement ───────────────────────────────────────────────────────────────
async function loadFormations(role) {
  var dash = role === 'hse' ? 'HSE' : role === 'company' ? 'Company' : null;
  if (!dash) return;
  var container = document.getElementById(dash + '-formations-content');
  if (!container) return;

  if (!currentProfile || !currentProfile.org_id) {
    container.innerHTML = _frmEmpty('⚠️', 'Session expirée — veuillez vous reconnecter');
    return;
  }

  container.innerHTML = _frmEmpty('⏳', 'Chargement…');

  try {
    var orgId = currentProfile.org_id;
    var [frmRes, partRes] = await Promise.all([
      sb.from('formations').select('*').eq('org_id', orgId).order('date_debut', { ascending: false }).limit(200),
      sb.from('formation_participants').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
    ]);
    if (frmRes.error) throw frmRes.error;
    _frmList         = frmRes.data  || [];
    _frmParticipants = partRes.data || [];
    renderFormations(role);
  } catch(e) {
    container.innerHTML = _frmEmpty('⚠️', 'Erreur : ' + (e.message || e));
  }
}

// ── Rendu principal ───────────────────────────────────────────────────────────
function renderFormations(role) {
  var dash = role === 'hse' ? 'HSE' : 'Company';
  var container = document.getElementById(dash + '-formations-content');
  if (!container) return;

  var total      = _frmList.length;
  var planifiees = _frmList.filter(function(f){ return f.status === 'planifiee'; }).length;
  var expiring   = _frmExpirantsCount();

  var html = '';

  // Nav
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap">';
  html += _frmNavBtn('catalogue',     '📋 Catalogue',      role);
  html += _frmNavBtn('nouvelle',      '➕ Nouvelle',        role);
  html += _frmNavBtn('habilitations', '🏅 Habilitations',  role, expiring);
  html += _frmNavBtn('stats',         '📈 Statistiques',   role);
  html += '<div style="margin-left:auto;display:flex;gap:10px;align-items:center">';
  if (planifiees) html += '<span style="font-size:11px;color:#60A5FA;font-weight:700">' + planifiees + ' planifiée' + (planifiees > 1 ? 's' : '') + '</span>';
  if (total > 0)  html += '<button onclick="exportFormationsCSV(\'' + role + '\')" style="padding:5px 12px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.25);border-radius:8px;color:#818CF8;font-size:11px;font-weight:700;cursor:pointer">⬇ CSV</button>';
  html += '</div></div>';

  if (_frmSubView === 'catalogue')     html += _frmRenderCatalogue(role);
  if (_frmSubView === 'nouvelle')      html += _frmRenderForm(role, _frmEditId ? _frmList.find(function(f){ return f.id === _frmEditId; }) : null);
  if (_frmSubView === 'habilitations') html += _frmRenderHabilitations(role);
  if (_frmSubView === 'stats')         html += _frmRenderStats(role);

  try { container.innerHTML = html; } catch(e) {
    container.innerHTML = _frmEmpty('⚠️', 'Erreur : ' + e.message); return;
  }

  if (_frmSubView === 'stats') requestAnimationFrame(_drawFrmChart);
}

// ── Catalogue ─────────────────────────────────────────────────────────────────
function _frmRenderCatalogue(role) {
  if (_frmList.length === 0) {
    return _frmEmpty('🎓', 'Aucune formation enregistrée')
      + '<div style="text-align:center;margin-top:-20px"><button onclick="_frmGo(\'nouvelle\',\'' + role + '\')" style="padding:10px 24px;background:rgba(129,140,248,.15);border:1px solid rgba(129,140,248,.3);border-radius:10px;color:#818CF8;font-weight:700;cursor:pointer">➕ Créer la première</button></div>';
  }

  var html = '<div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">';
  html += '<select id="frmFType" onchange="filterFormations(\'' + role + '\')" style="' + _frmSel() + '"><option value="">Tous types</option>';
  FRM_TYPES.forEach(function(t){ html += '<option value="' + t.id + '">' + t.icon + ' ' + t.label + '</option>'; });
  html += '</select>';
  html += '<select id="frmFStatus" onchange="filterFormations(\'' + role + '\')" style="' + _frmSel() + '"><option value="">Tous statuts</option>';
  FRM_STATUS.forEach(function(s){ html += '<option value="' + s.id + '">' + s.label + '</option>'; });
  html += '</select>';
  html += '<input type="month" id="frmFMonth" onchange="filterFormations(\'' + role + '\')" style="' + _frmSel() + '">';
  html += '</div>';
  html += '<div id="frmTable">' + _frmBuildTable(_frmList, role) + '</div>';
  return html;
}

function _frmBuildTable(list, role) {
  if (!list.length) return _frmEmpty('🔍', 'Aucun résultat');
  var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">';
  html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
  ['Intitulé','Type','Date','Durée','Organisme','Participants','Validité','Statut',''].forEach(function(h){
    html += '<th style="padding:9px 11px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted);white-space:nowrap">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';

  list.forEach(function(f) {
    var type   = FRM_TYPES.find(function(t){ return t.id === f.type; }) || FRM_TYPES[FRM_TYPES.length-1];
    var status = FRM_STATUS.find(function(s){ return s.id === f.status; }) || FRM_STATUS[0];
    var dateD  = f.date_debut ? new Date(f.date_debut).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) : '—';
    var nb     = _frmParticipants.filter(function(p){ return p.formation_id === f.id; }).length;

    var expTxt = '—'; var expWarn = '';
    if (f.echeance_mois && f.date_fin) {
      var exp = new Date(f.date_fin); exp.setMonth(exp.getMonth() + parseInt(f.echeance_mois));
      var days = Math.round((exp - new Date()) / 86400000);
      expTxt = f.echeance_mois + ' mois';
      if (days < 0)       expWarn = '<span style="color:#EF4444;font-size:10px;font-weight:700"> ⚠ Exp.</span>';
      else if (days < 60) expWarn = '<span style="color:#F97316;font-size:10px;font-weight:700"> J-' + days + '</span>';
    }

    html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04)" onmouseover="this.style.background=\'rgba(255,255,255,.03)\'" onmouseout="this.style.background=\'\'">';
    html += '<td style="padding:9px 11px;font-weight:600">' + _esc(f.intitule) + '</td>';
    html += '<td style="padding:9px 11px"><span style="padding:2px 7px;border-radius:5px;background:' + type.color + '18;color:' + type.color + ';font-size:11px;font-weight:700">' + type.icon + ' ' + type.label + '</span></td>';
    html += '<td style="padding:9px 11px;color:var(--muted);font-size:12px;white-space:nowrap">' + dateD + '</td>';
    html += '<td style="padding:9px 11px;color:var(--muted);font-size:12px">' + (f.duree_heures ? f.duree_heures + 'h' : '—') + '</td>';
    html += '<td style="padding:9px 11px;color:var(--muted);font-size:12px">' + _esc(f.organisme || f.formateur_externe || '—') + '</td>';
    html += '<td style="padding:9px 11px"><span style="padding:2px 7px;border-radius:5px;background:rgba(129,140,248,.12);color:#818CF8;font-size:12px;font-weight:700">' + nb + '</span></td>';
    html += '<td style="padding:9px 11px;font-size:12px">' + expTxt + expWarn + '</td>';
    html += '<td style="padding:9px 11px"><span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;background:' + status.color + '22;color:' + status.color + '">' + status.label + '</span></td>';
    html += '<td style="padding:9px 11px"><div style="display:flex;gap:5px">';
    html += '<button onclick="openFrmDetail(\'' + f.id + '\',\'' + role + '\')" style="padding:3px 9px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:5px;font-size:11px;cursor:pointer">👁</button>';
    if (role !== 'worker') html += '<button onclick="openFrmEdit(\'' + f.id + '\',\'' + role + '\')" style="padding:3px 9px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);border-radius:5px;color:#818CF8;font-size:11px;cursor:pointer">✏️</button>';
    html += '</div></td></tr>';
  });

  html += '</tbody></table></div>';
  return html;
}

// ── Formulaire ────────────────────────────────────────────────────────────────
function _frmRenderForm(role, d) {
  d = d || {};
  var isEdit = !!d.id;
  var html = '<div style="max-width:740px"><div style="background:linear-gradient(135deg,rgba(129,140,248,.08),rgba(99,102,241,.04));border:1px solid rgba(129,140,248,.15);border-radius:20px;padding:28px">';
  html += '<div style="font-size:18px;font-weight:800;margin-bottom:20px">' + (isEdit ? '✏️ Modifier la formation' : '🎓 Nouvelle formation') + '</div>';

  html += '<div style="margin-bottom:14px"><label style="' + _frmLbl() + '">Intitulé *</label><input type="text" id="frmIntitule" placeholder="Ex : CACES R489 cat.3, Habilitation B1V…" value="' + _esc(d.intitule) + '" style="' + _frmInp() + '"></div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label style="' + _frmLbl() + '">Type *</label><select id="frmType" style="' + _frmInp() + '">' + FRM_TYPES.map(function(t){ return '<option value="' + t.id + '"' + (d.type===t.id?' selected':'') + '>' + t.icon + ' ' + t.label + '</option>'; }).join('') + '</select></div>';
  html += '<div><label style="' + _frmLbl() + '">Statut</label><select id="frmStatus" style="' + _frmInp() + '">' + FRM_STATUS.map(function(s){ return '<option value="' + s.id + '"' + ((d.status||'planifiee')===s.id?' selected':'') + '>' + s.label + '</option>'; }).join('') + '</select></div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label style="' + _frmLbl() + '">Date début *</label><input type="date" id="frmDateDebut" value="' + _esc(d.date_debut ? d.date_debut.slice(0,10) : '') + '" style="' + _frmInp() + '"></div>';
  html += '<div><label style="' + _frmLbl() + '">Date fin</label><input type="date" id="frmDateFin" value="' + _esc(d.date_fin ? d.date_fin.slice(0,10) : '') + '" style="' + _frmInp() + '"></div>';
  html += '<div><label style="' + _frmLbl() + '">Durée (heures)</label><input type="number" id="frmDuree" min="0" step="0.5" placeholder="Ex : 7" value="' + _esc(d.duree_heures) + '" style="' + _frmInp() + '"></div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label style="' + _frmLbl() + '">Formateur / Organisme</label><input type="text" id="frmOrganisme" placeholder="Nom ou organisme" value="' + _esc(d.organisme || d.formateur_externe) + '" style="' + _frmInp() + '"></div>';
  html += '<div><label style="' + _frmLbl() + '">Lieu</label><input type="text" id="frmLieu" placeholder="Ex : Salle B, Site client…" value="' + _esc(d.lieu) + '" style="' + _frmInp() + '"></div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">';
  html += '<div><label style="' + _frmLbl() + '">Validité</label><select id="frmEcheance" style="' + _frmInp() + '"><option value="">Sans échéance</option>' + [6,12,18,24,36,48,60].map(function(m){ return '<option value="' + m + '"' + (d.echeance_mois==m?' selected':'') + '>' + m + ' mois</option>'; }).join('') + '</select></div>';
  html += '<div><label style="' + _frmLbl() + '">Numéro de certificat</label><input type="text" id="frmCertif" placeholder="Ex : CERTIOP-2024-001" value="' + _esc(d.numero_certif) + '" style="' + _frmInp() + '"></div>';
  html += '</div>';

  html += '<div style="margin-bottom:20px"><label style="' + _frmLbl() + '">Description / Objectifs</label><textarea id="frmDesc" rows="3" style="' + _frmInp() + 'resize:vertical">' + _esc(d.description) + '</textarea></div>';

  if (isEdit) {
    html += _frmParticipantsSection(d.id, role);
  } else {
    html += '<div style="background:rgba(129,140,248,.05);border:1px solid rgba(129,140,248,.1);border-radius:10px;padding:12px 14px;margin-bottom:18px;font-size:12px;color:var(--muted)">💡 Après création, ajoutez les participants depuis le détail de la formation.</div>';
  }

  html += '<div style="display:flex;gap:10px">';
  html += '<button onclick="_saveFrm(\'' + role + '\'' + (isEdit ? ',\'' + d.id + '\'' : '') + ')" style="padding:11px 26px;background:rgba(129,140,248,.2);border:1px solid rgba(129,140,248,.4);border-radius:10px;color:#818CF8;font-weight:700;cursor:pointer;font-size:14px">' + (isEdit ? '💾 Enregistrer' : '🎓 Créer') + '</button>';
  html += '<button onclick="_frmGo(\'catalogue\',\'' + role + '\')" style="padding:11px 18px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:var(--muted);font-weight:700;cursor:pointer">Annuler</button>';
  html += '</div></div></div>';
  return html;
}

function _frmParticipantsSection(formationId, role) {
  var parts = _frmParticipants.filter(function(p){ return p.formation_id === formationId; });
  var html = '<div style="margin-bottom:18px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
  html += '<div style="font-size:13px;font-weight:700">👥 Participants (' + parts.length + ')</div>';
  html += '<button onclick="openAddParticipantModal(\'' + formationId + '\',\'' + role + '\')" style="padding:4px 11px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);border-radius:7px;color:#818CF8;font-size:11px;font-weight:700;cursor:pointer">➕ Ajouter</button>';
  html += '</div>';
  if (!parts.length) {
    html += '<div style="padding:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:8px;text-align:center;color:var(--muted);font-size:12px">Aucun participant</div>';
  } else {
    html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:10px;overflow:hidden">';
    parts.forEach(function(p, i) {
      var r = FRM_RESULT.find(function(r){ return r.id === p.result; });
      html += '<div style="padding:9px 13px;display:flex;align-items:center;gap:10px' + (i > 0 ? ';border-top:1px solid rgba(255,255,255,.04)' : '') + '">';
      html += '<div style="flex:1;font-size:13px;font-weight:600">' + _esc(p.nom_participant || '—') + '</div>';
      if (p.poste) html += '<span style="font-size:11px;color:var(--muted)">' + _esc(p.poste) + '</span>';
      if (r) html += '<span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;background:' + r.color + '22;color:' + r.color + '">' + r.label + '</span>';
      if (p.attestation_url) html += '<a href="' + _esc(p.attestation_url) + '" target="_blank" style="padding:2px 7px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.2);border-radius:5px;color:#4ADE80;font-size:11px;text-decoration:none">📄</a>';
      html += '<select onchange="updateParticipantResult(\'' + p.id + '\',this.value,\'' + role + '\')" style="padding:3px 7px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:5px;color:var(--text);font-size:11px">';
      FRM_RESULT.forEach(function(r2){ html += '<option value="' + r2.id + '"' + (p.result===r2.id?' selected':'') + '>' + r2.label + '</option>'; });
      html += '</select>';
      html += '<button onclick="removeParticipant(\'' + p.id + '\',\'' + formationId + '\',\'' + role + '\')" style="padding:2px 7px;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.15);border-radius:5px;color:#EF4444;font-size:11px;cursor:pointer">✕</button>';
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

// ── Habilitations ─────────────────────────────────────────────────────────────
function _frmRenderHabilitations(role) {
  var personMap = {};
  _frmParticipants.forEach(function(p) {
    var name = p.nom_participant || 'Inconnu';
    if (!personMap[name]) personMap[name] = [];
    var frm = _frmList.find(function(f){ return f.id === p.formation_id; });
    if (!frm) return;
    var expDate = null, daysLeft = null;
    if (frm.echeance_mois && frm.date_fin) {
      expDate = new Date(frm.date_fin); expDate.setMonth(expDate.getMonth() + parseInt(frm.echeance_mois));
      daysLeft = Math.round((expDate - new Date()) / 86400000);
    }
    personMap[name].push({ frm: frm, result: p.result, expDate: expDate, daysLeft: daysLeft, attestation: p.attestation_url });
  });

  var names = Object.keys(personMap).sort();
  if (!names.length) return _frmEmpty('🏅', 'Aucune habilitation — ajoutez des participants aux formations');

  var expired = 0, expiring = 0;
  names.forEach(function(n){ personMap[n].forEach(function(h){ if (h.daysLeft !== null){ if (h.daysLeft < 0) expired++; else if (h.daysLeft < 60) expiring++; } }); });

  var html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">';
  html += _frmKpi('🏅', names.length, 'Personnes', '#818CF8', role);
  html += _frmKpi('⚠️', expiring, 'Expirent <60j', '#F97316', role);
  html += _frmKpi('🔴', expired, 'Expirées', '#EF4444', role);
  html += '</div>';

  html += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">';
  html += '<thead><tr style="border-bottom:1px solid rgba(255,255,255,.08)">';
  ['Personne','Formation','Résultat','Expiration','Attestation'].forEach(function(h){
    html += '<th style="padding:9px 11px;text-align:left;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted)">' + h + '</th>';
  });
  html += '</tr></thead><tbody>';

  names.forEach(function(name) {
    personMap[name].forEach(function(h, idx) {
      var res  = FRM_RESULT.find(function(r){ return r.id === h.result; });
      var type = FRM_TYPES.find(function(t){ return t.id === h.frm.type; }) || FRM_TYPES[FRM_TYPES.length-1];
      var expStr = '—', expColor = 'var(--muted)';
      if (h.expDate) {
        expStr = h.expDate.toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});
        expColor = h.daysLeft < 0 ? '#EF4444' : h.daysLeft < 60 ? '#F97316' : '#4ADE80';
      }
      html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04)">';
      if (idx === 0) {
        html += '<td rowspan="' + personMap[name].length + '" style="padding:9px 11px;font-weight:700;vertical-align:top;border-right:1px solid rgba(255,255,255,.05)">'
          + '<div style="display:inline-flex;align-items:center;gap:7px"><div style="width:26px;height:26px;border-radius:50%;background:rgba(129,140,248,.2);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#818CF8">'
          + name.charAt(0).toUpperCase() + '</div>' + _esc(name) + '</div></td>';
      }
      html += '<td style="padding:9px 11px"><span style="padding:2px 7px;border-radius:5px;background:' + type.color + '18;color:' + type.color + ';font-size:11px">' + type.icon + ' ' + _esc(h.frm.intitule) + '</span></td>';
      html += '<td style="padding:9px 11px">' + (res ? '<span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;background:' + res.color + '22;color:' + res.color + '">' + res.label + '</span>' : '—') + '</td>';
      html += '<td style="padding:9px 11px;color:' + expColor + ';font-weight:' + (h.daysLeft !== null && h.daysLeft < 60 ? '700' : '400') + '">' + expStr + (h.daysLeft !== null && h.daysLeft < 0 ? ' ⚠' : '') + '</td>';
      html += '<td style="padding:9px 11px">' + (h.attestation ? '<a href="' + _esc(h.attestation) + '" target="_blank" style="color:#818CF8;font-size:11px">📄 Voir</a>' : '<span style="color:var(--muted)">—</span>') + '</td>';
      html += '</tr>';
    });
  });
  html += '</tbody></table></div>';
  return html;
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function _frmRenderStats(role) {
  var total     = _frmList.length;
  var terminees = _frmList.filter(function(f){ return f.status === 'terminee'; }).length;
  var planif    = _frmList.filter(function(f){ return f.status === 'planifiee'; }).length;
  var nbParts   = _frmParticipants.length;
  var reussis   = _frmParticipants.filter(function(p){ return p.result === 'obtenu'; }).length;
  var taux      = nbParts > 0 ? Math.round(reussis / nbParts * 100) : 0;
  var heures    = _frmList.reduce(function(s, f){ return s + (parseFloat(f.duree_heures) || 0); }, 0);

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:22px">';
  [
    { v: total,      l: 'Formations',      i: '🎓', c: '#818CF8' },
    { v: terminees,  l: 'Terminées',       i: '✅', c: '#4ADE80' },
    { v: planif,     l: 'Planifiées',      i: '📅', c: '#60A5FA' },
    { v: nbParts,    l: 'Participants',    i: '👥', c: '#A78BFA' },
    { v: taux + '%', l: 'Taux réussite',   i: '🏅', c: '#FCD34D' },
    { v: heures+'h', l: 'Heures',          i: '⏱', c: '#F97316' }
  ].forEach(function(k) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:14px;text-align:center">'
      + '<div style="font-size:20px;margin-bottom:3px">' + k.i + '</div>'
      + '<div style="font-size:24px;font-weight:900;color:' + k.c + '">' + k.v + '</div>'
      + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-top:2px">' + k.l + '</div>'
      + '</div>';
  });
  html += '</div>';

  // Graphe
  html += '<div style="background:linear-gradient(135deg,rgba(13,27,42,.95),rgba(15,23,42,.98));border:1px solid rgba(129,140,248,.15);border-radius:18px;overflow:hidden;margin-bottom:18px">';
  html += '<div style="padding:18px 22px 10px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:2px"><div style="width:3px;height:18px;background:linear-gradient(#818CF8,#6366F1);border-radius:2px"></div><span style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#818CF8">Activité</span></div><div style="font-size:18px;font-weight:900;color:#fff">Formations sur 12 mois</div></div>';
  html += '<div style="padding:0 22px 8px"><canvas id="frmChartMonths" height="130" style="width:100%;display:block"></canvas></div>';
  html += '<div style="padding:0 22px 16px;display:flex;gap:14px">';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:3px;background:#818CF8;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Formations</span></div>';
  html += '<div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:3px;background:#60A5FA;border-radius:2px"></div><span style="font-size:10px;color:#64748B">Participants</span></div>';
  html += '</div></div>';

  // Répartition
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">';
  html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">📊 Par type</div>';
  FRM_TYPES.forEach(function(t) {
    var nb = _frmList.filter(function(f){ return f.type === t.id; }).length;
    var pct = total > 0 ? Math.round(nb / total * 100) : 0;
    if (!nb) return;
    html += '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>' + t.icon + ' ' + t.label + '</span><span style="color:var(--muted)">' + nb + '</span></div>';
    html += '<div style="height:4px;background:rgba(255,255,255,.05);border-radius:2px"><div style="height:100%;width:' + pct + '%;background:' + t.color + ';border-radius:2px"></div></div></div>';
  });
  html += '</div>';
  html += '<div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px"><div style="font-size:13px;font-weight:700;margin-bottom:10px">🏅 Résultats</div>';
  FRM_RESULT.forEach(function(r) {
    var nb = _frmParticipants.filter(function(p){ return p.result === r.id; }).length;
    var pct = nbParts > 0 ? Math.round(nb / nbParts * 100) : 0;
    if (!nb) return;
    html += '<div style="margin-bottom:7px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="color:' + r.color + ';font-weight:700">' + r.label + '</span><span style="color:var(--muted)">' + nb + '</span></div>';
    html += '<div style="height:4px;background:rgba(255,255,255,.05);border-radius:2px"><div style="height:100%;width:' + pct + '%;background:' + r.color + ';border-radius:2px"></div></div></div>';
  });
  html += '</div></div>';
  return html;
}

// ── Canvas ────────────────────────────────────────────────────────────────────
function _drawFrmChart() {
  var canvas = document.getElementById('frmChartMonths');
  if (!canvas || canvas.offsetWidth === 0) { setTimeout(_drawFrmChart, 60); return; }
  var now = new Date(), months = [];
  for (var m = 11; m >= 0; m--) {
    var d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    months.push({ key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'), label: d.toLocaleDateString('fr-FR',{month:'short'}), f: 0, p: 0 });
  }
  _frmList.forEach(function(f) {
    var b = months.find(function(m){ return m.key === (f.date_debut||'').slice(0,7); });
    if (b) b.f++;
  });
  _frmParticipants.forEach(function(p) {
    var frm = _frmList.find(function(f){ return f.id === p.formation_id; });
    if (!frm) return;
    var b = months.find(function(m){ return m.key === (frm.date_debut||'').slice(0,7); });
    if (b) b.p++;
  });
  var maxVal = Math.max.apply(null, months.map(function(m){ return Math.max(m.f, m.p); }).concat([1]));
  var dpr = window.devicePixelRatio || 1, W = canvas.offsetWidth, H = 130;
  canvas.width = W * dpr; canvas.height = H * dpr;
  var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  var pad = { l:24,r:10,t:10,b:24 }, gw = W-pad.l-pad.r, gh = H-pad.t-pad.b, n = months.length;
  ctx.strokeStyle = 'rgba(255,255,255,.04)'; ctx.lineWidth = 1;
  for (var yv = 0; yv <= maxVal; yv += Math.max(1,Math.ceil(maxVal/4))) {
    var y = pad.t + gh*(1-yv/maxVal);
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+gw,y); ctx.stroke();
    ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='right';
    ctx.fillText(yv, pad.l-3, y+3);
  }
  var bw = gw/n*0.28;
  months.forEach(function(m,i) {
    var x0 = pad.l + i*gw/n + gw/n*0.1;
    if (m.f > 0) {
      var yf = pad.t+gh*(1-m.f/maxVal), g1=ctx.createLinearGradient(0,pad.t,0,pad.t+gh);
      g1.addColorStop(0,'rgba(129,140,248,.9)'); g1.addColorStop(1,'rgba(129,140,248,.1)');
      ctx.fillStyle=g1; ctx.beginPath(); ctx.roundRect(x0,yf,bw,gh-(yf-pad.t),2); ctx.fill();
    }
    if (m.p > 0) {
      var yp = pad.t+gh*(1-m.p/maxVal), g2=ctx.createLinearGradient(0,pad.t,0,pad.t+gh);
      g2.addColorStop(0,'rgba(96,165,250,.9)'); g2.addColorStop(1,'rgba(96,165,250,.1)');
      ctx.fillStyle=g2; ctx.beginPath(); ctx.roundRect(x0+bw+2,yp,bw,gh-(yp-pad.t),2); ctx.fill();
    }
    ctx.fillStyle='#475569'; ctx.font='9px sans-serif'; ctx.textAlign='center';
    ctx.fillText(m.label, x0+bw, H-5);
  });
}

// ── Sauvegarde ────────────────────────────────────────────────────────────────
async function _saveFrm(role, editId) {
  if (!currentProfile || !currentProfile.org_id) { showToast('❌ Session expirée', 'error'); return; }
  var intitule  = document.getElementById('frmIntitule')?.value?.trim();
  var type      = document.getElementById('frmType')?.value;
  var dateDebut = document.getElementById('frmDateDebut')?.value;
  if (!intitule || !type || !dateDebut) { showToast('⚠️ Intitulé, type et date début sont obligatoires', 'error'); return; }

  var echeance = document.getElementById('frmEcheance')?.value;
  var payload = {
    org_id        : currentProfile.org_id,
    created_by    : currentProfile.id,
    intitule      : intitule,
    type          : type,
    status        : document.getElementById('frmStatus')?.value || 'planifiee',
    date_debut    : dateDebut,
    date_fin      : document.getElementById('frmDateFin')?.value || null,
    duree_heures  : parseFloat(document.getElementById('frmDuree')?.value) || null,
    echeance_mois : echeance ? parseInt(echeance) : null,
    organisme     : document.getElementById('frmOrganisme')?.value?.trim() || null,
    lieu          : document.getElementById('frmLieu')?.value?.trim() || null,
    numero_certif : document.getElementById('frmCertif')?.value?.trim() || null,
    description   : document.getElementById('frmDesc')?.value?.trim() || null
  };

  var res = editId
    ? await sb.from('formations').update(payload).eq('id', editId)
    : await sb.from('formations').insert(payload);

  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  showToast(editId ? '✅ Formation modifiée' : '🎓 Formation créée', 'success');
  _frmSubView = 'catalogue'; _frmEditId = null;
  loadFormations(role);
}

// ── Participants ──────────────────────────────────────────────────────────────
function openAddParticipantModal(formationId, role) {
  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = '<div style="background:var(--bg);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:26px;width:100%;max-width:460px">'
    + '<div style="font-size:16px;font-weight:800;margin-bottom:18px">👥 Ajouter un participant</div>'
    + '<div style="margin-bottom:11px"><label style="' + _frmLbl() + '">Nom complet *</label><input type="text" id="partNom" placeholder="Prénom NOM" style="' + _frmInp() + '"></div>'
    + '<div style="margin-bottom:11px"><label style="' + _frmLbl() + '">Poste</label><input type="text" id="partPoste" placeholder="Ex : Technicien…" style="' + _frmInp() + '"></div>'
    + '<div style="margin-bottom:11px"><label style="' + _frmLbl() + '">Résultat</label><select id="partResult" style="' + _frmInp() + '">'
    + FRM_RESULT.map(function(r){ return '<option value="' + r.id + '">' + r.label + '</option>'; }).join('') + '</select></div>'
    + '<div style="margin-bottom:18px"><label style="' + _frmLbl() + '">URL Attestation</label><input type="url" id="partAttestation" placeholder="https://…" style="' + _frmInp() + '"></div>'
    + '<div style="display:flex;gap:10px">'
    + '<button onclick="saveParticipant(\'' + formationId + '\',\'' + role + '\',this.closest(\'[style*=fixed]\')" style="flex:1;padding:9px;background:rgba(129,140,248,.15);border:1px solid rgba(129,140,248,.3);border-radius:9px;color:#818CF8;font-weight:700;cursor:pointer">Ajouter</button>'
    + '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="padding:9px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:var(--muted);cursor:pointer">Annuler</button>'
    + '</div></div>';
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target===modal) modal.remove(); });
}

async function saveParticipant(formationId, role, modal) {
  var nom = document.getElementById('partNom')?.value?.trim();
  if (!nom) { showToast('⚠️ Nom obligatoire', 'error'); return; }
  var res = await sb.from('formation_participants').insert({
    formation_id   : formationId,
    org_id         : currentProfile.org_id,
    nom_participant: nom,
    poste          : document.getElementById('partPoste')?.value?.trim() || null,
    result         : document.getElementById('partResult')?.value || 'en_attente',
    attestation_url: document.getElementById('partAttestation')?.value?.trim() || null,
    created_by     : currentProfile.id,
  });
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  if (modal) modal.remove();
  showToast('✅ Participant ajouté', 'success');
  loadFormations(role);
}

async function updateParticipantResult(partId, newResult, role) {
  var res = await sb.from('formation_participants').update({ result: newResult }).eq('id', partId);
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  loadFormations(role);
}

async function removeParticipant(partId, formationId, role) {
  if (!confirm('Retirer ce participant ?')) return;
  var res = await sb.from('formation_participants').delete().eq('id', partId);
  if (res.error) { showToast('❌ ' + res.error.message, 'error'); return; }
  showToast('✅ Retiré', 'success');
  loadFormations(role);
}

// ── Détail ────────────────────────────────────────────────────────────────────
function openFrmDetail(frmId, role) {
  var frm = _frmList.find(function(f){ return f.id === frmId; });
  if (!frm) return;
  var type   = FRM_TYPES.find(function(t){ return t.id === frm.type; }) || FRM_TYPES[FRM_TYPES.length-1];
  var status = FRM_STATUS.find(function(s){ return s.id === frm.status; }) || FRM_STATUS[0];
  var parts  = _frmParticipants.filter(function(p){ return p.formation_id === frmId; });

  var modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';

  var html = '<div style="background:var(--bg);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:26px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px">';
  html += '<div><div style="font-size:17px;font-weight:800">' + type.icon + ' ' + _esc(frm.intitule) + '</div>';
  html += '<div style="font-size:12px;color:var(--muted);margin-top:2px">' + (frm.date_debut ? new Date(frm.date_debut).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : '—') + '</div></div>';
  html += '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:7px;padding:5px 11px;cursor:pointer;color:var(--muted)">✕</button></div>';

  html += '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:16px">';
  html += '<span style="padding:3px 10px;border-radius:7px;font-size:12px;font-weight:700;background:' + type.color + '22;color:' + type.color + '">' + type.icon + ' ' + type.label + '</span>';
  html += '<span style="padding:3px 10px;border-radius:7px;font-size:12px;font-weight:700;background:' + status.color + '22;color:' + status.color + '">' + status.label + '</span>';
  if (frm.duree_heures) html += '<span style="padding:3px 10px;border-radius:7px;font-size:12px;background:rgba(255,255,255,.06);color:var(--muted)">⏱ ' + frm.duree_heures + 'h</span>';
  if (frm.echeance_mois) html += '<span style="padding:3px 10px;border-radius:7px;font-size:12px;background:rgba(255,255,255,.06);color:var(--muted)">📅 ' + frm.echeance_mois + ' mois</span>';
  html += '</div>';

  [['Organisme', frm.organisme], ['Lieu', frm.lieu], ['Numéro certif.', frm.numero_certif], ['Description', frm.description]].forEach(function(r) {
    if (!r[1]) return;
    html += '<div style="margin-bottom:10px"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:3px">' + r[0] + '</div>';
    html += '<div style="font-size:13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:7px;padding:9px 11px">' + _esc(r[1]) + '</div></div>';
  });

  html += '<div style="margin-top:14px"><div style="font-size:13px;font-weight:700;margin-bottom:8px">👥 Participants (' + parts.length + ')</div>';
  if (!parts.length) {
    html += '<div style="font-size:12px;color:var(--muted)">Aucun participant</div>';
  } else {
    parts.forEach(function(p) {
      var r = FRM_RESULT.find(function(x){ return x.id === p.result; });
      html += '<div style="display:flex;align-items:center;gap:8px;padding:7px 11px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:7px;margin-bottom:5px">';
      html += '<span style="flex:1;font-size:13px;font-weight:600">' + _esc(p.nom_participant || '—') + '</span>';
      if (p.poste) html += '<span style="font-size:11px;color:var(--muted)">' + _esc(p.poste) + '</span>';
      if (r) html += '<span style="padding:2px 7px;border-radius:5px;font-size:11px;font-weight:700;background:' + r.color + '22;color:' + r.color + '">' + r.label + '</span>';
      html += '</div>';
    });
  }
  html += '</div>';

  html += '<div style="margin-top:14px"><button onclick="this.closest(\'[style*=fixed]\').remove();openFrmEdit(\'' + frmId + '\',\'' + role + '\')" style="padding:7px 16px;background:rgba(129,140,248,.1);border:1px solid rgba(129,140,248,.2);border-radius:7px;color:#818CF8;font-size:12px;font-weight:700;cursor:pointer">✏️ Modifier</button></div>';
  html += '</div>';

  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target===modal) modal.remove(); });
}

function openFrmEdit(frmId, role) {
  var frm = _frmList.find(function(f){ return f.id === frmId; });
  if (!frm) return;
  _frmSubView = 'nouvelle'; _frmEditId = frmId;
  renderFormations(role);
}

// ── Filtre ────────────────────────────────────────────────────────────────────
function filterFormations(role) {
  var type   = document.getElementById('frmFType')?.value;
  var status = document.getElementById('frmFStatus')?.value;
  var month  = document.getElementById('frmFMonth')?.value;
  var list   = _frmList.filter(function(f) {
    if (type   && f.type !== type)   return false;
    if (status && f.status !== status) return false;
    if (month  && !(f.date_debut||'').startsWith(month)) return false;
    return true;
  });
  var el = document.getElementById('frmTable');
  if (el) el.innerHTML = _frmBuildTable(list, role);
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportFormationsCSV(role) {
  var H = ['Intitulé','Type','Statut','Date début','Date fin','Durée(h)','Organisme','Lieu','Validité(mois)','Participants'];
  var rows = _frmList.map(function(f) {
    var t = FRM_TYPES.find(function(x){ return x.id===f.type; });
    var s = FRM_STATUS.find(function(x){ return x.id===f.status; });
    var n = _frmParticipants.filter(function(p){ return p.formation_id===f.id; }).length;
    var e = function(v){ return '"'+(v||'').toString().replace(/"/g,'""')+'"'; };
    return [e(f.intitule),e(t?t.label:f.type),e(s?s.label:f.status),e((f.date_debut||'').slice(0,10)),e((f.date_fin||'').slice(0,10)),e(f.duree_heures),e(f.organisme),e(f.lieu),e(f.echeance_mois),e(n)].join(',');
  });
  var csv = '\uFEFF' + H.join(',') + '\n' + rows.join('\n');
  var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  a.download = 'formations_' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
  showToast('⬇ Export CSV', 'success');
}

// ── KPI dashboard ─────────────────────────────────────────────────────────────
async function loadFormationsDashKPI(containerId) {
  var c = document.getElementById(containerId);
  if (!c || !currentProfile || !currentProfile.org_id) return;
  try {
    var [fr, pr] = await Promise.all([
      sb.from('formations').select('id,status,echeance_mois,date_fin').eq('org_id', currentProfile.org_id),
      sb.from('formation_participants').select('id,result').eq('org_id', currentProfile.org_id)
    ]);
    var frms = fr.data||[], parts = pr.data||[];
    var planif = frms.filter(function(f){ return f.status==='planifiee'; }).length;
    var exp = 0; var now = new Date();
    frms.forEach(function(f) {
      if (!f.echeance_mois||!f.date_fin) return;
      var d = new Date(f.date_fin); d.setMonth(d.getMonth()+parseInt(f.echeance_mois));
      var days = Math.round((d-now)/86400000);
      if (days >= 0 && days < 60) exp++;
    });
    c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px">'
      + _frmKpi('🎓', frms.length, 'Formations', '#818CF8', null)
      + _frmKpi('📅', planif, 'Planifiées', '#60A5FA', null)
      + _frmKpi('⚠️', exp, 'Expirent bientôt', '#F97316', null)
      + '</div>';
  } catch(e) { c.innerHTML = ''; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _frmExpirantsCount() {
  var now = new Date(), n = 0;
  _frmList.forEach(function(f) {
    if (!f.echeance_mois||!f.date_fin) return;
    var exp = new Date(f.date_fin); exp.setMonth(exp.getMonth()+parseInt(f.echeance_mois));
    var d = Math.round((exp-now)/86400000);
    if (d>=0 && d<60) n++;
  });
  return n;
}

function _frmKpi(icon, val, label, color, role) {
  var onclick = role ? 'onclick="switchPage(\'' + (role==='hse'?'HSE':'Company') + '\',\'formations\',null);loadFormations(\'' + role + '\')"' : '';
  return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-left:3px solid ' + color + ';border-radius:10px;padding:12px;cursor:pointer" ' + onclick + '>'
    + '<div style="font-size:18px">' + icon + '</div>'
    + '<div style="font-size:22px;font-weight:900;color:' + color + ';margin:3px 0">' + val + '</div>'
    + '<div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700">' + label + '</div>'
    + '</div>';
}

function _frmGo(view, role) { _frmSubView = view; _frmEditId = null; renderFormations(role); }
window._frmGo = _frmGo;

function _frmNavBtn(view, label, role, badge) {
  var active = _frmSubView === view;
  return '<button onclick="_frmGo(\'' + view + '\',\'' + role + '\')" style="padding:7px 13px;font-size:12px;font-weight:700;border-radius:8px;cursor:pointer;background:' + (active?'rgba(129,140,248,.2)':'rgba(255,255,255,.04)') + ';border:1px solid ' + (active?'rgba(129,140,248,.4)':'rgba(255,255,255,.08)') + ';color:' + (active?'#818CF8':'var(--muted)') + '">'
    + label + (badge ? ' <span style="display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:#F97316;color:#fff;font-size:9px;margin-left:3px">' + badge + '</span>' : '') + '</button>';
}

function _frmInp()  { return 'width:100%;box-sizing:border-box;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:8px 11px;color:var(--text);font-size:13px;font-family:inherit;outline:none;'; }
function _frmSel()  { return 'background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;'; }
function _frmLbl()  { return 'font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);display:block;margin-bottom:5px;'; }
function _frmEmpty(icon, text) { return '<div class="empty-state"><div class="empty-state-icon">' + icon + '</div><div class="empty-state-text">' + text + '</div></div>'; }
function _esc(v)    { return (v==null?'':String(v)).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  var _w = setInterval(function() {
    if (typeof currentProfile !== 'undefined' && currentProfile && typeof sb !== 'undefined') {
      clearInterval(_w); checkFormationsActivation();
    }
  }, 300);
});

// ════════════════════════════════════════════════════════════════════════════
