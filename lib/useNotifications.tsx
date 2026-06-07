import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState } from "react-native";
import { useSession } from "./useSession";
import { getUnreadCount, markNotificationsSeen } from "./notifications";

type NotificationsContextValue = {
  unread: number;
  refresh: () => Promise<void>;
  markSeen: () => Promise<void>;
};

const Context = createContext<NotificationsContextValue>({
  unread: 0,
  refresh: async () => {},
  markSeen: async () => {},
});

// Shares the unread badge count between the bell (tab button) and the Notifs
// screen. Refreshes on login and whenever the app returns to the foreground.
export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useSession();
  const userId = session?.user?.id ?? null;
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnread(0);
      return;
    }
    setUnread(await getUnreadCount());
  }, [userId]);

  const markSeen = useCallback(async () => {
    await markNotificationsSeen();
    setUnread(0);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return (
    <Context.Provider value={{ unread, refresh, markSeen }}>
      {children}
    </Context.Provider>
  );
}

export function useNotifications() {
  return useContext(Context);
}
