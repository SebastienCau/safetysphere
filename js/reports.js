// ============================================================
// SafetySphere — reports.js  (v2.0.0)
// Dashboard widgets · Notifications · Profil org
// Rapport helpers · Archivage · Historique · Report Viewer
// KPI Catalog · Admin Simulator · Impersonation
// ============================================================
// Dépendances : core.js · signatures.js (openSendForSignatureModal)
// ============================================================


// ── PROFIL ORGANISATION ──────────────────────────────────────

async function loadOrgProfile(dash) {
  const container = document.getElementById(`${dash}-orgProfileContainer`);
  if (!container || !currentProfile?.org_id) return;

  const { data: org } = await sb.from('organizations')
    .select('id, name, siret, address, legal_form, team_code, type, booking_url, org_qr_token')
    .eq('id', currentProfile.org_id).single();

  // Générer org_qr_token si absent
  if (org && !org.org_qr_token) {
    const newToken = crypto.randomUUID();
    const { error } = await sb.from('organizations').update({ org_qr_token: newToken }).eq('id', org.id);
    if (error) { showToast('Erreur génération QR : ' + error.message, 'error'); }
    else { org.org_qr_token = newToken; }
  }

  if (!org) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Organisation introuvable</div></div>';
    return;
  }

  const isTrainer = org.type === 'training_center';
  const siretFormatted = org.siret ? org.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : '';

  container.innerHTML = `
    <div style="display:grid;gap:20px;max-width:700px">

      <!-- Carte infos principales -->
      <div class="section-card">
        <div class="section-title">📋 Informations générales</div>
        <div style="display:flex;flex-direction:column;gap:16px;margin-top:4px">

          <div class="form-group" style="margin:0">
            <label class="form-label">Raison sociale</label>
            <input type="text" class="form-input" id="orgEdit_name" value="${org.name || ''}" placeholder="Nom de l'entreprise" />
          </div>

          <div class="form-group" style="margin:0">
            <label class="form-label">SIRET</label>
            <div style="display:flex;gap:8px">
              <input type="text" class="form-input" id="orgEdit_siret" value="${org.siret || ''}" placeholder="14 chiffres" maxlength="14" style="flex:1;letter-spacing:2px" oninput="this.value=this.value.replace(/\D/g,'')" />
              <button type="button" class="btn-sm btn-upload" onclick="lookupSiretEdit('${dash}')" style="white-space:nowrap;padding:0 14px">🔍 Vérifier</button>
            </div>
            <div id="siretEditResult" style="display:none;margin-top:10px;border-radius:10px;padding:12px 14px;border:1px solid;font-size:12px"></div>
          </div>

          <div class="form-group" style="margin:0">
            <label class="form-label">Forme juridique</label>
            <input type="text" class="form-input" id="orgEdit_legal_form" value="${org.legal_form || ''}" placeholder="Ex: SAS, SARL, SA..." />
          </div>

          <div class="form-group" style="margin:0">
            <label class="form-label">Adresse du siège</label>
            <input type="text" class="form-input" id="orgEdit_address" value="${org.address || ''}" placeholder="12 rue de la Paix, 75001 Paris" />
          </div>

          ${isTrainer ? `
          <div class="form-group" style="margin:0">
            <label class="form-label">Lien prise de RDV</label>
            <input type="url" class="form-input" id="orgEdit_booking_url" value="${org.booking_url || ''}" placeholder="https://calendly.com/votre-centre" />
          </div>` : ''}
        </div>
      </div>

      <!-- Carte code équipe -->
      <div class="section-card">
        <div class="section-title">🔑 Code équipe</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">Partagez ce code à vos intervenants pour qu'ils se rattachent à votre organisation</div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;letter-spacing:3px;color:var(--orange)">${org.team_code || '—'}</div>
          <button class="btn-sm" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--muted)" onclick="navigator.clipboard.writeText('${org.team_code||''}').then(()=>showToast('✓ Code copié','success'))">📋 Copier</button>
        </div>
      </div>

      <!-- Carte QR Code entreprise -->
      <div class="section-card">
        <div class="section-title">📱 QR Code entreprise</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:16px">Affichez ce QR code pour permettre à vos partenaires et intervenants de vous identifier instantanément</div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:16px">
          <div style="background:linear-gradient(135deg,#1B3A5C,#0D1B2A);border:2px solid rgba(99,102,241,.35);border-radius:16px;padding:24px 28px;text-align:center;width:100%;max-width:320px">
            <div style="font-size:13px;font-weight:700;color:#A5B4FC;margin-bottom:14px;letter-spacing:.5px">${escapeHtml(org.name)}</div>
            <div id="orgQrCanvas_${dash}" style="display:inline-block;background:#fff;padding:10px;border-radius:10px;margin-bottom:14px"></div>
            <div style="font-size:11px;color:#64748B">Scannez pour vérifier cette organisation</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
            <button class="btn-sm btn-upload" onclick="copyOrgQrLink('${escapeHtml(org.org_qr_token)}')">🔗 Copier le lien</button>
            <button class="btn-sm" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--muted)" onclick="downloadOrgQr('orgQrCanvas_${dash}','${escapeHtml(org.name)}')">⬇️ Télécharger</button>
          </div>
        </div>
      </div>

      <!-- Bouton sauvegarder -->
      <button class="btn-upload" style="max-width:240px" onclick="saveOrgProfile('${org.id}','${dash}','${isTrainer}')">💾 Sauvegarder les modifications</button>

      <!-- Reset dashboard -->
      <div class="section-card" style="margin-top:8px">
        <div class="section-title">🎛 Dashboard</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">Réinitialiser la mise en page personnalisée de votre tableau de bord</div>
        <button class="btn-sm btn-reject" onclick="resetDashboardLayout()">↺ Réinitialiser le dashboard</button>
      </div>

      <!-- RGPD : Suppression de compte -->
      <div class="section-card" style="margin-top:8px;border-color:rgba(239,68,68,.25)">
        <div class="section-title" style="color:#EF4444">⚠️ Zone de danger</div>
        <div style="font-size:13px;color:var(--muted);margin-bottom:12px">La suppression de votre compte est <strong>définitive et irréversible</strong>. Toutes vos données (profil, documents, habilitations) seront effacées conformément au RGPD (Art. 17 — Droit à l'effacement).</div>
        <button class="btn-sm btn-reject" style="border-color:rgba(239,68,68,.5);color:#EF4444" onclick="confirmDeleteAccount()">🗑 Supprimer mon compte</button>
      </div>
    </div>`;

  // Générer le QR code entreprise
  if (org.org_qr_token) {
    await loadQRLib();
    const orgPublicUrl = `${window.location.origin}/?org=${org.org_qr_token}`;
    const qrEl = document.getElementById(`orgQrCanvas_${dash}`);
    if (qrEl) {
      new QRCode(qrEl, { text: orgPublicUrl, width: 140, height: 140, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }
  }
}

async function lookupSiretEdit(dash) {
  const siret  = document.getElementById('orgEdit_siret').value.trim().replace(/\s/g, '');
  const result = document.getElementById('siretEditResult');
  if (siret.length !== 14) { result.style.display='block'; result.style.background='rgba(239,68,68,.08)'; result.style.borderColor='rgba(239,68,68,.3)'; result.innerHTML='❌ 14 chiffres requis'; return; }
  result.style.display='block'; result.style.background='var(--inset-bg)'; result.style.borderColor='var(--inset-border)'; result.innerHTML='⏳ Vérification...';
  try {
    const res  = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siret}&page=1&per_page=1`);
    const data = await res.json();
    const e    = data?.results?.[0];
    if (!e) { result.style.background='rgba(239,68,68,.08)'; result.style.borderColor='rgba(239,68,68,.3)'; result.innerHTML='❌ Société introuvable'; return; }
    const actif   = e.etat_administratif === 'A';
    const nom     = e.nom_complet || e.nom_raison_sociale || '';
    const forme   = e.nature_juridique_libelle || '';
    const siege   = e.siege || {};
    const adresse = [siege.adresse, siege.code_postal, siege.libelle_commune].filter(Boolean).join(', ');
    // Pré-remplir
    document.getElementById('orgEdit_name').value       = nom;
    document.getElementById('orgEdit_legal_form').value = forme;
    document.getElementById('orgEdit_address').value    = adresse;
    result.style.background  = actif ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)';
    result.style.borderColor = actif ? 'rgba(34,197,94,.3)'  : 'rgba(239,68,68,.3)';
    result.innerHTML = `${actif ? '✅' : '⚠️'} <strong>${nom}</strong> — ${forme}${adresse ? ' — ' + adresse : ''}`;
  } catch { result.style.background='rgba(239,68,68,.08)'; result.style.borderColor='rgba(239,68,68,.3)'; result.innerHTML='❌ Erreur de connexion'; }
}

async function saveOrgProfile(orgId, dash, isTrainer) {
  const updates = {
    name:       document.getElementById('orgEdit_name').value.trim(),
    siret:      document.getElementById('orgEdit_siret').value.trim(),
    legal_form: document.getElementById('orgEdit_legal_form').value.trim(),
    address:    document.getElementById('orgEdit_address').value.trim(),
  };
  if (isTrainer === 'true') {
    updates.booking_url = document.getElementById('orgEdit_booking_url')?.value?.trim() || null;
  }
  if (!updates.name) { showToast('La raison sociale est obligatoire', 'error'); return; }
  const { error } = await sb.from('organizations').update(updates).eq('id', orgId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Entreprise mise à jour', 'success');
  // Mettre à jour le nom dans la topbar si changé
  if (updates.name !== currentProfile.company_name) currentProfile.company_name = updates.name;
}


// ══════════════════════════════════════════════════════
// ADMIN ANALYTICS — KPI globaux, par org, par user
// ══════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════
// ROLE ANALYTICS — Company / Subcontractor / HSE / Trainer
// ══════════════════════════════════════════════════════

var _roleAnalyticsState = {};  // { role: { range, from, to, data } }

// ── WIDGETS + NOTIFICATIONS ──────────────────────────────────────

const WIDGET_DEFS = {
  worker: [
    { id:'w-employer', label:'🏢 Mon Employeur',  elIds:['linkCompanyBanner','linkedCompanyBanner','changeEmployerPanel','workerExpiryAlerts'], hidden:false },
    { id:'w-notifs',   label:'🔔 Notifications',  elIds:['notifs-Worker'],    hidden:false },
    { id:'w-stats',    label:'📊 Statistiques',   elIds:['worker-stats-grid'], hidden:false },
  ],
  company: [
    { id:'c-teamcode', label:'🔑 Code Équipe',    elIds:['teamCodeBanner'],    hidden:false },
    { id:'c-notifs',   label:'🔔 Notifications',  elIds:['notifs-Company'],   hidden:false },
    { id:'c-stats',    label:'📊 Statistiques',   elIds:['company-stats-grid'],hidden:false },
  ],
  hse: [
    { id:'h-notifs',     label:'🔔 Notifications', elIds:['notifs-HSE'],         hidden:false },
    { id:'h-stats',      label:'📊 Statistiques',  elIds:['hse-stats-grid'],      hidden:false },
    { id:'h-compliance', label:'🎯 Conformité',    elIds:['hse-compliance-wrap'], hidden:false },
    { id:'h-modules',    label:'🚀 À venir',        elIds:['hse-modules-wrap'],   hidden:false },
  ],
  subcontractor: [
    { id:'s-notifs', label:'🔔 Notifications', elIds:['notifs-Subcontractor'], hidden:false },
    { id:'s-stats',  label:'📊 Statistiques',  elIds:['st-stats-grid'],         hidden:false },
  ],
  trainer: [
    { id:'t-booking', label:'📅 Réservation',   elIds:['trainerBookingBanner'],  hidden:false },
    { id:'t-notifs',  label:'🔔 Notifications', elIds:['notifs-Trainer'],        hidden:false },
    { id:'t-stats',   label:'📊 Statistiques',  elIds:['trainer-stats-grid'],    hidden:false },
  ],
};

let _customizeMode = false;
let _dragSrcWidget = null;
let _dragClone     = null;
let _dragOffX = 0, _dragOffY = 0;

// ── Point d'entrée : wrappé les éléments DOM existants dans des widgets ──
async function initDashboardWidgets(role) {
  const roleMap = { worker:'Worker', company:'Company', hse:'HSE', subcontractor:'Subcontractor', trainer:'Trainer' };
  const dash    = roleMap[role];
  const overview = document.getElementById(`${dash}-overview`);
  if (!overview || overview.dataset.widgetsInit) return;
  overview.dataset.widgetsInit = '1';

  // HSE : wrapper conformité + modules dans des divs identifiables
  if (role === 'hse') wrapHSEBlocks(overview);

  // Charger le layout sauvegardé
  const saved  = currentProfile?.dashboard_layout?.[role];
  const defs   = JSON.parse(JSON.stringify(WIDGET_DEFS[role] || []));
  const layout = saved ? mergeLayout(defs, saved) : defs;

  // Créer le conteneur grid
  const grid = document.createElement('div');
  grid.className = 'dash-grid';
  grid.id = `dash-grid-${role}`;

  // Pour chaque widget : trouver les éléments, les wrapper
  layout.forEach(wDef => {
    const els = wDef.elIds.map(id => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;

    const widget = document.createElement('div');
    widget.className = 'db-widget';
    widget.dataset.widgetId = wDef.id;
    if (wDef.hidden) widget.classList.add('hidden-widget');

    // Barre de contrôle (visible seulement en mode édition)
    const bar = document.createElement('div');
    bar.className = 'db-widget-bar';
    bar.innerHTML = `
      <span class="db-widget-handle" title="Déplacer">⠿</span>
      <span class="db-widget-label">${wDef.label}</span>
      <div class="db-widget-actions">
        <button class="db-widget-btn ${wDef.hidden ? 'active' : ''}"
          onclick="toggleWidgetVisibility(this,'${wDef.id}','${role}')"
        >${wDef.hidden ? '👁 Afficher' : '🙈 Masquer'}</button>
      </div>`;

    // Inner : déplacer les éléments dedans
    const inner = document.createElement('div');
    inner.className = 'db-widget-inner';
    els.forEach(el => inner.appendChild(el));

    widget.appendChild(bar);
    widget.appendChild(inner);
    grid.appendChild(widget);

    // Events drag touch+mouse
    initWidgetDrag(widget);
  });

  // Remplacer le contenu de l'overview (après titre + subtitle)
  const welcome  = overview.querySelector('.dash-welcome');
  const subtitle = overview.querySelector('.dash-subtitle');
  // Vider et remettre titre + grid
  Array.from(overview.children).forEach(c => {
    if (c !== welcome && c !== subtitle) overview.removeChild(c);
  });
  overview.appendChild(grid);

  // Afficher le bouton Personnaliser de ce dashboard
  const dashId = { worker:'dashWorker', company:'dashCompany', hse:'dashHSE', subcontractor:'dashSubcontractor', trainer:'dashTrainer' }[role];
  if (dashId) {
    const dashEl = document.getElementById(dashId);
    dashEl?.querySelectorAll('.btn-customize, .btn-add-kpi').forEach(b => b.style.display = '');
  }

  // Recharger les KPI personnalisés sauvegardés
  reloadSavedKpis(role);
}

// Wrapper les blocs HSE conformité + modules dans des divs avec IDs
function wrapHSEBlocks(overview) {
  // Conformité
  if (!document.getElementById('hse-compliance-wrap')) {
    const compWidget = document.getElementById('complianceWidget');
    const compHeader = compWidget?.previousElementSibling;
    if (compWidget && compHeader && compHeader.style?.justifyContent === 'space-between') {
      const wrap = document.createElement('div');
      wrap.id = 'hse-compliance-wrap';
      compHeader.parentNode.insertBefore(wrap, compHeader);
      wrap.appendChild(compHeader);
      wrap.appendChild(compWidget);
    }
  }
  // Modules à venir
  if (!document.getElementById('hse-modules-wrap')) {
    const titles = overview.querySelectorAll('.section-title');
    titles.forEach(t => {
      if (t.textContent.includes('Prochains') || t.textContent.includes('modules')) {
        const wrap = document.createElement('div');
        wrap.id = 'hse-modules-wrap';
        const next = t.nextElementSibling;
        t.parentNode.insertBefore(wrap, t);
        wrap.appendChild(t);
        if (next) wrap.appendChild(next);
      }
    });
  }
}



// ── Drag & drop universel (mouse + touch) ──
function initWidgetDrag(widget) {
  const handle = widget.querySelector('.db-widget-handle');
  if (!handle) return;

  // Mouse
  handle.addEventListener('mousedown', e => startDrag(e, widget, e.clientX, e.clientY));
  // Touch
  handle.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startDrag(e, widget, t.clientX, t.clientY);
  }, { passive: false });
}

function startDrag(e, widget, clientX, clientY) {
  e.preventDefault();
  _dragSrcWidget = widget;
  const rect = widget.getBoundingClientRect();
  _dragOffX = clientX - rect.left;
  _dragOffY = clientY - rect.top;

  // Clone flottant
  _dragClone = widget.cloneNode(true);
  _dragClone.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none;
    width:${rect.width}px; opacity:.85;
    left:${rect.left}px; top:${rect.top}px;
    box-shadow:0 20px 60px rgba(0,0,0,.5);
    border-radius:16px; transition:none;`;
  document.body.appendChild(_dragClone);
  widget.style.opacity = '.3';

  // Events globaux
  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup',   onDragEnd);
  document.addEventListener('touchmove',  onDragMove, { passive: false });
  document.addEventListener('touchend',   onDragEnd);
}

function onDragMove(e) {
  if (!_dragClone) return;
  e.preventDefault();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  _dragClone.style.left = (clientX - _dragOffX) + 'px';
  _dragClone.style.top  = (clientY - _dragOffY) + 'px';

  // Trouver le widget cible sous le curseur
  _dragClone.style.display = 'none';
  const el = document.elementFromPoint(clientX, clientY);
  _dragClone.style.display = '';
  const target = el?.closest('.db-widget');

  document.querySelectorAll('.db-widget').forEach(w => w.classList.remove('drag-over'));
  if (target && target !== _dragSrcWidget) target.classList.add('drag-over');
}

function onDragEnd(e) {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup',   onDragEnd);
  document.removeEventListener('touchmove',  onDragMove);
  document.removeEventListener('touchend',   onDragEnd);

  const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
  const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

  // Trouver la cible
  if (_dragClone) { _dragClone.style.display = 'none'; }
  const el     = document.elementFromPoint(clientX, clientY);
  const target = el?.closest('.db-widget');
  if (_dragClone) { _dragClone.style.display = ''; }

  if (target && target !== _dragSrcWidget) {
    const grid   = _dragSrcWidget.closest('.dash-grid');
    const widgets = [...grid.querySelectorAll(':scope > .db-widget')];
    const srcIdx  = widgets.indexOf(_dragSrcWidget);
    const tgtIdx  = widgets.indexOf(target);
    if (srcIdx < tgtIdx) grid.insertBefore(_dragSrcWidget, target.nextSibling);
    else                  grid.insertBefore(_dragSrcWidget, target);
    saveLayout(currentProfile.role);
  }

  // Nettoyer
  if (_dragClone) { _dragClone.remove(); _dragClone = null; }
  if (_dragSrcWidget) { _dragSrcWidget.style.opacity = ''; _dragSrcWidget = null; }
  document.querySelectorAll('.db-widget').forEach(w => w.classList.remove('drag-over'));
}


// ── Masquer/Afficher ──
function toggleWidgetVisibility(btn, widgetId, role) {
  const widget  = document.querySelector(`[data-widget-id="${widgetId}"]`);
  if (!widget) return;
  const isHidden = widget.classList.toggle('hidden-widget');
  btn.classList.toggle('active', isHidden);
  btn.textContent = isHidden ? '👁 Afficher' : '🙈 Masquer';
  saveLayout(role);
}

// ── Mode personnalisation ──
function toggleCustomizeMode() {
  _customizeMode = !_customizeMode;
  const role = currentProfile?.role;
  const map  = { worker:'Worker', company:'Company', hse:'HSE', subcontractor:'Subcontractor', trainer:'Trainer' };
  const dash = map[role];
  if (!dash) return;

  const overview = document.getElementById(`${dash}-overview`);
  if (!overview) return;
  overview.classList.toggle('customize-mode', _customizeMode);

  // Mettre à jour tous les boutons personnaliser
  document.querySelectorAll('.btn-customize').forEach(b => {
    b.classList.toggle('active', _customizeMode);
    b.textContent = _customizeMode ? '✓ Terminer' : '✏️ Personnaliser';
  });

  // Bouton ➕ Indicateur : afficher/masquer selon mode
  document.querySelectorAll('.btn-add-kpi').forEach(b => { b.style.display = _customizeMode ? '' : 'none'; });

  if (!_customizeMode) saveLayout(role);
}

// ── Sauvegarde layout ──
async function saveLayout(role) {
  const map  = { worker:'Worker', company:'Company', hse:'HSE', subcontractor:'Subcontractor', trainer:'Trainer' };
  const dash = map[role];
  const grid = document.getElementById(`dash-grid-${role}`);
  if (!grid || !dash) return;

  const layout = [...grid.querySelectorAll('.db-widget')].map(w => ({
    id:     w.dataset.widgetId,
    size:   w.dataset.size || 'md',
    hidden: w.classList.contains('hidden-widget'),
    height: w.querySelector('.db-widget-inner')?.style.maxHeight || null,
  }));

  const existing = currentProfile.dashboard_layout || {};
  existing[role] = layout;
  currentProfile.dashboard_layout = existing;

  const { error } = await sb.from('profiles').update({ dashboard_layout: existing }).eq('id', currentUser.id);
  if (error) console.warn('saveLayout error', error.message);
}

function mergeLayout(defs, saved) {
  const savedMap = {};
  saved.forEach(s => savedMap[s.id] = s);
  // Ordre sauvegardé, fusionné avec les defs par défaut
  const result = saved.map(s => {
    const def = defs.find(d => d.id === s.id);
    return def ? { ...def, ...s } : null;
  }).filter(Boolean);
  // Ajouter nouveaux widgets non encore en layout
  defs.forEach(d => { if (!savedMap[d.id]) result.push(d); });
  return result;
}

// ── Réinitialiser (appelé depuis profil) ──
async function resetDashboardLayout() {
  if (!confirm('Réinitialiser la mise en page du dashboard ?')) return;
  const role = currentProfile?.role;
  const existing = currentProfile.dashboard_layout || {};
  delete existing[role];
  currentProfile.dashboard_layout = existing;
  const { error } = await sb.from('profiles').update({ dashboard_layout: existing }).eq('id', currentUser.id);
  if (error) { showToast('Erreur réinitialisation : ' + error.message, 'error'); return; }
  showToast('✓ Dashboard réinitialisé', 'success');
  // Recharger
  showDashboard(role, currentProfile.full_name);
}



function scrollToNotifs() {
  const role = currentProfile?.role;
  const map = {
    worker:        { dash:'Worker',        bellId:'notifBell-Worker' },
    company:       { dash:'Company',       bellId:'notifBell-Company' },
    hse:           { dash:'HSE',           bellId:'notifBell-HSE' },
    subcontractor: { dash:'Subcontractor', bellId:'notifBell-Subcontractor' },
    trainer:       { dash:'Trainer',       bellId:'notifBell-Trainer' }
  };
  const target = map[role];
  if (!target) return;

  // Cliquer sur le premier onglet (Accueil) du bon dashboard
  const firstTab = document.querySelector(`#dash${target.dash} .nav-tab`);
  if (firstTab) firstTab.click();

  // Scroll vers la section notifications après affichage
  setTimeout(() => {
    const el = document.getElementById(`notifs-${target.dash}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 150);
}

function renderNotifItem(icon, title, sub, type, action, onClick) {
  const div = document.createElement('div');
  div.className = `notif-item notif-${type}`;
  div.innerHTML = `
    <div class="notif-icon">${escapeHtml(icon)}</div>
    <div class="notif-body">
      <div class="notif-body-title">${escapeHtml(title)}</div>
      <div class="notif-body-sub">${escapeHtml(sub)}</div>
      ${action ? `<div class="notif-action">→ ${escapeHtml(action)}</div>` : ''}
    </div>`;
  if (onClick) div.addEventListener('click', onClick);
  return div;
}

async function loadNotifications(role) {
  const map  = { worker:'Worker', company:'Company', hse:'HSE', subcontractor:'Subcontractor', trainer:'Trainer' };
  const dash = map[role];
  if (!dash) return;
  const container = document.getElementById(`notifs-${dash}`);
  if (!container) return;

  const items  = [];
  const now    = new Date();
  const soon   = new Date(now); soon.setDate(soon.getDate() + 30);
  const nowIso = now.toISOString();
  const soonIso= soon.toISOString();

  // ── WORKER ──
  if (role === 'worker') {
    const [{ data: docs }, { data: invites }] = await Promise.all([
      sb.from('documents').select('doc_type, status, expires_at').eq('owner_id', currentUser.id).eq('category','worker'),
      sb.from('worker_invites').select('id, org_id').eq('worker_email', currentProfile.email)
    ]);

    // Docs refusés
    (docs || []).filter(d => d.status === 'rejected').forEach(d =>
      items.push({ icon:'❌', title:`Document refusé : ${d.doc_type}`, sub:'Déposez une nouvelle version pour le soumettre à validation', type:'danger', action:'Mes Habilitations', onClick:() => switchPage('Worker','docs', null) })
    );
    // Docs en attente depuis longtemps
    (docs || []).filter(d => d.status === 'pending').forEach(d =>
      items.push({ icon:'⏳', title:`En attente de validation : ${d.doc_type}`, sub:'Un centre de formation va traiter votre demande', type:'info', action:null })
    );
    // Expirations proches
    (docs || []).filter(d => d.status === 'validated' && d.expires_at && d.expires_at <= soonIso && d.expires_at > nowIso).forEach(d => {
      const days = Math.ceil((new Date(d.expires_at) - now) / 86400000);
      items.push({ icon:'⚠️', title:`Expire dans ${days} jour(s) : ${d.doc_type}`, sub:`Date d'expiration : ${new Date(d.expires_at).toLocaleDateString('fr-FR')}`, type:'warning', action:'Voir mes habilitations', onClick:() => switchPage('Worker','docs', null) });
    });
    // Docs expirés
    (docs || []).filter(d => d.expires_at && d.expires_at < nowIso && d.status === 'validated').forEach(d =>
      items.push({ icon:'🚨', title:`Expiré : ${d.doc_type}`, sub:`Expiré le ${new Date(d.expires_at).toLocaleDateString('fr-FR')} — renouvelez dès que possible`, type:'danger', action:'Renouveler', onClick:() => switchPage('Worker','docs', null) })
    );
  }

  // ── COMPANY ──
  else if (role === 'company') {
    const orgId = currentProfile.org_id;
    // D'abord récupérer les IDs des workers de l'org
    const { data: orgWorkers } = await sb.from('profiles').select('id').eq('org_id', orgId);
    const workerIds = (orgWorkers || []).map(p => p.id);

    const [{ data: pending }, { data: missions }, { data: myDocs }] = await Promise.all([
      workerIds.length
        ? sb.from('documents').select('id, doc_type').eq('category','worker').eq('status','pending').in('owner_id', workerIds)
        : Promise.resolve({ data: [] }),
      sb.from('missions').select('id, title, st_org_id').eq('eu_org_id', orgId).eq('status','pending'),
      sb.from('documents').select('doc_type, expires_at, status').eq('owner_id', currentUser.id).eq('category','company')
    ]);

    (pending || []).forEach(d =>
      items.push({ icon:'📋', title:`Document en attente de validation`, sub:`Un intervenant attend votre validation`, type:'info', action:'Voir les intervenants', onClick:() => switchPage('Company','workers', null) })
    );
    (missions || []).forEach(m =>
      items.push({ icon:'🏗', title:`Nouvelle mission à valider : ${m.title}`, sub:`Un sous-traitant soumet une mission pour approbation`, type:'info', action:'Voir sous-traitants', onClick:() => switchPage('Company','subcontractors', null) })
    );
    (myDocs || []).filter(d => d.status === 'validated' && d.expires_at && d.expires_at <= soonIso && d.expires_at > nowIso).forEach(d => {
      const days = Math.ceil((new Date(d.expires_at) - now) / 86400000);
      items.push({ icon:'⚠️', title:`Document société expire dans ${days} jour(s) : ${d.doc_type}`, sub:`Renouvelez votre document avant expiration`, type:'warning', action:'Mes Documents', onClick:() => switchPage('Company','societedocs', null) });
    });
  }

  // ── HSE ──
  else if (role === 'hse') {
    const orgId = currentProfile.org_id;
    const { data: missions } = await sb.from('missions').select('id, title, st_org_id').eq('eu_org_id', orgId).eq('status','pending');

    (missions || []).forEach(m =>
      items.push({ icon:'🏗', title:`Nouvelle mission à valider : ${m.title}`, sub:`Un sous-traitant attend votre approbation`, type:'info', action:'Voir sous-traitants', onClick:() => switchPage('HSE','contractors', null) })
    );

    // Docs workers expirés ou proches dans les EU gérées
    const { data: rels } = await sb.from('org_relationships').select('st_org_id').eq('eu_org_id', orgId);
    if (rels && rels.length) {
      const stIds = rels.map(r => r.st_org_id);
      const { data: stProfiles } = await sb.from('profiles').select('id').in('org_id', stIds).eq('role','worker');
      const wIds = (stProfiles || []).map(p => p.id);
      if (wIds.length) {
        const { data: expDocs } = await sb.from('documents').select('doc_type, expires_at').in('owner_id', wIds).eq('category','worker').eq('status','validated').lte('expires_at', soonIso).gte('expires_at', nowIso);
        if (expDocs && expDocs.length)
          items.push({ icon:'⚠️', title:`${expDocs.length} habilitation(s) expirent bientôt`, sub:`Des intervenants de vos ST ont des documents à renouveler`, type:'warning', action:'Voir sous-traitants', onClick:() => switchPage('HSE','contractors', null) });
      }
    }
  }

  // ── SUBCONTRACTOR ──
  else if (role === 'subcontractor') {
    const orgId = currentProfile.org_id;
    const { data: missions } = await sb.from('missions').select('id, title, status, eu_org_id').eq('st_org_id', orgId).in('status',['approved','rejected']);

    (missions || []).filter(m => m.status === 'approved').forEach(m =>
      items.push({ icon:'✅', title:`Mission validée : ${m.title}`, sub:`L'EU a approuvé votre mission — vous pouvez démarrer`, type:'success', action:'Voir mes EU', onClick:() => { switchPage('Subcontractor','eu', null); loadSTEU(); } })
    );
    (missions || []).filter(m => m.status === 'rejected').forEach(m =>
      items.push({ icon:'❌', title:`Mission refusée : ${m.title}`, sub:`L'EU a refusé cette mission — modifiez-la et soumettez à nouveau`, type:'danger', action:'Voir mes EU', onClick:() => { switchPage('Subcontractor','eu', null); loadSTEU(); } })
    );

    // Docs société expiration proche
    const { data: myDocs } = await sb.from('documents').select('doc_type, expires_at, status').eq('owner_id', currentUser.id).eq('category','company');
    (myDocs || []).filter(d => d.status === 'validated' && d.expires_at && d.expires_at <= soonIso && d.expires_at > nowIso).forEach(d => {
      const days = Math.ceil((new Date(d.expires_at) - now) / 86400000);
      items.push({ icon:'⚠️', title:`Document société expire dans ${days} jour(s) : ${d.doc_type}`, sub:`Renouvelez avant expiration pour rester conforme`, type:'warning', action:'Mes Documents', onClick:() => switchPage('Subcontractor','docs', null) });
    });
  }

  // ── TRAINER ──
  else if (role === 'trainer') {
    const { data: pending } = await sb.from('documents').select('id, doc_type').eq('training_center_id', currentProfile.org_id).eq('center_status','pending');
    if (pending && pending.length)
      items.push({ icon:'📋', title:`${pending.length} demande(s) de validation en attente`, sub:`Des intervenants attendent votre traitement`, type:'info', action:'Voir les demandes', onClick:() => switchPage('Trainer','requests', null) });
  }

  // ── NOTIFICATIONS DEMANDES DE SIGNATURE (tous rôles) ──
  // Chercher les items en attente pour l'email courant
  const { data: sigItems } = await sb.from('signature_request_items')
    .select('id, signer_role, token, seq, signature_requests(report_num, report_type, workflow_mode, total_signers, signed_count, created_at)')
    .eq('signer_email', currentProfile.email)
    .eq('status', 'pending');

  (sigItems || []).forEach(item => {
    const req = item.signature_requests || {};
    const modeLabel = req.workflow_mode === 'sequential' ? 'Séquentiel' : 'Parallèle';
    const progress  = (req.signed_count || 0) + '/' + (req.total_signers || '?');
    const sigUrl    = window.location.pathname + '?sign=' + item.token;
    items.push({
      icon   : '✍️',
      title  : `Signature requise — ${req.report_type || 'Document'} ${req.report_num || ''}`.trim(),
      sub    : `Workflow ${modeLabel} · Progression : ${progress} · Votre rôle : ${item.signer_role || 'Signataire'}`,
      type   : 'warning',
      action : 'Signer maintenant →',
      onClick: () => { window.location.href = sigUrl; }
    });
  });

  // ── RENDU ──
  container.innerHTML = '';
  if (!items.length) return;

  // En-tête section
  const header = document.createElement('div');
  header.id = 'notifsSectionAnchor';
  header.innerHTML = `<div class="section-title" style="margin-bottom:12px">🔔 Notifications <span style="font-size:12px;font-weight:400;color:var(--muted)">(${items.length})</span></div>`;
  container.appendChild(header);

  items.forEach(item => {
    container.appendChild(renderNotifItem(item.icon, item.title, item.sub, item.type, item.action, item.onClick));
  });

  // Activer la cloche du dashboard courant
  const bellMap = { worker:'notifBell-Worker', company:'notifBell-Company', hse:'notifBell-HSE', subcontractor:'notifBell-Subcontractor', trainer:'notifBell-Trainer' };
  const bellId = bellMap[role];
  if (bellId) {
    const bell = document.getElementById(bellId);
    if (bell) bell.classList.toggle('has-notif', items.length > 0);
  }
}



// ── Modale création / édition ──
function openCreateMissionModal(euOrgId, euName) {

// ── RAPPORT HELPERS ──────────────────────────────────────

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

// ── KPI CATALOG ──────────────────────────────────────

function openKpiCatalog() {
  var role   = currentProfile && currentProfile.role;
  var catalog = KPI_CATALOG[role] || [];
  var active  = getActiveKpiIds(role);

  _kpiSelected = [];
  document.getElementById('kpiAddBtn').disabled = true;

  var grid = document.getElementById('kpiCatalogGrid');
  if (!catalog.length) {
    grid.innerHTML = '<div class="empty-state-text" style="padding:20px">Aucun indicateur disponible pour ce rôle.</div>';
  } else {
    grid.innerHTML = catalog.map(function(kpi) {
      var already = active.indexOf(kpi.id) >= 0;
      return '<div class="kpi-catalog-card' + (already ? ' already-added' : '') + '" data-kpi-id="' + kpi.id + '" onclick="toggleKpiSelect(this)">'
        + (already ? '<span class="kpi-catalog-badge">✓ Ajouté</span>' : '')
        + '<div class="kpi-catalog-icon">' + kpi.icon + '</div>'
        + '<div class="kpi-catalog-name">' + escapeHtml(kpi.name) + '</div>'
        + '<div class="kpi-catalog-desc">' + escapeHtml(kpi.desc) + '</div>'
        + '</div>';
    }).join('');
  }
  document.getElementById('kpiCatalogModal').classList.add('open');
}

function closeKpiCatalog() {
  document.getElementById('kpiCatalogModal').classList.remove('open');
  _kpiSelected = [];
}

function toggleKpiSelect(card) {
  var id = card.dataset.kpiId;
  var idx = _kpiSelected.indexOf(id);
  if (idx >= 0) { _kpiSelected.splice(idx,1); card.classList.remove('selected'); }
  else          { _kpiSelected.push(id);       card.classList.add('selected'); }
  document.getElementById('kpiAddBtn').disabled = _kpiSelected.length === 0;
  document.getElementById('kpiAddBtn').textContent = _kpiSelected.length > 1
    ? '✓ Ajouter ' + _kpiSelected.length + ' indicateurs'
    : '✓ Ajouter la sélection';
}

function getActiveKpiIds(role) {
  var layout = currentProfile && currentProfile.dashboard_layout && currentProfile.dashboard_layout[role];
  if (!layout) return [];
  return layout.filter(function(w) { return w.id && w.id.indexOf('kpi-') === 0; }).map(function(w) { return w.id.replace('kpi-',''); });
}

// ── Ajouter les KPI sélectionnés au dashboard ──────────
async function addSelectedKpis() {
  if (!_kpiSelected.length) return;
  var role    = currentProfile && currentProfile.role;
  var catalog = KPI_CATALOG[role] || [];
  var grid    = document.getElementById('dash-grid-' + role);
  if (!grid) { showToast('Ouvrez d\'abord l\'onglet Accueil', 'error'); return; }

  var btn = document.getElementById('kpiAddBtn');
  btn.disabled = true; btn.textContent = '⏳ Chargement...';

  for (var i = 0; i < _kpiSelected.length; i++) {
    var kpiId = _kpiSelected[i];
    var kpi   = catalog.find(function(k) { return k.id === kpiId; });
    if (!kpi) continue;
    await appendKpiWidget(grid, kpi, role);
  }

  closeKpiCatalog();
  await saveLayout(role);
  showToast(_kpiSelected.length === 1 ? 'Indicateur ajouté !' : _kpiSelected.length + ' indicateurs ajoutés !', 'success');
}

async function appendKpiWidget(grid, kpi, role) {
  var widgetId = 'kpi-' + kpi.id;

  // Éviter doublon
  if (grid.querySelector('[data-widget-id="' + widgetId + '"]')) return;

  // Créer le conteneur KPI live
  var kpiEl = document.createElement('div');
  kpiEl.id  = 'kpi-el-' + kpi.id;
  kpiEl.className = 'kpi-live-card';
  kpiEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    + '<span style="font-size:26px">' + kpi.icon + '</span>'
    + '<div class="kpi-live-label" style="font-size:13px;font-weight:700;color:var(--text2)">' + escapeHtml(kpi.name) + '</div>'
    + '</div>'
    + '<div class="kpi-live-value" style="color:' + kpi.color + '">…</div>'
    + '<div class="kpi-live-label">' + escapeHtml(kpi.desc) + '</div>';

  // Wrapper widget
  var widget = document.createElement('div');
  widget.className    = 'db-widget';
  widget.dataset.widgetId = widgetId;

  var bar = document.createElement('div');
  bar.className = 'db-widget-bar';
  bar.innerHTML = '<span class="db-widget-handle" title="Déplacer">⠿</span>'
    + '<span class="db-widget-label">' + kpi.icon + ' ' + escapeHtml(kpi.name) + '</span>'
    + '<div class="db-widget-actions">'
    + '<button class="db-widget-btn" onclick="toggleWidgetVisibility(this,\'' + widgetId + '\',\'' + role + '\')">🙈 Masquer</button>'
    + '<button class="db-widget-btn" style="color:#FCA5A5;border-color:rgba(239,68,68,.3)" onclick="removeKpiWidget(this,\'' + widgetId + '\',\'' + role + '\')">✕ Supprimer</button>'
    + '</div>';

  var inner = document.createElement('div');
  inner.className = 'db-widget-inner';
  inner.appendChild(kpiEl);

  widget.appendChild(bar);
  widget.appendChild(inner);
  grid.appendChild(widget);
  initWidgetDrag(widget);

  // Charger la valeur
  try {
    var result = await kpi.fetch();
    var valEl  = kpiEl.querySelector('.kpi-live-value');
    if (valEl) valEl.textContent = result.value !== undefined ? result.value : '—';
  } catch(e) {
    var valEl = kpiEl.querySelector('.kpi-live-value');
    if (valEl) valEl.textContent = '—';
  }
}

// ── Supprimer un KPI du dashboard ──────────────────────
async function removeKpiWidget(btn, widgetId, role) {
  if (!confirm('Supprimer cet indicateur du dashboard ?')) return;
  var widget = btn.closest('.db-widget');
  if (widget) widget.remove();
  await saveLayout(role);
  showToast('Indicateur supprimé', 'success');
}

// ── Recharger les KPI custom au chargement du dashboard ─
async function reloadSavedKpis(role) {
  var layout = currentProfile && currentProfile.dashboard_layout && currentProfile.dashboard_layout[role];
  if (!layout) return;
  var grid    = document.getElementById('dash-grid-' + role);
  if (!grid) return;
  var catalog = KPI_CATALOG[role] || [];

  for (var i = 0; i < layout.length; i++) {
    var w = layout[i];
    if (!w.id || w.id.indexOf('kpi-') !== 0) continue;
    var kpiId = w.id.replace('kpi-','');
    var kpi   = catalog.find(function(k) { return k.id === kpiId; });
    if (!kpi) continue;
    await appendKpiWidget(grid, kpi, role);
    // Appliquer hidden si sauvegardé
    if (w.hidden) {
      var el = grid.querySelector('[data-widget-id="' + w.id + '"]');
      if (el) el.classList.add('hidden-widget');
    }
  }
}


// ══════════════════════════════════════════════════════════════
// SYSTÈME D'ARCHIVE DES RAPPORTS
// Tables Supabase : report_archive, report_trash
// ══════════════════════════════════════════════════════════════

var _extReportFile = null;
var _histShowTrash = false;

// ── Archiver automatiquement à chaque génération SafetySphere ─

// ── ARCHIVAGE + HISTORIQUE ──────────────────────────────────────

// ── Archiver automatiquement à chaque génération SafetySphere ─
async function archiveReport(meta, reportType, htmlContent) {
  if (!currentProfile || !currentProfile.org_id) {
    console.warn('[Archive] Impossible d\'archiver : profil ou org_id manquant');
    return null;
  }
  if (!meta || !meta.reportNum) {
    console.warn('[Archive] Impossible d\'archiver : meta.reportNum manquant', meta);
    return null;
  }

  // Stocker le HTML dans Supabase Storage (bucket rapport-archives)
  // L'échec du storage n'empêche pas l'archivage en base
  var fileUrl = null;
  try {
    var filePath  = currentProfile.org_id + '/' + meta.reportNum + '.html';
    var htmlBlob  = new Blob([htmlContent], { type:'text/html;charset=utf-8' });
    var uploadRes = await sb.storage.from('rapport-archives').upload(filePath, htmlBlob, { upsert: true });
    if (uploadRes.error) {
      console.warn('[Archive] Storage upload échoué :', uploadRes.error.message, '— archivage sans fichier');
    } else {
      var signed = await sb.storage.from('rapport-archives').createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (!signed.error) fileUrl = signed.data.signedUrl;
    }
  } catch(storageErr) {
    console.warn('[Archive] Exception storage :', storageErr, '— archivage sans fichier');
  }

  var entry = {
    org_id        : currentProfile.org_id,
    created_by    : currentUser.id,
    responsable   : meta.responsable || currentProfile.full_name || currentProfile.email || '',
    email         : meta.email       || currentProfile.email || '',
    report_num    : meta.reportNum,
    report_type   : reportType,
    label         : reportType + ' — ' + (meta.orgName || meta.euNom || meta.site || 'Rapport'),
    source        : 'safetysphere',
    app_version   : meta.appVersion  || null,
    generated_at  : meta.isoDate     || new Date().toISOString(),
    file_url      : fileUrl,
  };

  var res = await sb.from('report_archive').insert(entry).select().single();
  if (res.error) {
    console.error('[Archive] Insert DB échoué :', res.error.message);
    showToast('⚠️ Archivage échoué : ' + res.error.message, 'error');
    return null;
  }

  // Exposer l'ID au viewer pour le bouton 'Envoyer pour signature'
  _lastArchivedId = res.data ? res.data.id : null;
  var btn = document.getElementById('viewerSendSigBtn');
  if (btn && res.data) {
    var _aid = res.data.id; var _anum = meta.reportNum; var _atype = reportType;
    var _ahtml = htmlContent; var _ameta = meta;
    btn.style.display = '';
    btn.onclick = function() { openSendForSignatureModal(_aid, _anum, _atype, _ahtml, _ameta); };
  }
  return res.data;
}

// ── Afficher l'onglet Historique ──────────────────────────────
async function renderHistoriqueSection(role) {
  var container = document.getElementById(role + '-conform-historique');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Chargement de l\'historique...</div></div>';

  // Charger archive + corbeille
  var archRes   = await sb.from('report_archive').select('*').eq('org_id', currentProfile.org_id).order('generated_at', { ascending: false });
  var trashRes  = await sb.from('report_trash').select('*').eq('org_id', currentProfile.org_id).order('deleted_at', { ascending: false });

  var allArchives = archRes.data || [];
  // Séparer parents et enfants (documents consolidés rattachés à un parent)
  var archives  = allArchives.filter(function(a) { return !a.parent_id; });
  var children  = allArchives.filter(function(a) { return !!a.parent_id; });
  var trashed   = trashRes.data || [];

  // Purger les éléments corbeille > 30j
  var now30 = new Date(); now30.setDate(now30.getDate() - 30);
  var toPurge = trashed.filter(function(t) { return new Date(t.deleted_at) < now30; });
  if (toPurge.length) {
    await sb.from('report_trash').delete().in('id', toPurge.map(function(t){ return t.id; }));
    trashed = trashed.filter(function(t) { return new Date(t.deleted_at) >= now30; });
  }

  var html = '';

  // Barre d'actions
  html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">'
    + '<button class="btn-sm btn-upload" onclick="openReportUploadModal()" style="padding:8px 16px">📤 Archiver un rapport externe</button>'
    + '<button class="btn-sm btn-view" onclick="toggleHistTrash(\'' + role + '\')" style="padding:8px 16px">'
    + (trashed.length ? '🗑️ Corbeille (' + trashed.length + ')' : '🗑️ Corbeille')
    + '</button>'
    + '<span style="margin-left:auto;font-size:11px;color:var(--muted)">Corbeille : 30 jours · ' + archives.length + ' rapport(s) · ' + children.length + ' consolidé(s)</span>'
    + '</div>';

  if (_histShowTrash) {
    // ── Vue corbeille ──
    html += '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:16px;margin-bottom:20px">'
      + '<div style="font-size:13px;font-weight:700;color:#FCA5A5;margin-bottom:12px">🗑️ Corbeille — éléments supprimés (restauration possible sous 30 jours)</div>';
    if (!trashed.length) {
      html += '<div style="font-size:12px;color:var(--muted);padding:8px">La corbeille est vide.</div>';
    } else {
      trashed.forEach(function(t) {
        var deletedDate = new Date(t.deleted_at).toLocaleDateString('fr-FR');
        var purgeDateD  = new Date(t.deleted_at); purgeDateD.setDate(purgeDateD.getDate()+30);
        var daysLeft    = Math.ceil((purgeDateD - new Date()) / 86400000);
        html += '<div class="archive-card trashed" style="margin-bottom:10px">'
          + '<div class="archive-icon">' + typeIcon(t.report_type) + '</div>'
          + '<div class="archive-meta">'
          + '<div class="archive-ref">' + escapeHtml(t.report_num || '—') + '</div>'
          + '<div class="archive-title">' + escapeHtml(t.label || t.report_type) + '</div>'
          + '<div class="archive-sub">Supprimé le ' + deletedDate + ' · Purge dans ' + daysLeft + 'j</div>'
          + '<div class="archive-sub">Par : ' + escapeHtml(t.responsable || '—') + '</div>'
          + '</div>'
          + '<span class="archive-badge trash">Corbeille</span>'
          + '<div class="archive-actions">'
          + '<button class="btn-sm btn-validate" style="padding:5px 12px;font-size:11px" onclick="restoreFromTrash(\'' + t.id + '\',\'' + role + '\')">↩ Restaurer</button>'
          + '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#FCA5A5" onclick="purgeTrashItem(\'' + t.id + '\',\'' + role + '\')">✕ Supprimer définitivement</button>'
          + '</div>'
          + '</div>';
      });
    }
    html += '</div>';
  }

  // ── Vue archive principale ──
  if (!archives.length) {
    html += '<div class="empty-state"><div class="empty-state-icon">📭</div>'
      + '<div class="empty-state-text">Aucun rapport archivé<br><small>Les rapports générés via SafetySphere apparaîtront automatiquement ici</small></div></div>';
  } else {
    // Grouper par mois
    var groups = {};
    archives.forEach(function(a) {
      var d = new Date(a.generated_at);
      var key = d.toLocaleDateString('fr-FR', { month:'long', year:'numeric' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });

    Object.keys(groups).forEach(function(month) {
      html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin:18px 0 10px">'
        + month + ' <span style="font-weight:400">(' + groups[month].length + ')</span></div>';
      groups[month].forEach(function(a) {
        var genDate  = new Date(a.generated_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
        var genTime  = new Date(a.generated_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
        var isSS     = a.source === 'safetysphere';

        // Trouver les documents enfants (consolidés multi-sig) rattachés à ce parent
        var childDocs = children.filter(function(c) { return c.parent_id === a.id; });

        html += '<div class="archive-card" style="margin-bottom:' + (childDocs.length ? '0' : '10px') + ';border-radius:' + (childDocs.length ? '14px 14px 0 0' : '14px') + '">'
          + '<div class="archive-icon">' + typeIcon(a.report_type) + '</div>'
          + '<div class="archive-meta">'
          + '<div class="archive-ref">' + escapeHtml(a.report_num || '—') + '</div>'
          + '<div class="archive-title">' + escapeHtml(a.label) + '</div>'
          + '<div class="archive-sub">' + genDate + ' à ' + genTime + ' · Par : ' + escapeHtml(a.responsable || '—') + '</div>'
          + (a.app_version ? '<div class="archive-sub" style="color:rgba(249,115,22,.7)">SafetySphere v' + escapeHtml(a.app_version) + '</div>' : '')
          + (a.sig_status && a.sig_status !== 'none' ? '<div class="archive-sub" style="margin-top:4px">Signataires : ' + (a.sig_signed || 0) + '/' + (a.sig_total || '?') + '</div>' : '')
          + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
          + '<span class="archive-badge ' + (isSS ? 'ss' : 'ext') + '">' + (isSS ? '⬡ SafetySphere' : '📤 Externe') + '</span>'
          + sigStatusBadge(a)
          + '</div>'
          + '<div class="archive-actions">'
          + (a.file_url ? '<button class="btn-sm btn-view" style="padding:5px 12px;font-size:11px" onclick="openReportViewer(\'' + a.file_url + '\',\'' + escapeHtml(a.report_num||a.label) + '\',\'' + (a.source==='safetysphere'?'html':'ext') + '\',\'' + a.id + '\')">📄 Consulter</button>' : '<span style="font-size:11px;color:var(--muted)">Pas de fichier</span>')
          + (a.signed_file_url ? '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.25);color:#86EFAC" onclick="openReportViewer(\'' + a.signed_file_url + '\',\'Signé — ' + escapeHtml(a.report_num||a.label) + '\',\'ext\',\'' + a.id + '\')">🖊️ Signé</button>' : '')
          + (!a.signed_file_url && (!a.sig_status || a.sig_status === 'none') ? '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.25);color:#A5B4FC" onclick="openUploadSignedScanModal(\'' + a.id + '\',\'' + escapeHtml(a.report_num||a.label) + '\')">📤 Scan signé</button>' : '')
          + (!a.sig_status || a.sig_status === 'none' ? '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.25);color:#FCD34D" onclick="openSendForSignatureModal(\'' + a.id + '\',\'' + escapeHtml(a.report_num) + '\',\'' + escapeHtml(a.report_type) + '\',null,null)">✉️ Envoyer</button>' : '')
          + '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.25);color:#FCA5A5" onclick="moveToTrash(\'' + a.id + '\',\'' + role + '\')">🗑️</button>'
          + '</div>'
          + '</div>';

        // ── Sous-cartes : documents enfants (consolidés signés) ──
        if (childDocs.length) {
          html += '<div style="margin-left:24px;margin-bottom:10px;border-left:3px solid rgba(249,115,22,.3)">';
          childDocs.forEach(function(c, ci) {
            var cDate = new Date(c.generated_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
            var cTime = new Date(c.generated_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
            var isLast = ci === childDocs.length - 1;
            html += '<div class="archive-card" style="margin-bottom:' + (isLast ? '0' : '4px') + ';border-radius:' + (isLast ? '0 0 14px 14px' : '0') + ';border-top:none;background:rgba(34,197,94,.03);border-color:rgba(34,197,94,.2)">'
              + '<div style="font-size:18px;flex-shrink:0">🖊️</div>'
              + '<div class="archive-meta" style="flex:1">'
              + '<div class="archive-ref" style="color:var(--success);font-size:11px">' + escapeHtml(c.report_num || '—') + '</div>'
              + '<div class="archive-title" style="font-size:13px">' + escapeHtml(c.label || 'Document consolidé multi-signataires') + '</div>'
              + '<div class="archive-sub">' + cDate + ' à ' + cTime + ' · Document final consolidé</div>'
              + '</div>'
              + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
              + '<span class="archive-badge" style="background:rgba(34,197,94,.12);color:#86EFAC;border:1px solid rgba(34,197,94,.25)">✅ Signé complet</span>'
              + '</div>'
              + '<div class="archive-actions">'
              + (c.file_url ? '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.25);color:#86EFAC" onclick="openReportViewer(\'' + c.file_url + '\',\'Consolidé — ' + escapeHtml(c.report_num||'') + '\',\'ext\',\'' + c.parent_id + '\')">📄 Consulter</button>' : '')
              + '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.25);color:#FCA5A5" onclick="moveChildToTrash(\'' + c.id + '\',\'' + role + '\')">🗑️</button>'
              + '</div>'
              + '</div>';
          });
          html += '</div>';
        }
      });
    });
  }

  container.innerHTML = html;
}

function typeIcon(t) {
  var m = { DUER:'📄', VGP:'🔧', FDS:'⚗️', PDP:'📋', AUDIT:'🔍', AUTRE:'📎' };
  return m[t] || '📎';
}

function toggleHistTrash(role) {
  _histShowTrash = !_histShowTrash;
  renderHistoriqueSection(role);
}

// ── Supprimer vers corbeille ──────────────────────────────────
async function moveToTrash(archiveId, role) {
  if (!confirm('Déplacer ce rapport vers la corbeille ?\nIl sera définitivement supprimé après 30 jours.')) return;

  // Copier l'entrée dans report_trash
  var res = await sb.from('report_archive').select('*').eq('id', archiveId).single();
  if (res.error || !res.data) { showToast('Erreur lors de la suppression', 'error'); return; }

  var entry = Object.assign({}, res.data);
  delete entry.id;
  entry.original_id  = archiveId;
  entry.deleted_at   = new Date().toISOString();
  entry.deleted_by   = currentUser.id;

  var insRes = await sb.from('report_trash').insert(entry);
  if (insRes.error) { showToast('Erreur corbeille : ' + insRes.error.message, 'error'); return; }

  // Supprimer de l'archive principale (enfants aussi)
  await sb.from('report_archive').delete().eq('parent_id', archiveId);
  await sb.from('report_archive').delete().eq('id', archiveId);
  showToast('Rapport déplacé dans la corbeille (30 jours)', 'success');
  renderHistoriqueSection(role);
}

// ── Supprimer un document enfant (consolidé) vers corbeille ──
async function moveChildToTrash(childId, role) {
  if (!confirm('Supprimer ce document consolidé ?\nIl sera placé en corbeille (30 jours).')) return;

  var res = await sb.from('report_archive').select('*').eq('id', childId).single();
  if (res.error || !res.data) { showToast('Erreur', 'error'); return; }

  var entry = Object.assign({}, res.data);
  delete entry.id;
  entry.original_id = childId;
  entry.deleted_at  = new Date().toISOString();
  entry.deleted_by  = currentUser.id;

  var insRes = await sb.from('report_trash').insert(entry);
  if (insRes.error) { showToast('Erreur corbeille : ' + insRes.error.message, 'error'); return; }

  await sb.from('report_archive').delete().eq('id', childId);
  // Remettre le parent à "pending" si le consolidé est supprimé
  if (res.data.parent_id) {
    await sb.from('report_archive').update({ sig_status: 'pending', signed_file_url: null }).eq('id', res.data.parent_id);
  }
  showToast('Document consolidé mis en corbeille', 'success');
  renderHistoriqueSection(role);
}

// ── Restaurer depuis corbeille ────────────────────────────────
async function restoreFromTrash(trashId, role) {
  var res = await sb.from('report_trash').select('*').eq('id', trashId).single();
  if (res.error || !res.data) { showToast('Introuvable en corbeille', 'error'); return; }

  var entry = Object.assign({}, res.data);
  delete entry.id;
  delete entry.original_id;
  delete entry.deleted_at;
  delete entry.deleted_by;

  var insRes = await sb.from('report_archive').insert(entry);
  if (insRes.error) { showToast('Erreur restauration : ' + insRes.error.message, 'error'); return; }

  await sb.from('report_trash').delete().eq('id', trashId);
  showToast('✓ Rapport restauré dans l\'historique', 'success');
  renderHistoriqueSection(role);
}

// ── Suppression définitive ────────────────────────────────────
async function purgeTrashItem(trashId, role) {
  if (!confirm('Supprimer définitivement ce rapport ?\nCette action est irréversible.')) return;
  await sb.from('report_trash').delete().eq('id', trashId);
  showToast('Rapport définitivement supprimé', 'success');
  renderHistoriqueSection(role);
}

// ── Modale upload rapport externe ────────────────────────────
function openReportUploadModal() {
  _extReportFile = null;
  document.getElementById('extReport_label').value  = '';
  document.getElementById('extReport_author').value = '';
  document.getElementById('extReport_date').value   = '';
  document.getElementById('extReport_type').value   = 'DUER';
  document.getElementById('extReportDropText').textContent = 'Cliquez pour sélectionner le fichier PDF';
  document.getElementById('reportUploadModal').classList.add('open');
}
function closeReportUploadModal() {
  document.getElementById('reportUploadModal').classList.remove('open');
  _extReportFile = null;
}
function onExtReportFileChange(input) {
  _extReportFile = input.files[0] || null;
  document.getElementById('extReportDropText').textContent = _extReportFile ? _extReportFile.name : 'Cliquez pour sélectionner';
}
async function saveExternalReport() {
  var type   = document.getElementById('extReport_type').value;
  var label  = document.getElementById('extReport_label').value.trim();
  var author = document.getElementById('extReport_author').value.trim();
  var date   = document.getElementById('extReport_date').value;

  if (!label)  { showToast('Veuillez saisir un intitulé', 'error'); return; }
  if (!author) { showToast('Veuillez saisir l\'auteur', 'error'); return; }

  var pad = function(n){ return String(n).padStart(2,'0'); };
  var now = new Date();
  var orgSuffix = (currentProfile.org_id || 'XXXX').slice(-4).toUpperCase();
  var reportNum = type + '-EXT-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + orgSuffix;

  var fileUrl = null;
  if (_extReportFile) {
    var filePath = currentProfile.org_id + '/' + reportNum + '-' + _extReportFile.name;
    var upRes = await sb.storage.from('rapport-archives').upload(filePath, _extReportFile, { upsert: true });
    if (!upRes.error) {
      var signed = await sb.storage.from('rapport-archives').createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (!signed.error) fileUrl = signed.data.signedUrl;
    }
  }

  var entry = {
    org_id       : currentProfile.org_id,
    created_by   : currentUser.id,
    responsable  : author,
    email        : currentProfile.email || '',
    report_num   : reportNum,
    report_type  : type,
    label        : label,
    source       : 'externe',
    app_version  : null,
    generated_at : date ? new Date(date).toISOString() : now.toISOString(),
    file_url     : fileUrl,
  };

  var res = await sb.from('report_archive').insert(entry);
  if (res.error) { showToast('Erreur archivage : ' + res.error.message, 'error'); return; }

  closeReportUploadModal();
  showToast('✓ Rapport externe archivé', 'success');

  // Rafraîchir l'onglet historique si ouvert
  var role = currentProfile.role === 'hse' ? 'HSE' : 'Company';
  renderHistoriqueSection(role);
}


// ══════════════════════════════════════════════════════════════
// VISIONNEUSE RAPPORT — iframe plein écran
// ══════════════════════════════════════════════════════════════

// archiveId optionnel : si fourni, charge le panneau signataires

// ── REPORT VIEWER ──────────────────────────────────────

async function openReportViewer(url, title, sourceType, archiveId) {
  var modal   = document.getElementById('reportViewerModal');
  var frame   = document.getElementById('reportViewerFrame');
  var titleEl = document.getElementById('reportViewerTitle');
  if (!modal || !frame) return;

  titleEl.textContent = title || 'Rapport';
  frame.src = 'about:blank';

  // Panneau signataires : masquer au départ, afficher le bouton si on a un archiveId
  var sigPanel  = document.getElementById('viewerSigPanel');
  var sigToggle = document.getElementById('viewerSigPanelToggle');
  if (sigPanel)  { sigPanel.style.display = 'none'; sigPanel.dataset.open = '0'; }
  if (sigToggle) { sigToggle.style.display = 'none'; }

  modal.classList.add('open');

  // Charger et injecter le contenu — toujours via fetch+blob pour éviter
  // les problèmes de Content-Type et de CSP (valable pour HTML et signed URLs S3)
  var loadViaFetch = (sourceType === 'html') || (url && url.includes('supabase'));
  if (loadViaFetch) {
    try {
      var resp = await fetch(url);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      var contentType = resp.headers.get('content-type') || '';
      var isPdf = contentType.includes('pdf') || url.includes('.pdf');
      if (isPdf) {
        // PDF : afficher directement
        frame.src = url;
      } else {
        var html = await resp.text();
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var blobUrl = URL.createObjectURL(blob);
        frame.src = blobUrl;
        frame._blobUrl = blobUrl;
        frame.onload = function() { setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 15000); };
      }
    } catch(e) {
      var errHtml = '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
        + 'body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#F9FAFB;color:#374151}'
        + 'h2{color:#EF4444}.sub{font-size:13px;color:#6B7280;margin-top:8px;text-align:center}'
        + '</style></head><body>'
        + '<h2>⚠️ Impossible de charger le document</h2>'
        + '<p class="sub">Le lien a peut-être expiré ou le fichier est introuvable.</p>'
        + '<a href="' + escapeHtml(url) + '" target="_blank" style="margin-top:16px;padding:10px 24px;background:#F97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">↗ Ouvrir dans un nouvel onglet</a>'
        + '</body></html>';
      var eb = new Blob([errHtml], { type:'text/html' });
      frame.src = URL.createObjectURL(eb);
    }
  } else {
    frame.src = url;
  }

  // Si on a un archiveId → charger le panneau signataires en arrière-plan
  if (archiveId) {
    if (sigToggle) sigToggle.style.display = '';
    loadViewerSigPanel(archiveId);
    // Ouvrir le panneau automatiquement si workflow en cours
    setTimeout(function() {
      var panel = document.getElementById('viewerSigPanel');
      if (panel && panel.dataset.loaded === '1') return; // déjà géré dans loadViewerSigPanel
    }, 100);
  }
}

function closeReportViewer() {
  var modal     = document.getElementById('reportViewerModal');
  var btnSig    = document.getElementById('viewerSendSigBtn');
  var sigPanel  = document.getElementById('viewerSigPanel');
  var sigToggle = document.getElementById('viewerSigPanelToggle');
  if (btnSig)    { btnSig.style.display = 'none'; btnSig.onclick = null; }
  if (sigPanel)  { sigPanel.style.display = 'none'; sigPanel.dataset.open = '0'; }
  if (sigToggle) { sigToggle.style.display = 'none'; }
  var frame = document.getElementById('reportViewerFrame');
  if (modal) modal.classList.remove('open');
  if (frame) {
    if (frame._blobUrl) { URL.revokeObjectURL(frame._blobUrl); frame._blobUrl = null; }
    frame.src = 'about:blank';
  }
}

function toggleViewerSigPanel() {
  var panel = document.getElementById('viewerSigPanel');
  if (!panel) return;
  var isOpen = panel.dataset.open === '1';
  panel.style.display = isOpen ? 'none' : '';
  panel.dataset.open  = isOpen ? '0' : '1';
}

// Charge le panneau signataires pour un archive_id donné
async function loadViewerSigPanel(archiveId) {
  var content = document.getElementById('viewerSigPanelContent');
  if (!content) return;
  content.innerHTML = '<div style="font-size:12px;color:var(--muted)">Chargement…</div>';

  // Récupérer la signature_request liée à cet archiveId
  var reqRes = await sb.from('signature_requests')
    .select('id, workflow_mode, status, total_signers, signed_count, created_at, created_by, report_num, report_type')
    .eq('archive_id', archiveId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (reqRes.error || !reqRes.data || !reqRes.data.length) {
    content.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0">Aucun workflow de signature trouvé pour ce document.</div>';
    return;
  }

  var req = reqRes.data[0];

  // Récupérer les signataires
  var itemsRes = await sb.from('signature_request_items')
    .select('*')
    .eq('request_id', req.id)
    .order('seq');

  var items = itemsRes.data || [];

  // Ouvrir le panneau automatiquement s'il y a un workflow actif
  var panel = document.getElementById('viewerSigPanel');
  if (panel && req.status !== 'completed') {
    panel.style.display = '';
    panel.dataset.open = '1';
    panel.dataset.loaded = '1';
  }

  var modeLabel = req.workflow_mode === 'sequential' ? '🔗 Séquentiel' : '⚡ Parallèle';
  var statusLabel = req.status === 'completed' ? '<span style="color:#4ADE80;font-weight:700">✅ Complété</span>'
    : req.status === 'refused'   ? '<span style="color:#FCA5A5;font-weight:700">❌ Refusé</span>'
    : '<span style="color:#FCD34D;font-weight:700">⏳ En cours</span>';
  var createdDate = new Date(req.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  var progressPct = req.total_signers ? Math.round((req.signed_count || 0) / req.total_signers * 100) : 0;

  var html = '';

  // Résumé du workflow
  html += '<div style="background:rgba(249,115,22,.06);border:1px solid rgba(249,115,22,.15);border-radius:10px;padding:12px 14px;margin-bottom:14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    + '<span style="font-size:11px;font-weight:700;color:#F97316">' + modeLabel + '</span>'
    + statusLabel
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Lancé le ' + createdDate + '</div>'
    // Barre de progression
    + '<div style="background:rgba(255,255,255,.07);border-radius:4px;height:6px;overflow:hidden;margin-bottom:6px">'
    + '<div style="height:100%;border-radius:4px;background:' + (req.status === 'completed' ? '#4ADE80' : '#F97316') + ';width:' + progressPct + '%;transition:width .4s"></div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--muted)">' + (req.signed_count || 0) + ' / ' + (req.total_signers || 0) + ' signature(s)</div>'
    + '</div>';

  // Liste des signataires
  html += '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Signataires</div>';

  items.forEach(function(item, idx) {
    var statusIcon, statusColor, statusText;
    if (item.status === 'signed') {
      statusIcon = '✅'; statusColor = '#4ADE80';
      var d = item.signed_at ? new Date(item.signed_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' }) : '';
      var t = item.signed_at ? new Date(item.signed_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
      statusText = 'Signé le ' + d + (t ? ' à ' + t : '');
    } else if (item.status === 'refused') {
      statusIcon = '❌'; statusColor = '#FCA5A5'; statusText = 'A refusé';
    } else if (item.status === 'pending') {
      statusIcon = '⏳'; statusColor = '#FCD34D'; statusText = 'En attente de signature';
    } else {
      statusIcon = '🔒'; statusColor = '#64748B'; statusText = 'Pas encore notifié';
    }

    var methodBadge = '';
    if (item.status === 'signed') {
      methodBadge = '<span style="font-size:10px;background:rgba(255,255,255,.06);border-radius:4px;padding:1px 6px;color:var(--muted)">'
        + (item.method === 'otp_email' ? '🔐 OTP' : '🖊️ Manuscrite') + '</span>';
    }

    var sigIdBadge = (item.status === 'signed' && item.sig_id)
      ? '<div style="font-size:10px;color:#64748B;margin-top:3px;font-family:monospace">Réf : ' + escapeHtml(item.sig_id) + '</div>'
      : '';

    // Boutons action
    var actionBtns = '';
    if (item.status === 'pending') {
      var sigUrl = window.location.origin + window.location.pathname + '?sign=' + item.token;
      actionBtns += '<button onclick="viewerRelancerSignataire(\'' + escapeHtml(item.id) + '\',\'' + escapeHtml(item.signer_email) + '\',\'' + escapeHtml(item.signer_name) + '\',\'' + escapeHtml(sigUrl) + '\',\'' + escapeHtml(req.report_num || '') + '\')" '
        + 'style="flex:1;background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.3);color:#FDBA74;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer">🔔 Relancer</button>';
    }
    actionBtns += '<a href="mailto:' + escapeHtml(item.signer_email) + '?subject=' + encodeURIComponent('Document ' + (req.report_num || '') + ' — SafetySphere') + '" '
      + 'style="flex:1;display:flex;align-items:center;justify-content:center;background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#A5B4FC;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;text-decoration:none">✉️ Email</a>';

    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:10px 12px;margin-bottom:8px">'
      // En-tête signataire
      + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
      + '<span style="font-size:18px;flex-shrink:0;line-height:1.2">' + statusIcon + '</span>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.signer_name || '—') + '</div>'
      + '<div style="font-size:11px;color:#A5B4FC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(item.signer_email || '') + '</div>'
      + '<div style="font-size:11px;color:var(--muted);margin-top:2px">' + escapeHtml(item.signer_role || '') + (req.workflow_mode === 'sequential' ? ' · étape ' + (idx + 1) : '') + '</div>'
      + '</div>'
      + '</div>'
      // Statut + méthode
      + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:' + (actionBtns ? '8px' : '0') + '">'
      + '<span style="font-size:11px;color:' + statusColor + ';font-weight:600">' + statusText + '</span>'
      + methodBadge
      + '</div>'
      + sigIdBadge
      // Actions
      + (actionBtns ? '<div style="display:flex;gap:6px;margin-top:8px">' + actionBtns + '</div>' : '')
      + '</div>';
  });

  // Bouton relancer TOUS les en attente
  var pendingItems = items.filter(function(i) { return i.status === 'pending'; });
  if (pendingItems.length > 1) {
    html += '<button onclick="viewerRelancerTous(\'' + escapeHtml(req.id) + '\',\'' + escapeHtml(req.report_num || '') + '\')" '
      + 'style="width:100%;background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.25);color:#FDBA74;border-radius:8px;padding:8px;font-size:12px;font-weight:700;cursor:pointer;margin-top:4px">'
      + '🔔 Relancer tous les signataires en attente (' + pendingItems.length + ')</button>';
  }

  content.innerHTML = html;
}

// Relancer un signataire individuel
async function viewerRelancerSignataire(itemId, email, name, sigUrl, reportNum) {
  var btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }
  var sent = false;
  try {
    var edgeRes = await sb.functions.invoke('send-signature-email', {
      body: { to: email, signer_name: name, sig_url: sigUrl, report_num: reportNum, emitter_name: currentProfile.full_name || currentProfile.email }
    });
    if (!edgeRes.error) sent = true;
  } catch(e) {}
  if (!sent) {
    await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: sigUrl } }).catch(function(){});
    sent = true;
  }
  if (btn) { btn.disabled = false; btn.textContent = sent ? '✅ Relancé' : '❌ Erreur'; }
  showToast(sent ? '✓ Relance envoyée à ' + name : 'Erreur lors de la relance', sent ? 'success' : 'error');
}

// Relancer tous les signataires en attente d'un workflow
async function viewerRelancerTous(requestId, reportNum) {
  var btn = event && event.target;
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
  var itemsRes = await sb.from('signature_request_items').select('*').eq('request_id', requestId).eq('status', 'pending');
  var sent = 0;
  for (var i = 0; i < (itemsRes.data || []).length; i++) {
    var item = itemsRes.data[i];
    var sigUrl = window.location.origin + window.location.pathname + '?sign=' + item.token;
    try {
      var edgeRes = await sb.functions.invoke('send-signature-email', {
        body: { to: item.signer_email, signer_name: item.signer_name, sig_url: sigUrl, report_num: reportNum, emitter_name: currentProfile.full_name || currentProfile.email }
      });
      if (!edgeRes.error) { sent++; continue; }
    } catch(e) {}
    await sb.auth.signInWithOtp({ email: item.signer_email, options: { shouldCreateUser: false, emailRedirectTo: sigUrl } }).catch(function(){});
    sent++;
  }
  if (btn) { btn.disabled = false; btn.textContent = '✅ ' + sent + ' relance(s) envoyée(s)'; }
  showToast('✓ ' + sent + ' relance(s) envoyée(s)', 'success');
}

function printReportViewer() {
  var frame = document.getElementById('reportViewerFrame');
  if (frame && frame.contentWindow) {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }
}



// ── HISTORIQUE INLINE ──────────────────────────────────────

async function renderInlineReportHistory(reportType, role, containerId) {
  var ctn = document.getElementById(containerId);
  if (!ctn || !currentProfile || !currentProfile.org_id) return;

  // Charger les archives de ce type (parents uniquement, non supprimés)
  var res = await sb.from('report_archive')
    .select('*')
    .eq('org_id', currentProfile.org_id)
    .eq('report_type', reportType)
    .is('parent_id', null)
    .order('generated_at', { ascending: false })
    .limit(10);

  var archives = res.data || [];

  if (!archives.length) {
    ctn.innerHTML = '';
    return;
  }

  var typeLabel = reportType === 'DUER' ? 'DUER' : reportType === 'VGP' ? 'Registre VGP' : reportType;
  var typeIco   = reportType === 'DUER' ? '📄' : reportType === 'VGP' ? '🔧' : '📎';

  var html = '<div style="border-top:1px solid var(--inset-border);padding-top:24px;margin-top:8px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">'
    + '<div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--text)">' + typeIco + ' Rapports ' + typeLabel + ' générés</div>'
    + '<div style="font-size:11px;color:var(--muted);margin-top:2px">Archivés automatiquement à chaque génération · ' + archives.length + ' rapport(s)</div>'
    + '</div>'
    + '</div>';

  archives.forEach(function(a) {
    var genDate  = new Date(a.generated_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    var genTime  = new Date(a.generated_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    var sigSt    = a.sig_status || 'none';

    // Badge statut signature compact
    var sigBadge = '';
    if (sigSt === 'signed_all')    sigBadge = '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(34,197,94,.12);color:#4ADE80;border:1px solid rgba(34,197,94,.25)">✅ Tous signés</span>';
    else if (sigSt === 'pending')  sigBadge = '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(245,158,11,.12);color:#FCD34D;border:1px solid rgba(245,158,11,.25)">⏳ ' + (a.sig_signed || 0) + '/' + (a.sig_total || '?') + ' signé(s)</span>';
    else if (sigSt === 'refused')  sigBadge = '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(239,68,68,.12);color:#FCA5A5;border:1px solid rgba(239,68,68,.25)">❌ Refusé</span>';
    else sigBadge = '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:rgba(148,163,184,.1);color:var(--muted);border:1px solid rgba(148,163,184,.2)">Non envoyé</span>';

    // Bouton consulter — ouvre le fichier signé si dispo, sinon l'original
    var consultUrl  = a.signed_file_url || a.file_url;
    var consultType = a.signed_file_url ? 'ext' : 'ext';
    var consultBtn  = consultUrl
      ? '<button class="btn-sm btn-view" style="padding:5px 12px;font-size:11px" onclick="openReportViewer(\'' + consultUrl + '\',\'' + escapeHtml(a.report_num || typeLabel) + '\',\'ext\',\'' + a.id + '\')">📄 Consulter</button>'
      : '<span style="font-size:11px;color:var(--muted)">Pas de fichier</span>';

    // Bouton envoi signature — seulement si pas encore envoyé
    var sendBtn = '';
    if (!sigSt || sigSt === 'none') {
      sendBtn = '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.25);color:#FCD34D" '
        + 'onclick="openSendForSignatureModal(\'' + a.id + '\',\'' + escapeHtml(a.report_num || '') + '\',\'' + reportType + '\',null,null)">✉️ Envoyer pour signature</button>';
    }

    // Bouton panneau signataires si workflow en cours
    var sigPanelBtn = '';
    if (sigSt === 'pending' || sigSt === 'signed_all') {
      sigPanelBtn = '<button class="btn-sm" style="padding:5px 12px;font-size:11px;background:rgba(99,102,241,.12);border-color:rgba(99,102,241,.25);color:#A5B4FC" '
        + 'onclick="openReportViewer(\'' + (consultUrl || '') + '\',\'' + escapeHtml(a.report_num || typeLabel) + '\',\'ext\',\'' + a.id + '\')">👥 Signataires</button>';
    }

    html += '<div class="archive-card" style="margin-bottom:8px">'
      + '<div style="font-size:22px;flex-shrink:0">' + typeIco + '</div>'
      + '<div class="archive-meta" style="flex:1;min-width:0">'
      + '<div class="archive-ref">' + escapeHtml(a.report_num || '—') + '</div>'
      + '<div style="font-size:12px;color:var(--text2);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(a.label || typeLabel) + '</div>'
      + '<div class="archive-sub">' + genDate + ' à ' + genTime + ' · Par : ' + escapeHtml(a.responsable || '—') + '</div>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">'
      + sigBadge
      + '</div>'
      + '<div class="archive-actions" style="flex-wrap:wrap">'
      + consultBtn
      + sendBtn
      + sigPanelBtn
      + '<button class="btn-sm" style="padding:5px 10px;font-size:11px;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.2);color:#FCA5A5" onclick="inlineArchiveToTrash(\'' + a.id + '\',\'' + reportType + '\',\'' + role + '\')">🗑️</button>'
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  ctn.innerHTML = html;
}

// Supprimer vers corbeille depuis l'historique inline
async function inlineArchiveToTrash(archiveId, reportType, role) {
  if (!confirm('Déplacer ce rapport vers la corbeille ? (30 jours avant suppression définitive)')) return;
  var res = await sb.from('report_archive').select('*').eq('id', archiveId).single();
  if (res.error || !res.data) { showToast('Erreur', 'error'); return; }
  var entry = Object.assign({}, res.data);
  delete entry.id;
  entry.original_id = archiveId;
  entry.deleted_at  = new Date().toISOString();
  entry.deleted_by  = currentUser.id;
  var ins = await sb.from('report_trash').insert(entry);
  if (ins.error) { showToast('Erreur corbeille : ' + ins.error.message, 'error'); return; }
  await sb.from('report_archive').delete().eq('id', archiveId);
  showToast('Rapport déplacé en corbeille', 'success');
  renderInlineReportHistory(reportType, role, reportType.toLowerCase() + '-inline-history-' + role);
}

// ══════════════════════════════════════════════════════════════
// ADMIN — Gestion des paramètres de signature
// ══════════════════════════════════════════════════════════════

async function loadAdminSignatures() {

// ── ADMIN SIMULATOR + IMPERSONATION ──────────────────────────────────────

function loadAdminSimulator() {
  renderDemoRolesGrid();
}

function renderDemoRolesGrid() {
  var grid = document.getElementById('demoRolesGrid');
  if (!grid) return;
  grid.innerHTML = Object.keys(DEMO_ROLE_META).map(function(role) {
    var m = DEMO_ROLE_META[role];
    return '<div class="sim-role-card" onclick="launchDemoRole(\'' + role + '\')" style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:16px;padding:20px 18px;cursor:pointer;transition:all .2s;text-align:center;position:relative;overflow:hidden">'
      + '<div style="width:56px;height:56px;border-radius:16px;background:' + m.color + '22;border:2px solid ' + m.color + '44;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 12px">' + m.icon + '</div>'
      + '<div style="font-size:14px;font-weight:700;margin-bottom:4px">' + m.label + '</div>'
      + '<div style="font-size:11px;color:var(--muted);line-height:1.4;margin-bottom:14px">' + m.desc + '</div>'
      + '<button style="width:100%;padding:8px;border-radius:8px;border:1px solid ' + m.color + '55;background:' + m.color + '18;color:' + m.color + ';font-size:12px;font-weight:700;cursor:pointer;font-family:\'Barlow\',sans-serif">▶ Simuler</button>'
      + '</div>';
  }).join('');

  // Hover effect
  grid.querySelectorAll('.sim-role-card').forEach(function(card) {
    card.addEventListener('mouseenter', function() { card.style.borderColor = 'rgba(249,115,22,.4)'; card.style.transform = 'translateY(-2px)'; });
    card.addEventListener('mouseleave', function() { card.style.borderColor = 'var(--inset-border)'; card.style.transform = ''; });
  });
}

function launchDemoRole(role) {
  if (_impersonateMode) { showToast('Quittez le mode miroir avant de simuler un rôle', 'error'); return; }
  var demoProfile = JSON.parse(JSON.stringify(DEMO_PROFILES[role]));
  _adminBackupProfile = currentProfile;
  _adminBackupUser    = currentUser;

  currentProfile = demoProfile;
  currentUser    = { id: demoProfile.id, email: demoProfile.email, _demo: true };

  showToast('Mode démo — ' + DEMO_ROLE_META[role].label + ' · Aucune donnée réelle chargée', 'info');
  showDemoOverlay(role);
  showDashboard(role, demoProfile.full_name);
}

function showDemoOverlay(role) {
  var m = DEMO_ROLE_META[role];
  var banner = document.getElementById('impersonateBanner');
  banner.style.display = 'flex';
  banner.style.background = 'linear-gradient(90deg,#1B3A5C,' + m.color + '88)';
  document.getElementById('impersonateBannerInfo').textContent = '🎮 Mode démo — ' + m.icon + ' ' + m.label + ' (aucune donnée réelle)';
  document.getElementById('impersonateBannerTimer').textContent = 'DÉMO';
  document.getElementById('appContent').style.paddingTop = '46px';
}

// ── Impersonation utilisateur réel ──────────────────────────────
var _impersonateSearchTimeout = null;

function impersonateSearchLive(val) {
  clearTimeout(_impersonateSearchTimeout);
  if (val.length < 2) { document.getElementById('impersonateResults').innerHTML = ''; return; }
  _impersonateSearchTimeout = setTimeout(function() { impersonateSearch(); }, 400);
}

async function impersonateSearch() {
  var q = document.getElementById('impersonateSearch').value.trim();
  if (!q) return;
  var ctn = document.getElementById('impersonateResults');
  ctn.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0">Recherche en cours...</div>';

  var result = await sb.from('profiles')
    .select('id,full_name,email,role,org_id')
    .or('full_name.ilike.%' + q + '%,email.ilike.%' + q + '%')
    .limit(8);

  if (result.error || !result.data || result.data.length === 0) {
    ctn.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0">Aucun utilisateur trouvé pour "' + escapeHtml(q) + '"</div>';
    return;
  }

  ctn.innerHTML = result.data.map(function(u) {
    var m = DEMO_ROLE_META[u.role] || { icon:'👤', label:u.role, color:'#94A3B8' };
    return '<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px">'
      + '<div style="width:40px;height:40px;border-radius:10px;background:' + m.color + '18;border:1px solid ' + m.color + '33;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' + m.icon + '</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:13px;font-weight:700">' + escapeHtml(u.full_name || '—') + '</div>'
      + '<div style="font-size:11px;color:var(--muted)">' + escapeHtml(u.email || '') + ' · <span style="color:' + m.color + ';font-weight:600">' + m.label + '</span></div>'
      + '</div>'
      + '<button class="btn-sm" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#FCA5A5;font-size:11px;white-space:nowrap" onclick="startImpersonation(' + JSON.stringify(u).replace(/"/g,'&quot;') + ')">🔴 Prendre contrôle</button>'
      + '</div>';
  }).join('');
}

async function startImpersonation(userInfo) {
  if (!confirm('⚠️ Vous allez vous connecter en mode miroir sur le compte de ' + userInfo.full_name + ' (' + userInfo.email + ').\n\nSes données réelles seront chargées. Êtes-vous sûr ?')) return;

  // Charger le profil complet
  var r = await sb.from('profiles').select('*').eq('id', userInfo.id).single();
  if (r.error || !r.data) { showToast('Impossible de charger ce profil', 'error'); return; }

  _adminBackupProfile = currentProfile;
  _adminBackupUser    = currentUser;
  _impersonateMode    = true;
  _impersonateSeconds = 0;

  currentProfile = r.data;
  currentUser    = { id: r.data.id, email: r.data.email, _impersonated: true };

  // Bandeau
  var banner = document.getElementById('impersonateBanner');
  banner.style.display = 'flex';
  banner.style.background = 'linear-gradient(90deg,#DC2626,#EA580C)';
  document.getElementById('impersonateBannerInfo').textContent =
    'Miroir actif : ' + (r.data.full_name || r.data.email) + ' · ' + r.data.email + ' · Rôle : ' + (r.data.role || '?');
  document.getElementById('appContent').style.paddingTop = '46px';

  // Timer
  clearInterval(_impersonateTimer);
  _impersonateTimer = setInterval(function() {
    _impersonateSeconds++;
    var m = String(Math.floor(_impersonateSeconds / 60)).padStart(2, '0');
    var s = String(_impersonateSeconds % 60).padStart(2, '0');
    var el = document.getElementById('impersonateBannerTimer');
    if (el) el.textContent = m + ':' + s;
  }, 1000);

  // Log
  _impersonateLog.push({
    time: new Date().toLocaleTimeString('fr-FR'),
    name: r.data.full_name || r.data.email,
    email: r.data.email,
    role: r.data.role,
    duration: null
  });

  showToast('Mode miroir actif — ' + (r.data.full_name || r.data.email), 'info');
  showDashboard(r.data.role, r.data.full_name);
}

function exitImpersonation() {
  if (!_adminBackupProfile) return;

  // Logger la durée
  if (_impersonateMode && _impersonateLog.length > 0) {
    var m = String(Math.floor(_impersonateSeconds / 60)).padStart(2, '0');
    var s = String(_impersonateSeconds % 60).padStart(2, '0');
    _impersonateLog[_impersonateLog.length - 1].duration = m + ':' + s;
  }

  clearInterval(_impersonateTimer);
  _impersonateTimer   = null;
  _impersonateMode    = false;
  _impersonateSeconds = 0;

  // Restaurer l'admin
  currentProfile = _adminBackupProfile;
  currentUser    = _adminBackupUser;
  _adminBackupProfile = null;
  _adminBackupUser    = null;

  // Cacher le bandeau
  var banner = document.getElementById('impersonateBanner');
  banner.style.display = 'none';
  document.getElementById('appContent').style.paddingTop = '';

  // Retour au dashboard admin
  showToast('Mode miroir terminé — retour Admin', 'success');
  showDashboard('admin', currentProfile.full_name);
  // Re-select simulator tab
  setTimeout(function() {
    var tabs = document.querySelectorAll('#dashAdmin .nav-tab');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    var simTab = Array.from(tabs).find(function(t) { return t.textContent.includes('Simulateur'); });
    if (simTab) simTab.classList.add('active');
    switchPage('Admin', 'simulator', simTab);
    // Update log display
    updateImpersonateLogDisplay();
  }, 100);
}

function updateImpersonateLogDisplay() {
  var ctn = document.getElementById('impersonateLog');
  if (!ctn) return;
  if (_impersonateLog.length === 0) {
    ctn.innerHTML = '<span style="color:var(--muted);font-size:12px">Aucune session miroir dans cette session.</span>';
    return;
  }
  ctn.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">'
    + _impersonateLog.map(function(entry) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px">'
        + '<span style="font-size:16px">🔴</span>'
        + '<div style="flex:1">'
        + '<div style="font-size:12px;font-weight:700">' + escapeHtml(entry.name) + ' — ' + escapeHtml(entry.role) + '</div>'
        + '<div style="font-size:11px;color:var(--muted)">' + escapeHtml(entry.email) + ' · ' + entry.time + (entry.duration ? ' · Durée : ' + entry.duration : ' · En cours') + '</div>'
        + '</div>'
        + '<span style="font-size:11px;font-weight:700;color:' + (entry.duration ? 'var(--success)' : 'var(--warn)') + '">' + (entry.duration ? '✅ ' + entry.duration : '🟡 En cours') + '</span>'
        + '</div>';
    }).join('')
    + '</div>';
}
