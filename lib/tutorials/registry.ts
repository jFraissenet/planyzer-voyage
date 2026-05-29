import { birthdayTutorial } from "./birthday";
import type { Tutorial } from "./types";

// Registry of all known tutorials. Scenarios first (full flows), then
// per-tool tours.
export const TUTORIALS: Tutorial[] = [birthdayTutorial];

export const SCENARIOS: { id: string; comingSoon: boolean }[] = [
  { id: "birthday", comingSoon: false },
  { id: "wedding", comingSoon: true },
  { id: "ski", comingSoon: true },
];

export function getTutorial(id: string): Tutorial | undefined {
  return TUTORIALS.find((t) => t.id === id);
}
