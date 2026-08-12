# MNC Academy Skilltree

Interaktive öffentliche Testumgebung für die Ausbildungslandkarte der MNC Academy.

## Öffentliche Testseite

https://multinetcommunication.github.io/mnc-academy-skilltree/

Die Seite enthält ausschliesslich Demo-Daten und dient zum Testen von Ausbildungswegen,
Abhängigkeiten, Einsatzberechtigungen und Rollenprofilen.

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Mit jedem Push auf `main` wird die Seite automatisch über GitHub Pages veröffentlicht.

## Aufbau des Codes

- `src/App.tsx` – Zustand (welcher Funktionsbaum, welche Module abgeschlossen) und Seitenaufbau.
- `src/components/Map.tsx` – die Skilltree-Landkarte.
- `src/components/Radar.tsx` – das Kompetenzprofil-Diagramm.
- `src/components/DetailPanel.tsx` – das Detail-Overlay für Module/Berechtigungen.
- `src/lib/logic.ts` – Level-/Fristen-Mapping und Freischaltungsstatus.
- `src/lib/types.ts` – zentrale Typen, abgeleitet aus `lib/academy-data.json`.

## Datenmodell: `prerequisiteIds` / `requiresIds`

Jedes Modul (`assignments`) und jede Berechtigung (`unlocks`) hat ein Freitextfeld
(`prerequisite` bzw. `requires`) für Menschen **und** ein Feld mit echten ID-Referenzen
(`prerequisiteIds` bzw. `requiresIds`), das die Freischaltungslogik im Code tatsächlich
verwendet. Der Freitext dient nur noch der Anzeige in der Oberfläche.

**Wichtig für die Pflege:** Wird ein neues Modul ergänzt oder eine Voraussetzung geändert,
muss `prerequisiteIds` (bzw. `requiresIds`) manuell mitgepflegt werden – der Freitext allein
hat keine Wirkung mehr auf die Logik. Das ist bewusst so gewählt: In der Vorgängerversion
wurde die Logik per Regex aus dem Freitext abgeleitet, was bei jeder Formulierungsänderung
lautlos brechen konnte.

**Bekannte offene Datenlücke:** `UNLOCK-NIV` enthält im Freitext das Fragment
„Elektro-Grundbildung", das keinem bestehenden Modul zugeordnet werden konnte. Diese
Bedingung ist aktuell **nicht** in `requiresIds` enthalten und wird daher beim Freischalten
nicht geprüft, bis geklärt ist, welches Modul gemeint ist. Siehe `dataIssues` in
`lib/academy-data.json`.
