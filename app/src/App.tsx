import { useEffect, useState } from "react";
import type { Feature, FeatureCollection } from "geojson";
import Map3D, { type RenderMode } from "./Map3D";
import PersonaBar from "./PersonaBar";
import BlockPanel from "./BlockPanel";
import PlacePanel from "./PlacePanel";
import WeightsPanel from "./WeightsPanel";
import Legend from "./Legend";
import personasData from "./personas.json";
import type { Persona, Sub } from "./scoring";
import "./App.css";

const PERSONAS = personasData as Persona[];

export default function App() {
  const [blocks, setBlocks] = useState<FeatureCollection | null>(null);
  const [persona, setPersona] = useState<Persona>(PERSONAS[0]);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<Feature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RenderMode>("city");
  const [showWeights, setShowWeights] = useState(false);
  // user-tuned coefficient override; null = use the persona's own weights
  const [tuned, setTuned] = useState<Record<Sub, number> | null>(null);
  // per-characteristic override (Detailed mode); non-null takes precedence
  const [detailed, setDetailed] = useState<Record<string, number> | null>(null);
  const [culture, setCulture] = useState<FeatureCollection | null>(null);
  const [showCulture, setShowCulture] = useState(true);
  const [buildings, setBuildings] = useState<FeatureCollection | null>(null);

  // 'B' toggles city/data mode — also the panic key if tiles fail live
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "b") {
        setMode((m) => (m === "data" ? "city" : "data"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}buildings.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setBuildings)
      .catch(() => setBuildings(null)); // optional layer — no error surfaced
    fetch(`${import.meta.env.BASE_URL}culture.geojson`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCulture)
      .catch(() => setCulture(null)); // optional layer
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}blocks.geojson`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBlocks)
      .catch((e) => setError(`Couldn't load blocks.geojson: ${e.message}`));
  }, []);

  const effectiveWeights = tuned ?? undefined;

  const pickPersona = (p: Persona) => {
    setPersona(p);
    setTuned(null); // new persona starts from its own coefficients
    setDetailed(null);
  };

  return (
    <div className="app">
      <Map3D
        blocks={blocks}
        persona={persona}
        customWeights={effectiveWeights}
        detailedWeights={detailed}
        buildings={buildings}
        selected={selected}
        onSelect={(f) => {
          setSelected(f);
          if (f) setSelectedPlace(null);
        }}
        onSelectPlace={(f) => {
          setSelectedPlace(f);
          if (f) setSelected(null);
        }}
        mode={mode}
        culture={culture}
        showCulture={showCulture}
      />
      <header className="hud-top">
        <h1>BLOCK<span className="print-pink">PRINT</span></h1>
        <p className="tag">The blocks that make up Sydney — scored for who you are</p>
        <div className="bar-row">
          <PersonaBar personas={PERSONAS} active={persona} onPick={pickPersona} />
          {culture && (
            <button
              className={showCulture ? "chip culture active-culture" : "chip culture"}
              onClick={() => setShowCulture((s) => !s)}
              title="Historic landmarks: museums, historic sites, heritage buildings"
            >
              🎭 culture
            </button>
          )}
        </div>
      </header>
      <div className="weights-corner">
        <button className="weights-btn" onClick={() => setShowWeights((s) => !s)}>
          🎛️ score weights
        </button>
        {showWeights && (
          <WeightsPanel
            persona={persona}
            tuned={tuned}
            onTune={setTuned}
            detailed={detailed}
            onDetail={setDetailed}
          />
        )}
      </div>
      <Legend />
      {selected && (
        <BlockPanel
          block={selected}
          persona={persona}
          customWeights={effectiveWeights}
          detailedWeights={detailed}
          onClose={() => setSelected(null)}
        />
      )}
      {selectedPlace && (
        <PlacePanel place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      )}
      {!blocks && !error && <div className="status">loading blocks…</div>}
      {error && <div className="status error">{error}</div>}
    </div>
  );
}
