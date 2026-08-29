"""Step 2 — download + clip every feature dataset to the bbox.

Run once; outputs are small GeoParquet files per feature type in data/interim/.
Raw downloads land in data/raw/ and are committed (never re-query live APIs).

Feature types produced (each: point/line geometry + relevant flags):
  stops.parquet        GTFS stops: wheelchair_boarding, has_late_service
  toilets.parquet      accessible flag
  osm_<type>.parquet   kerb_ramps, crossings, tactile, benches, water,
                       pharmacy, doctors, supermarket, changing, lighting,
                       footpaths, playgrounds, arterial roads
  parks.parquet        City of Sydney open space
"""
import io
import json
import zipfile

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point

from config import RAW, INTERIM, BBOX, CRS_METRIC, CRS_WEB

TFNSW_KEY = ""  # <-- paste API key here (or read from env)
GTFS_URL = "https://api.transport.nsw.gov.au/v1/publictransport/timetables/complete/gtfs"
TOILETS_URL = (
    "https://data.gov.au/data/dataset/553b3049-2b8b-46a2-95e6-640d7986a8c1/"
    "resource/34076296-6692-4e30-b627-67b7c4eb1027/download/toiletmapexport_251001_074429.csv"
)

OVERPASS = "https://overpass-api.de/api/interpreter"
# Overpass 406s without a UA identifying the client
HEADERS = {"User-Agent": "Blockprint-hackathon/0.1 (SYNCS Hack 2026 student project)"}
W, S, E, N = BBOX
OSM_QUERIES = {
    "kerb_ramps": f'node["kerb"="lowered"]({S},{W},{N},{E});',
    "crossings": f'node["highway"="crossing"]({S},{W},{N},{E});',
    "tactile": f'node["tactile_paving"="yes"]({S},{W},{N},{E});',
    "benches": f'node["amenity"="bench"]({S},{W},{N},{E});',
    "water": f'node["amenity"="drinking_water"]({S},{W},{N},{E});',
    "pharmacy": f'node["amenity"="pharmacy"]({S},{W},{N},{E});',
    "doctors": f'node["amenity"="doctors"]({S},{W},{N},{E});',
    "supermarket": f'node["shop"="supermarket"]({S},{W},{N},{E});',
    "changing": f'node["changing_table"="yes"]({S},{W},{N},{E});',
    "playgrounds": f'node["leisure"="playground"]({S},{W},{N},{E});',
    "transit_fallback": f'node["public_transport"]({S},{W},{N},{E});',
    # ways need "out center" handled below
    "footpaths": f'way["highway"~"footway|path|pedestrian"]({S},{W},{N},{E});',
    "arterial": f'way["highway"~"primary|secondary|trunk"]({S},{W},{N},{E});',
    "lit_paths": f'way["highway"]["lit"="yes"]({S},{W},{N},{E});',
    "parks": f'way["leisure"~"park|garden"]({S},{W},{N},{E});',
}


def fetch_overpass(name: str, q: str) -> None:
    cache = RAW / f"osm_{name}.json"
    if not cache.exists():
        print(f"overpass: {name}")
        body = f"[out:json][timeout:120];({q});out center;"
        r = requests.post(OVERPASS, data={"data": body}, headers=HEADERS, timeout=180)
        r.raise_for_status()
        cache.write_bytes(r.content)
    data = json.loads(cache.read_text(encoding="utf-8"))
    pts = []
    for el in data["elements"]:
        lon = el.get("lon") or el.get("center", {}).get("lon")
        lat = el.get("lat") or el.get("center", {}).get("lat")
        if lon is None:
            continue
        pts.append({"geometry": Point(lon, lat), **el.get("tags", {})})
    if not pts:
        print(f"  WARNING: 0 features for {name}")
        return
    gdf = gpd.GeoDataFrame(pts, crs=CRS_WEB).to_crs(CRS_METRIC)
    gdf.to_parquet(INTERIM / f"osm_{name}.parquet")
    print(f"  {name}: {len(gdf)}")


def fetch_gtfs() -> None:
    cache = RAW / "gtfs.zip"
    if not cache.exists():
        print("downloading GTFS (large)...")
        r = requests.get(GTFS_URL, headers={"Authorization": f"apikey {TFNSW_KEY}"}, timeout=600)
        r.raise_for_status()
        cache.write_bytes(r.content)
    z = zipfile.ZipFile(cache)
    stops = pd.read_csv(z.open("stops.txt"), dtype=str)
    stops["stop_lat"] = stops["stop_lat"].astype(float)
    stops["stop_lon"] = stops["stop_lon"].astype(float)
    stops = stops[
        stops.stop_lon.between(W, E) & stops.stop_lat.between(S, N)
    ]
    # late service flag: any stop_time departing 22:00-04:59 at this stop.
    # stop_times.txt is huge — read only needed cols, filter to our stop ids.
    st = pd.read_csv(
        z.open("stop_times.txt"), usecols=["stop_id", "departure_time"], dtype=str
    )
    st = st[st.stop_id.isin(set(stops.stop_id))]
    hour = st.departure_time.str.slice(0, 2).astype(int)
    late_ids = set(st.loc[(hour >= 22) | (hour < 5), "stop_id"])
    stops["has_late_service"] = stops.stop_id.isin(late_ids)
    stops["step_free"] = stops.get("wheelchair_boarding", "0") == "1"
    gdf = gpd.GeoDataFrame(
        stops[["stop_id", "step_free", "has_late_service"]],
        geometry=gpd.points_from_xy(stops.stop_lon, stops.stop_lat),
        crs=CRS_WEB,
    ).to_crs(CRS_METRIC)
    gdf.to_parquet(INTERIM / "stops.parquet")
    print(f"stops: {len(gdf)} ({gdf.step_free.sum()} step-free, {gdf.has_late_service.sum()} late)")


def fetch_toilets() -> None:
    cache = RAW / "toilets.csv"
    if not cache.exists():
        print("downloading national toilet map...")
        r = requests.get(TOILETS_URL, headers=HEADERS, timeout=180)
        r.raise_for_status()
        cache.write_bytes(r.content)
    df = pd.read_csv(cache)
    cols = {c.lower(): c for c in df.columns}
    lat, lon = cols.get("latitude"), cols.get("longitude")
    if not lat or not lon:
        print(f"  WARNING: no lat/lon columns in toilet CSV: {list(df.columns)[:12]}")
        return
    df = df[df[lon].between(W, E) & df[lat].between(S, N)]
    acc_cols = [c for c in df.columns if "accessible" in c.lower()]
    df["accessible"] = df[acc_cols].any(axis=1) if acc_cols else False
    gdf = gpd.GeoDataFrame(
        df[["accessible"]],
        geometry=gpd.points_from_xy(df[lon], df[lat]),
        crs=CRS_WEB,
    ).to_crs(CRS_METRIC)
    gdf.to_parquet(INTERIM / "toilets.parquet")
    print(f"toilets: {len(gdf)} ({int(gdf.accessible.sum())} accessible)")


def main() -> None:
    for name, q in OSM_QUERIES.items():
        fetch_overpass(name, q)
    fetch_toilets()
    if TFNSW_KEY:
        fetch_gtfs()
    else:
        print("no TfNSW key yet — using osm_transit_fallback for stops")


if __name__ == "__main__":
    main()
