import { composite, SUBS, type Persona, type Sub } from "./scoring";
import type { Feature } from "geojson";

const SUB_LABELS: Record<Sub, string> = {
  transit: "Transit",
  walk: "Walkability",
  amen: "Amenities",
  green: "Green space",
};

interface Props {
  block: Feature;
  persona: Persona;
  customWeights: Record<Sub, number> | undefined;
  onClose: () => void;
}

export default function BlockPanel({ block, persona, customWeights, onClose }: Props) {
  const props = block.properties ?? {};
  const score = composite(props, persona, customWeights);
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
      {typeof props.explain === "string" && props.explain && (
        <p className="explain">{props.explain}</p>
      )}
    </aside>
  );
}
