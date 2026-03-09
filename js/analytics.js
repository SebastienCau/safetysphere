// ============================================================
// SafetySphere — analytics.js  (v2.0.0)
// Analytics Admin · Analytics par rôle (Company/ST/HSE/Trainer)
// ============================================================
// Dépendances : core.js (sb, currentUser, currentProfile)
// ============================================================

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
