"""Step 1 — mesh block polygons, clipped and simplified.

Input (place in data/raw/, downloaded once in hour 0):
  - ABS ASGS Ed 3 Mesh Blocks shapefile/GeoPackage for NSW
    https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/latest-release
  - City of Sydney LGA boundary (from the same ASGS release, or City of Sydney Data Hub)

Output: data/interim/blocks.parquet  (mb code + geometry, EPSG:7856)
"""
import geopandas as gpd

from config import RAW, INTERIM, CRS_METRIC

MESH_BLOCKS = RAW / "MB_2021_AUST_GDA2020.gpkg"  # adjust to actual filename
LGA = RAW / "LGA_2024_AUST_GDA2020.gpkg"         # adjust to actual filename
LGA_NAME = "Sydney"


def main() -> None:
    print("loading mesh blocks (this is the big one, be patient)...")
    mb = gpd.read_file(MESH_BLOCKS)
    lga = gpd.read_file(LGA)
    lga = lga[lga["LGA_NAME_2024"].str.contains(LGA_NAME, case=False)]

    mb = mb.to_crs(CRS_METRIC)
    lga = lga.to_crs(CRS_METRIC)

    print("clipping to LGA...")
    keep = mb.sjoin(lga[["geometry"]], predicate="intersects").drop(columns="index_right")
    keep = keep.rename(columns={"MB_CODE_2021": "mb"})[["mb", "geometry"]]

    # browser-friendly geometry; 2 m tolerance is invisible at city scale
    keep["geometry"] = keep.geometry.simplify(2.0)

    out = INTERIM / "blocks.parquet"
    keep.to_parquet(out)
    print(f"wrote {out}: {len(keep)} blocks")


if __name__ == "__main__":
    main()
