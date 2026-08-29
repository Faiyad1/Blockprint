# Blockprint

**SYNCS Hack 2026 · Theme: Blocks that make up the world**

**Live demo: https://faiyad1.github.io/Hackathon26/**

Sydney is literally made of blocks — the ABS Mesh Blocks that make up every suburb. Blockprint scores each one for accessibility and livability from open data (transit, footpaths, ramps, toilets, green space) and renders the city as a 3D landscape where block height and color show the score. Switch persona — wheelchair user, parent with a pram, low vision — and the same city transforms. Click any block to see the single cheapest fix that would raise its score the most.

---

## How to run

### Prerequisites

- **Node.js 22+** and npm
- **Python 3.12+** (only needed to regenerate the data — the repo already ships scored data)

### 1. Run the app (this is all you need for the demo)

```bash
cd app
npm install
npm run dev
```

Open **http://localhost:5173**. The repo already contains the fully scored `app/public/blocks.geojson` (2,429 real Sydney mesh blocks) and `buildings.geojson` (20,593 OSM buildings), so the app works immediately — no pipeline, no API keys.

**Controls**

| Action | How |
|---|---|
| Move / rotate / tilt | drag · right-click-drag (or Ctrl+drag) · scroll |
| Switch persona | chips at the top (`more…` for extended personas) |
| Adjust score coefficients | **🎛️ score weights** button, top right — Detailed tab has all 14 characteristics |
| Block details | hover for the scorecard tooltip, click for the full panel + recommended fix |
| Toggle pure data view (hide buildings) | press **B** |

### 2. Regenerate the data (optional)

Only needed if you change the scoring or want fresh data. Runs in order:

```bash
cd pipeline
pip install -r requirements.txt
python 01_blocks.py    # ABS mesh blocks -> clipped + simplified polygons
python 02_ingest.py    # OSM / toilet map / GTFS downloads (cached in data/raw)
python 03_score.py     # scores every block -> app/public/blocks.geojson
python 04_fixes.py     # per-block highest-impact fix recommendations
```

Notes:

- `01_blocks.py` needs two ABS zips in `data/raw/` (not in git — too big for GitHub):
  [Mesh Blocks 2021 SHP GDA2020](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files/MB_2021_AUST_SHP_GDA2020.zip)
  and [LGA 2025 GDA2020](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs/edition-3-july-2021-june-2026/access-and-downloads/digital-boundary-files/LGA_2025_AUST_GDA2020.zip).
- **TfNSW GTFS** (real step-free + late-night transit data) needs a free API token from
  [opendata.transport.nsw.gov.au](https://opendata.transport.nsw.gov.au/) — put it in
  `pipeline/tfnsw_key.txt` (gitignored) or the `TFNSW_KEY` env var. Without it the
  pipeline falls back to OSM stops automatically.
- All other downloads (OSM via Overpass, National Toilet Map) need no keys and are
  cached in `data/raw/` after the first run.

### 3. Deploy

Every push to `main` auto-builds and republishes the live site via GitHub Actions (`.github/workflows/deploy.yml`) — about 2 minutes from push to live.

Optional: photorealistic Google 3D Tiles instead of OSM buildings — put a Google Cloud Map Tiles API key in `app/.env` as `VITE_GOOGLE_TILES_KEY=...` (gitignored).

---

## How it works

- **No runtime backend.** The Python pipeline precomputes every subscore variant per block into one static GeoJSON; the browser computes persona composites as weighted sums, so switching personas recolors ~2,400 blocks instantly and the demo cannot go down.
- **Personas are data, not code** — `app/src/personas.json`: each is four weights + a variant choice per subscore + optional rules (stairs-as-walls, soft step-free, arterial penalty).
- **Fix-it optimizer** simulates five candidate interventions per block (kerb ramp, tactile paving, controlled crossing, bench, accessible toilet) and keeps the one with the largest score gain under the persona it serves.
- Parkland and water mesh blocks are shown unscored — parks are amenities *for* blocks, not places people live.
- Stack: geopandas/shapely pipeline · Vite + React + deck.gl frontend · MapLibre basemap.

## Data sources

ABS ASGS Mesh Blocks · Transport for NSW Open Data (GTFS) · National Public Toilet Map (data.gov.au) · © OpenStreetMap contributors (ODbL)
