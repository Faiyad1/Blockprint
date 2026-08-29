"""Step 3 — score every block on every subscore variant → blocks.geojson.

Reads data/interim/*.parquet, writes app/public/blocks.geojson (EPSG:4326),
overwriting the fake file the frontend was built against. Schema is FROZEN —
see PLAN.md §3.
"""
import geopandas as gpd

from config import INTERIM, OUT, CRS_WEB, decay


def nearest_score(blocks: gpd.GeoDataFrame, feats: gpd.GeoDataFrame) -> list[float]:
    """Distance from each block centroid to nearest feature → decay score."""
    if feats is None or feats.empty:
        return [0.0] * len(blocks)
    joined = gpd.sjoin_nearest(
        blocks.set_geometry(blocks.centroid), feats[["geometry"]], distance_col="d"
    )
    # sjoin_nearest can duplicate on ties — keep first per block
    d = joined.groupby(level=0)["d"].first().reindex(blocks.index)
    return [decay(x) for x in d.fillna(10_000)]


def density_score(blocks: gpd.GeoDataFrame, feats: gpd.GeoDataFrame, radius=400) -> list[float]:
    """Feature count within radius of centroid, min-max normalized 0-100."""
    if feats is None or feats.empty:
        return [0.0] * len(blocks)
    buf = blocks.set_geometry(blocks.centroid.buffer(radius))
    counts = (
        gpd.sjoin(buf, feats[["geometry"]], predicate="contains")
        .groupby(level=0).size().reindex(blocks.index).fillna(0)
    )
    hi = counts.quantile(0.95) or 1  # clip outliers so one bus depot ≠ ceiling
    return [min(100.0, 100.0 * c / hi) for c in counts]


def load(name: str) -> gpd.GeoDataFrame | None:
    p = INTERIM / f"{name}.parquet"
    return gpd.read_parquet(p) if p.exists() else None


def main() -> None:
    blocks = gpd.read_parquet(INTERIM / "blocks.parquet")

    stops = load("stops")
    if stops is None:
        stops = load("osm_transit_fallback")
        if stops is not None:
            stops["step_free"] = False
            stops["has_late_service"] = False

    kerbs = load("osm_kerb_ramps")
    crossings = load("osm_crossings")
    tactile = load("osm_tactile")
    benches = load("osm_benches")
    lit = load("osm_lit_paths")
    footpaths = load("osm_footpaths")
    toilets = load("toilets")
    parks = load("osm_parks")
    play = load("osm_playgrounds")
    arterial = load("osm_arterial")

    b = blocks
    b["transit_any"] = nearest_score(b, stops)
    b["transit_step_free"] = nearest_score(b, stops[stops.step_free] if stops is not None else None)
    b["transit_late"] = nearest_score(b, stops[stops.has_late_service] if stops is not None else None)

    b["walk_general"] = density_score(b, footpaths)
    b["walk_ramps"] = density_score(b, kerbs)
    b["walk_controlled"] = density_score(b, crossings)
    b["walk_tactile"] = density_score(b, tactile)
    b["walk_lit"] = density_score(b, lit)

    b["amen_general"] = density_score(b, benches)  # TODO: blend toilets+water+benches
    b["amen_accessible"] = nearest_score(b, toilets)  # TODO: filter accessible flag
    b["amen_family"] = nearest_score(b, play)
    b["amen_essentials"] = density_score(b, load("osm_pharmacy"))  # TODO: blend doctors+supermarket

    b["green_general"] = nearest_score(b, parks)
    b["green_play"] = nearest_score(b, play)

    if arterial is not None:
        hit = gpd.sjoin(b[["geometry"]], arterial[["geometry"]], predicate="intersects")
        b["arterial"] = b.index.isin(hit.index)
    else:
        b["arterial"] = False

    b["fix"] = None      # filled by 04_fixes.py
    b["explain"] = ""    # stretch: LLM pass

    for col in b.columns:
        if col not in ("mb", "cat", "geometry", "fix", "explain", "arterial"):
            b[col] = b[col].round(0).astype(int)

    b.to_crs(CRS_WEB).to_file(OUT, driver="GeoJSON")
    print(f"wrote {OUT}: {len(b)} blocks — refresh the app")


if __name__ == "__main__":
    main()
