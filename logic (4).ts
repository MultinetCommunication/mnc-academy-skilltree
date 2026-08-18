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

/**
 * Gimmick 4: human-readable duration. `details.duration` is stored in hours
 * (confirmed against REA_Module_Academy.xlsx: "½ Tag" → 4, "1 Tag" → 8, on an
 * 8-hour workday). Anything ≥ 8h is shown in days for readability.
 */
export function formatDuration(hours: number | null | undefined): string | null {
  if (hours === null || hours === undefined) return null;
  if (hours === 0) return null;
  if (hours < 8) {
    return `${hours % 1 === 0 ? hours : hours.toFixed(1)} Std.`;
  }
  const days = hours / 8;
  return `${days % 1 === 0 ? days : days.toFixed(1)} Tag${days === 1 ? "" : "e"}`;
}

/**
 * Gimmick 2: Durchführungsart. Modules marked `einmalig` (one-off
 * qualifications like PTA/apprenticeship-style trainings) only ever have a
 * single delivery form — there is no "Wiederholung".
 */
export function deliveryLabel(item: Assignment): string | null {
  if (!item.deliveryFirst) return null;
  if (item.einmalig) return item.deliveryFirst;
  if (!item.deliveryRepeat || item.deliveryRepeat === item.deliveryFirst) {
    return item.deliveryFirst;
  }
  return `${item.deliveryFirst} (Erstkurs) · ${item.deliveryRepeat} (Wiederholung)`;
}

/**
 * Gimmick 3: course link, dependent on the *repeat* delivery form (falls
 * back to the first-course form for one-off modules). Real internal ERP
 * links won't resolve outside the corporate network, so the demo points at
 * a placeholder page instead — this still lets the redirect behaviour be
 * demonstrated end to end.
 */
export function courseLink(item: Assignment): { url: string; label: string } | null {
  const form = item.einmalig ? item.deliveryFirst : (item.deliveryRepeat ?? item.deliveryFirst);
  if (!form) return null;
  const isElearning = /E-Learning|Online/.test(form);
  return isElearning
    ? { url: "https://example.com/mnc-academy/e-learning-demo", label: "Zur E-Learning-Plattform (Demo-Platzhalter)" }
    : { url: "https://example.com/mnc-academy/kursanmeldung-demo", label: "Zur Kursbeschreibung & Anmeldung (Demo-Platzhalter)" };
}

/**
 * Gimmick 1: expiry. `validityMonths` is intentionally undefined for almost
 * every module right now — that data doesn't exist anywhere yet and had to
 * be left as a follow-up data-collection task rather than guessed at. A
 * module with no `validityMonths` (or marked `einmalig`) simply never
 * expires. `WARNING_DAYS` is the agreed 180-day heads-up window (courses run
 * at least twice a year).
 */
export const WARNING_DAYS = 180;

export type ExpiryState = "none" | "valid" | "expiring" | "expired";

export function expiryState(
  item: Assignment,
  completedDate: string | undefined,
  today: Date,
): ExpiryState {
  if (item.einmalig || !item.validityMonths || !completedDate) return "none";
  const completed = new Date(completedDate);
  const expiry = new Date(completed);
  expiry.setMonth(expiry.getMonth() + item.validityMonths);
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / msPerDay);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= WARNING_DAYS) return "expiring";
  return "valid";
}

export function expiryDate(item: Assignment, completedDate: string | undefined): Date | null {
  if (item.einmalig || !item.validityMonths || !completedDate) return null;
  const d = new Date(completedDate);
  d.setMonth(d.getMonth() + item.validityMonths);
  return d;
}
