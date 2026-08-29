import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { composite, scoreColor, type Persona, type Sub } from "./scoring";
import type { Feature, FeatureCollection } from "geojson";

// Hour-0 TODO: paste the Google Cloud Map Tiles key to enable photorealistic
// city mode via Tile3DLayer (see PLAN.md §2) — starts only after Milestone 2.
// const GOOGLE_TILES_KEY = "";

const BASEMAP = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const INITIAL_VIEW = {
  longitude: 151.207,
  latitude: -33.878,
  zoom: 13.4,
  pitch: 52,
  bearing: -15,
};

interface Props {
  blocks: FeatureCollection | null;
  persona: Persona;
  customWeights: Record<Sub, number> | undefined;
  selected: Feature | null;
  onSelect: (f: Feature | null) => void;
}

export default function Map3D({ blocks, persona, customWeights, selected, onSelect }: Props) {
  const layers = useMemo(() => {
    if (!blocks) return [];
    return [
      new GeoJsonLayer({
        id: "score-prisms",
        data: blocks,
        extruded: true,
        pickable: true,
        opacity: 0.85,
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
      }),
    ];
  }, [blocks, persona, customWeights, selected, onSelect]);

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
      <Map mapStyle={BASEMAP} />
    </DeckGL>
  );
}
