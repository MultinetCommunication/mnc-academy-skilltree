import type { Assignment, Unlock } from "../lib/types";
import {
  level,
  deadline,
  requirements,
  unlockRequirements,
  unlockReleased,
} from "../lib/logic";

export function DetailPanel({
  selectedItem,
  selectedUnlock,
  items,
  effective,
  onToggleExternal,
  onClose,
}: {
  selectedItem?: Assignment;
  selectedUnlock?: Unlock;
  items: Assignment[];
  effective: Set<string>;
  onToggleExternal: (id: string) => void;
  onClose: () => void;
}) {
  if (!selectedItem && !selectedUnlock) return null;
  return (
    <div
      className="overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <article className="detail" role="dialog" aria-modal="true">
        <button className="close" onClick={onClose}>
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
              {(requirements(selectedItem).length
                ? requirements(selectedItem)
                : ["Keine formale Modulvoraussetzung"]
              ).map((id) => (
                <span
                  key={id}
                  className={
                    effective.has(id) || id.startsWith("Keine") ? "done" : ""
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
                  {unlockReleased(selectedUnlock, effective)
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
              {unlockRequirements(selectedUnlock).map((id) => (
                <span key={id} className={effective.has(id) ? "done" : ""}>
                  {effective.has(id) ? "✓" : "○"}{" "}
                  {items.find((x) => x.id === id)?.name ?? id}
                </span>
              ))}
              {(selectedUnlock.externalRequirements ?? []).map((ext) => (
                <label key={ext.id} className="req-external">
                  <input
                    type="checkbox"
                    checked={effective.has(ext.id)}
                    onChange={() => onToggleExternal(ext.id)}
                  />
                  <span className={effective.has(ext.id) ? "done" : ""}>
                    ⓘ {ext.text}
                    <em> (extern – manuell für Testzwecke gesetzt, nicht systemseitig geprüft)</em>
                  </span>
                </label>
              ))}
              <em>{selectedUnlock.rule}</em>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
