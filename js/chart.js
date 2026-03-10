// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  SafetySphere — SSChart  v1.0.0
//  Composant graphe réutilisable — aucune dépendance externe
//
//  Usage :
//    SSChart.render('monContainerId', visits, options)
//    SSChart.update('monContainerId', newOptions)
//    SSChart.destroy('monContainerId')
//
//  Options :
//    period     : '7d' | '30d' | '90d'          (défaut : '7d')
//    type       : 'bar' | 'line'                 (défaut : 'bar')
//    title      : string                         (défaut : 'Fréquentation')
//    subtitle   : string
//    dateField  : string                         (défaut : 'check_in')
//    signedField: string                         (défaut : 'signed_at')
//    accentColor: string                         (défaut : '#F97316')
//    signColor  : string                         (défaut : '#4ADE80')
//    onPeriodChange : function(period)
//    onTypeChange   : function(type)
//    kpis       : bool                           (défaut : true)
//    legend     : bool                           (défaut : true)
//    toolbar    : bool                           (défaut : true)
//
//  Chargement : après core.js, avant tout module qui l'utilise
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

'use strict';

var SSChart = (function() {

  // ── Registre interne des instances ───────────────────────────
  var _instances = {};

  // ── Utilitaires ──────────────────────────────────────────────
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _periodDays(p) {
    return p === '30d' ? 30 : p === '90d' ? 90 : 7;
  }

  function _buildBuckets(visits, period, dateField, signedField) {
    var days  = _periodDays(period);
    var now   = new Date();
    var start = new Date(now);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    var buckets = {};
    for (var d = 0; d < days; d++) {
      var dt = new Date(start);
      dt.setDate(dt.getDate() + d);
      buckets[dt.toISOString().slice(0, 10)] = {
        total: 0, signed: 0, durations: []
      };
    }

    (visits || []).forEach(function(v) {
      var key = (v[dateField] || '').slice(0, 10);
      if (!buckets[key]) return;
      buckets[key].total++;
      if (v[signedField]) buckets[key].signed++;
      if (v.check_out && v[dateField]) {
        var dur = (new Date(v.check_out) - new Date(v[dateField])) / 60000;
        if (dur > 0) buckets[key].durations.push(dur);
      }
    });

    return buckets;
  }

  function _dayLabel(dateStr, days) {
    var d = new Date(dateStr + 'T12:00:00');
    if (days <= 7)  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    if (days <= 30) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  // ── Rendu HTML du panel ───────────────────────────────────────
  function _buildHTML(containerId, visits, opts) {
    var period      = opts.period      || '7d';
    var type        = opts.type        || 'bar';
    var title       = opts.title       || 'Fréquentation';
    var subtitle    = opts.subtitle    || 'Analyse des visites';
    var dateField   = opts.dateField   || 'check_in';
    var signedField = opts.signedField || 'signed_at';
    var accent      = opts.accentColor || '#F97316';
    var signColor   = opts.signColor   || '#4ADE80';
    var showKpis    = opts.kpis    !== false;
    var showLegend  = opts.legend  !== false;
    var showToolbar = opts.toolbar !== false;

    var days    = _periodDays(period);
    var buckets = _buildBuckets(visits, period, dateField, signedField);
    var keys    = Object.keys(buckets).sort();
    var totals  = keys.map(function(k) { return buckets[k].total; });
    var signed  = keys.map(function(k) { return buckets[k].signed; });
    var maxVal  = Math.max.apply(null, totals.concat([1]));
    var labels  = keys.map(function(k) { return _dayLabel(k, days); });

    var totalVisits = totals.reduce(function(a, b) { return a + b; }, 0);
    var totalSigned = signed.reduce(function(a, b) { return a + b; }, 0);
    var peakIdx     = totals.indexOf(Math.max.apply(null, totals));
    var peakVal     = totals[peakIdx] || 0;
    var peakLabel   = keys[peakIdx] ? new Date(keys[peakIdx] + 'T12:00:00')
      .toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
    var avgPerDay   = totalVisits > 0 ? (totalVisits / days).toFixed(1) : '0';
    var signRate    = totalVisits > 0 ? Math.round(totalSigned / totalVisits * 100) : 0;
    var allDurs     = [];
    keys.forEach(function(k) { allDurs = allDurs.concat(buckets[k].durations); });
    var avgDur = allDurs.length
      ? Math.round(allDurs.reduce(function(a, b) { return a + b; }, 0) / allDurs.length) : 0;

    var uid = 'ssc_' + containerId.replace(/[^a-z0-9]/gi, '') + '_' + Date.now();

    var chartData = {
      labels: labels, totals: totals, signed: signed, maxVal: maxVal,
      type: type, uid: uid, period: days, accent: accent, signColor: signColor
    };

    var html = '';

    // ── Wrapper ──
    html += '<div class="sschart-panel" style="'
      + 'background:linear-gradient(135deg,rgba(13,27,42,.97),rgba(10,18,35,.99));'
      + 'border:1px solid rgba(' + _hexToRgb(accent) + ',.12);'
      + 'border-radius:20px;overflow:hidden;position:relative;'
      + 'box-shadow:0 4px 40px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)">';

    // Scan line déco
    html += '<div style="position:absolute;inset:0;pointer-events:none;overflow:hidden;border-radius:20px;z-index:0">'
      + '<div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(' + _hexToRgb(accent) + ',.3),transparent)"></div>'
      + '</div>';

    html += '<div style="position:relative;z-index:1">';

    // ── Header ──
    html += '<div style="padding:20px 24px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">';
    html += '<div style="display:flex;align-items:center;gap:14px">';
    html += '<div style="display:flex;flex-direction:column;gap:2px">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<div style="width:2px;height:16px;background:linear-gradient(180deg,' + accent + ',transparent);border-radius:1px"></div>';
    html += '<span style="font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:' + accent + ';font-family:\'Barlow\',sans-serif">' + _esc(title) + '</span>';
    html += '</div>';
    html += '<div style="font-size:19px;font-weight:900;color:#F1F5F9;letter-spacing:-.3px;padding-left:10px">' + _esc(subtitle) + '</div>';
    html += '</div>';
    html += '</div>';

    // Toolbar période + type
    if (showToolbar) {
      html += '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">';

      // Type toggle
      html += '<div style="display:flex;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;overflow:hidden;padding:2px;gap:2px">';
      [['bar','▐▐'],['line','∿']].forEach(function(t) {
        var a = type === t[0];
        html += '<button onclick="SSChart.update(\'' + _esc(containerId) + '\',{type:\'' + t[0] + '\'})" style="'
          + 'padding:5px 11px;font-size:12px;font-weight:700;border:none;cursor:pointer;'
          + 'border-radius:7px;transition:all .2s;font-family:\'Barlow\',sans-serif;'
          + 'background:' + (a ? 'rgba(' + _hexToRgb(accent) + ',.18)' : 'transparent') + ';'
          + 'color:' + (a ? accent : '#4B5563') + '">' + t[1] + '</button>';
      });
      html += '</div>';

      // Période
      html += '<div style="display:flex;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;overflow:hidden;padding:2px;gap:2px">';
      [['7d','7J'],['30d','30J'],['90d','90J']].forEach(function(p) {
        var a = period === p[0];
        html += '<button onclick="SSChart.update(\'' + _esc(containerId) + '\',{period:\'' + p[0] + '\'})" style="'
          + 'padding:5px 13px;font-size:11px;font-weight:700;border:none;cursor:pointer;'
          + 'border-radius:7px;transition:all .2s;font-family:\'Barlow\',sans-serif;'
          + 'background:' + (a ? 'rgba(' + _hexToRgb(accent) + ',.18)' : 'transparent') + ';'
          + 'color:' + (a ? accent : '#4B5563') + '">' + p[1] + '</button>';
      });
      html += '</div>';
      html += '</div>';
    }

    html += '</div>'; // header

    // ── KPI strip ──
    if (showKpis) {
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);margin:16px 24px 0;'
        + 'background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);'
        + 'border-radius:12px;overflow:hidden">';

      var kpis = [
        { val: totalVisits,              sub: 'Visites',        color: accent,     dot: '●' },
        { val: avgPerDay,                sub: 'Moy. / jour',    color: '#FCD34D',  dot: '◆' },
        { val: peakVal || '—',           sub: 'Pic',            color: '#A5B4FC',  dot: '▲' },
        { val: signRate + '%',           sub: 'Taux signature', color: signColor,  dot: '✓' },
        { val: avgDur ? avgDur + ' min' : '—', sub: 'Durée moy.', color: '#38BDF8', dot: '◷' }
      ];

      kpis.forEach(function(k, i) {
        html += '<div style="padding:13px 10px;text-align:center;'
          + (i < 4 ? 'border-right:1px solid rgba(255,255,255,.05)' : '') + '">';
        html += '<div style="font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;'
          + 'color:#374151;margin-bottom:5px;font-family:\'Barlow\',sans-serif">'
          + k.dot + ' ' + _esc(k.sub) + '</div>';
        html += '<div style="font-size:18px;font-weight:900;color:' + k.color + ';'
          + 'letter-spacing:-.5px;line-height:1;font-family:\'Barlow\',sans-serif">' + k.val + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // ── Canvas ──
    html += '<div style="padding:16px 24px 4px;position:relative">';
    html += '<canvas id="' + uid + '" height="180" style="width:100%;height:180px;display:block;cursor:crosshair"></canvas>';
    html += '<div id="' + uid + '_tip" style="position:absolute;pointer-events:none;display:none;'
      + 'background:rgba(8,16,28,.96);border:1px solid rgba(' + _hexToRgb(accent) + ',.25);'
      + 'border-radius:10px;padding:9px 13px;font-size:11px;color:#fff;white-space:nowrap;z-index:99;'
      + 'box-shadow:0 8px 32px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.03)"></div>';
    html += '</div>';

    // ── Légende + pic ──
    if (showLegend) {
      html += '<div style="padding:4px 24px 18px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">';
      html += '<div style="display:flex;align-items:center;gap:5px">'
        + '<div style="width:16px;height:3px;background:' + accent + ';border-radius:2px"></div>'
        + '<span style="font-size:10px;color:#4B5563;font-family:\'Barlow\',sans-serif">Visites totales</span>'
        + '</div>';
      html += '<div style="display:flex;align-items:center;gap:5px">'
        + '<div style="width:16px;height:2px;background:' + signColor + ';border-radius:2px;opacity:.6"></div>'
        + '<span style="font-size:10px;color:#4B5563;font-family:\'Barlow\',sans-serif">Consignes signées</span>'
        + '</div>';
      if (totalVisits > 0 && peakVal > 0) {
        html += '<span style="font-size:10px;color:#374151;margin-left:auto;font-family:\'Barlow\',sans-serif">'
          + 'Pic · <strong style="color:#FCD34D">' + _esc(peakLabel) + '</strong></span>';
      } else {
        html += '<span style="font-size:10px;color:#374151;margin-left:auto;font-style:italic;font-family:\'Barlow\',sans-serif">Aucune donnée sur la période</span>';
      }
      html += '</div>';
    }

    html += '</div>'; // z-index wrapper
    html += '</div>'; // panel

    // ── Script canvas (exécuté par SSChart._execScript) ──
    html += '<script class="sschart-script" data-uid="' + uid + '">'
      + _buildCanvasScript(chartData)
      + '<\/script>';

    return html;
  }

  // ── Script canvas isolé ───────────────────────────────────────
  function _buildCanvasScript(D) {
    return '(function(){'
      + 'function run(){'
      + 'var canvas=document.getElementById("' + D.uid + '");'
      + 'if(!canvas)return;'
      + 'var tip=document.getElementById("' + D.uid + '_tip");'
      + 'var ctx=canvas.getContext("2d");'
      + 'var dpr=window.devicePixelRatio||1;'
      + 'var W=canvas.offsetWidth,H=180;'
      + 'if(!W){setTimeout(run,50);return;}'
      + 'canvas.width=W*dpr;canvas.height=H*dpr;ctx.scale(dpr,dpr);'
      + 'var labels=' + JSON.stringify(D.labels) + ';'
      + 'var totals=' + JSON.stringify(D.totals) + ';'
      + 'var signed=' + JSON.stringify(D.signed) + ';'
      + 'var maxY=Math.max(' + D.maxVal + ',1);'
      + 'var n=labels.length;'
      + 'var pad={l:30,r:10,t:14,b:34};'
      + 'var gw=W-pad.l-pad.r,gh=H-pad.t-pad.b;'
      + 'var accent="' + D.accent + '",signC="' + D.signColor + '";'
      + 'function hexRgb(h){var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);return r+","+g+","+b;}'
      + 'var aRgb=hexRgb(accent),sRgb=hexRgb(signC);'
      + 'function vX(i){return pad.l+i/(n-1||1)*gw;}'
      + 'function vY(v){return pad.t+gh*(1-v/maxY);}'
      // Grid
      + 'var step=maxY<=5?1:maxY<=10?2:maxY<=20?5:Math.ceil(maxY/4);'
      + 'for(var yv=0;yv<=maxY;yv+=step){'
      + '  ctx.beginPath();ctx.moveTo(pad.l,vY(yv));ctx.lineTo(pad.l+gw,vY(yv));'
      + '  ctx.strokeStyle="rgba(255,255,255,.04)";ctx.lineWidth=1;ctx.stroke();'
      + '  ctx.fillStyle="#374151";ctx.font="8px Barlow,sans-serif";ctx.textAlign="right";'
      + '  ctx.fillText(yv,pad.l-4,vY(yv)+3);'
      + '}'
      // Baseline
      + 'ctx.beginPath();ctx.moveTo(pad.l,pad.t+gh);ctx.lineTo(pad.l+gw,pad.t+gh);'
      + 'ctx.strokeStyle="rgba(255,255,255,.08)";ctx.lineWidth=1;ctx.stroke();'
      // X labels
      + 'var skip=n<=7?1:n<=30?Math.ceil(n/7):Math.ceil(n/8);'
      + 'labels.forEach(function(lbl,i){'
      + '  if(i%skip!==0&&i!==n-1)return;'
      + '  var x=' + (D.type === 'bar' ? 'pad.l+(i+.5)*gw/n' : 'vX(i)') + ';'
      + '  ctx.fillStyle="#374151";ctx.font="9px Barlow,sans-serif";ctx.textAlign="center";'
      + '  ctx.fillText(lbl,x,H-6);'
      + '});'
      // ── Bars ──
      + (D.type === 'bar'
        ? 'var bw=gw/n*.72;'
          + 'totals.forEach(function(v,i){'
          + '  var x=pad.l+i*gw/n+gw/n*.14;'
          + '  if(v===0){'
          + '    ctx.fillStyle="rgba(255,255,255,.03)";'
          + '    ctx.beginPath();ctx.roundRect(x,pad.t+gh-2,bw,2,1);ctx.fill();return;'
          + '  }'
          + '  var y=vY(v),bh=gh-(y-pad.t);'
          + '  var grd=ctx.createLinearGradient(x,y,x,pad.t+gh);'
          + '  grd.addColorStop(0,"rgba("+aRgb+",.9)");'
          + '  grd.addColorStop(1,"rgba("+aRgb+",.08)");'
          + '  ctx.fillStyle=grd;'
          + '  ctx.beginPath();ctx.roundRect(x,y,bw,bh,4);ctx.fill();'
          // Glow top
          + '  ctx.fillStyle="rgba("+aRgb+",.3)";'
          + '  ctx.beginPath();ctx.roundRect(x,y,bw,3,2);ctx.fill();'
          // Signed overlay
          + '  if(signed[i]>0){'
          + '    var sy=vY(signed[i]),sbh=gh-(sy-pad.t);'
          + '    var grd2=ctx.createLinearGradient(x,sy,x,pad.t+gh);'
          + '    grd2.addColorStop(0,"rgba("+sRgb+",.45)");'
          + '    grd2.addColorStop(1,"rgba("+sRgb+",.02)");'
          + '    ctx.fillStyle=grd2;'
          + '    ctx.beginPath();ctx.roundRect(x,sy,bw,sbh,4);ctx.fill();'
          + '  }'
          // Label valeur
          + '  if(bh>16){'
          + '    ctx.fillStyle="#F1F5F9";ctx.font="bold 9px Barlow,sans-serif";ctx.textAlign="center";'
          + '    ctx.fillText(v,x+bw/2,y+11);'
          + '  }'
          + '});'
        // ── Line ──
        : 'function smoothLine(pts,close,fillGrd,strokeCol,sw,dash){'
          + '  if(pts.length<2)return;'
          + '  ctx.beginPath();'
          + '  pts.forEach(function(p,i){'
          + '    if(i===0){ctx.moveTo(p[0],p[1]);return;}'
          + '    var prev=pts[i-1];'
          + '    var cpx=(prev[0]+p[0])/2;'
          + '    ctx.bezierCurveTo(cpx,prev[1],cpx,p[1],p[0],p[1]);'
          + '  });'
          + '  if(close){'
          + '    ctx.lineTo(pts[pts.length-1][0],pad.t+gh);'
          + '    ctx.lineTo(pts[0][0],pad.t+gh);'
          + '    ctx.closePath();ctx.fillStyle=fillGrd;ctx.fill();'
          + '  } else {'
          + '    if(dash)ctx.setLineDash(dash);'
          + '    ctx.strokeStyle=strokeCol;ctx.lineWidth=sw;ctx.lineJoin="round";ctx.stroke();'
          + '    ctx.setLineDash([]);'
          + '  }'
          + '}'
          + 'var tPts=totals.map(function(v,i){return[vX(i),vY(v)];});'
          + 'var sPts=signed.map(function(v,i){return[vX(i),vY(v)];});'
          // Fill zones
          + 'var fg=ctx.createLinearGradient(0,pad.t,0,pad.t+gh);'
          + 'fg.addColorStop(0,"rgba("+aRgb+",.22)");fg.addColorStop(1,"rgba("+aRgb+",0)");'
          + 'smoothLine(tPts,true,fg);'
          + 'var sg=ctx.createLinearGradient(0,pad.t,0,pad.t+gh);'
          + 'sg.addColorStop(0,"rgba("+sRgb+",.12)");sg.addColorStop(1,"rgba("+sRgb+",0)");'
          + 'smoothLine(sPts,true,sg);'
          // Lignes
          + 'smoothLine(tPts,false,null,accent,2.5);'
          + 'smoothLine(sPts,false,null,"rgba("+sRgb+",.6)",1.5,[4,3]);'
          // Points
          + 'totals.forEach(function(v,i){'
          + '  if(v===0)return;'
          + '  ctx.beginPath();ctx.arc(vX(i),vY(v),3.5,0,Math.PI*2);'
          + '  ctx.fillStyle=accent;ctx.fill();'
          + '  ctx.strokeStyle="rgba(8,16,28,.8)";ctx.lineWidth=1.5;ctx.stroke();'
          + '});'
      )
      // ── Tooltip ──
      + 'canvas.addEventListener("mousemove",function(e){'
      + '  var r=canvas.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;'
      + '  var idx=-1;'
      + (D.type === 'bar'
          ? 'idx=Math.floor((mx-pad.l)/(gw/n));'
          : 'var md=9999;totals.forEach(function(_,i){var dx=Math.abs(vX(i)-mx);if(dx<md){md=dx;idx=i;}});')
      + '  if(idx<0||idx>=n){if(tip)tip.style.display="none";return;}'
      + '  var v=totals[idx],s=signed[idx],lbl=labels[idx];'
      + '  var sr=v>0?Math.round(s/v*100):0;'
      + '  if(tip){'
      + '    tip.innerHTML="<div style=\\"font-weight:700;color:"+accent+";margin-bottom:5px;font-size:12px\\">"+lbl+"</div>"'
      + '      +"<div style=\\"color:#9CA3AF;line-height:1.8\\">👥 <b style=\\"color:#F1F5F9\\">"+v+"</b> visite"+(v!==1?"s":"")+"<br>"'
      + '      +"✅ <b style=\\"color:"+signC+"\\">"+s+"</b> signée"+(s!==1?"s":"")+" · "+sr+"%</div>";'
      + '    var cx=mx+14,cy=my-48;'
      + '    if(cx+140>W)cx=mx-150;'
      + '    if(cy<0)cy=my+14;'
      + '    tip.style.left=cx+"px";tip.style.top=cy+"px";tip.style.display="block";'
      + '  }'
      + '});'
      + 'canvas.addEventListener("mouseleave",function(){if(tip)tip.style.display="none";});'
      + '}'
      + 'run();'
      + 'window.addEventListener("resize",function(){run();});'
      + '})();';
  }

  // ── Utilitaire hex → rgb ──────────────────────────────────────
  function _hexToRgb(hex) {
    var r = parseInt(hex.slice(1,3),16);
    var g = parseInt(hex.slice(3,5),16);
    var b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }

  // ── Exécuter les scripts canvas après innerHTML ───────────────
  function _execScripts(container) {
    var scripts = container.querySelectorAll('script.sschart-script');
    scripts.forEach(function(s) {
      try { (new Function(s.textContent))(); } catch(e) { console.warn('[SSChart]', e); }
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  API publique
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  return {

    /**
     * render(containerId, visits, options)
     * Injecte le graphe dans le container et l'initialise.
     */
    render: function(containerId, visits, options) {
      var container = document.getElementById(containerId);
      if (!container) { console.warn('[SSChart] Container introuvable :', containerId); return; }

      var opts = options || {};
      _instances[containerId] = {
        visits : visits || [],
        opts   : Object.assign({ period:'7d', type:'bar' }, opts)
      };

      container.innerHTML = _buildHTML(containerId, visits, _instances[containerId].opts);
      _execScripts(container);
    },

    /**
     * update(containerId, newOptions)
     * Met à jour les options (période, type...) sans recharger les données.
     */
    update: function(containerId, newOptions) {
      var inst = _instances[containerId];
      if (!inst) { console.warn('[SSChart] Instance introuvable :', containerId); return; }

      Object.assign(inst.opts, newOptions || {});

      if (newOptions.period && inst.opts.onPeriodChange) inst.opts.onPeriodChange(newOptions.period);
      if (newOptions.type   && inst.opts.onTypeChange)   inst.opts.onTypeChange(newOptions.type);

      var container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = _buildHTML(containerId, inst.visits, inst.opts);
      _execScripts(container);
    },

    /**
     * setData(containerId, visits)
     * Met à jour les données sans changer les options.
     */
    setData: function(containerId, visits) {
      var inst = _instances[containerId];
      if (!inst) return;
      inst.visits = visits || [];
      this.update(containerId, {});
    },

    /**
     * destroy(containerId)
     * Supprime l'instance et vide le container.
     */
    destroy: function(containerId) {
      delete _instances[containerId];
      var container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    },

    /**
     * getInstance(containerId)
     * Accès aux options/données courantes.
     */
    getInstance: function(containerId) {
      return _instances[containerId] || null;
    }
  };

})();
