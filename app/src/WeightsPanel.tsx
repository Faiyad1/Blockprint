import { useState } from "react";
import { SUBS, VARIANT_INFO, personaAsDetailed, type Persona, type Sub } from "./scoring";

const GROUP_LABELS: Record<Sub, string> = {
  transit: "Transit",
  walk: "Walkability",
  amen: "Amenities",
  green: "Green space",
};

function pct(w: number, sum: number): string {
  return sum > 0 ? `${Math.round((w / sum) * 100)}%` : "0%";
}

interface Props {
  persona: Persona;
  tuned: Record<Sub, number> | null;                 // group-mode override
  onTune: (w: Record<Sub, number> | null) => void;
  detailed: Record<string, number> | null;           // detailed-mode override
  onDetail: (w: Record<string, number> | null) => void;
}

export default function WeightsPanel({ persona, tuned, onTune, detailed, onDetail }: Props) {
  // detailed tab shown by default; the override only activates on first drag
  const [tab, setTab] = useState<"groups" | "detailed">("detailed");
  const detailedMode = tab === "detailed";
  const detailValues = detailed ?? personaAsDetailed(persona);

  const groupWeights = tuned ?? persona.weights;
  const groupSum = SUBS.reduce((s, k) => s + groupWeights[k], 0);
  const detailSum = VARIANT_INFO.reduce((s, v) => s + (detailValues[v.key] ?? 0), 0);

  const isDirty = detailed !== null || tuned !== null;

  return (
    <div className="weights-panel">
      <p className="weights-title">
        Coefficients for <strong>{persona.label}</strong>
        {isDirty && <span className="tuned-flag"> (adjusted)</span>}
      </p>

      <div className="weights-tabs">
        <button
          className={detailedMode ? "wtab" : "wtab active"}
          onClick={() => {
            setTab("groups");
            onDetail(null); // group mode takes over; drop the detailed override
          }}
        >
          Groups
        </button>
        <button
          className={detailedMode ? "wtab active" : "wtab"}
          onClick={() => setTab("detailed")}
        >
          Detailed
        </button>
      </div>

      {!detailedMode && (
        <div className="wsliders">
          {SUBS.map((sub) => (
            <label key={sub} className="wrow">
              <span className="wname">{GROUP_LABELS[sub]}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(groupWeights[sub] * 100)}
                onChange={(e) =>
                  onTune({ ...groupWeights, [sub]: Number(e.target.value) / 100 })
                }
              />
              <span className="wpct">{pct(groupWeights[sub], groupSum)}</span>
            </label>
          ))}
        </div>
      )}

      {detailedMode && (
        <div className="wsliders detailed">
          {VARIANT_INFO.map((v, i) => {
            const showGroup = i === 0 || VARIANT_INFO[i - 1].group !== v.group;
            return (
              <div key={v.key}>
                {showGroup && <p className="wgroup">{v.group}</p>}
                <label className="wrow">
                  <span className="wname">{v.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((detailValues[v.key] ?? 0) * 100)}
                    onChange={(e) =>
                      onDetail({ ...detailValues, [v.key]: Number(e.target.value) / 100 })
                    }
                  />
                  <span className="wpct">{pct(detailValues[v.key] ?? 0, detailSum)}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="weights-reset"
        onClick={() => {
          onTune(null);
          onDetail(null);
        }}
        disabled={!isDirty}
      >
        Reset to {persona.label} defaults
      </button>
      <p className="weights-note">
        Percentages show each factor's share of the score — only ratios matter.
      </p>
    </div>
  );
}
