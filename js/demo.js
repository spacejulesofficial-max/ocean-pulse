/* Ocean Pulse - 30-second guided tour, used to record the project demo.
 * Only active when the address ends in ?demo. It presses the same buttons a visitor would,
 * on a fixed timetable, and shows English captions. Nothing here changes how the sound is made.
 * Code written with AI assistance (Claude) and reviewed by the team.
 */
(function () {
  'use strict';
  if (!/[?&]demo\b/.test(location.search)) return;
  var app = window.OceanPulse.app;
  var ocean = app.tracks[0], arctic = app.tracks[1];

  var cap = document.createElement('div'); cap.className = 'demo-caption'; cap.hidden = true;
  var start = document.createElement('button'); start.type = 'button'; start.className = 'primary demo-start'; start.textContent = 'Start the 30-second tour';
  document.body.appendChild(cap);
  var stage = document.querySelector('.stage'); stage.parentNode.insertBefore(start, stage);

  function say(text) { cap.hidden = !text; cap.textContent = text; }
  function chip(id) { var b = document.querySelector('.chip[data-id="' + id + '"]'); if (b) b.click(); }
  function choose(id, value) { var s = document.getElementById(id); s.value = value; s.dispatchEvent(new Event('change')); }

  // [seconds from start, what happens]
  var plan = [
    [0, function () { app.select(ocean); chip('whole'); app.setPlaying(true); say('Team Arctic Pulse · NASA Space Apps 2026 · The Earth Information Jukebox'); }],
    [3.5, function () { say('Ocean Pulse: Earth science you can hear.'); }],
    [6.5, function () { chip('norway'); say('NASA’s ocean film is read frame by frame. Cold water sounds deep…'); }],
    [10.5, function () { chip('indian'); say('…and warm water sounds high. Choose your own sea.'); }],
    [14.5, function () { chip('gulf'); say('West in your left ear, east in your right. Silence is land.'); }],
    [18, function () { say('Made for blind and low-vision listeners: keyboard, screen reader, spoken descriptions.'); }],
    [21, function () {
      app.select(arctic); choose('arc-mode', 'sept'); choose('arc-speed', 'fast'); arctic.seek(18); app.setPlaying(true);
      say('Arctic Pulse: 47 years of sea ice, with NASA temperature data. Each crack is a new record low.');
    }],
    [25.5, function () { say('When everyone can hear the planet, everyone can care for it.'); }],
    [28, function () { app.setPlaying(false, true); say('Ocean Pulse · ocean-pulse.netlify.app'); start.hidden = false; }]
  ];

  start.addEventListener('click', function () {
    start.hidden = true;
    stage.scrollIntoView({ block: 'start' });
    plan.forEach(function (p) { setTimeout(p[1], p[0] * 1000); });
  });
})();
