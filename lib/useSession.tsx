import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Session } from "@supabase/supabase-js";
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

  return (
    <Context.Provider value={{ session, isLoading }}>
      {children}
    </Context.Provider>
  );
}

export function useSession() {
  return useContext(Context);
}
