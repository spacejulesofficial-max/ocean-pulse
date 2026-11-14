/* Ocean Pulse - the jukebox itself: track list, play button, volume, keyboard and announcements.
 * Code written with AI assistance (Claude) and reviewed by the team.
 */
(function () {
  'use strict';
  var OP = window.OceanPulse;
  var $ = function (id) { return document.getElementById(id); };
  var engine = new OP.Engine();
  var tracks = [new OP.OceanTrack(), new OP.ArcticTrack()];
  var current = null, playing = false;
  var els = { list: $('tracklist'), screen: $('screen'), play: $('play'), volume: $('volume'), meter: $('meter').firstElementChild,
              controls: $('track-controls'), readout: $('readout'), now: $('now'), legend: $('legend'), sources: $('sources') };

  /** What a track is allowed to touch. */
  var host = {
    engine: engine, screen: els.screen, controls: els.controls,
    setReadout: function (text) { els.readout.textContent = text; },
    /** Text for screen readers (and for everyone, under the picture). */
    announce: function (text) { els.now.textContent = text; },
    /** A track calls this when it has reached its end. */
    stop: function () { setPlaying(false, true); }
  };

  function setPlaying(on, quiet) {
    if (on === playing) return;
    playing = on;
    if (on) { engine.start(); current.play(); }
    else current.pause(quiet);
    els.play.textContent = on ? 'Pause' : 'Play';
    els.play.dataset.state = on ? 'playing' : 'paused';
  }

  function select(track, focus) {
    if (track === current) return;
    if (current) { if (playing) setPlaying(false, true); current.unmount(); }
    current = track;
    var radios = els.list.querySelectorAll('[role="radio"]');
    for (var i = 0; i < radios.length; i++) {
      var mine = radios[i].dataset.id === track.id;
      radios[i].setAttribute('aria-checked', String(mine)); radios[i].tabIndex = mine ? 0 : -1;
      if (mine && focus) radios[i].focus();
    }
    els.screen.style.aspectRatio = track.aspect || '16 / 9';
    els.legend.innerHTML = track.legend;
    els.sources.innerHTML = track.sources.map(function (s) { return '<li>' + s + '</li>'; }).join('');
    els.readout.textContent = '';
    track.mount(host);
    host.announce(track.title + '. ' + track.blurb + ' Press Play to listen.');
    try { history.replaceState(null, '', '#' + track.id); } catch (e) {}
  }

  // Track list: a radio group, as in a real jukebox - exactly one record is on.
  els.list.innerHTML = tracks.map(function (t) {
    return '<button type="button" class="track" role="radio" aria-checked="false" tabindex="-1" data-id="' + t.id + '"><strong>' + t.title + '</strong><span>' + t.blurb + '</span></button>';
  }).join('');
  els.list.addEventListener('click', function (e) {
    var b = e.target.closest('[role="radio"]'); if (!b) return;
    select(tracks.filter(function (t) { return t.id === b.dataset.id; })[0]);
  });
  els.list.addEventListener('keydown', function (e) {
    var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
    if (!dir) return;
    e.preventDefault(); e.stopPropagation();
    select(tracks[(tracks.indexOf(current) + dir + tracks.length) % tracks.length], true);
  });

  els.play.addEventListener('click', function () { setPlaying(!playing); });

  function volume() {
    var v = +els.volume.value;
    engine.setVolume(Math.pow(v / 100, 1.5));
    els.volume.setAttribute('aria-valuetext', v + ' percent');
  }
  els.volume.addEventListener('input', volume); volume();

  // Keyboard: Space plays or pauses, arrows belong to the track, D describes.
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t.tagName;
    var typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (e.key === ' ' || e.code === 'Space') {
      if (typing || tag === 'BUTTON' || tag === 'A') return;      // let the control do its own thing
      e.preventDefault(); setPlaying(!playing);
    } else if (e.key === 'd' || e.key === 'D') {
      if (typing) return;
      host.announce(''); setTimeout(function () { host.announce(current.describe()); }, 60);   // re-announce even if unchanged
    } else if (e.key.indexOf('Arrow') === 0) {
      if (typing || (t.getAttribute && t.getAttribute('role') === 'radio')) return;
      if (current.key(e)) e.preventDefault();
    }
  });

  // Level meter (decorative; the same information is in the sound).
  (function meter() {
    els.meter.style.width = Math.min(100, engine.level() * 420) + '%';
    requestAnimationFrame(meter);
  })();

  var wanted = tracks.filter(function (t) { return '#' + t.id === location.hash; })[0];
  select(wanted || tracks[0]);

  OP.app = { engine: engine, tracks: tracks, current: function () { return current; }, playing: function () { return playing; }, select: select, setPlaying: setPlaying };
})();
