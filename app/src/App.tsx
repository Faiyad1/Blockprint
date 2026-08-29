import { useEffect, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import Map3D from "./Map3D";
import PersonaBar from "./PersonaBar";
import BlockPanel from "./BlockPanel";
import CustomSliders from "./CustomSliders";
import Legend from "./Legend";
import personasData from "./personas.json";
import type { Persona, Sub } from "./scoring";
import "./App.css";

const PERSONAS = personasData as Persona[];

export default function App() {
  const [blocks, setBlocks] = useState<FeatureCollection | null>(null);
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [customWeights, setCustomWeights] = useState<Record<Sub, number>>(
    PERSONAS.find((p) => p.id === "custom")!.weights
  );
  const [selected, setSelected] = useState<Feature | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/blocks.geojson")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBlocks)
      .catch((e) => setError(`Couldn't load blocks.geojson: ${e.message}`));
  }, []);

  const isCustom = persona.id === "custom";

  return (
    <div className="app">
      <Map3D
        blocks={blocks}
        persona={persona}
        customWeights={isCustom ? customWeights : undefined}
        selected={selected}
        onSelect={setSelected}
      />
      <header className="hud-top">
        <h1>Blockprint</h1>
        <p className="tag">the blocks that make up Sydney — scored for who you are</p>
        <PersonaBar personas={PERSONAS} active={persona} onPick={setPersona} />
        {isCustom && <CustomSliders weights={customWeights} onChange={setCustomWeights} />}
      </header>
      <Legend />
      {selected && (
        <BlockPanel
          block={selected}
          persona={persona}
          customWeights={isCustom ? customWeights : undefined}
          onClose={() => setSelected(null)}
        />
      )}
      {!blocks && !error && <div className="status">loading blocks…</div>}
      {error && <div className="status error">{error}</div>}
    </div>
  );
}
