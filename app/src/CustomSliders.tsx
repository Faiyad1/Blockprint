import { SUBS, type Sub } from "./scoring";

const LABELS: Record<Sub, string> = {
  transit: "Transit",
  walk: "Walkability",
  amen: "Amenities",
  green: "Green",
};

interface Props {
  weights: Record<Sub, number>;
  onChange: (w: Record<Sub, number>) => void;
}

// Raw 0-100 sliders; composite() normalizes by the weight sum, so users can
// just drag without the four values needing to add to anything.
export default function CustomSliders({ weights, onChange }: Props) {
  return (
    <div className="sliders">
      {SUBS.map((sub) => (
        <label key={sub}>
          <span>{LABELS[sub]}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(weights[sub] * 100)}
            onChange={(e) =>
              onChange({ ...weights, [sub]: Number(e.target.value) / 100 })
            }
          />
        </label>
      ))}
    </div>
  );
}
