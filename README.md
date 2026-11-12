# Paso a Paso

A small web app for learning casino, the Cuban way of dancing salsa, one count at a time.

## What it does

- **Dance floor** – animated footprints for the basic steps, and a view from above of both
  dancers for partner figures. Everything moves in time with the music.
- **Moves** – ten moves in three levels (paso básico, guapea, dile que no, enchufla,
  vacílala, sombrero and more), each with a count-by-count breakdown for leader and follower.
- **Rhythm** – a synthesised practice band (clave, campana, conga, bajo, güiro) you can
  switch on one instrument at a time, tempo presets, and a "find the 1" tapping game.
- **Rueda** – a caller that picks random figures and calls them a few counts early.

Progress, role and tempo are remembered in the browser (`localStorage`).

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

## How it is built

| File | Role |
| --- | --- |
| `index.html` | Page structure and the SVG dance floor |
| `styles.css` | Design tokens (light and dark theme) and layout |
| `app.js` | Move data, the Web Audio engine, and the drawing loop |

The key idea in `app.js`: the audio scheduler and the animation both read the same clock
(`AudioContext.currentTime`). Sounds are queued slightly ahead of time, and every animation
frame asks "where is the music right now?" and draws that exact moment. That is why the feet
land on the beat instead of drifting.

## A note on the dance content

Names and details of figures differ between schools and cities. The floor view is a
schematic of who goes where on which count, not a replacement for a teacher.
