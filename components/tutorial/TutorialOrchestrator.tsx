import { useEffect } from "react";
import { useSession } from "@/lib/useSession";
import {
  cleanupMyOrphanDemos,
  hasSeenTutorial,
} from "@/lib/tutorials/api";
import { useTutorial } from "@/lib/tutorials/TutorialContext";
import { TutorialPlayer } from "./TutorialPlayer";
import { TutorialPromptModal } from "./TutorialPromptModal";

/**
 * Mounted once at the root. Handles:
 *   - cleanup of orphan demo events when the user logs in
 *   - auto-opening the first-login prompt (only if tutorial_seen_at is null)
 *   - mounting the prompt modal and the player overlay globally
 */
export function TutorialOrchestrator() {
  const { session, isLoading } = useSession();
  const { promptVisible, openPrompt, closePrompt } = useTutorial();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (isLoading || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        await cleanupMyOrphanDemos();
        const seen = await hasSeenTutorial();
        if (!cancelled && !seen) openPrompt();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isLoading, openPrompt]);

  return (
    <>
      <TutorialPromptModal visible={promptVisible} onClose={closePrompt} />
      <TutorialPlayer />
    </>
  );
}
