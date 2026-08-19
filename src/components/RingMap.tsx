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
 * Three ring systems around one shared center:
 * - Main hub: the fachlich progression (L0 entry → L1 Basis → L2 Vertieft →
 *   L3 Experte) as concentric rings — the only track with a real level
 *   hierarchy worth spacing out radially.
 * - Two satellite hubs, reached by a ray from the main center: "Führung"
 *   (leadership path) and "SGA / Spezialrollen" (special/organisatorische
 *   Module). Neither has L1–L3 levels, so each is a single cascaded ring
 *   around its own hub point rather than a multi-level structure.
 *
 * Ring/satellite radius grows with node count (MIN_ARC px of arc length
 * reserved per node) instead of shrinking nodes to fit — validated against
 * a 9-node stress case before this was wired in.
 */

const MIN_ARC = 48;
const SAT_MIN_ARC = 36;
const BASE_RADIUS: Record<number, number> = { 0: 50, 1: 150, 2: 250, 3: 340 };
const RING_LABEL: Record<number, string> = {
  1: "BASIS",
  2: "VERTIEFT",
  3: "EXPERTE",
};
const SAT_BASE_RADIUS = 70;
const HUB_GAP = 160; // clearance beyond the outer main ring before a satellite hub starts
const LEADERSHIP_ANGLE = -38;
const SPECIAL_ANGLE = 38;

function radiusFor(base: number, count: number, minArc: number) {
  const needed = (count * minArc) / (2 * Math.PI);
  return Math.max(base, needed);
}

function truncate(name: string, max = 20) {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

type Placed = { item: Assignment; x: number; y: number; cluster: "core" | "leadership" | "special"; isHubCenter?: boolean };

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

  const mainCx = 400;
  const mainCy = 400;
  const radius: Record<number, number> = {
    0: radiusFor(BASE_RADIUS[0], byLevel[0].length, MIN_ARC),
    1: radiusFor(BASE_RADIUS[1], byLevel[1].length, MIN_ARC),
    2: radiusFor(BASE_RADIUS[2], byLevel[2].length, MIN_ARC),
    3: radiusFor(BASE_RADIUS[3], byLevel[3].length, MIN_ARC),
  };
  const maxR = Math.max(radius[0], radius[1], radius[2], radius[3], 60);

  const hubDist = maxR + HUB_GAP;
  const leadershipHub = {
    x: mainCx + hubDist * Math.cos((LEADERSHIP_ANGLE * Math.PI) / 180),
    y: mainCy + hubDist * Math.sin((LEADERSHIP_ANGLE * Math.PI) / 180),
  };
  const specialHub = {
    x: mainCx + hubDist * Math.cos((SPECIAL_ANGLE * Math.PI) / 180),
    y: mainCy + hubDist * Math.sin((SPECIAL_ANGLE * Math.PI) / 180),
  };
  const leadershipR = radiusFor(SAT_BASE_RADIUS, leadership.length, SAT_MIN_ARC);
  const specialR = radiusFor(SAT_BASE_RADIUS, special.length, SAT_MIN_ARC);

  const placed: Record<string, Placed> = {};
  ([0, 1, 2, 3] as const).forEach((lvl) => {
    const group = byLevel[lvl];
    const n = group.length;
    group.forEach((item, i) => {
      const angle = -90 + (n > 0 ? (360 / n) * i : 0);
      const rad = (angle * Math.PI) / 180;
      placed[item.id] = {
        item,
        x: mainCx + radius[lvl] * Math.cos(rad),
        y: mainCy + radius[lvl] * Math.sin(rad),
        cluster: "core",
      };
    });
  });
  function placeSatellite(group: Assignment[], hub: { x: number; y: number }, r: number, cluster: "leadership" | "special") {
    const n = group.length;
    group.forEach((item, i) => {
      const angle = -90 + (n > 0 ? (360 / n) * i : 0);
      const rad = (angle * Math.PI) / 180;
      placed[item.id] = {
        item,
        x: hub.x + r * Math.cos(rad),
        y: hub.y + r * Math.sin(rad),
        cluster,
      };
    });
  }
  placeSatellite(leadership, leadershipHub, leadershipR, "leadership");
  placeSatellite(special, specialHub, specialR, "special");

  const allNodes = [...core, ...leadership, ...special];

  // Bounding box across everything actually placed, so the viewBox always
  // fits regardless of how many satellite items a given tree has.
  const xs = allNodes.map((x) => placed[x.id]?.x).filter((v): v is number => v !== undefined);
  const ys = allNodes.map((x) => placed[x.id]?.y).filter((v): v is number => v !== undefined);
  const pad = 60;
  const satXs = [
    ...(leadership.length > 0 ? [leadershipHub.x - leadershipR, leadershipHub.x + leadershipR] : []),
    ...(special.length > 0 ? [specialHub.x - specialR, specialHub.x + specialR] : []),
  ];
  const satYs = [
    ...(leadership.length > 0 ? [leadershipHub.y - leadershipR, leadershipHub.y + leadershipR] : []),
    ...(special.length > 0 ? [specialHub.y - specialR, specialHub.y + specialR] : []),
  ];
  const minX = Math.min(mainCx - maxR, ...xs, ...satXs) - pad;
  const maxX = Math.max(mainCx + maxR, ...xs, ...satXs) + pad;
  const minY = Math.min(mainCy - maxR, ...ys, ...satYs) - pad - 20;
  const maxY = Math.max(mainCy + maxR, ...ys, ...satYs) + pad;
  const viewW = maxX - minX;
  const viewH = maxY - minY;

  const lines: { x1: number; y1: number; x2: number; y2: number; active: boolean; id: string }[] = [];
  allNodes.forEach((item) => {
    const to = placed[item.id];
    if (!to) return;
    requirements(item).forEach((reqId) => {
      const from = placed[reqId];
      if (!from) return;
      if (from.cluster !== to.cluster) return; // cross-cluster links are represented by the single hub ray instead
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

  const hubRays = [
    { to: leadershipHub, active: leadership.some((x) => itemState(x, completed) !== "locked"), show: leadership.length > 0 },
    { to: specialHub, active: special.some((x) => itemState(x, completed) !== "locked"), show: special.length > 0 },
  ];

  return (
    <div className="skill-map ring-view">
      <section className="zone ring-zone">
        <svg
          viewBox={`${minX} ${minY} ${viewW} ${viewH}`}
          width={viewW}
          height={viewH}
          className="ring-svg"
          style={{ display: "block" }}
          role="img"
          aria-label="Entwicklungsbaum als Ringdarstellung mit drei Ringsystemen: Fachpfad im Zentrum, Führung und SGA/Spezialrollen als Satelliten"
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

          {hubRays
            .filter((r) => r.show)
            .map((r, i) => (
              <line
                key={`ray-${i}`}
                x1={mainCx}
                y1={mainCy}
                x2={r.to.x}
                y2={r.to.y}
                className={`ring-ray ${r.active ? "active" : ""}`}
              />
            ))}

          {([1, 2, 3] as const)
            .filter((lvl) => byLevel[lvl].length > 0)
            .map((lvl) => (
              <g key={lvl}>
                <circle cx={mainCx} cy={mainCy} r={radius[lvl]} className="ring-guide" />
                <text x={mainCx} y={mainCy - radius[lvl] - 8} textAnchor="middle" className="ring-label">
                  {RING_LABEL[lvl]}
                </text>
              </g>
            ))}
          {leadership.length > 0 && (
            <>
              <circle cx={leadershipHub.x} cy={leadershipHub.y} r={leadershipR} className="ring-guide sat" />
              <text x={leadershipHub.x} y={leadershipHub.y - leadershipR - 8} textAnchor="middle" className="ring-label">
                FÜHRUNG
              </text>
            </>
          )}
          {special.length > 0 && (
            <>
              <circle cx={specialHub.x} cy={specialHub.y} r={specialR} className="ring-guide sat" />
              <text x={specialHub.x} y={specialHub.y - specialR - 8} textAnchor="middle" className="ring-label">
                SGA / SPEZIALROLLEN
              </text>
            </>
          )}

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
          {allNodes.map((x) => {
            const p = placed[x.id];
            if (!p) return null;
            const s = itemState(x, completed);
            const optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement);
            const expiry = expiryState(x, completedDates[x.id], today);
            const done = s === "completed";
            const isCenter = p.cluster === "core" && level(x.level) === 0;
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

