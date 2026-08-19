"use client";

import { useEffect, useMemo, useState } from "react";
import { data, AXES, type Axis } from "./lib/types";
import { deadline, uniqueItems, unlockReleased, expiryState } from "./lib/logic";
import { Radar } from "./components/Radar";
import { Map } from "./components/Map";
import { DetailPanel } from "./components/DetailPanel";

export default function Home() {
  const demo = data.demo
    .filter((x) => x.elementType === "Ausbildung")
    .map((x) => x.itemId);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [tree, setTree] = useState("NETZBAU"),
    [mode, setMode] = useState<"new" | "change">("new"),
    [completed, setCompleted] = useState(new Set(demo)),
    // Teilnahmedaten werden bewusst NICHT aus dem Demo-Profil vorbelegt – ein
    // Ablaufdatum darf sich nur aus einem tatsächlichen Anklick-Vorgang ergeben,
    // sonst hängt ein fixes Datum an einem Häkchen, das jederzeit gesetzt/entfernt
    // werden kann (siehe Praxis-Rückmeldung).
    [completedDates, setCompletedDates] =
      useState<Record<string, string>>({}),
    [today, setToday] = useState(todayIso),
    [selected, setSelected] = useState<string | null>(null);

  const todayDate = useMemo(() => new Date(today), [today]);

  const items = useMemo(() => uniqueItems(tree), [tree]);
  const treeUnlocks = useMemo(
    () => data.unlocks.filter((u) => u.trees.includes(tree)),
    [tree],
  );
  const permissionUnlocks = treeUnlocks.filter(
    (u) => !u.id.startsWith("ROLE-") && !u.id.startsWith("SPEZ-"),
  );
  const roleUnlocks = treeUnlocks.filter((u) => u.id.startsWith("ROLE-"));
  const specialistUnlocks = treeUnlocks.filter((u) => u.id.startsWith("SPEZ-"));

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
      if (n.has(id)) {
        n.delete(id);
        setCompletedDates((d) => {
          const { [id]: _drop, ...rest } = d;
          return rest;
        });
      } else {
        n.add(id);
        setCompletedDates((d) => (d[id] ? d : { ...d, [id]: today }));
      }
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
            <label>
              Simuliertes heutiges Datum
              <input
                type="date"
                value={today}
                onChange={(e) => setToday(e.target.value)}
              />
              <small className="hint">
                Nur für die Demo – im produktiven ERP wird automatisch das
                tagesaktuelle Datum verwendet.
              </small>
            </label>
            <div className="list">
              {items.map((x) => {
                const state = expiryState(x, completedDates[x.id], todayDate);
                return (
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
                        {state === "expiring" && " · läuft bald ab"}
                        {state === "expired" && " · abgelaufen"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={() => {
                setCompleted(new Set());
                setCompletedDates({});
              }}
            >
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
                  const released = unlockReleased(u, effective);
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
                  const released = unlockReleased(u, effective);
                  return (
                    <button key={u.id} className={`badge role-badge ${released ? "earned" : "pending"}`} onClick={() => setSelected(u.id)}>
                      <i>{released ? "✓" : "⌁"}</i>
                      <span><strong>{u.name}</strong><small>{released ? "bestätigt" : "noch nicht erreicht"}</small></span>
                    </button>
                  );
                })}
              </div>
            </div>
            {specialistUnlocks.length > 0 && (
              <div className="badge-section specialist-section">
                <small>Fachführung &amp; Spezialrollen</small>
                <div className="badges">
                  {specialistUnlocks.map((u) => {
                    const released = unlockReleased(u, effective);
                    return (
                      <button key={u.id} className={`badge specialist-badge ${released ? "earned" : "pending"}`} onClick={() => setSelected(u.id)}>
                        <i>{released ? "✓" : "⌁"}</i>
                        <span><strong>{u.name}</strong><small>{released ? "bestätigt" : "noch nicht erreicht"}</small></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
            completedDates={completedDates}
            today={todayDate}
            selected={selected}
            onSelect={setSelected}
            internal={mode === "change"}
          />
        </div>
      </section>
      <DetailPanel
        selectedItem={selectedItem}
        selectedUnlock={selectedUnlock}
        items={items}
        effective={effective}
        completedDates={completedDates}
        today={todayDate}
        onToggleExternal={toggle}
        onClose={() => setSelected(null)}
      />
      <footer>MNC Academy Skilltree · interaktives Vorführmodell</footer>
    </main>
  );
}
