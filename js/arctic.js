/* Ocean Pulse - track "Arctic Pulse".
 * Sonifies Arctic sea ice extent (NSIDC Sea Ice Index) and Arctic air temperature (NASA GISTEMP).
 * This track is driven by measured numbers, not by pixels: the ice cap on screen is a stylised
 * disc whose AREA is to scale with the measured extent.
 * Code written with AI assistance (Claude) and reviewed by the team.
 */
(function () {
  'use strict';
  var OP = window.OceanPulse = window.OceanPulse || {};
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var EXT_MIN = 3.4, EXT_MAX = 16.4;      // range of the record, million km2
  var SPEEDS = { all: { slow: 4, normal: 8, fast: 16 }, sept: { slow: 1, normal: 1.7, fast: 3 } };

  function mix(a, b, k) { return 'rgb(' + a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }).join(',') + ')'; }

  function build() {
    var raw = window.ARCTIC_DATA;
    var all = raw.extent.map(function (r) { return { y: r[0], m: r[1], v: r[2] }; });
    var first = {};                         // 1979 value for each calendar month
    var lowest = {};                        // running record low per calendar month
    all.forEach(function (d) {
      if (d.y === 1979) first[d.m] = d.v;
      d.record = d.y >= 1990 && lowest[d.m] != null && d.v < lowest[d.m];
      if (lowest[d.m] == null || d.v < lowest[d.m]) lowest[d.m] = d.v;
      var t = raw.arcticTemp[d.y];
      d.tempYear = t == null ? Math.max.apply(null, Object.keys(raw.arcticTemp).map(Number)) : d.y;
      d.temp = raw.arcticTemp[d.tempYear];
      d.vs1979 = first[d.m] ? (d.v / first[d.m] - 1) * 100 : 0;
    });
    return { all: all, sept: all.filter(function (d) { return d.m === 9; }), temp: raw.arcticTemp };
  }

  function Track() {
    this.id = 'arctic';
    this.title = 'Arctic Pulse';
    this.blurb = 'Arctic sea ice, month by month from 1979 to 2026. Hear the ice breathe, and the breath get shallower.';
    this.data = build();
    this.mode = 'all'; this.speed = 'normal'; this.pos = 0; this.playing = false; this.timer = null;
    this.sources = [
      'Sea ice: <cite>Sea Ice Index, Version 4</cite> (G02135), monthly Northern Hemisphere extent, January 1979 to October 2026. Credit: Sea Ice Index, National Snow and Ice Data Center. Two months (December 1987, January 1988) are missing in the record.',
      'Arctic air temperature: <cite>NASA GISS Surface Temperature Analysis (GISTEMP v4)</cite>, zonal annual means 64°N–90°N, anomaly relative to 1951–1980. Credit: NASA Goddard Institute for Space Studies. Yearly values to 2025; 2026 uses the 2025 value.'
    ];
    this.legend =
      '<dl>' +
      '<dt>Pitch of the low tone</dt><dd>Sea ice extent. A lot of ice sounds deep. Less ice sounds higher.</dd>' +
      '<dt>Trembling and wind</dt><dd>Arctic air temperature that year (NASA GISTEMP). The warmer the Arctic, the more restless the sound.</dd>' +
      '<dt>Bells</dt><dd>One low bell each March, when the ice is at its yearly maximum, and one higher bell each September, at the minimum.</dd>' +
      '<dt>A crack</dt><dd>A new record-low September.</dd>' +
      '</dl>' +
      '<p>The ice cap on screen is a stylised disc. Its area is to scale with the measured extent; its shape is not a map. The dashed ring shows the same month in 1979.</p>';
  }

  Track.prototype.list = function () { return this.data[this.mode]; };

  Track.prototype.mount = function (host) {
    var self = this; this.host = host;
    host.screen.innerHTML = '<canvas role="img" aria-label="Arctic sea ice extent shown as a disc and a chart"></canvas>';
    this.canvas = host.screen.querySelector('canvas');
    host.controls.innerHTML =
      '<label class="wide">Time <input id="arc-time" type="range" min="0" max="1" value="0" step="1"></label>' +
      '<label>Show <select id="arc-mode"><option value="all">Every month (the breath)</option><option value="sept">Septembers only (the long melt)</option></select></label>' +
      '<label>Speed <select id="arc-speed"><option value="slow">Slow</option><option value="normal" selected>Normal</option><option value="fast">Fast</option></select></label>' +
      '<button type="button" class="chip" id="arc-restart">Back to 1979</button>';
    this.slider = host.controls.querySelector('#arc-time');
    this.slider.addEventListener('input', function () { self.seek(+self.slider.value, true); });
    host.controls.querySelector('#arc-mode').addEventListener('change', function (e) { self.setMode(e.target.value); });
    host.controls.querySelector('#arc-speed').addEventListener('change', function (e) { self.speed = e.target.value; if (self.playing) { self.pause(true); self.play(); } });
    host.controls.querySelector('#arc-restart').addEventListener('click', function () { self.seek(0, true); });
    this._resize = function () { self.draw(); };
    window.addEventListener('resize', this._resize);
    this.slider.max = this.list().length - 1;
    this.seek(this.pos, true);
  };

  Track.prototype.unmount = function () { this.pause(true); window.removeEventListener('resize', this._resize); };

  Track.prototype.setMode = function (mode) {
    var cur = this.list()[this.pos], was = this.playing;
    this.pause(true); this.mode = mode;
    var list = this.list(), best = 0;
    for (var i = 0; i < list.length; i++) if (list[i].y <= cur.y) best = i;
    this.slider.max = list.length - 1;
    this.seek(best, true);
    if (was) this.play();
  };

  Track.prototype.play = function () {
    var self = this;
    if (this.pos >= this.list().length - 1) this.pos = 0;
    this.playing = true;
    this.apply(true);
    this.timer = setInterval(function () { self.step(); }, 1000 / SPEEDS[this.mode][this.speed]);
  };

  Track.prototype.pause = function (quiet) {
    this.playing = false; clearInterval(this.timer); this.timer = null;
    this.host.engine.hush();
    if (!quiet) this.host.announce(this.describe());
  };

  Track.prototype.step = function () {
    if (this.pos >= this.list().length - 1) {
      this.host.stop();
      this.host.announce('End of the record. ' + this.describe());
      return;
    }
    this.pos++; this.apply(true);
  };

  Track.prototype.seek = function (i, announce) {
    this.pos = Math.max(0, Math.min(this.list().length - 1, i));
    this.apply(this.playing);
    if (announce && !this.playing) this.host.announce(this.describe());
  };

  /** Map the current data point to sound and picture. */
  Track.prototype.apply = function (sound) {
    var d = this.list()[this.pos], e = this.host.engine, c01 = OP.clamp01;
    var n = c01((d.v - EXT_MIN) / (EXT_MAX - EXT_MIN));       // 1 = most ice
    var step = 3 + Math.round((1 - n) * 12);                  // less ice -> higher pitch (E2 up to A4)
    var unrest = c01((d.temp + 0.6) / 3.6);                   // warmer Arctic -> more restless
    if (sound) {
      e.setDrone({ step: step, bright: 0.22 + 0.6 * (1 - n), unrest: unrest, level: 0.75, glide: this.mode === 'all' ? 0.1 : 0.2 });
      if (this.mode === 'sept') { e.bell(step + 10, 0.55, 0); if (d.record) e.crack(0.7); }
      else if (d.m === 3) e.bell(step + 10, 0.35, -0.4);
      else if (d.m === 9) { e.bell(step + 10, 0.6, 0.4); if (d.record) e.crack(0.7); }
    }
    this.slider.value = this.pos;
    this.slider.setAttribute('aria-valuetext', MONTHS[d.m - 1] + ' ' + d.y + ', ' + d.v.toFixed(2) + ' million square kilometres');
    this.host.setReadout(MONTHS[d.m - 1] + ' ' + d.y + ' · ' + d.v.toFixed(2) + ' million km² of sea ice');
    // While playing, only speak now and then: a screen reader cannot keep up with every month.
    if (this.playing && d.m === 9 && (d.y % 5 === 0 || d.record)) this.host.announce(this.describe());
    this.draw();
  };

  Track.prototype.describe = function () {
    var d = this.list()[this.pos];
    var change = Math.abs(d.vs1979) < 0.5 ? 'about the same as' : Math.abs(d.vs1979).toFixed(0) + ' percent ' + (d.vs1979 < 0 ? 'less than' : 'more than');
    var s = MONTHS[d.m - 1] + ' ' + d.y + ': ' + d.v.toFixed(2) + ' million square kilometres of Arctic sea ice, ' + change + ' ' + MONTHS[d.m - 1] + ' 1979.';
    if (d.record) s += ' A new record low for ' + MONTHS[d.m - 1] + '.';
    s += ' Arctic air temperature in ' + d.tempYear + ' was ' + (d.temp >= 0 ? '+' : '−') + Math.abs(d.temp).toFixed(2) + ' °C compared with 1951–1980.';
    return s;
  };

  Track.prototype.key = function (e) {
    var jump = this.mode === 'all' ? 12 : 5;
    if (e.key === 'ArrowRight') { this.seek(this.pos + 1, true); return true; }
    if (e.key === 'ArrowLeft') { this.seek(this.pos - 1, true); return true; }
    if (e.key === 'ArrowUp') { this.seek(this.pos + jump, true); return true; }
    if (e.key === 'ArrowDown') { this.seek(this.pos - jump, true); return true; }
    return false;
  };

  Track.prototype.draw = function () {
    var cv = this.canvas; if (!cv) return;
    var W = 960, H = 540, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var d = this.list()[this.pos], data = this.data;

    var bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#061426'); bg.addColorStop(1, '#030912');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    // --- ice cap (left) ---
    var cx = 250, cy = 262, R = 196, rOf = function (v) { return R * Math.sqrt(v / EXT_MAX); };
    var sea = g.createRadialGradient(cx, cy, 20, cx, cy, R + 26); sea.addColorStop(0, '#0d2e4d'); sea.addColorStop(1, '#071a2e');
    g.fillStyle = sea; g.beginPath(); g.arc(cx, cy, R + 26, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(140,180,220,.14)'; g.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(function (k) { g.beginPath(); g.arc(cx, cy, (R + 26) * k, 0, 6.2832); g.stroke(); });
    var r = rOf(d.v), ice = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, r * 0.1, cx, cy, r);
    ice.addColorStop(0, '#ffffff'); ice.addColorStop(0.75, '#dff3ff'); ice.addColorStop(1, '#a9d8f2');
    g.save(); g.shadowColor = 'rgba(190,235,255,.55)'; g.shadowBlur = 26; g.fillStyle = ice;
    g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill(); g.restore();
    var ref = data.all.filter(function (x) { return x.y === 1979 && x.m === d.m; })[0];
    if (ref) {
      g.setLineDash([7, 7]); g.strokeStyle = '#ffd08a'; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, cy, rOf(ref.v), 0, 6.2832); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#ffd08a'; g.font = '14px system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText(MONTHS[d.m - 1] + ' 1979', cx, cy - rOf(ref.v) - 8);
    }
    g.fillStyle = '#9db2c8'; g.font = '14px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Stylised ice cap · area to scale', cx, H - 22);

    // --- chart (right) ---
    var x0 = 540, x1 = 925, y0 = 60, y1 = 360;
    var xOf = function (y, m) { return x0 + (y + (m - 1) / 12 - 1979) / (2027 - 1979) * (x1 - x0); };
    var yOf = function (v) { return y1 - v / 17 * (y1 - y0); };
    g.textAlign = 'left'; g.fillStyle = '#e8f1fa'; g.font = '600 16px system-ui, sans-serif';
    g.fillText('Arctic sea ice extent, million km²', x0, 36);
    g.strokeStyle = 'rgba(140,180,220,.16)'; g.fillStyle = '#9db2c8'; g.font = '13px system-ui, sans-serif'; g.textAlign = 'right';
    [4, 8, 12, 16].forEach(function (v) { g.beginPath(); g.moveTo(x0, yOf(v)); g.lineTo(x1, yOf(v)); g.stroke(); g.fillText(v, x0 - 8, yOf(v) + 4); });
    g.textAlign = 'center'; [1980, 1990, 2000, 2010, 2020].forEach(function (y) { g.fillText(y, xOf(y, 1), y1 + 20); });
    g.strokeStyle = 'rgba(200,235,255,.32)'; g.lineWidth = 1; g.beginPath();
    data.all.forEach(function (p, i) { var X = xOf(p.y, p.m), Y = yOf(p.v); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke();
    g.strokeStyle = '#5fd0e6'; g.lineWidth = 2.5; g.beginPath();
    data.sept.forEach(function (p, i) { var X = xOf(p.y, p.m), Y = yOf(p.v); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.stroke();
    g.fillStyle = '#5fd0e6'; g.textAlign = 'left'; g.fillText('September minimum', x0 + 6, yOf(2.2));
    var X = xOf(d.y, d.m);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(X, y0); g.lineTo(X, y1 + 96); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X, yOf(d.v), 5.5, 0, 6.2832); g.fill();

    // --- Arctic temperature strip ---
    var ty = y1 + 70, th = 26;
    g.fillStyle = '#e8f1fa'; g.font = '600 14px system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText('Arctic air temperature vs 1951–1980 (NASA GISTEMP)', x0, ty - 8);
    Object.keys(data.temp).forEach(function (yy) {
      var t = data.temp[yy], k = OP.clamp01((t + 0.6) / 3.6);
      g.fillStyle = k < 0.5 ? mix([59, 111, 217], [214, 222, 230], k * 2) : mix([214, 222, 230], [255, 122, 48], k * 2 - 1);
      g.fillRect(xOf(+yy, 1), ty, (x1 - x0) / 48 + 0.6, th);
    });
    g.fillStyle = '#9db2c8'; g.font = '13px system-ui, sans-serif';
    g.fillText('cooler', x0, ty + th + 16); g.textAlign = 'right'; g.fillText('warmer', x1, ty + th + 16);
    g.textAlign = 'left'; g.fillStyle = '#ffd08a'; g.font = '600 15px system-ui, sans-serif';
    g.fillText((Math.abs(d.vs1979) < 0.5 ? 'Same as ' : (d.vs1979 < 0 ? '−' : '+') + Math.abs(d.vs1979).toFixed(0) + '% vs ') + MONTHS[d.m - 1] + ' 1979', x0, y1 + 146);
    cv.setAttribute('aria-label', 'Arctic sea ice shown as a disc and a chart. ' + this.describe());
  };

  OP.ArcticTrack = Track;
})();
