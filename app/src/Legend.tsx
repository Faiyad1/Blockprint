export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-ramp" />
      <div className="legend-labels">
        <span>0 — hostile</span>
        <span>100 — great</span>
      </div>
      <p>Block height &amp; color = livability score for the selected persona. Click a block for the why.</p>
    </div>
  );
}
