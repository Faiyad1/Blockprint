"""Step 4 — the fix-it optimizer.

For each block, simulate adding one feature at the block centroid and measure
the composite gain under the persona that intervention serves best:

  kerb ramp          -> walk_ramps      (wheelchair, weight .35)
  accessible toilet  -> amen_accessible (wheelchair, weight .20)
  tactile paving     -> walk_tactile    (low vision, weight .40)
  controlled crossing-> walk_controlled (older,      weight .30)
  bench              -> amen_general    (older,      weight .25)

Density subscores: one extra feature raises this block's count by 1, so the
subscore delta is 100/hi (hi = the 95th-quantile count used to normalize in
03_score), capped at 100. Nearest-distance subscores (accessible toilet) jump
to 100. Composite gain = persona weight x subscore delta.

Writes the best fix per block into blocks.geojson as:
  {"what": "kerb ramp near <street>", "gain": 12, "persona": "wheelchair"}
Blocks already scoring well on everything keep fix = null.
"""
import geopandas as gpd
import numpy as np

from config import INTERIM, OUT, CRS_METRIC, CRS_WEB

DENSITY_RADIUS = 400  # must match 03_score.density_score


def counts_and_hi(blocks: gpd.GeoDataFrame, feats: gpd.GeoDataFrame | None):
    """Per-block feature count within radius + the normalization ceiling."""
    if feats is None or feats.empty:
        return np.zeros(len(blocks)), 1.0
    buf = blocks.set_geometry(blocks.centroid.buffer(DENSITY_RADIUS))
    c = (
        gpd.sjoin(buf, feats[["geometry"]], predicate="contains")
        .groupby(level=0).size().reindex(blocks.index).fillna(0)
    )
    hi = c.quantile(0.95) or 1.0
    return c.to_numpy(), float(hi)


def load(name: str) -> gpd.GeoDataFrame | None:
    p = INTERIM / f"{name}.parquet"
    return gpd.read_parquet(p) if p.exists() else None


def main() -> None:
    blocks = gpd.read_file(OUT).to_crs(CRS_METRIC)

    streets = load("osm_arterial")
    named = None
    if streets is not None and "name" in streets.columns:
        named = streets[streets["name"].notna()][["name", "geometry"]]

    # candidate -> (score column, persona, persona weight, density feature set)
    candidates = {
        "kerb ramp": ("walk_ramps", "wheelchair", 0.35, load("osm_kerb_ramps")),
        "tactile paving": ("walk_tactile", "lowvision", 0.40, load("osm_tactile")),
        "controlled crossing": ("walk_controlled", "older", 0.30, load("osm_crossings")),
        "bench": ("amen_general", "older", 0.25, load("osm_benches")),
        "accessible toilet": ("amen_accessible", "wheelchair", 0.20, None),  # nearest-based
    }

    gains = {}
    for label, (col, persona, weight, feats) in candidates.items():
        old = blocks[col].to_numpy(dtype=float)
        if label == "accessible toilet":
            sub_delta = 100.0 - old
        else:
            # city-wide density normalization undervalues one local feature;
            # floor the marginal effect at 15 pts for the block it lands in
            _, hi = counts_and_hi(blocks, feats)
            sub_delta = np.minimum(100.0 - old, max(100.0 / hi, 15.0))
        gains[label] = weight * np.maximum(sub_delta, 0.0)

    labels = list(gains)
    matrix = np.column_stack([gains[l] for l in labels])
    best_idx = matrix.argmax(axis=1)
    best_gain = matrix.max(axis=1)

    # nearest named street for a human-readable location
    where = [""] * len(blocks)
    if named is not None and not named.empty:
        cent = blocks.set_geometry(blocks.centroid)
        near = gpd.sjoin_nearest(cent, named, distance_col="d", max_distance=500)
        first = near.groupby(level=0).first()
        for i, row in first.iterrows():
            where[i] = str(row["name"])

    fixes = []
    for i in range(len(blocks)):
        gain = round(float(best_gain[i]))
        if gain < 2:
            fixes.append(None)
            continue
        label = labels[int(best_idx[i])]
        _, persona, _, _ = candidates[label]
        what = f"{label} near {where[i]}" if where[i] else label
        fixes.append({"what": what, "gain": gain, "persona": persona})

    blocks["fix"] = fixes
    blocks.to_crs(CRS_WEB).to_file(OUT, driver="GeoJSON")
    n = sum(f is not None for f in fixes)
    print(f"wrote {OUT}: {n}/{len(blocks)} blocks got a fix recommendation")


if __name__ == "__main__":
    main()
