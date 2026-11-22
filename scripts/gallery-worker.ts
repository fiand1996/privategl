import {
  claimNextTask,
  recoverInterruptedTasks,
} from "../lib/database";
import { recordScanFailure, scanLibrary } from "../lib/scanner";

const POLL_INTERVAL_MS = 1500;
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

async function runWorker() {
  recoverInterruptedTasks();
  console.info("Gallery scan worker started.");

  while (!stopping) {
    const task = claimNextTask();
    if (!task) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      continue;
    }

    console.info(`Scanning library ${task.libraryId} (task ${task.id}).`);
    try {
      await scanLibrary(task.id, task.libraryId);
      console.info(`Finished scan task ${task.id}.`);
    } catch (error) {
      recordScanFailure(task.id, error);
      console.error(`Scan task ${task.id} failed:`, error);
    }
  }

  console.info("Gallery scan worker stopped.");
}

void runWorker().catch((error: unknown) => {
  console.error("Gallery worker stopped unexpectedly:", error);
  process.exitCode = 1;
});
