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
TOILETS_URL = ""  # national toilet map CSV/GeoJSON URL from data.gov.au
PARKS_URL = ""    # City of Sydney Data Hub GeoJSON endpoint

OVERPASS = "https://overpass-api.de/api/interpreter"
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
}


def fetch_overpass(name: str, q: str) -> None:
    cache = RAW / f"osm_{name}.json"
    if not cache.exists():
        print(f"overpass: {name}")
        body = f"[out:json][timeout:120];({q});out center;"
        r = requests.post(OVERPASS, data={"data": body}, timeout=180)
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


def main() -> None:
    for name, q in OSM_QUERIES.items():
        fetch_overpass(name, q)
    if TFNSW_KEY:
        fetch_gtfs()
    else:
        print("no TfNSW key yet — using osm_transit_fallback for stops")
    # TODO hour-1: toilets (TOILETS_URL) and parks (PARKS_URL), same pattern.


if __name__ == "__main__":
    main()
