import type { Assignment, Unlock } from "../lib/types";
import { level, itemState, unlockRequirements, unlockReleased, expiryState } from "../lib/logic";

export function Map({
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
      items: items.filter(
        (x) => level(x.level) === 1 && !special.includes(x) && !leadership.includes(x),
      ),
    },
    {
      key: "specialization",
      eyebrow: "Fachlicher Hauptweg",
      title: "Fachspezialisierung",
      items: items.filter(
        (x) => level(x.level) === 2 && !special.includes(x) && !leadership.includes(x),
      ),
    },
    {
      key: "expertise",
      eyebrow: "Fachlicher Hauptweg",
      title: "Fachexpertise",
      items: items.filter(
        (x) => level(x.level) >= 3 && !special.includes(x) && !leadership.includes(x),
      ),
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
  const recommended = groups
    .flatMap((g) => g.items)
    .find((x) => itemState(x, completed) === "available")?.id;
  return (
    <div className="skill-map">
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <section key={g.key} className={`zone ${g.key}`}>
              <div className="nodes">
                {g.items.map((x) => {
                  const s = itemState(x, completed),
                    optional = /Fakultativ|Wahl|Bedingte/.test(x.requirement),
                    expiry = expiryState(x, completedDates[x.id], today);
                  return (
                    <button
                      key={x.id}
                      className={`node ${s} ${optional ? "optional" : "mandatory"} ${recommended === x.id ? "recommended" : ""} ${selected === x.id ? "selected" : ""} ${expiry === "expiring" ? "expiring" : ""} ${expiry === "expired" ? "expired" : ""}`}
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
