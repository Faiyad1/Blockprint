import { useEffect, useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator } from "@deck.gl/core";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { Tile3DLayer } from "@deck.gl/geo-layers";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { composite, compositeAdvanced, scoreColor, type Persona, type Sub } from "./scoring";
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
const HOME_VIEW = {
  longitude: 151.205,
  latitude: -33.876,
  zoom: 12.9,
  pitch: 50,
  bearing: -12,
};

// opening shot: high and flat, then fly down into the tilted city view
const OPENING_VIEW = {
  longitude: 151.205,
  latitude: -33.876,
  zoom: 11.2,
  pitch: 0,
  bearing: 0,
};

export type RenderMode = "data" | "city";

// metres of prism height per score point (100 pts = 100 m)
const ELEVATION_SCALE = 1;

interface Props {
  blocks: FeatureCollection | null;
  buildings: FeatureCollection | null;
  persona: Persona;
  customWeights: Record<Sub, number> | undefined;
  detailedWeights: Record<string, number> | null;
  selected: Feature | null;
  onSelect: (f: Feature | null) => void;
  mode: RenderMode;
  culture: FeatureCollection | null;
  showCulture: boolean;
}

const CULTURE_PINK: [number, number, number] = [255, 92, 168];

export default function Map3D({ blocks, buildings, persona, customWeights, detailedWeights, selected, onSelect, mode, culture, showCulture }: Props) {
  const mapStyle = useWaterStyle();
  const score = (p: object) => {
    const props = p as import("./scoring").BlockProps;
    return detailedWeights ? compositeAdvanced(props, detailedWeights) : composite(props, persona, customWeights);
  };
  const cityMode = mode === "city";
  const [viewState, setViewState] = useState<Record<string, unknown>>(OPENING_VIEW);

  // once the blocks arrive, fly down into the city
  useEffect(() => {
    if (!blocks) return;
    setViewState({
      ...HOME_VIEW,
      transitionDuration: 2500,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }, [blocks]);
  const useGoogleTiles = cityMode && GOOGLE_TILES_KEY !== "";

  // parks and water aren't places people live — leave them unscored/uncolored
  const scored = useMemo(() => {
    if (!blocks) return null;
    return {
      ...blocks,
      features: blocks.features.filter(
        (f) => !["Parkland", "Water"].includes(String(f.properties?.cat ?? ""))
      ),
    };
  }, [blocks]);

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
    if (!scored) return out;
    out.push(
      new GeoJsonLayer({
        id: "score-prisms",
        data: scored,
        extruded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        // translucent over the photorealistic city so Sydney shows through
        opacity: cityMode ? 0.45 : 0.85,
        getElevation: (f) => score(f.properties ?? {}) * ELEVATION_SCALE,
        getFillColor: (f) => {
          const s = score(f.properties ?? {});
          const [r, g, b] = scoreColor(s);
          const isSel = selected?.properties?.mb === f.properties?.mb;
          return [r, g, b, isSel ? 255 : 200];
        },
        getLineColor: [255, 255, 255, 60],
        lineWidthMinPixels: 1,
        // re-run accessors (not geometry upload) when the persona math changes
        updateTriggers: {
          getElevation: [persona.id, customWeights, detailedWeights],
          getFillColor: [persona.id, customWeights, detailedWeights, selected?.properties?.mb],
        },
        transitions: { getElevation: 350, getFillColor: 350 },
        onClick: (info) => onSelect((info.object as Feature) ?? null),
      })
    );
    if (showCulture && culture) {
      const pos = (f: Feature) =>
        (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
      // pin needles poking above the score prisms + a ground dot
      out.push(
        new ColumnLayer({
          id: "culture-pins",
          data: culture.features,
          diskResolution: 6,
          radius: 10,
          getPosition: pos,
          getElevation: 140,
          getFillColor: [...CULTURE_PINK, 235],
          pickable: true,
        }),
        new ScatterplotLayer({
          id: "culture-dots",
          data: culture.features,
          getPosition: pos,
          radiusMinPixels: 3,
          radiusMaxPixels: 6,
          getFillColor: [...CULTURE_PINK, 255],
          getLineColor: [255, 255, 255, 200],
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
        })
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, buildings, persona, customWeights, detailedWeights, selected, onSelect, cityMode, useGoogleTiles, culture, showCulture]);

  return (
    <DeckGL
      initialViewState={viewState}
      controller={true}
      layers={layers}
      onClick={(info) => {
        if (!info.layer) onSelect(null);
      }}
      getTooltip={({ object }) => {
        const f = object as Feature | undefined;
        if (!f?.properties) return null;
        const p = f.properties;
        if (typeof p.name === "string" && typeof p.kind === "string") {
          // culture pin
          return {
            html: `<div style="font-size:12px"><strong style="color:#ff5ca8">${p.name}</strong><br><span style="color:#9aa4ad">${p.kind}</span></div>`,
            style: {
              backgroundColor: "rgba(16,20,26,0.92)",
              border: "1px solid rgba(255,92,168,0.5)",
              borderRadius: "8px",
              padding: "6px 10px",
              color: "#edeae2",
            },
          };
        }
        const s = score(p);
        const [r, g, b] = scoreColor(s);
        const sub = (k: Sub) => {
          const v = p[`${k}_${persona.variants[k]}`];
          return typeof v === "number" ? v : 0;
        };
        const bar = (label: string, v: number) =>
          `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">
             <span style="width:74px;color:#9aa4ad">${label}</span>
             <span style="width:60px;height:5px;background:#333;border-radius:3px;overflow:hidden;display:inline-block">
               <span style="display:block;height:100%;width:${v}%;background:#35b8a6"></span>
             </span>
             <span style="width:22px;text-align:right;font-variant-numeric:tabular-nums">${v}</span>
           </div>`;
        const fix = p.fix as { what: string; gain: number } | null;
        return {
          html: `
            <div style="font-size:12px;line-height:1.35">
              <div style="color:#9aa4ad">Block ${p.mb}</div>
              <div style="font-size:18px;font-weight:700;color:rgb(${r},${g},${b})">${s}<span style="font-size:11px;color:#9aa4ad;font-weight:400">/100 · ${persona.label}</span></div>
              ${bar("Transit", sub("transit"))}
              ${bar("Walkability", sub("walk"))}
              ${bar("Amenities", sub("amen"))}
              ${bar("Green", sub("green"))}
              ${fix ? `<div style="margin-top:4px;color:#35b8a6">↑ ${fix.what} (+${fix.gain})</div>` : ""}
            </div>`,
          style: {
            backgroundColor: "rgba(16,20,26,0.92)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "8px",
            padding: "8px 10px",
            color: "#edeae2",
          },
        };
      }}
    >
      {/* Google tiles bring their own ground; OSM-buildings mode keeps the basemap */}
      {!useGoogleTiles && <Map mapStyle={mapStyle} />}
    </DeckGL>
  );
}
