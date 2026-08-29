# Blockprint

**SYNCS Hack 2026 · Theme: Blocks that make up the world**

Sydney is literally made of blocks — the ABS Mesh Blocks that make up every suburb. Blockprint scores each one for accessibility and livability from open data (transit, footpaths, ramps, toilets, green space) and renders the city as a 3D landscape where block height and color show the score. Switch persona — wheelchair user, parent with a pram, low vision — and watch the same city transform. Click any block to see the single cheapest fix that would raise its score the most.

## Run it

```bash
cd app
npm install
npm run dev
```

Opens on a fake 20-block dataset so the frontend works immediately.

**Photorealistic city mode** (optional): create `app/.env` containing
`VITE_GOOGLE_TILES_KEY=<Google Cloud Map Tiles API key>`, restart `npm run dev`,
then press **B** or the "show real Sydney" button. Without a key the app is
fully offline-capable and stays in data mode.

Real data comes from the pipeline:

```bash
cd pipeline
pip install -r requirements.txt
python 01_blocks.py   # mesh blocks, clipped + simplified
python 02_ingest.py   # GTFS / toilets / OSM / parks downloads
python 03_score.py    # -> app/public/blocks.geojson (overwrites the fake file)
python 04_fixes.py    # intervention optimizer
```

## How it works

- **No runtime backend** — the Python pipeline precomputes every subscore variant per block into one static GeoJSON; the browser computes persona composites as weighted sums, so switching personas recolors ~20k blocks instantly.
- **Personas are data, not code** — see `app/src/personas.json`: each is four weights + a variant choice per subscore + optional rules.
- Stack: geopandas/shapely pipeline · Vite + React + deck.gl frontend · MapLibre basemap.

## Data sources

ABS ASGS Mesh Blocks · Transport for NSW Open Data (GTFS) · National Public Toilet Map (data.gov.au) · City of Sydney Data Hub · © OpenStreetMap contributors (ODbL)
