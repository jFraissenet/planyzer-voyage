import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Session } from "@supabase/supabase-js";
import { syncMyAvatar } from "./avatarSync";
import { supabase } from "./supabase";

interface SessionContext {
  session: Session | null;
  isLoading: boolean;
}

const Context = createContext<SessionContext>({
  session: null,
  isLoading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastSyncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fire-and-forget avatar mirror, once per user per app session.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    if (lastSyncedUserRef.current === userId) return;
    lastSyncedUserRef.current = userId;
    void syncMyAvatar();
  }, [session?.user?.id]);

  return (
    <Context.Provider value={{ session, isLoading }}>
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  return useContext(Context);
}
