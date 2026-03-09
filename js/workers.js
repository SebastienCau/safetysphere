// ============================================================
// SafetySphere — workers.js  (v2.0.0)
// Workers · Documents · Invitations · Missions · QR Code
// Trainer · Subcontractor · Company workers
// ============================================================
// Dépendances : core.js (sb, currentUser, currentProfile,
//               escapeHtml, showToast, showAlert)
// ============================================================

async function loadWorkerStats() {
  // Rattachement employeur
  if (currentProfile.org_id) {
    const { data: org } = await sb.from('organizations').select('name').eq('id', currentProfile.org_id).single();
    document.getElementById('linkCompanyBanner').style.display    = 'none';
    document.getElementById('linkedCompanyBanner').style.display  = 'flex';
    if (org) document.getElementById('linkedCompanyName').textContent = org.name;
  } else {
    document.getElementById('linkCompanyBanner').style.display    = 'block';
    document.getElementById('linkedCompanyBanner').style.display  = 'none';
  }

  const { data: docs } = await sb.from('documents').select('status,expires_at,doc_type').eq('owner_id', currentUser.id).eq('category', 'worker');
  if (!docs) return;

  const now  = new Date();
  const soon = new Date(); soon.setDate(soon.getDate() + 30);

  document.getElementById('wStat1').textContent = docs.filter(d => d.status === 'validated').length;
  document.getElementById('wStat2').textContent = docs.filter(d => d.status === 'pending').length;
  document.getElementById('wStat3').textContent = docs.filter(d => d.expires_at && new Date(d.expires_at) > now && new Date(d.expires_at) < soon).length;
  document.getElementById('wStat4').textContent = docs.filter(d => d.status === 'rejected' || (d.expires_at && new Date(d.expires_at) <= now)).length;

  // Alertes expiration
  renderExpiryAlerts(docs);
}

function renderExpiryAlerts(docs) {
  const container = document.getElementById('workerExpiryAlerts');
  if (!container) return;
  const now  = new Date();
  const warn = new Date(); warn.setDate(warn.getDate() + 30);
  const crit = new Date(); crit.setDate(crit.getDate() + 7);

  const expiring = docs.filter(d => d.expires_at && new Date(d.expires_at) > now && new Date(d.expires_at) < warn);
  if (!expiring.length) { container.innerHTML = ''; return; }

  const html = `<div class="expiry-alerts">` + expiring.map(d => {
    const def     = WORKER_DOCS.find(w => w.key === d.doc_type) || { name: d.doc_type, icon: '📄' };
    const expDate = new Date(d.expires_at);
    const isCrit  = expDate < crit;
    const daysLeft = Math.ceil((expDate - now) / 86400000);
    return `<div class="expiry-alert ${isCrit ? '' : 'warn'}">
      <div class="expiry-alert-icon">${isCrit ? '🔴' : '🟡'}</div>
      <div class="expiry-alert-info">
        <div class="expiry-alert-name">${def.icon} ${def.name}</div>
        <div class="expiry-alert-date">Expire le ${expDate.toLocaleDateString('fr-FR')} — <strong>${daysLeft} jour${daysLeft > 1 ? 's' : ''}</strong></div>
      </div>
      <div class="expiry-alert-actions">
        <button class="btn-sm btn-booking" onclick="openUploadModal('${d.doc_type}','${def.name}','worker')">🔄 Renouveler</button>
      </div>
    </div>`;
  }).join('') + `</div>`;
  container.innerHTML = html;
}

// ══════════════════════════════
// ONGLETS PERSONNALISÉS HABILITATIONS
// ══════════════════════════════
const DOC_TAB_ICONS = ['📁','📋','🔧','⚙️','🏗️','⚡','🩺','🚒','🧰','🪜','🚧','🛡️','🎓','🪪','🏥','🔬','🚗','✈️','🌊','🔥'];
let _currentDocTab = '__default__'; // onglet actif
let _editingTabId  = null;          // null = création, sinon id de l'onglet en édition

function getCustomDocTabs() {
  return currentProfile?.dashboard_layout?._customDocTabs || [];
}

// Retourne les types de docs de l'onglet par défaut (personnalisés ou fallback WORKER_DOCS)
function getDefaultDocTypes() {
  const saved = currentProfile?.dashboard_layout?._defaultDocTypes;
  if (saved && saved.length > 0) return saved;
  return WORKER_DOCS.map(d => ({ key: d.key, name: d.name }));
}

async function saveCustomDocTabs(tabs) {
  const existing = currentProfile.dashboard_layout || {};
  existing._customDocTabs = tabs;
  currentProfile.dashboard_layout = existing;
  const { error } = await sb.from('profiles').update({ dashboard_layout: existing }).eq('id', currentUser.id);
  if (error) { showToast('Erreur sauvegarde onglets', 'error'); return false; }
  return true;
}

async function saveDefaultDocTypes(docTypes) {
  const existing = currentProfile.dashboard_layout || {};
  existing._defaultDocTypes = docTypes;
  currentProfile.dashboard_layout = existing;
  const { error } = await sb.from('profiles').update({ dashboard_layout: existing }).eq('id', currentUser.id);
  if (error) { showToast('Erreur sauvegarde onglet par défaut', 'error'); return false; }
  return true;
}

function renderDocTabs() {
  const tabs = getCustomDocTabs();
  const container = document.getElementById('workerDocTabs');
  if (!container) return;

  let html = `<button class="doc-tab${_currentDocTab === '__default__' ? ' active' : ''}" onclick="switchDocTab('__default__')">
    📄 Habilitations
    <span class="doc-tab-edit" onclick="event.stopPropagation();openEditDefaultTabModal()" title="Personnaliser cet onglet">✏️</span>
  </button>`;
  tabs.forEach(tab => {
    html += `<button class="doc-tab${_currentDocTab === tab.id ? ' active' : ''}" onclick="switchDocTab('${tab.id}')">
      ${tab.icon} ${escapeHtml(tab.name)}
      <span class="doc-tab-edit" onclick="event.stopPropagation();openEditDocTabModal('${tab.id}')" title="Modifier">✏️</span>
    </button>`;
  });
  container.innerHTML = html;
}

function switchDocTab(tabId) {
  _currentDocTab = tabId;
  renderDocTabs();
  if (tabId === '__default__') {
    loadWorkerDocs();
  } else {
    loadCustomTabDocs(tabId);
  }
}

async function loadCustomTabDocs(tabId) {
  const tab = getCustomDocTabs().find(t => t.id === tabId);
  if (!tab) return;

  const container = document.getElementById('workerDocsContainer');
  container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div></div>';

  // Charger les docs de cet onglet (category = 'custom_' + tabId)
  const category = 'custom_' + tabId;
  const { data: docs } = await sb.from('documents').select('*').eq('owner_id', currentUser.id).eq('category', category);
  await loadTrainingCenters();

  const docDefs = tab.docs || [];
  if (!docDefs.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">${tab.icon}</div>
      <div class="empty-state-text">Cet onglet est vide.<br>Cliquez sur ✏️ pour ajouter des types de documents.</div>
    </div>`;
    return;
  }

  // Réutiliser renderWorkerDocCards avec les defs custom
  const statusLabels = { empty: 'Non déposé', pending: 'En attente', validated: 'Validé ✓', rejected: 'Refusé', expired: 'Expiré' };
  const html = '<div class="doc-grid">' + docDefs.map(def => {
    const doc    = docs ? docs.find(d => d.doc_type === def.key) : null;
    const status = doc ? doc.status : 'empty';
    const now    = new Date();
    const soon   = new Date(); soon.setDate(soon.getDate() + 30);
    let expiryHtml = '';
    if (doc?.expires_at) {
      const exp = new Date(doc.expires_at);
      const daysLeft = Math.ceil((exp - now) / 86400000);
      expiryHtml = `<div class="doc-card-expiry ${exp < now ? 'urgent' : ''}">📅 ${exp.toLocaleDateString('fr-FR')}${daysLeft > 0 ? ' — ' + daysLeft + 'j' : ' — Expiré'}</div>`;
    }
    let actions = !doc
      ? `<button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${escapeHtml(def.name)}','${category}')">📤 Déposer</button>`
      : `<button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>
         <button class="btn-sm" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#A5B4FC" onclick="openEditDocModal('${doc.id}','${escapeHtml(def.name)}','${doc.expires_at || ''}','${doc.status}')">✏️ Modifier</button>
         <button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${escapeHtml(def.name)}','${category}')">🔄 Remplacer</button>`;

    return `<div class="doc-card">
      <div class="doc-card-header"><div class="doc-card-icon">${tab.icon}</div>
        <div class="doc-card-badges"><span class="doc-badge status-${status}">${statusLabels[status]}</span></div>
      </div>
      <div class="doc-card-name">${escapeHtml(def.name)}</div>
      ${expiryHtml}
      <div class="doc-card-actions">${actions}</div>
    </div>`;
  }).join('') + '</div>';

  container.innerHTML = html;
}

// ── Modale ajout/édition onglet ──
// ── Modale édition onglet par défaut "Habilitations" ──
function openEditDefaultTabModal() {
  _editingTabId = '__default__';
  document.getElementById('addDocTabTitle').textContent = '✏️ Personnaliser "Habilitations"';
  document.getElementById('docTabName').value = 'Habilitations';
  document.getElementById('docTabIcon').value = '📄';
  document.getElementById('docTabDeleteBtn').style.display = 'none'; // onglet défaut non supprimable
  renderIconPicker('📄');
  // Initialiser _tempDocs depuis les types actuels
  const listEl = document.getElementById('docTabDocsItems');
  const currentDocs = getDefaultDocTypes().map(d => ({ key: d.key, name: d.name }));
  listEl._tempDocs = currentDocs;
  renderTabDocsList(currentDocs);
  document.getElementById('docTabDocsList').style.display = 'block';
  document.getElementById('docTabNewDocName').value = '';
  document.getElementById('addDocTabModal').classList.add('open');
  setTimeout(() => document.getElementById('docTabNewDocName').focus(), 100);
}

function openAddDocTabModal() {
  _editingTabId = null;
  document.getElementById('addDocTabTitle').textContent = '➕ Nouvel onglet';
  document.getElementById('docTabName').value = '';
  document.getElementById('docTabIcon').value = '📁';
  document.getElementById('docTabDocsList').style.display = 'none';
  document.getElementById('docTabDeleteBtn').style.display = 'none';
  // Réinitialiser _tempDocs pour éviter les résidus de la session précédente
  const listEl = document.getElementById('docTabDocsItems');
  if (listEl) { listEl._tempDocs = []; listEl.innerHTML = ''; }
  document.getElementById('docTabNewDocName').value = '';
  renderIconPicker('📁');
  document.getElementById('addDocTabModal').classList.add('open');
  setTimeout(() => document.getElementById('docTabName').focus(), 100);
}

function openEditDocTabModal(tabId) {
  const tab = getCustomDocTabs().find(t => t.id === tabId);
  if (!tab) return;
  _editingTabId = tabId;
  document.getElementById('addDocTabTitle').textContent = '✏️ Modifier l\'onglet';
  document.getElementById('docTabName').value = tab.name;
  document.getElementById('docTabIcon').value = tab.icon;
  document.getElementById('docTabDeleteBtn').style.display = '';
  renderIconPicker(tab.icon);
  renderTabDocsList(tab.docs || []);
  document.getElementById('docTabDocsList').style.display = 'block';
  document.getElementById('addDocTabModal').classList.add('open');
}

function closeAddDocTabModal() {
  document.getElementById('addDocTabModal').classList.remove('open');
  _editingTabId = null;
}

function renderIconPicker(selected) {
  const picker = document.getElementById('docTabIconPicker');
  picker.innerHTML = DOC_TAB_ICONS.map(icon =>
    `<div class="icon-pick${icon === selected ? ' selected' : ''}" onclick="selectTabIcon('${icon}')">${icon}</div>`
  ).join('');
}

function selectTabIcon(icon) {
  document.getElementById('docTabIcon').value = icon;
  renderIconPicker(icon);
}

function renderTabDocsList(docs) {
  const container = document.getElementById('docTabDocsItems');
  if (!docs.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:6px 0">Aucun document — ajoutez-en ci-dessous</div>';
    return;
  }
  container.innerHTML = docs.map((d, i) =>
    `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px">
      <span style="flex:1;font-size:13px">${escapeHtml(d.name)}</span>
      <button onclick="removeDocFromTab(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:2px 6px" title="Supprimer">✕</button>
    </div>`
  ).join('');
}

function addDocToTab() {
  const input = document.getElementById('docTabNewDocName');
  const name  = input.value.trim();
  if (!name) return;

  const listEl = document.getElementById('docTabDocsItems');
  let currentDocs = [];

  if (_editingTabId === '__default__') {
    // Onglet défaut : travailler sur _tempDocs initialisé depuis getDefaultDocTypes
    if (listEl._tempDocs === undefined) listEl._tempDocs = [...getDefaultDocTypes()];
    currentDocs = listEl._tempDocs;
  } else if (_editingTabId) {
    const tabs = getCustomDocTabs();
    const tab = tabs.find(t => t.id === _editingTabId);
    currentDocs = tab ? [...(tab.docs || [])] : [];
    const key = 'custom_doc_' + Date.now();
    currentDocs.push({ key, name });
    if (tab) tab.docs = currentDocs;
    document.getElementById('docTabDocsList').style.display = 'block';
    renderTabDocsList(currentDocs);
    input.value = ''; input.focus();
    return;
  } else {
    currentDocs = listEl._tempDocs || [];
  }

  const key = 'custom_doc_' + Date.now();
  currentDocs.push({ key, name });
  listEl._tempDocs = currentDocs;

  document.getElementById('docTabDocsList').style.display = 'block';
  renderTabDocsList(currentDocs);
  input.value = ''; input.focus();
}

function removeDocFromTab(index) {
  const listEl = document.getElementById('docTabDocsItems');
  let currentDocs = [];

  if (_editingTabId === '__default__') {
    if (listEl._tempDocs === undefined) listEl._tempDocs = [...getDefaultDocTypes()];
    listEl._tempDocs.splice(index, 1);
    renderTabDocsList(listEl._tempDocs);
    return;
  }

  const tabs = getCustomDocTabs();
  if (_editingTabId) {
    const tab = tabs.find(t => t.id === _editingTabId);
    currentDocs = tab ? [...(tab.docs || [])] : [];
    currentDocs.splice(index, 1);
    if (tab) tab.docs = currentDocs;
  } else {
    currentDocs = listEl._tempDocs || [];
    currentDocs.splice(index, 1);
    listEl._tempDocs = currentDocs;
  }
  renderTabDocsList(currentDocs);
}

async function saveDocTab() {
  const name = document.getElementById('docTabName').value.trim();
  const icon = document.getElementById('docTabIcon').value;
  if (!name) { showToast('Donnez un nom à l\'onglet', 'error'); return; }

  const btn = document.getElementById('docTabSaveBtn');
  btn.disabled = true; btn.textContent = '⏳';

  // ── Cas spécial : onglet par défaut "Habilitations" ──
  if (_editingTabId === '__default__') {
    const listEl = document.getElementById('docTabDocsItems');
    // Récupérer les docs depuis la liste rendue (via _tempDocs ou depuis getDefaultDocTypes)
    const currentDocs = listEl._tempDocs !== undefined ? listEl._tempDocs : getDefaultDocTypes();
    const ok = await saveDefaultDocTypes(currentDocs);
    btn.disabled = false; btn.textContent = '✓ Enregistrer';
    if (ok) {
      showToast('Onglet "Habilitations" personnalisé', 'success');
      closeAddDocTabModal();
      _editingTabId = null;
      renderDocTabs();
      loadWorkerDocs();
    }
    return;
  }

  const tabs = getCustomDocTabs();

  if (_editingTabId) {
    // Mise à jour onglet custom existant
    const tab = tabs.find(t => t.id === _editingTabId);
    if (tab) { tab.name = name; tab.icon = icon; }
  } else {
    // Création nouvel onglet
    const el = document.getElementById('docTabDocsItems');
    const newDocs = el._tempDocs || [];
    tabs.push({ id: 'tab_' + Date.now(), name, icon, docs: newDocs });
  }

  const ok = await saveCustomDocTabs(tabs);
  btn.disabled = false; btn.textContent = '✓ Enregistrer';

  if (ok) {
    showToast('Onglet enregistré', 'success');
    closeAddDocTabModal();
    renderDocTabs();
    if (_editingTabId) {
      const savedId = _editingTabId;
      _editingTabId = null;
      switchDocTab(savedId);
    }
  }
}

async function deleteDocTab() {
  if (!_editingTabId) return;
  if (!confirm('Supprimer cet onglet ? Les documents déposés dans Supabase ne seront pas supprimés.')) return;

  const tabs = getCustomDocTabs().filter(t => t.id !== _editingTabId);
  const ok = await saveCustomDocTabs(tabs);
  if (ok) {
    showToast('Onglet supprimé', 'success');
    closeAddDocTabModal();
    _currentDocTab = '__default__';
    renderDocTabs();
    loadWorkerDocs();
  }
}

async function loadWorkerDocs() {
  // Initialiser les onglets si premier chargement
  renderDocTabs();
  if (_currentDocTab !== '__default__') {
    loadCustomTabDocs(_currentDocTab);
    return;
  }
  const { data: docs } = await sb.from('documents').select('*').eq('owner_id', currentUser.id).eq('category', 'worker');
  // Charger les centres pour le sélecteur upload
  await loadTrainingCenters();
  renderWorkerDocCards('workerDocsContainer', docs);
}

function renderWorkerDocCards(containerId, existingDocs) {
  const statusLabels = { empty: 'Non déposé', pending: 'En attente employeur', validated: 'Validé ✓', rejected: 'Refusé', expired: 'Expiré' };
  const centerStatusLabels = { none: '', pending: '🎓 Centre : en attente', validated: '🎓 Centre : validé ✓', rejected: '🎓 Centre : refusé' };

  const html = '<div class="doc-grid">' + getDefaultDocTypes().map(rawDef => {
    const workerMeta = WORKER_DOCS.find(w => w.key === rawDef.key) || {};
    const def = { key: rawDef.key, name: rawDef.name, icon: workerMeta.icon || '📄', desc: workerMeta.desc || '' };
    const doc    = existingDocs ? existingDocs.find(d => d.doc_type === def.key) : null;
    const status = doc ? doc.status : 'empty';
    const now    = new Date();
    const soon   = new Date(); soon.setDate(soon.getDate() + 30);

    let expiryHtml = '';
    if (doc && doc.expires_at) {
      const exp      = new Date(doc.expires_at);
      const daysLeft = Math.ceil((exp - now) / 86400000);
      const cls      = exp < now ? 'urgent' : (exp < soon ? '' : 'ok');
      expiryHtml = `<div class="doc-card-expiry ${cls}">📅 ${exp.toLocaleDateString('fr-FR')}${daysLeft > 0 ? ' — ' + daysLeft + 'j' : ' — Expiré'}</div>`;
    }

    // Badge centre de formation
    let centerBadgeHtml = '';
    let centerInfoHtml  = '';
    let bookingBtnHtml  = '';
    if (doc && doc.training_center_id) {
      const cStatus = doc.center_status || 'none';
      if (cStatus !== 'none') {
        centerBadgeHtml = `<span class="doc-badge badge-center-${cStatus === 'validated' ? 'validated' : cStatus === 'pending' ? 'pending' : 'none'}">${centerStatusLabels[cStatus]}</span>`;
      }
      const center = trainingCenters.find(c => c.id === doc.training_center_id);
      if (center) {
        centerInfoHtml = `<div class="doc-card-center">🎓 ${center.name}</div>`;
        // Bouton prise de RDV si validé et expiration proche
        const url = doc.booking_url || center.booking_url;
        if (url && doc.expires_at) {
          const exp = new Date(doc.expires_at);
          const daysLeft = Math.ceil((exp - now) / 86400000);
          if (daysLeft < 30) {
            bookingBtnHtml = `<button class="btn-sm btn-booking" onclick="window.open('${url}','_blank')">📅 Prendre RDV</button>`;
          }
        }
      }
    }

    let actions = '';
    if (!doc) {
      actions = `<button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${def.name}','worker')">📤 Déposer</button>`;
    } else {
      actions  = `<button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>`;
      actions += `<button class="btn-sm" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#A5B4FC" onclick="openEditDocModal('${doc.id}','${def.name}','${doc.expires_at || ''}','${doc.status}')">✏️ Modifier</button>`;
      actions += `<button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${def.name}','worker')">🔄 Remplacer</button>`;
      actions += bookingBtnHtml;
    }

    return `<div class="doc-card">
      <div class="doc-card-header">
        <div class="doc-card-icon">${def.icon}</div>
        <div class="doc-card-badges">
          <span class="doc-badge status-${status}">${statusLabels[status]}</span>
          ${centerBadgeHtml}
        </div>
      </div>
      <div class="doc-card-name">${def.name}</div>
      <div class="doc-card-desc">${def.desc}</div>
      ${centerInfoHtml}
      ${expiryHtml}
      <div class="doc-card-actions">${actions}</div>
    </div>`;
  }).join('') + '</div>';

  document.getElementById(containerId).innerHTML = html;
}

// ══════════════════════════════
// COMPANY
// ══════════════════════════════
async function loadCompanyStats() {
  if (!currentProfile?.org_id) return;
  const { data: org } = await sb.from('organizations').select('team_code, name').eq('id', currentProfile.org_id).single();
  if (org?.team_code) {
    document.getElementById('teamCodeDisplay').textContent      = org.team_code;
    document.getElementById('teamCodeBanner').style.display = 'flex';
  }
  const { data: workers } = await sb.from('profiles').select('id').eq('org_id', currentProfile.org_id);
  document.getElementById('cStat1').textContent = workers ? workers.length : 0;

  const { data: companyDocs } = await sb.from('documents').select('status,expires_at,category').eq('owner_id', currentUser.id);
  let pendingWorkerDocs = 0;
  if (workers && workers.length > 0) {
    const ids = workers.map(w => w.id);
    const { data: wd } = await sb.from('documents').select('status').in('owner_id', ids).eq('category','worker').eq('status','pending');
    pendingWorkerDocs = wd ? wd.length : 0;
  }
  document.getElementById('cStat2').textContent = pendingWorkerDocs;
  if (pendingWorkerDocs > 0) {
    const b = document.getElementById('pendingBadge');
    b.style.display = 'inline'; b.textContent = pendingWorkerDocs;
  }
  if (companyDocs) {
    document.getElementById('cStat3').textContent = companyDocs.filter(d => d.status === 'validated' && d.category === 'company').length;
    const s = new Date(); s.setDate(s.getDate() + 30);
    document.getElementById('cStat4').textContent = companyDocs.filter(d => d.expires_at && new Date(d.expires_at) < s && new Date(d.expires_at) > new Date()).length;
  }
}

function renderDocCards(containerId, docDefs, existingDocs, category, canValidate) {
  const statusLabels = { empty: 'Non déposé', pending: 'En attente', validated: 'Validé ✓', rejected: 'Refusé', expired: 'Expiré' };
  const html = '<div class="doc-grid">' + docDefs.map(def => {
    const doc    = existingDocs ? existingDocs.find(d => d.doc_type === def.key) : null;
    const status = doc ? doc.status : 'empty';
    const expiryHtml = doc && doc.expires_at ? `<div class="doc-card-expiry ${new Date(doc.expires_at) > new Date() ? 'ok' : 'urgent'}">📅 ${new Date(doc.expires_at).toLocaleDateString('fr-FR')}</div>` : '';
    let actions = '';
    if (!doc) {
      actions = `<button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${def.name}','${category}')">📤 Déposer</button>`;
    } else {
      actions = `<button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>`;
      if (!canValidate) {
        actions += `<button class="btn-sm" style="background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);color:#A5B4FC" onclick="openEditDocModal('${doc.id}','${def.name}','${doc.expires_at || ''}','${doc.status}')">✏️ Modifier</button>`;
        actions += `<button class="btn-sm btn-upload" onclick="openUploadModal('${def.key}','${def.name}','${category}')">🔄 Remplacer</button>`;
      }
      if (canValidate && doc.status === 'pending') actions += `<button class="btn-sm btn-validate" onclick="validateDoc('${doc.id}','validated')">✓ Valider</button><button class="btn-sm btn-reject" onclick="validateDoc('${doc.id}','rejected')">✗ Refuser</button>`;
    }
    return `<div class="doc-card">
      <div class="doc-card-header"><div class="doc-card-icon">${def.icon}</div><div class="doc-card-badges"><span class="doc-badge status-${status}">${statusLabels[status]}</span></div></div>
      <div class="doc-card-name">${def.name}</div>
      <div class="doc-card-desc">${def.desc}</div>
      ${expiryHtml}
      <div class="doc-card-actions">${actions}</div>
    </div>`;
  }).join('') + '</div>';
  document.getElementById(containerId).innerHTML = html;
}

async function loadCompanyDocs() {
  const { data } = await sb.from('documents').select('*').eq('owner_id', currentUser.id).eq('category', 'company');
  renderDocCards('companyDocsContainer', COMPANY_DOCS, data, 'company', false);
}

async function loadCompanyWorkers() {
  const container = document.getElementById('companyWorkersContainer');
  const { data: workers } = await sb.from('profiles').select('*').eq('org_id', currentProfile.org_id);
  if (!workers || !workers.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👷</div><div class="empty-state-text">Aucun intervenant lié.<br>Partagez votre code employeur pour qu'ils vous rejoignent.</div></div>`;
    return;
  }
  document.getElementById('cStat1').textContent = workers.length;
  let html = '<div class="worker-list">';
  for (const w of workers) {
    const { data: docs } = await sb.from('documents').select('*').eq('owner_id', w.id).eq('category', 'worker');
    const pending = docs ? docs.filter(d => d.status === 'pending').length : 0;
    const statusLabels = { pending: 'En attente', validated: 'Validé ✓', rejected: 'Refusé', expired: 'Expiré' };
    const centerStatusLabels = { pending: '🎓 Centre : en attente', validated: '🎓 Centre : validé ✓', rejected: '🎓 Centre : refusé' };
    const docsHtml = docs && docs.length
      ? '<div class="doc-grid">' + WORKER_DOCS.map(def => {
          const doc = docs.find(d => d.doc_type === def.key);
          if (!doc) return '';
          const centerBadge = doc.center_status && doc.center_status !== 'none'
            ? `<span class="doc-badge badge-center-${doc.center_status === 'validated' ? 'validated' : 'pending'}">${centerStatusLabels[doc.center_status] || ''}</span>` : '';
          return `<div class="doc-card">
            <div class="doc-card-header"><div class="doc-card-icon">${def.icon}</div><div class="doc-card-badges"><span class="doc-badge status-${doc.status}">${statusLabels[doc.status]}</span>${centerBadge}</div></div>
            <div class="doc-card-name">${def.name}</div>
            <div class="doc-card-actions">
              <button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>
              ${doc.status === 'pending' ? `<button class="btn-sm btn-validate" onclick="validateDoc('${doc.id}','validated')">✓ Valider</button><button class="btn-sm btn-reject" onclick="validateDoc('${doc.id}','rejected')">✗ Refuser</button>` : ''}
            </div>
          </div>`;
        }).filter(Boolean).join('') + '</div>'
      : '<p style="color:var(--muted);padding:10px 0;font-size:13px">Aucun document déposé</p>';
    html += `
      <div class="worker-card" onclick="togglePanel('panel_${w.id}')">
        <div class="worker-avatar">👷</div>
        <div class="worker-info">
          <div class="worker-name">${w.full_name}</div>
          <div class="worker-role">Intervenant${pending > 0 ? ' — <span style="color:var(--warn)">'+pending+' en attente</span>' : ''}</div>
        </div>
        <span style="color:var(--muted);font-size:12px">▼</span>
      </div>
      <div id="panel_${w.id}" class="worker-docs-panel">${docsHtml}</div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

function togglePanel(id) {
  const el = document.getElementById(id);
  const isOpening = el.style.display !== 'block';
  el.style.display = isOpening ? 'block' : 'none';

  // scrollIntoView ignore le zoom CSS — on calcule manuellement
  function scrollToEl(target, block) {
    const zoom = parseFloat(document.getElementById('appContent')?.style.zoom) || 1;
    const rect = target.getBoundingClientRect();
    const scrollY = window.scrollY;
    // Les coords getBoundingClientRect sont visuelles (post-zoom)
    // window.scrollTo attend des coords de layout (pré-zoom) → diviser par zoom
    let targetY;
    if (block === 'center') {
      targetY = scrollY + rect.top / zoom - (window.innerHeight / zoom - rect.height / zoom) / 2;
    } else {
      targetY = scrollY + rect.top / zoom - 12; // 'start' avec petite marge
    }
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }

  if (isOpening) {
    setTimeout(() => scrollToEl(el, 'start'), 50);
  } else {
    const card = el.previousElementSibling;
    if (card) setTimeout(() => scrollToEl(card, 'center'), 50);
  }
}

// ══════════════════════════════
// TRAINER (Centre de Formation)
// ══════════════════════════════
async function loadTrainerStats() {
  if (!currentProfile?.org_id) return;

  // Afficher le lien de RDV si défini
  const { data: org } = await sb.from('organizations').select('name, booking_url').eq('id', currentProfile.org_id).single();
  if (org?.booking_url) {
    document.getElementById('trainerBookingUrl').textContent    = org.booking_url;
    document.getElementById('trainerBookingBanner').style.display = 'flex';
  }

  const { data: pending } = await sb.from('documents').select('id').eq('training_center_id', currentProfile.org_id).eq('center_status', 'pending');
  const { data: validated } = await sb.from('documents').select('id').eq('training_center_id', currentProfile.org_id).eq('center_status', 'validated');

  const pCount = pending ? pending.length : 0;
  const vCount = validated ? validated.length : 0;

  document.getElementById('tStat1').textContent = pCount;
  document.getElementById('tStat2').textContent = vCount;
  document.getElementById('tStat4').textContent = pCount + vCount;

  // Expirations à venir (30j)
  const soon = new Date(); soon.setDate(soon.getDate() + 30);
  const { data: expiring } = await sb.from('documents')
    .select('id')
    .eq('training_center_id', currentProfile.org_id)
    .eq('center_status', 'validated')
    .lt('expires_at', soon.toISOString())
    .gt('expires_at', new Date().toISOString());
  document.getElementById('tStat3').textContent = expiring ? expiring.length : 0;

  if (pCount > 0) {
    const b = document.getElementById('trainerPendingBadge');
    b.style.display = 'inline'; b.textContent = pCount;
  }
}

async function loadTrainerRequests() {
  const container = document.getElementById('trainerRequestsContainer');
  const { data: docs, error } = await sb.from('documents')
    .select('*')
    .eq('training_center_id', currentProfile.org_id)
    .eq('center_status', 'pending');

  if (error) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Erreur chargement : ${escapeHtml(error.message)}</div></div>`;
    return;
  }
  if (!docs || !docs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Aucune demande de validation en attente.<br>Les intervenants qui ont suivi vos formations apparaîtront ici.</div></div>`;
    return;
  }

  // Charger les noms des workers + leur société séparément
  const ownerIds = [...new Set(docs.map(d => d.owner_id))];
  const { data: workers } = await sb.from('profiles').select('id, full_name, email, org_id').in('id', ownerIds);

  // Charger les noms des organisations des workers
  const orgIds = [...new Set((workers || []).map(w => w.org_id).filter(Boolean))];
  const orgMap = {};
  if (orgIds.length) {
    const { data: orgs } = await sb.from('organizations').select('id, name').in('id', orgIds);
    if (orgs) orgs.forEach(o => orgMap[o.id] = o.name);
  }

  const workerMap = {};
  if (workers) workers.forEach(w => workerMap[w.id] = w);

  const html = '<div class="request-list">' + docs.map(doc => {
    const def        = WORKER_DOCS.find(w => w.key === doc.doc_type) || { name: doc.doc_type, icon: '📄' };
    const worker     = workerMap[doc.owner_id];
    const workerName = worker?.full_name || 'Intervenant inconnu';
    const orgName    = worker?.org_id ? orgMap[worker.org_id] || '' : '';
    const expiry     = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : 'Non renseignée';
    return `<div class="request-card">
      <div class="request-card-header">
        <div class="request-card-icon">${def.icon}</div>
        <div class="request-card-info">
          <div class="request-card-name">${def.name}</div>
          <div class="request-card-meta">👷 ${workerName}${orgName ? ` — <span style="color:var(--orange)">🏢 ${orgName}</span>` : ''} — Expiration : ${expiry}</div>
        </div>
        <button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>
      </div>
      <div class="request-card-actions">
        <button class="btn-sm btn-validate" onclick="validateCenterDoc('${doc.id}','validated')">✓ Valider cette formation</button>
        <button class="btn-sm btn-reject"   onclick="validateCenterDoc('${doc.id}','rejected')">✗ Refuser</button>
      </div>
    </div>`;
  }).join('') + '</div>';
  container.innerHTML = html;
}

async function loadTrainerHistory() {
  const container = document.getElementById('trainerHistoryContainer');
  const { data: docs } = await sb.from('documents')
    .select('*')
    .eq('training_center_id', currentProfile.org_id)
    .in('center_status', ['validated', 'rejected'])
    .order('center_validated_at', { ascending: false })
    .limit(50);

  if (!docs || !docs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">Aucune validation effectuée pour l'instant.</div></div>`;
    return;
  }

  // Charger les noms des workers séparément
  const ownerIds = [...new Set(docs.map(d => d.owner_id))];
  const { data: workers } = await sb.from('profiles').select('id, full_name').in('id', ownerIds);
  const workerMap = {};
  if (workers) workers.forEach(w => workerMap[w.id] = w);

  const centerStatusLabels = { validated: '✓ Validé', rejected: '✗ Refusé' };
  const html = '<div class="request-list">' + docs.map(doc => {
    const def  = WORKER_DOCS.find(w => w.key === doc.doc_type) || { name: doc.doc_type, icon: '📄' };
    const name = workerMap[doc.owner_id]?.full_name || '—';
    const date = doc.center_validated_at ? new Date(doc.center_validated_at).toLocaleDateString('fr-FR') : '—';
    const exp  = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : '—';
    return `<div class="request-card">
      <div class="request-card-header">
        <div class="request-card-icon">${def.icon}</div>
        <div class="request-card-info">
          <div class="request-card-name">${def.name} — <span class="doc-badge status-${doc.center_status === 'validated' ? 'validated' : 'rejected'}" style="font-size:11px">${centerStatusLabels[doc.center_status]}</span></div>
          <div class="request-card-meta">👷 ${name} — Validé le ${date} — Expire le ${exp}</div>
        </div>
        <button class="btn-sm btn-view" onclick="viewDoc('${doc.file_url}')">👁 Voir</button>
      </div>
    </div>`;
  }).join('') + '</div>';
  container.innerHTML = html;
}

async function validateCenterDoc(docId, status) {
  // SDR Phase 2.3 — ségrégation : le centre ne peut pas valider ses propres docs
  const { data: doc } = await sb.from('documents').select('owner_id').eq('id', docId).single();
  if (doc && doc.owner_id === currentUser.id) {
    showToast('Interdit : vous ne pouvez pas valider vos propres documents.', 'error');
    return;
  }
  const { error } = await sb.from('documents').update({
    center_status:       status,
    center_validated_by: currentUser.id,
    center_validated_at: new Date().toISOString()
  }).eq('id', docId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(status === 'validated' ? '🎓 Formation validée ✓' : '✗ Formation refusée', status === 'validated' ? 'success' : 'error');
  loadTrainerRequests();
  loadTrainerStats();
}

// ══════════════════════════════
// UPLOAD MODAL
// ══════════════════════════════
async function loadTrainingCenters() {
  if (trainingCenters.length) return; // cache
  const { data } = await sb.from('organizations').select('id, name, booking_url').eq('type', 'training_center').eq('status', 'active');
  trainingCenters = data || [];
}

async function openUploadModal(docKey, docName, category) {
  currentUploadDoc = { key: docKey, name: docName, category };
  selectedFile = null;
  document.getElementById('modalSubtitle').textContent    = 'Document : ' + docName;
  document.getElementById('fileNamePreview').textContent  = '';
  document.getElementById('expiryDate').value             = '';
  document.getElementById('centerPicker').value           = '';

  // Afficher le sélecteur de centre uniquement pour les habilitations worker
  const showCenter = category === 'worker';
  document.getElementById('centerPickerGroup').style.display = showCenter ? 'block' : 'none';

  if (showCenter) {
    await loadTrainingCenters();
    const picker = document.getElementById('centerPicker');
    picker.innerHTML = '<option value="">Aucun / Je ne sais pas</option>' +
      trainingCenters.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }

  document.getElementById('uploadModal').classList.add('open');
}

function closeModal() {
  document.getElementById('uploadModal').classList.remove('open');
  currentUploadDoc = null; selectedFile = null;
}
function handleFileSelect(e) {
  selectedFile = e.target.files[0];
  if (selectedFile) document.getElementById('fileNamePreview').textContent = '✓ ' + selectedFile.name;
}

const fileDrop = document.getElementById('fileDrop');
fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault(); fileDrop.classList.remove('dragover');
  selectedFile = e.dataTransfer.files[0];
  if (selectedFile) document.getElementById('fileNamePreview').textContent = '✓ ' + selectedFile.name;
});

async function uploadDocument() {
  if (!selectedFile) { showToast('Veuillez sélectionner un fichier', 'error'); return; }
  setLoading('uploadBtn', true, 'Envoi...');

  const ext  = selectedFile.name.split('.').pop();
  const path = `${currentUser.id}/${currentUploadDoc.key}_${Date.now()}.${ext}`;
  const { error: upErr } = await sb.storage.from('documents').upload(path, selectedFile);
  if (upErr) { showToast('Erreur upload : ' + upErr.message, 'error'); setLoading('uploadBtn', false, 'Envoyer le document'); return; }

  const { data: urlData } = sb.storage.from('documents').getPublicUrl(path);
  const expiry     = document.getElementById('expiryDate').value || null;
  const centerId   = document.getElementById('centerPicker').value || null;
  const center     = centerId ? trainingCenters.find(c => c.id === centerId) : null;

  const payload = {
    owner_id:           currentUser.id,
    doc_type:           currentUploadDoc.key,
    category:           currentUploadDoc.category,
    file_url:           urlData.publicUrl,
    expires_at:         expiry,
    status:             'pending',
    validated_by:       null,
    validated_at:       null,
    training_center_id: centerId || null,
    center_status:      centerId ? 'pending' : 'none',
    center_validated_by: null,
    center_validated_at: null,
    booking_url:        center?.booking_url || null,
    reminder_days:      30
  };

  // Pour les onglets custom : insert direct (pas d'index unique sur owner_id+doc_type+category en base)
  // Pour worker/company : upsert sur owner_id+doc_type (index unique existant)
  let dbErr;
  if (currentUploadDoc.category.startsWith('custom_')) {
    // Supprimer l'éventuel doc existant du même type dans ce tab avant d'insérer
    await sb.from('documents').delete()
      .eq('owner_id', currentUser.id)
      .eq('doc_type', currentUploadDoc.key)
      .eq('category', currentUploadDoc.category);
    const { error } = await sb.from('documents').insert(payload);
    dbErr = error;
  } else {
    const { error } = await sb.from('documents').upsert(payload, { onConflict: 'owner_id,doc_type' });
    dbErr = error;
  }
  setLoading('uploadBtn', false, 'Envoyer le document');
  if (dbErr) { showToast('Erreur : ' + dbErr.message, 'error'); return; }

  closeModal();
  const msg = centerId
    ? '✓ Document déposé — employeur et centre de formation notifiés'
    : '✓ Document déposé — en attente de validation employeur';
  showToast(msg, 'success');
  if (currentUploadDoc.category === 'worker') { loadWorkerDocs(); loadWorkerStats(); }
  else if (currentUploadDoc.category.startsWith('custom_')) { loadCustomTabDocs(currentUploadDoc.category.replace('custom_', '')); }
  else loadCompanyDocs();
}

function viewDoc(url) { if (url) window.open(url, '_blank'); }

async function downloadDoc(url, name) {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const ext  = blob.type.includes('pdf') ? '.pdf' : blob.type.includes('png') ? '.png' : '.jpg';
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = (name || 'document') + ext;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch(e) {
    showToast('Erreur téléchargement — essayez "Voir" puis enregistrez', 'error');
  }
}

// ── RATTACHEMENT WORKER → EMPLOYEUR (company ou sous-traitant) ──
async function linkToCompany() {
  const code = document.getElementById('linkTeamCode').value.toUpperCase().trim();
  if (!code) { showToast('Veuillez saisir un code employeur', 'error'); return; }
  const { data: org } = await sb.from('organizations').select('id, name').eq('team_code', code).in('type',['company','subcontractor']).single();
  if (!org) { showToast('Code invalide. Vérifiez auprès de votre employeur.', 'error'); return; }
  const { error } = await sb.from('profiles').update({ org_id: org.id }).eq('id', currentUser.id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  currentProfile.org_id = org.id;
  showToast('✓ Rattaché à ' + org.name, 'success');
  document.getElementById('linkCompanyBanner').style.display   = 'none';
  document.getElementById('linkedCompanyBanner').style.display = 'flex';
  document.getElementById('linkedCompanyName').textContent     = org.name;
}

function showChangeEmployer() {
  document.getElementById('changeEmployerPanel').style.display = 'block';
  document.getElementById('newTeamCode').value = '';
  document.getElementById('newTeamCode').focus();
}

async function changeEmployer() {
  const code = document.getElementById('newTeamCode').value.toUpperCase().trim();
  if (!code) { showToast('Veuillez saisir un code employeur', 'error'); return; }
  const { data: org } = await sb.from('organizations').select('id, name').eq('team_code', code).in('type',['company','subcontractor']).single();
  if (!org) { showToast('Code invalide. Vérifiez auprès de votre employeur.', 'error'); return; }
  if (org.id === currentProfile.org_id) { showToast('Vous êtes déjà rattaché à cette société.', 'error'); return; }
  const { error } = await sb.from('profiles').update({ org_id: org.id }).eq('id', currentUser.id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  currentProfile.org_id = org.id;
  showToast('✓ Employeur mis à jour : ' + org.name, 'success');
  document.getElementById('changeEmployerPanel').style.display  = 'none';
  document.getElementById('linkedCompanyBanner').style.display  = 'flex';
  document.getElementById('linkedCompanyName').textContent      = org.name;
}

async function detachFromCompany() {
  if (!confirm('Êtes-vous sûr de vouloir vous détacher de votre employeur ? Vos documents restent les vôtres.')) return;
  const { error } = await sb.from('profiles').update({ org_id: null }).eq('id', currentUser.id);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  currentProfile.org_id = null;
  showToast('✓ Détaché de votre employeur', 'success');
  document.getElementById('linkedCompanyBanner').style.display  = 'none';
  document.getElementById('changeEmployerPanel').style.display  = 'none';
  document.getElementById('linkCompanyBanner').style.display    = 'block';
  document.getElementById('linkTeamCode').value = '';
}

function copyTeamCode() {
  const code = document.getElementById('teamCodeDisplay').textContent;
  navigator.clipboard.writeText(code).then(() => showToast('Code copié : ' + code, 'success'));
}

// ── VALIDATION EMPLOYEUR (SDR 2.3) ──
async function validateDoc(docId, status) {
  const { data: doc } = await sb.from('documents').select('owner_id').eq('id', docId).single();
  if (doc && doc.owner_id === currentUser.id) {
    showToast('Interdit : vous ne pouvez pas valider vos propres documents.', 'error');
    return;
  }
  const { error } = await sb.from('documents').update({
    status,
    validated_by: currentUser.id,
    validated_at: new Date().toISOString()
  }).eq('id', docId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(status === 'validated' ? '✓ Document validé' : '✗ Document refusé', status === 'validated' ? 'success' : 'error');
  loadCompanyWorkers();
  loadCompanyStats();
}

// ── ÉDITION DOCUMENT ──
function openEditDocModal(docId, docName, expiresAt, status) {
  document.getElementById('editDocId').value            = docId;
  document.getElementById('editDocModalSubtitle').textContent = docName;
  document.getElementById('editDocNote').value          = '';
  // Date expiration
  if (expiresAt && expiresAt !== 'null' && expiresAt !== '') {
    document.getElementById('editDocExpiry').value = expiresAt.split('T')[0];
  } else {
    document.getElementById('editDocExpiry').value = '';
  }
  // Statut
  const sel = document.getElementById('editDocStatus');
  sel.value = status || 'pending';
  // Masquer statut si worker (ne peut pas changer son propre statut)
  sel.parentElement.style.display = currentProfile?.role === 'worker' ? 'none' : 'block';
  document.getElementById('editDocModal').classList.add('active');
}

function closeEditDocModal() {
  document.getElementById('editDocModal').classList.remove('active');
}

async function saveDocEdit() {
  const docId    = document.getElementById('editDocId').value;
  const expiry   = document.getElementById('editDocExpiry').value;
  const status   = document.getElementById('editDocStatus').value;

  const updates = {
    expires_at: expiry ? new Date(expiry).toISOString() : null,
    status,
  };
  // Workers ne peuvent pas changer leur propre statut
  if (currentProfile?.role === 'worker') delete updates.status;

  const { error } = await sb.from('documents').update(updates).eq('id', docId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Document mis à jour', 'success');
  closeEditDocModal();
  // Rafraîchir selon le rôle
  if (currentProfile?.role === 'worker')       loadWorkerDocs();
  else if (currentProfile?.role === 'company') { loadCompanyStats(); loadCompanyWorkers(); }
  else if (currentProfile?.role === 'hse')     loadHSEStats();
  else if (currentProfile?.role === 'subcontractor') loadSTWorkers();
}

// ══════════════════════════════
// PARTAGE DE DOCUMENTS (WORKER)
// ══════════════════════════════
async function openShareModal() {
  const { data: docs } = await sb.from('documents').select('doc_type, status').eq('owner_id', currentUser.id).eq('category', 'worker');
  const picker = document.getElementById('shareDocPicker');
  picker.innerHTML = WORKER_DOCS.map(def => {
    const doc    = docs ? docs.find(d => d.doc_type === def.key) : null;
    const hasDoc = doc && (doc.status === 'validated' || doc.status === 'pending');
    const statusLabel = doc ? (doc.status === 'validated' ? '✓ Validé' : '⏳ En attente') : 'Non déposé';
    const statusColor = doc ? (doc.status === 'validated' ? '#86EFAC' : '#FCD34D') : 'var(--muted)';
    return `<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;background:var(--inset-bg);border:1px solid rgba(255,255,255,${hasDoc ? '.1' : '.04'});cursor:${hasDoc ? 'pointer' : 'not-allowed'};opacity:${hasDoc ? '1' : '.4'}">
      <input type="checkbox" value="${def.key}" ${!hasDoc ? 'disabled' : ''} style="width:16px;height:16px;accent-color:var(--orange)" />
      <span>${def.icon} ${def.name}</span>
      <span style="margin-left:auto;font-size:10px;color:${statusColor};font-weight:700">${statusLabel}</span>
    </label>`;
  }).join('');
  document.getElementById('shareEmail').value  = '';
  document.getElementById('shareExpiry').value = '';
  document.getElementById('shareModal').classList.add('open');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('open');
}

async function createShare() {
  const email    = document.getElementById('shareEmail').value.trim();
  const expDays  = document.getElementById('shareExpiry').value;
  const checked  = [...document.querySelectorAll('#shareDocPicker input:checked')].map(i => i.value);

  if (!email)          { showToast('Veuillez saisir un email', 'error'); return; }
  if (!checked.length) { showToast('Sélectionnez au moins un document', 'error'); return; }

  const expiresAt = expDays ? new Date(Date.now() + parseInt(expDays) * 86400000).toISOString().split('T')[0] : null;

  setLoading('shareBtn', true, 'Envoi...');
  const { error } = await sb.from('document_shares').insert({
    worker_id:   currentUser.id,
    guest_email: email.toLowerCase(),
    doc_types:   checked,
    expires_at:  expiresAt
  });
  setLoading('shareBtn', false, '📤 Envoyer le partage');

  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  closeShareModal();
  showToast('✓ Partage créé — ' + email + ' peut maintenant créer son compte', 'success');
  loadWorkerShares();
}

async function loadWorkerShares() {
  const container = document.getElementById('workerSharesContainer');
  const { data: shares } = await sb.from('document_shares').select('*').eq('worker_id', currentUser.id).order('created_at', { ascending: false });

  if (!shares || !shares.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📤</div><div class="empty-state-text">Aucun partage créé.<br>Partagez vos documents validés avec vos clients.</div></div>`;
    return;
  }
  const now = new Date();
  const html = '<div class="request-list">' + shares.map(s => {
    const expired  = s.expires_at && new Date(s.expires_at) < now;
    const expLabel = s.expires_at ? (expired ? '⛔ Expiré le ' : '📅 Expire le ') + new Date(s.expires_at).toLocaleDateString('fr-FR') : '♾️ Permanent';
    const docNames = s.doc_types.map(k => WORKER_DOCS.find(d => d.key === k)?.name || k).join(', ');
    return `<div class="request-card" style="${expired ? 'opacity:.5' : ''}">
      <div class="request-card-header">
        <div class="request-card-icon">👁</div>
        <div class="request-card-info">
          <div class="request-card-name">📧 ${s.guest_email}</div>
          <div class="request-card-meta">${docNames} — ${expLabel}</div>
        </div>
        <button class="btn-sm btn-reject" onclick="revokeShare('${s.id}')">✕ Révoquer</button>
      </div>
    </div>`;
  }).join('') + '</div>';
  container.innerHTML = html;
}

async function revokeShare(shareId) {
  if (!confirm('Révoquer ce partage ? Le client ne pourra plus accéder aux documents.')) return;
  const { error } = await sb.from('document_shares').delete().eq('id', shareId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Partage révoqué', 'success');
  loadWorkerShares();
}

// ══════════════════════════════
// DOCUMENTS REÇUS (tous rôles)
// ══════════════════════════════
let _receivedData = null; // cache pour les filtres

async function loadReceivedDocs(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Chargement...</div></div>`;

  const email = currentProfile.email;

  // ── Demandes de signature entrantes ──
  await renderIncomingSignatureRequests(containerId + '-sigreq', email).catch(function(){});
  const now   = new Date();

  const { data: shares } = await sb.from('document_shares')
    .select('*')
    .eq('guest_email', email.toLowerCase())
    .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`);

  if (!shares || !shares.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📂</div><div class="empty-state-text">Aucun document partagé avec vous pour l'instant.</div></div>`;
    return;
  }

  // ── Batch load workers + orgs ──
  const workerIds = [...new Set(shares.map(s => s.worker_id))];
  const { data: allWorkers } = await sb.from('profiles').select('id, full_name, org_id').in('id', workerIds);
  const workerProfileMap = {};
  if (allWorkers) allWorkers.forEach(w => workerProfileMap[w.id] = w);

  const allOrgIds = [...new Set((allWorkers || []).map(w => w.org_id).filter(Boolean))];
  const orgNameMap = {};
  if (allOrgIds.length) {
    const { data: orgs } = await sb.from('organizations').select('id, name').in('id', allOrgIds);
    if (orgs) orgs.forEach(o => orgNameMap[o.id] = o.name);
  }

  // ── Batch load tous les docs ──
  const { data: allDocs } = await sb.from('documents')
    .select('*').in('owner_id', workerIds).eq('category', 'worker');
  const docsMap = {};
  if (allDocs) allDocs.forEach(d => { if (!docsMap[d.owner_id]) docsMap[d.owner_id] = []; docsMap[d.owner_id].push(d); });

  // ── Fusionner les partages du même worker ──
  // Un worker peut avoir fait plusieurs partages séparés → on regroupe en un seul
  const mergedMap = {};
  shares.forEach(share => {
    const wid = share.worker_id;
    if (!mergedMap[wid]) {
      mergedMap[wid] = {
        worker_id: wid,
        doc_types: [...share.doc_types],
        expires_at: share.expires_at // on garde la plus lointaine
      };
    } else {
      // Ajouter les doc_types sans doublons
      share.doc_types.forEach(dt => {
        if (!mergedMap[wid].doc_types.includes(dt)) mergedMap[wid].doc_types.push(dt);
      });
      // Garder la date d'expiration la plus lointaine (ou null = permanent)
      if (!share.expires_at) {
        mergedMap[wid].expires_at = null;
      } else if (mergedMap[wid].expires_at && new Date(share.expires_at) > new Date(mergedMap[wid].expires_at)) {
        mergedMap[wid].expires_at = share.expires_at;
      }
    }
  });

  // ── Construire structure enrichie (1 entrée par worker) ──
  const enriched = Object.values(mergedMap).map(function(merged) {
    const worker   = workerProfileMap[merged.worker_id] || {};
    const orgName  = worker.org_id ? orgNameMap[worker.org_id] || '— Sans société —' : '— Sans société —';
    const orgId    = worker.org_id || '__none__';
    const allDocTypes = merged.doc_types;
    const docs     = (docsMap[merged.worker_id] || []).filter(d => allDocTypes.includes(d.doc_type));
    const expLabel = merged.expires_at ? 'Expire le ' + new Date(merged.expires_at).toLocaleDateString('fr-FR') : 'Permanent';
    const validated = docs.filter(d => d.status === 'validated' && (!d.expires_at || new Date(d.expires_at) > now)).length;
    const pending   = docs.filter(d => d.status === 'pending').length;
    const expired   = docs.filter(d => d.expires_at && new Date(d.expires_at) <= now).length;
    const total     = allDocTypes.length;
    // On garde une référence share synthétique avec tous les doc_types fusionnés
    const share = { worker_id: merged.worker_id, doc_types: allDocTypes, expires_at: merged.expires_at };
    return { share, worker, orgName, orgId, docs, expLabel, validated, pending, expired, total };
  });

  _receivedData = { enriched, containerId };
  renderReceivedDocs(containerId, enriched, 'all', '', null);
}

function renderReceivedDocs(containerId, enriched, activeOrg, searchQ, statusFilter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const now = new Date();
  const sf  = statusFilter || '';

  // ── Grouper par org ──
  const byOrg = {};
  enriched.forEach(function(e) {
    if (!byOrg[e.orgId]) byOrg[e.orgId] = { name: e.orgName, items: [] };
    byOrg[e.orgId].items.push(e);
  });
  const orgKeys  = Object.keys(byOrg);
  const multiOrg = orgKeys.length > 1;

  // ── Filtrer ──
  let filtered = enriched.slice();
  if (activeOrg !== 'all') filtered = filtered.filter(function(e) { return e.orgId === activeOrg; });
  if (searchQ) {
    const q = searchQ.toLowerCase();
    filtered = filtered.filter(function(e) {
      return (e.worker.full_name || '').toLowerCase().includes(q) || e.orgName.toLowerCase().includes(q);
    });
  }
  if (sf === 'validated') filtered = filtered.filter(function(e) { return e.validated === e.total; });
  if (sf === 'pending')   filtered = filtered.filter(function(e) { return e.pending > 0; });
  if (sf === 'expiring')  filtered = filtered.filter(function(e) { return e.expired > 0; });

  // ── Helpers styles boutons ──
  function filterBtnStyle(val, color) {
    const active = val === sf;
    const bg     = active ? (color ? color + '22' : 'rgba(255,255,255,.12)') : 'rgba(255,255,255,.04)';
    const col    = active ? (color || 'var(--white)') : 'var(--muted)';
    const border = active ? (color ? color + '44' : 'rgba(255,255,255,.2)') : 'rgba(255,255,255,.08)';
    return 'font-size:12px;padding:5px 12px;border-radius:99px;cursor:pointer;font-weight:600;border:1px solid ' + border + ';background:' + bg + ';color:' + col;
  }
  // ── Construction HTML ──
  const parts = [];

  // Barre de contrôle : recherche + dropdown société + filtres statut
  const filterDefs = [
    { val: '',          label: 'Tous statuts',  color: '' },
    { val: 'validated', label: '✓ Validés',     color: '#22C55E' },
    { val: 'pending',   label: '⏳ En attente', color: '#F59E0B' },
    { val: 'expiring',  label: '⚠️ Expirés',    color: '#EF4444' }
  ];
  const filterBtns = filterDefs.map(function(f) {
    return '<button style="' + filterBtnStyle(f.val, f.color) + '" '
      + 'onclick="renderReceivedDocs(\'' + containerId + '\',_receivedData.enriched,\'' + activeOrg + '\',\'' + searchQ + '\',\'' + f.val + '\')">'
      + f.label + '</button>';
  }).join('');

  // Dropdown société — scalable quel que soit le nombre de sociétés
  let orgSelect = '';
  if (multiOrg) {
    const options = '<option value="all">🏢 Toutes les sociétés (' + enriched.length + ')</option>'
      + orgKeys.map(function(key) {
          const org = byOrg[key];
          return '<option value="' + key + '"' + (key === activeOrg ? ' selected' : '') + '>'
            + org.name + ' — ' + org.items.length + ' intervenant' + (org.items.length > 1 ? 's' : '')
            + '</option>';
        }).join('');
    orgSelect = '<select class="form-input" '
      + 'onchange="renderReceivedDocs(\'' + containerId + '\',_receivedData.enriched,this.value,\'' + searchQ + '\',\'' + sf + '\')" '
      + 'style="min-width:200px;max-width:260px;padding:8px 12px;font-size:13px">'
      + options + '</select>';
  }

  parts.push(
    '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:20px">'
    + '<input type="text" class="form-input" placeholder="🔍 Rechercher un intervenant..." value="' + searchQ + '" '
    + 'oninput="renderReceivedDocs(\'' + containerId + '\',_receivedData.enriched,\'' + activeOrg + '\',this.value,\'' + sf + '\')" '
    + 'style="flex:1;min-width:180px;max-width:240px;padding:8px 12px;font-size:13px"/>'
    + orgSelect
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + filterBtns + '</div>'
    + '</div>'
  );

  if (!filtered.length) {
    parts.push('<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Aucun résultat pour ces filtres.</div></div>');
    container.innerHTML = parts.join('');
    return;
  }

  // Accordéons
  filtered.forEach(function(e, idx) {
    const share      = e.share;
    const worker     = e.worker;
    const workerName = worker.full_name || 'Intervenant';
    const accId      = 'rcv-acc-' + containerId + '-' + idx;

    let statusDot = '#94A3B8';
    let statusTxt = e.validated + '/' + e.total + ' validés';
    if (e.validated === e.total && e.total > 0) { statusDot = '#22C55E'; statusTxt = 'Complet ✓'; }
    else if (e.expired > 0)                     { statusDot = '#EF4444'; statusTxt = e.expired + ' expiré(s)'; }
    else if (e.pending > 0)                     { statusDot = '#F59E0B'; statusTxt = e.pending + ' en attente'; }

    const orgBadge = e.orgName !== '— Sans société —'
      ? '<span style="font-size:12px;font-weight:700;color:var(--orange);padding:2px 8px;border-radius:99px;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2)">🏢 ' + e.orgName + '</span>' : '';

    const docCards = share.doc_types.map(function(key) {
      const def = WORKER_DOCS.find(function(d) { return d.key === key; }) || { name: key, icon: '📄' };
      const doc = e.docs.find(function(d) { return d.doc_type === key; });
      if (!doc) return '<div class="doc-card"><div class="doc-card-header"><div class="doc-card-icon">' + def.icon + '</div>'
        + '<div class="doc-card-badges"><span class="doc-badge status-empty">Non déposé</span></div></div>'
        + '<div class="doc-card-name">' + def.name + '</div></div>';
      const expD  = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : null;
      const isExp = doc.expires_at && new Date(doc.expires_at) <= now;
      const stLbl = doc.status === 'validated' ? '✓ Validé' : doc.status === 'pending' ? '⏳ En attente' : doc.status;
      const expHtml = expD ? '<div class="doc-card-expiry ' + (isExp ? 'urgent' : 'ok') + '">📅 ' + expD + '</div>' : '';
      return '<div class="doc-card">'
        + '<div class="doc-card-header"><div class="doc-card-icon">' + def.icon + '</div>'
        + '<div class="doc-card-badges"><span class="doc-badge status-' + doc.status + '">' + stLbl + '</span></div></div>'
        + '<div class="doc-card-name">' + def.name + '</div>'
        + expHtml
        + '<div class="doc-card-actions">'
        + '<button class="btn-sm btn-view" onclick="viewDoc(\'' + doc.file_url + '\')">👁 Voir</button>'
        + '<button class="btn-sm btn-upload" onclick="downloadDoc(\'' + doc.file_url + '\',\'' + def.name + '\')">⬇ Télécharger</button>'
        + '</div></div>';
    }).join('');

    parts.push(
      '<div style="margin-bottom:10px;border:1px solid var(--inset-border);border-radius:14px;overflow:hidden">'
      + '<div onclick="toggleAccordion(\'' + accId + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;background:var(--inset-bg2);user-select:none">'
      + '<div style="width:36px;height:36px;border-radius:10px;background:rgba(249,115,22,.12);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">👷</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + workerName + '</div>'
      + '<div style="font-size:12px;color:var(--muted);margin-top:2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
      + orgBadge + '<span>' + e.expLabel + '</span></div></div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      + '<div style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;background:' + statusDot + '22;border:1px solid ' + statusDot + '44">'
      + '<div style="width:6px;height:6px;border-radius:50%;background:' + statusDot + '"></div>'
      + '<span style="font-size:11px;font-weight:700;color:' + statusDot + '">' + statusTxt + '</span></div>'
      + '<span id="' + accId + '-chevron" style="color:var(--muted);font-size:12px;transition:transform .2s">▼</span>'
      + '</div></div>'
      + '<div id="' + accId + '" style="display:none;padding:16px 18px;border-top:1px solid rgba(255,255,255,.06)">'
      + '<div class="doc-grid">' + docCards + '</div></div></div>'
    );
  });

  container.innerHTML = parts.join('');
}

function toggleAccordion(id) {
  const body    = document.getElementById(id);
  const chevron = document.getElementById(id + '-chevron');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display      = isOpen ? 'none' : 'block';
  chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// ── LAZY LOAD PARTAGES ──

// ══════════════════════════════════════
// INVITATION SOUS-TRAITANT (côté EU)
// ══════════════════════════════════════

async function loadST(orgId, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !orgId) {
    if (container) container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Organisation non configurée.</div></div>`;
    return;
  }

  // Charger relations + invitations + code équipe en parallèle
  const [{ data: rels }, { data: invites }, { data: euOrg }] = await Promise.all([
    sb.from('org_relationships').select('id, st_org_id, created_at').eq('eu_org_id', orgId).order('created_at', { ascending: false }),
    sb.from('st_invites').select('*').eq('eu_org_id', orgId).order('created_at', { ascending: false }),
    sb.from('organizations').select('team_code').eq('id', orgId).single()
  ]);

  const attachedEmails = new Set(); // pour filtrer les invités déjà rattachés

  // Charger noms des ST rattachés
  const stOrgIds = (rels || []).map(r => r.st_org_id);
  const orgMap = {};
  if (stOrgIds.length) {
    const { data: orgs } = await sb.from('organizations').select('id, name').in('id', stOrgIds);
    if (orgs) orgs.forEach(o => orgMap[o.id] = o);
  }

  // Charger emails des responsables ST rattachés pour filtrer les invitations
  if (stOrgIds.length) {
    const { data: stProfiles } = await sb.from('profiles').select('email, org_id').in('org_id', stOrgIds);
    if (stProfiles) stProfiles.forEach(p => attachedEmails.add(p.email.toLowerCase()));
  }

  const pendingInvites = (invites || []).filter(i => !attachedEmails.has(i.st_email.toLowerCase()));

  // Bannière code équipe
  let html = '';
  if (euOrg) html += `<div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.25);border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
    <div style="flex:1"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:3px">Votre code équipe</div>
    <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:#818CF8;letter-spacing:3px">${euOrg.team_code}</div></div>
    <button onclick="navigator.clipboard.writeText('${euOrg.team_code}').then(()=>showToast('Code copié','success'))" class="btn-sm btn-view">📋 Copier</button>
  </div>`;

  // Section ST rattachés
  if (rels && rels.length) {
    // Charger missions pour tous les ST rattachés
    const { data: allMissions } = await sb.from('missions')
      .select('id, st_org_id, title, status, start_date, end_date, description')
      .eq('eu_org_id', orgId)
      .order('created_at', { ascending: false });

    const missionsByOrg = {};
    (allMissions || []).forEach(m => {
      if (!missionsByOrg[m.st_org_id]) missionsByOrg[m.st_org_id] = [];
      missionsByOrg[m.st_org_id].push(m);
    });

    const statusLabel = { draft:'Brouillon', pending:'⏳ En attente', approved:'✅ Validée', rejected:'❌ Refusée', active:'Active' };
    const statusColor = { draft:'#94A3B8', pending:'#F59E0B', approved:'#22C55E', rejected:'#EF4444', active:'#22C55E' };

    html += `<div class="section-title" style="margin-bottom:12px">✅ Rattachés (${rels.length})</div><div class="request-list" style="margin-bottom:24px">` +
    rels.map(rel => {
      const st   = orgMap[rel.st_org_id] || {};
      const date = new Date(rel.created_at).toLocaleDateString('fr-FR');
      const stMissions = missionsByOrg[rel.st_org_id] || [];

      const missionsHtml = stMissions.length ? stMissions.map(m => {
        const sc = statusColor[m.status] || '#94A3B8';
        const sl = statusLabel[m.status] || m.status;
        const dates = m.start_date ? `📅 ${new Date(m.start_date).toLocaleDateString('fr-FR')}${m.end_date ? ' → '+new Date(m.end_date).toLocaleDateString('fr-FR') : ''}` : '';
        return `<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;padding:12px 14px;margin-top:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div>
              <div style="font-size:14px;font-weight:700">${m.title}</div>
              ${dates ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${dates}</div>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:11px;font-weight:700;color:${sc}">${sl}</span>
              ${m.status === 'pending' ? `
                <button onclick="approveMission('${m.id}','${containerId}')" class="btn-sm btn-validate" style="font-size:11px">✓ Valider</button>
                <button onclick="rejectMission('${m.id}','${containerId}')" class="btn-sm btn-reject" style="font-size:11px">✕ Refuser</button>
              ` : ''}
            </div>
          </div>
          ${m.status === 'approved' || m.status === 'active' ? `
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <button onclick="viewMissionWorkers('${m.id}','${m.title}')" class="btn-sm btn-view" style="font-size:11px">👷 Voir intervenants</button>
            <button onclick="viewMissionDocs('${m.id}','${m.title}','${rel.st_org_id}')" class="btn-sm btn-view" style="font-size:11px">📄 Voir docs</button>
          </div>` : ''}
        </div>`;
      }).join('') : `<div style="font-size:12px;color:var(--muted);margin-top:10px;font-style:italic">Aucune mission déclarée</div>`;

      return `<div class="request-card" style="flex-direction:column;align-items:stretch">
        <div class="request-card-header">
          <div class="request-card-icon">🤝</div>
          <div class="request-card-info">
            <div class="request-card-name">${st.name || 'Sous-traitant'}</div>
            <div class="request-card-meta">Rattaché le ${date} · ${stMissions.length} mission(s)</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <button onclick="openCreateMissionAsEU('${rel.st_org_id}','${(st.name||'').replace(/'/g,'')}','${orgId}','${containerId}')" class="btn-sm btn-upload" style="white-space:nowrap;font-size:11px">➕ Mission</button>
            <span style="font-size:11px;color:#86EFAC;font-weight:700">✓ Actif</span>
          </div>
        </div>
        <div style="padding:0 4px 4px">${missionsHtml}</div>
      </div>`;
    }).join('') + '</div>';
  }

  // Section invités en attente
  if (pendingInvites.length) {
    const { data: euOrgFull } = await sb.from('organizations').select('name, team_code').eq('id', orgId).single();
    html += `<div class="section-title" style="margin-bottom:12px">⏳ Invités en attente (${pendingInvites.length})</div><div class="request-list">` +
    pendingInvites.map(inv => {
      const date      = new Date(inv.created_at).toLocaleDateString('fr-FR');
      const subject   = encodeURIComponent(`Invitation SafetySphere — ${euOrgFull?.name || ''}`);
      const bodyShort = encodeURIComponent(`Bonjour,\n\n${euOrgFull?.name} vous invite sur SafetySphere.\n\nCréez votre compte : https://safetysphere.vercel.app\nRôle : Sous-Traitant\nCode équipe EU : ${euOrgFull?.team_code}\n\nCordialement,\n${currentProfile.full_name}`);
      return `<div class="request-card">
        <div class="request-card-header">
          <div class="request-card-icon">📧</div>
          <div class="request-card-info">
            <div class="request-card-name">${inv.st_email}</div>
            <div class="request-card-meta">Invité le ${date}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="window.open('mailto:${inv.st_email}?subject=${subject}&body=${bodyShort}','_self')" class="btn-sm btn-view" style="white-space:nowrap">🔁 Relancer</button>
            <button onclick="cancelSTInviteFromList('${inv.id}','${containerId}')" class="btn-sm btn-reject" style="white-space:nowrap">✕</button>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  if ((!rels || !rels.length) && !pendingInvites.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">🤝</div><div class="empty-state-text">Aucun sous-traitant pour l'instant.<br>Cliquez sur "Inviter un sous-traitant" pour commencer.</div></div>`;
  }

  container.innerHTML = html;
}

async function cancelSTInviteFromList(inviteId, containerId) {
  if (!confirm('Supprimer cette invitation ?')) return;
  const { error } = await sb.from('st_invites').delete().eq('id', inviteId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Invitation supprimée', 'success');
  loadST(currentProfile.org_id, containerId);
}

async function loadHSEStats() {
  if (!currentProfile.org_id) return;
  const [{ data: rels }, { data: invites }] = await Promise.all([
    sb.from('org_relationships').select('id').eq('eu_org_id', currentProfile.org_id),
    sb.from('st_invites').select('id').eq('eu_org_id', currentProfile.org_id),
  ]);
  document.getElementById('hseStat1').textContent = rels    ? rels.length    : 0;
  document.getElementById('hseStat2').textContent = invites ? invites.length : 0;
  // Charger le widget conformité si autorisé
  await loadComplianceWidget('hse');
}

// ══════════════════════════════════════
// CONFORMITÉ — SCORE
// ══════════════════════════════════════

async function loadComplianceWidget(role) {
  // Vérifier si ce rôle a accès
  const { data: access } = await sb.from('compliance_access').select('enabled').eq('role', role).single();
  if (!access || !access.enabled) return;

  // Charger ou créer la config de l'org
  let config = await getOrCreateComplianceConfig();
  if (!config) return;

  // Calculer le score
  const score = await calculateComplianceScore(config.components);

  // Afficher le widget
  document.getElementById('complianceWidget').style.display = 'block';
  renderComplianceScore(score, config.display_mode);
  renderComplianceComponents(score.details, config.components);
}

async function getOrCreateComplianceConfig() {
  if (!currentProfile.org_id) return null;
  const { data: existing } = await sb.from('compliance_config').select('*').eq('org_id', currentProfile.org_id).single();
  if (existing) return existing;
  // Créer avec valeurs par défaut
  const { data: created, error: createErr } = await sb.from('compliance_config').insert({
    org_id: currentProfile.org_id,
    components: { st_documents: true, worker_habilitations: false, st_ratio: false, pdp: false, permits: false },
    display_mode: 'percent'
  }).select().single();
  if (createErr) { console.warn('compliance_config create error', createErr.message); return null; }
  return created;
}

async function calculateComplianceScore(components) {
  const details = [];
  let total = 0, achieved = 0;

  if (components.st_documents) {
    const { data: rels } = await sb.from('org_relationships').select('st_org_id').eq('eu_org_id', currentProfile.org_id);
    const stIds = rels ? rels.map(r => r.st_org_id) : [];
    let stScore = 0;
    if (stIds.length > 0) {
      const now = new Date().toISOString();
      const { data: docs } = await sb.from('documents').select('owner_id, status, expires_at')
        .in('owner_id', stIds).eq('category', 'company').eq('status', 'validated');
      const validDocs = docs ? docs.filter(d => !d.expires_at || d.expires_at > now) : [];
      const stWithDocs = [...new Set(validDocs.map(d => d.owner_id))];
      stScore = stIds.length > 0 ? Math.round((stWithDocs.length / stIds.length) * 100) : 0;
    } else { stScore = 100; }
    details.push({ label: '📄 Documents ST valides', score: stScore, key: 'st_documents' });
    total++; achieved += stScore / 100;
  }

  if (components.worker_habilitations) {
    const { data: workers } = await sb.from('profiles').select('id').eq('org_id', currentProfile.org_id).eq('role', 'worker');
    let habScore = 0;
    if (workers && workers.length > 0) {
      const now = new Date().toISOString();
      const wIds = workers.map(w => w.id);
      const { data: docs } = await sb.from('documents').select('owner_id, status, expires_at')
        .in('owner_id', wIds).eq('category', 'worker').eq('status', 'validated');
      const validHab = docs ? docs.filter(d => !d.expires_at || d.expires_at > now) : [];
      const wWithHab = [...new Set(validHab.map(d => d.owner_id))];
      habScore = Math.round((wWithHab.length / workers.length) * 100);
    } else { habScore = 100; }
    details.push({ label: '🎓 Habilitations workers', score: habScore, key: 'worker_habilitations' });
    total++; achieved += habScore / 100;
  }

  if (components.st_ratio) {
    const [{ data: rels }, { data: invites }] = await Promise.all([
      sb.from('org_relationships').select('id').eq('eu_org_id', currentProfile.org_id),
      sb.from('st_invites').select('id').eq('eu_org_id', currentProfile.org_id),
    ]);
    const rattaches = rels ? rels.length : 0;
    const enAttente = invites ? invites.length : 0;
    const ratioScore = (rattaches + enAttente) > 0
      ? Math.round((rattaches / (rattaches + enAttente)) * 100) : 100;
    details.push({ label: '🔗 Taux de rattachement ST', score: ratioScore, key: 'st_ratio' });
    total++; achieved += ratioScore / 100;
  }

  const globalScore = total > 0 ? Math.round((achieved / total) * 100) : 0;
  return { global: globalScore, details };
}

function renderComplianceScore(score, mode) {
  const el = document.getElementById('complianceScoreDisplay');
  const color = score.global >= 80 ? '#22C55E' : score.global >= 50 ? '#F59E0B' : '#EF4444';
  const label = score.global >= 80 ? 'Conforme' : score.global >= 50 ? 'Partiel' : 'Critique';

  if (mode === 'grade') {
    const grade = score.global >= 90 ? 'A' : score.global >= 75 ? 'B' : score.global >= 50 ? 'C' : 'D';
    el.innerHTML = `
      <div class="compliance-score-circle" style="border-color:${color};color:${color}">
        <div style="font-size:36px;line-height:1">${grade}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'Barlow',sans-serif;font-weight:400">${label}</div>
      </div>`;
  } else if (mode === 'gauge') {
    const emoji = score.global >= 80 ? '🟢' : score.global >= 50 ? '🟡' : '🔴';
    el.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:48px">${emoji}</div>
        <div style="font-size:13px;font-weight:700;color:${color};margin-top:6px">${label}</div>
        <div style="font-size:11px;color:var(--muted)">${score.global}%</div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="compliance-score-circle" style="border-color:${color};color:${color}">
        <div style="font-size:30px;line-height:1">${score.global}%</div>
        <div style="font-size:11px;color:var(--muted);font-family:'Barlow',sans-serif;font-weight:400">${label}</div>
      </div>`;
  }
}

function renderComplianceComponents(details, components) {
  const el = document.getElementById('complianceComponents');
  if (!details || !details.length) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px">Aucun composant actif — configurez votre score via ⚙️</div>`;
    return;
  }
  el.innerHTML = details.map(d => {
    const color = d.score >= 80 ? '#22C55E' : d.score >= 50 ? '#F59E0B' : '#EF4444';
    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">${d.label}</span>
          <span style="font-size:13px;font-weight:700;color:${color}">${d.score}%</span>
        </div>
        <div class="compliance-bar-wrap">
          <div class="compliance-bar" style="width:${d.score}%;background:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

async function openComplianceConfig() {
  showToast('Ouverture configuration...', 'info');
  // Fallback si pas de config en base : valeurs par défaut
  let comps = { st_documents: true, worker_habilitations: false, st_ratio: false };
  let mode  = 'percent';
  try {
    const config = await getOrCreateComplianceConfig();
    if (config) { comps = config.components; mode = config.display_mode || 'percent'; }
  } catch(e) { console.warn('compliance config load error', e); }

  ['st_documents','worker_habilitations','st_ratio'].forEach(k => {
    const el = document.getElementById(`orgComp_${k}`);
    if (el) el.checked = !!comps[k];
  });
  const radio = document.querySelector(`input[name="orgDisplayMode"][value="${mode}"]`);
  if (radio) radio.checked = true;
  const modal = document.getElementById('complianceConfigModal');
  if (!modal) { showToast('Erreur : modal introuvable', 'error'); return; }
  modal.classList.add('active');
}

function closeComplianceConfig() {
  document.getElementById('complianceConfigModal').classList.remove('active');
}

function previewComplianceDisplay(mode) { /* aperçu en temps réel si besoin */ }

async function saveOrgComplianceConfig() {
  const components = {
    st_documents:          document.getElementById('orgComp_st_documents').checked,
    worker_habilitations:  document.getElementById('orgComp_worker_habilitations').checked,
    st_ratio:              document.getElementById('orgComp_st_ratio').checked,
    pdp: false, permits: false
  };
  const display_mode = document.querySelector('input[name="orgDisplayMode"]:checked')?.value || 'percent';
  const { error } = await sb.from('compliance_config').upsert(
    { org_id: currentProfile.org_id, components, display_mode, updated_at: new Date().toISOString() },
    { onConflict: 'org_id' }
  );
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Configuration sauvegardée', 'success');
  closeComplianceConfig();
  // Recalculer et afficher
  const score = await calculateComplianceScore(components);
  renderComplianceScore(score, display_mode);
  renderComplianceComponents(score.details, components);
}

// ── ADMIN : conformité ──
// ══════════════════════════════════════
// PROFIL ORGANISATION
// ══════════════════════════════════════
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

function loadRoleAnalytics(role) {
  var containerId = 'role-analytics-' + role;
  var ctn = document.getElementById(containerId);
  if (!ctn) return;
  var state = _roleAnalyticsState[role] || { range: 'month' };
  _roleAnalyticsState[role] = state;

  // Render toolbar
  ctn.innerHTML = _buildRoleAnalyticsToolbar(role, state.range)
    + '<div id="ra-kpis-' + role + '" class="analytics-kpi-grid" style="margin-top:16px">'
    + '<div class="analytics-kpi-skeleton"></div><div class="analytics-kpi-skeleton"></div>'
    + '<div class="analytics-kpi-skeleton"></div><div class="analytics-kpi-skeleton"></div>'
    + '<div class="analytics-kpi-skeleton"></div><div class="analytics-kpi-skeleton"></div>'
    + '</div>'
    + '<div id="ra-charts-' + role + '"></div>'
    + '<div id="ra-tables-' + role + '"></div>';

  _loadRoleAnalyticsData(role);
}

function _buildRoleAnalyticsToolbar(role, activeRange) {
  var ranges = [
    { key:'month',   label:'Ce mois' },
    { key:'quarter', label:'Trimestre' },
    { key:'year',    label:'Année' },
    { key:'custom',  label:'Plage libre' },
  ];
  var pills = ranges.map(function(r) {
    return '<button class="a-pill' + (r.key === activeRange ? ' active' : '')
      + '" onclick="setRoleAnalyticsRange(\'' + role + '\',\'' + r.key + '\',this)">' + r.label + '</button>';
  }).join('');

  var today = new Date();
  var lastM = new Date(); lastM.setMonth(lastM.getMonth()-1);
  var todayStr = today.toISOString().slice(0,10);
  var lastMStr = lastM.toISOString().slice(0,10);

  return '<div class="analytics-toolbar">'
    + '<div class="analytics-range-pills">' + pills + '</div>'
    + '<div id="ra-custom-' + role + '" class="analytics-custom-range" style="display:none">'
    + '<input type="date" class="form-input" id="ra-from-' + role + '" value="' + lastMStr + '" style="width:150px;font-size:12px;padding:7px 10px">'
    + '<span style="color:var(--muted);font-size:13px">→</span>'
    + '<input type="date" class="form-input" id="ra-to-' + role + '" value="' + todayStr + '" style="width:150px;font-size:12px;padding:7px 10px">'
    + '<button class="btn-sm btn-validate" style="font-size:12px;padding:6px 14px" onclick="_loadRoleAnalyticsData(\'' + role + '\')">Appliquer</button>'
    + '</div>'
    + '<div id="ra-label-' + role + '" style="font-size:12px;color:var(--muted);margin-left:auto"></div>'
    + '</div>';
}

function setRoleAnalyticsRange(role, range, btn) {
  var state = _roleAnalyticsState[role] || {};
  state.range = range;
  _roleAnalyticsState[role] = state;
  var toolbar = document.getElementById('role-analytics-' + role)?.querySelector('.analytics-toolbar');
  if (toolbar) toolbar.querySelectorAll('.a-pill').forEach(function(b){ b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var customDiv = document.getElementById('ra-custom-' + role);
  if (customDiv) customDiv.style.display = range === 'custom' ? 'flex' : 'none';
  if (range !== 'custom') _loadRoleAnalyticsData(role);
}

function _roleAnalyticsWindow(role) {
  var state = _roleAnalyticsState[role] || { range: 'month' };
  var range = state.range;
  var to   = new Date();
  var from = new Date();
  if (range === 'month')   { from.setDate(1); from.setHours(0,0,0,0); }
  else if (range === 'quarter') { from.setMonth(from.getMonth()-3); from.setHours(0,0,0,0); }
  else if (range === 'year')    { from.setFullYear(from.getFullYear()-1); from.setHours(0,0,0,0); }
  else if (range === 'custom') {
    var fEl = document.getElementById('ra-from-' + role);
    var tEl = document.getElementById('ra-to-' + role);
    if (fEl?.value) from = new Date(fEl.value);
    if (tEl?.value) to   = new Date(tEl.value + 'T23:59:59');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

async function _loadRoleAnalyticsData(role) {
  var win = _roleAnalyticsWindow(role);
  var lbl = document.getElementById('ra-label-' + role);
  if (lbl) {
    var fmt = function(d){ return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); };
    lbl.textContent = fmt(win.from) + ' → ' + fmt(win.to);
  }
  function inWin(ts) { return ts && ts >= win.from && ts <= win.to; }

  var orgId = currentProfile?.org_id;
  var userId = currentUser?.id;
  if (!orgId) return;

  if (role === 'Company') {
    await _renderCompanyAnalytics(orgId, userId, win, inWin);
  } else if (role === 'Subcontractor') {
    await _renderSubcontractorAnalytics(orgId, userId, win, inWin);
  } else if (role === 'HSE') {
    await _renderHSEAnalytics(orgId, userId, win, inWin);
  } else if (role === 'Trainer') {
    await _renderTrainerAnalytics(orgId, userId, win, inWin);
  }
}

// ─────────────────────────────────────────────────────
// COMPANY (Entreprise Sous-Traitante) KPI
// Focus : gestion RH, conformité docs, sous-traitance
// ─────────────────────────────────────────────────────
async function _renderCompanyAnalytics(orgId, userId, win, inWin) {
  var role = 'Company';
  var [rWorkers, rDocs, rOrgDocs, rReports, rSigReqs, rSTs, rDuer, rVgp, rPdp] = await Promise.all([
    sb.from('profiles').select('id, full_name, role, created_at').eq('org_id', orgId),
    sb.from('documents').select('id, owner_id, status, doc_type, expires_at, category, created_at').in('owner_id',
      (await sb.from('profiles').select('id').eq('org_id', orgId)).data?.map(function(p){ return p.id; }) || [userId]),
    sb.from('documents').select('id, status, doc_type, expires_at, created_at').eq('owner_id', userId).eq('category','company'),
    sb.from('report_archive').select('id, report_type, generated_at, sig_status, signed_file_url').eq('org_id', orgId),
    sb.from('signature_requests').select('id, status, total_signers, signed_count, report_type, created_at').eq('org_id', orgId),
    sb.from('org_relationships').select('id, eu_org_id, created_at').eq('st_org_id', orgId),
    sb.from('duer_entries').select('id, created_at, updated_at').eq('org_id', orgId),
    sb.from('registre_vgp').select('id, equipement, derniere_verification').eq('org_id', orgId),
    sb.from('pdp_entries').select('id, date_debut, date_fin, created_at').eq('org_id', orgId),
  ]);

  var workers   = rWorkers.data || [];
  var docs      = rDocs.data || [];
  var orgDocs   = rOrgDocs.data || [];
  var reports   = rReports.data || [];
  var sigReqs   = rSigReqs.data || [];
  var eus       = rSTs.data || [];
  var duers     = rDuer.data || [];
  var vgps      = rVgp.data || [];
  var pdps      = rPdp.data || [];

  var workerProfiles = workers.filter(function(p){ return p.role === 'worker'; });
  var workerIds      = workerProfiles.map(function(p){ return p.id; });
  var workerDocs     = docs.filter(function(d){ return workerIds.includes(d.owner_id); });

  // KPI métier
  var nbWorkers      = workerProfiles.length;
  var newWorkers     = workerProfiles.filter(function(p){ return inWin(p.created_at); }).length;
  var docsOk         = workerDocs.filter(function(d){ return d.status === 'validated'; }).length;
  var docsPending    = workerDocs.filter(function(d){ return d.status === 'pending'; }).length;
  var docsTotal      = workerDocs.length;
  var habRate        = docsTotal > 0 ? Math.round(docsOk / docsTotal * 100) : 0;
  var soon30         = new Date(); soon30.setDate(soon30.getDate()+30);
  var expirations    = workerDocs.filter(function(d){ return d.expires_at && new Date(d.expires_at) < soon30 && new Date(d.expires_at) > new Date(); }).length;
  var orgDocsOk      = orgDocs.filter(function(d){ return d.status==='validated'; }).length;
  var orgDocsTotal   = orgDocs.length;
  var orgConformRate = orgDocsTotal > 0 ? Math.round(orgDocsOk/orgDocsTotal*100) : 0;
  var newReports     = reports.filter(function(r){ return inWin(r.generated_at); }).length;
  var pdpsActive     = pdps.filter(function(p){ var t=new Date(); return p.date_debut&&p.date_fin&&new Date(p.date_debut)<=t&&new Date(p.date_fin)>=t; }).length;
  var newEUs         = eus.filter(function(r){ return inWin(r.created_at); }).length;
  var sigsPending    = sigReqs.filter(function(s){ return s.status==='pending'; }).length;

  var kpis = [
    { icon:'👷', label:'Intervenants',       value: nbWorkers,      sub: '+'+newWorkers+' sur la période',      color:'#6366F1', trend: newWorkers },
    { icon:'✅', label:'Taux d\'habilitation', value: habRate+'%',   sub: docsOk+' docs validés / '+docsTotal,  color: habRate>=80?'#22C55E':habRate>=50?'#F59E0B':'#EF4444', trend: 0, noTrend:true },
    { icon:'⏳', label:'Docs en attente',     value: docsPending,    sub: 'À valider par vos gestionnaires',     color:'#F59E0B', trend: -docsPending },
    { icon:'⚠️', label:'Expirations <30j',   value: expirations,    sub: 'Habilitations à renouveler',          color: expirations>0?'#EF4444':'#22C55E', trend: -expirations },
    { icon:'🏭', label:'EU partenaires',      value: eus.length,     sub: '+'+newEUs+' rattachements',           color:'#A855F7', trend: newEUs },
    { icon:'📊', label:'Rapports générés',    value: reports.length, sub: '+'+newReports+' sur la période',      color:'#F97316', trend: newReports },
    { icon:'📋', label:'PdP actifs',          value: pdpsActive,     sub: pdps.length+' plans au total',         color:'#3B82F6', trend: 0, noTrend:true },
    { icon:'📄', label:'Conformité société',  value: orgConformRate+'%', sub: orgDocsOk+'/'+orgDocsTotal+' docs valides', color: orgConformRate>=80?'#22C55E':orgConformRate>=50?'#F59E0B':'#EF4444', trend:0, noTrend:true },
    { icon:'✍️', label:'Signatures en cours', value: sigsPending,    sub: sigReqs.length+' demandes totales',    color:'#06B6D4', trend: 0, noTrend:true },
  ];

  _renderRoleKpiGrid(role, kpis);
  _renderRoleActivityChart(role, [
    { label:'Docs', items: workerDocs, tsField:'created_at', color:'#6366F1' },
    { label:'Rapports', items: reports, tsField:'generated_at', color:'#F97316' },
  ], win);
  _renderRoleWorkerTable(role, workerProfiles, workerDocs);
}

// ─────────────────────────────────────────────────────
// SOUS-TRAITANT KPI
// Focus : EUs partenaires, RH intervenants, missions
// ─────────────────────────────────────────────────────
async function _renderSubcontractorAnalytics(orgId, userId, win, inWin) {
  var role = 'Subcontractor';
  var workerIdsRes = await sb.from('profiles').select('id, full_name, role, created_at').eq('org_id', orgId);
  var allProfiles  = workerIdsRes.data || [];
  var workers      = allProfiles.filter(function(p){ return p.role === 'worker'; });
  var wIds         = workers.map(function(p){ return p.id; });

  var [rDocs, rOrgDocs, rReports, rEUs, rSigReqs, rPdp, rInvites] = await Promise.all([
    wIds.length ? sb.from('documents').select('id, owner_id, status, doc_type, expires_at, category, created_at').in('owner_id', wIds) : Promise.resolve({data:[]}),
    sb.from('documents').select('id, status, doc_type, expires_at, category, created_at').eq('owner_id', userId).eq('category','company'),
    sb.from('report_archive').select('id, report_type, generated_at, sig_status').eq('org_id', orgId),
    sb.from('org_relationships').select('id, eu_org_id, created_at').eq('st_org_id', orgId),
    sb.from('signature_requests').select('id, status, total_signers, signed_count, created_at').eq('org_id', orgId),
    sb.from('pdp_entries').select('id, date_debut, date_fin, eu_nom, created_at').eq('org_id', orgId),
    sb.from('worker_invites').select('id, created_at').eq('org_id', orgId),
  ]);

  var docs       = rDocs.data || [];
  var orgDocs    = rOrgDocs.data || [];
  var reports    = rReports.data || [];
  var eus        = rEUs.data || [];
  var sigReqs    = rSigReqs.data || [];
  var pdps       = rPdp.data || [];
  var invites    = rInvites.data || [];

  var docsOk      = docs.filter(function(d){ return d.status==='validated'; }).length;
  var docsTotal   = docs.length;
  var habRate     = docsTotal > 0 ? Math.round(docsOk/docsTotal*100) : 0;
  var soon30      = new Date(); soon30.setDate(soon30.getDate()+30);
  var expiring    = docs.filter(function(d){ return d.expires_at && new Date(d.expires_at)<soon30 && new Date(d.expires_at)>new Date(); }).length;
  var newWorkers  = workers.filter(function(p){ return inWin(p.created_at); }).length;
  var newEUs      = eus.filter(function(r){ return inWin(r.created_at); }).length;
  var newReports  = reports.filter(function(r){ return inWin(r.generated_at); }).length;
  var pdpsActive  = pdps.filter(function(p){ var t=new Date(); return p.date_debut&&p.date_fin&&new Date(p.date_debut)<=t&&new Date(p.date_fin)>=t; }).length;
  var orgDocsOk   = orgDocs.filter(function(d){ return d.status==='validated'; }).length;
  var orgRate     = orgDocs.length > 0 ? Math.round(orgDocsOk/orgDocs.length*100) : 0;
  var newInvites  = invites.filter(function(i){ return inWin(i.created_at); }).length;

  var kpis = [
    { icon:'🏭', label:'EU partenaires',       value: eus.length,     sub: '+'+newEUs+' nouveaux',                color:'#A855F7', trend: newEUs },
    { icon:'👷', label:'Intervenants actifs',   value: workers.length, sub: '+'+newWorkers+' recrutés',            color:'#6366F1', trend: newWorkers },
    { icon:'✅', label:'Taux d\'habilitation',  value: habRate+'%',    sub: docsOk+'/'+docsTotal+' valides',       color: habRate>=80?'#22C55E':habRate>=50?'#F59E0B':'#EF4444', trend:0, noTrend:true },
    { icon:'⚠️', label:'Expirations <30j',     value: expiring,       sub: 'Habilitations à renouveler',          color: expiring>0?'#EF4444':'#22C55E', trend:-expiring },
    { icon:'📊', label:'Rapports générés',      value: reports.length, sub: '+'+newReports+' sur la période',      color:'#F97316', trend: newReports },
    { icon:'📋', label:'PdP en cours',          value: pdpsActive,     sub: pdps.length+' plans au total',         color:'#3B82F6', trend:0, noTrend:true },
    { icon:'📄', label:'Docs société',          value: orgRate+'%',    sub: orgDocsOk+'/'+orgDocs.length+' valides', color: orgRate>=80?'#22C55E':orgRate>=50?'#F59E0B':'#EF4444', trend:0, noTrend:true },
    { icon:'📩', label:'Invitations envoyées',  value: invites.length, sub: '+'+newInvites+' sur la période',      color:'#06B6D4', trend: newInvites },
    { icon:'✍️', label:'Demandes signature',    value: sigReqs.length, sub: sigReqs.filter(function(s){return s.status==='pending';}).length+' en attente', color:'#F59E0B', trend:0, noTrend:true },
  ];

  _renderRoleKpiGrid(role, kpis);
  _renderRoleActivityChart(role, [
    { label:'Habilitations', items: docs, tsField:'created_at', color:'#6366F1' },
    { label:'Rapports', items: reports, tsField:'generated_at', color:'#F97316' },
  ], win);
  _renderRoleWorkerTable(role, workers, docs);
}

// ─────────────────────────────────────────────────────
// HSE KPI
// Focus : maîtrise risques, pilotage ST, conformité
// ─────────────────────────────────────────────────────
async function _renderHSEAnalytics(orgId, userId, win, inWin) {
  var role = 'HSE';
  var [rSTs, rStInvites, rReports, rSigReqs, rDuer, rVgp, rFds, rPdp] = await Promise.all([
    sb.from('org_relationships').select('id, st_org_id, created_at').eq('eu_org_id', orgId),
    sb.from('st_invites').select('id, created_at').eq('eu_org_id', orgId),
    sb.from('report_archive').select('id, report_type, generated_at, sig_status').eq('org_id', orgId),
    sb.from('signature_requests').select('id, status, total_signers, signed_count, report_type, created_at').eq('org_id', orgId),
    sb.from('duer_entries').select('id, nb_unites, created_at, updated_at').eq('org_id', orgId),
    sb.from('registre_vgp').select('id, equipement, derniere_verification, created_at').eq('org_id', orgId),
    sb.from('fds_library').select('id, version_date, fds_url, created_at').eq('org_id', orgId),
    sb.from('pdp_entries').select('id, date_debut, date_fin, travaux_dangereux, created_at').eq('org_id', orgId),
  ]);

  var sts        = rSTs.data || [];
  var stInvites  = rStInvites.data || [];
  var reports    = rReports.data || [];
  var sigReqs    = rSigReqs.data || [];
  var duers      = rDuer.data || [];
  var vgps       = rVgp.data || [];
  var fdsList    = rFds.data || [];
  var pdps       = rPdp.data || [];

  var newSTs       = sts.filter(function(r){ return inWin(r.created_at); }).length;
  var newReports   = reports.filter(function(r){ return inWin(r.generated_at); }).length;
  var sigsPending  = sigReqs.filter(function(s){ return s.status==='pending'; }).length;
  var pdpsActive   = pdps.filter(function(p){ var t=new Date(); return p.date_debut&&p.date_fin&&new Date(p.date_debut)<=t&&new Date(p.date_fin)>=t; }).length;
  var pdpsDangereux = pdps.filter(function(p){ return p.travaux_dangereux && JSON.parse(typeof p.travaux_dangereux==='string'?p.travaux_dangereux:'[]').length > 0; }).length;

  // VGP : équipements en retard
  var today = new Date();
  var vgpRetard = 0;
  try {
    var VGP_PERIOS = { 'chariot_elevateur':12,'pont_roulant':12,'echafaudage':6,'nacelle':12,'extincteur':12,'installation_electrique':12,'appareil_levage':12,'compresseur':12,'machine_outil':12,'vehicule_utilitaire':12 };
    vgpRetard = vgps.filter(function(v){
      var p = VGP_PERIOS[v.equipement] || 12;
      if (!v.derniere_verification) return true;
      var next = new Date(v.derniere_verification); next.setMonth(next.getMonth()+p);
      return next < today;
    }).length;
  } catch(e){}

  // FDS : à renouveler (>3 ans)
  var lim3 = new Date(); lim3.setFullYear(lim3.getFullYear()-3);
  var fdsToRenew = fdsList.filter(function(f){ return f.version_date && new Date(f.version_date)<lim3; }).length;

  // DUER : score risques critiques
  var duerCritiques = 0;
  try {
    var duerRes = await sb.from('duer_entries').select('data').eq('org_id', orgId);
    (duerRes.data||[]).forEach(function(d){
      var entries = typeof d.data === 'string' ? JSON.parse(d.data) : (d.data||[]);
      entries.forEach(function(e){ if (e.gravite*e.probabilite >= 16) duerCritiques++; });
    });
  } catch(e){}

  var kpis = [
    { icon:'🤝', label:'ST actifs',           value: sts.length,      sub: '+'+newSTs+' rattachements',          color:'#A855F7', trend: newSTs },
    { icon:'📩', label:'Invitations ST',       value: stInvites.length,sub: 'En attente de réponse',             color:'#6366F1', trend: 0, noTrend:true },
    { icon:'📋', label:'PdP en cours',         value: pdpsActive,      sub: pdps.length+' plans — '+pdpsDangereux+' travaux dangereux', color:'#3B82F6', trend:0, noTrend:true },
    { icon:'🔴', label:'Risques critiques',    value: duerCritiques,   sub: 'DUER — Cotation ≥16',               color: duerCritiques>0?'#EF4444':'#22C55E', trend:-duerCritiques },
    { icon:'🔧', label:'VGP en retard',        value: vgpRetard,       sub: vgps.length+' équipements suivis',    color: vgpRetard>0?'#EF4444':'#22C55E', trend:-vgpRetard },
    { icon:'⚗️', label:'FDS à renouveler',    value: fdsToRenew,      sub: fdsList.length+' fiches gérées',      color: fdsToRenew>0?'#F59E0B':'#22C55E', trend:-fdsToRenew },
    { icon:'📊', label:'Rapports générés',     value: reports.length,  sub: '+'+newReports+' sur la période',     color:'#F97316', trend: newReports },
    { icon:'✍️', label:'Signatures en cours', value: sigsPending,     sub: sigReqs.length+' demandes totales',   color:'#06B6D4', trend:0, noTrend:true },
  ];

  _renderRoleKpiGrid(role, kpis);
  _renderRoleActivityChart(role, [
    { label:'Rapports', items: reports, tsField:'generated_at', color:'#F97316' },
    { label:'PdP',      items: pdps,    tsField:'created_at',   color:'#3B82F6' },
    { label:'FDS',      items: fdsList, tsField:'created_at',   color:'#A855F7' },
  ], win);

  // Tableau ST avec statut conformité
  var stIds = sts.map(function(r){ return r.st_org_id; });
  if (stIds.length > 0) {
    var stOrgsRes = await sb.from('organizations').select('id, name, type').in('id', stIds);
    var stOrgs    = stOrgsRes.data || [];
    _renderHSEStTable(role, stOrgs, sts);
  }
}

// ─────────────────────────────────────────────────────
// TRAINER (Centre de Formation) KPI
// Focus : volume formations, délais, taux succès
// ─────────────────────────────────────────────────────
async function _renderTrainerAnalytics(orgId, userId, win, inWin) {
  var role = 'Trainer';
  var [rPending, rValidated, rRejected, rAll] = await Promise.all([
    sb.from('documents').select('id, doc_type, created_at, owner_id').eq('training_center_id', orgId).eq('center_status','pending'),
    sb.from('documents').select('id, doc_type, created_at, expires_at, owner_id').eq('training_center_id', orgId).eq('center_status','validated'),
    sb.from('documents').select('id, doc_type, created_at, owner_id').eq('training_center_id', orgId).eq('center_status','rejected'),
    sb.from('documents').select('id, doc_type, created_at, expires_at, owner_id, center_status').eq('training_center_id', orgId),
  ]);

  var pending   = rPending.data   || [];
  var validated = rValidated.data || [];
  var rejected  = rRejected.data  || [];
  var allDocs   = rAll.data       || [];

  var total        = allDocs.length;
  var newInPeriod  = allDocs.filter(function(d){ return inWin(d.created_at); }).length;
  var validInPer   = validated.filter(function(d){ return inWin(d.created_at); }).length;
  var successRate  = (validated.length + rejected.length) > 0
    ? Math.round(validated.length / (validated.length + rejected.length) * 100) : 0;
  var soon30       = new Date(); soon30.setDate(soon30.getDate()+30);
  var expiringSoon = validated.filter(function(d){ return d.expires_at && new Date(d.expires_at)<soon30 && new Date(d.expires_at)>new Date(); }).length;

  // Délai moyen de traitement (créé → validé) — approche: comparaison des timestamps
  // On prend uniquement ceux de la période pour le delta moyen
  var avgDelayDays = 0;
  var delayCount   = 0;
  validated.filter(function(d){ return inWin(d.created_at); }).forEach(function(d){
    var delta = (new Date(d.expires_at || d.created_at) - new Date(d.created_at)) / 86400000;
    if (delta > 0 && delta < 365) { avgDelayDays += delta; delayCount++; }
  });
  var avgDelay = delayCount > 0 ? Math.round(avgDelayDays / delayCount) : null;

  // Stagiaires uniques
  var uniqueWorkers = new Set(allDocs.map(function(d){ return d.owner_id; })).size;

  // Répartition par type
  var byType = {};
  allDocs.forEach(function(d){ byType[d.doc_type||'autre'] = (byType[d.doc_type||'autre']||0)+1; });
  var topTypes = Object.entries(byType).sort(function(a,b){ return b[1]-a[1]; }).slice(0,5);

  var kpis = [
    { icon:'👷', label:'Stagiaires suivis',    value: uniqueWorkers,   sub: 'Apprenants uniques',                  color:'#6366F1', trend: 0, noTrend:true },
    { icon:'📋', label:'Formations totales',   value: total,           sub: '+'+newInPeriod+' sur la période',     color:'#A855F7', trend: newInPeriod },
    { icon:'⏳', label:'En attente',           value: pending.length,  sub: 'Demandes à traiter',                  color: pending.length>10?'#EF4444':pending.length>3?'#F59E0B':'#22C55E', trend:-pending.length },
    { icon:'✅', label:'Validées',             value: validated.length,sub: '+'+validInPer+' sur la période',      color:'#22C55E', trend: validInPer },
    { icon:'❌', label:'Refusées',             value: rejected.length, sub: 'Non conformes',                       color:'#EF4444', trend: -rejected.length },
    { icon:'🎯', label:'Taux de succès',       value: successRate+'%', sub: validated.length+'✓ / '+rejected.length+'✗', color: successRate>=80?'#22C55E':successRate>=60?'#F59E0B':'#EF4444', trend:0, noTrend:true },
    { icon:'⏱', label:'Délai moyen',          value: avgDelay !== null ? avgDelay+'j' : '—', sub: 'Réception → validation', color:'#06B6D4', trend:0, noTrend:true },
    { icon:'⚠️', label:'Expirations <30j',    value: expiringSoon,    sub: 'Habilitations à renouveler',          color: expiringSoon>0?'#F59E0B':'#22C55E', trend:-expiringSoon },
  ];

  _renderRoleKpiGrid(role, kpis);
  _renderRoleActivityChart(role, [
    { label:'Reçues',   items: allDocs,   tsField:'created_at', color:'#6366F1' },
    { label:'Validées', items: validated, tsField:'created_at', color:'#22C55E' },
    { label:'Refusées', items: rejected,  tsField:'created_at', color:'#EF4444' },
  ], win);
  _renderTrainerTypesTable(role, topTypes, byType, validated, rejected);
}

// ── Helpers communs ──────────────────────────────────

function _renderRoleKpiGrid(role, kpis) {
  var html = kpis.map(function(k) {
    var trendHtml;
    if (k.noTrend) {
      trendHtml = '<div class="analytics-kpi-sub">' + k.sub + '</div>';
    } else {
      var cls = k.trend > 0 ? 'up' : k.trend < 0 ? 'down' : 'neutral';
      var arr = k.trend > 0 ? '▲' : k.trend < 0 ? '▼' : '—';
      trendHtml = '<div class="analytics-kpi-trend ' + cls + '">' + arr + ' ' + k.sub + '</div>';
    }
    return '<div class="analytics-kpi-card">'
      + '<div class="analytics-kpi-header"><span class="analytics-kpi-icon">' + k.icon + '</span>'
      + '<span class="analytics-kpi-label">' + k.label + '</span></div>'
      + '<div class="analytics-kpi-value" style="color:' + k.color + '">' + (typeof k.value === 'number' ? k.value.toLocaleString('fr-FR') : k.value) + '</div>'
      + trendHtml + '</div>';
  }).join('');
  var el = document.getElementById('ra-kpis-' + role);
  if (el) el.innerHTML = html;
}

function _renderRoleActivityChart(role, series, win) {
  var chartsEl = document.getElementById('ra-charts-' + role);
  if (!chartsEl) return;

  var from   = new Date(win.from);
  var to     = new Date(win.to);
  var diffD  = Math.ceil((to - from) / 86400000);
  var byWeek = diffD > 90;
  var step   = byWeek ? 7 : 1;

  function bucketKey(ts) {
    var d = new Date(ts);
    if (byWeek) { d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); }
    return d.toISOString().slice(0,10);
  }

  // Build timeline keys
  var keys = [];
  var cur = new Date(from); cur.setHours(0,0,0,0);
  if (byWeek) cur.setDate(cur.getDate()-cur.getDay());
  while (cur <= to) { keys.push(cur.toISOString().slice(0,10)); cur.setDate(cur.getDate()+step); }
  if (!keys.length) return;

  // Build series data
  var seriesData = series.map(function(s) {
    var buckets = {};
    keys.forEach(function(k){ buckets[k] = 0; });
    (s.items || []).forEach(function(item) {
      var ts = item[s.tsField]; if (!ts || ts < win.from || ts > win.to) return;
      var k = bucketKey(ts); if (k in buckets) buckets[k]++;
    });
    return { label: s.label, color: s.color, vals: keys.map(function(k){ return buckets[k]; }) };
  });

  var maxVal = Math.max(1, Math.max.apply(null, seriesData.map(function(s){ return Math.max.apply(null, s.vals); })));
  var W = 700, H = 160, padL = 36, padB = 24, padT = 12, padR = 12;
  var plotW = W - padL - padR;
  var plotH = H - padB - padT;
  var n     = keys.length;
  var barW  = Math.max(2, Math.floor(plotW / n / series.length) - 1);

  var bars = '';
  seriesData.forEach(function(s, si) {
    s.vals.forEach(function(v, i) {
      var bh  = Math.round((v / maxVal) * plotH);
      var x   = padL + Math.round(i * plotW / n) + si * (barW + 1);
      var y   = padT + plotH - bh;
      bars += '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + (bh||1) + '" rx="2" fill="' + (v ? s.color : 'rgba(148,163,184,.1)') + '" opacity="' + (v ? '.8' : '1') + '"/>';
    });
  });

  var yLabels = [0, Math.round(maxVal/2), maxVal].map(function(v) {
    var y = padT + plotH - Math.round((v/maxVal)*plotH) + 4;
    return '<text x="' + (padL-4) + '" y="' + y + '" fill="rgba(148,163,184,.5)" font-size="9" text-anchor="end">' + v + '</text>';
  }).join('');

  var step2 = Math.max(1, Math.floor(n/6));
  var xLabels = keys.filter(function(_,i){ return i%step2===0||i===n-1; }).map(function(k, i) {
    var idx = keys.indexOf(k);
    var x   = padL + Math.round(idx * plotW / n) + barW/2;
    var lbl = new Date(k).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
    return '<text x="' + x + '" y="' + (H-4) + '" fill="rgba(148,163,184,.4)" font-size="9" text-anchor="middle">' + lbl + '</text>';
  }).join('');

  var legendHtml = seriesData.map(function(s) {
    var tot = s.vals.reduce(function(a,b){ return a+b; },0);
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;margin-right:14px">'
      + '<span style="width:10px;height:10px;border-radius:3px;background:' + s.color + ';flex-shrink:0"></span>'
      + s.label + ' <strong>' + tot + '</strong></span>';
  }).join('');

  chartsEl.innerHTML = '<div class="analytics-chart-card" style="margin-bottom:16px">'
    + '<div class="analytics-chart-title">📅 Activité ' + (byWeek ? 'hebdomadaire' : 'journalière') + '</div>'
    + '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    + '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT+plotH) + '" stroke="rgba(148,163,184,.15)"/>'
    + '<line x1="' + padL + '" y1="' + (padT+plotH) + '" x2="' + (padL+plotW) + '" y2="' + (padT+plotH) + '" stroke="rgba(148,163,184,.15)"/>'
    + yLabels + xLabels + bars
    + '</svg>'
    + '<div style="margin-top:8px">' + legendHtml + '</div>'
    + '</div>';
}

function _renderRoleWorkerTable(role, workers, docs) {
  var tablesEl = document.getElementById('ra-tables-' + role);
  if (!tablesEl || !workers.length) { if(tablesEl) tablesEl.innerHTML=''; return; }

  var docsByWorker = {};
  docs.forEach(function(d){ if(!docsByWorker[d.owner_id]) docsByWorker[d.owner_id]=[]; docsByWorker[d.owner_id].push(d); });

  var rows = workers.map(function(w) {
    var wd     = docsByWorker[w.id] || [];
    var ok     = wd.filter(function(d){ return d.status==='validated'; }).length;
    var total  = wd.length;
    var rate   = total > 0 ? Math.round(ok/total*100) : 0;
    var rateColor = rate>=80?'#4ADE80':rate>=50?'#FCD34D':'#FCA5A5';
    var soon30 = new Date(); soon30.setDate(soon30.getDate()+30);
    var exp    = wd.filter(function(d){ return d.expires_at&&new Date(d.expires_at)<soon30&&new Date(d.expires_at)>new Date(); }).length;
    var barW   = Math.min(80, rate * 0.8);
    return '<tr>'
      + '<td style="font-weight:700;font-size:13px">' + escapeHtml(w.full_name||'—') + '</td>'
      + '<td>' + total + ' <span style="font-size:10px;color:var(--muted)">(' + ok + ' ✓)</span></td>'
      + '<td><span class="a-bar" style="width:' + barW + 'px;background:' + rateColor + '"></span><span style="font-size:13px;font-weight:700;color:' + rateColor + '">' + rate + '%</span></td>'
      + '<td>' + (exp > 0 ? '<span style="color:#FCD34D;font-weight:700">⚠️ ' + exp + '</span>' : '<span style="color:var(--muted)">—</span>') + '</td>'
      + '</tr>';
  }).join('');

  tablesEl.innerHTML = '<div class="analytics-section-title" style="margin-top:24px">👷 Intervenants</div>'
    + '<div style="overflow-x:auto"><table class="analytics-table"><thead><tr>'
    + '<th>Nom</th><th>Documents</th><th>Taux habilitation</th><th>Expir. <30j</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function _renderHSEStTable(role, stOrgs, rels) {
  var tablesEl = document.getElementById('ra-tables-' + role);
  if (!tablesEl || !stOrgs.length) { if(tablesEl) tablesEl.innerHTML=''; return; }

  var relByOrg = {};
  rels.forEach(function(r){ relByOrg[r.st_org_id] = r; });

  var rows = stOrgs.map(function(org) {
    var rel  = relByOrg[org.id];
    var date = rel?.created_at ? new Date(rel.created_at).toLocaleDateString('fr-FR') : '—';
    var type = { company:'Entreprise', subcontractor:'Sous-Traitant' }[org.type] || org.type || '—';
    return '<tr>'
      + '<td style="font-weight:700;font-size:13px">' + escapeHtml(org.name||'—') + '</td>'
      + '<td style="font-size:12px;color:var(--muted)">' + type + '</td>'
      + '<td style="font-size:12px;color:var(--muted)">Rattaché le ' + date + '</td>'
      + '</tr>';
  }).join('');

  tablesEl.innerHTML = '<div class="analytics-section-title" style="margin-top:24px">🤝 Sous-Traitants partenaires</div>'
    + '<div style="overflow-x:auto"><table class="analytics-table"><thead><tr>'
    + '<th>Organisation</th><th>Type</th><th>Rattachement</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function _renderTrainerTypesTable(role, topTypes, byType, validated, rejected) {
  var tablesEl = document.getElementById('ra-tables-' + role);
  if (!tablesEl || !topTypes.length) { if(tablesEl) tablesEl.innerHTML=''; return; }

  var validByType = {};
  validated.forEach(function(d){ validByType[d.doc_type||'autre'] = (validByType[d.doc_type||'autre']||0)+1; });
  var rejByType = {};
  rejected.forEach(function(d){ rejByType[d.doc_type||'autre'] = (rejByType[d.doc_type||'autre']||0)+1; });

  var rows = topTypes.map(function(e) {
    var type  = e[0], total = e[1];
    var val   = validByType[type] || 0;
    var rej   = rejByType[type]   || 0;
    var rate  = (val+rej) > 0 ? Math.round(val/(val+rej)*100) : 0;
    var rateColor = rate>=80?'#4ADE80':rate>=60?'#FCD34D':'#FCA5A5';
    var barW  = Math.min(80, rate * 0.8);
    return '<tr>'
      + '<td style="font-weight:700;font-size:13px">' + escapeHtml(type) + '</td>'
      + '<td>' + total + '</td>'
      + '<td style="color:#4ADE80">' + val + '</td>'
      + '<td style="color:#FCA5A5">' + rej + '</td>'
      + '<td><span class="a-bar" style="width:' + barW + 'px;background:' + rateColor + '"></span><span style="font-size:13px;font-weight:700;color:' + rateColor + '">' + rate + '%</span></td>'
      + '</tr>';
  }).join('');

  tablesEl.innerHTML = '<div class="analytics-section-title" style="margin-top:24px">🎓 Formations par type</div>'
    + '<div style="overflow-x:auto"><table class="analytics-table"><thead><tr>'
    + '<th>Type de formation</th><th>Total</th><th>Validées</th><th>Refusées</th><th>Taux de succès</th>'
    + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

var _analyticsRange  = 'month';
var _analyticsFrom   = null;
var _analyticsTo     = null;
var _analyticsOrgData  = [];
var _analyticsUserData = [];
var _analyticsOrgSort  = { col: 'interactions', dir: -1 };
var _analyticsUserSort = { col: 'interactions', dir: -1 };

function setAnalyticsRange(range, btn) {
  _analyticsRange = range;
  document.querySelectorAll('.a-pill').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  var custom = document.getElementById('analyticsCustomRange');
  if (custom) custom.style.display = range === 'custom' ? 'flex' : 'none';
  if (range !== 'custom') loadAdminAnalytics();
}

function _analyticsDateWindow() {
  var to   = new Date();
  var from = new Date();
  if (_analyticsRange === 'month')   { from.setDate(1); from.setHours(0,0,0,0); }
  else if (_analyticsRange === 'quarter') { from.setMonth(from.getMonth() - 3); from.setHours(0,0,0,0); }
  else if (_analyticsRange === 'year')    { from.setFullYear(from.getFullYear() - 1); from.setHours(0,0,0,0); }
  else if (_analyticsRange === 'custom') {
    var f = document.getElementById('analyticsDateFrom');
    var t = document.getElementById('analyticsDateTo');
    if (f && f.value) from = new Date(f.value);
    if (t && t.value) to   = new Date(t.value + 'T23:59:59');
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function _analyticsRangeLabel(from, to) {
  var f = new Date(from), t = new Date(to);
  var fmt = function(d) { return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}); };
  var lbl = document.getElementById('analyticsRangeLabel');
  if (lbl) lbl.textContent = fmt(f) + ' → ' + fmt(t);
}

async function loadAdminAnalytics() {
  var win = _analyticsDateWindow();
  _analyticsRangeLabel(win.from, win.to);

  // Chargement parallèle de toutes les données
  var [
    rProfiles,
    rOrgs,
    rDocs,
    rReports,
    rDuer,
    rVgp,
    rFds,
    rPdp,
    rSigReq,
    rSigItems,
    rOrgRels,
    rWorkerInvites
  ] = await Promise.all([
    sb.from('profiles').select('id, full_name, email, role, org_id, created_at'),
    sb.from('organizations').select('id, name, type, created_at, status'),
    sb.from('documents').select('id, owner_id, status, category, created_at, expires_at, doc_type'),
    sb.from('report_archive').select('id, org_id, created_by, report_type, generated_at, source, label, sig_status'),
    sb.from('duer_entries').select('id, org_id, created_at, updated_at'),
    sb.from('registre_vgp').select('id, org_id, created_at'),
    sb.from('fds_library').select('id, org_id, created_at'),
    sb.from('pdp_entries').select('id, org_id, created_at, date_debut, date_fin'),
    sb.from('signature_requests').select('id, org_id, created_at, status, total_signers, signed_count, report_type'),
    sb.from('signature_request_items').select('id, signer_email, status, signed_at, created_at'),
    sb.from('org_relationships').select('id, eu_org_id, st_org_id, created_at'),
    sb.from('worker_invites').select('id, org_id, created_at')
  ]);

  var profiles    = rProfiles.data    || [];
  var orgs        = rOrgs.data        || [];
  var docs        = rDocs.data        || [];
  var reports     = rReports.data     || [];
  var duers       = rDuer.data        || [];
  var vgps        = rVgp.data         || [];
  var fdsList     = rFds.data         || [];
  var pdps        = rPdp.data         || [];
  var sigReqs     = rSigReq.data      || [];
  var sigItems    = rSigItems.data    || [];
  var orgRels     = rOrgRels.data     || [];
  var wInvites    = rWorkerInvites.data || [];

  // Filtre par fenêtre temporelle
  function inWin(d) { if (!d) return false; return d >= win.from && d <= win.to; }

  // Calcul des interactions : tout créé dans la fenêtre
  var allEvents = [
    ...docs.filter(function(d){ return inWin(d.created_at); }).map(function(){ return 'doc'; }),
    ...reports.filter(function(r){ return inWin(r.generated_at); }).map(function(){ return 'report'; }),
    ...duers.filter(function(d){ return inWin(d.created_at||d.updated_at); }).map(function(){ return 'duer'; }),
    ...vgps.filter(function(v){ return inWin(v.created_at); }).map(function(){ return 'vgp'; }),
    ...fdsList.filter(function(f){ return inWin(f.created_at); }).map(function(){ return 'fds'; }),
    ...pdps.filter(function(p){ return inWin(p.created_at); }).map(function(){ return 'pdp'; }),
    ...sigItems.filter(function(s){ return inWin(s.signed_at||s.created_at); }).map(function(){ return 'sig'; }),
    ...orgRels.filter(function(r){ return inWin(r.created_at); }).map(function(){ return 'rel'; }),
    ...wInvites.filter(function(i){ return inWin(i.created_at); }).map(function(){ return 'inv'; }),
  ];

  // KPI globaux
  var totalUsers      = profiles.length;
  var newUsers        = profiles.filter(function(p){ return inWin(p.created_at); }).length;
  var totalOrgs       = orgs.filter(function(o){ return o.type !== 'training_center'; }).length;
  var newOrgs         = orgs.filter(function(o){ return inWin(o.created_at) && o.type !== 'training_center'; }).length;
  var totalDocs       = docs.length;
  var newDocs         = docs.filter(function(d){ return inWin(d.created_at); }).length;
  var totalReports    = reports.length;
  var newReports      = reports.filter(function(r){ return inWin(r.generated_at); }).length;
  var totalSig        = sigItems.filter(function(s){ return s.status === 'signed'; }).length;
  var newSig          = sigItems.filter(function(s){ return s.status === 'signed' && inWin(s.signed_at); }).length;
  var totalInteract   = allEvents.length;
  var totalWorkers    = profiles.filter(function(p){ return p.role === 'worker'; }).length;
  var totalCompanies  = profiles.filter(function(p){ return p.role === 'company'; }).length;
  var totalHSE        = profiles.filter(function(p){ return p.role === 'hse'; }).length;
  var activeOrgsInWin = new Set([
    ...docs.filter(function(d){ return inWin(d.created_at); }).map(function(d){ return d.owner_id; }),
    ...reports.filter(function(r){ return inWin(r.generated_at); }).map(function(r){ return r.org_id; }),
  ]).size;

  // Volume data estimé (nb docs * ~200Ko moyen + nb reports * ~80Ko)
  var dataVolumeKo = totalDocs * 200 + totalReports * 80 + (duers.length + vgps.length + fdsList.length + pdps.length) * 5;
  var dataVolumeLabel = dataVolumeKo > 1024*10 ? Math.round(dataVolumeKo/1024) + ' Mo' : Math.round(dataVolumeKo) + ' Ko';

  // Rendu KPI globaux
  var kpiDefs = [
    { icon:'👥', label:'Utilisateurs',      value: totalUsers,      sub: '+' + newUsers + ' sur la période',    trend: newUsers, color:'#6366F1' },
    { icon:'🏢', label:'Organisations',     value: totalOrgs,       sub: '+' + newOrgs + ' nouvelles',          trend: newOrgs,  color:'#A855F7' },
    { icon:'📄', label:'Documents',         value: totalDocs,       sub: '+' + newDocs + ' déposés',            trend: newDocs,  color:'#3B82F6' },
    { icon:'📊', label:'Rapports générés',  value: totalReports,    sub: '+' + newReports + ' sur la période',  trend: newReports, color:'#F59E0B' },
    { icon:'✍️', label:'Signatures',        value: totalSig,        sub: '+' + newSig + ' validées',            trend: newSig,   color:'#22C55E' },
    { icon:'⚡', label:'Interactions',      value: totalInteract,   sub: 'Docs + rapports + saisies',           trend: totalInteract, color:'#F97316' },
    { icon:'💾', label:'Volume estimé',     value: dataVolumeLabel, sub: 'Documents + rapports archivés',       trend: 0,        color:'#06B6D4', noNum: true },
    { icon:'🟢', label:'Orgs actives',      value: activeOrgsInWin, sub: 'Au moins 1 action dans la période',  trend: activeOrgsInWin, color:'#4ADE80' },
  ];

  var kpiHtml = kpiDefs.map(function(k) {
    var trendHtml = '';
    if (!k.noNum) {
      var cls = k.trend > 0 ? 'up' : k.trend < 0 ? 'down' : 'neutral';
      var arr = k.trend > 0 ? '▲' : k.trend < 0 ? '▼' : '—';
      trendHtml = '<div class="analytics-kpi-trend ' + cls + '">' + arr + ' ' + k.sub + '</div>';
    } else {
      trendHtml = '<div class="analytics-kpi-sub">' + k.sub + '</div>';
    }
    return '<div class="analytics-kpi-card">'
      + '<div class="analytics-kpi-header"><span class="analytics-kpi-icon">' + k.icon + '</span>'
      + '<span class="analytics-kpi-label">' + k.label + '</span></div>'
      + '<div class="analytics-kpi-value" style="color:' + k.color + '">' + (k.noNum ? k.value : k.value.toLocaleString('fr-FR')) + '</div>'
      + trendHtml
      + '</div>';
  }).join('');
  var kpiEl = document.getElementById('analyticsKpiGlobal');
  if (kpiEl) kpiEl.innerHTML = kpiHtml;

  // Chart activité par jour
  _drawActivityChart(docs, reports, duers, vgps, fdsList, pdps, sigItems, win);

  // Chart répartition rôles (donut SVG)
  _drawRolesChart(profiles);

  // Préparer données par organisation
  var orgById = {};
  orgs.forEach(function(o) { orgById[o.id] = o; });
  var profilesByOrg = {};
  profiles.forEach(function(p) {
    if (!p.org_id) return;
    if (!profilesByOrg[p.org_id]) profilesByOrg[p.org_id] = [];
    profilesByOrg[p.org_id].push(p);
  });

  _analyticsOrgData = orgs.filter(function(o){ return o.type !== 'training_center'; }).map(function(org) {
    var members    = (profilesByOrg[org.id] || []);
    var orgDocs    = docs.filter(function(d){ return members.some(function(p){ return p.id === d.owner_id; }); });
    var orgReports = reports.filter(function(r){ return r.org_id === org.id; });
    var orgSigs    = sigReqs.filter(function(s){ return s.org_id === org.id; });
    var orgDuers   = duers.filter(function(d){ return d.org_id === org.id; });
    var orgVgps    = vgps.filter(function(v){ return v.org_id === org.id; });
    var orgFds     = fdsList.filter(function(f){ return f.org_id === org.id; });
    var orgPdps    = pdps.filter(function(p){ return p.org_id === org.id; });

    var interactions = [
      ...orgDocs.filter(function(d){ return inWin(d.created_at); }),
      ...orgReports.filter(function(r){ return inWin(r.generated_at); }),
      ...orgDuers.filter(function(d){ return inWin(d.created_at||d.updated_at); }),
      ...orgVgps.filter(function(v){ return inWin(v.created_at); }),
      ...orgFds.filter(function(f){ return inWin(f.created_at); }),
      ...orgPdps.filter(function(p){ return inWin(p.created_at); }),
    ].length;

    var docsOk     = orgDocs.filter(function(d){ return d.status === 'validated'; }).length;
    var docsTotal  = orgDocs.length;
    var compScore  = docsTotal > 0 ? Math.round(docsOk / docsTotal * 100) : null;
    var dataKo     = orgDocs.length * 200 + orgReports.length * 80;
    var dataLbl    = dataKo > 1024*10 ? Math.round(dataKo/1024) + ' Mo' : Math.round(dataKo) + ' Ko';

    return {
      id: org.id, name: org.name || '—', type: org.type || '',
      members: members.length, docs: orgDocs.length, reports: orgReports.length,
      sigs: orgSigs.length, interactions: interactions,
      compScore: compScore, dataLbl: dataLbl,
      createdAt: org.created_at,
      membersData: members
    };
  });

  _renderAnalyticsOrgTable();

  // Préparer données par utilisateur
  var orgNameById = {};
  orgs.forEach(function(o) { orgNameById[o.id] = o.name; });

  _analyticsUserData = profiles.map(function(p) {
    var uDocs     = docs.filter(function(d){ return d.owner_id === p.id; });
    var uReports  = reports.filter(function(r){ return r.created_by === p.id; });
    var uSigItems = sigItems.filter(function(s){ return s.signer_email && p.email && s.signer_email.toLowerCase() === p.email.toLowerCase(); });

    var interactions = [
      ...uDocs.filter(function(d){ return inWin(d.created_at); }),
      ...uReports.filter(function(r){ return inWin(r.generated_at); }),
      ...uSigItems.filter(function(s){ return inWin(s.signed_at||s.created_at); }),
    ].length;

    var lastAction = null;
    var allTs = [
      ...uDocs.map(function(d){ return d.created_at; }),
      ...uReports.map(function(r){ return r.generated_at; }),
      ...uSigItems.map(function(s){ return s.signed_at||s.created_at; }),
    ].filter(Boolean).sort();
    if (allTs.length) lastAction = allTs[allTs.length - 1];

    var docsOk  = uDocs.filter(function(d){ return d.status === 'validated'; }).length;
    var dataKo  = uDocs.length * 200 + uReports.length * 80;
    var dataLbl = dataKo > 1024 ? Math.round(dataKo/1024) + ' Mo' : dataKo + ' Ko';

    return {
      id: p.id, name: p.full_name || '—', email: p.email || '—', role: p.role || '—',
      orgId: p.org_id, orgName: orgNameById[p.org_id] || '—',
      createdAt: p.created_at,
      docs: uDocs.length, docsOk: docsOk, reports: uReports.length,
      sigs: uSigItems.filter(function(s){ return s.status==='signed'; }).length,
      interactions: interactions, dataLbl: dataLbl, lastAction: lastAction,
      docsData: uDocs, reportsData: uReports
    };
  });

  _renderAnalyticsUserTable();
}

// ── Render org table ──
function _renderAnalyticsOrgTable() {
  var search  = (document.getElementById('analyticsOrgSearch')?.value || '').toLowerCase();
  var col     = _analyticsOrgSort.col;
  var dir     = _analyticsOrgSort.dir;
  var data    = _analyticsOrgData.filter(function(o) {
    return !search || o.name.toLowerCase().includes(search) || o.type.toLowerCase().includes(search);
  }).sort(function(a, b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'string') return dir * av.localeCompare(bv||'');
    return dir * ((av||0) - (bv||0));
  });

  var typeColor = { company:'rgba(59,130,246,.2)', subcontractor:'rgba(168,85,247,.2)', hse:'rgba(34,197,94,.2)' };
  var typeLabel = { company:'EU', subcontractor:'ST', hse:'HSE' };

  function th(label, colKey) {
    var arrow = col === colKey ? (dir > 0 ? ' ▲' : ' ▼') : '';
    var cls   = col === colKey ? 'sorted' : '';
    return '<th class="' + cls + '" onclick="_sortAnalyticsOrgs(\'' + colKey + '\')">' + label + arrow + '</th>';
  }

  var html = '<table class="analytics-table"><thead><tr>'
    + th('Organisation','name') + th('Type','type') + th('Membres','members')
    + th('Documents','docs') + th('Rapports','reports') + th('Signatures','sigs')
    + th('Interactions','interactions') + th('Conformité','compScore') + th('Volume','dataLbl')
    + '<th></th></tr></thead><tbody>';

  if (!data.length) {
    html += '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted)">Aucune organisation trouvée</td></tr>';
  }

  data.forEach(function(o) {
    var tc    = typeColor[o.type] || 'rgba(148,163,184,.12)';
    var tl    = typeLabel[o.type] || o.type;
    var score = o.compScore !== null ? o.compScore + '%' : '—';
    var scoreColor = o.compScore === null ? 'var(--muted)' : o.compScore >= 80 ? '#4ADE80' : o.compScore >= 50 ? '#FCD34D' : '#FCA5A5';
    var barW  = Math.min(100, o.interactions) * 0.8;
    html += '<tr>'
      + '<td><span class="a-org-name">' + escapeHtml(o.name) + '</span></td>'
      + '<td><span class="a-type-badge" style="background:' + tc + '">' + tl + '</span></td>'
      + '<td>' + o.members + '</td>'
      + '<td>' + o.docs + '</td>'
      + '<td>' + o.reports + '</td>'
      + '<td>' + o.sigs + '</td>'
      + '<td><span class="a-bar" style="width:' + barW + 'px"></span>' + o.interactions + '</td>'
      + '<td><span class="a-score" style="color:' + scoreColor + '">' + score + '</span></td>'
      + '<td style="color:var(--muted);font-size:11px">' + o.dataLbl + '</td>'
      + '<td><button class="btn-sm" style="font-size:11px;padding:4px 10px" onclick="expandAnalyticsOrg(\'' + o.id + '\',this)">▶ Détail</button></td>'
      + '</tr>'
      + '<tr id="aorg-detail-' + o.id + '" style="display:none"><td colspan="10" style="padding:0"></td></tr>';
  });

  html += '</tbody></table>';
  var el = document.getElementById('analyticsOrgTable');
  if (el) el.innerHTML = html;
}

function _sortAnalyticsOrgs(col) {
  if (_analyticsOrgSort.col === col) _analyticsOrgSort.dir *= -1;
  else { _analyticsOrgSort.col = col; _analyticsOrgSort.dir = -1; }
  _renderAnalyticsOrgTable();
}

function filterAnalyticsOrgs() { _renderAnalyticsOrgTable(); }

function expandAnalyticsOrg(orgId, btn) {
  var row = document.getElementById('aorg-detail-' + orgId);
  if (!row) return;
  var isOpen = row.style.display !== 'none';
  // Fermer tous
  document.querySelectorAll('[id^="aorg-detail-"]').forEach(function(r){ r.style.display = 'none'; });
  document.querySelectorAll('#analyticsOrgTable .btn-sm').forEach(function(b){ b.textContent = '▶ Détail'; });
  if (isOpen) return;
  btn.textContent = '▼ Fermer';
  row.style.display = 'table-row';

  var org = _analyticsOrgData.find(function(o){ return o.id === orgId; });
  if (!org) return;
  var members = org.membersData || [];
  var roleCount = {};
  members.forEach(function(m){ roleCount[m.role] = (roleCount[m.role]||0)+1; });
  var roleHtml = Object.entries(roleCount).map(function(e){
    return '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(255,255,255,.06);margin-right:4px">' + e[0] + ' ×' + e[1] + '</span>';
  }).join('');

  var created = org.createdAt ? new Date(org.createdAt).toLocaleDateString('fr-FR') : '—';
  row.firstChild.innerHTML = '<div style="padding:16px 20px;background:rgba(249,115,22,.04);border-top:1px solid rgba(249,115,22,.15)">'
    + '<div style="display:flex;gap:24px;flex-wrap:wrap;font-size:12px">'
    + '<span>📅 Inscrite le <strong>' + created + '</strong></span>'
    + '<span>👥 ' + members.length + ' membre(s) : ' + (roleHtml || '—') + '</span>'
    + '<span>📄 ' + org.docs + ' documents déposés</span>'
    + '<span>📊 ' + org.reports + ' rapports</span>'
    + '<span>✍️ ' + org.sigs + ' demandes de signature</span>'
    + '</div>'
    + '</div>';
}

// ── Render user table ──
function _renderAnalyticsUserTable() {
  var search  = (document.getElementById('analyticsUserSearch')?.value || '').toLowerCase();
  var col     = _analyticsUserSort.col;
  var dir     = _analyticsUserSort.dir;
  var data    = _analyticsUserData.filter(function(u) {
    return !search || u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search) || u.orgName.toLowerCase().includes(search);
  }).sort(function(a, b) {
    var av = a[col], bv = b[col];
    if (typeof av === 'string') return dir * av.localeCompare(bv||'');
    return dir * ((av||0) - (bv||0));
  });

  var roleIcon = { worker:'👷', company:'🏭', hse:'🦺', subcontractor:'🔧', trainer:'🎓', admin:'⚙️', guest:'👁' };

  function th(label, colKey) {
    var arrow = col === colKey ? (dir > 0 ? ' ▲' : ' ▼') : '';
    var cls   = col === colKey ? 'sorted' : '';
    return '<th class="' + cls + '" onclick="_sortAnalyticsUsers(\'' + colKey + '\')">' + label + arrow + '</th>';
  }

  var html = '<table class="analytics-table"><thead><tr>'
    + th('Utilisateur','name') + th('Rôle','role') + th('Organisation','orgName')
    + th('Docs','docs') + th('Rapports','reports') + th('Signatures','sigs')
    + th('Interactions','interactions') + th('Données','dataLbl')
    + th('Dernière action','lastAction') + '<th></th></tr></thead><tbody>';

  if (!data.length) {
    html += '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--muted)">Aucun utilisateur trouvé</td></tr>';
  }

  data.forEach(function(u) {
    var icon  = roleIcon[u.role] || '👤';
    var last  = u.lastAction ? new Date(u.lastAction).toLocaleDateString('fr-FR') : '—';
    var barW  = Math.min(100, u.interactions) * 0.8;
    html += '<tr>'
      + '<td><div style="font-weight:700;font-size:13px">' + escapeHtml(u.name) + '</div><div style="font-size:11px;color:var(--muted)">' + escapeHtml(u.email) + '</div></td>'
      + '<td><span style="font-size:14px">' + icon + '</span> <span style="font-size:11px;color:var(--muted)">' + u.role + '</span></td>'
      + '<td style="font-size:12px">' + escapeHtml(u.orgName) + '</td>'
      + '<td>' + u.docs + ' <span style="font-size:10px;color:var(--muted)">(' + u.docsOk + ' ✓)</span></td>'
      + '<td>' + u.reports + '</td>'
      + '<td>' + u.sigs + '</td>'
      + '<td><span class="a-bar" style="width:' + barW + 'px"></span>' + u.interactions + '</td>'
      + '<td style="color:var(--muted);font-size:11px">' + u.dataLbl + '</td>'
      + '<td style="font-size:11px;color:var(--muted)">' + last + '</td>'
      + '<td><button class="btn-sm" style="font-size:11px;padding:4px 10px" onclick="expandAnalyticsUser(\'' + u.id + '\',this)">▶ Fiche</button></td>'
      + '</tr>'
      + '<tr id="auser-detail-' + u.id + '" style="display:none"><td colspan="10" style="padding:0"></td></tr>';
  });

  html += '</tbody></table>';
  var el = document.getElementById('analyticsUserTable');
  if (el) el.innerHTML = html;
}

function _sortAnalyticsUsers(col) {
  if (_analyticsUserSort.col === col) _analyticsUserSort.dir *= -1;
  else { _analyticsUserSort.col = col; _analyticsUserSort.dir = -1; }
  _renderAnalyticsUserTable();
}

function filterAnalyticsUsers() { _renderAnalyticsUserTable(); }

function expandAnalyticsUser(userId, btn) {
  var row = document.getElementById('auser-detail-' + userId);
  if (!row) return;
  var isOpen = row.style.display !== 'none';
  document.querySelectorAll('[id^="auser-detail-"]').forEach(function(r){ r.style.display = 'none'; });
  document.querySelectorAll('#analyticsUserTable .btn-sm').forEach(function(b){ b.textContent = '▶ Fiche'; });
  if (isOpen) return;
  btn.textContent = '▼ Fermer';
  row.style.display = 'table-row';

  var u = _analyticsUserData.find(function(x){ return x.id === userId; });
  if (!u) return;

  var joined   = u.createdAt ? new Date(u.createdAt).toLocaleDateString('fr-FR') : '—';
  var last     = u.lastAction ? new Date(u.lastAction).toLocaleDateString('fr-FR') : 'Aucune';
  var docsByType = {};
  (u.docsData || []).forEach(function(d){ docsByType[d.doc_type||'autre'] = (docsByType[d.doc_type||'autre']||0)+1; });
  var docTypesHtml = Object.entries(docsByType).slice(0,6).map(function(e){
    return '<div style="display:flex;justify-content:space-between;padding:6px 10px;background:rgba(255,255,255,.04);border-radius:8px;font-size:12px">'
      + '<span>' + escapeHtml(e[0]) + '</span><span style="font-weight:700">' + e[1] + '</span></div>';
  }).join('');
  var repTypesHtml = '';
  var repByType = {};
  (u.reportsData || []).forEach(function(r){ repByType[r.report_type||'autre'] = (repByType[r.report_type||'autre']||0)+1; });
  repTypesHtml = Object.entries(repByType).map(function(e){
    return '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:rgba(59,130,246,.12);color:#93C5FD;margin-right:4px">' + e[0] + ' ×' + e[1] + '</span>';
  }).join('');

  row.firstChild.innerHTML = '<div class="analytics-user-detail-panel">'
    + '<div style="font-size:14px;font-weight:900;margin-bottom:16px">' + escapeHtml(u.name) + ' <span style="font-size:12px;color:var(--muted);font-weight:400">— ' + u.role + ' · ' + escapeHtml(u.orgName) + '</span></div>'
    + '<div class="analytics-user-kpi-row">'
    + _userKpi('📄', u.docs, 'Documents') + _userKpi('✅', u.docsOk, 'Validés') + _userKpi('📊', u.reports, 'Rapports')
    + _userKpi('✍️', u.sigs, 'Signatures') + _userKpi('⚡', u.interactions, 'Interactions') + _userKpi('💾', u.dataLbl, 'Données', true)
    + '</div>'
    + '<div style="display:flex;gap:20px;flex-wrap:wrap;font-size:12px;margin-bottom:16px">'
    + '<span>📅 Inscrit le <strong>' + joined + '</strong></span>'
    + '<span>🕐 Dernière action : <strong>' + last + '</strong></span>'
    + '<span>📧 ' + escapeHtml(u.email) + '</span>'
    + '</div>'
    + (docTypesHtml ? '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Types de documents</div><div style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px">' + docTypesHtml + '</div>' : '')
    + (repTypesHtml ? '<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Rapports générés</div><div style="margin-bottom:8px">' + repTypesHtml + '</div>' : '')
    + '</div>';
}

function _userKpi(icon, val, lbl, isStr) {
  return '<div class="analytics-user-kpi">'
    + '<div class="analytics-user-kpi-val">' + icon + ' ' + (isStr ? val : (typeof val === 'number' ? val.toLocaleString('fr-FR') : val)) + '</div>'
    + '<div class="analytics-user-kpi-lbl">' + lbl + '</div>'
    + '</div>';
}

// ── Chart activité (mini sparkline SVG) ──
function _drawActivityChart(docs, reports, duers, vgps, fdsList, pdps, sigItems, win) {
  var el = document.getElementById('analyticsChartActivity');
  if (!el) return;

  var from   = new Date(win.from);
  var to     = new Date(win.to);
  var diffMs = to - from;
  var diffD  = Math.ceil(diffMs / 86400000);
  // Si > 90 jours → aggréger par semaine, sinon par jour
  var byWeek = diffD > 90;
  var buckets = {};

  function bucketKey(ts) {
    var d = new Date(ts);
    if (byWeek) {
      var day = new Date(d); day.setHours(0,0,0,0);
      var wd  = day.getDay(); day.setDate(day.getDate() - wd);
      return day.toISOString().slice(0,10);
    }
    return d.toISOString().slice(0,10);
  }

  // Pré-remplir buckets
  var cur = new Date(from); cur.setHours(0,0,0,0);
  var step = byWeek ? 7 : 1;
  while (cur <= to) {
    buckets[cur.toISOString().slice(0,10)] = 0;
    cur.setDate(cur.getDate() + step);
  }

  function addEvents(items, tsField) {
    (items || []).forEach(function(x) {
      var ts = x[tsField]; if (!ts || ts < win.from || ts > win.to) return;
      var k = bucketKey(ts); if (buckets[k] !== undefined) buckets[k]++;
    });
  }

  addEvents(docs, 'created_at');
  addEvents(reports, 'generated_at');
  addEvents(duers, 'created_at');
  addEvents(vgps, 'created_at');
  addEvents(fdsList, 'created_at');
  addEvents(pdps, 'created_at');
  addEvents(sigItems.filter(function(s){ return s.status==='signed'; }), 'signed_at');

  var keys   = Object.keys(buckets).sort();
  var vals   = keys.map(function(k){ return buckets[k]; });
  var maxVal = Math.max(1, Math.max.apply(null, vals));
  var W = el.offsetWidth || 600, H = 160, padL = 36, padB = 24, padT = 12, padR = 12;
  var plotW = W - padL - padR;
  var plotH = H - padB - padT;
  var n     = keys.length;
  var barW  = Math.max(2, Math.floor(plotW / n) - 2);

  var bars = vals.map(function(v, i) {
    var bh   = Math.round((v / maxVal) * plotH);
    var x    = padL + Math.round(i * plotW / n);
    var y    = padT + plotH - bh;
    var col  = v === 0 ? 'rgba(148,163,184,.15)' : 'rgba(249,115,22,.75)';
    return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + bh + '" rx="3" fill="' + col + '"/>';
  }).join('');

  // Axe Y
  var yLabels = [0, Math.round(maxVal/2), maxVal].map(function(v, i) {
    var y = padT + plotH - Math.round((v/maxVal)*plotH) + 4;
    return '<text x="' + (padL-6) + '" y="' + y + '" fill="rgba(148,163,184,.6)" font-size="9" text-anchor="end">' + v + '</text>';
  }).join('');

  // Axe X (quelques labels)
  var xLabels = '';
  var step2   = Math.max(1, Math.floor(n / 6));
  keys.forEach(function(k, i) {
    if (i % step2 !== 0 && i !== n-1) return;
    var x = padL + Math.round(i * plotW / n) + barW/2;
    var d = new Date(k);
    var lbl = d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
    xLabels += '<text x="' + x + '" y="' + (H-6) + '" fill="rgba(148,163,184,.5)" font-size="9" text-anchor="middle">' + lbl + '</text>';
  });

  el.innerHTML = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">'
    + '<line x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (padT+plotH) + '" stroke="rgba(148,163,184,.15)" stroke-width="1"/>'
    + '<line x1="' + padL + '" y1="' + (padT+plotH) + '" x2="' + (padL+plotW) + '" y2="' + (padT+plotH) + '" stroke="rgba(148,163,184,.15)" stroke-width="1"/>'
    + yLabels + xLabels + bars
    + '</svg>'
    + '<div style="text-align:center;font-size:10px;color:rgba(148,163,184,.5);margin-top:4px">'
    + (byWeek ? 'Agrégation par semaine' : 'Activité journalière') + ' · ' + vals.reduce(function(a,b){return a+b;},0) + ' actions total</div>';
}

// ── Donut SVG répartition rôles ──
function _drawRolesChart(profiles) {
  var el = document.getElementById('analyticsChartRoles');
  if (!el) return;
  var roleDefs = [
    { key:'worker',        label:'Workers',    color:'#6366F1' },
    { key:'company',       label:'Entreprises',color:'#F97316' },
    { key:'hse',           label:'HSE',        color:'#22C55E' },
    { key:'subcontractor', label:'ST',         color:'#A855F7' },
    { key:'trainer',       label:'Formation',  color:'#3B82F6' },
    { key:'guest',         label:'Clients',    color:'#F59E0B' },
    { key:'admin',         label:'Admins',     color:'#EF4444' },
  ];
  var counts = {};
  profiles.forEach(function(p){ counts[p.role] = (counts[p.role]||0)+1; });
  var total = profiles.length || 1;

  var cx = 80, cy = 90, r = 65, ri = 40;
  var angle = -Math.PI/2;
  var slices = '';
  var legend = '';
  roleDefs.forEach(function(d) {
    var cnt = counts[d.key] || 0;
    if (!cnt) return;
    var frac  = cnt / total;
    var sweep = frac * 2 * Math.PI;
    var x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    var x2 = cx + r * Math.cos(angle+sweep), y2 = cy + r * Math.sin(angle+sweep);
    var xi1 = cx + ri * Math.cos(angle), yi1 = cy + ri * Math.sin(angle);
    var xi2 = cx + ri * Math.cos(angle+sweep), yi2 = cy + ri * Math.sin(angle+sweep);
    var lg = sweep > Math.PI ? 1 : 0;
    slices += '<path d="M'+x1+','+y1+' A'+r+','+r+' 0 '+lg+',1 '+x2+','+y2
      +' L'+xi2+','+yi2+' A'+ri+','+ri+' 0 '+lg+',0 '+xi1+','+yi1+' Z"'
      +' fill="'+d.color+'" opacity=".85"/>';
    angle += sweep;
    var pct = Math.round(frac*100);
    legend += '<div style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px">'
      +'<span style="width:10px;height:10px;border-radius:3px;background:'+d.color+';flex-shrink:0"></span>'
      +'<span style="flex:1">'+d.label+'</span>'
      +'<span style="font-weight:700;color:var(--text)">'+cnt+'</span>'
      +'<span style="color:var(--muted)">'+pct+'%</span>'
      +'</div>';
  });

  el.innerHTML = '<div style="display:flex;align-items:center;gap:16px;height:100%">'
    + '<svg width="160" height="160" style="flex-shrink:0">'
    + slices
    + '<text x="'+cx+'" y="'+(cy+5)+'" fill="var(--text)" font-family=\'Barlow Condensed\' font-size="22" font-weight="900" text-anchor="middle">'+total+'</text>'
    + '<text x="'+cx+'" y="'+(cy+18)+'" fill="rgba(148,163,184,.6)" font-size="9" text-anchor="middle">users</text>'
    + '</svg>'
    + '<div style="flex:1;min-width:0">'+legend+'</div>'
    + '</div>';
}

async function loadAdminCompliance() {
  // Charger les accès par rôle
  const { data: accesses } = await sb.from('compliance_access').select('*');
  const container = document.getElementById('complianceAccessList');
  if (!accesses) { container.innerHTML = '<div class="empty-state">Erreur de chargement</div>'; return; }
  const roleLabels = { hse: '🔵 Responsable HSE', company: '🏢 Entreprise EU', subcontractor: '🔧 Sous-traitant', worker: '👷 Intervenant' };
  container.innerHTML = accesses.map(a => `
    <div class="compliance-role-row">
      <span style="font-size:14px;font-weight:700">${roleLabels[a.role] || a.role}</span>
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <span style="font-size:12px;color:var(--muted)">${a.enabled ? 'Activé' : 'Désactivé'}</span>
        <input type="checkbox" class="compliance-checkbox" ${a.enabled ? 'checked' : ''}
          onchange="toggleComplianceAccess('${a.role}', this.checked)">
      </label>
    </div>`).join('');
}

async function toggleComplianceAccess(role, enabled) {
  const { error } = await sb.from('compliance_access').update({ enabled }).eq('role', role);
  if (error) showToast('Erreur : ' + error.message, 'error');
  else showToast(`✓ Accès ${role} ${enabled ? 'activé' : 'désactivé'}`, 'success');
}

async function saveDefaultComponents() {
  const components = {
    st_documents:         document.getElementById('defComp_st_documents').checked,
    worker_habilitations: document.getElementById('defComp_worker_habilitations').checked,
    st_ratio:             document.getElementById('defComp_st_ratio').checked,
    pdp: false, permits: false
  };
  // Stocker dans compliance_access comme meta (on utilise un org_id fictif admin)
  const el = document.getElementById('defaultCompSaveStatus');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2000);
}

async function saveDefaultDisplayMode(mode) { /* stockage futur */ }

// ══════════════════════════════════════
// QR CODE
// ══════════════════════════════════════

// Charger QRCode.js dynamiquement
function loadQRLib() {
  return new Promise((resolve) => {
    if (window.QRCode) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = resolve;
    document.head.appendChild(s);
  });
}

async function loadWorkerBadge() {
  const container = document.getElementById('workerBadgeContainer');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏳</div><div class="empty-state-text">Génération du badge...</div></div>';

  // Récupérer qr_token du profil courant
  const { data: profile } = await sb.from('profiles').select('qr_token, full_name, org_id').eq('id', currentUser.id).single();
  if (!profile?.qr_token) { container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Badge non disponible</div></div>'; return; }

  // Récupérer config QR
  const { data: qrConf } = await sb.from('qr_config').select('*').single();
  const conf = qrConf || { show_identity: true, show_company: true, show_habilitations: true, show_profile_link: false };

  // Récupérer org si besoin
  let orgName = '';
  if (conf.show_company && profile.org_id) {
    const { data: org } = await sb.from('organizations').select('name').eq('id', profile.org_id).single();
    orgName = org?.name || '';
  }

  // Récupérer habilitations si besoin
  let habilitations = [];
  if (conf.show_habilitations) {
    const now = new Date().toISOString();
    const { data: docs } = await sb.from('documents').select('doc_type, expires_at, status')
      .eq('owner_id', currentUser.id).eq('category', 'worker').eq('status', 'validated');
    habilitations = (docs || []).filter(d => !d.expires_at || d.expires_at > now);
  }

  const publicUrl = `${window.location.origin}/?worker=${profile.qr_token}`;
  await loadQRLib();

  // Rendu du badge
  const statusColor = habilitations.length > 0 || !conf.show_habilitations ? '#22C55E' : '#F59E0B';
  const statusLabel = habilitations.length > 0 || !conf.show_habilitations ? 'Conforme' : 'Habilitations manquantes';

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:24px">
      <!-- Badge carte -->
      <div style="background:linear-gradient(135deg,#1B3A5C,#0D1B2A);border:2px solid rgba(249,115,22,.4);border-radius:20px;padding:28px 32px;width:100%;max-width:360px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.4)">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:20px">
          <div style="width:24px;height:24px;background:var(--orange);clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;font-size:11px">🛡</div>
          <span style="font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:var(--orange)">BADGE INDUSTRIEL</span>
        </div>
        ${conf.show_identity ? `<div style="font-size:22px;font-weight:900;margin-bottom:4px">${profile.full_name || '—'}</div>` : ''}
        ${conf.show_company && orgName ? `<div style="font-size:14px;color:#94A3B8;margin-bottom:16px">🏢 ${orgName}</div>` : '<div style="margin-bottom:16px"></div>'}
        <!-- QR Code -->
        <div id="qrCodeCanvas" style="display:inline-block;background:#fff;padding:10px;border-radius:10px;margin-bottom:16px"></div>
        <!-- Statut conformité -->
        <div style="display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:99px;background:${statusColor}22;border:1px solid ${statusColor}44">
          <div style="width:8px;height:8px;border-radius:50%;background:${statusColor}"></div>
          <span style="font-size:13px;font-weight:700;color:${statusColor}">${statusLabel}</span>
        </div>
        ${conf.show_habilitations && habilitations.length > 0 ? `
        <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:6px;justify-content:center">
          ${habilitations.slice(0,4).map(h => `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#86EFAC">${h.doc_type || 'Habilitation'}</span>`).join('')}
          ${habilitations.length > 4 ? `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:rgba(255,255,255,.06);color:#94A3B8">+${habilitations.length - 4}</span>` : ''}
        </div>` : ''}
      </div>
      <!-- Actions -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
        <button class="btn-sm btn-upload" onclick="printWorkerBadge()">🖨 Imprimer</button>
        <button class="btn-sm" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--muted)" onclick="copyBadgeLink('${publicUrl}')">🔗 Copier le lien</button>
      </div>
      <div style="font-size:11px;color:var(--muted);text-align:center">Ce QR code pointe vers une page publique de vérification</div>
    </div>`;

  // Générer le QR
  new QRCode(document.getElementById('qrCodeCanvas'), {
    text: publicUrl, width: 140, height: 140,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });
}

function copyBadgeLink(url) {
  navigator.clipboard.writeText(url).then(() => showToast('✓ Lien copié', 'success'));
}

// ── SCAN QR CAMÉRA ──
let _qrScanContext = null; // 'worker' | 'st'
let _qrScanStream  = null;
let _qrScanTimer   = null;

async function openQrScanModal(context) {
  _qrScanContext = context;
  document.getElementById('qrScanModal').classList.add('open');
  document.getElementById('qrScanStatus').textContent = 'Initialisation de la caméra...';
  document.getElementById('qrManualUrl').value = '';
  await startQrCamera();
}

function closeQrScanModal() {
  stopQrCamera();
  document.getElementById('qrScanModal').classList.remove('open');
  _qrScanContext = null;
}

async function startQrCamera() {
  try {
    _qrScanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.getElementById('qrScanVideo');
    video.srcObject = _qrScanStream;
    await video.play();
    document.getElementById('qrScanStatus').textContent = 'Caméra active — pointez vers le QR code';
    scheduleQrScan();
  } catch(e) {
    document.getElementById('qrScanStatus').textContent = '⚠️ Caméra indisponible — utilisez le champ manuel ci-dessous';
  }
}

function stopQrCamera() {
  if (_qrScanTimer) { clearInterval(_qrScanTimer); _qrScanTimer = null; }
  if (_qrScanStream) { _qrScanStream.getTracks().forEach(t => t.stop()); _qrScanStream = null; }
}

function scheduleQrScan() {
  _qrScanTimer = setInterval(async () => {
    const video  = document.getElementById('qrScanVideo');
    const canvas = document.getElementById('qrScanCanvas');
    if (!video || video.readyState < 2) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    // Essayer BarcodeDetector natif (Chrome mobile)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const codes = await detector.detect(canvas);
        if (codes.length > 0) { processQrUrl(codes[0].rawValue); return; }
      } catch(e) {}
    }

    // Fallback jsQR
    try {
      if (!window.jsQR) await loadJsQR();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) processQrUrl(code.data);
    } catch(e) {}
  }, 400);
}

async function loadJsQR() {
  return new Promise((res, rej) => {
    if (window.jsQR) return res();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function processQrUrl(url) {
  if (!url) return;
  stopQrCamera();
  // Extraire le token org de l'URL
  let orgToken = null;
  try {
    const u = new URL(url);
    orgToken = u.searchParams.get('org');
  } catch(e) {
    // Peut-être c'est directement le token
    orgToken = url.trim();
  }
  if (!orgToken) {
    document.getElementById('qrScanStatus').textContent = '❌ QR code non reconnu — essayez le champ manuel';
    await startQrCamera();
    return;
  }

  document.getElementById('qrScanStatus').textContent = '🔍 Identification de l\'organisation...';

  const { data: org } = await sb.from('organizations')
    .select('id, name, type, team_code')
    .eq('org_qr_token', orgToken).single();

  if (!org) {
    document.getElementById('qrScanStatus').textContent = '❌ Organisation introuvable';
    await startQrCamera();
    return;
  }

  // Rattachement selon contexte
  if (_qrScanContext === 'worker') {
    // Worker → Employeur
    closeQrScanModal();
    const { error } = await sb.from('profiles').update({ org_id: org.id }).eq('id', currentUser.id);
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    currentProfile.org_id = org.id;
    showToast('✓ Rattaché à ' + org.name, 'success');
    document.getElementById('linkCompanyBanner').style.display   = 'none';
    document.getElementById('linkedCompanyBanner').style.display = 'flex';
    document.getElementById('linkedCompanyName').textContent     = org.name;

  } else if (_qrScanContext === 'st') {
    // ST → EU
    if (org.type !== 'company') {
      document.getElementById('qrScanStatus').textContent = '❌ Ce QR code ne correspond pas à une Entreprise Utilisatrice';
      await startQrCamera(); return;
    }
    if (org.id === currentProfile.org_id) {
      document.getElementById('qrScanStatus').textContent = '❌ Vous ne pouvez pas vous rattacher à votre propre organisation';
      await startQrCamera(); return;
    }
    closeQrScanModal();
    const { error } = await sb.from('org_relationships').insert({ eu_org_id: org.id, st_org_id: currentProfile.org_id });
    if (error) {
      if (error.code === '23505') { showToast('Déjà rattaché à ' + org.name, 'error'); return; }
      showToast('Erreur : ' + error.message, 'error'); return;
    }
    showToast('✓ Rattaché à ' + org.name, 'success');
    loadSTEU(); loadSTStats();
  }
}


// ══════════════════════════════════════
// DASHBOARD PERSONNALISABLE
// ══════════════════════════════════════

// ── Définition des widgets par rôle ──
// Chaque widget liste les IDs DOM à regrouper dedans
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
  document.getElementById('missionModalTitle').textContent    = 'Nouvelle mission';
  document.getElementById('missionModalSubtitle').textContent = `Pour ${euName}`;
  document.getElementById('missionModalId').value    = '';
  document.getElementById('missionModalEuId').value  = euOrgId;
  document.getElementById('missionTitle').value      = '';
  document.getElementById('missionDesc').value       = '';
  document.getElementById('missionStartDate').value  = '';
  document.getElementById('missionEndDate').value    = '';
  document.getElementById('missionModal').classList.add('open');
}

function openEditMissionModal(id, title, desc, startDate, endDate) {
  document.getElementById('missionModalTitle').textContent    = 'Modifier la mission';
  document.getElementById('missionModalSubtitle').textContent = 'Modifiez les informations';
  document.getElementById('missionModalId').value    = id;
  document.getElementById('missionModalEuId').value  = '';
  document.getElementById('missionTitle').value      = title;
  document.getElementById('missionDesc').value       = desc || '';
  document.getElementById('missionStartDate').value  = startDate || '';
  document.getElementById('missionEndDate').value    = endDate || '';
  document.getElementById('missionModal').classList.add('open');
}

// Création mission côté EU/HSE
function openCreateMissionAsEU(stOrgId, stName, euOrgId, containerId) {
  document.getElementById('missionModalTitle').textContent    = 'Nouvelle mission';
  document.getElementById('missionModalSubtitle').textContent = `Avec ${stName}`;
  document.getElementById('missionModalId').value    = '';
  // Format spécial : euOrgId|stOrgId|containerId|eu
  document.getElementById('missionModalEuId').value  = `${euOrgId}|${stOrgId}|${containerId}|eu`;
  document.getElementById('missionTitle').value      = '';
  document.getElementById('missionDesc').value       = '';
  document.getElementById('missionStartDate').value  = '';
  document.getElementById('missionEndDate').value    = '';
  document.getElementById('missionModal').classList.add('open');
}

function closeMissionModal() {
  document.getElementById('missionModal').classList.remove('open');
}

async function saveMission() {
  const id        = document.getElementById('missionModalId').value;
  const euIdRaw   = document.getElementById('missionModalEuId').value;
  const title     = document.getElementById('missionTitle').value.trim();
  const desc      = document.getElementById('missionDesc').value.trim();
  const startDate = document.getElementById('missionStartDate').value || null;
  const endDate   = document.getElementById('missionEndDate').value || null;

  if (!title) { showToast('Le titre est obligatoire', 'error'); return; }

  if (id) {
    // Édition
    const { error } = await sb.from('missions').update({ title, description: desc, start_date: startDate, end_date: endDate }).eq('id', id);
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast('✓ Mission mise à jour', 'success');
    closeMissionModal();
    // Recharger selon le rôle
    if (currentProfile.role === 'subcontractor') loadSTEU();
    else loadST(currentProfile.org_id, currentProfile.role === 'hse' ? 'hseSTContainer' : 'companySTContainer');
    return;
  }

  // Création — détecter si côté EU ou ST
  const isEU = euIdRaw && euIdRaw.includes('|eu');
  if (isEU) {
    const [euOrgId, stOrgId, containerId] = euIdRaw.split('|');
    const { error } = await sb.from('missions').insert({
      st_org_id: stOrgId, eu_org_id: euOrgId,
      title, description: desc,
      start_date: startDate, end_date: endDate,
      status: 'approved', // créée par l'EU → directement approuvée
      created_by: currentUser.id
    });
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast('✓ Mission créée et validée', 'success');
    closeMissionModal();
    loadST(euOrgId, containerId);
  } else {
    // Côté ST
    const euOrgId = euIdRaw;
    if (!euOrgId || !currentProfile.org_id) { showToast('Données manquantes', 'error'); return; }
    const { error } = await sb.from('missions').insert({
      st_org_id: currentProfile.org_id, eu_org_id: euOrgId,
      title, description: desc,
      start_date: startDate, end_date: endDate,
      status: 'draft',
      created_by: currentUser.id
    });
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast('✓ Mission créée', 'success');
    closeMissionModal();
    loadSTEU();
  }
}

async function submitMission(missionId) {
  if (!confirm('Soumettre cette mission à validation de l\'EU ?')) return;
  const { error } = await sb.from('missions').update({ status: 'pending' }).eq('id', missionId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Mission soumise — en attente de validation', 'success');
  loadSTEU();
}

async function deleteMission(missionId) {
  if (!confirm('Supprimer définitivement cette mission ?')) return;
  const [r1, r2, r3] = await Promise.all([
    sb.from('mission_workers').delete().eq('mission_id', missionId),
    sb.from('mission_doc_shares').delete().eq('mission_id', missionId),
    sb.from('missions').delete().eq('id', missionId)
  ]);
  const err = r1.error || r2.error || r3.error;
  if (err) { showToast('Erreur suppression : ' + err.message, 'error'); return; }
  showToast('✓ Mission supprimée', 'success');
  loadSTEU();
}

// ── Validation EU/HSE ──
async function approveMission(missionId, containerId) {
  const { error } = await sb.from('missions').update({ status: 'approved' }).eq('id', missionId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Mission validée', 'success');
  loadST(currentProfile.org_id, containerId);
}

async function rejectMission(missionId, containerId) {
  const reason = prompt('Motif du refus (optionnel) :');
  if (reason === null) return;
  const { error } = await sb.from('missions').update({ status: 'rejected' }).eq('id', missionId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Mission refusée', 'success');
  loadST(currentProfile.org_id, containerId);
}

// ── Gestion intervenants mission (côté ST) ──
let _mwMissionId = null;

async function openMissionWorkersModal(missionId, missionTitle) {
  _mwMissionId = missionId;
  document.getElementById('missionWorkersModalId').value       = missionId;
  document.getElementById('missionWorkersModalSubtitle').textContent = missionTitle;
  switchMWTab('team');

  // Charger workers de l'équipe ST dans le select
  const { data: workers } = await sb.from('profiles').select('id, full_name, email').eq('org_id', currentProfile.org_id).eq('role','worker');
  const sel = document.getElementById('mwWorkerSelect');
  sel.innerHTML = '<option value="">— Sélectionner un intervenant —</option>' +
    (workers || []).map(w => `<option value="${w.id}">${escapeHtml(w.full_name)} (${escapeHtml(w.email)})</option>`).join('');

  document.getElementById('missionWorkersModal').classList.add('open');
  await refreshMissionWorkersList(missionId);
}

function switchMWTab(tab) {
  const isTeam = tab === 'team';
  document.getElementById('mwPanelTeam').style.display = isTeam ? '' : 'none';
  document.getElementById('mwPanelExt').style.display  = isTeam ? 'none' : '';
  document.getElementById('mwTabTeam').style.background = isTeam ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)';
  document.getElementById('mwTabTeam').style.color      = isTeam ? '#A5B4FC' : 'var(--muted)';
  document.getElementById('mwTabExt').style.background  = !isTeam ? 'rgba(99,102,241,.2)' : 'rgba(255,255,255,.06)';
  document.getElementById('mwTabExt').style.color       = !isTeam ? '#A5B4FC' : 'var(--muted)';
}

async function refreshMissionWorkersList(missionId) {
  const { data: mw } = await sb.from('mission_workers').select('id, worker_id, name_external, email_external').eq('mission_id', missionId);
  const workerIds = (mw || []).filter(w => w.worker_id).map(w => w.worker_id);
  let profileMap = {};
  if (workerIds.length) {
    const { data: profiles } = await sb.from('profiles').select('id, full_name, email').in('id', workerIds);
    (profiles || []).forEach(p => profileMap[p.id] = p);
  }
  const list = document.getElementById('missionWorkersList');
  if (!mw || !mw.length) { list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0">Aucun intervenant ajouté</div>'; return; }
  list.innerHTML = '<div class="section-title" style="margin-bottom:10px">Intervenants ('+mw.length+')</div>' +
    mw.map(w => {
      const name  = w.worker_id ? (profileMap[w.worker_id]?.full_name || '—') : (w.name_external || 'Externe');
      const email = w.worker_id ? (profileMap[w.worker_id]?.email || '') : (w.email_external || '');
      const tag   = w.worker_id ? '<span style="font-size:10px;color:#86EFAC;font-weight:700">✓ Équipe</span>' : '<span style="font-size:10px;color:#A5B4FC;font-weight:700">Externe</span>';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;margin-bottom:6px">
        <div style="font-size:20px">👷</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700">${name}</div>${email ? `<div style="font-size:11px;color:var(--muted)">${email}</div>` : ''}</div>
        ${tag}
        <button onclick="removeMissionWorker('${w.id}')" class="btn-sm btn-reject" style="font-size:11px;padding:4px 8px">✕</button>
      </div>`;
    }).join('');
}

async function addMissionWorkerFromTeam() {
  const workerId = document.getElementById('mwWorkerSelect').value;
  if (!workerId) { showToast('Sélectionnez un intervenant', 'error'); return; }
  const { error } = await sb.from('mission_workers').insert({ mission_id: _mwMissionId, worker_id: workerId });
  if (error) { if (error.code === '23505') { showToast('Déjà ajouté', 'error'); } else { showToast('Erreur : ' + error.message, 'error'); } return; }
  showToast('✓ Intervenant ajouté', 'success');
  await refreshMissionWorkersList(_mwMissionId);
}

async function addMissionWorkerExternal() {
  const name  = document.getElementById('mwExtName').value.trim();
  const email = document.getElementById('mwExtEmail').value.trim();
  if (!name) { showToast('Le nom est obligatoire', 'error'); return; }
  const { error } = await sb.from('mission_workers').insert({ mission_id: _mwMissionId, name_external: name, email_external: email || null });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  document.getElementById('mwExtName').value  = '';
  document.getElementById('mwExtEmail').value = '';
  showToast('✓ Externe ajouté', 'success');
  await refreshMissionWorkersList(_mwMissionId);
}

async function removeMissionWorker(mwId) {
  const { error } = await sb.from('mission_workers').delete().eq('id', mwId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Retiré de la mission', 'success');
  await refreshMissionWorkersList(_mwMissionId);
}

// ── Gestion docs partagés mission (côté ST) ──
async function openMissionDocsModal(missionId, missionTitle) {
  document.getElementById('missionDocsModalId').value              = missionId;
  document.getElementById('missionDocsModalSubtitle').textContent  = missionTitle;
  document.getElementById('missionDocsModal').classList.add('open');
  await refreshMissionDocsList(missionId);
}

async function refreshMissionDocsList(missionId) {
  const list = document.getElementById('missionDocsList');
  list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px">Chargement...</div>';

  // Docs validés du ST (company category)
  const { data: myDocs } = await sb.from('documents').select('id, doc_type, status, expires_at')
    .eq('owner_id', currentUser.id).eq('category','company').eq('status','validated');

  // Docs déjà partagés sur cette mission
  const { data: shared } = await sb.from('mission_doc_shares').select('id, doc_id').eq('mission_id', missionId);
  const sharedDocIds = new Set((shared || []).map(s => s.doc_id));
  const sharedMap    = {};
  (shared || []).forEach(s => sharedMap[s.doc_id] = s.id);

  if (!myDocs || !myDocs.length) {
    list.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:16px 0">Aucun document validé disponible</div>';
    return;
  }

  list.innerHTML = myDocs.map(doc => {
    const isShared = sharedDocIds.has(doc.id);
    const exp = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : null;
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--inset-bg);border:1px solid ${isShared ? 'rgba(34,197,94,.3)' : 'rgba(255,255,255,.08)'};border-radius:10px;margin-bottom:8px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${doc.doc_type}</div>
        ${exp ? `<div style="font-size:11px;color:var(--muted)">Expire le ${exp}</div>` : ''}
      </div>
      ${isShared
        ? `<span style="font-size:11px;color:#86EFAC;font-weight:700">✓ Partagé</span>
           <button onclick="unshareDoc('${sharedMap[doc.id]}','${missionId}')" class="btn-sm btn-reject" style="font-size:11px">Retirer</button>`
        : `<button onclick="shareDoc('${doc.id}','${missionId}')" class="btn-sm btn-upload" style="font-size:11px">Partager</button>`
      }
    </div>`;
  }).join('');
}

async function shareDoc(docId, missionId) {
  const { error } = await sb.from('mission_doc_shares').insert({ mission_id: missionId, doc_id: docId, shared_by: currentUser.id });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Document partagé', 'success');
  await refreshMissionDocsList(missionId);
}

async function unshareDoc(shareId, missionId) {
  const { error } = await sb.from('mission_doc_shares').delete().eq('id', shareId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Partage retiré', 'success');
  await refreshMissionDocsList(missionId);
}

// ── Vue intervenants mission (côté EU/HSE) ──
async function viewMissionWorkers(missionId, missionTitle) {
  const { data: mw } = await sb.from('mission_workers').select('id, worker_id, name_external, email_external').eq('mission_id', missionId);
  const workerIds = (mw || []).filter(w => w.worker_id).map(w => w.worker_id);
  let profileMap = {}, habsMap = {};

  if (workerIds.length) {
    const [{ data: profiles }, { data: habs }] = await Promise.all([
      sb.from('profiles').select('id, full_name, email').in('id', workerIds),
      sb.from('documents').select('owner_id, doc_type, expires_at, status').in('owner_id', workerIds).eq('category','worker').eq('status','validated')
    ]);
    (profiles || []).forEach(p => profileMap[p.id] = p);
    (habs || []).forEach(h => {
      if (!habsMap[h.owner_id]) habsMap[h.owner_id] = [];
      habsMap[h.owner_id].push(h);
    });
  }

  const now = new Date().toISOString();
  const content = (!mw || !mw.length)
    ? '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">Aucun intervenant déclaré</div>'
    : mw.map(w => {
        const profile = w.worker_id ? profileMap[w.worker_id] : null;
        const name    = profile ? profile.full_name : (w.name_external || 'Externe');
        const email   = profile ? profile.email     : (w.email_external || '');
        const habs    = w.worker_id ? (habsMap[w.worker_id] || []).filter(h => !h.expires_at || h.expires_at > now) : [];
        const tag     = w.worker_id ? '<span style="font-size:10px;color:#86EFAC;font-weight:700">✓ SafetySphere</span>' : '<span style="font-size:10px;color:#A5B4FC;font-weight:700">Externe</span>';
        return `<div style="padding:14px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:${habs.length ? 10 : 0}px">
            <div style="font-size:22px">👷</div>
            <div style="flex:1"><div style="font-size:14px;font-weight:700">${name}</div>${email ? `<div style="font-size:11px;color:var(--muted)">${email}</div>` : ''}</div>
            ${tag}
          </div>
          ${habs.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${habs.map(h => `<span style="font-size:11px;padding:3px 10px;border-radius:99px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:#86EFAC">${h.doc_type}</span>`).join('')}</div>` : (w.worker_id ? '<div style="font-size:11px;color:#F59E0B">⚠️ Aucune habilitation validée</div>' : '')}
        </div>`;
      }).join('');

  // Modale dédiée lecture seule EU/HSE
  const existing = document.getElementById('viewMissionWorkersModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'viewMissionWorkersModal';
  modal.innerHTML = `<div class="modal" style="max-width:540px">
    <button class="modal-close" onclick="document.getElementById('viewMissionWorkersModal').remove()">✕</button>
    <div class="modal-title">👷 Intervenants — ${escapeHtml(missionTitle)}</div>
    <div style="margin-top:16px">${content}</div>
  </div>`;
  document.body.appendChild(modal);
}

// ── Vue docs partagés mission (côté EU/HSE) ──
async function viewMissionDocs(missionId, missionTitle, stOrgId) {
  const { data: shares } = await sb.from('mission_doc_shares').select('doc_id').eq('mission_id', missionId);
  const docIds = (shares || []).map(s => s.doc_id);

  let content = '';
  if (!docIds.length) {
    content = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:20px 0">Aucun document partagé pour cette mission</div>';
  } else {
    const { data: docs } = await sb.from('documents').select('id, doc_type, expires_at, file_url').in('id', docIds);
    content = (docs || []).map(doc => {
      const exp = doc.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : null;
      return `<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--inset-bg);border:1px solid rgba(34,197,94,.25);border-radius:10px;margin-bottom:8px">
        <div style="font-size:20px">📄</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:700">${escapeHtml(doc.doc_type)}</div>${exp ? `<div style="font-size:11px;color:var(--muted)">Expire le ${escapeHtml(exp)}</div>` : ''}</div>
        ${doc.file_url ? `<button onclick="window.open('${escapeHtml(doc.file_url)}','_blank')" class="btn-sm btn-view" style="font-size:11px">👁 Voir</button>` : ''}
      </div>`;
    }).join('');
  }

  const existing = document.getElementById('viewMissionDocsModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-overlay open';
  modal.id = 'viewMissionDocsModal';
  modal.innerHTML = `<div class="modal" style="max-width:520px">
    <button class="modal-close" onclick="document.getElementById('viewMissionDocsModal').remove()">✕</button>
    <div class="modal-title">📄 Documents — ${escapeHtml(missionTitle)}</div>
    <div style="margin-top:16px">${content}</div>
  </div>`;
  document.body.appendChild(modal);
}


function copyOrgQrLink(token) {
  const url = `${window.location.origin}/?org=${token}`;
  navigator.clipboard.writeText(url).then(() => showToast('✓ Lien QR copié', 'success'));
}

function downloadOrgQr(canvasId, orgName) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  const canvas = el.querySelector('canvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `qr-${(orgName||'entreprise').toLowerCase().replace(/\s+/g,'-')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function printWorkerBadge() {
  window.print();
}

// ── PAGE PUBLIQUE ──
async function loadPublicWorkerPage(token) {
  document.getElementById('authScreen').style.display    = 'none';
  document.getElementById('publicScanPage').style.display = 'block';
  const content = document.getElementById('publicScanContent');

  // Charger le profil via token
  const { data: profile } = await sb.from('profiles').select('full_name, org_id, role').eq('qr_token', token).single();
  if (!profile || profile.role !== 'worker') {
    content.innerHTML = '<div style="text-align:center;padding:40px 0"><div style="font-size:48px">❌</div><div style="margin-top:12px;color:#EF4444;font-weight:700">Badge invalide</div><div style="color:#94A3B8;font-size:13px;margin-top:8px">Ce QR code n\'est pas reconnu</div></div>';
    return;
  }

  const { data: qrConf } = await sb.from('qr_config').select('*').single();
  const conf = qrConf || { show_identity: true, show_company: true, show_habilitations: true };

  let orgName = '';
  if (conf.show_company && profile.org_id) {
    const { data: org } = await sb.from('organizations').select('name').eq('id', profile.org_id).single();
    orgName = org?.name || '';
  }

  let habsHtml = '';
  if (conf.show_habilitations) {
    const now = new Date().toISOString();
    // Récupérer l'id du worker via token
    const { data: wp } = await sb.from('profiles').select('id').eq('qr_token', token).single();
    if (wp) {
      const { data: docs } = await sb.from('documents').select('doc_type, expires_at, status')
        .eq('owner_id', wp.id).eq('category', 'worker').eq('status', 'validated');
      const valid = (docs || []).filter(d => !d.expires_at || d.expires_at > now);
      if (valid.length > 0) {
        habsHtml = `
          <div style="margin-top:20px">
            <div style="font-size:12px;font-weight:700;color:#94A3B8;letter-spacing:.5px;margin-bottom:10px">HABILITATIONS VALIDES</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
              ${valid.map(h => `<span style="font-size:12px;padding:5px 12px;border-radius:99px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:#86EFAC;font-weight:600">${h.doc_type || 'Habilitation'}</span>`).join('')}
            </div>
          </div>`;
      } else {
        habsHtml = `<div style="margin-top:20px;padding:12px;border-radius:10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);color:#FCD34D;font-size:13px">⚠️ Aucune habilitation validée</div>`;
      }
    }
  }

  content.innerHTML = `
    <div style="background:linear-gradient(135deg,#1B3A5C,#0D1B2A);border:2px solid rgba(249,115,22,.3);border-radius:20px;padding:28px 24px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:40px;margin-bottom:8px">👷</div>
        ${conf.show_identity ? `<div style="font-size:24px;font-weight:900">${profile.full_name || '—'}</div>` : ''}
        ${conf.show_company && orgName ? `<div style="font-size:14px;color:#94A3B8;margin-top:4px">🏢 ${orgName}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:99px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3)">
        <div style="width:8px;height:8px;border-radius:50%;background:#22C55E"></div>
        <span style="font-size:14px;font-weight:700;color:#22C55E">Intervenant enregistré SafetySphere</span>
      </div>
      ${habsHtml}
      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--inset-sep);text-align:center">
        <div style="font-size:11px;color:#64748B">Vérifié le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`;
}

// ── PAGE PUBLIQUE ENTREPRISE ──
async function loadPublicOrgPage(token) {
  document.getElementById('authScreen').style.display    = 'none';
  document.getElementById('publicScanPage').style.display = 'block';
  const content = document.getElementById('publicScanContent');

  const { data: org } = await sb.from('organizations')
    .select('id, name, type, siret, address, legal_form')
    .eq('org_qr_token', token).single();

  if (!org) {
    content.innerHTML = '<div style="text-align:center;padding:40px 0"><div style="font-size:48px">❌</div><div style="margin-top:12px;color:#EF4444;font-weight:700">QR Code invalide</div><div style="color:#94A3B8;font-size:13px;margin-top:8px">Cette organisation n\'est pas reconnue</div></div>';
    return;
  }

  const typeLabel = { company:'Entreprise Utilisatrice', subcontractor:'Sous-Traitant', hse:'Responsable HSE', training_center:'Centre de Formation' }[org.type] || org.type;
  const typeIcon  = { company:'🏭', subcontractor:'🔧', hse:'🦺', training_center:'🎓' }[org.type] || '🏢';

  const siretFormatted = org.siret ? org.siret.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4') : null;

  content.innerHTML = `
    <div style="background:linear-gradient(135deg,#1B3A5C,#0D1B2A);border:2px solid rgba(99,102,241,.35);border-radius:20px;padding:28px 24px">
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:44px;margin-bottom:10px">${typeIcon}</div>
        <div style="font-size:22px;font-weight:900">${escapeHtml(org.name)}</div>
        <div style="margin-top:6px">
          <span style="font-size:12px;padding:4px 12px;border-radius:99px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.35);color:#A5B4FC;font-weight:700">${escapeHtml(typeLabel)}</span>
        </div>
      </div>

      ${siretFormatted ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:var(--inset-bg);margin-bottom:10px">
        <span style="font-size:18px">🔢</span>
        <div>
          <div style="font-size:10px;color:#64748B;font-weight:700;letter-spacing:.5px">SIRET</div>
          <div style="font-size:14px;font-weight:700;letter-spacing:2px">${escapeHtml(siretFormatted)}</div>
        </div>
      </div>` : ''}

      ${org.legal_form ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:var(--inset-bg);margin-bottom:10px">
        <span style="font-size:18px">⚖️</span>
        <div>
          <div style="font-size:10px;color:#64748B;font-weight:700;letter-spacing:.5px">FORME JURIDIQUE</div>
          <div style="font-size:14px;font-weight:700">${escapeHtml(org.legal_form)}</div>
        </div>
      </div>` : ''}

      ${org.address ? `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;background:var(--inset-bg);margin-bottom:10px">
        <span style="font-size:18px">📍</span>
        <div>
          <div style="font-size:10px;color:#64748B;font-weight:700;letter-spacing:.5px">SIÈGE SOCIAL</div>
          <div style="font-size:14px;font-weight:700">${escapeHtml(org.address)}</div>
        </div>
      </div>` : ''}

      <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:99px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);margin-top:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:#22C55E"></div>
        <span style="font-size:13px;font-weight:700;color:#22C55E">Organisation vérifiée SafetySphere</span>
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--inset-sep);text-align:center">
        <div style="font-size:11px;color:#64748B">Vérifié le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
      </div>
    </div>`;
}

// ── ADMIN QR CONFIG ──
async function loadAdminQRConfig() {
  const container = document.getElementById('qrConfigList');
  if (!container) return;
  const { data: conf } = await sb.from('qr_config').select('*').single();
  const c = conf || { show_identity: true, show_company: true, show_habilitations: true, show_profile_link: false };

  const options = [
    { key: 'show_identity',      label: '👤 Identité',           desc: 'Nom et prénom du travailleur' },
    { key: 'show_company',       label: '🏢 Entreprise ST',       desc: 'Nom de la société sous-traitante' },
    { key: 'show_habilitations', label: '🎓 Habilitations',       desc: 'Liste des habilitations valides' },
    { key: 'show_profile_link',  label: '🔗 Lien fiche complète', desc: 'Bouton vers la fiche connectée SafetySphere' },
  ];

  container.innerHTML = options.map(o => `
    <label class="compliance-toggle-row">
      <div class="compliance-toggle-info">
        <div class="compliance-toggle-label">${o.label}</div>
        <div class="compliance-toggle-desc">${o.desc}</div>
      </div>
      <input type="checkbox" id="qrOpt_${o.key}" class="compliance-checkbox" ${c[o.key] ? 'checked' : ''}>
    </label>`).join('');
}

async function saveQRConfig() {
  const data = {
    show_identity:       document.getElementById('qrOpt_show_identity').checked,
    show_company:        document.getElementById('qrOpt_show_company').checked,
    show_habilitations:  document.getElementById('qrOpt_show_habilitations').checked,
    show_profile_link:   document.getElementById('qrOpt_show_profile_link').checked,
    updated_at:          new Date().toISOString()
  };
  // Upsert (une seule ligne de config)
  const { data: existing } = await sb.from('qr_config').select('id').single();
  let error;
  if (existing) {
    ({ error } = await sb.from('qr_config').update(data).eq('id', existing.id));
  } else {
    ({ error } = await sb.from('qr_config').insert(data));
  }
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  const el = document.getElementById('qrConfigSaveStatus');
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 2500);
  showToast('✓ Configuration QR sauvegardée', 'success');
}

// ══════════════════════════════════════
// DASHBOARD SOUS-TRAITANT
// ══════════════════════════════════════
async function loadSTStats() {
  if (!currentProfile.org_id) return;
  const [{ data: rels }, { data: workers }] = await Promise.all([
    sb.from('org_relationships').select('id').eq('st_org_id', currentProfile.org_id),
    sb.from('profiles').select('id').eq('org_id', currentProfile.org_id).eq('role','worker')
  ]);
  document.getElementById('stStat1').textContent = rels    ? rels.length    : 0;
  document.getElementById('stStat3').textContent = workers ? workers.length : 0;
}

async function loadSTWorkers() {
  const container = document.getElementById('stWorkersContainer');
  if (!currentProfile.org_id) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Organisation non configurée.</div></div>`;
    return;
  }

  // Charger workers rattachés + invitations en attente en parallèle
  const [{ data: workers }, { data: invites }, { data: org }] = await Promise.all([
    sb.from('profiles').select('id, full_name, email').eq('org_id', currentProfile.org_id).eq('role','worker'),
    sb.from('worker_invites').select('*').eq('org_id', currentProfile.org_id).order('created_at', { ascending: false }),
    sb.from('organizations').select('team_code, name').eq('id', currentProfile.org_id).single()
  ]);

  const joinedEmails = new Set((workers || []).map(w => w.email.toLowerCase()));

  // Marquer les invitations comme "joined" si le worker s'est inscrit
  const pendingInvites = (invites || []).filter(i => !joinedEmails.has(i.worker_email.toLowerCase()));

  let html = '';

  // Bannière code équipe
  if (org) {
    html += `<div style="background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.25);border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:14px">
      <div style="flex:1"><div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:3px">Code à partager</div>
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:900;color:var(--orange);letter-spacing:3px">${org.team_code}</div></div>
      <button onclick="navigator.clipboard.writeText('${org.team_code}').then(()=>showToast('Code copié','success'))" class="btn-sm btn-view">📋 Copier</button>
    </div>`;
  }

  // Section intervenants rattachés
  if (workers && workers.length) {
    html += `<div class="section-title" style="margin-bottom:12px">✅ Rattachés (${workers.length})</div>
    <div class="request-list" style="margin-bottom:24px">` +
    workers.map(w => `<div class="request-card">
      <div class="request-card-header">
        <div class="request-card-icon">👷</div>
        <div class="request-card-info">
          <div class="request-card-name">${w.full_name}</div>
          <div class="request-card-meta">📧 ${w.email}</div>
        </div>
        <span style="font-size:11px;color:#86EFAC;font-weight:700">✓ Actif</span>
      </div>
    </div>`).join('') + '</div>';
  }

  // Section invitations en attente
  if (pendingInvites.length) {
    html += `<div class="section-title" style="margin-bottom:12px">⏳ Invités en attente (${pendingInvites.length})</div>
    <div class="request-list">` +
    pendingInvites.map(inv => {
      const date = new Date(inv.created_at).toLocaleDateString('fr-FR');
      const subject   = encodeURIComponent(`Invitation SafetySphere — ${org?.name || ''}`);
      const bodyShort = encodeURIComponent(`Bonjour,\n\n${org?.name} vous invite sur SafetySphere.\n\nCréez votre compte : https://safetysphere.vercel.app\nRôle : Intervenant | Code employeur : ${org?.team_code}\n\nCordialement,\n${currentProfile.full_name}`);
      return `<div class="request-card">
        <div class="request-card-header">
          <div class="request-card-icon">📧</div>
          <div class="request-card-info">
            <div class="request-card-name">${inv.worker_email}</div>
            <div class="request-card-meta">Invité le ${date}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button onclick="window.open('mailto:${inv.worker_email}?subject=${subject}&body=${bodyShort}','_self')" class="btn-sm btn-view" style="white-space:nowrap">🔁 Relancer</button>
            <button onclick="cancelWorkerInvite('${inv.id}')" class="btn-sm btn-reject" style="white-space:nowrap">✕</button>
          </div>
        </div>
      </div>`;
    }).join('') + '</div>';
  }

  if (!workers?.length && !pendingInvites.length) {
    html += `<div class="empty-state"><div class="empty-state-icon">👷</div><div class="empty-state-text">Aucun intervenant pour l'instant.<br>Cliquez sur "Inviter des intervenants" pour commencer.</div></div>`;
  }

  container.innerHTML = html;
}

async function cancelWorkerInvite(inviteId) {
  const { error } = await sb.from('worker_invites').delete().eq('id', inviteId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Invitation supprimée', 'success');
  loadSTWorkers();
}

async function attachToEU() {
  const code = document.getElementById('euTeamCodeInput').value.toUpperCase().trim();
  if (!code) { showToast('Veuillez saisir un code équipe', 'error'); return; }
  if (!currentProfile.org_id) { showToast('Organisation non configurée', 'error'); return; }

  // Trouver l'EU par son code équipe (type company)
  const { data: eu } = await sb.from('organizations').select('id, name').eq('team_code', code).eq('type','company').single();
  if (!eu) { showToast('Code invalide — vérifiez auprès de votre donneur d\'ordre', 'error'); return; }
  if (eu.id === currentProfile.org_id) { showToast('Vous ne pouvez pas vous rattacher à votre propre organisation', 'error'); return; }

  const { error } = await sb.from('org_relationships').insert({ eu_org_id: eu.id, st_org_id: currentProfile.org_id });
  if (error) {
    if (error.code === '23505') { showToast('Vous êtes déjà rattaché à ' + eu.name, 'error'); return; }
    showToast('Erreur : ' + error.message, 'error'); return;
  }
  document.getElementById('euTeamCodeInput').value = '';
  showToast('✓ Rattaché à ' + eu.name, 'success');
  loadSTEU();
  loadSTStats();
}

async function loadSTEU() {
  const container = document.getElementById('stEUContainer');
  if (!currentProfile.org_id) { container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Organisation non configurée.</div></div>`; return; }

  const { data: rels } = await sb.from('org_relationships').select('id, eu_org_id, created_at').eq('st_org_id', currentProfile.org_id).order('created_at', { ascending: false });
  if (!rels || !rels.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏭</div><div class="empty-state-text">Aucune EU rattachée.<br>Saisissez le code équipe de votre donneur d'ordre.</div></div>`;
    return;
  }
  const { data: orgs } = await sb.from('organizations').select('id, name, team_code').in('id', rels.map(r => r.eu_org_id));
  const orgMap = {};
  if (orgs) orgs.forEach(o => orgMap[o.id] = o);

  // Charger toutes les missions du ST
  const { data: missions } = await sb.from('missions')
    .select('id, eu_org_id, title, status, start_date, end_date')
    .eq('st_org_id', currentProfile.org_id)
    .order('created_at', { ascending: false });

  const missionsByEU = {};
  (missions || []).forEach(m => {
    if (!missionsByEU[m.eu_org_id]) missionsByEU[m.eu_org_id] = [];
    missionsByEU[m.eu_org_id].push(m);
  });

  const statusLabel = { draft:'Brouillon', pending:'En attente EU', approved:'✅ Validée', rejected:'❌ Refusée', active:'Active' };
  const statusColor = { draft:'#94A3B8', pending:'#F59E0B', approved:'#22C55E', rejected:'#EF4444', active:'#22C55E' };

  container.innerHTML = '<div class="request-list">' + rels.map(rel => {
    const eu   = orgMap[rel.eu_org_id] || {};
    const date = new Date(rel.created_at).toLocaleDateString('fr-FR');
    const euMissions = missionsByEU[rel.eu_org_id] || [];

    const missionsHtml = euMissions.length ? euMissions.map(m => {
      const sc = statusColor[m.status] || '#94A3B8';
      const sl = statusLabel[m.status] || m.status;
      const dates = m.start_date ? `📅 ${new Date(m.start_date).toLocaleDateString('fr-FR')}${m.end_date ? ' → '+new Date(m.end_date).toLocaleDateString('fr-FR') : ''}` : '';
      return `<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;padding:12px 14px;margin-top:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div>
            <div style="font-size:14px;font-weight:700">${m.title}</div>
            ${dates ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">${dates}</div>` : ''}
          </div>
          <span style="font-size:11px;font-weight:700;color:${sc};white-space:nowrap">${sl}</span>
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          <button onclick="openMissionWorkersModal('${m.id}','${m.title}')" class="btn-sm btn-view" style="font-size:11px">👷 Intervenants</button>
          <button onclick="openMissionDocsModal('${m.id}','${m.title}')" class="btn-sm btn-view" style="font-size:11px">📄 Docs partagés</button>
          ${m.status === 'draft' || m.status === 'rejected' ? `<button onclick="submitMission('${m.id}')" class="btn-sm btn-upload" style="font-size:11px">📤 Soumettre</button>` : ''}
          <button onclick="openEditMissionModal('${m.id}','${m.title}','${(m.description||'').replace(/'/g,'')}','${m.start_date||''}','${m.end_date||''}')" class="btn-sm" style="font-size:11px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--muted)">✏️</button>
          <button onclick="deleteMission('${m.id}')" class="btn-sm btn-reject" style="font-size:11px">🗑</button>
        </div>
      </div>`;
    }).join('') : `<div style="font-size:12px;color:var(--muted);margin-top:10px;font-style:italic">Aucune mission — créez-en une pour déclarer vos travaux</div>`;

    return `<div class="request-card" style="flex-direction:column;align-items:stretch">
      <div class="request-card-header">
        <div class="request-card-icon">🏭</div>
        <div class="request-card-info">
          <div class="request-card-name">${eu.name || 'Entreprise'}</div>
          <div class="request-card-meta">Rattaché le ${date} · ${euMissions.length} mission(s)</div>
        </div>
        <div style="display:flex;gap:6px">
          <button onclick="openCreateMissionModal('${rel.eu_org_id}','${eu.name||''}')" class="btn-sm btn-upload" style="white-space:nowrap;font-size:11px">➕ Mission</button>
          <button onclick="detachFromEU('${rel.id}','${eu.name || ''}')" class="btn-sm btn-reject" style="white-space:nowrap;font-size:11px">✕</button>
        </div>
      </div>
      <div style="padding:0 4px 4px">${missionsHtml}</div>
    </div>`;
  }).join('') + '</div>';
}

async function detachFromEU(relId, euName) {
  if (!confirm(`Se détacher de ${euName} ?`)) return;
  const { error } = await sb.from('org_relationships').delete().eq('id', relId);
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('✓ Détaché de ' + euName, 'success');
  loadSTEU();
  loadSTStats();
}

async function loadSTDocs() {
  const container = document.getElementById('stDocsContainer');
  if (!currentProfile.org_id) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Organisation non configurée.</div></div>`;
    return;
  }
  const { data: docs } = await sb.from('documents').select('*').eq('company_id', currentProfile.org_id).eq('category','company');
  const html = '<div class="doc-grid">' + COMPANY_DOCS.map(def => {
    const doc    = docs ? docs.find(d => d.doc_type === def.key) : null;
    const status = doc ? doc.status : 'empty';
    const exp    = doc?.expires_at ? new Date(doc.expires_at).toLocaleDateString('fr-FR') : null;
    return `<div class="doc-card">
      <div class="doc-card-header"><div class="doc-card-icon">${def.icon}</div><div class="doc-card-badges"><span class="doc-badge status-${status}">${status === 'validated' ? '✓ Validé' : status === 'pending' ? '⏳ En attente' : status === 'rejected' ? '✗ Refusé' : '+ Déposer'}</span></div></div>
      <div class="doc-card-name">${def.name}</div>
      <div class="doc-card-desc">${def.desc}</div>
      ${exp ? `<div class="doc-card-expiry ok">📅 ${exp}</div>` : ''}
    </div>`;
  }).join('') + '</div>';
  container.innerHTML = html;
}

// ══════════════════════════════════════
// INVITATION INTERVENANTS (ST)
// ══════════════════════════════════════
let _stImportedEmails = [];

function openInviteSTModal() {
  document.getElementById('stEmailsList').value = '';
  document.getElementById('stImportPreview').innerHTML = '';
  document.getElementById('stFilePreview').textContent = '';
  _stImportedEmails = [];
  switchSTInviteTab('manual', document.querySelector('#inviteSTModal .tab'));
  document.getElementById('inviteSTModal').classList.add('open');
}
function closeInviteSTModal() {
  document.getElementById('inviteSTModal').classList.remove('open');
}

function switchSTInviteTab(tab, el) {
  document.querySelectorAll('#inviteSTModal .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('stInviteTab-manual').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('stInviteTab-import').style.display = tab === 'import' ? 'block' : 'none';
}

async function handleSTFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('stFilePreview').textContent = file.name;
  _stImportedEmails = [];

  if (file.name.endsWith('.csv')) {
    const text  = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const header = lines[0].toLowerCase().split(/[,;]/);
    const emailIdx = header.findIndex(h => h.includes('email') || h.includes('mail'));
    if (emailIdx === -1) { document.getElementById('stImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Colonne "email" introuvable</div>`; return; }
    for (let i = 1; i < lines.length; i++) {
      const email = lines[i].split(/[,;]/)[emailIdx]?.replace(/"/g,'').trim().toLowerCase();
      if (email && email.includes('@')) _stImportedEmails.push(email);
    }
  } else {
    try {
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const wb  = read(await file.arrayBuffer());
      const rows = utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const emailKey = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('mail'));
      if (!emailKey) { document.getElementById('stImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Colonne "email" introuvable</div>`; return; }
      rows.forEach(r => { const e = (r[emailKey]||'').toString().trim().toLowerCase(); if (e.includes('@')) _stImportedEmails.push(e); });
    } catch(e) { document.getElementById('stImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Erreur : ${escapeHtml(e.message)}</div>`; return; }
  }
  document.getElementById('stImportPreview').innerHTML =
    `<div style="color:#86EFAC;font-size:13px">✓ ${_stImportedEmails.length} email(s) importé(s)</div>` +
    `<div style="font-size:11px;color:var(--muted);margin-top:4px">${_stImportedEmails.slice(0,5).join(', ')}${_stImportedEmails.length > 5 ? '...' : ''}</div>`;
}

async function sendSTInvites() {
  if (!currentProfile.org_id) { showToast('Votre organisation n\'est pas configurée', 'error'); return; }

  const activeTab = document.getElementById('stInviteTab-manual').style.display !== 'none' ? 'manual' : 'import';
  let emails = [];
  if (activeTab === 'manual') {
    emails = document.getElementById('stEmailsList').value.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
  } else {
    emails = _stImportedEmails;
  }
  if (!emails.length) { showToast('Aucun email valide trouvé', 'error'); return; }

  setLoading('inviteSTBtn', true, 'Préparation...');
  const { data: euOrg } = await sb.from('organizations').select('name, team_code').eq('id', currentProfile.org_id).single();
  const euName = euOrg?.name || 'notre entreprise';
  const euCode = euOrg?.team_code || '';

  // Sauvegarder toutes les invitations en base
  const inserts = emails.map(email => ({ eu_org_id: currentProfile.org_id, st_email: email }));
  const { error } = await sb.from('st_invites').upsert(inserts, { onConflict: 'eu_org_id,st_email', ignoreDuplicates: true });
  if (error) { showToast('Erreur envoi invitations : ' + error.message, 'error'); setLoading('inviteSTBtn', false, '✉️ Préparer les invitations'); return; }
  setLoading('inviteSTBtn', false, '✉️ Préparer les invitations');
  closeInviteSTModal();

  // Préparer les messages
  const messages = emails.map(email => {
    const subject   = encodeURIComponent(`Invitation SafetySphere — ${euName}`);
    const bodyShort = encodeURIComponent(`Bonjour,\n\n${euName} vous invite sur SafetySphere.\n\nCréez votre compte : https://safetysphere.vercel.app\nRôle : Sous-Traitant\nCode équipe EU : ${euCode}\n\nCordialement,\n${currentProfile.full_name}`);
    const fullMsg   = `Bonjour,\n\n${euName} vous invite à rejoindre SafetySphere, la plateforme de gestion des habilitations.\n\nCréez votre compte sur https://safetysphere.vercel.app\n- Rôle : Sous-Traitant\n- Dans "Mes EU", saisissez le code : ${euCode}\n\nCordialement,\n${currentProfile.full_name}\n${euName}`;
    return { email, fullMsg, mailtoUrl: `mailto:${email}?subject=${subject}&body=${bodyShort}` };
  });

  window._stInviteMessages = messages;
  document.getElementById('workerInviteResultSubtitle').textContent = `${emails.length} invitation(s) — Code équipe : ${euCode}`;
  document.getElementById('workerInviteResultList').innerHTML = messages.map((m, i) =>
    `<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:700;flex:1">📧 ${m.email}</span>
        <button onclick="window.open(window._stInviteMessages[${i}].mailtoUrl,'_self')" class="btn-sm btn-upload" style="white-space:nowrap">📧 Ouvrir</button>
        <button onclick="navigator.clipboard.writeText(window._stInviteMessages[${i}].fullMsg).then(()=>showToast('Copié','success'))" class="btn-sm btn-view" style="white-space:nowrap">📋 Copier</button>
      </div>
    </div>`
  ).join('');
  document.getElementById('workerInviteResultModal').classList.add('open');

  // Rafraîchir la liste
  const containerId = currentProfile.role === 'hse' ? 'hseSTContainer' : 'companySTContainer';
  loadST(currentProfile.org_id, containerId);
}

async function openInviteWorkersModal() {
  document.getElementById('workerEmailsList').value = '';
  document.getElementById('workerEmailCount').textContent = '';
  document.getElementById('workerImportPreview').innerHTML = '';
  document.getElementById('workerFilePreview').textContent = '';
  _workerImportedEmails = [];
  switchInviteTab('manual', document.querySelector('#inviteWorkersModal .tab'));
  document.getElementById('inviteWorkersModal').classList.add('open');
}

function closeInviteWorkersModal() {
  document.getElementById('inviteWorkersModal').classList.remove('open');
}

function switchInviteTab(tab, el) {
  document.querySelectorAll('#inviteWorkersModal .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('inviteTab-manual').style.display = tab === 'manual' ? 'block' : 'none';
  document.getElementById('inviteTab-import').style.display = tab === 'import' ? 'block' : 'none';
}

async function handleWorkerFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('workerFilePreview').textContent = file.name;
  _workerImportedEmails = [];

  if (file.name.endsWith('.csv')) {
    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const header = lines[0].toLowerCase().split(/[,;]/);
    const emailIdx = header.findIndex(h => h.includes('email') || h.includes('mail'));
    if (emailIdx === -1) {
      document.getElementById('workerImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Colonne "email" introuvable dans le CSV</div>`;
      return;
    }
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(/[,;]/);
      const email = cols[emailIdx]?.replace(/"/g,'').trim().toLowerCase();
      if (email && email.includes('@')) _workerImportedEmails.push(email);
    }
  } else {
    // Excel via SheetJS CDN
    try {
      const { read, utils } = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');
      const buf  = await file.arrayBuffer();
      const wb   = read(buf);
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = utils.sheet_to_json(ws, { defval: '' });
      const emailKey = Object.keys(rows[0] || {}).find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('mail'));
      if (!emailKey) {
        document.getElementById('workerImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Colonne "email" introuvable dans le fichier</div>`;
        return;
      }
      rows.forEach(r => {
        const email = (r[emailKey] || '').toString().trim().toLowerCase();
        if (email && email.includes('@')) _workerImportedEmails.push(email);
      });
    } catch(e) {
      document.getElementById('workerImportPreview').innerHTML = `<div style="color:#FCA5A5;font-size:13px">⚠️ Erreur lecture fichier : ${escapeHtml(e.message)}</div>`;
      return;
    }
  }

  document.getElementById('workerImportPreview').innerHTML =
    `<div style="color:#86EFAC;font-size:13px">✓ ${_workerImportedEmails.length} email(s) importé(s)</div>` +
    `<div style="font-size:11px;color:var(--muted);margin-top:4px">${_workerImportedEmails.slice(0,5).join(', ')}${_workerImportedEmails.length > 5 ? '...' : ''}</div>`;
}

async function sendWorkerInvites() {
  const { data: org } = await sb.from('organizations').select('name, team_code').eq('id', currentProfile.org_id).single();
  if (!org) { showToast('Organisation introuvable', 'error'); return; }

  const activeTab = document.getElementById('inviteTab-manual').style.display !== 'none' ? 'manual' : 'import';
  let emails = [];
  if (activeTab === 'manual') {
    const raw = document.getElementById('workerEmailsList').value;
    emails = raw.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
  } else {
    emails = _workerImportedEmails;
  }
  if (!emails.length) { showToast('Aucun email valide trouvé', 'error'); return; }

  // Sauvegarder les invitations en base (ignorer les doublons)
  const inserts = emails.map(email => ({ org_id: currentProfile.org_id, worker_email: email }));
  const { error: invErr } = await sb.from('worker_invites').upsert(inserts, { onConflict: 'org_id,worker_email', ignoreDuplicates: true });
  if (invErr) { showToast('Erreur envoi invitations : ' + invErr.message, 'error'); return; }

  const messages = emails.map(email => {
    const subject    = encodeURIComponent(`Invitation SafetySphere — ${org.name}`);
    const bodyShort  = encodeURIComponent(`Bonjour,\n\n${org.name} vous invite sur SafetySphere.\n\nCréez votre compte : https://safetysphere.vercel.app\nRôle : Intervenant | Code employeur : ${org.team_code}\n\nCordialement,\n${currentProfile.full_name}`);
    const fullMsg    = `Bonjour,\n\n${org.name} vous invite à rejoindre SafetySphere, la plateforme de gestion des habilitations.\n\nCréez votre compte sur https://safetysphere.vercel.app\n- Rôle : Intervenant\n- Code employeur : ${org.team_code}\n\nCordialement,\n${currentProfile.full_name}\n${org.name}`;
    return { email, fullMsg, mailtoUrl: `mailto:${email}?subject=${subject}&body=${bodyShort}` };
  });

  closeInviteWorkersModal();
  window._workerInviteMessages = messages;
  document.getElementById('workerInviteResultSubtitle').textContent = `${emails.length} invitation(s) — Code équipe : ${org.team_code}`;
  document.getElementById('workerInviteResultList').innerHTML = messages.map((m, i) =>
    `<div style="background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;padding:12px 14px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span style="font-size:13px;font-weight:700;flex:1">📧 ${m.email}</span>
        <button onclick="window.open(window._workerInviteMessages[${i}].mailtoUrl,'_self')" class="btn-sm btn-upload" style="white-space:nowrap">📧 Ouvrir</button>
        <button onclick="navigator.clipboard.writeText(window._workerInviteMessages[${i}].fullMsg).then(()=>showToast('Copié','success'))" class="btn-sm btn-view" style="white-space:nowrap">📋 Copier</button>
      </div>
    </div>`
  ).join('');
  document.getElementById('workerInviteResultModal').classList.add('open');
  loadSTWorkers();
}

function copyAllWorkerInvites() {
  if (!window._workerInviteMessages) return;
  const all = window._workerInviteMessages.map(m => `À: ${m.email}\n${m.fullMsg}`).join('\n\n---\n\n');
  navigator.clipboard.writeText(all).then(() => showToast(`✓ ${window._workerInviteMessages.length} messages copiés`, 'success'));
}
