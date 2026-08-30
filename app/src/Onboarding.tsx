import { useState } from "react";
import type { Persona } from "./scoring";

interface Props {
  personas: Persona[]; // the core set shown as choices
  onDone: (p: Persona) => void;
}

export default function Onboarding({ personas, onDone }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [choice, setChoice] = useState<Persona>(personas[0]); // Everyone by default

  return (
    <div className="intro-backdrop">
      <div className="intro-card" role="dialog" aria-modal="true" aria-label="Welcome to Blockprint">
        {step === 1 && (
          <>
            <h1 className="intro-title">
              BLOCK<span className="print-pink">PRINT</span>
            </h1>
            <p className="intro-tag">The blocks that make up Sydney — scored for who you are.</p>
            <img className="intro-img" src={`${import.meta.env.BASE_URL}intro.png`} alt="Blockprint 3D city view" />
            <ul className="intro-points">
              <li>Every block of Sydney's inner city, scored 0–100 for livability from open data.</li>
              <li>Switch persona and the same city visibly re-shapes (block height and color are the score).</li>
              <li>Click any block for its breakdown and the single fix that would help it most.</li>
            </ul>
            <button className="intro-btn" onClick={() => setStep(2)}>Next</button>
          </>
        )}
        {step === 2 && (
          <>
            <h2 className="intro-subtitle">Who are you exploring as?</h2>
            <p className="intro-tag">You can switch anytime from the top bar.</p>
            <div className="intro-personas">
              {personas.map((p) => (
                <button
                  key={p.id}
                  className={p.id === choice.id ? "intro-persona active" : "intro-persona"}
                  onClick={() => setChoice(p)}
                >
                  <span className="intro-emoji">{p.emoji}</span>
                  {p.label}
                </button>
              ))}
            </div>
            <button className="intro-btn" onClick={() => onDone(choice)}>
              Start exploring as {choice.label}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
