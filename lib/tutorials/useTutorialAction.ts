import { useEffect } from "react";
import { useTutorial } from "./TutorialContext";
import type { TutorialAction } from "./types";

/**
 * Subscribe to a single kind of tutorial action. The handler fires whenever
 * the engine emits a step whose action matches that kind.
 *
 *   useTutorialAction("open-edit-team", (a) => setEditing(teams.find(t => t.team_id === a.teamId)));
 */
export function useTutorialAction<K extends TutorialAction["kind"]>(
  kind: K,
  handler: (action: Extract<TutorialAction, { kind: K }>) => void,
): void {
  const { currentAction } = useTutorial();
  useEffect(() => {
    if (currentAction?.kind === kind) {
      handler(currentAction as Extract<TutorialAction, { kind: K }>);
    }
  }, [currentAction, kind, handler]);
}
