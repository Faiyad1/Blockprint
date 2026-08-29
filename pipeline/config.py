"""Shared pipeline config. All scripts import from here."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
INTERIM = ROOT / "data" / "interim"
OUT = ROOT / "app" / "public" / "blocks.geojson"

# Metre-true projected CRS for GDA2020 / Sydney (buffers, distances)
CRS_METRIC = "EPSG:7856"
CRS_WEB = "EPSG:4326"

# Sydney CBD-ish bounding box (lon/lat) — widen later if the LGA clip allows
BBOX = (151.14, -33.93, 151.24, -33.85)

# Distance decay defaults (metres): full score within D_FULL, zero at D_ZERO.
# Personas override these client-side; the pipeline bakes variants at defaults.
D_FULL = 200
D_ZERO = 800

RAW.mkdir(parents=True, exist_ok=True)
INTERIM.mkdir(parents=True, exist_ok=True)


def decay(dist_m: float, d_full: float = D_FULL, d_zero: float = D_ZERO) -> float:
    """0-100 score from distance to nearest feature."""
    if dist_m <= d_full:
        return 100.0
    if dist_m >= d_zero:
        return 0.0
    return 100.0 * (d_zero - dist_m) / (d_zero - d_full)
