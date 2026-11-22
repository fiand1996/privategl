import {
  claimNextTask,
  recoverInterruptedTasks,
} from "./database";
import { recordScanFailure, scanLibrary } from "./scanner";

let isScanningActive = false;

export function triggerScanQueue() {
  if (isScanningActive) return;
  isScanningActive = true;

  // Run in background without blocking caller
  void (async () => {
    try {
      recoverInterruptedTasks();

      while (true) {
        const task = claimNextTask();
        if (!task) break;

        try {
          await scanLibrary(task.id, task.libraryId);
        } catch (error) {
          recordScanFailure(task.id, error);
          console.error(`Scan task ${task.id} for library ${task.libraryId} failed:`, error);
        }
      }
    } catch (err) {
      console.error("Scan queue worker encountered an error:", err);
    } finally {
      isScanningActive = false;
    }
  })();
}
