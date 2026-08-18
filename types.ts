import data from "../../lib/academy-data.json";

export type Assignment = (typeof data.assignments)[number];
export type Unlock = (typeof data.unlocks)[number];
export type Axis = "Fach" | "SGA" | "Persönlichkeit" | "Führung";

export const AXES: Axis[] = ["Fach", "SGA", "Persönlichkeit", "Führung"];

export { data };
