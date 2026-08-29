// The persona engine: pure function from block properties + persona -> 0..100.
// This runs per block per frame-ish; keep it allocation-free and simple.

export type Sub = "transit" | "walk" | "amen" | "green";
export const SUBS: Sub[] = ["transit", "walk", "amen", "green"];

export interface Persona {
  id: string;
  label: string;
  emoji: string;
  core: boolean;
  decay: { full: number; zero: number };
  weights: Record<Sub, number>;
  variants: Record<Sub, string>;
  rules: string[];
  note?: string;
}

export type BlockProps = Record<string, number | boolean | string | object | null>;

// property key convention: `${sub}_${variant}`, e.g. transit_step_free
function variantScore(props: BlockProps, sub: Sub, variant: string): number {
  const v = props[`${sub}_${variant}`];
  return typeof v === "number" ? v : 0;
}

export function composite(
  props: BlockProps,
  persona: Persona,
  customWeights?: Record<Sub, number>
): number {
  const weights = customWeights ?? persona.weights;
  let total = 0;
  let wsum = 0;
  for (const sub of SUBS) {
    let s = variantScore(props, sub, persona.variants[sub]);
    // soft_step_free: non-step-free access counts at 50%, not 0 —
    // blend the strict variant with the general one.
    if (persona.rules.includes("soft_step_free") && (sub === "transit" || sub === "walk")) {
      const general = variantScore(props, sub, sub === "transit" ? "any" : "general");
      s = Math.max(s, 0.5 * general);
    }
    total += weights[sub] * s;
    wsum += weights[sub];
  }
  let score = wsum > 0 ? total / wsum : 0;

  if (persona.rules.includes("stairs_are_walls")) {
    // strict floor: a block whose ramp-walkability is near zero is near-unusable
    const ramps = variantScore(props, "walk", "ramps");
    if (ramps < 10) score = Math.min(score, 25);
  }
  if (persona.rules.includes("arterial_penalty") && props.arterial === true) {
    score *= 0.4;
  }
  return Math.round(Math.max(0, Math.min(100, score)));
}

// Colorblind-safe viridis-style ramp, dark-purple (0) -> teal -> yellow (100).
const RAMP: [number, [number, number, number]][] = [
  [0, [68, 1, 84]],
  [25, [59, 82, 139]],
  [50, [33, 145, 140]],
  [75, [94, 201, 98]],
  [100, [253, 231, 37]],
];

export function scoreColor(score: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    const [s1, c1] = RAMP[i - 1];
    const [s2, c2] = RAMP[i];
    if (score <= s2) {
      const t = (score - s1) / (s2 - s1);
      return [
        Math.round(c1[0] + t * (c2[0] - c1[0])),
        Math.round(c1[1] + t * (c2[1] - c1[1])),
        Math.round(c1[2] + t * (c2[2] - c1[2])),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}
