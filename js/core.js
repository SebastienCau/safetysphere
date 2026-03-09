// ============================================================
// SafetySphere — core.js  (v2.0.0)
// Supabase init · Variables globales · Auth · Routing · Theme
// ============================================================
// ORDRE DE CHARGEMENT : ce fichier doit être chargé EN PREMIER
// Toutes les variables déclarées ici sont disponibles globalement
// ============================================================

const SUPABASE_URL  = 'https://hyqsiakhkivteaaqyzjc.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cXNpYWtoa2l2dGVhYXF5empjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4NzU0ODEsImV4cCI6MjA4ODQ1MTQ4MX0.IlGKHmBpUjUr2b2TVxFNKg95-xSD5UM1t3Eg581ecgk';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

let currentUser    = null;
let currentProfile = null;
let currentUploadDoc = null;
let selectedFile   = null;
let trainingCenters = []; // cache des centres chargés

// ── DÉFINITIONS DOCUMENTS ──
const WORKER_DOCS = [
  { key: 'habilitation_elec', name: 'Habilitation Électrique', icon: '⚡', desc: 'B0, H0, BR, BC...' },
  { key: 'travail_hauteur',   name: 'Travail en Hauteur',      icon: '🏗️', desc: 'Port du harnais, nacelle...' },
  { key: 'espace_confine',    name: 'Espace Confiné',          icon: '🕳️', desc: 'Attestation espace confiné' },
  { key: 'formation_sst',     name: 'Formation SST / Sécurité',icon: '🩺', desc: 'Sauveteur secouriste, PRAP...' },
  { key: 'carte_btp',         name: 'Carte BTP',               icon: '🪪', desc: "Carte d'identification BTP" },
  { key: 'visite_medicale',   name: 'Visite Médicale',         icon: '🏥', desc: 'Aptitude médicale au poste' },
];
const COMPANY_DOCS = [
  { key: 'kbis',      name: 'KBIS',                icon: '📋', desc: 'Extrait Kbis de moins de 3 mois' },
  { key: 'rc_pro',    name: 'Attestation RC Pro',   icon: '🛡️', desc: 'Responsabilité civile professionnelle' },
  { key: 'urssaf',    name: 'Attestation URSSAF',   icon: '📊', desc: 'Vigilance sociale à jour' },
  { key: 'accord_st', name: 'Accord Sous-Traitance',icon: '🤝', desc: 'Convention signée avec le donneur' },
];



// ── HELPERS UI ──
// ── SÉCURITÉ : échappement HTML (prévention XSS) ──
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ── ACCESSIBILITÉ : zoom police & contraste ──
const CONTRAST_LABELS  = ['Normal', 'Clair', 'Vif', 'Maximum'];
const CONTRAST_CLASSES = ['', 'clarity-1', 'clarity-2', 'clarity-3'];

function applyFontSize(pct) {
  const v = Math.min(130, Math.max(80, parseInt(pct)));
  const zoom = (v / 100).toFixed(2);
  const appContent = document.getElementById('appContent');
  if (appContent) appContent.style.zoom = zoom;
  // Custom property pour fallback Firefox
  document.documentElement.style.setProperty('--ui-zoom', zoom);
  document.getElementById('fontSizeSlider').value = v;
  document.getElementById('fontSizeLabel').textContent = v + '%';
  // Présets actifs
  document.querySelectorAll('#settingsPanel .settings-presets')[0]
    ?.querySelectorAll('.settings-preset')
    .forEach(el => el.classList.remove('active'));
  const presetMap = { 80: 0, 100: 1, 115: 2, 130: 3 };
  if (presetMap[v] !== undefined)
    document.querySelectorAll('#settingsPanel .settings-presets')[0]
      ?.querySelectorAll('.settings-preset')[presetMap[v]]
      ?.classList.add('active');
  saveDisplayPrefs();
}

function applyContrast(level) {
  const l = Math.min(3, Math.max(0, parseInt(level)));
  document.body.classList.remove('clarity-1', 'clarity-2', 'clarity-3');
  if (CONTRAST_CLASSES[l]) document.body.classList.add(CONTRAST_CLASSES[l]);
  document.getElementById('contrastSlider').value = l;
  document.getElementById('contrastLabel').textContent = CONTRAST_LABELS[l];
  // Présets actifs
  document.querySelectorAll('#settingsPanel .settings-presets')[1]
    ?.querySelectorAll('.settings-preset')
    .forEach((el, i) => el.classList.toggle('active', i === l));
  saveDisplayPrefs();
}

function applyGlobalContrast(level) {
  const l = Math.min(2, Math.max(0, parseInt(level)));
  const app = document.getElementById('appContent');
  if (app) { app.classList.remove('contrast-high', 'contrast-max'); }
  if (l === 1 && app) app.classList.add('contrast-high');
  if (l === 2 && app) app.classList.add('contrast-max');
  document.getElementById('globalContrastSlider').value = l;
  const labels = ['Normal', 'Élevé', 'Maximum'];
  document.getElementById('globalContrastLabel').textContent = labels[l];
  document.querySelectorAll('#settingsPanel .settings-presets')[2]
    ?.querySelectorAll('.settings-preset')
    .forEach((el, i) => el.classList.toggle('active', i === l));
  saveDisplayPrefs();
}

function resetDisplaySettings() {
  applyFontSize(100);
  applyContrast(0);
  applyGlobalContrast(0);
}

function toggleSettingsPanel(btn) {
  const panel = document.getElementById('settingsPanel');
  const isOpen = panel.classList.toggle('open');
  // Synchroniser tous les boutons ⚙️ dans les topbars
  document.querySelectorAll('.btn-settings').forEach(b => b.classList.toggle('active', isOpen));
  // Fermer si clic ailleurs
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function closePanel(e) {
        if (!panel.contains(e.target) && !e.target.closest('.btn-settings')) {
          panel.classList.remove('open');
          document.querySelectorAll('.btn-settings').forEach(b => b.classList.remove('active'));
          document.removeEventListener('click', closePanel);
        }
      });
    }, 50);
  }
}

async function saveDisplayPrefs() {
  if (!currentUser || !currentProfile) return;
  const appContent = document.getElementById('appContent');
  const zoom     = parseFloat(appContent?.style.zoom) || 1;
  const fontSize = Math.round(zoom * 100);
  const contrast = document.body.classList.contains('clarity-3') ? 3
                 : document.body.classList.contains('clarity-2') ? 2
                 : document.body.classList.contains('clarity-1') ? 1 : 0;
  const globalContrast = appContent?.classList.contains('contrast-max') ? 2
                       : appContent?.classList.contains('contrast-high') ? 1 : 0;
  const existing = currentProfile.dashboard_layout || {};
  existing._prefs = { fontSize, contrast, globalContrast };
  currentProfile.dashboard_layout = existing;
  const { error } = await sb.from('profiles').update({ dashboard_layout: existing }).eq('id', currentUser.id);
  if (error) console.warn('saveDisplayPrefs:', error.message);
}

function loadDisplayPrefs() {
  const prefs = currentProfile?.dashboard_layout?._prefs;
  if (!prefs) return;
  if (prefs.fontSize && prefs.fontSize !== 100) applyFontSize(prefs.fontSize);
  if (prefs.contrast) applyContrast(prefs.contrast);
  if (prefs.globalContrast) applyGlobalContrast(prefs.globalContrast);
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast toast-${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}
function showAlert(msg, type = 'error') {
  const el = document.getElementById('alertBox');
  el.textContent = msg;
  el.className = `alert show alert-${type}`;
  setTimeout(() => el.classList.remove('show'), 5000);
}
function setLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? '<span class="spinner"></span> Chargement...' : label;
}

// ── AUTH TABS ──
function switchTab(tab, e) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('forgotForm').style.display   = 'none';
  document.getElementById('alertBox').classList.remove('show');
}
function showForgotPassword() {
  document.getElementById('loginForm').style.display    = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('forgotForm').style.display   = 'block';
}
function showLoginForm() {
  document.getElementById('loginForm').style.display    = 'block';
  document.getElementById('forgotForm').style.display   = 'none';
  document.getElementById('registerForm').style.display = 'none';
}
async function handleForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showAlert('Veuillez saisir votre email.'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) { showAlert('Erreur : ' + error.message); return; }
  showAlert('Lien de réinitialisation envoyé à ' + email, 'success');
  setTimeout(() => showLoginForm(), 3000);
}

// ── ROLE CHANGE (inscription) ──
function onRoleChange(val) {
  const withSiret   = ['company','subcontractor','trainer','hse'];
  const withOrg     = ['company','subcontractor','trainer','hse'];
  document.getElementById('siretGroup').style.display      = withSiret.includes(val) ? 'block' : 'none';
  document.getElementById('orgNameGroup').style.display    = withOrg.includes(val)   ? 'block' : 'none';
  document.getElementById('orgAddressGroup').style.display = withOrg.includes(val)   ? 'block' : 'none';
  document.getElementById('orgLegalGroup').style.display   = withOrg.includes(val)   ? 'block' : 'none';
  document.getElementById('bookingUrlGroup').style.display = val === 'trainer'        ? 'block' : 'none';
  document.getElementById('teamCodeGroup').style.display   = val === 'worker'         ? 'block' : 'none';
  // Reset Pappers result
  document.getElementById('papperResult').style.display    = 'none';
  document.getElementById('regOrgName').value    = '';
  document.getElementById('regOrgAddress').value = '';
  document.getElementById('regOrgLegal').value   = '';
  document.getElementById('orgNameLabel').textContent =
    val === 'subcontractor' ? 'Nom de la société sous-traitante' :
    val === 'trainer'       ? 'Nom du centre de formation' :
    val === 'hse'           ? 'Nom de l\'entreprise utilisatrice' :
    'Nom de la société';
}

// ── NAV PAGES ──
// ══════════════════════════════════════
// API ENTREPRISES (data.gouv.fr) — GRATUIT, SANS CLÉ
// ══════════════════════════════════════
async function lookupSiret() {
  const siret  = document.getElementById('regSiret').value.trim().replace(/\s/g, '');
  const result = document.getElementById('papperResult');

  if (siret.length !== 14) {
    result.style.display = 'block';
    result.style.background = 'rgba(239,68,68,.08)';
    result.style.borderColor = 'rgba(239,68,68,.3)';
    result.innerHTML = '❌ Le SIRET doit contenir exactement 14 chiffres';
    return;
  }

  const btn = document.getElementById('siretCheckBtn');
  btn.textContent = '⏳'; btn.disabled = true;

  try {
    const res  = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`);
    const data = await res.json();
    const entreprise = data?.results?.[0];

    if (!entreprise) {
      result.style.display = 'block';
      result.style.background = 'rgba(239,68,68,.08)';
      result.style.borderColor = 'rgba(239,68,68,.3)';
      result.innerHTML = '❌ Société introuvable — vérifiez le SIRET';
      btn.textContent = '🔍 Vérifier'; btn.disabled = false;
      return;
    }

    // Extraire les données
    const nom       = entreprise.nom_complet || entreprise.nom_raison_sociale || '';
    const forme     = entreprise.nature_juridique_libelle || '';
    const siege     = entreprise.siege || {};
    const adresse   = [siege.adresse, siege.code_postal, siege.libelle_commune].filter(Boolean).join(', ');
    const actif     = entreprise.etat_administratif === 'A';
    const creation  = entreprise.date_creation ? new Date(entreprise.date_creation).toLocaleDateString('fr-FR') : '';
    const effectif  = entreprise.tranche_effectif_salarie_libelle || '';
    const activite  = entreprise.activite_principale_libelle || '';

    // Pré-remplir les champs
    document.getElementById('regOrgName').value    = nom;
    document.getElementById('regOrgAddress').value = adresse;
    document.getElementById('regOrgLegal').value   = forme;

    // Afficher le résultat
    const statusColor = actif ? '#22C55E' : '#EF4444';
    const statusLabel = actif ? '✅ Société active' : '⚠️ Société radiée ou inactive';
    result.style.display  = 'block';
    result.style.background  = actif ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)';
    result.style.borderColor = actif ? 'rgba(34,197,94,.3)'  : 'rgba(239,68,68,.3)';
    result.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:15px;font-weight:900">${nom}</span>
        <span style="font-size:12px;font-weight:700;color:${statusColor}">${statusLabel}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)">
        ${forme    ? `<div>📋 ${forme}</div>` : ''}
        ${adresse  ? `<div>📍 ${adresse}</div>` : ''}
        ${activite ? `<div>🏭 ${activite}</div>` : ''}
        ${effectif ? `<div>👥 ${effectif}</div>` : ''}
        ${creation ? `<div>📅 Créée le ${creation}</div>` : ''}
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--muted)">✓ Informations pré-remplies automatiquement — modifiables si besoin</div>`;

  } catch (err) {
    result.style.display = 'block';
    result.style.background = 'rgba(239,68,68,.08)';
    result.style.borderColor = 'rgba(239,68,68,.3)';
    result.innerHTML = '❌ Erreur de connexion — remplissez manuellement';
  }

  btn.textContent = '🔍 Vérifier'; btn.disabled = false;
}

// ── NAV PAGES ──
function switchPage(dash, page, el) {
  const dashEl = document.getElementById('dash' + dash);
  dashEl.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  dashEl.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const section = document.getElementById(dash + '-' + page);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');
  // Lazy loads
  if (dash === 'Worker'  && page === 'docs')       loadWorkerDocs();
  if (dash === 'Worker'  && page === 'shares')     loadWorkerShares();
  if (dash === 'Worker'  && page === 'received')   loadReceivedDocs('Worker-receivedContainer');
  if (dash === 'Company' && page === 'societedocs') loadCompanyDocs();
  if (dash === 'Company' && page === 'workers')    loadCompanyWorkers();
  if (dash === 'Company' && page === 'received')   loadReceivedDocs('Company-receivedContainer');
  if (dash === 'HSE'     && page === 'contractors') loadST(currentProfile.org_id, 'hseSTContainer');
  if (dash === 'HSE'     && page === 'received')   loadReceivedDocs('HSE-receivedContainer');
  if (dash === 'Company' && page === 'subcontractors') loadST(currentProfile.org_id, 'companySTContainer');
  if (dash === 'Subcontractor' && page === 'workers')  loadSTWorkers();
  if (dash === 'Subcontractor' && page === 'eu')       loadSTEU();
  if (dash === 'Subcontractor' && page === 'docs')     loadSTDocs();
  if (dash === 'Subcontractor' && page === 'received') loadReceivedDocs('Subcontractor-receivedContainer');
  if (dash === 'Trainer' && page === 'requests')   loadTrainerRequests();
  if (dash === 'Trainer' && page === 'validated')  loadTrainerHistory();
  if (dash === 'Trainer' && page === 'received')   loadReceivedDocs('Trainer-receivedContainer');
}

// ── SHOW DASHBOARD ──
// ══════════════════════════════════════
// NOTIFICATIONS MISE EN RELATION
// ══════════════════════════════════════
async function checkPendingSTInvites() {
  if (!currentProfile.email || !currentProfile.org_id) return;
  const email = currentProfile.email.toLowerCase();

  // Trouver les EU qui ont invité cet email mais ne sont pas encore liées
  const { data: invites } = await sb.from('st_invites').select('id, eu_org_id, created_at').eq('st_email', email);
  if (!invites || !invites.length) return;

  // Filtrer celles déjà acceptées
  const { data: existing } = await sb.from('org_relationships').select('eu_org_id').eq('st_org_id', currentProfile.org_id);
  const linkedIds = new Set((existing || []).map(r => r.eu_org_id));
  const pending = invites.filter(i => !linkedIds.has(i.eu_org_id));
  if (!pending.length) return;

  // Charger les noms des EU
  const { data: orgs } = await sb.from('organizations').select('id, name').in('id', pending.map(i => i.eu_org_id));
  const orgMap = {};
  if (orgs) orgs.forEach(o => orgMap[o.id] = o.name);

  // Afficher une bannière par invitation en attente
  const overviewEl = document.getElementById('Subcontractor-overview');
  const welcomeEl  = overviewEl.querySelector('.dash-welcome');
  pending.forEach(inv => {
    const euName = orgMap[inv.eu_org_id] || 'une entreprise';
    const banner  = document.createElement('div');
    banner.className = 'pending-banner';
    banner.id = `st-banner-${inv.id}`;
    banner.innerHTML = `
      <div class="pending-banner-icon">🏭</div>
      <div class="pending-banner-body">
        <div class="pending-banner-title">${escapeHtml(euName)} souhaite vous mettre en relation</div>
        <div class="pending-banner-sub">Acceptez pour apparaître dans leur liste de sous-traitants</div>
      </div>
      <div class="pending-banner-actions">
        <button class="btn-sm btn-validate" onclick="acceptSTInvite('${escapeHtml(inv.id)}','${escapeHtml(inv.eu_org_id)}','${escapeHtml(euName)}')">✓ Accepter</button>
        <button class="btn-sm btn-reject"   onclick="dismissSTBanner('${escapeHtml(inv.id)}')">✕</button>
      </div>`;
    overviewEl.insertBefore(banner, welcomeEl.nextSibling);
  });
}

async function acceptSTInvite(inviteId, euOrgId, euName) {
  const { error } = await sb.from('org_relationships').insert({ eu_org_id: euOrgId, st_org_id: currentProfile.org_id });
  if (error && error.code !== '23505') { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(`✓ Mis en relation avec ${euName}`, 'success');
  document.getElementById(`st-banner-${inviteId}`)?.remove();
  loadSTStats();
}

function dismissSTBanner(inviteId) {
  document.getElementById(`st-banner-${inviteId}`)?.remove();
}

async function checkPendingWorkerInvites() {
  if (!currentProfile.email) return;
  const email = currentProfile.email.toLowerCase();

  const { data: invites } = await sb.from('worker_invites').select('id, org_id, created_at').eq('worker_email', email);
  if (!invites || !invites.length) return;

  // Filtrer : ignorer les orgs auxquelles le worker est déjà rattaché
  const pending = invites.filter(i => i.org_id !== currentProfile.org_id);
  if (!pending.length) return;

  const { data: orgs } = await sb.from('organizations').select('id, name').in('id', pending.map(i => i.org_id));
  const orgMap = {};
  if (orgs) orgs.forEach(o => orgMap[o.id] = o.name);

  const overviewEl = document.getElementById('Worker-overview');
  const welcomeEl  = overviewEl.querySelector('.dash-welcome');
  pending.forEach(inv => {
    const stName = orgMap[inv.org_id] || 'une société';
    const banner  = document.createElement('div');
    banner.className = 'pending-banner pending-banner-worker';
    banner.id = `worker-banner-${inv.id}`;
    banner.innerHTML = `
      <div class="pending-banner-icon">🤝</div>
      <div class="pending-banner-body">
        <div class="pending-banner-title">${escapeHtml(stName)} vous invite à rejoindre son équipe</div>
        <div class="pending-banner-sub">Acceptez pour vous rattacher automatiquement à ${escapeHtml(stName)}</div>
      </div>
      <div class="pending-banner-actions">
        <button class="btn-sm btn-validate" onclick="acceptWorkerInvite('${escapeHtml(inv.id)}','${escapeHtml(inv.org_id)}','${escapeHtml(stName)}')">✓ Accepter</button>
        <button class="btn-sm btn-reject"   onclick="dismissWorkerBanner('${escapeHtml(inv.id)}')">✕</button>
      </div>`;
    overviewEl.insertBefore(banner, welcomeEl.nextSibling);
  });
}

async function acceptWorkerInvite(inviteId, orgId, stName) {
  const { error } = await sb.from('profiles').update({ org_id: orgId }).eq('id', currentUser.id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  currentProfile.org_id = orgId;
  showToast(`✓ Rattaché à ${stName}`, 'success');
  // Supprimer toutes les bannières d'invitation worker (une seule acceptée suffit)
  document.querySelectorAll('[id^="worker-banner-"]').forEach(b => b.remove());
  // Mettre à jour le banner employeur sans recharger toute la page
  document.getElementById('linkCompanyBanner').style.display   = 'none';
  document.getElementById('linkedCompanyBanner').style.display = 'flex';
  document.getElementById('linkedCompanyName').textContent     = stName;
  loadWorkerStats();
}

function dismissWorkerBanner(inviteId) {
  document.getElementById(`worker-banner-${inviteId}`)?.remove();
}

// ══════════════════════════════════════
function showDashboard(role, fullName) {
  document.getElementById('authScreen').style.display = 'none';
  ['dashWorker','dashCompany','dashHSE','dashTrainer','dashGuest','dashSubcontractor','dashAdmin'].forEach(id => document.getElementById(id).classList.remove('active'));
  // Appliquer le thème sauvegardé (défaut light pour trainer)
  const theme = currentProfile?.theme || (role === 'trainer' ? 'light' : 'dark');
  applyTheme(theme);
  // Appliquer les préférences d'affichage (zoom + contraste)
  loadDisplayPrefs();
  const firstName = (fullName || 'Utilisateur').split(' ')[0];
  if (role === 'worker') {
    document.getElementById('dashWorker').classList.add('active');
    document.getElementById('workerFirstName').textContent = firstName;
    document.getElementById('workerUserName').textContent  = fullName || '';
    loadWorkerStats();
    checkPendingWorkerInvites();
    loadNotifications('worker');
    setTimeout(() => initDashboardWidgets('worker'), 200);
  } else if (role === 'company') {
    document.getElementById('dashCompany').classList.add('active');
    document.getElementById('companyFirstName').textContent = firstName;
    document.getElementById('companyUserName').textContent  = fullName || '';
    loadCompanyStats();
    loadNotifications('company');
    setTimeout(() => initDashboardWidgets('company'), 200);
  } else if (role === 'hse') {
    document.getElementById('dashHSE').classList.add('active');
    document.getElementById('hseFirstName').textContent = firstName;
    document.getElementById('hseUserName').textContent  = fullName || '';
    loadHSEStats();
    loadNotifications('hse');
    setTimeout(() => initDashboardWidgets('hse'), 400);
  } else if (role === 'trainer') {
    document.getElementById('dashTrainer').classList.add('active');
    document.getElementById('trainerFirstName').textContent = firstName;
    document.getElementById('trainerUserName').textContent  = fullName || '';
    loadTrainerStats();
    loadNotifications('trainer');
    setTimeout(() => initDashboardWidgets('trainer'), 200);
  } else if (role === 'guest') {
    document.getElementById('dashGuest').classList.add('active');
    document.getElementById('guestUserName').textContent = fullName || '';
    loadReceivedDocs('guestDocsContainer');
  } else if (role === 'subcontractor') {
    document.getElementById('dashSubcontractor').classList.add('active');
    document.getElementById('stFirstName').textContent = firstName;
    document.getElementById('stUserName').textContent  = fullName || '';
    loadSTStats();
    checkPendingSTInvites();
    loadNotifications('subcontractor');
    setTimeout(() => initDashboardWidgets('subcontractor'), 200);
  } else if (role === 'admin') {
    document.getElementById('dashAdmin').classList.add('active');
    document.getElementById('adminUserName').textContent = fullName || '';
    loadAdminCompliance();
  }
}
function hideAllDashboards() {
  ['dashWorker','dashCompany','dashHSE','dashTrainer','dashGuest','dashSubcontractor','dashAdmin'].forEach(id => document.getElementById(id).classList.remove('active'));
  // Réinitialiser les widgets pour permettre un rebuild propre
  document.querySelectorAll('[data-widgets-init]').forEach(el => delete el.dataset.widgetsInit);
  // Réinitialiser le mode personnalisation
  _customizeMode = false;
  document.getElementById('authScreen').style.display = 'flex';
}

// ── LOGIN ──
async function handleLogin(e) {
  e.preventDefault();
  setLoading('loginBtn', true, 'Se connecter');
  const { data, error } = await sb.auth.signInWithPassword({
    email: document.getElementById('loginEmail').value,
    password: document.getElementById('loginPassword').value
  });
  if (error) { showAlert('Email ou mot de passe incorrect.'); setLoading('loginBtn', false, 'Se connecter'); return; }
  currentUser = data.user;

  // Attendre que la session soit bien établie avant de lire le profil
  let profile = null;
  for (let i = 0; i < 3; i++) {
    const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
    if (p) { profile = p; break; }
    await new Promise(r => setTimeout(r, 500)); // retry après 500ms
  }

  setLoading('loginBtn', false, 'Se connecter');
  if (profile) { currentProfile = profile; showDashboard(profile.role, profile.full_name); }
  else showAlert('Profil introuvable. Contactez un administrateur.');
}

// ── REGISTER ──
async function handleRegister(e) {
  e.preventDefault();
  const name       = document.getElementById('regName').value;
  const email      = document.getElementById('regEmail').value;
  const role       = document.getElementById('regRole').value;
  const password   = document.getElementById('regPassword').value;
  const orgName    = document.getElementById('regOrgName').value;
  const bookingUrl = document.getElementById('regBookingUrl').value;
  const teamCode   = document.getElementById('regTeamCode').value.toUpperCase().trim();
  const siret      = document.getElementById('regSiret')?.value?.trim() || '';
  const address    = document.getElementById('regOrgAddress')?.value?.trim() || '';
  const legalForm  = document.getElementById('regOrgLegal')?.value?.trim() || '';
  if (!role) { showAlert('Veuillez choisir un rôle.'); return; }

  // Worker : valider le code employeur si renseigné (optionnel)
  let orgId = null;
  if (role === 'worker' && teamCode) {
    const { data: org } = await sb.from('organizations').select('id').eq('team_code', teamCode).in('type',['company','subcontractor']).single();
    if (!org) { showAlert('Code employeur invalide. Vérifiez auprès de votre société.'); return; }
    orgId = org.id;
  }

  setLoading('registerBtn', true, 'Créer mon compte');
  const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: name, role } } });
  if (error) { showAlert(error.message); setLoading('registerBtn', false, 'Créer mon compte'); return; }

  if (data.user) {
    // 1. Company, Subcontractor, Trainer, HSE → créer l'organisation
    if (['company','subcontractor','trainer','hse'].includes(role) && orgName) {
      const prefix  = orgName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4).padEnd(4, 'X');
      const suffix  = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 4).padEnd(4, '0');
      const tCode   = prefix + '-' + suffix;
      const orgType = role === 'trainer' ? 'training_center' : role === 'subcontractor' ? 'subcontractor' : 'company';
      const orgPayload = { name: orgName, team_code: tCode, type: orgType };
      if (role === 'trainer' && bookingUrl) orgPayload.booking_url = bookingUrl;
      if (siret)    orgPayload.siret      = siret;
      if (address)  orgPayload.address    = address;
      if (legalForm) orgPayload.legal_form = legalForm;
      const { data: org, error: orgErr } = await sb.from('organizations').insert(orgPayload).select().single();
      if (orgErr) { showAlert('Erreur création organisation : ' + orgErr.message); setLoading('registerBtn', false, 'Créer mon compte'); return; }
      if (org) { orgId = org.id; }
    }

    // 2. Créer le profil
    const theme = role === 'trainer' ? 'light' : 'dark';
    const { error: profileErr } = await sb.from('profiles').insert({ id: data.user.id, full_name: name, email, role, org_id: orgId || null, theme });
    if (profileErr) { showAlert('Erreur création profil : ' + profileErr.message); setLoading('registerBtn', false, 'Créer mon compte'); return; }
  }
  setLoading('registerBtn', false, 'Créer mon compte');
  showAlert('Compte créé ! Confirmez votre email puis connectez-vous.', 'success');
}

// ── LOGOUT ──
async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null; currentProfile = null;
  applyTheme('dark');
  hideAllDashboards();
}

// ── RGPD : Suppression de compte (Art. 17) ──
async function confirmDeleteAccount() {
  const confirmed = confirm(
    'SUPPRESSION DÉFINITIVE DE VOTRE COMPTE\n\n' +
    'Cette action est irréversible. Seront supprimés :\n' +
    '• Votre profil et vos informations personnelles\n' +
    '• Vos documents et habilitations\n' +
    '• Vos partages et invitations\n\n' +
    'Confirmez-vous la suppression ?'
  );
  if (!confirmed) return;

  const confirmEmail = prompt('Pour confirmer, saisissez votre adresse email :');
  if (!confirmEmail || confirmEmail.trim().toLowerCase() !== currentProfile?.email?.toLowerCase()) {
    showToast('Email incorrect — suppression annulée.', 'error');
    return;
  }

  try {
    const userId = currentUser.id;
    // Supprimer les données liées (RLS permet à l'utilisateur de supprimer ses propres données)
    await Promise.all([
      sb.from('documents').delete().eq('owner_id', userId),
      sb.from('document_shares').delete().eq('worker_id', userId),
      sb.from('worker_invites').delete().eq('worker_email', currentProfile.email),
    ]);
    const { error: delErr } = await sb.from('profiles').delete().eq('id', userId);
    if (delErr) { showToast('Erreur suppression compte : ' + delErr.message, 'error'); return; }

    // Déconnexion immédiate
    await sb.auth.signOut();
    currentUser = null; currentProfile = null;
    hideAllDashboards();
    showToast('Compte supprimé. Vos données ont été effacées.', 'success');
  } catch(e) {
    showToast('Erreur lors de la suppression : ' + e.message, 'error');
  }
}

// ── THEME ──
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('theme-light');
    document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = '☀️');
  } else {
    document.body.classList.remove('theme-light');
    document.querySelectorAll('.theme-toggle').forEach(b => b.textContent = '🌙');
  }
}

async function toggleTheme() {
  const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
  const next    = current === 'light' ? 'dark' : 'light';
  applyTheme(next);
  // Sauvegarder en base
  if (currentUser) {
    const { error } = await sb.from('profiles').update({ theme: next }).eq('id', currentUser.id);
    if (error) { showToast('Erreur sauvegarde thème', 'error'); return; }
    if (currentProfile) currentProfile.theme = next;
  }
}

// ══════════════════════════════
// WORKER

(async () => {
  // Détecter page publique de scan QR
  const urlParams = new URLSearchParams(window.location.search);
  const workerToken = urlParams.get('worker');
  const orgToken    = urlParams.get('org');
  if (workerToken) {
    await loadPublicWorkerPage(workerToken);
    return;
  }
  if (orgToken) {
    await loadPublicOrgPage(orgToken);
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
    if (profile) { currentProfile = profile; showDashboard(profile.role, profile.full_name); }
  }

  // ── Surveillance expiration de session ──
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      // Session expirée ou déconnexion externe
      if (currentUser) {
        currentUser    = null;
        currentProfile = null;
        showToast('Votre session a expiré, veuillez vous reconnecter.', 'error');
        setTimeout(() => hideAllDashboards(), 1500);
      }
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      // Token rafraîchi silencieusement — mettre à jour currentUser
      currentUser = session.user;
    }
  });
})();

