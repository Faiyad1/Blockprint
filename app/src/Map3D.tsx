import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { composite, scoreColor, type Persona, type Sub } from "./scoring";
import type { Feature, FeatureCollection } from "geojson";

// Photorealistic city mode: put the Google Cloud Map Tiles key in app/.env as
//   VITE_GOOGLE_TILES_KEY=...        (restrict the key by HTTP referrer)
// No key -> city mode stays hidden and the app is fully offline-capable.
export const GOOGLE_TILES_KEY: string =
  (import.meta.env.VITE_GOOGLE_TILES_KEY as string | undefined) ?? "";

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const WATER_COLOR = "#14384f"; // deep harbour blue, still dark-theme friendly

// Dark-matter paints water near-black; repaint its water layers so the
// harbour/bays read as sea. Falls back to the untouched style URL on failure.
type MapStyle = React.ComponentProps<typeof Map>["mapStyle"];

function useWaterStyle(): MapStyle {
  const [style, setStyle] = useState<MapStyle>(BASEMAP);
  useEffect(() => {
    fetch(BASEMAP)
      .then((r) => r.json())
      .then((s) => {
        for (const layer of s.layers ?? []) {
          if (typeof layer.id === "string" && layer.id.includes("water") && layer.type === "fill") {
            layer.paint = { ...layer.paint, "fill-color": WATER_COLOR };
          }
        }
        setStyle(s);
      })
      .catch(() => setStyle(BASEMAP));
  }, []);
  return style;
}

// framed so Darling Harbour + Circular Quay water is visible behind the blocks
const INITIAL_VIEW = {
  longitude: 151.205,
  latitude: -33.876,
  zoom: 12.9,
  pitch: 50,
  bearing: -12,
};

export type RenderMode = "data" | "city";

interface Props {
  blocks: FeatureCollection | null;
  buildings: FeatureCollection | null;
  persona: Persona;
  customWeights: Record<Sub, number> | undefined;
  selected: Feature | null;
  onSelect: (f: Feature | null) => void;
  mode: RenderMode;
}

export default function Map3D({ blocks, buildings, persona, customWeights, selected, onSelect, mode }: Props) {
  const mapStyle = useWaterStyle();
  const cityMode = mode === "city";
  const useGoogleTiles = cityMode && GOOGLE_TILES_KEY !== "";

  const layers = useMemo(() => {
    const out = [];
    if (useGoogleTiles) {
      out.push(
        new Tile3DLayer({
          id: "google-3d-tiles",
          data: `https://tile.googleapis.com/v1/3dtiles/root.json?key=${GOOGLE_TILES_KEY}`,
          operation: "terrain+draw",
        })
      );
    } else if (cityMode && buildings) {
      // offline city: OSM footprints extruded to tagged heights, committed file
      out.push(
        new GeoJsonLayer({
          id: "osm-buildings",
          data: buildings,
          extruded: true,
          getElevation: (f) => (f.properties?.h as number) ?? 9,
          getFillColor: [72, 80, 92, 235],
          getLineColor: [20, 24, 30, 255],
          material: { ambient: 0.4, diffuse: 0.7, shininess: 24 },
        })
      );
    }
    if (!blocks) return out;
    out.push(
      new GeoJsonLayer({
        id: "score-prisms",
        data: blocks,
        extruded: true,
        pickable: true,
        // translucent over the photorealistic city so Sydney shows through
        opacity: cityMode ? 0.45 : 0.85,
        getElevation: (f) => composite(f.properties ?? {}, persona, customWeights) * 8,
        getFillColor: (f) => {
          const s = composite(f.properties ?? {}, persona, customWeights);
          const [r, g, b] = scoreColor(s);
          const isSel = selected?.properties?.mb === f.properties?.mb;
          return [r, g, b, isSel ? 255 : 200];
        },
        getLineColor: [255, 255, 255, 60],
        lineWidthMinPixels: 1,
        // re-run accessors (not geometry upload) when the persona math changes
        updateTriggers: {
          getElevation: [persona.id, customWeights],
          getFillColor: [persona.id, customWeights, selected?.properties?.mb],
        },
        transitions: { getElevation: 350, getFillColor: 350 },
        onClick: (info) => onSelect((info.object as Feature) ?? null),
      })
    );
    return out;
  }, [blocks, buildings, persona, customWeights, selected, onSelect, cityMode, useGoogleTiles]);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW}
      controller={true}
      layers={layers}
      onClick={(info) => {
        if (!info.layer) onSelect(null);
      }}
      getTooltip={({ object }) => {
        const f = object as Feature | undefined;
        if (!f?.properties) return null;
        const s = composite(f.properties, persona, customWeights);
        return { text: `Block ${f.properties.mb}\n${persona.label}: ${s}/100` };
      }}
    >
      {/* Google tiles bring their own ground; OSM-buildings mode keeps the basemap */}
      {!useGoogleTiles && <Map mapStyle={mapStyle} />}
    </DeckGL>
  );
}
