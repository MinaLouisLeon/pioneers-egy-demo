import NetInfo from "@react-native-community/netinfo";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { getPendingCounts, type PendingCounts } from "../db/jobs";
import { resetFailures } from "./outbox";
import { isSyncInProgress, onSyncChange, runSync } from "./engine";

type SyncContextValue = {
  isOnline: boolean;
  isSyncing: boolean;
  pending: PendingCounts;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  refreshCounts: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

/**
 * Wires the sync engine to the things that should trigger it:
 *
 *   - regaining connectivity (the common case in the field)
 *   - the app returning to the foreground
 *   - an explicit tap on "Sync now"
 *
 * Notably it does NOT poll. A timer would wake the radio on a device that is
 * deliberately offline and drain the battery an inspector needs for the rest of
 * the shift.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pending, setPending] = useState<PendingCounts>({ outbox: 0, photos: 0, failed: 0 });
  const wasOffline = useRef(false);

  const refreshCounts = useCallback(async () => {
    try {
      setPending(await getPendingCounts());
    } catch {
      // The database may not be open yet on first launch.
    }
  }, []);

  const syncNow = useCallback(async () => {
    await runSync();
    await refreshCounts();
  }, [refreshCounts]);

  const retryFailed = useCallback(async () => {
    await resetFailures();
    await syncNow();
  }, [syncNow]);

  useEffect(() => {
    const unsubscribeEngine = onSyncChange(() => {
      setIsSyncing(isSyncInProgress());
      void refreshCounts();
    });

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      // Only sync on the offline -> online edge, not on every network event.
      if (online && wasOffline.current) {
        void syncNow();
      }
      wasOffline.current = !online;
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });

    void refreshCounts();
    void syncNow();

    return () => {
      unsubscribeEngine();
      unsubscribeNet();
      appStateSubscription.remove();
    };
  }, [syncNow, refreshCounts]);

  const value = useMemo(
    () => ({ isOnline, isSyncing, pending, syncNow, retryFailed, refreshCounts }),
    [isOnline, isSyncing, pending, syncNow, retryFailed, refreshCounts],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) throw new Error("useSync must be used inside a SyncProvider.");
  return context;
}
