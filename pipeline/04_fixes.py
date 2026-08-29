"""Step 4 (overnight) — the fix-it optimizer.

For each block, simulate candidate interventions and keep the one with the
largest composite gain under the Wheelchair persona (our headline persona).

Candidates (each = "add one feature at the block centroid"):
  kerb ramp        -> walk_ramps recomputed with one extra kerb point
  controlled xing  -> walk_controlled likewise
  bench            -> amen_general likewise
  accessible toilet-> amen_accessible distance becomes ~0

Approach: reuse nearest_score/density_score from 03_score with the candidate
point appended, diff the wheelchair composite, argmax. Precompute for all
blocks, merge into blocks.geojson as the `fix` property:
  {"what": "kerb ramp, <nearest street name>", "gain": <int>, "persona": "wheelchair"}

Street names: reverse-lookup nearest OSM way name from osm_footpaths/arterial
tags — good enough for the demo.

TODO overnight (Role B). Keep it simple: 4 candidates x ~20k blocks x cheap
recompute is fine in numpy/geopandas; no need to be clever.
"""

if __name__ == "__main__":
    raise SystemExit("TODO: implement after Milestone 2 — see docstring")
