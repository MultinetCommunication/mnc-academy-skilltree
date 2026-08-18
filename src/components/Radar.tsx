import { AXES, type Axis } from "../lib/types";

export function Radar({
  scores,
  targets,
}: {
  scores: Record<Axis, number>;
  targets: Record<Axis, number>;
}) {
  const c = 150,
    r = 100;
  const pt = (axis: Axis, val: number) => {
    const i = AXES.indexOf(axis),
      a = -Math.PI / 2 + (i * Math.PI) / 2,
      m = Math.max(4, targets[axis]);
    return `${c + Math.cos(a) * r * Math.min(1, val / m)},${c + Math.sin(a) * r * Math.min(1, val / m)}`;
  };
  const grid = (f: number) =>
    AXES.map((_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 2;
      return `${c + Math.cos(a) * r * f},${c + Math.sin(a) * r * f}`;
    }).join(" ");
  return (
    <div className="radar-wrap">
      <svg
        viewBox="0 0 300 300"
        className="radar"
        aria-label="Ausbildungsprofil"
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={grid(f)} className="radar-grid" />
        ))}
        {AXES.map((axis, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 2;
          return (
            <g key={axis}>
              <line
                x1={c}
                y1={c}
                x2={c + Math.cos(a) * r}
                y2={c + Math.sin(a) * r}
              />
              <text x={c + Math.cos(a) * 128} y={c + Math.sin(a) * 128}>
                {axis}
              </text>
            </g>
          );
        })}
        <polygon
          points={AXES.map((a) => pt(a, targets[a])).join(" ")}
          className="radar-target"
        />
        <polygon
          points={AXES.map((a) => pt(a, scores[a])).join(" ")}
          className="radar-current"
        />
      </svg>
      <p>Rot: Ausbildungsprofil · gestrichelt: Funktionsprofil</p>
    </div>
  );
}
