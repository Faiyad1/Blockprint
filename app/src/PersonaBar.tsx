import type { Persona } from "./scoring";

interface Props {
  personas: Persona[];
  active: Persona;
  onPick: (p: Persona) => void;
}

export default function PersonaBar({ personas, active, onPick }: Props) {
  const core = personas.filter((p) => p.core);
  const extended = personas.filter((p) => !p.core);
  return (
    <div className="persona-bar">
      {core.map((p) => (
        <button
          key={p.id}
          className={p.id === active.id ? "chip active" : "chip"}
          onClick={() => onPick(p)}
        >
          <span className="chip-emoji">{p.emoji}</span> {p.label}
        </button>
      ))}
      {extended.length > 0 && (
        <details className="more">
          <summary>more…</summary>
          {extended.map((p) => (
            <button
              key={p.id}
              className={p.id === active.id ? "chip active" : "chip"}
              onClick={() => onPick(p)}
            >
              <span className="chip-emoji">{p.emoji}</span> {p.label}
            </button>
          ))}
        </details>
      )}
    </div>
  );
}
