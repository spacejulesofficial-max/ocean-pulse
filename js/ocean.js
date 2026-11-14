/* Ocean Pulse - track "Ocean Pulse".
 * Reads NASA's film "Global Sea Surface Currents and Temperature" (SVS 3912) frame by frame
 * while it plays, and turns the colours inside a movable listening ring into sound.
 *
 * How the picture is read:
 *   - Each frame is drawn onto a hidden 360 x 180 canvas, so one analysed pixel is one degree
 *     of longitude by one degree of latitude (the film is a flat 2:1 map of the whole Earth).
 *   - Grey pixels are land. Coloured pixels are flow lines. Black pixels are water with no line.
 *   - The hue of a flow line is turned back into a temperature with NASA's own colour bar
 *     (blue 0 degrees C to red 32 degrees C). This is an estimate read from the picture,
 *     not the original model output.
 *
 * Code written with AI assistance (Claude) and reviewed by the team.
 */
(function () {
  'use strict';
  var OP = window.OceanPulse = window.OceanPulse || {};
  var AW = 360, AH = 180;
  var FILM = 'media/ecco2_sst_flow.webm';
  var T0 = Date.UTC(2007, 2, 25, 12), T1 = Date.UTC(2008, 2, 3, 12);   // first and last frame (NASA's frame date list)
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Hue (degrees) of NASA's colour bar, sampled every 2 degrees C from 0 to 32.
  var BAR_HUE = [226.8, 214.1, 198.4, 178.6, 160.4, 146.9, 136.8, 129.6, 116.4, 98.5, 81.0, 67.1, 59.2, 46.9, 31.0, 12.2, -5.8];
  var BAR_CSS = ['#345ff8', '#327ee2', '#329ccb', '#33b7b4', '#35d19e', '#38e887', '#3bfc71', '#3eff5d', '#51ff46', '#7cff33', '#b3ff26', '#e5ff22', '#fbf821', '#faca1e', '#f88d1b', '#f74619', '#f70018'];

  function hueToTemp(h) {
    if (h > 300) h -= 360;                       // reds just below 360 belong to the hot end
    if (h >= BAR_HUE[0]) return 0;
    if (h <= BAR_HUE[16]) return 32;
    for (var i = 0; i < 16; i++) {
      if (h >= BAR_HUE[i + 1]) return 2 * (i + (BAR_HUE[i] - h) / (BAR_HUE[i] - BAR_HUE[i + 1]));
    }
    return 32;
  }

  var PRESETS = [
    { id: 'whole', name: 'Whole ocean', whole: true },
    { id: 'gulf', name: 'Gulf Stream', lon: -60, lat: 38, r: 14 },
    { id: 'eqpac', name: 'Equatorial Pacific', lon: -125, lat: 0, r: 14 },
    { id: 'indian', name: 'Indian Ocean', lon: 75, lat: -5, r: 14 },
    { id: 'kuroshio', name: 'Kuroshio, Japan', lon: 150, lat: 36, r: 12 },
    { id: 'agulhas', name: 'Agulhas, South Africa', lon: 25, lat: -38, r: 12 },
    { id: 'southern', name: 'Southern Ocean', lon: -65, lat: -58, r: 12 },
    { id: 'norway', name: 'Norwegian Sea', lon: 5, lat: 68, r: 10 }
  ];

  /** A rough name for any point on the map, so a moved ring can still be described in words. */
  function seaName(lon, lat) {
    if (lat >= 62 && lat <= 76 && lon >= -15 && lon <= 20) return 'Norwegian Sea';
    if (lat > 66) return 'Arctic Ocean';
    if (lat < -50) return 'Southern Ocean';
    if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 36) return 'Mediterranean Sea';
    if (lat >= 8 && lat <= 31 && lon >= -98 && lon <= -60) return 'Gulf of Mexico and Caribbean Sea';
    var atlantic = lat > 31 ? (lon > -82 && lon < 20) : lat > 8 ? (lon > -60 && lon < 20) : (lon > -70 && lon < 20);
    if (atlantic) return lat >= 0 ? 'North Atlantic' : 'South Atlantic';
    if (lon >= 20 && lon < 100 && lat < 30) return 'Indian Ocean';
    if (lon >= 100 && lon < 130 && lat < -10) return 'Indian Ocean';
    if (lon >= 95 && lon < 130 && lat >= -10 && lat <= 25) return 'Seas of South-East Asia';
    return lat >= 0 ? 'North Pacific' : 'South Pacific';
  }

  function where(lon, lat) {
    return Math.abs(Math.round(lat)) + '° ' + (lat >= 0 ? 'north' : 'south') + ', ' + Math.abs(Math.round(lon)) + '° ' + (lon >= 0 ? 'east' : 'west');
  }

  function percentile(hist, n, q) {
    var need = n * q, acc = 0;
    for (var i = 0; i < hist.length; i++) { acc += hist[i]; if (acc >= need) return i; }
    return hist.length - 1;
  }

  function Track() {
    this.id = 'ocean';
    this.title = 'Ocean Pulse';
    this.blurb = 'A year of ocean currents, coloured by sea temperature. Choose where to listen, or drag the ring across the map.';
    this.aspect = '2 / 1';
    this.probe = PRESETS[0]; this.rate = 1; this.beat = 0; this.playing = false; this.timer = null; this.last = null; this.lastMonth = -1;
    var n = AW * AH;
    this.kind = new Uint8Array(n);        // 0 = dark water, 1 = flow line, 2 = land
    this.temp = new Float32Array(n);
    this.val = new Float32Array(n);
    this.lum = new Float32Array(n);
    this.diff = new Float32Array(n);
    this.cos = new Float32Array(AH);      // an equal-angle map stretches the poles: weight rows by cos(latitude)
    for (var y = 0; y < AH; y++) this.cos[y] = Math.cos((90 - (y + 0.5)) * Math.PI / 180);
    this.sources = [
      'Picture: <cite>Global Sea Surface Currents and Temperature</cite>, NASA Scientific Visualization Studio, visualization 3912 (<a href="https://svs.gsfc.nasa.gov/3912">svs.gsfc.nasa.gov/3912</a>), part of the NASA Earth Information Center collection. Credit: NASA/Goddard Space Flight Center Scientific Visualization Studio. The film shows the ECCO2 ocean model (MIT/JPL) from 25 March 2007 to 3 March 2008.',
      'Temperatures in this track are read back from the colours of that film with NASA\'s colour bar (0 to 32 °C). They are estimates to within a few degrees, not the original model output.'
    ];
    var stops = BAR_CSS.join(', ');
    this.legend =
      '<dl>' +
      '<dt>Pitch of the low tone</dt><dd>Sea surface temperature where you listen. Cold water sounds deep. Warm water sounds high.</dd>' +
      '<dt>Bells</dt><dd>A line sweeps through the ring from west to east. Each bell is the temperature of one slice: west in your left ear, east in your right. A missing bell is land.</dd>' +
      '<dt>Brightness and trembling</dt><dd>How dense and bright the current lines are in the picture, and how much the picture is moving.</dd>' +
      '</dl>' +
      '<div class="bar" role="img" aria-label="Colour bar: blue is 0 degrees Celsius, green about 15, yellow about 24, red 32 degrees Celsius." style="background:linear-gradient(90deg, ' + stops + ')"></div>' +
      '<div class="bar-ticks" aria-hidden="true"><span>0 °C</span><span>8</span><span>16</span><span>24</span><span>32 °C</span></div>' +
      '<p>The picture is NASA\'s. The sound is made live from the colours in it, frame by frame. Lines are sea surface currents; their colour is the temperature of the water.</p>';
  }

  Track.prototype.mount = function (host) {
    var self = this; this.host = host;
    host.screen.innerHTML =
      '<video muted loop playsinline preload="auto" aria-hidden="true" tabindex="-1" src="' + FILM + '"></video>' +
      '<canvas class="overlay" tabindex="0" role="application" aria-label="Ocean map. Arrow keys move the listening ring. Press D to hear a description."></canvas>' +
      '<div class="wait">Loading NASA’s film…</div>';
    this.video = host.screen.querySelector('video');
    this.overlay = host.screen.querySelector('canvas');
    this.wait = host.screen.querySelector('.wait');
    this.scratch = document.createElement('canvas'); this.scratch.width = AW; this.scratch.height = AH;
    this.sctx = this.scratch.getContext('2d', { willReadFrequently: true });
    this.fresh = true;

    var chips = PRESETS.map(function (p) {
      return '<button type="button" class="chip" data-id="' + p.id + '" aria-pressed="' + (p === self.probe) + '">' + p.name + '</button>';
    }).join('');
    host.controls.innerHTML =
      '<div class="chips" role="group" aria-label="Where to listen">' + chips + '</div>' +
      '<label>Speed <select id="oc-speed"><option value="0.5">Slow</option><option value="1" selected>Normal</option><option value="2">Fast</option></select></label>' +
      '<p class="hint">Or drag the ring on the map. Arrow keys move it 5 degrees; hold Shift for 1 degree.</p>';
    host.controls.querySelector('.chips').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      self.setProbe(PRESETS.filter(function (p) { return p.id === b.dataset.id; })[0], true);
    });
    var sp = host.controls.querySelector('#oc-speed'); sp.value = String(this.rate);
    sp.addEventListener('change', function () { self.rate = +sp.value; self.video.playbackRate = self.rate; if (self.playing) { self.clock(false); self.clock(true); } });

    this.video.addEventListener('loadeddata', function () { self.wait.hidden = true; self.refresh(false); });
    this.video.addEventListener('seeked', function () { if (!self.playing) self.refresh(false); });
    this.video.addEventListener('error', function () { self.wait.hidden = false; self.wait.textContent = 'NASA’s film could not be loaded. The Arctic Pulse track still works.'; });

    var dragging = false;
    function fromPointer(e) {
      var r = self.overlay.getBoundingClientRect();
      var lon = (e.clientX - r.left) / r.width * 360 - 180, lat = 90 - (e.clientY - r.top) / r.height * 180;
      self.moveTo(lon, lat, false);
    }
    this.overlay.addEventListener('pointerdown', function (e) { dragging = true; self.overlay.setPointerCapture(e.pointerId); fromPointer(e); });
    this.overlay.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
    this.overlay.addEventListener('pointerup', function () { dragging = false; self.speakSoon(); });
    this.overlay.addEventListener('pointercancel', function () { dragging = false; });
    this._resize = function () { self.draw(); };
    window.addEventListener('resize', this._resize);
    this.setReadout();
    this.draw();
  };

  Track.prototype.unmount = function () {
    this.pause(true); clearTimeout(this._speak);
    window.removeEventListener('resize', this._resize);
    this.video.removeAttribute('src'); this.video.load();
  };

  Track.prototype.clock = function (on) {
    var self = this; clearInterval(this.timer); this.timer = null;
    if (on) this.timer = setInterval(function () { self.tick(); }, 250 / this.rate);   // four beats a second
  };

  Track.prototype.play = function () {
    this.playing = true; this.video.playbackRate = this.rate;
    var p = this.video.play(); if (p && p.catch) p.catch(function () {});
    this.tick(); this.clock(true);
  };

  Track.prototype.pause = function (quiet) {
    this.playing = false; this.clock(false);
    if (this.video) this.video.pause();
    this.host.engine.hush();
    if (!quiet) this.host.announce(this.describe());
  };

  /** Choose a preset (or the whole ocean). */
  Track.prototype.setProbe = function (p, speak) {
    this.probe = p; this.beat = 0;
    var chips = this.host.controls.querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) chips[i].setAttribute('aria-pressed', String(chips[i].dataset.id === p.id));
    this.refresh(true);
    if (speak) this.host.announce(this.describe());
  };

  /** Move the ring to any point on the map. */
  Track.prototype.moveTo = function (lon, lat, speak) {
    lon = ((lon + 180) % 360 + 360) % 360 - 180; lat = Math.max(-80, Math.min(80, lat));
    var r = this.probe.whole ? 12 : this.probe.r;
    this.setProbe({ id: 'custom', name: seaName(lon, lat), lon: lon, lat: lat, r: r }, speak);
  };

  Track.prototype.speakSoon = function () {
    var self = this; clearTimeout(this._speak);
    this._speak = setTimeout(function () { self.host.announce(self.describe()); }, 350);
  };

  /** Read the current film frame into the analysis arrays. Returns false if no frame is available. */
  Track.prototype.analyse = function () {
    var v = this.video; if (!v || v.readyState < 2) return false;
    var px;
    try { this.sctx.drawImage(v, 0, 0, AW, AH); px = this.sctx.getImageData(0, 0, AW, AH).data; }
    catch (err) {
      this.wait.hidden = false;
      this.wait.textContent = 'The browser will not let this page read the film when it is opened straight from a folder. Open it through a web address instead.';
      return false;
    }
    var kind = this.kind, temp = this.temp, val = this.val, lum = this.lum, diff = this.diff, fresh = this.fresh;
    for (var i = 0, k = 0; k < AW * AH; i += 4, k++) {
      var r = px[i], g = px[i + 1], b = px[i + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      var value = mx / 255, sat = mx ? d / mx : 0, l = (r + g + b) / 765;
      diff[k] = fresh ? 0 : Math.abs(l - lum[k]); lum[k] = l;
      if (sat < 0.15 && value > 0.2) { kind[k] = 2; continue; }               // grey: land
      if (sat > 0.4 && value > 0.16) {                                         // coloured: a flow line
        var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
        h *= 60; if (h < 0) h += 360;
        kind[k] = 1; temp[k] = hueToTemp(h); val[k] = value;
      } else kind[k] = 0;
    }
    this.fresh = false;
    return true;
  };

  Track.prototype.width = function () { return this.probe.whole ? AW : 2 * this.probe.r + 1; };

  /** Measure columns ia..ib-1 of the listening area (the whole area when called without arguments). */
  Track.prototype.measure = function (ia, ib) {
    var p = this.probe, whole = !!p.whole, r = p.r || 0;
    var cx = whole ? 180 : Math.floor(p.lon + 180), cy = whole ? 90 : Math.floor(90 - p.lat);
    var left = whole ? 0 : cx - r, y0 = whole ? 0 : Math.max(0, cy - r), y1 = whole ? AH - 1 : Math.min(AH - 1, cy + r);
    if (ia == null) { ia = 0; ib = this.width(); }
    var sw = 0, st = 0, sv = 0, sm = 0, lit = 0, land = 0, water = 0, total = 0, hist = new Uint16Array(33);
    var nT = 0, nW = 0, sT = 0, sW = 0;
    for (var y = y0; y <= y1; y++) {
      var w = this.cos[y], dy = y - cy;
      for (var i = ia; i < ib; i++) {
        var dx = left + i - cx;
        if (!whole && dx * dx + dy * dy > r * r) continue;
        var k = y * AW + ((left + i) % AW + AW) % AW;
        total++;
        if (this.kind[k] === 2) { land++; continue; }
        water++; sm += this.diff[k];
        if (this.kind[k] === 1) {
          var t = this.temp[k];
          lit++; sw += w; st += t * w; sv += this.val[k]; hist[Math.round(t)]++;
          if (y < cy) { nT += t * w; nW += w; } else { sT += t * w; sW += w; }
        }
      }
    }
    return {
      temp: lit ? st / sw : null, lit: lit, water: water, land: land, total: total,
      cover: water ? lit / water : 0, val: lit ? sv / lit : 0, motion: water ? sm / water : 0,
      low: lit ? percentile(hist, lit, 0.05) : null, high: lit ? percentile(hist, lit, 0.95) : null,
      north: nW ? nT / nW : null, south: sW ? sT / sW : null
    };
  };

  /** 0..1: how dense and bright the flow lines are, plus a little of how much the picture changed. */
  function energy(m) { return 0.7 * OP.clamp01((m.cover * m.val - 0.05) / 0.4) + 0.3 * OP.clamp01((m.motion - 0.005) / 0.02); }
  function droneStep(t) { return 3 + Math.round(t / 32 * 12); }

  /** One beat: read the frame, steer the drone, ring one bell for the slice under the sweep line. */
  Track.prototype.tick = function () {
    if (!this.analyse()) return;
    var e = this.host.engine, m = this.last = this.measure();
    if (m.temp == null) e.hush();
    else {
      var en = energy(m);
      e.setDrone({ step: droneStep(m.temp), bright: 0.25 + 0.5 * en, unrest: 0.06 + 0.45 * en, level: 0.6, glide: 0.35 });
    }
    var n = this.probe.whole ? 32 : 16, W = this.width(), b = this.beat % n;
    var col = this.measure(Math.floor(b * W / n), Math.floor((b + 1) * W / n));
    if (col.temp != null && col.lit >= 2) {
      e.bell(droneStep(col.temp) + 5, 0.18 + 0.5 * OP.clamp01(col.lit / Math.max(1, col.total) * 1.4), -0.8 + 1.6 * b / (n - 1));
    }
    this.sweep = (b + 0.5) / n;
    this.beat = (b + 1) % n;
    this.setReadout(); this.draw();
    var month = this.date().getUTCMonth();
    if (month !== this.lastMonth) {            // speak only at the turn of a season: screen readers need room
      if (this.lastMonth !== -1 && month % 3 === 2) this.host.announce(this.describe(true));
      this.lastMonth = month;
    }
  };

  /** Re-read the still frame after the ring moved or the film was sought (also while paused). */
  Track.prototype.refresh = function (ping) {
    if (this.playing) {                         // the arrays from the last beat are still valid: just re-measure
      if (!this.fresh) this.last = this.measure();
      this.setReadout(); this.draw(); return;
    }
    if (this.analyse()) {
      var m = this.last = this.measure();
      if (ping && m.temp != null && this.host.engine.started) this.host.engine.bell(droneStep(m.temp) + 5, 0.5, 0);
    }
    this.setReadout(); this.draw();
  };

  Track.prototype.date = function () {
    var v = this.video, f = v && v.duration ? Math.min(1, v.currentTime / v.duration) : 0;
    return new Date(T0 + f * (T1 - T0));
  };

  Track.prototype.setReadout = function () {
    var m = this.last, d = this.date();
    var when = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
    var what = !m ? '' : m.temp == null ? ' · land, no sea here' : ' · about ' + Math.round(m.temp) + ' °C';
    this.host.setReadout(this.probe.name + what + ' · ' + when);
  };

  Track.prototype.describe = function (brief) {
    var p = this.probe, m = this.last, d = this.date();
    var s = p.name + (p.whole ? '' : ', ' + where(p.lon, p.lat)) + '. ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear() + '. ';
    if (!m) return s + 'Press play to start the film and the sound.';
    if (m.temp == null) return s + 'This is land, or sea with no visible currents. Move the ring to open water to hear it.';
    if (p.whole) s += 'The visible currents average about ' + Math.round(m.temp) + ' °C, from about ' + m.low + ' °C near the poles to about ' + m.high + ' °C in the tropics.';
    else s += 'The sea surface here is about ' + Math.round(m.temp) + ' °C.';
    if (brief) return s;
    if (!p.whole) {
      s += ' The coldest water in the ring is about ' + m.low + ' °C and the warmest about ' + m.high + ' °C.';
      if (m.north != null && m.south != null && Math.abs(m.north - m.south) >= 2) s += ' It is warmer to the ' + (m.north > m.south ? 'north' : 'south') + '.';
      var land = m.land / Math.max(1, m.total);
      if (land > 0.15) s += ' About ' + Math.round(land * 10) * 10 + ' percent of the ring is land.';
    }
    var en = energy(m);
    s += ' The currents look ' + (en < 0.3 ? 'faint and quiet' : en < 0.6 ? 'steady' : 'strong and bright') + '.';
    return s;
  };

  Track.prototype.key = function (e) {
    var step = e.shiftKey ? 1 : 5, p = this.probe, dx = 0, dy = 0;
    if (e.key === 'ArrowRight') dx = step; else if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowUp') dy = step; else if (e.key === 'ArrowDown') dy = -step;
    else return false;
    if (p.whole) this.moveTo(-30, 45, false);    // from the whole ocean, the first key press drops the ring in the North Atlantic
    else this.moveTo(p.lon + dx, p.lat + dy, false);
    this.speakSoon();
    return true;
  };

  Track.prototype.draw = function () {
    var cv = this.overlay; if (!cv) return;
    var box = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = Math.max(1, Math.round(box.width)), H = Math.max(1, Math.round(box.height));
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var p = this.probe, sweep = this.playing && this.sweep != null ? this.sweep : null;
    if (p.whole) {
      if (sweep != null) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(sweep * W, 0); g.lineTo(sweep * W, H); g.stroke(); }
    } else {
      var cx = (p.lon + 180) / 360 * W, cy = (90 - p.lat) / 180 * H, r = p.r / 180 * H;
      g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.rect(0, 0, W, H);
      [-W, 0, W].forEach(function (o) { g.moveTo(cx + o + r, cy); g.arc(cx + o, cy, r, 0, 6.2832, true); });
      g.fill('evenodd');
      [-W, 0, W].forEach(function (o) {
        g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx + o, cy, r, 0, 6.2832); g.stroke();
        if (sweep != null) {
          var x = cx + o - r + sweep * 2 * r, half = Math.sqrt(Math.max(0, r * r - (x - cx - o) * (x - cx - o)));
          g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, cy - half); g.lineTo(x, cy + half); g.stroke();
        }
      });
    }
    var small = W < 520, fs = small ? 11 : 13;
    g.font = '600 ' + fs + 'px system-ui, sans-serif'; g.textBaseline = 'bottom';
    g.shadowColor = '#000'; g.shadowBlur = 4; g.fillStyle = '#fff';
    var d = this.date();
    g.textAlign = 'left'; g.fillText(d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()].slice(0, 3) + ' ' + d.getUTCFullYear(), 10, H - 8);
    g.textAlign = 'right'; g.font = fs + 'px system-ui, sans-serif';
    g.fillText(small ? 'NASA/GSFC Scientific Visualization Studio' : 'NASA/Goddard Space Flight Center Scientific Visualization Studio', W - 10, H - 8);
    g.shadowBlur = 0;
  };

  OP.OceanTrack = Track;
  OP.hueToTemp = hueToTemp;
})();
