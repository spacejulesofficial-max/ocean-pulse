/* Ocean Pulse - sound engine.
 * All sound is synthesised live in the browser with the Web Audio API.
 * Nothing is pre-recorded: every tone you hear is computed from the data
 * the page is showing at that moment.
 *
 * NASA Space Apps Challenge 2026 - team Arctic Pulse.
 * Code written with AI assistance (Claude) and reviewed by the team.
 */
(function () {
  'use strict';

  // A minor pentatonic scale keeps any data pattern pleasant to listen to.
  var SCALE = [0, 3, 5, 7, 10];
  var BASE_HZ = 55; // A1

  /** Frequency of scale step `i` (0 = lowest). Five steps per octave. */
  function stepToHz(i) {
    i = Math.max(0, Math.round(i));
    var octave = Math.floor(i / SCALE.length);
    var degree = SCALE[i % SCALE.length];
    return BASE_HZ * Math.pow(2, (octave * 12 + degree) / 12);
  }

  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  function Engine() {
    this.ctx = null;
    this.started = false;
  }

  /** Must be called from a click or key press (browsers require a gesture). */
  Engine.prototype.start = function () {
    if (this.ctx) { this.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    var ctx = this.ctx = new AC();
    var now = ctx.currentTime;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.master.connect(comp); comp.connect(this.analyser); this.analyser.connect(ctx.destination);

    // Reverb: a generated impulse (decaying noise), so no audio file is needed.
    var len = Math.floor(ctx.sampleRate * 3.2);
    var impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = impulse.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = impulse;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.45;
    this.reverb.connect(this.wet); this.wet.connect(this.master);

    // Drone: two slightly detuned oscillators and a sub-octave, through a low-pass filter.
    this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 500; this.filter.Q.value = 0.7;
    this.droneGain = ctx.createGain(); this.droneGain.gain.value = 0.0;
    this.oscA = ctx.createOscillator(); this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator(); this.oscB.type = 'triangle';
    this.sub = ctx.createOscillator(); this.sub.type = 'sine';
    var gA = ctx.createGain(); gA.gain.value = 0.22;
    var gB = ctx.createGain(); gB.gain.value = 0.38;
    var gS = ctx.createGain(); gS.gain.value = 0.35;
    this.oscA.connect(gA); this.oscB.connect(gB); this.sub.connect(gS);
    gA.connect(this.filter); gB.connect(this.filter); gS.connect(this.filter);
    this.filter.connect(this.droneGain);
    this.droneGain.connect(this.master); this.droneGain.connect(this.reverb);

    // Tremolo: a slow oscillator that makes the drone tremble when the data is "restless".
    this.lfo = ctx.createOscillator(); this.lfo.type = 'sine'; this.lfo.frequency.value = 0.3;
    this.lfoDepth = ctx.createGain(); this.lfoDepth.gain.value = 0;
    this.lfo.connect(this.lfoDepth); this.lfoDepth.connect(this.droneGain.gain);

    // Breath: filtered noise, like wind over water.
    var nlen = ctx.sampleRate * 2;
    var nbuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    var nd = nbuf.getChannelData(0);
    for (var j = 0; j < nlen; j++) nd[j] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource(); this.noise.buffer = nbuf; this.noise.loop = true;
    this.noiseFilter = ctx.createBiquadFilter(); this.noiseFilter.type = 'bandpass'; this.noiseFilter.frequency.value = 900; this.noiseFilter.Q.value = 0.6;
    this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0;
    this.noise.connect(this.noiseFilter); this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master); this.noiseGain.connect(this.reverb);

    [this.oscA, this.oscB, this.sub, this.lfo, this.noise].forEach(function (n) { n.start(now); });
    this.setVolume(this._volume == null ? 0.8 : this._volume);
    this.started = true;
  };

  Engine.prototype.setVolume = function (v) {
    this._volume = clamp01(v);
    if (this.ctx) this.master.gain.setTargetAtTime(Math.max(0.0001, this._volume), this.ctx.currentTime, 0.05);
  };

  /**
   * Continuous drone.
   *  step    - scale step (pitch), 0 = lowest
   *  bright  - 0..1, opens the filter
   *  unrest  - 0..1, detune, tremolo and breath noise
   *  level   - 0..1 loudness of the drone
   */
  Engine.prototype.setDrone = function (p) {
    if (!this.ctx) return;
    var t = this.ctx.currentTime, glide = p.glide == null ? 0.18 : p.glide;
    var hz = stepToHz(p.step);
    var unrest = clamp01(p.unrest || 0), bright = clamp01(p.bright == null ? 0.4 : p.bright);
    var level = clamp01(p.level == null ? 0.6 : p.level) * 0.5;
    this.oscA.frequency.setTargetAtTime(hz, t, glide);
    this.oscB.frequency.setTargetAtTime(hz, t, glide);
    this.sub.frequency.setTargetAtTime(hz / 2, t, glide);
    this.oscA.detune.setTargetAtTime(4 + unrest * 30, t, 0.3);
    this.oscB.detune.setTargetAtTime(-(4 + unrest * 30), t, 0.3);
    this.filter.frequency.setTargetAtTime(220 + bright * bright * 3200, t, 0.25);
    this.droneGain.gain.setTargetAtTime(level, t, 0.25);
    this.lfo.frequency.setTargetAtTime(0.25 + unrest * 5.5, t, 0.4);
    this.lfoDepth.gain.setTargetAtTime(level * unrest * 0.55, t, 0.4);
    this.noiseGain.gain.setTargetAtTime(unrest * 0.05 + 0.006, t, 0.4);
    this.noiseFilter.frequency.setTargetAtTime(500 + unrest * 2600, t, 0.4);
  };

  /** A soft bell note. step = scale step, vel = 0..1 loudness, pan = -1..1. */
  Engine.prototype.bell = function (step, vel, pan, delay) {
    if (!this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime + (delay || 0), hz = stepToHz(step);
    vel = clamp01(vel == null ? 0.5 : vel);
    var o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = hz;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2.76; // bell-like partial
    var g2 = ctx.createGain(); g2.gain.value = 0.18;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.02 + vel * 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o1.connect(g); o2.connect(g2); g2.connect(g);
    var out = g;
    if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan || 0)); g.connect(p); out = p; }
    out.connect(this.master); out.connect(this.reverb);
    o1.start(t); o2.start(t); o1.stop(t + 1.6); o2.stop(t + 1.6);
  };

  /** A short crack, used when the ice sets a new record low. */
  Engine.prototype.crack = function (vel) {
    if (!this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * 0.35), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(2600, t); f.frequency.exponentialRampToValueAtTime(350, t + 0.3);
    var g = ctx.createGain(); g.gain.value = 0.25 + clamp01(vel == null ? 0.6 : vel) * 0.45;
    src.connect(f); f.connect(g); g.connect(this.master); g.connect(this.reverb);
    src.start(t);
  };

  /** Fade the continuous voices out (bells ring out by themselves). */
  Engine.prototype.hush = function () {
    if (!this.ctx) return;
    var t = this.ctx.currentTime;
    this.droneGain.gain.setTargetAtTime(0, t, 0.25);
    this.lfoDepth.gain.setTargetAtTime(0, t, 0.1);
    this.noiseGain.gain.setTargetAtTime(0, t, 0.25);
  };

  /** Current output level 0..1 (used for the level meter and for testing). */
  Engine.prototype.level = function () {
    if (!this.analyser) return 0;
    var a = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(a);
    var s = 0; for (var i = 0; i < a.length; i++) s += a[i] * a[i];
    return Math.sqrt(s / a.length);
  };

  window.OceanPulse = window.OceanPulse || {};
  window.OceanPulse.Engine = Engine;
  window.OceanPulse.stepToHz = stepToHz;
  window.OceanPulse.clamp01 = clamp01;
})();
