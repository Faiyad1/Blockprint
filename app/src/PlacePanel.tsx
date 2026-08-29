import type { Feature } from "geojson";

interface Props {
  place: Feature;
  onClose: () => void;
}

export default function PlacePanel({ place, onClose }: Props) {
  const p = place.properties ?? {};
  const rows: [string, string][] = [];
  if (typeof p.built === "string") rows.push(["Built", p.built]);
  if (typeof p.address === "string") rows.push(["Address", p.address]);
  if (typeof p.hours === "string") rows.push(["Hours", p.hours]);

  return (
    <aside className="block-panel place-panel">
      <button className="close" onClick={onClose} aria-label="Close panel">×</button>
      <span className="place-kind">{String(p.kind ?? "")}</span>
      <h2 className="place-name">{String(p.name ?? "")}</h2>
      {typeof p.img === "string" && (
        <img
          className="place-img"
          src={import.meta.env.BASE_URL + p.img}
          alt={String(p.name ?? "")}
        />
      )}
      {typeof p.desc === "string" && <p className="place-desc">{p.desc}</p>}
      {rows.map(([label, value]) => (
        <div className="place-row" key={label}>
          <span className="place-label">{label}</span>
          <span>{value}</span>
        </div>
      ))}
      <div className="place-links">
        {typeof p.wikipedia === "string" && (
          <a href={p.wikipedia} target="_blank" rel="noreferrer">Wikipedia ↗</a>
        )}
        {typeof p.website === "string" && (
          <a href={p.website} target="_blank" rel="noreferrer">Website ↗</a>
        )}
      </div>
    </aside>
  );
}
