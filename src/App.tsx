"use client";

import { useEffect, useMemo, useState } from "react";
import data from "../lib/academy-data.json";

type Assignment = (typeof data.assignments)[number];
type Unlock = (typeof data.unlocks)[number];
type Axis = "Fach" | "SGA" | "Persönlichkeit" | "Führung";
const AXES: Axis[] = ["Fach", "SGA", "Persönlichkeit", "Führung"];
const LEADERSHIP_ITEM = {
  tree: "FUEHRUNG", id: "FUE-001", name: "Ausbildung Vorgesetzte/r",
  strand: "Führungspfad", level: "L2", deadline: "Bedarf",
  requirement: "Fakultativ / Rollenpfad", order: 99,
  prerequisite: "L1 vollständig", result: "Rolle Vorgesetzte/r",
  decision: "Pfad bestätigt; Detailmodule offen", source: "Besprechung",
  axis: "Führung", points: 3, radar: true, elementType: "Ausbildung",
  details: { id: "FUE-001", name: "Ausbildung Vorgesetzte/r", duration: 0,
    category: "Führung & Organisation", areas: "Alle Fachbereiche",
    audience: "Mitarbeitende mit vorgesehener Führungsfunktion",
    status: "Detailmodule offen" },
} as Assignment;
const LEADERSHIP_ROLE = {
  id: "ROLE-VORGESETZTE", name: "Vorgesetzte/r",
  trees: data.functions.filter((x) => !["FUEHRUNG", "SPEZIALROLLEN"].includes(x.id)).map((x) => x.id),
  requires: "FUE-001", before: "Führungsrolle noch nicht bestätigt",
  after: "Rolle Vorgesetzte/r",
  rule: "Unabhängig von einer fachlichen L2- oder L3-Qualifikation",
} as Unlock;
const LEVEL: Record<string, number> = {
  L0: 0,
  L1: 1,
  "L1 Abschluss": 1,
  "L1–L3": 1,
  L2: 2,
  L3: 3,
  "L3 / Führung": 3,
};
const level = (value: string) => LEVEL[value] ?? 1;
const deadline = (value: string) =>
  ({
    A: "Sofort beim Neueintritt",
    B: "Innerhalb der Probezeit (3 Monate)",
    C: "Innerhalb des ersten Jahres",
    "–": "Keine feste Frist",
    Offen: "Frist noch nicht festgelegt",
    Bedarf: "Nach betrieblichem Bedarf",
  })[value] ?? value;

function uniqueItems(tree: string) {
  const seen = new Set<string>();
  const source = data.assignments.filter((x) => x.tree === tree);
  if (LEADERSHIP_ROLE.trees.includes(tree))
    source.push({ ...LEADERSHIP_ITEM, tree } as Assignment);
  return source
    .sort(
      (a, b) =>
        level(a.level) - level(b.level) ||
        Number(a.order ?? 99) - Number(b.order ?? 99),
    )
    .filter((x) => !seen.has(x.id) && !!seen.add(x.id));
}

function requirements(item: Assignment, items: Assignment[]) {
  const text = String(item.prerequisite ?? "");
  const ids = new Set<string>();
  if (/L0/.test(text)) {
    ids.add("HR-001");
    ids.add("SGA-001");
  }
  if (/L1 vollständig|Alle fachlichen L1-Grundmodule/.test(text))
    items
      .filter((x) => level(x.level) === 1 && x.requirement === "Pflicht")
      .forEach((x) => ids.add(x.id));
  if (/L2 vollständig/.test(text))
    items
      .filter((x) => level(x.level) === 2 && x.strand === "Fach")
      .forEach((x) => ids.add(x.id));
  if (/MOD-029 bis MOD-037/.test(text))
    for (let i = 29; i <= 37; i++) ids.add(`MOD-${String(i).padStart(3, "0")}`);
  (text.match(/(?:HR|SGA|MOD|NEU|DRAFT|OFFEN)-[A-Z0-9-]+/g) ?? []).forEach(
    (id) => ids.add(id),
  );
  ids.delete(item.id);
  return [...ids];
}

function unlockRequirements(unlock: Unlock, tree: string) {
  const ids = new Set(
    unlock.requires.match(/(?:HR|SGA|MOD|NEU|DRAFT|OFFEN|FUE)-[A-Z0-9-]+/g) ?? [],
  );
  if (/Spezialausbildung/.test(unlock.requires))
    ids.add("DRAFT-SGA-ELEKTROVERTEILNETZ");
  if (/L2/.test(unlock.requires))
    data.assignments
      .filter(
        (x) => x.tree === tree && level(x.level) === 2 && x.strand === "Fach",
      )
      .forEach((x) => ids.add(x.id));
  return [...ids];
}

function Radar({
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

function Map({
  items,
  unlocks,
  completed,
  selected,
  onSelect,
  internal,
}: {
  items: Assignment[];
  unlocks: Unlock[];
  completed: Set<string>;
  selected: string | null;
  onSelect: (id: string) => void;
  internal: boolean;
}) {
  const leadership = items.filter((x) => /Führung/.test(x.strand));
  const special = items.filter((x) =>
    /Spezial|Organisatorischer/.test(x.strand),
  );
  const groups = [
    {
      key: "entry",
      eyebrow: internal ? "Funktionswechsel" : "Neueintritt",
      title: internal ? "Grundlagen vorhanden" : "Direkter Einstieg",
      items: items.filter((x) => level(x.level) === 0),
    },
    {
      key: "foundation",
      eyebrow: "Fachlicher Hauptweg",
      title: "Grundausbildung",
      items: items.filter((x) => level(x.level) === 1 && !special.includes(x) && !leadership.includes(x)),
    },
    {
      key: "specialization",
      eyebrow: "Fachlicher Hauptweg",
      title: "Fachspezialisierung",
      items: items.filter((x) => level(x.level) === 2 && !special.includes(x) && !leadership.includes(x)),
    },
    {
      key: "expertise",
      eyebrow: "Fachlicher Hauptweg",
      title: "Fachexpertise",
      items: items.filter((x) => level(x.level) >= 3 && !special.includes(x) && !leadership.includes(x)),
    },
    {
      key: "special",
      eyebrow: "Ergänzende Qualifikationen",
      title: "Parallel zum Fachweg",
      items: special,
    },
    {
      key: "leadership",
      eyebrow: "Unabhängiger Rollenpfad",
      title: "Führung",
      items: leadership,
    },
  ];
  const state = (x: Assignment) =>
    completed.has(x.id)
      ? "completed"
      : requirements(x, items).every((id) => completed.has(id))
        ? "available"
        : "locked";
  const recommended = groups
    .flatMap((g) => g.items)
    .find((x) => state(x) === "available")?.id;
  return (
    <div className="skill-map">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.key} className={`zone ${g.key}`}>
              <div className="nodes">
                {g.items.map((x) => {
                  const s = state(x),
                    optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement);
                  return (
                    <button
                      key={x.id}
                      className={`node ${s} ${optional ? "optional" : "mandatory"} ${recommended === x.id ? "recommended" : ""} ${selected === x.id ? "selected" : ""}`}
                      onClick={() => onSelect(x.id)}
                    >
                      <small>{x.id}</small>
                      <strong>{x.name}</strong>
                      <span>
                        {s === "completed"
                          ? "✓ abgeschlossen"
                          : s === "available"
                            ? "jetzt möglich"
                            : "später möglich"}
                      </span>
                      {internal && g.key === "entry" && (
                        <em>bereits beim Eintritt absolviert</em>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ),
      )}
      {unlocks.length > 0 && (
        <section className="zone permissions">
          <header>
            <h3>Erreichte Einsatzbereiche</h3>
          </header>
          <div className="permission-nodes">
            {unlocks.map((u) => {
              const req = unlockRequirements(u, items[0]?.tree ?? "");
              const released =
                req.length > 0 && req.every((id) => completed.has(id));
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

export default function Home() {
  const demo = data.demo
    .filter((x) => x.elementType === "Ausbildung")
    .map((x) => x.itemId);
  const [tree, setTree] = useState("NETZBAU"),
    [mode, setMode] = useState<"new" | "change">("new"),
    [completed, setCompleted] = useState(new Set(demo)),
    [selected, setSelected] = useState<string | null>(null);
  const items = useMemo(() => uniqueItems(tree), [tree]);
  const treeUnlocks = useMemo(
    () => [
      ...data.unlocks.filter((u) => u.trees.includes(tree) && !u.id.startsWith("UNLOCK-L3")),
      ...(LEADERSHIP_ROLE.trees.includes(tree) ? [LEADERSHIP_ROLE] : []),
    ],
    [tree],
  );
  const permissionUnlocks = treeUnlocks.filter((u) => !u.id.startsWith("ROLE-"));
  const roleUnlocks = treeUnlocks.filter((u) => u.id.startsWith("ROLE-"));
  const effective = new Set(completed);
  if (mode === "change") {
    effective.add("HR-001");
    effective.add("SGA-001");
  }
  const selectedItem = items.find((x) => x.id === selected);
  const selectedUnlock = treeUnlocks.find((x) => x.id === selected);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const scores = Object.fromEntries(AXES.map((a) => [a, 0])) as Record<
      Axis,
      number
    >,
    targets = { ...scores };
  items.forEach((x) => {
    if (x.radar && x.requirement === "Pflicht")
      targets[x.axis as Axis] += Number(x.points || 0);
    if (x.radar && effective.has(x.id))
      scores[x.axis as Axis] += Number(x.points || 0);
  });
  const toggle = (id: string) =>
    setCompleted((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  return (
    <main>
      <header className="topbar">
        <a href="#start" className="brand">
          <b>M</b>
          <span>
            <strong>MNC Academy</strong>
            <small>Skilltree · Vorführmodell</small>
          </span>
        </a>
        <nav>
          <a href="#profil">Profil</a>
          <a href="#map">Ausbildungsmap</a>
        </nav>
        <span>Demo ohne Personendaten</span>
      </header>
      <section id="start" className="hero">
        <h1>MNC Academy Skilltree</h1>
      </section>
      <section id="profil" className="profile">
        <div className="heading">
          <div>
            <p className="eyebrow">Standortbestimmung</p>
            <h2>Demo-Mitarbeiter</h2>
          </div>
          <p>
            Das Diagramm zeigt das Ausbildungsprofil – nicht automatisch die
            tatsächliche Arbeitsleistung.
          </p>
        </div>
        <div className="profile-grid">
          <aside className="controls">
            <label>
              Funktionsprofil
              <select
                value={tree}
                onChange={(e) => {
                  setTree(e.target.value);
                  setSelected(null);
                }}
              >
                {data.functions
                  .filter((x) => !["FUEHRUNG", "SPEZIALROLLEN"].includes(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Einstiegssituation
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "new" | "change")}
              >
                <option value="new">Neueintritt</option>
                <option value="change">Interner Funktionswechsel</option>
              </select>
            </label>
            <div className="list">
              {items.map((x) => (
                <label key={x.id}>
                  <input
                    type="checkbox"
                    checked={effective.has(x.id)}
                    disabled={
                      mode === "change" && ["HR-001", "SGA-001"].includes(x.id)
                    }
                    onChange={() => toggle(x.id)}
                  />
                  <span>
                    <strong>{x.name}</strong>
                    <small>
                      {x.id} · {deadline(x.deadline)}
                    </small>
                  </span>
                </label>
              ))}
            </div>
            <button onClick={() => setCompleted(new Set())}>
              Profil leeren
            </button>
          </aside>
          <article className="radar-card">
            <h3>Ausbildungs- & Kompetenzprofil</h3>
            <Radar scores={scores} targets={targets} />
            <div className="badge-section">
              <small>Persönliche Berechtigungen</small>
              <div className="badges">
                {permissionUnlocks.map((u) => {
                  const req = unlockRequirements(u, tree),
                    released =
                      req.length > 0 && req.every((id) => effective.has(id));
                  return (
                    <button
                      key={u.id}
                      className={`badge ${released ? "earned" : "pending"}`}
                      onClick={() => setSelected(u.id)}
                    >
                      <i>{released ? "✓" : "⌁"}</i>
                      <span>
                        <strong>{u.name}</strong>
                        <small>
                          {released ? "bestätigt" : "noch nicht erreicht"}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="badge-section role-section">
              <small>Rollen &amp; Funktionen</small>
              <div className="badges">
                {roleUnlocks.map((u) => {
                  const req = unlockRequirements(u, tree), released = req.every((id) => effective.has(id));
                  return (
                    <button key={u.id} className={`badge role-badge ${released ? "earned" : "pending"}`} onClick={() => setSelected(u.id)}>
                      <i>{released ? "✓" : "⌁"}</i>
                      <span><strong>{u.name}</strong><small>{released ? "bestätigt" : "noch nicht erreicht"}</small></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>
        </div>
      </section>
      <section id="map" className="map-section">
        <div className="heading">
          <div>
            <p className="eyebrow">Ausbildungslandkarte</p>
            <h2>{data.functions.find((x) => x.id === tree)?.name}</h2>
          </div>
          <p>
            Der Fachweg bleibt dominant. Ergänzende Qualifikationen und
            Berechtigungen bilden eigenständige Gebiete derselben Lernwelt.
          </p>
        </div>
        <div className="legend">
          <span className="red">abgeschlossen</span>
          <span className="white">jetzt möglich</span>
          <span className="teal">empfohlener Schritt</span>
          <span className="grey">später möglich</span>
          <span className="solid">obligatorisch</span>
          <span className="dashed">fakultativ / bedingt</span>
        </div>
        <div className="map-scroll">
          <Map
            items={items}
            unlocks={permissionUnlocks}
            completed={effective}
            selected={selected}
            onSelect={setSelected}
            internal={mode === "change"}
          />
        </div>
      </section>
      {(selectedItem || selectedUnlock) && (
        <div
          className="overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}
        >
          <article className="detail" role="dialog" aria-modal="true">
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            {selectedItem && (
              <>
                <div>
                  <p className="eyebrow">
                    {selectedItem.id} · {selectedItem.elementType}
                  </p>
                  <h2>{selectedItem.name}</h2>
                  <p>
                    {selectedItem.result ||
                      selectedItem.details?.category ||
                      "Ausbildungsmodul"}
                  </p>
                </div>
                <div className="facts">
                  <span>
                    <small>Frist</small>
                    <strong>{deadline(selectedItem.deadline)}</strong>
                  </span>
                  <span>
                    <small>Verbindlichkeit</small>
                    <strong>{selectedItem.requirement}</strong>
                  </span>
                  <span>
                    <small>Entwicklungsabschnitt</small>
                    <strong>
                      {/Spezial|Organisatorischer/.test(selectedItem.strand)
                        ? "Ergänzende Qualifikation"
                        : level(selectedItem.level) === 0
                          ? "Einstieg"
                          : level(selectedItem.level) === 1
                            ? "Grundausbildung"
                            : level(selectedItem.level) === 2
                              ? "Fachspezialisierung"
                              : "Fachexpertise"}
                    </strong>
                  </span>
                </div>
                <div className="req">
                  <strong>Benötigt davor</strong>
                  {(requirements(selectedItem, items).length
                    ? requirements(selectedItem, items)
                    : ["Keine formale Modulvoraussetzung"]
                  ).map((id) => (
                    <span
                      key={id}
                      className={
                        effective.has(id) || id.startsWith("Keine")
                          ? "done"
                          : ""
                      }
                    >
                      {effective.has(id) || id.startsWith("Keine") ? "✓" : "○"}{" "}
                      {items.find((x) => x.id === id)?.name ?? id}
                    </span>
                  ))}
                </div>
              </>
            )}
            {selectedUnlock && (
              <>
                <div>
                  <p className="eyebrow">Berechtigung</p>
                  <h2>{selectedUnlock.name}</h2>
                  <p>{selectedUnlock.after}</p>
                </div>
                <div className="facts">
                  <span>
                    <small>Status</small>
                    <strong>
                      {unlockRequirements(selectedUnlock, tree).every((id) =>
                        effective.has(id),
                      )
                        ? "Freigegeben ✓"
                        : "Noch gesperrt"}
                    </strong>
                  </span>
                  <span>
                    <small>Vor Freigabe</small>
                    <strong>{selectedUnlock.before}</strong>
                  </span>
                </div>
                <div className="req">
                  <strong>Erforderliche Bedingungen</strong>
                  {unlockRequirements(selectedUnlock, tree).map((id) => (
                    <span key={id} className={effective.has(id) ? "done" : ""}>
                      {effective.has(id) ? "✓" : "○"}{" "}
                      {items.find((x) => x.id === id)?.name ?? id}
                    </span>
                  ))}
                  <em>{selectedUnlock.rule}</em>
                </div>
              </>
            )}
          </article>
        </div>
      )}
      <footer>MNC Academy Skilltree · interaktives Vorführmodell</footer>
    </main>
  );
}
