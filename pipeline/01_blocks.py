"""Step 1 — mesh block polygons, clipped and simplified.

Inputs in data/raw/ (downloaded once):
  MB_2021_AUST_SHP_GDA2020.zip   ABS ASGS Ed 3 mesh blocks, whole country
  LGA_2025_AUST_GDA2020.zip      ABS LGA boundaries

Output: data/interim/blocks.parquet  (mb code + geometry, EPSG:7856)
"""
import geopandas as gpd

from config import RAW, INTERIM, BBOX, CRS_METRIC

MESH_BLOCKS = RAW / "MB_2021_AUST_SHP_GDA2020.zip"
LGA = RAW / "LGA_2025_AUST_GDA2020.zip"
LGA_NAME = "Sydney"


def main() -> None:
    print("loading LGA boundary...")
    lga = gpd.read_file(LGA, bbox=BBOX)
    name_col = next(c for c in lga.columns if c.startswith("LGA_NAME"))
    lga = lga[lga[name_col].str.contains(LGA_NAME, case=False, na=False)]
    print(f"  LGA rows: {len(lga)} ({', '.join(lga[name_col])})")

    print("loading mesh blocks in bbox (bbox read keeps this fast)...")
    mb = gpd.read_file(MESH_BLOCKS, bbox=BBOX)
    code_col = next(c for c in mb.columns if c.startswith("MB_CODE"))
    cat_col = next(c for c in mb.columns if c.startswith("MB_CAT"))
    print(f"  mesh blocks in bbox: {len(mb)}")

    mb = mb.to_crs(CRS_METRIC)
    lga = lga.to_crs(CRS_METRIC)

    print("clipping to LGA...")
    keep = mb.sjoin(lga[["geometry"]], predicate="intersects").drop(columns="index_right")
    keep = keep.rename(columns={code_col: "mb", cat_col: "cat"})[["mb", "cat", "geometry"]]
    keep = keep[~keep.geometry.is_empty & keep.geometry.notna()].reset_index(drop=True)

    # browser-friendly geometry; 2 m tolerance is invisible at city scale
    keep["geometry"] = keep.geometry.simplify(2.0)

    out = INTERIM / "blocks.parquet"
    keep.to_parquet(out)
    print(f"wrote {out}: {len(keep)} blocks")


if __name__ == "__main__":
    main()
