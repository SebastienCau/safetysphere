// ============================================================
// SafetySphere — signatures.js  (v2.0.0)
// Signature OTP · Workflow envoi · Page publique signature
// Document consolidé · Admin signatures · Demandes entrantes
// Navigation modale signature · Upload manuel
// ============================================================
// Dépendances : core.js · reports.js (renderHistoriqueSection,
//               openReportViewer, archiveReport)
// ============================================================

// ── NAVIGATION MODALE SIGNATURE + UPLOAD MANUEL ──────────────

// ══ NAVIGATION MODALE SIGNATURE ══════════════════════════════

function goToStep(n) {
  [0,1,2,3,4,5].forEach(function(i) {
    var el = document.getElementById('sigOtpStep' + i);
    if (el) el.style.display = (i === n ? '' : 'none');
  });
}

function chooseSignatureMode(mode) {
  if (mode === 'otp') {
    document.getElementById('sigOtpRequestBtn').disabled = false;
    document.getElementById('sigOtpRequestBtn').textContent = '📧 Envoyer le code de vérification';
    goToStep(1);
  } else {
    goToStep(4);
  }
}

// ── Télécharger le rapport vierge (sans cachet) pour impression ──
function downloadUnsignedReport() {
  if (!_sigContext) return;
  var html, title;
  if (_sigContext.reportType === 'DUER' && _sigContext._entries) {
    html  = buildDuerHTML(_sigContext._entries, _sigContext.meta, buildManualSignatureBlockHTML());
    title = 'DUER';
  } else if (_sigContext.reportType === 'VGP' && _sigContext._records) {
    html  = buildVgpHTML(_sigContext._records, _sigContext.meta, buildManualSignatureBlockHTML());
    title = 'VGP';
  } else {
    showToast('Données rapport non disponibles', 'error'); return;
  }
  // Télécharger directement en HTML (le navigateur peut l'imprimer en PDF)
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = title + '-' + _sigContext.reportNum + '-A-SIGNER.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  showToast('Document téléchargé — imprimez et signez', 'success');
}

// Bloc réservé pour signature manuscrite (bas de rapport)
function buildManualSignatureBlockHTML() {
  return '<div style="margin-top:24px;border:2px dashed #D1D5DB;border-radius:10px;padding:20px;page-break-inside:avoid">'
    + '<div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px">Signature manuscrite</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">'
    + sigLineHTML('Établi par')
    + sigLineHTML('Vérifié par')
    + sigLineHTML('Date')
    + '</div>'
    + '<div style="margin-top:16px;height:60px;border-bottom:1px solid #9CA3AF;position:relative">'
    + '<span style="position:absolute;bottom:6px;left:0;font-size:10px;color:#9CA3AF">Signature</span></div>'
    + '</div>';
}
function sigLineHTML(label) {
  return '<div><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:20px">'+label+'</div>'
    + '<div style="border-bottom:1px solid #9CA3AF;height:24px"></div></div>';
}

// ── Upload scan signé ─────────────────────────────────────────
var _manualSigFile = null;

function onManualSigFileChange(input) {
  _manualSigFile = input.files[0] || null;
  var dropText = document.getElementById('manualSigDropText');
  var uploadBtn = document.getElementById('manualSigUploadBtn');
  if (dropText) dropText.textContent = _manualSigFile ? _manualSigFile.name : 'Cliquez pour sélectionner';
  if (uploadBtn) uploadBtn.disabled = !_manualSigFile;
}

async function uploadManualSignature() {
  if (!_manualSigFile || !_sigContext) return;
  var btn = document.getElementById('manualSigUploadBtn');
  btn.disabled = true; btn.textContent = '⏳ Archivage...';

  var pad     = function(n){ return String(n).padStart(2,'0'); };
  var now     = new Date();
  var sigId   = 'SIG-MAN-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  var filePath = currentProfile.org_id + '/' + sigId + '-' + _manualSigFile.name;

  var fileUrl = null;
  var upRes = await sb.storage.from('rapport-archives').upload(filePath, _manualSigFile, { upsert: true });
  if (!upRes.error) {
    var signed = await sb.storage.from('rapport-archives').createSignedUrl(filePath, 60 * 60 * 24 * 365);
    if (!signed.error) fileUrl = signed.data.signedUrl;
  }

  // Enregistrer en base
  var sigEntry = {
    org_id      : currentProfile.org_id,
    user_id     : currentUser.id,
    responsable : currentProfile.full_name || currentProfile.email,
    email       : currentProfile.email,
    report_num  : _sigContext.reportNum,
    report_type : _sigContext.reportType,
    sig_id      : sigId,
    method      : 'manuscrite_scannee',
    signed_at   : now.toISOString(),
  };
  await sb.from('report_signatures').insert(sigEntry);

  // Archiver aussi le fichier dans report_archive
  if (fileUrl) {
    await sb.from('report_archive').insert({
      org_id       : currentProfile.org_id,
      created_by   : currentUser.id,
      responsable  : currentProfile.full_name || currentProfile.email,
      email        : currentProfile.email || '',
      report_num   : sigId,
      report_type  : _sigContext.reportType,
      label        : _sigContext.reportType + ' — signature manuscrite scannée',
      source       : 'manuscrit',
      generated_at : now.toISOString(),
      file_url     : fileUrl,
    });
  }

  var sigDate = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  var sigTime = pad(now.getHours()) + 'h' + pad(now.getMinutes());
  document.getElementById('sigManualSuccessDetail').innerHTML =
    'Réf. : <strong>' + sigId + '</strong><br>'
    + sigDate + ' à ' + sigTime + '<br>'
    + '<span style="color:var(--muted)">Conservé dans l\'historique · Méthode : manuscrite scannée</span>';

  _manualSigFile = null;
  goToStep(5);
  showToast('✓ Document signé archivé', 'success');
}


// ── SYSTÈME DE SIGNATURE OTP + WORKFLOW ──────────────────────

// ══════════════════════════════════════════════════════════════
// SYSTÈME DE SIGNATURE OTP
// Tables : signature_settings (global/org/user), report_signatures
// ══════════════════════════════════════════════════════════════

var _sigContext   = null; // { reportNum, reportType, meta, onSuccess }
var _otpCountdown = null;
var _allSigOrgs   = [];
var _allSigUsers  = [];

// ── Vérifier si la signature OTP est activée pour l'utilisateur courant ──
async function isSignatureEnabled() {
  try {
    // 1. Paramètre global
    var globalRes = await sb.from('signature_settings').select('enabled').eq('scope','global').eq('scope_id','global').maybeSingle();
    if (globalRes.data && globalRes.data.enabled === false) return false;

    // 2. Désactivé pour l'organisation
    if (currentProfile.org_id) {
      var orgRes = await sb.from('signature_settings').select('enabled').eq('scope','org').eq('scope_id', currentProfile.org_id).maybeSingle();
      if (orgRes.data && orgRes.data.enabled === false) return false;
    }

    // 3. Désactivé pour l'utilisateur
    var userRes = await sb.from('signature_settings').select('enabled').eq('scope','user').eq('scope_id', currentUser.id).maybeSingle();
    if (userRes.data && userRes.data.enabled === false) return false;

    return true;
  } catch(e) {
    // Table absente ou erreur réseau → on bypass la signature (mode dégradé)
    console.warn('isSignatureEnabled error (bypass activé) :', e);
    return true;
  }
}

// ── Ouvrir la modale de signature ────────────────────────────
async function openSignatureModal(reportNum, reportType, meta, onSuccess, extraData) {
  var enabled = await isSignatureEnabled();
  if (!enabled) {
    // Signature désactivée : appel direct du callback sans OTP
    if (typeof onSuccess === 'function') onSuccess({ bypassed: true });
    return;
  }

  _sigContext = { reportNum: reportNum, reportType: reportType, meta: meta, onSuccess: onSuccess };
  // Stocker les données extra (entries/records) pour downloadUnsignedReport
  if (extraData) {
    _sigContext._entries = extraData.entries || null;
    _sigContext._records = extraData.records || null;
  }

  // Réinitialiser sur l'écran de choix (step 0)
  [0,1,2,3,4,5].forEach(function(i) {
    var el = document.getElementById('sigOtpStep' + i);
    if (el) el.style.display = (i === 0 ? '' : 'none');
  });
  document.getElementById('sigOtpSubtitle').textContent = 'Signature du rapport ' + reportType + ' · ' + reportNum;
  document.getElementById('sigOtpEmailDisplay').textContent = currentProfile.email || '—';
  document.getElementById('sigOtpRequestBtn').disabled = false;
  document.getElementById('sigOtpRequestBtn').textContent = '📧 Envoyer le code de vérification';
  ['sigOtpD1','sigOtpD2','sigOtpD3','sigOtpD4','sigOtpD5','sigOtpD6','sigOtpD7','sigOtpD8'].forEach(function(id){ document.getElementById(id).value = ''; });

  document.getElementById('signatureOtpModal').classList.add('open');
}

function closeSignatureOtp() {
  document.getElementById('signatureOtpModal').classList.remove('open');
  if (_otpCountdown) { clearInterval(_otpCountdown); _otpCountdown = null; }
  _sigContext = null;
}

// ── Étape 1 : demander l'OTP ─────────────────────────────────
async function requestSignatureOtp() {
  var btn = document.getElementById('sigOtpRequestBtn');
  btn.disabled = true; btn.textContent = '⏳ Envoi en cours...';

  var email = currentProfile.email;
  if (!email) { showToast('Email introuvable', 'error'); btn.disabled = false; return; }

  // Forcer l'envoi d'un code OTP 6 chiffres (pas un magic link)
  // Côté Supabase Dashboard : Auth > Email Templates > "Magic Link" → désactiver
  // Auth > Settings > "Enable email OTP" → activer
  var res = await sb.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: null,  // null = pas de redirect = mode code
    }
  });
  if (res.error) {
    showToast('Erreur envoi OTP : ' + res.error.message, 'error');
    btn.disabled = false; btn.textContent = '📧 Envoyer le code de vérification';
    return;
  }

  // Passer à l'étape 2
  document.getElementById('sigOtpStep1').style.display = 'none';
  document.getElementById('sigOtpStep2').style.display = '';
  document.getElementById('sigOtpD1').focus();
  startOtpCountdown();
}

function startOtpCountdown() {
  var remaining = 60;
  var el = document.getElementById('sigOtpCountdown');
  if (el) el.textContent = remaining;
  if (_otpCountdown) clearInterval(_otpCountdown);
  _otpCountdown = setInterval(function() {
    remaining--;
    if (el) el.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(_otpCountdown); _otpCountdown = null;
      if (el) el.textContent = '0';
    }
  }, 1000);
}

function resetOtpToStep1() {
  if (_otpCountdown) { clearInterval(_otpCountdown); _otpCountdown = null; }
  document.getElementById('sigOtpStep1').style.display = '';
  document.getElementById('sigOtpStep2').style.display = 'none';
  document.getElementById('sigOtpRequestBtn').disabled = false;
  document.getElementById('sigOtpRequestBtn').textContent = '📧 Envoyer le code de vérification';
}

// Navigation entre champs OTP
function otpDigitInput(el, nextId) {
  el.value = el.value.replace(/\D/g,'');
  if (el.value && nextId) document.getElementById(nextId).focus();
}
function otpDigitBack(e, el, prevId) {
  if (e.key === 'Backspace' && !el.value && prevId) document.getElementById(prevId).focus();
}

// ── Étape 2 : vérifier le code ───────────────────────────────
async function verifySignatureOtp() {
  var code = ['sigOtpD1','sigOtpD2','sigOtpD3','sigOtpD4','sigOtpD5','sigOtpD6','sigOtpD7','sigOtpD8']
    .map(function(id){ return document.getElementById(id).value; }).join('');
  if (code.length !== 8) { showToast('Saisissez les 8 chiffres', 'error'); return; }

  var btn = document.getElementById('sigOtpVerifyBtn');
  btn.disabled = true; btn.textContent = '⏳ Vérification...';

  var res = await sb.auth.verifyOtp({ email: currentProfile.email, token: code, type: 'email' });
  if (res.error) {
    showToast('Code invalide ou expiré', 'error');
    btn.disabled = false; btn.textContent = '✓ Confirmer la signature';
    return;
  }

  // Code valide : enregistrer la signature
  if (_otpCountdown) { clearInterval(_otpCountdown); _otpCountdown = null; }
  await recordSignature();
}

// ── Enregistrer la signature en base ─────────────────────────
async function recordSignature() {
  if (!_sigContext) return;
  var now     = new Date();
  var pad     = function(n){ return String(n).padStart(2,'0'); };
  var sigDate = now.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });
  var sigTime = pad(now.getHours()) + 'h' + pad(now.getMinutes());
  var sigId   = 'SIG-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

  var sigEntry = {
    org_id      : currentProfile.org_id,
    user_id     : currentUser.id,
    responsable : currentProfile.full_name || currentProfile.email,
    email       : currentProfile.email,
    report_num  : _sigContext.reportNum,
    report_type : _sigContext.reportType,
    sig_id      : sigId,
    method      : 'otp_email',
    signed_at   : now.toISOString(),
  };

  await sb.from('report_signatures').insert(sigEntry);

  // Afficher étape 3 succès
  document.getElementById('sigOtpStep2').style.display = 'none';
  document.getElementById('sigOtpStep3').style.display = '';
  document.getElementById('sigOtpSuccessDetail').innerHTML =
    'Réf. signature : <strong>' + sigId + '</strong><br>'
    + sigDate + ' à ' + sigTime + '<br>'
    + '<span style="color:var(--muted)">' + (currentProfile.full_name||currentProfile.email) + '</span>';

  // Callback avec les données de signature
  if (typeof _sigContext.onSuccess === 'function') {
    _sigContext.onSuccess({
      sigId       : sigId,
      responsable : currentProfile.full_name || currentProfile.email,
      email       : currentProfile.email,
      sigDate     : sigDate,
      sigTime     : sigTime,
      method      : 'OTP Email vérifié',
    });
  }
}

// ── Bloc HTML "cachet de signature" à injecter dans le rapport ─
function buildSignatureStampHTML(sig) {
  if (!sig || sig.bypassed) return '';
  return '<div class="sig-stamp" style="margin-top:20px;border:2px solid #1E3A5F;border-radius:10px;padding:14px 18px;position:relative;background:#F0F4FF">'
    + '<div style="position:absolute;top:-10px;left:16px;background:#fff;padding:0 8px;font-size:10px;font-weight:900;color:#1E3A5F;letter-spacing:2px">SIGNÉ ÉLECTRONIQUEMENT</div>'
    + '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0">Signataire</span><span style="font-size:11px;font-weight:600;color:#111827">' + escapeHtml(sig.responsable) + '</span></div>'
    + '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0">Email</span><span style="font-size:11px;color:#374151">' + escapeHtml(sig.email) + '</span></div>'
    + '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0">Date</span><span style="font-size:11px;font-weight:600;color:#111827">' + escapeHtml(sig.sigDate) + ' à ' + escapeHtml(sig.sigTime) + '</span></div>'
    + '<div style="display:flex;gap:6px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0">Réf.</span><span style="font-family:monospace;font-size:10px;background:#1E3A5F;color:#fff;padding:2px 7px;border-radius:4px">' + escapeHtml(sig.sigId) + '</span></div>'
    + '<div style="display:flex;gap:6px;align-items:baseline"><span style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;width:80px;flex-shrink:0">Méthode</span><span style="font-size:10px;background:#DCFCE7;border:1px solid #86EFAC;border-radius:6px;padding:2px 8px;color:#166534;font-weight:700">' + escapeHtml(sig.method) + ' · eIDAS Niveau 1</span></div>'
    + '</div>';
}

// ── Wrappers PDF avec signature ───────────────────────────────
async function generateDuerPDFSigned() {
  var result = await sb.from('duer_entries').select('*').eq('org_id', currentProfile.org_id).order('created_at');
  var entries = result.data;
  if (!entries || entries.length === 0) { showToast('Aucune unité à exporter', 'error'); return; }
  var meta = await buildReportMeta('DUER');

  openSignatureModal(meta.reportNum, 'DUER', meta, async function(sig) {
    var stampHtml = buildSignatureStampHTML(sig);
    var html = buildDuerHTML(entries, meta, stampHtml);
    openReportWindow(html, 'DUER', meta);
    if (!sig.bypassed) closeSignatureOtp();
    // Rafraîchir l'historique inline après un court délai (temps d'archivage)
    setTimeout(function() {
      renderInlineReportHistory('DUER', _conformRole, 'duer-inline-history-' + _conformRole);
    }, 2500);
  }, { entries: entries });
}

async function generateVgpPDFSigned() {
  var result  = await sb.from('registre_vgp').select('*').eq('org_id', currentProfile.org_id);
  var records = result.data || [];
  var meta    = await buildReportMeta('VGP');

  openSignatureModal(meta.reportNum, 'VGP', meta, async function(sig) {
    var stampHtml = buildSignatureStampHTML(sig);
    var html = buildVgpHTML(records, meta, stampHtml);
    openReportWindow(html, 'VGP', meta);
    if (!sig.bypassed) closeSignatureOtp();
    setTimeout(function() {
      renderInlineReportHistory('VGP', _conformRole, 'vgp-inline-history-' + _conformRole);
    }, 2500);
  }, { records: records });
}

// ── Historique inline par type de rapport (DUER, VGP, etc.) ──────────────────
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
  // Charger paramètre global
  var globalRes = await sb.from('signature_settings').select('enabled').eq('scope','global').eq('scope_id','global').maybeSingle();
  var globalEnabled = !globalRes.data || globalRes.data.enabled !== false;
  var chk = document.getElementById('sigGlobalEnabled');
  var lbl = document.getElementById('sigGlobalStatusLabel');
  if (chk) { chk.checked = globalEnabled; }
  if (lbl) { lbl.textContent = globalEnabled ? 'Activé' : 'Désactivé'; lbl.style.color = globalEnabled ? 'var(--success)' : 'var(--danger)'; }

  // Charger organisations
  var orgsRes = await sb.from('organizations').select('id,name,type').order('name');
  _allSigOrgs = orgsRes.data || [];
  var orgSettings = await sb.from('signature_settings').select('scope_id,enabled').eq('scope','org');
  var orgMap = {};
  (orgSettings.data||[]).forEach(function(s){ orgMap[s.scope_id] = s.enabled; });
  _allSigOrgs._settings = orgMap;
  renderSigOrgList(orgMap);

  // Charger utilisateurs (profiles avec rôles Company/HSE)
  var usersRes = await sb.from('profiles').select('id,full_name,email,role,org_id').in('role',['company','hse']).order('full_name');
  _allSigUsers = usersRes.data || [];
  var userSettings = await sb.from('signature_settings').select('scope_id,enabled').eq('scope','user');
  var userMap = {};
  (userSettings.data||[]).forEach(function(s){ userMap[s.scope_id] = s.enabled; });
  _allSigUsers._settings = userMap;
  renderSigUserList(userMap);

  // Config workflow
  renderAdminWorkflowConfig();
  // Journal
  loadSigAuditLog();
}

function renderSigOrgList(orgMap) {
  var container = document.getElementById('sigOrgList');
  if (!container) return;
  var filter = (document.getElementById('sigOrgSearch') && document.getElementById('sigOrgSearch').value.toLowerCase()) || '';
  var filtered = _allSigOrgs.filter(function(o){ return !filter || o.name.toLowerCase().indexOf(filter) >= 0; });
  if (!filtered.length) { container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">Aucune organisation trouvée</div>'; return; }
  container.innerHTML = filtered.map(function(org) {
    var enabled = orgMap[org.id] !== false;
    return '<div class="sig-org-row">'
      + '<div><div style="font-size:13px;font-weight:700">' + escapeHtml(org.name) + '</div>'
      + '<div style="font-size:11px;color:var(--muted)">' + (org.type||'') + '</div></div>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
      + '<span style="font-size:11px;color:' + (enabled ? 'var(--success)' : 'var(--muted)') + '">' + (enabled ? 'OTP activé' : 'Désactivé') + '</span>'
      + '<input type="checkbox" class="compliance-checkbox" ' + (enabled ? 'checked' : '') + ' onchange="toggleSigOrg(\'' + org.id + '\',this.checked)">'
      + '</label></div>';
  }).join('');
}

function renderSigUserList(userMap) {
  var container = document.getElementById('sigUserList');
  if (!container) return;
  var filter = (document.getElementById('sigUserSearch') && document.getElementById('sigUserSearch').value.toLowerCase()) || '';
  var filtered = _allSigUsers.filter(function(u){ return !filter || (u.full_name||'').toLowerCase().indexOf(filter)>=0 || (u.email||'').toLowerCase().indexOf(filter)>=0; });
  if (!filtered.length) { container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">Aucun utilisateur trouvé</div>'; return; }
  container.innerHTML = filtered.map(function(u) {
    var enabled = userMap[u.id] !== false;
    var roleLabels = { hse:'🔵 HSE', company:'🏢 Company' };
    return '<div class="sig-org-row">'
      + '<div><div style="font-size:13px;font-weight:700">' + escapeHtml(u.full_name||u.email) + '</div>'
      + '<div style="font-size:11px;color:var(--muted)">' + escapeHtml(u.email||'') + ' · ' + (roleLabels[u.role]||u.role) + '</div></div>'
      + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer">'
      + '<span style="font-size:11px;color:' + (enabled ? 'var(--success)' : 'var(--muted)') + '">' + (enabled ? 'OTP activé' : 'Désactivé') + '</span>'
      + '<input type="checkbox" class="compliance-checkbox" ' + (enabled ? 'checked' : '') + ' onchange="toggleSigUser(\'' + u.id + '\',this.checked)">'
      + '</label></div>';
  }).join('');
}

function filterSigOrgs() {
  renderSigOrgList(_allSigOrgs._settings || {});
}
function filterSigUsers() {
  renderSigUserList(_allSigUsers._settings || {});
}

async function saveSignatureGlobal() {
  var enabled = document.getElementById('sigGlobalEnabled').checked;
  document.getElementById('sigGlobalStatusLabel').textContent = enabled ? 'Activé' : 'Désactivé';
  document.getElementById('sigGlobalStatusLabel').style.color = enabled ? 'var(--success)' : 'var(--danger)';
  await sb.from('signature_settings').upsert({ scope:'global', scope_id:'global', enabled: enabled }, { onConflict:'scope,scope_id' });
  var el = document.getElementById('sigGlobalSaveStatus');
  el.style.display = 'block'; setTimeout(function(){ el.style.display = 'none'; }, 2000);
}

async function toggleSigOrg(orgId, enabled) {
  await sb.from('signature_settings').upsert({ scope:'org', scope_id: orgId, enabled: enabled }, { onConflict:'scope,scope_id' });
  if (_allSigOrgs._settings) _allSigOrgs._settings[orgId] = enabled;
  showToast(enabled ? 'OTP activé pour cette organisation' : 'OTP désactivé pour cette organisation', 'success');
}

async function toggleSigUser(userId, enabled) {
  await sb.from('signature_settings').upsert({ scope:'user', scope_id: userId, enabled: enabled }, { onConflict:'scope,scope_id' });
  if (_allSigUsers._settings) _allSigUsers._settings[userId] = enabled;
  showToast(enabled ? 'OTP activé pour cet utilisateur' : 'OTP désactivé pour cet utilisateur', 'success');
}

async function loadSigAuditLog() {
  var container = document.getElementById('sigAuditLog');
  if (!container) return;
  var res = await sb.from('report_signatures').select('*').order('signed_at', { ascending: false }).limit(20);
  var sigs = res.data || [];
  if (!sigs.length) { container.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">Aucune signature enregistrée</div>'; return; }
  container.innerHTML = sigs.map(function(s) {
    var d = new Date(s.signed_at).toLocaleString('fr-FR');
    return '<div class="sig-log-row" style="margin-bottom:8px">'
      + '<div style="display:flex;justify-content:space-between;align-items:center">'
      + '<span style="font-weight:700">' + escapeHtml(s.responsable||s.email||'—') + '</span>'
      + '<span style="font-family:monospace;font-size:10px;background:rgba(30,58,95,.5);color:#93C5FD;padding:2px 6px;border-radius:4px">' + escapeHtml(s.sig_id||'—') + '</span>'
      + '</div>'
      + '<div style="color:var(--muted);margin-top:3px">' + escapeHtml(s.report_type||'') + ' · ' + escapeHtml(s.report_num||'') + ' · ' + d + '</div>'
      + '</div>';
  }).join('');
}


// ══════════════════════════════════════════════════════════════════
// 🎭 SIMULATEUR / IMPERSONATION — Admin
// ══════════════════════════════════════════════════════════════════

var _adminBackupProfile = null;
var _adminBackupUser    = null;
var _impersonateMode    = false;
var _impersonateTimer   = null;
var _impersonateSeconds = 0;
var _impersonateLog     = [];
var _impersonateDebounce= null;

// ── Données de démo pour chaque rôle ───────────────────────────
var DEMO_PROFILES = {
  worker: {
    id: 'demo-worker-001',
    role: 'worker',
    full_name: 'Jean Dupont (Démo)',
    email: 'jean.dupont@demo.safetysphere.fr',
    org_id: 'demo-org-company',
    theme: 'dark',
    dashboard_layout: null,
    _demo: true
  },
  company: {
    id: 'demo-company-001',
    role: 'company',
    full_name: 'Marie Lefebvre (Démo)',
    email: 'marie.lefebvre@industrie-nord.demo',
    org_id: 'demo-org-company',
    org_name: 'Industrie Nord SAS',
    theme: 'dark',
    dashboard_layout: null,
    _demo: true
  },
  hse: {
    id: 'demo-hse-001',
    role: 'hse',
    full_name: 'Pierre Martin (Démo)',
    email: 'p.martin@securite-pro.demo',
    org_id: 'demo-org-hse',
    org_name: 'Sécurité Pro Conseil',
    theme: 'dark',
    dashboard_layout: null,
    _demo: true
  },
  subcontractor: {
    id: 'demo-st-001',
    role: 'subcontractor',
    full_name: 'Sophie Bernard (Démo)',
    email: 'sophie.bernard@electro-services.demo',
    org_id: 'demo-org-st',
    org_name: 'Électro Services SARL',
    theme: 'dark',
    dashboard_layout: null,
    _demo: true
  },
  trainer: {
    id: 'demo-trainer-001',
    role: 'trainer',
    full_name: 'Luc Fontaine (Démo)',
    email: 'l.fontaine@cfe-formation.demo',
    org_id: 'demo-org-trainer',
    org_name: 'CFE Formation Industrielle',
    theme: 'light',
    dashboard_layout: null,
    _demo: true
  },
  guest: {
    id: 'demo-guest-001',
    role: 'guest',
    full_name: 'Auditeur Externe (Démo)',
    email: 'auditeur@client-externe.demo',
    org_id: null,
    theme: 'dark',
    dashboard_layout: null,
    _demo: true
  }
};

var DEMO_ROLE_META = {
  worker:        { icon:'👷', label:'Intervenant',      color:'#22C55E', desc:'Habilitations, badge QR, documents partagés' },
  company:       { icon:'🏢', label:'Entreprise EU',    color:'#3B82F6', desc:'Intervenants, sous-traitants, conformité' },
  hse:           { icon:'🦺', label:'HSE / QHSE',       color:'#F97316', desc:'Tableau de bord HSE, DUER, VGP, FDS, PdP' },
  subcontractor: { icon:'🤝', label:'Sous-Traitant',    color:'#A855F7', desc:'Missions EU, documents reçus, équipes' },
  trainer:       { icon:'🎓', label:'Centre Formation', color:'#14B8A6', desc:'Demandes de validation, historique certifications' },
  guest:         { icon:'👁', label:'Client / Invité',  color:'#64748B', desc:'Documents reçus en lecture seule' }
};

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

// ══ NAVIGATION MODALE SIGNATURE ══════════════════════════════

function goToStep(n) {
  [0,1,2,3,4,5].forEach(function(i) {
    var el = document.getElementById('sigOtpStep' + i);
    if (el) el.style.display = (i === n ? '' : 'none');
  });
}

function chooseSignatureMode(mode) {
  if (mode === 'otp') {
    document.getElementById('sigOtpRequestBtn').disabled = false;
    document.getElementById('sigOtpRequestBtn').textContent = '📧 Envoyer le code de vérification';
    goToStep(1);
  } else {
    goToStep(4);
  }
}

// ── Télécharger le rapport vierge (sans cachet) pour impression ──
function downloadUnsignedReport() {
  if (!_sigContext) return;
  var html, title;
  if (_sigContext.reportType === 'DUER' && _sigContext._entries) {
    html  = buildDuerHTML(_sigContext._entries, _sigContext.meta, buildManualSignatureBlockHTML());
    title = 'DUER';
  } else if (_sigContext.reportType === 'VGP' && _sigContext._records) {
    html  = buildVgpHTML(_sigContext._records, _sigContext.meta, buildManualSignatureBlockHTML());
    title = 'VGP';
  } else {
    showToast('Données rapport non disponibles', 'error'); return;
  }
  // Télécharger directement en HTML (le navigateur peut l'imprimer en PDF)
  var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = title + '-' + _sigContext.reportNum + '-A-SIGNER.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function() { URL.revokeObjectURL(url); }, 5000);
  showToast('Document téléchargé — imprimez et signez', 'success');
}

// Bloc réservé pour signature manuscrite (bas de rapport)
function buildManualSignatureBlockHTML() {
  return '<div style="margin-top:24px;border:2px dashed #D1D5DB;border-radius:10px;padding:20px;page-break-inside:avoid">'
    + '<div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px">Signature manuscrite</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px">'
    + sigLineHTML('Établi par')
    + sigLineHTML('Vérifié par')
    + sigLineHTML('Date')
    + '</div>'
    + '<div style="margin-top:16px;height:60px;border-bottom:1px solid #9CA3AF;position:relative">'
    + '<span style="position:absolute;bottom:6px;left:0;font-size:10px;color:#9CA3AF">Signature</span></div>'
    + '</div>';
}
function sigLineHTML(label) {
  return '<div><div style="font-size:9px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:.5px;margin-bottom:20px">'+label+'</div>'
    + '<div style="border-bottom:1px solid #9CA3AF;height:24px"></div></div>';
}

// ── Upload scan signé ─────────────────────────────────────────
var _manualSigFile = null;

function onManualSigFileChange(input) {
  _manualSigFile = input.files[0] || null;
  var dropText = document.getElementById('manualSigDropText');
  var uploadBtn = document.getElementById('manualSigUploadBtn');
  if (dropText) dropText.textContent = _manualSigFile ? _manualSigFile.name : 'Cliquez pour sélectionner';
  if (uploadBtn) uploadBtn.disabled = !_manualSigFile;
}

async function uploadManualSignature() {
  if (!_manualSigFile || !_sigContext) return;
  var btn = document.getElementById('manualSigUploadBtn');
  btn.disabled = true; btn.textContent = '⏳ Archivage...';

  var pad     = function(n){ return String(n).padStart(2,'0'); };
  var now     = new Date();
  var sigId   = 'SIG-MAN-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  var filePath = currentProfile.org_id + '/' + sigId + '-' + _manualSigFile.name;

  var fileUrl = null;
  var upRes = await sb.storage.from('rapport-archives').upload(filePath, _manualSigFile, { upsert: true });
  if (!upRes.error) {
    var signed = await sb.storage.from('rapport-archives').createSignedUrl(filePath, 60 * 60 * 24 * 365);
    if (!signed.error) fileUrl = signed.data.signedUrl;
  }

  // Enregistrer en base
  var sigEntry = {
    org_id      : currentProfile.org_id,
    user_id     : currentUser.id,
    responsable : currentProfile.full_name || currentProfile.email,
    email       : currentProfile.email,
    report_num  : _sigContext.reportNum,
    report_type : _sigContext.reportType,
    sig_id      : sigId,
    method      : 'manuscrite_scannee',
    signed_at   : now.toISOString(),
  };
  await sb.from('report_signatures').insert(sigEntry);

  // Archiver aussi le fichier dans report_archive
  if (fileUrl) {
    await sb.from('report_archive').insert({
      org_id       : currentProfile.org_id,
      created_by   : currentUser.id,
      responsable  : currentProfile.full_name || currentProfile.email,
      email        : currentProfile.email || '',
      report_num   : sigId,
      report_type  : _sigContext.reportType,
      label        : _sigContext.reportType + ' — signature manuscrite scannée',
      source       : 'manuscrit',
      generated_at : now.toISOString(),
      file_url     : fileUrl,
    });
  }

  var sigDate = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  var sigTime = pad(now.getHours()) + 'h' + pad(now.getMinutes());
  document.getElementById('sigManualSuccessDetail').innerHTML =
    'Réf. : <strong>' + sigId + '</strong><br>'
    + sigDate + ' à ' + sigTime + '<br>'
    + '<span style="color:var(--muted)">Conservé dans l\'historique · Méthode : manuscrite scannée</span>';

  _manualSigFile = null;
  goToStep(5);
  showToast('✓ Document signé archivé', 'success');
}



// ══════════════════════════════════════════════════════════════════════════════
// WORKFLOW SIGNATURE V2 — Parallèle / Séquentiel configurable par type de doc
// ══════════════════════════════════════════════════════════════════════════════

// ── Config workflow par type doc (chargée depuis doc_workflow_config) ──
var _workflowConfig = {}; // { 'DUER': 'parallel', 'VGP': 'parallel', 'PDP': 'sequential', ... }

async function loadWorkflowConfig() {
  var r = await sb.from('doc_workflow_config').select('doc_type, mode');
  if (r.data) {
    r.data.forEach(function(row) { _workflowConfig[row.doc_type] = row.mode; });
  }
}

function getWorkflowMode(docType) {
  return _workflowConfig[docType] || 'parallel';
}

// ── Ouvrir modale envoi — V2 avec mode auto depuis config ──────────────────
function openSendForSignatureModal(archiveId, reportNum, reportType, reportHtml, meta) {
  _sigReqContext = {
    archiveId  : archiveId,
    reportNum  : reportNum,
    reportType : reportType,
    reportHtml : reportHtml,
    meta       : meta
  };
  _sigReqSigners = [];

  // Pré-remplir émetteur
  if (currentProfile) {
    _sigReqSigners.push({
      name : currentProfile.full_name || currentProfile.email,
      email: currentProfile.email,
      role : 'Émetteur'
    });
  }

  // Appliquer le mode configuré
  var mode = getWorkflowMode(reportType);
  var sel  = document.getElementById('sigReqModeSelect');
  if (sel) sel.value = mode;
  toggleSeqHelp(mode);

  // Afficher le type de doc dans le titre
  var subtitle = document.getElementById('sigReqSubtitle');
  if (subtitle) subtitle.textContent = 'Document : ' + (reportType || '—') + ' · Mode : ' + (mode === 'sequential' ? 'Séquentiel' : 'Parallèle');

  loadOrgMembersForSigReq();
  renderSignersList();
  document.getElementById('sigReqModal').classList.add('open');
}

// ── Afficher/masquer l'aide mode séquentiel ──
function toggleSeqHelp(mode) {
  var help = document.getElementById('sigReqSeqHelp');
  if (help) help.style.display = mode === 'sequential' ? '' : 'none';
  var subtitle = document.getElementById('sigReqSubtitle');
  if (subtitle && _sigReqContext) {
    subtitle.textContent = 'Document : ' + (_sigReqContext.reportType || '—')
      + ' · Mode : ' + (mode === 'sequential' ? '🔗 Séquentiel' : '⚡ Parallèle');
  }
}

// ── Rendre la liste des signataires avec ordre drag ──────────────────────────
function renderSignersList() {
  var list = document.getElementById('sigReqSignersList');
  var countEl = document.getElementById('sigReqCount');
  if (countEl) countEl.textContent = _sigReqSigners.length;
  if (!list) return;

  var mode = (document.getElementById('sigReqModeSelect') || {}).value || 'parallel';

  if (!_sigReqSigners.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;text-align:center">Aucun signataire ajouté.</div>';
    return;
  }

  list.innerHTML = _sigReqSigners.map(function(s, i) {
    var isFirst = i === 0;
    var isLast  = i === _sigReqSigners.length - 1;
    return '<div id="signerRow_' + i + '" style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:10px;margin-bottom:8px;transition:opacity .15s">'
      + (mode === 'sequential'
          ? '<div style="min-width:22px;height:22px;background:#F97316;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex-shrink:0">' + (i+1) + '</div>'
          : '<div style="font-size:18px;flex-shrink:0">👤</div>')
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(s.name) + '</div>'
      + '<div style="font-size:11px;color:var(--muted)">' + escapeHtml(s.email) + ' · <em>' + escapeHtml(s.role) + '</em></div>'
      + '</div>'
      + (mode === 'sequential' ? '<div style="display:flex;flex-direction:column;gap:2px">'
          + '<button onclick="moveSigner(' + i + ',-1)" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:1px 4px;' + (isFirst ? 'opacity:.2;pointer-events:none' : '') + '">▲</button>'
          + '<button onclick="moveSigner(' + i + ',1)"  style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:12px;padding:1px 4px;' + (isLast  ? 'opacity:.2;pointer-events:none' : '') + '">▼</button>'
          + '</div>' : '')
      + '<button onclick="removeSigner(' + i + ')" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0 4px" title="Retirer">✕</button>'
      + '</div>';
  }).join('');
}

function moveSigner(idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= _sigReqSigners.length) return;
  var tmp = _sigReqSigners[idx];
  _sigReqSigners[idx]    = _sigReqSigners[newIdx];
  _sigReqSigners[newIdx] = tmp;
  renderSignersList();
}

// ── Envoyer la demande V2 ────────────────────────────────────────────────────
async function sendSignatureRequest() {
  if (!_sigReqContext) return;
  if (_sigReqSigners.length < 1) { showToast('Ajoutez au moins un signataire', 'error'); return; }

  var mode = (document.getElementById('sigReqModeSelect') || {}).value || 'parallel';
  var btn  = document.getElementById('sigReqSendBtn');
  btn.disabled = true; btn.textContent = '⏳ Envoi en cours...';

  // 1. Créer la demande parente
  var reqRes = await sb.from('signature_requests').insert({
    org_id        : currentProfile.org_id,
    archive_id    : _sigReqContext.archiveId || null,
    created_by    : currentUser.id,
    report_num    : _sigReqContext.reportNum,
    report_type   : _sigReqContext.reportType,
    report_html   : _sigReqContext.reportHtml || null,
    workflow_mode : mode,
    status        : 'pending',
    total_signers : _sigReqSigners.length,
    signed_count  : 0,
  }).select().single();

  if (reqRes.error) {
    showToast('Erreur : ' + reqRes.error.message, 'error');
    btn.disabled = false; btn.textContent = '✉️ Envoyer les demandes';
    return;
  }

  var requestId = reqRes.data.id;

  // 2. Créer les items signataires
  var items = _sigReqSigners.map(function(s, i) {
    return {
      request_id  : requestId,
      org_id      : currentProfile.org_id,
      signer_name : s.name,
      signer_email: s.email,
      signer_role : s.role,
      status      : (mode === 'sequential' && i > 0) ? 'waiting' : 'pending',
      seq         : i,
      token       : 'SGR-' + requestId.slice(-6).toUpperCase() + '-' + String(i).padStart(2,'0'),
    };
  });

  var itemsRes = await sb.from('signature_request_items').insert(items).select();
  if (itemsRes.error) {
    showToast('Erreur items : ' + itemsRes.error.message, 'error');
    btn.disabled = false; btn.textContent = '✉️ Envoyer les demandes';
    return;
  }

  // 3. Notifier par email : en parallèle → tous, en séquentiel → seulement le 1er
  var toNotify = mode === 'sequential'
    ? [{ signer: _sigReqSigners[0], item: itemsRes.data.find(function(it) { return it.signer_email === _sigReqSigners[0].email; }), pos: 1 }]
    : _sigReqSigners.map(function(s, i) { return { signer: s, item: itemsRes.data.find(function(it) { return it.signer_email === s.email; }), pos: i+1 }; });

  var emailsSent = 0;
  for (var ni = 0; ni < toNotify.length; ni++) {
    var entry    = toNotify[ni];
    var s        = entry.signer;
    var item     = entry.item;
    if (!item) continue;
    var sigUrl   = window.location.origin + window.location.pathname + '?sign=' + item.token;
    var emitter  = currentProfile.full_name || currentProfile.email;
    var posLabel = (mode === 'sequential') ? ' (étape ' + entry.pos + '/' + _sigReqSigners.length + ')' : '';

    // Tentative via Edge Function (si déployée)
    var edgeSent = false;
    try {
      var edgeRes = await sb.functions.invoke('send-signature-email', {
        body: {
          to           : s.email,
          signer_name  : s.name,
          signer_role  : s.role,
          emitter_name : emitter,
          report_num   : _sigReqContext.reportNum,
          report_type  : _sigReqContext.reportType,
          workflow_mode: mode,
          position     : posLabel,
          sig_url      : sigUrl,
        }
      });
      if (!edgeRes.error) edgeSent = true;
    } catch(e) { /* Edge Function non déployée — fallback */ }

    // Fallback : Magic Link Supabase (fonctionne si le destinataire a un compte)
    if (!edgeSent) {
      await sb.auth.signInWithOtp({
        email  : s.email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo : sigUrl,
          data: {
            sig_token    : item.token,
            report_num   : _sigReqContext.reportNum,
            signer_name  : s.name,
            emitter_name : emitter,
          }
        }
      }).catch(function(){});
    }
    emailsSent++;
  }

  // 4. Mettre à jour l'archive
  if (_sigReqContext.archiveId) {
    await sb.from('report_archive').update({
      sig_status    : 'pending',
      sig_request_id: requestId,
      sig_total     : _sigReqSigners.length,
      sig_signed    : 0,
    }).eq('id', _sigReqContext.archiveId);
  }

  btn.disabled = false; btn.textContent = '✉️ Envoyer les demandes';
  closeSendForSignatureModal();

  var modeLabel = mode === 'sequential' ? 'séquentiel' : 'parallèle';
  showToast('✓ Workflow ' + modeLabel + ' lancé · ' + emailsSent + ' email(s) envoyé(s)', 'success');
  if (typeof renderHistoriqueSection === 'function') renderHistoriqueSection(_conformRole);
}

// ── Gestion de la page publique de signature (token dans l'URL) ─────────────
async function checkPublicSignatureToken() {
  var params = new URLSearchParams(window.location.search);
  var token  = params.get('sign');
  if (!token) return;

  // Charger l'item correspondant
  var itemRes = await sb.from('signature_request_items')
    .select('*, signature_requests(report_num, report_type, report_html, workflow_mode, org_id, total_signers, signed_count, archive_id)')
    .eq('token', token)
    .single();

  if (itemRes.error || !itemRes.data) {
    showPublicSignError('Lien de signature invalide ou expiré.');
    return;
  }

  var item = itemRes.data;
  var req  = item.signature_requests;

  if (item.status === 'signed' || item.status === 'refused') {
    showPublicSignError('Ce document a déjà été traité (statut : ' + item.status + ').');
    return;
  }
  if (item.status === 'waiting') {
    showPublicSignError('Votre tour de signature n\'est pas encore arrivé. Vous recevrez un email dès que le(s) signataire(s) précédent(s) auront validé.');
    return;
  }

  // Afficher la page de signature publique
  openPublicSignPage(item, req, token);
}

function showPublicSignError(msg) {
  document.body.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0D1B2A;font-family:\'Segoe UI\',sans-serif">'
    + '<div style="max-width:480px;text-align:center;padding:40px 24px">'
    + '<div style="font-size:48px;margin-bottom:16px">⚠️</div>'
    + '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">Signature impossible</div>'
    + '<div style="font-size:14px;color:#94A3B8">' + msg + '</div>'
    + '</div></div>';
}

function openPublicSignPage(item, req, token) {
  // Remplacer le contenu de la page par la page de signature
  document.body.innerHTML = publicSignPageHTML(item, req, token);
}

function publicSignPageHTML(item, req, token) {
  return '<!DOCTYPE html>'
    + '<div style="min-height:100vh;background:#0D1B2A;font-family:\'Segoe UI\',sans-serif;display:flex;flex-direction:column">'
    // Bandeau
    + '<div style="background:linear-gradient(135deg,#0D1B2A,#1E3A5F);border-bottom:3px solid #F97316;padding:12px 24px;display:flex;align-items:center;gap:14px">'
    + '<div style="width:34px;height:34px;background:#F97316;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:14px">S</div>'
    + '<div><div style="font-weight:900;color:#fff;font-size:14px">Safety<span style="color:#F97316">Sphere</span></div><div style="font-size:10px;color:#94A3B8">Demande de signature électronique</div></div>'
    + '<div style="margin-left:auto;font-size:12px;color:#94A3B8">Réf. ' + escapeHtml(req.report_num || '') + '</div>'
    + '</div>'
    // Corps
    + '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px">'
    + '<div style="max-width:520px;width:100%">'
    // Info signataire
    + '<div style="background:rgba(30,58,95,.5);border:1px solid rgba(99,162,241,.2);border-radius:16px;padding:24px;margin-bottom:24px">'
    + '<div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:4px">Bonjour, ' + escapeHtml(item.signer_name) + ' 👋</div>'
    + '<div style="font-size:13px;color:#94A3B8;margin-bottom:16px">Vous êtes invité(e) à signer le document suivant :</div>'
    + '<div style="background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);border-radius:10px;padding:12px 16px;display:flex;align-items:center;gap:12px">'
    + '<div style="font-size:28px">' + (req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : '📄') + '</div>'
    + '<div><div style="font-size:13px;font-weight:700;color:#fff">' + escapeHtml(req.report_type) + ' — ' + escapeHtml(req.report_num) + '</div>'
    + '<div style="font-size:11px;color:#94A3B8">Votre rôle : ' + escapeHtml(item.signer_role) + '</div>'
    + (req.workflow_mode === 'sequential' ? '<div style="font-size:11px;color:#FCD34D;margin-top:2px">🔗 Workflow séquentiel — position ' + (item.seq+1) + '/' + req.total_signers + '</div>' : '')
    + '</div></div>'
    + '</div>'
    // Choix mode signature
    + '<div id="pubSignStep0">'
    + '<div style="font-size:13px;color:#94A3B8;margin-bottom:14px;text-align:center">Choisissez votre mode de signature :</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">'
    + '<button onclick="pubSignChoose(\'otp\',\'' + escapeHtml(token) + '\')" style="background:rgba(249,115,22,.08);border:2px solid rgba(249,115,22,.3);border-radius:14px;padding:20px;cursor:pointer;color:#fff;text-align:center" onmouseover="this.style.borderColor=\'#F97316\'" onmouseout="this.style.borderColor=\'rgba(249,115,22,.3)\'">'
    + '<div style="font-size:28px;margin-bottom:8px">📧</div><div style="font-size:13px;font-weight:700;margin-bottom:4px">Signature numérique</div><div style="font-size:11px;color:#94A3B8">Code OTP · eIDAS Niveau 1</div>'
    + '</button>'
    + '<button onclick="pubSignChoose(\'manual\',\'' + escapeHtml(token) + '\')" style="background:rgba(99,102,241,.08);border:2px solid rgba(99,102,241,.3);border-radius:14px;padding:20px;cursor:pointer;color:#fff;text-align:center" onmouseover="this.style.borderColor=\'#818CF8\'" onmouseout="this.style.borderColor=\'rgba(99,102,241,.3)\'">'
    + '<div style="font-size:28px;margin-bottom:8px">🖊️</div><div style="font-size:13px;font-weight:700;margin-bottom:4px">Signature manuscrite</div><div style="font-size:11px;color:#94A3B8">Imprimer · signer · scanner</div>'
    + '</button>'
    + '</div>'
    + '<button onclick="pubSignRefuse(\'' + escapeHtml(token) + '\')" style="background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer;text-decoration:underline;display:block;margin:0 auto">Refuser de signer</button>'
    + '</div>'
    // OTP steps (cachés)
    + '<div id="pubSignStepOtp" style="display:none">'
    + '<div style="background:rgba(30,58,95,.5);border:1px solid rgba(99,162,241,.2);border-radius:12px;padding:20px;margin-bottom:16px;text-align:center">'
    + '<div style="font-size:13px;color:#94A3B8;margin-bottom:6px">Code de vérification envoyé à</div>'
    + '<div style="font-size:15px;font-weight:700;color:#fff" id="pubSignEmailDisplay">' + escapeHtml(item.signer_email) + '</div>'
    + '</div>'
    + '<div style="font-size:12px;color:#94A3B8;text-align:center;margin-bottom:16px">Saisissez le code à 8 chiffres reçu par email.</div>'
    + '<div style="display:flex;gap:6px;justify-content:center;margin-bottom:20px">'
    + [1,2,3,4,5,6,7,8].map(function(n) {
        var prev = n>1 ? 'pubD'+(n-1) : null;
        var next = n<8 ? 'pubD'+(n+1) : null;
        return '<input type="text" id="pubD' + n + '" maxlength="1" style="width:36px;height:44px;background:rgba(30,58,95,.7);border:2px solid rgba(99,162,241,.3);border-radius:8px;color:#fff;font-size:20px;font-weight:700;text-align:center" oninput="otpDigitInput(this,\'' + (next||'') + '\')" onkeydown="otpDigitBack(event,this,\'' + (prev||'') + '\')">';
      }).join('')
    + '</div>'
    + '<button onclick="pubSignVerifyOtp(\'' + escapeHtml(token) + '\')" style="width:100%;padding:13px;background:#F97316;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer">✓ Confirmer la signature</button>'
    + '<button onclick="pubSignSendOtp(\'' + escapeHtml(item.signer_email) + '\')" style="background:none;border:none;color:#94A3B8;font-size:12px;cursor:pointer;text-decoration:underline;display:block;margin:12px auto 0">↩ Renvoyer le code</button>'
    + '</div>'
    // Manuscrit step
    + '<div id="pubSignStepManual" style="display:none">'
    + '<div style="background:rgba(30,58,95,.5);border:1px solid rgba(99,162,241,.2);border-radius:12px;padding:20px;margin-bottom:16px">'
    + '<div style="font-size:12px;color:#94A3B8;margin-bottom:12px">Procédure :</div>'
    + '<div style="display:flex;flex-direction:column;gap:8px">'
    + '<div style="display:flex;gap:10px;align-items:flex-start"><div style="min-width:22px;height:22px;background:#6366F1;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">1</div><span style="font-size:12px;color:#CBD5E1">Téléchargez et imprimez le document</span></div>'
    + '<div style="display:flex;gap:10px;align-items:flex-start"><div style="min-width:22px;height:22px;background:#6366F1;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">2</div><span style="font-size:12px;color:#CBD5E1">Apposez votre signature manuscrite</span></div>'
    + '<div style="display:flex;gap:10px;align-items:flex-start"><div style="min-width:22px;height:22px;background:#6366F1;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">3</div><span style="font-size:12px;color:#CBD5E1">Scannez et téléversez ci-dessous</span></div>'
    + '</div>'
    + '</div>'
    + '<button onclick="pubSignDownloadDoc()" style="width:100%;padding:11px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:#A5B4FC;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:14px">🖨️ Télécharger le document</button>'
    + '<input type="file" id="pubScanFile" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="pubScanFileChange(this)">'
    + '<div onclick="document.getElementById(\'pubScanFile\').click()" style="border:2px dashed rgba(99,102,241,.3);border-radius:10px;padding:18px;text-align:center;cursor:pointer;color:#A5B4FC;font-size:13px;margin-bottom:12px" id="pubScanDropZone">📎 Cliquez pour sélectionner le scan signé</div>'
    + '<button onclick="pubSignUploadScan(\'' + escapeHtml(token) + '\')" id="pubScanBtn" style="width:100%;padding:13px;background:#6366F1;border:none;border-radius:10px;color:#fff;font-weight:700;font-size:14px;cursor:pointer" disabled>📤 Soumettre le scan signé</button>'
    + '</div>'
    // Succès
    + '<div id="pubSignSuccess" style="display:none;text-align:center">'
    + '<div style="font-size:60px;margin-bottom:16px">✅</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:8px">Signature enregistrée !</div>'
    + '<div style="font-size:13px;color:#94A3B8" id="pubSignSuccessDetail">—</div>'
    + '</div>'
    + '</div></div></div>';
}

// ── Fonctions côté page publique ─────────────────────────────────────────────
var _pubSignToken   = null;
var _pubSignReqHtml = null;
var _pubScanFile    = null;

async function pubSignChoose(mode, token) {
  _pubSignToken = token;
  document.getElementById('pubSignStep0').style.display    = 'none';
  document.getElementById('pubSignStepOtp').style.display  = 'none';
  document.getElementById('pubSignStepManual').style.display = 'none';

  if (mode === 'otp') {
    // Charger l'email et envoyer OTP
    var itemRes = await sb.from('signature_request_items').select('signer_email').eq('token', token).single();
    if (itemRes.data) {
      var email = itemRes.data.signer_email;
      document.getElementById('pubSignEmailDisplay').textContent = email;
      await pubSignSendOtp(email);
    }
    document.getElementById('pubSignStepOtp').style.display = '';
  } else {
    // Charger le HTML du rapport pour téléchargement
    var reqRes = await sb.from('signature_request_items')
      .select('signature_requests(report_html, report_num)')
      .eq('token', token).single();
    if (reqRes.data) _pubSignReqHtml = reqRes.data.signature_requests.report_html;
    document.getElementById('pubSignStepManual').style.display = '';
  }
}

async function pubSignSendOtp(email) {
  await sb.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: null } });
}

async function pubSignVerifyOtp(token) {
  var code = [1,2,3,4,5,6,7,8].map(function(n) { var el = document.getElementById('pubD'+n); return el ? el.value : ''; }).join('');
  if (code.length !== 8) { alert('Saisissez le code complet à 8 chiffres'); return; }

  var btn = document.querySelector('#pubSignStepOtp button');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

  // Récupérer l'email de l'item
  var itemRes = await sb.from('signature_request_items').select('signer_email, signer_name, signer_role, request_id, seq, id').eq('token', token).single();
  if (itemRes.error) { alert('Erreur : ' + itemRes.error.message); return; }

  var item = itemRes.data;
  var verif = await sb.auth.verifyOtp({ email: item.signer_email, token: code, type: 'email' });
  if (verif.error) { alert('Code invalide ou expiré. Veuillez recommencer.'); if (btn) { btn.disabled = false; btn.textContent = '✓ Confirmer'; } return; }

  await pubSignRecord(token, item, 'otp_email', null);
}

function pubSignDownloadDoc() {
  if (!_pubSignReqHtml) { alert('Document non disponible. Contactez l\'émetteur.'); return; }
  var blob = new Blob([_pubSignReqHtml], { type:'text/html;charset=utf-8' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'document-a-signer.html'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function pubScanFileChange(input) {
  _pubScanFile = input.files[0] || null;
  var dz  = document.getElementById('pubScanDropZone');
  var btn = document.getElementById('pubScanBtn');
  if (dz)  dz.textContent  = _pubScanFile ? '✓ ' + _pubScanFile.name : '📎 Cliquez pour sélectionner';
  if (btn) btn.disabled = !_pubScanFile;
}

async function pubSignUploadScan(token) {
  if (!_pubScanFile) return;
  var btn = document.getElementById('pubScanBtn');
  btn.disabled = true; btn.textContent = '⏳ Téléversement...';

  var itemRes = await sb.from('signature_request_items').select('signer_email, signer_name, signer_role, request_id, seq, id, org_id').eq('token', token).single();
  if (itemRes.error) { alert('Erreur'); return; }
  var item = itemRes.data;

  var pad  = function(n){ return String(n).padStart(2,'0'); };
  var now  = new Date();
  var path = (item.org_id || 'pub') + '/pub-scans/' + token + '-' + now.getTime() + '-' + _pubScanFile.name;
  var up   = await sb.storage.from('rapport-archives').upload(path, _pubScanFile, { upsert: true });

  var fileUrl = null;
  if (!up.error) {
    var s = await sb.storage.from('rapport-archives').createSignedUrl(path, 60*60*24*365);
    if (!s.error) fileUrl = s.data.signedUrl;
  }

  await pubSignRecord(token, item, 'manuscrite_scannee', fileUrl);
}

async function pubSignRecord(token, item, method, fileUrl) {
  var now = new Date();
  var pad = function(n){ return String(n).padStart(2,'0'); };
  var sigId = 'SIG-PUB-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());

  // Mettre à jour l'item
  await sb.from('signature_request_items').update({
    status   : 'signed',
    method   : method,
    signed_at: now.toISOString(),
    file_url : fileUrl,
    sig_id   : sigId,
  }).eq('id', item.id);

  // Incrémenter signed_count dans la demande parente
  var reqRes = await sb.from('signature_requests').select('signed_count, total_signers, workflow_mode, org_id, archive_id, report_html, report_type, report_num').eq('id', item.request_id).single();
  if (!reqRes.error) {
    var req      = reqRes.data;
    var newCount = (req.signed_count || 0) + 1;
    var allDone  = newCount >= req.total_signers;

    await sb.from('signature_requests').update({ signed_count: newCount, status: allDone ? 'completed' : 'pending' }).eq('id', item.request_id);

    // Mettre à jour l'archive
    if (req.archive_id) {
      await sb.from('report_archive').update({
        sig_signed: newCount,
        sig_status: allDone ? 'signed_all' : (method === 'otp_email' ? 'signed_digital' : 'signed_manual'),
      }).eq('id', req.archive_id);
    }

    // Séquentiel : notifier le suivant
    if (!allDone && req.workflow_mode === 'sequential') {
      var nextRes = await sb.from('signature_request_items')
        .select('*').eq('request_id', item.request_id).eq('seq', item.seq + 1).single();
      if (!nextRes.error && nextRes.data) {
        await sb.from('signature_request_items').update({ status: 'pending' }).eq('id', nextRes.data.id);
        var sigUrl = window.location.origin + window.location.pathname + '?sign=' + nextRes.data.token;
        await sb.auth.signInWithOtp({
          email  : nextRes.data.signer_email,
          options: { shouldCreateUser: false, emailRedirectTo: sigUrl, data: { is_next_in_sequence: true } }
        });
      }
    }

    // Si tous signés → générer le document consolidé
    if (allDone && req.archive_id) {
      await generateConsolidatedDocument(item.request_id, req);
    }
  }

  // Afficher succès
  var sigDate = now.toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
  var sigTime = pad(now.getHours()) + 'h' + pad(now.getMinutes());
  ['pubSignStep0','pubSignStepOtp','pubSignStepManual'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var succ = document.getElementById('pubSignSuccess'); if (succ) succ.style.display = '';
  var det  = document.getElementById('pubSignSuccessDetail');
  if (det) det.innerHTML = 'Réf. : <strong>' + sigId + '</strong><br>' + sigDate + ' à ' + sigTime + '<br><span style="color:#94A3B8">Méthode : ' + (method === 'otp_email' ? 'Numérique OTP email' : 'Manuscrite scannée') + '</span>';
}

async function pubSignRefuse(token) {
  if (!confirm('Êtes-vous sûr de vouloir refuser de signer ce document ?')) return;
  await sb.from('signature_request_items').update({ status: 'refused', signed_at: new Date().toISOString() }).eq('token', token);
  // Notifier l'émetteur via le statut de la demande
  var itemRes = await sb.from('signature_request_items').select('request_id').eq('token', token).single();
  if (!itemRes.error) {
    await sb.from('signature_requests').update({ status: 'refused' }).eq('id', itemRes.data.request_id);
  }
  document.getElementById('pubSignStep0').style.display = 'none';
  var succ = document.getElementById('pubSignSuccess'); if (succ) succ.style.display = '';
  var det  = document.getElementById('pubSignSuccessDetail');
  if (det) det.innerHTML = 'Vous avez refusé de signer. L\'émetteur du document a été notifié.';
}

// ── Générer le document consolidé final ─────────────────────────────────────
async function generateConsolidatedDocument(requestId, req) {
  // Récupérer tous les items signés dans l'ordre
  var itemsRes = await sb.from('signature_request_items')
    .select('*').eq('request_id', requestId).order('seq');
  if (itemsRes.error || !itemsRes.data) return;

  var items = itemsRes.data;
  var now   = new Date();
  var pad   = function(n){ return String(n).padStart(2,'0'); };

  // Construire le bloc consolidé de tous les cachets
  var allStamps = items.map(function(item) {
    if (item.status !== 'signed') return '';
    var sigDate = new Date(item.signed_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
    var sigTime = new Date(item.signed_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    var methodLabel = item.method === 'otp_email' ? 'OTP Email · eIDAS Niveau 1' : 'Manuscrite scannée';

    if (item.method === 'manuscrite_scannee' && item.file_url) {
      return '<div style="border:1px solid #D1D5DB;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#F9FAFB">'
        + '<div style="font-size:9px;font-weight:900;color:#6B7280;letter-spacing:2px;margin-bottom:8px">🖊️ SIGNATURE MANUSCRITE — ' + escapeHtml(item.signer_role.toUpperCase()) + '</div>'
        + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#9CA3AF;width:80px">Signataire</span><span style="font-size:11px;font-weight:600">' + escapeHtml(item.signer_name) + '</span></div>'
        + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#9CA3AF;width:80px">Date</span><span style="font-size:11px;font-weight:600">' + sigDate + ' à ' + sigTime + '</span></div>'
        + '<div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:9px;color:#9CA3AF;width:80px">Scan</span><a href="' + item.file_url + '" style="font-size:11px;color:#2563EB">📎 Voir le scan</a></div>'
        + '</div>';
    }

    return '<div style="border:2px solid #1E3A5F;border-radius:8px;padding:12px 16px;margin-bottom:10px;background:#F0F4FF;position:relative">'
      + '<div style="position:absolute;top:-9px;left:12px;background:#fff;padding:0 6px;font-size:9px;font-weight:900;color:#1E3A5F;letter-spacing:1.5px">SIGNÉ ÉLECTRONIQUEMENT — ' + escapeHtml(item.signer_role.toUpperCase()) + '</div>'
      + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#6B7280;width:80px">Signataire</span><span style="font-size:11px;font-weight:600;color:#111827">' + escapeHtml(item.signer_name) + '</span></div>'
      + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#6B7280;width:80px">Email</span><span style="font-size:11px;color:#374151">' + escapeHtml(item.signer_email) + '</span></div>'
      + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#6B7280;width:80px">Date</span><span style="font-size:11px;font-weight:600;color:#111827">' + sigDate + ' à ' + sigTime + '</span></div>'
      + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px"><span style="font-size:9px;color:#6B7280;width:80px">Réf.</span><span style="font-family:monospace;font-size:10px;background:#1E3A5F;color:#fff;padding:2px 6px;border-radius:3px">' + escapeHtml(item.sig_id || '—') + '</span></div>'
      + '<div style="display:flex;gap:8px;align-items:baseline"><span style="font-size:9px;color:#6B7280;width:80px">Méthode</span><span style="font-size:10px;background:#DCFCE7;border:1px solid #86EFAC;border-radius:4px;padding:1px 6px;color:#166534;font-weight:700">' + methodLabel + '</span></div>'
      + '</div>';
  }).join('');

  // Injecter dans le rapport HTML original
  var baseHtml = req.report_html || '';
  var consolidatedHtml = baseHtml.replace(
    /<\/body>/,
    '<div style="page-break-before:auto;margin-top:24px">'
    + '<div style="font-size:11px;font-weight:900;color:#1E3A5F;letter-spacing:1.5px;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #1E3A5F">DOCUMENT MULTI-SIGNATAIRES CONSOLIDÉ · ' + items.length + ' SIGNATURE(S)</div>'
    + allStamps
    + '</div></body>'
  );

  // Uploader dans le storage
  var consolidatedNum = 'CONSOL-' + req.report_num + '-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate());
  var path   = req.org_id + '/consolidated/' + consolidatedNum + '.html';
  var blob   = new Blob([consolidatedHtml], { type: 'text/html;charset=utf-8' });
  var upRes  = await sb.storage.from('rapport-archives').upload(path, blob, { upsert: true });

  var fileUrl = null;
  if (!upRes.error) {
    var signed = await sb.storage.from('rapport-archives').createSignedUrl(path, 60*60*24*365);
    if (!signed.error) fileUrl = signed.data.signedUrl;
  }

  // Archiver le document consolidé comme entrée fille
  await sb.from('report_archive').insert({
    org_id       : req.org_id,
    report_num   : consolidatedNum,
    report_type  : req.report_type,
    label        : req.report_type + ' — Document consolidé multi-signataires',
    source       : 'safetysphere',
    file_url     : fileUrl,
    sig_status   : 'signed_all',
    parent_id    : req.archive_id,
    generated_at : now.toISOString(),
  });

  // Mettre à jour l'archive parent
  await sb.from('report_archive').update({
    signed_file_url: fileUrl,
    sig_status     : 'signed_all',
  }).eq('id', req.archive_id);
}

// ── Admin — Config workflow par type de doc ───────────────────────────────────
async function renderAdminWorkflowConfig() {
  var ctn = document.getElementById('adminWorkflowConfigPanel');
  if (!ctn) return;
  ctn.innerHTML = '<div style="font-size:12px;color:var(--muted)">Chargement...</div>';

  await loadWorkflowConfig();

  var docTypes = ['DUER', 'VGP', 'FDS', 'PDP', 'Autre'];
  var html = '<div style="margin-bottom:16px"><div class="section-title" style="margin:0 0 4px">Workflow de signature par type de document</div>'
    + '<div style="font-size:12px;color:var(--muted)">Définit si les signataires reçoivent la demande en même temps (parallèle) ou dans l\'ordre défini (séquentiel).</div></div>';

  html += '<div style="display:flex;flex-direction:column;gap:10px">'
    + docTypes.map(function(dt) {
        var mode = _workflowConfig[dt] || 'parallel';
        return '<div style="display:flex;align-items:center;gap:16px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:12px;padding:12px 16px">'
          + '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + dt + '</div>'
          + '<div style="font-size:11px;color:var(--muted)">' + (mode === 'sequential' ? '🔗 Séquentiel — chaque signataire attend le précédent' : '⚡ Parallèle — tous notifiés simultanément') + '</div></div>'
          + '<select onchange="saveWorkflowMode(\'' + dt + '\',this.value)" style="background:var(--input-bg);border:1px solid var(--inset-border);border-radius:8px;color:var(--white);padding:6px 10px;font-size:12px">'
          + '<option value="parallel"' + (mode==='parallel'?' selected':'') + '>⚡ Parallèle</option>'
          + '<option value="sequential"' + (mode==='sequential'?' selected':'') + '>🔗 Séquentiel</option>'
          + '</select></div>';
      }).join('')
    + '</div>';

  ctn.innerHTML = html;
}

async function saveWorkflowMode(docType, mode) {
  var r = await sb.from('doc_workflow_config').upsert({ doc_type: docType, mode: mode }, { onConflict: 'doc_type' });
  if (r.error) { showToast('Erreur : ' + r.error.message, 'error'); return; }
  _workflowConfig[docType] = mode;
  showToast('✓ ' + docType + ' → mode ' + mode, 'success');
  renderAdminWorkflowConfig();
}

// ── Hook au chargement de la page pour détecter token public ─────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', function() {
    checkPublicSignatureToken();
    loadWorkflowConfig();
  });
}



// ── Demandes de signature entrantes (section Documents reçus) ────────────────
// Clé localStorage pour la corbeille personnelle des items signés
function _sigHistTrashKey(email) { return 'ss_sig_hist_trash_' + btoa(email).replace(/=/g,''); }

async function renderIncomingSignatureRequests(containerId, email) {
  var ctn = document.getElementById(containerId);
  if (!ctn) return;

  // Charger TOUS les items de signature pour cet email (toutes statuts)
  var res = await sb.from('signature_request_items')
    .select('*, signature_requests(id, report_num, report_type, workflow_mode, total_signers, signed_count, org_id, created_by, created_at, archive_id, report_html, status)')
    .eq('signer_email', email)
    .order('id', { ascending: false });

  var items = res.data || [];

  // Corbeille personnelle (localStorage) — IDs d'items cachés
  var trashKey    = _sigHistTrashKey(email);
  var trashedIds  = [];
  var showTrash   = ctn.dataset.showTrash === '1';
  try { trashedIds = JSON.parse(localStorage.getItem(trashKey) || '[]'); } catch(e){}

  var pending  = items.filter(function(i) { return i.status === 'pending'  && trashedIds.indexOf(i.id) < 0; });
  var waiting  = items.filter(function(i) { return i.status === 'waiting'  && trashedIds.indexOf(i.id) < 0; });
  var signed   = items.filter(function(i) { return i.status === 'signed'   && trashedIds.indexOf(i.id) < 0; });
  var refused  = items.filter(function(i) { return i.status === 'refused'  && trashedIds.indexOf(i.id) < 0; });
  var trashed  = items.filter(function(i) { return trashedIds.indexOf(i.id) >= 0; });

  if (!items.length) { ctn.innerHTML = ''; return; }

  var html = '<div style="margin-bottom:24px">';

  // ── En-tête section ──
  var actionCount = pending.length;
  html += '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px">'
    + '<div style="font-size:11px;font-weight:900;color:#F97316;text-transform:uppercase;letter-spacing:1px;display:flex;align-items:center;gap:8px">'
    + '<span style="background:rgba(249,115,22,.15);border:1px solid rgba(249,115,22,.3);border-radius:6px;padding:2px 8px">✍️ Signatures'
    + (actionCount ? ' — ' + actionCount + ' action(s) requise(s)' : '')
    + '</span></div>'
    + '<button onclick="toggleSigHistTrash(\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:' + (showTrash ? 'rgba(239,68,68,.12)' : 'transparent') + ';border:1px solid rgba(239,68,68,.2);color:#FCA5A5;font-size:11px;padding:4px 10px;border-radius:8px;cursor:pointer;font-family:\'Barlow\',sans-serif">'
    + '🗑️ Corbeille' + (trashed.length ? ' (' + trashed.length + ')' : '') + '</button>'
    + '</div>';

  // ── Corbeille personnelle ──
  if (showTrash) {
    html += '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:12px;padding:14px;margin-bottom:14px">'
      + '<div style="font-size:12px;font-weight:700;color:#FCA5A5;margin-bottom:10px">🗑️ Historique masqué — restauration possible</div>';
    if (!trashed.length) {
      html += '<div style="font-size:12px;color:var(--muted)">Corbeille vide.</div>';
    } else {
      trashed.forEach(function(item) {
        var req = item.signature_requests || {};
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--inset-bg);border:1px solid var(--inset-border);border-radius:8px;margin-bottom:6px">'
          + '<span style="font-size:16px">' + (req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : '📄') + '</span>'
          + '<div style="flex:1;font-size:12px"><strong>' + escapeHtml(req.report_num || '—') + '</strong> · ' + escapeHtml(req.report_type || '') + '</div>'
          + '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(148,163,184,.12);color:var(--muted)">' + (item.status === 'signed' ? '✅ Signé' : item.status === 'refused' ? '❌ Refusé' : item.status) + '</span>'
          + '<button onclick="restoreSigHistItem(\'' + item.id + '\',\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:none;border:none;color:var(--success);font-size:11px;cursor:pointer;font-weight:700">↩ Restaurer</button>'
          + '</div>';
      });
    }
    html += '</div>';
  }

  // ── Cartes PENDING (action immédiate requise) ──
  if (pending.length) {
    pending.forEach(function(item) {
      var req      = item.signature_requests || {};
      var genDate  = req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      var modeLabel= req.workflow_mode === 'sequential' ? '🔗 Séquentiel' : '⚡ Parallèle';
      var progress = (req.signed_count || 0) + '/' + (req.total_signers || '?');
      var sigUrl   = window.location.pathname + '?sign=' + item.token;
      var tIcon    = req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : req.report_type === 'FDS' ? '⚗️' : '📄';

      var docBtn = '';
      if (req.archive_id) {
        docBtn = '<button onclick="openArchivedDocForSig(\'' + escapeHtml(req.archive_id) + '\')" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);color:#A5B4FC;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">👁 Consulter</button>';
      } else if (req.report_html) {
        docBtn = '<button onclick="previewSigReqDoc(\'' + escapeHtml(item.token) + '\')" style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);color:#A5B4FC;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">👁 Consulter</button>';
      }

      html += '<div class="archive-card" style="margin-bottom:10px;border-color:rgba(249,115,22,.4);background:rgba(249,115,22,.04)">'
        + '<div style="font-size:28px;flex-shrink:0">' + tIcon + '</div>'
        + '<div class="archive-meta" style="flex:1">'
        + '<div class="archive-ref">' + escapeHtml(req.report_num || '—') + '</div>'
        + '<div class="archive-title">✍️ Votre signature est requise</div>'
        + '<div class="archive-sub" style="margin-top:4px">' + escapeHtml(req.report_type || '—') + ' · Reçu le ' + genDate + ' · ' + modeLabel + ' · ' + progress + ' signataires</div>'
        + '<div class="archive-sub">Votre rôle : <strong style="color:var(--text)">' + escapeHtml(item.signer_role || 'Signataire') + '</strong></div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;align-items:stretch">'
        + docBtn
        + '<a href="' + escapeHtml(sigUrl) + '" style="display:inline-flex;align-items:center;justify-content:center;gap:6px;background:rgba(249,115,22,.2);border:1px solid rgba(249,115,22,.4);color:#FDBA74;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap">✍️ Signer</a>'
        + '<button onclick="moveSigItemToTrash(\'' + item.id + '\',\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline;text-align:center">🗑 Masquer</button>'
        + '</div>'
        + '</div>';
    });
  }

  // ── Cartes WAITING (pas encore son tour) ──
  if (waiting.length) {
    html += '<div style="margin-top:' + (pending.length ? '16px' : '0') + ';margin-bottom:8px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">⏳ En attente de votre tour</div>';
    waiting.forEach(function(item) {
      var req     = item.signature_requests || {};
      var genDate = req.created_at ? new Date(req.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      var progress= (req.signed_count || 0) + '/' + (req.total_signers || '?');
      var tIcon   = req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : req.report_type === 'FDS' ? '⚗️' : '📄';
      var yourSeq = (item.seq || 0) + 1;

      html += '<div class="archive-card" style="margin-bottom:8px;opacity:.65;border-color:rgba(148,163,184,.2)">'
        + '<div style="font-size:24px;flex-shrink:0">' + tIcon + '</div>'
        + '<div class="archive-meta" style="flex:1">'
        + '<div class="archive-ref">' + escapeHtml(req.report_num || '—') + '</div>'
        + '<div class="archive-title" style="color:var(--muted)">⏳ Vous êtes le signataire n°' + yourSeq + '</div>'
        + '<div class="archive-sub">Reçu le ' + genDate + ' · Progression : ' + progress + ' · ' + escapeHtml(item.signer_role || '') + '</div>'
        + '</div>'
        + '<button onclick="moveSigItemToTrash(\'' + item.id + '\',\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:none;border:1px solid rgba(148,163,184,.2);color:var(--muted);font-size:11px;padding:4px 10px;border-radius:6px;cursor:pointer;font-family:\'Barlow\',sans-serif;white-space:nowrap">🗑 Masquer</button>'
        + '</div>';
    });
  }

  // ── Historique : documents signés ──
  if (signed.length) {
    html += '<div style="margin-top:20px;margin-bottom:8px;font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.8px">✅ Signés par moi (' + signed.length + ')</div>';
    signed.forEach(function(item) {
      var req      = item.signature_requests || {};
      var signedAt = item.signed_at ? new Date(item.signed_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      var signedTime = item.signed_at ? new Date(item.signed_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '';
      var tIcon    = req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : req.report_type === 'FDS' ? '⚗️' : '📄';
      var methodLabel = item.method === 'otp_email' ? '🔐 OTP Email' : item.method === 'manuscrite_scannee' ? '🖊️ Manuscrite' : '✍️';
      var allDone = req.status === 'completed';

      // Bouton consulter le doc consolidé si tout le monde a signé
      var consolidatedBtn = '';
      if (allDone && req.archive_id) {
        consolidatedBtn = '<button onclick="openConsolidatedDoc(\'' + req.archive_id + '\')" style="background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25);color:#86EFAC;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">📄 Doc. consolidé</button>';
      } else if (req.report_html || req.archive_id) {
        var docBtn2 = req.archive_id
          ? 'onclick="openArchivedDocForSig(\'' + escapeHtml(req.archive_id) + '\')"'
          : 'onclick="previewSigReqDoc(\'' + escapeHtml(item.token) + '\')"';
        consolidatedBtn = '<button ' + docBtn2 + ' style="background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);color:#A5B4FC;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">👁 Consulter</button>';
      }

      html += '<div class="archive-card" style="margin-bottom:8px;border-color:rgba(34,197,94,.2);background:rgba(34,197,94,.02)">'
        + '<div style="font-size:22px;flex-shrink:0">' + tIcon + '</div>'
        + '<div class="archive-meta" style="flex:1">'
        + '<div class="archive-ref">' + escapeHtml(req.report_num || '—') + '</div>'
        + '<div class="archive-title" style="font-size:13px">✅ Signé le ' + signedAt + (signedTime ? ' à ' + signedTime : '') + '</div>'
        + '<div class="archive-sub">' + escapeHtml(req.report_type || '') + ' · ' + methodLabel + (item.sig_id ? ' · Réf : <code style="font-size:10px;background:rgba(255,255,255,.06);padding:1px 5px;border-radius:3px">' + escapeHtml(item.sig_id) + '</code>' : '') + '</div>'
        + '<div class="archive-sub">Votre rôle : ' + escapeHtml(item.signer_role || 'Signataire') + ' · ' + (allDone ? '<span style="color:var(--success);font-weight:700">Workflow complet ✅</span>' : '<span style="color:var(--warn)">En cours (' + (req.signed_count||0) + '/' + (req.total_signers||'?') + ')</span>') + '</div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;flex-shrink:0">'
        + consolidatedBtn
        + '<button onclick="moveSigItemToTrash(\'' + item.id + '\',\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline;text-align:center">🗑 Masquer</button>'
        + '</div>'
        + '</div>';
    });
  }

  // ── Historique : documents refusés ──
  if (refused.length) {
    html += '<div style="margin-top:20px;margin-bottom:8px;font-size:11px;font-weight:700;color:#FCA5A5;text-transform:uppercase;letter-spacing:.8px">❌ Refusés par moi (' + refused.length + ')</div>';
    refused.forEach(function(item) {
      var req      = item.signature_requests || {};
      var refusedAt = item.signed_at ? new Date(item.signed_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      var tIcon    = req.report_type === 'DUER' ? '📋' : req.report_type === 'VGP' ? '🔧' : '📄';

      html += '<div class="archive-card" style="margin-bottom:8px;border-color:rgba(239,68,68,.2);background:rgba(239,68,68,.02);opacity:.8">'
        + '<div style="font-size:22px;flex-shrink:0">' + tIcon + '</div>'
        + '<div class="archive-meta" style="flex:1">'
        + '<div class="archive-ref">' + escapeHtml(req.report_num || '—') + '</div>'
        + '<div class="archive-title" style="color:#FCA5A5;font-size:13px">❌ Refusé le ' + refusedAt + '</div>'
        + '<div class="archive-sub">' + escapeHtml(req.report_type || '') + ' · Votre rôle : ' + escapeHtml(item.signer_role || 'Signataire') + '</div>'
        + '</div>'
        + '<button onclick="moveSigItemToTrash(\'' + item.id + '\',\'' + containerId + '\',\'' + escapeHtml(email) + '\')" style="background:none;border:none;color:var(--muted);font-size:11px;cursor:pointer;text-decoration:underline;white-space:nowrap">🗑 Masquer</button>'
        + '</div>';
    });
  }

  html += '</div>';
  ctn.innerHTML = html;
}

// ── Helpers corbeille personnelle signatures ──
function moveSigItemToTrash(itemId, containerId, email) {
  var trashKey = _sigHistTrashKey(email);
  var ids = [];
  try { ids = JSON.parse(localStorage.getItem(trashKey) || '[]'); } catch(e){}
  if (ids.indexOf(itemId) < 0) ids.push(itemId);
  try { localStorage.setItem(trashKey, JSON.stringify(ids)); } catch(e){}
  renderIncomingSignatureRequests(containerId, email);
}

function restoreSigHistItem(itemId, containerId, email) {
  var trashKey = _sigHistTrashKey(email);
  var ids = [];
  try { ids = JSON.parse(localStorage.getItem(trashKey) || '[]'); } catch(e){}
  ids = ids.filter(function(i) { return i !== itemId; });
  try { localStorage.setItem(trashKey, JSON.stringify(ids)); } catch(e){}
  renderIncomingSignatureRequests(containerId, email);
}

function toggleSigHistTrash(containerId, email) {
  var ctn = document.getElementById(containerId);
  if (!ctn) return;
  ctn.dataset.showTrash = ctn.dataset.showTrash === '1' ? '0' : '1';
  renderIncomingSignatureRequests(containerId, email);
}

// ── Ouvrir le document consolidé final depuis l'archive parent ──
async function openConsolidatedDoc(parentArchiveId) {
  // Chercher l'enfant consolidé rattaché à ce parent
  var res = await sb.from('report_archive').select('file_url, report_num, signed_file_url').eq('parent_id', parentArchiveId).order('generated_at', { ascending: false }).limit(1).single();
  if (res.error || !res.data) {
    // Fallback : ouvrir le fichier signé du parent
    var parentRes = await sb.from('report_archive').select('signed_file_url, file_url, report_num').eq('id', parentArchiveId).single();
    if (!parentRes.error && parentRes.data) {
      var url = parentRes.data.signed_file_url || parentRes.data.file_url;
      if (url) { window.open(url, '_blank'); return; }
    }
    showToast('Document consolidé non disponible', 'error'); return;
  }
  var url = res.data.file_url || res.data.signed_file_url;
  if (url) window.open(url, '_blank');
  else showToast('Fichier consolidé non disponible', 'error');
}

async function ignoreSigRequest(itemId, containerId, email) {
  moveSigItemToTrash(itemId, containerId, email);
}

// ── Consulter le document archivé avant signature ─────────────────────────
async function openArchivedDocForSig(archiveId) {
  var res = await sb.from('report_archive').select('file_url, report_num, label').eq('id', archiveId).single();
  if (res.error || !res.data) { showToast('Document non disponible', 'error'); return; }
  if (res.data.file_url) {
    window.open(res.data.file_url, '_blank');
  } else {
    showToast('Aucun fichier attaché à ce rapport', 'error');
  }
}

// ── Prévisualiser le HTML du rapport depuis un token de signature ──────────
async function previewSigReqDoc(token) {
  var res = await sb.from('signature_request_items')
    .select('signature_requests(report_html, report_num, report_type)')
    .eq('token', token).single();
  if (res.error || !res.data) { showToast('Document non disponible', 'error'); return; }
  var req = (res.data.signature_requests) || {};
  if (!req.report_html) { showToast('Aucun aperçu disponible pour ce document', 'error'); return; }
  var blob = new Blob([req.report_html], { type: 'text/html' });
  var url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(function() { URL.revokeObjectURL(url); }, 30000);
}


// ── Fermer modale envoi pour signature ──────────────────────────────────────
function closeSendForSignatureModal() {
  document.getElementById('sigReqModal').classList.remove('open');
  _sigReqContext  = null;
  _sigReqSigners  = [];
}

// ── Retirer un signataire de la liste ────────────────────────────────────────
function removeSigner(idx) {
  _sigReqSigners.splice(idx, 1);
  renderSignersList();
}

// ── Ajouter un signataire depuis le formulaire manuel ────────────────────────
function addSignerFromForm() {
  var name  = (document.getElementById('sigReqName').value  || '').trim();
  var email = (document.getElementById('sigReqEmail').value || '').trim();
  var role  = (document.getElementById('sigReqRole').value  || '').trim() || 'Signataire';
  if (!name || !email) { showToast('Nom et email requis', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast('Email invalide', 'error'); return; }
  if (_sigReqSigners.find(function(s) { return s.email === email; })) { showToast('Email déjà ajouté', 'error'); return; }
  _sigReqSigners.push({ name: name, email: email, role: role });
  document.getElementById('sigReqName').value  = '';
  document.getElementById('sigReqEmail').value = '';
  document.getElementById('sigReqRole').value  = '';
  renderSignersList();
}

// ── Charger les membres de l'organisation ────────────────────────────────────
async function loadOrgMembersForSigReq() {
  var result = await sb.from('profiles').select('full_name, email, role').eq('org_id', currentProfile.org_id);
  var members = result.data || [];
  var sel = document.getElementById('sigReqOrgMemberSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Choisir un membre --</option>'
    + members.filter(function(m) { return m.email !== currentProfile.email; })
      .map(function(m) {
        return '<option value="' + escapeHtml(m.email) + '" data-name="' + escapeHtml(m.full_name || m.email) + '" data-role="' + escapeHtml(m.role) + '">'
          + escapeHtml(m.full_name || m.email) + ' (' + escapeHtml(m.role) + ')</option>';
      }).join('');
}

// ── Ajouter un membre depuis la liste déroulante org ─────────────────────────
function addSignerFromSelect() {
  var sel = document.getElementById('sigReqOrgMemberSelect');
  var opt = sel ? sel.options[sel.selectedIndex] : null;
  if (!opt || !opt.value) return;
  var email = opt.value;
  var name  = opt.getAttribute('data-name') || email;
  var role  = opt.getAttribute('data-role') || 'Membre';
  if (_sigReqSigners.find(function(s) { return s.email === email; })) { showToast('Déjà dans la liste', 'error'); return; }
  _sigReqSigners.push({ name: name, email: email, role: role });
  sel.selectedIndex = 0;
  renderSignersList();
}

// ── Badge statut signature pour l'historique ──────────────────────────────────
function sigStatusBadge(archive) {
  var status = archive.sig_status;
  if (!status || status === 'none') return '';
  if (status === 'pending') {
    var total  = archive.sig_total  || '?';
    var signed = archive.sig_signed || 0;
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(245,158,11,.12);color:#FCD34D;border:1px solid rgba(245,158,11,.25)">⏳ En attente (' + signed + '/' + total + ')</span>';
  }
  if (status === 'signed_digital') {
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(34,197,94,.12);color:#86EFAC;border:1px solid rgba(34,197,94,.25)">✅ Signé numériquement</span>';
  }
  if (status === 'signed_manual') {
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(99,102,241,.12);color:#A5B4FC;border:1px solid rgba(99,102,241,.25)">🖊️ Signé manuscrit</span>';
  }
  if (status === 'signed_all') {
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(34,197,94,.15);color:#4ADE80;border:1px solid rgba(34,197,94,.3)">✅ Tous signataires confirmés</span>';
  }
  if (status === 'refused') {
    return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 9px;border-radius:10px;background:rgba(239,68,68,.12);color:#FCA5A5;border:1px solid rgba(239,68,68,.25)">❌ Refusé</span>';
  }
  return '';
}

// ── Modale upload scan signé (rattacher à un rapport existant) ────────────────
var _uploadScanArchiveId = null;
var _uploadScanFile      = null;

function openUploadSignedScanModal(archiveId, reportNum) {
  _uploadScanArchiveId = archiveId;
  _uploadScanFile = null;
  document.getElementById('uploadScanModalTitle').textContent = 'Scanner signé — ' + (reportNum || '');
  document.getElementById('uploadScanFilePreview').textContent = '';
  document.getElementById('uploadScanFileInput').value = '';
  document.getElementById('uploadScanBtn').disabled = true;
  document.getElementById('uploadScanModal').classList.add('open');
}

function closeUploadScanModal() {
  document.getElementById('uploadScanModal').classList.remove('open');
  _uploadScanArchiveId = null;
  _uploadScanFile = null;
}

function onUploadScanFileChange(input) {
  _uploadScanFile = input.files[0] || null;
  document.getElementById('uploadScanFilePreview').textContent = _uploadScanFile ? '✓ ' + _uploadScanFile.name : '';
  document.getElementById('uploadScanBtn').disabled = !_uploadScanFile;
}

async function submitUploadScan() {
  if (!_uploadScanFile || !_uploadScanArchiveId) return;
  var btn = document.getElementById('uploadScanBtn');
  btn.disabled = true; btn.textContent = '⏳ Téléversement...';

  var pad  = function(n){ return String(n).padStart(2,'0'); };
  var now  = new Date();
  var sigId = 'SIG-SCAN-' + now.getFullYear() + pad(now.getMonth()+1) + pad(now.getDate())
            + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  var path = currentProfile.org_id + '/scans/' + sigId + '-' + _uploadScanFile.name;

  var upRes = await sb.storage.from('rapport-archives').upload(path, _uploadScanFile, { upsert: true });
  if (upRes.error) {
    showToast('Erreur upload : ' + upRes.error.message, 'error');
    btn.disabled = false; btn.textContent = '📤 Archiver le scan signé';
    return;
  }

  var signed = await sb.storage.from('rapport-archives').createSignedUrl(path, 60 * 60 * 24 * 365);
  var fileUrl = signed.data ? signed.data.signedUrl : null;

  await sb.from('report_archive').update({
    signed_file_url: fileUrl,
    sig_status     : 'signed_manual',
  }).eq('id', _uploadScanArchiveId);

  await sb.from('report_archive').insert({
    org_id      : currentProfile.org_id,
    created_by  : currentUser.id,
    responsable : currentProfile.full_name || currentProfile.email,
    email       : currentProfile.email || '',
    report_num  : sigId,
    report_type : 'SCAN',
    label       : 'Scan signé — rattaché à ' + _uploadScanArchiveId,
    source      : 'manuscrit',
    file_url    : fileUrl,
    parent_id   : _uploadScanArchiveId,
    generated_at: now.toISOString(),
  });

  btn.disabled = false; btn.textContent = '📤 Archiver le scan signé';
  closeUploadScanModal();
  showToast('✓ Scan signé archivé et rattaché', 'success');
  if (typeof renderHistoriqueSection === 'function') renderHistoriqueSection(_conformRole);
}
