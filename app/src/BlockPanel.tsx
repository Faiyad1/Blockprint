import { composite, compositeAdvanced, SUBS, type Persona, type Sub } from "./scoring";
import type { Feature } from "geojson";

const SUB_LABELS: Record<Sub, string> = {
  transit: "Transit",
  walk: "Walkability",
  amen: "Amenities",
  green: "Green space",
};

// what a low score in each variant actually means, in words
const LOW_REASONS: Record<string, string> = {
  transit_any: "few transit stops within easy reach",
  transit_step_free: "no verified step-free transit nearby",
  transit_late: "no late-night services within reach",
  walk_general: "sparse footpath network",
  walk_ramps: "kerb ramps are scarce here",
  walk_controlled: "few signalised crossings",
  walk_tactile: "little tactile paving for low-vision navigation",
  walk_lit: "poorly lit walking routes",
  amen_general: "few everyday amenities (toilets, benches, water)",
  amen_accessible: "the nearest accessible toilet is far away",
  amen_family: "few family facilities nearby",
  amen_essentials: "no pharmacy, GP or supermarket close by",
  green_general: "no park within a comfortable walk",
  green_play: "no playground nearby",
};

function explain(props: Record<string, unknown>, persona: Persona): string | null {
  let worst: { key: string; sub: Sub; val: number } | null = null;
  for (const sub of Object.keys(persona.variants) as Sub[]) {
    const key = `${sub}_${persona.variants[sub]}`;
    const v = props[key];
    if (typeof v !== "number") continue;
    if (!worst || v * persona.weights[sub] < worst.val * persona.weights[worst.sub]) {
      worst = { key, sub, val: v };
    }
  }
  if (!worst || worst.val >= 60) return null; // nothing notably weak
  return `Main issue for ${persona.label.toLowerCase()}: ${LOW_REASONS[worst.key] ?? "low " + SUB_LABELS[worst.sub].toLowerCase()} (${worst.val}/100).`;
}

interface Props {
  block: Feature;
  persona: Persona;
  customWeights: Record<Sub, number> | undefined;
  detailedWeights: Record<string, number> | null;
  onClose: () => void;
}

export default function BlockPanel({ block, persona, customWeights, detailedWeights, onClose }: Props) {
  const props = block.properties ?? {};
  const score = detailedWeights
    ? compositeAdvanced(props, detailedWeights)
    : composite(props, persona, customWeights);
  const fix = props.fix as { what: string; gain: number; persona: string } | null;

  return (
    <aside className="block-panel">
      <button className="close" onClick={onClose} aria-label="Close panel">×</button>
      <h2>Block {String(props.mb)}</h2>
      <div className="big-score">
        {score}<span className="denom">/100</span>
        <span className="for"> for {persona.label.toLowerCase()}</span>
      </div>
      {SUBS.map((sub) => {
        const v = props[`${sub}_${persona.variants[sub]}`];
        const val = typeof v === "number" ? v : 0;
        return (
          <div className="sub-row" key={sub}>
            <span className="sub-name">{SUB_LABELS[sub]}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${val}%` }} />
            </div>
            <span className="sub-val">{val}</span>
          </div>
        );
      })}
      {fix && (
        <div className="fix">
          <strong>Biggest single fix:</strong> {fix.what}
          <span className="gain"> +{fix.gain} pts</span>
        </div>
      )}
      {explain(props, persona) && <p className="explain">{explain(props, persona)}</p>}
    </aside>
  );
}
