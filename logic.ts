import { data, type Assignment, type Unlock } from "./types";

const LEVEL: Record<string, number> = {
  L0: 0,
  L1: 1,
  "L1 Abschluss": 1,
  "L1–L3": 1,
  L2: 2,
  L3: 3,
  "L3 / Führung": 3,
};

export const level = (value: string) => LEVEL[value] ?? 1;

export const deadline = (value: string) =>
  ({
    A: "Sofort beim Neueintritt",
    B: "Innerhalb der Probezeit (3 Monate)",
    C: "Innerhalb des ersten Jahres",
    "–": "Keine feste Frist",
    Offen: "Frist noch nicht festgelegt",
    Bedarf: "Nach betrieblichem Bedarf",
  })[value] ?? value;

/**
 * All assignments belonging to a tree, sorted by level/order.
 *
 * The leadership item (FUE-001) used to be synthesized here at render time
 * for whichever trees allow a leadership path. It's now a normal entry in
 * academy-data.json (one row per applicable tree), so this function only
 * needs to filter and sort — no more special-casing.
 */
export function uniqueItems(tree: string): Assignment[] {
  return data.assignments
    .filter((x) => x.tree === tree)
    .slice()
    .sort(
      (a, b) =>
        level(a.level) - level(b.level) ||
        Number(a.order ?? 99) - Number(b.order ?? 99),
    );
}

/**
 * Prerequisite module IDs for an assignment.
 *
 * Previously this ran a set of regexes against the free-text `prerequisite`
 * field at render time (e.g. matching "L1 vollständig" and expanding it to
 * every mandatory L1 module). That meant a small wording change in the data
 * could silently break the unlock logic with no error anywhere.
 *
 * The IDs are now precomputed once and stored directly in the data as
 * `prerequisiteIds`, so this is just a lookup. The free-text `prerequisite`
 * field is kept for humans to read in the UI, but no longer drives logic.
 */
export function requirements(item: Assignment): string[] {
  return item.prerequisiteIds ?? [];
}

/**
 * Same idea as `requirements`, for unlock/permission entries.
 * Internal module IDs only — for external (non-module) requirements see
 * `externalRequirementIds` below.
 */
export function unlockRequirements(unlock: Unlock): string[] {
  return unlock.requiresIds ?? [];
}

/**
 * IDs for requirements that aren't internal modules (e.g. a completed
 * apprenticeship done before joining). These use an "EXT-" prefix so they
 * can't collide with real module IDs. They're toggled manually in the UI
 * for testing/demo purposes — the app has no way to verify them for real.
 */
export function externalRequirementIds(unlock: Unlock): string[] {
  return (unlock.externalRequirements ?? []).map((r) => r.id);
}

export type ItemState = "completed" | "available" | "locked";

export function itemState(
  item: Assignment,
  completed: Set<string>,
): ItemState {
  if (completed.has(item.id)) return "completed";
  return requirements(item).every((id) => completed.has(id))
    ? "available"
    : "locked";
}

export function unlockReleased(unlock: Unlock, completed: Set<string>) {
  const req = [...unlockRequirements(unlock), ...externalRequirementIds(unlock)];
  return req.length > 0 && req.every((id) => completed.has(id));
}
