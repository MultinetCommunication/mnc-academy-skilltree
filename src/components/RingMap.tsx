import type { Assignment, Unlock } from "../lib/types";
import {
  level,
  itemState,
  requirements,
  unlockRequirements,
  unlockReleased,
  expiryState,
} from "../lib/logic";

/**
 * Alternative "development tree" visualisation for the ring toggle.
 *
 * Only the core fachlich progression (L0 entry → L1 Basis → L2 Vertieft →
 * L3 Experte) is drawn as concentric rings — that's the part with a real
 * level hierarchy worth visualising spatially. "Parallel zum Fachweg"
 * (special/organisatorische Module) and "Führung" (leadership path) are
 * genuinely separate, non-leveled tracks, so they keep the same flat list
 * presentation the tile view already uses for them — reusing that markup
 * verbatim rather than forcing them into a ring that wouldn't mean anything
 * for a track without levels.
 *
 * Ring radius grows with node count (MIN_ARC px of arc length reserved per
 * node) instead of shrinking nodes to fit — validated against a 9-node
 * stress case before this was wired in.
 */

const MIN_ARC = 48; // px of circumference reserved per node, tuned in the mockup
const BASE_RADIUS: Record<number, number> = { 0: 50, 1: 150, 2: 250, 3: 340 };
const RING_LABEL: Record<number, string> = {
  1: "BASIS",
  2: "VERTIEFT",
  3: "EXPERTE",
};

function radiusFor(levelNum: number, count: number) {
  const base = BASE_RADIUS[levelNum] ?? 340;
  const needed = (count * MIN_ARC) / (2 * Math.PI);
  return Math.max(base, needed);
}

function truncate(name: string, max = 20) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

export function RingMap({
  items,
  unlocks,
  completed,
  completedDates,
  today,
  selected,
  onSelect,
  internal,
}: {
  items: Assignment[];
  unlocks: Unlock[];
  completed: Set<string>;
  completedDates: Record<string, string>;
  today: Date;
  selected: string | null;
  onSelect: (id: string) => void;
  internal: boolean;
}) {
  const leadership = items.filter((x) => /Führung/.test(x.strand));
  const special = items.filter((x) => /Spezial|Organisatorischer/.test(x.strand));
  const core = items.filter((x) => !leadership.includes(x) && !special.includes(x));

  const byLevel: Record<number, Assignment[]> = { 0: [], 1: [], 2: [], 3: [] };
  core.forEach((x) => {
    const l = Math.min(3, level(x.level));
    byLevel[l].push(x);
  });

  const cx = 340;
  const radius: Record<number, number> = {
    0: radiusFor(0, byLevel[0].length),
    1: radiusFor(1, byLevel[1].length),
    2: radiusFor(2, byLevel[2].length),
    3: radiusFor(3, byLevel[3].length),
  };
  const maxR = Math.max(radius[0], radius[1], radius[2], radius[3], 60);
  const cy = maxR + 40;
  const viewH = maxR * 2 + 80;
  const viewW = Math.max(680, maxR * 2 + 80);

  type Placed = { item: Assignment; x: number; y: number; ring: number };
  const placed: Record<string, Placed> = {};
  ([0, 1, 2, 3] as const).forEach((lvl) => {
    const group = byLevel[lvl];
    const n = group.length;
    group.forEach((item, i) => {
      const angle = -90 + (n > 0 ? (360 / n) * i : 0);
      const rad = (angle * Math.PI) / 180;
      const x = cx + radius[lvl] * Math.cos(rad);
      const y = cy + radius[lvl] * Math.sin(rad);
      placed[item.id] = { item, x, y, ring: lvl };
    });
  });

  const lines: { x1: number; y1: number; x2: number; y2: number; active: boolean; id: string }[] = [];
  core.forEach((item) => {
    const to = placed[item.id];
    if (!to) return;
    requirements(item).forEach((reqId) => {
      const from = placed[reqId];
      if (!from) return;
      lines.push({
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        active: completed.has(reqId),
        id: `${reqId}->${item.id}`,
      });
    });
  });

  return (
    <div className="skill-map ring-view">
      <section className="zone ring-zone">
        <svg
          viewBox={`0 0 ${viewW} ${viewH}`}
          className="ring-svg"
          role="img"
          aria-label="Entwicklungsbaum als Ringdarstellung: Basis, Vertieft, Experte um einen zentralen Einstiegspunkt"
        >
          <defs>
            <filter id="ring-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {([1, 2, 3] as const)
            .filter((lvl) => byLevel[lvl].length > 0)
            .map((lvl) => (
              <g key={lvl}>
                <circle cx={cx} cy={cy} r={radius[lvl]} className="ring-guide" />
                <text x={cx} y={cy - radius[lvl] - 8} textAnchor="middle" className="ring-label">
                  {RING_LABEL[lvl]}
                </text>
              </g>
            ))}
          {lines.map((l) => (
            <line
              key={l.id}
              x1={l.x1}
              y1={l.y1}
              x2={l.x2}
              y2={l.y2}
              className={`ring-line ${l.active ? "active" : ""}`}
              filter={l.active ? "url(#ring-glow)" : undefined}
            />
          ))}
          {core.map((x) => {
            const p = placed[x.id];
            if (!p) return null;
            const s = itemState(x, completed);
            const optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement);
            const expiry = expiryState(x, completedDates[x.id], today);
            const done = s === "completed";
            const isCenter = p.ring === 0;
            return (
              <g
                key={x.id}
                className={`ring-node ${s} ${optional ? "optional" : "mandatory"} ${expiry} ${selected === x.id ? "selected" : ""}`}
                onClick={() => onSelect(x.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(x.id)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isCenter ? 17 : 12}
                  filter={done || expiry === "expiring" || expiry === "expired" ? "url(#ring-glow)" : undefined}
                />
                <text x={p.x} y={p.y + (isCenter ? 34 : 26)} textAnchor="middle" className="ring-node-label">
                  {truncate(x.name)}
                </text>
                {(expiry === "expiring" || expiry === "expired") && (
                  <text x={p.x} y={p.y + 4} textAnchor="middle" className="ring-warn-icon">
                    ⚠
                  </text>
                )}
                {done && expiry === "none" && (
                  <text x={p.x} y={p.y + 4} textAnchor="middle" className="ring-check-icon">
                    ✓
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </section>

      {special.length > 0 && (
        <section className="zone special">
          <div className="nodes">
            {special.map((x) => {
              const s = itemState(x, completed),
                optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement),
                expiry = expiryState(x, completedDates[x.id], today);
              return (
                <button
                  key={x.id}
                  className={`node ${s} ${optional ? "optional" : "mandatory"} ${selected === x.id ? "selected" : ""} ${expiry === "expiring" ? "expiring" : ""} ${expiry === "expired" ? "expired" : ""}`}
                  onClick={() => onSelect(x.id)}
                >
                  <small>{x.id}</small>
                  <strong>{x.name}</strong>
                  <span>
                    {expiry === "expired"
                      ? "⚠ abgelaufen"
                      : expiry === "expiring"
                        ? "⚠ läuft bald ab"
                        : s === "completed"
                          ? "✓ abgeschlossen"
                          : s === "available"
                            ? "jetzt möglich"
                            : "später möglich"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {leadership.length > 0 && (
        <section className="zone leadership">
          <div className="nodes">
            {leadership.map((x) => {
              const s = itemState(x, completed),
                optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement),
                expiry = expiryState(x, completedDates[x.id], today);
              return (
                <button
                  key={x.id}
                  className={`node ${s} ${optional ? "optional" : "mandatory"} ${selected === x.id ? "selected" : ""} ${expiry === "expiring" ? "expiring" : ""} ${expiry === "expired" ? "expired" : ""}`}
                  onClick={() => onSelect(x.id)}
                >
                  <small>{x.id}</small>
                  <strong>{x.name}</strong>
                  <span>
                    {expiry === "expired"
                      ? "⚠ abgelaufen"
                      : expiry === "expiring"
                        ? "⚠ läuft bald ab"
                        : s === "completed"
                          ? "✓ abgeschlossen"
                          : s === "available"
                            ? "jetzt möglich"
                            : "später möglich"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {unlocks.length > 0 && (
        <section className="zone permissions">
          <header>
            <h3>Erreichte Einsatzbereiche</h3>
          </header>
          <div className="permission-nodes">
            {unlocks.map((u) => {
              const req = unlockRequirements(u);
              const released = unlockReleased(u, completed);
              return (
                <button
                  key={u.id}
                  className={`permission-node ${released ? "released" : "blocked"}`}
                  onClick={() => onSelect(u.id)}
                >
                  <i>{released ? "✓" : "⌁"}</i>
                  <span>
                    <small>{released ? "BERECHTIGT" : "NOCH GESPERRT"}</small>
                    <strong>{u.name}</strong>
                    <em>
                      {released
                        ? "Freigabe bestätigt"
                        : `${req.filter((id) => !completed.has(id)).length} Bedingungen offen`}
                    </em>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
