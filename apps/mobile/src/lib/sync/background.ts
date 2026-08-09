import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import { runSync } from "./engine";

/**
 * Background drain.
 *
 * The OS decides when this actually runs — iOS in particular treats the
 * interval as a hint and will not run it at all if the user rarely opens the
 * app. It is therefore a safety net for the case where an inspector finishes a
 * job, regains signal, but never reopens the app; the foreground and reconnect
 * triggers in provider.tsx remain the primary path.
 */
export const SYNC_TASK_NAME = "pioneers-sync";

TaskManager.defineTask(SYNC_TASK_NAME, async () => {
  try {
    const result = await runSync();
    return result.processed > 0 || result.photosUploaded > 0
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundSync(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME);
    if (isRegistered) return;

    await BackgroundTask.registerTaskAsync(SYNC_TASK_NAME, {
      // Minutes. The OS will not honour anything shorter than ~15 on iOS.
      minimumInterval: 15,
    });
  } catch {
    // Unavailable in Expo Go and on some devices; the app still syncs in the
    // foreground, so this is not fatal.
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(SYNC_TASK_NAME)) {
      await BackgroundTask.unregisterTaskAsync(SYNC_TASK_NAME);
    }
  } catch {
    // Nothing to do.
  }
}
