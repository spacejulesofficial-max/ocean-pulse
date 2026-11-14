# Ocean Pulse – an Earth jukebox

**NASA Space Apps Challenge 2026 · Challenge: The Earth Information Jukebox · Team Arctic Pulse (Norway)**

Ocean Pulse lets you *hear* NASA's Earth visualizations. Pick a track, press Play, and the page turns
what is on screen into sound, live, in your browser. It is built so that it works without sight:
everything can be done from the keyboard, and the page tells a screen reader in words what the
picture is showing.

## The two tracks

### 1. Ocean Pulse – the picture becomes the sound

The page plays NASA's film *Global Sea Surface Currents and Temperature* (Scientific Visualization
Studio, visualization 3912, part of the Earth Information Center collection) and reads it frame by
frame while it plays.

- Each frame is drawn onto a hidden 360 × 180 canvas, so **one analysed pixel is one degree** of
  longitude by one degree of latitude.
- Grey pixels are land. Coloured pixels are current lines. Black pixels are water with no line.
- The colour of each line is turned back into a temperature with NASA's own colour bar
  (blue = 0 °C, red = 32 °C).
- You choose **where to listen**: the whole ocean, one of seven named regions, or anywhere you drag
  the ring (arrow keys also move it).

| What you hear | What it means |
| --- | --- |
| Pitch of the low tone | Sea surface temperature inside the ring. Cold is deep, warm is high. |
| Bells | A line sweeps the ring from west to east. Each bell is one slice: west in the left ear, east in the right. A missing bell is land. |
| Brightness and trembling | How dense and bright the current lines are, and how much the picture is moving. |

### 2. Arctic Pulse – the numbers become the sound

572 months of measured Arctic sea ice extent, January 1979 to October 2026, with Arctic air
temperature from NASA GISTEMP.

| What you hear | What it means |
| --- | --- |
| Pitch of the low tone | Sea ice extent. A lot of ice is deep, less ice is higher. |
| Trembling and wind | Arctic air temperature that year. Warmer is more restless. |
| Bells | A low bell each March (yearly maximum), a higher bell each September (yearly minimum). |
| A crack | A new record-low September. |

All notes are tuned to one five-note (pentatonic) scale, so any data pattern stays pleasant to
listen to, and the two tracks follow the same rule: **a warmer world sounds higher.**

## Accessibility

- Works from the keyboard alone: `Space` play/pause, arrow keys move through the data, `D` describes
  what is on screen.
- A live text region tells screen readers what is happening, in full sentences, but only now and
  then, so speech does not drown the sound.
- The track list is a real radio group; sliders announce values in words
  ("September 2012, 3.57 million square kilometres").
- Large controls, visible focus, high contrast, respects "reduce motion".
- Stereo is used as information: west is left, east is right.

## Data and resources

| Resource | Used for | Credit |
| --- | --- | --- |
| [Global Sea Surface Currents and Temperature, SVS 3912](https://svs.gsfc.nasa.gov/3912) (ECCO2 model, 25 March 2007 – 3 March 2008) | The film and colour bar in the Ocean Pulse track | NASA/Goddard Space Flight Center Scientific Visualization Studio |
| [NASA GISS Surface Temperature Analysis (GISTEMP v4)](https://data.giss.nasa.gov/gistemp/), zonal annual means 64°N–90°N | Arctic air temperature in the Arctic Pulse track | NASA Goddard Institute for Space Studies |
| [Sea Ice Index, Version 4 (G02135)](https://nsidc.org/data/g02135), monthly Northern Hemisphere extent | Sea ice extent in the Arctic Pulse track | Sea Ice Index, National Snow and Ice Data Center |

## Honest limits

- Temperatures in the Ocean Pulse track are **estimates read from the colours of the picture**, good
  to within a few degrees. They are not the original ECCO2 model values. Averages only count water
  where a current line is visible, and rows are weighted by the cosine of latitude because a flat
  map stretches the poles.
- The film shows one model year (2007–2008). It does not show a trend.
- The ice cap in the Arctic Pulse track is a stylised disc. Its area is to scale; its shape is not a map.
- Two months (December 1987, January 1988) are missing in the sea ice record. The 2026 temperature
  uses the 2025 value, because the yearly figure for 2026 does not exist yet.

## Run it

It is a static site: plain HTML, CSS and JavaScript, no build step, no server code, no tracking.

- Online: open the project link.
- On your own machine: serve the folder with any web server, for example `python -m http.server`,
  and open `http://localhost:8000`. (Opened straight from a folder, the Arctic Pulse track works,
  but browsers do not allow a page to read video pixels from `file://`, so the Ocean Pulse track needs
  a web address.)

```
index.html
css/style.css
js/audio.js      sound engine (Web Audio API, nothing pre-recorded)
js/ocean.js      reads the NASA film frame by frame
js/arctic.js     plays the sea ice record
js/app.js        the jukebox: track list, play, volume, keyboard, announcements
js/demo.js       30-second guided tour for the demo recording (only with ?demo)
data/arctic-data.js
media/ecco2_sst_flow.webm   NASA's film, unchanged
```

## Use of AI

- **Code:** written with AI assistance (Claude, Anthropic) during the hackathon, directed, tested and
  reviewed by the team. This is also stated in the source files and in the page footer.
- **Idea:** the idea – to let people hear the ocean and choose which sea to listen to – is the
  team's own.
- **Images, video, audio:** none are AI-generated. The picture is NASA's film, unchanged. The sound is
  synthesised live from the data by ordinary oscillators and filters.

## Credits

Made by team Arctic Pulse (Julie Elvestad, Lindås, Norway).
NASA does not endorse this project. NASA imagery is used under NASA's media usage guidelines.
