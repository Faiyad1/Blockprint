export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-ramp" />
      <div className="legend-labels">
        <span>0 — hostile</span>
        <span>100 — great</span>
      </div>
      <p>Block height &amp; color = livability score for the selected persona.</p>
      <ul className="legend-notes">
        <li>Parks are excluded, as their exceptionally high scores made them outliers.</li>
      </ul>
    </div>
  );
}
