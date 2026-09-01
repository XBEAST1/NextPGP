"use client";

import type {
  CryptoWorkerTask,
  CryptoResponsePayload,
} from "./cryptoWorker.types";

// NextPGP uses navigator.hardwareConcurrency to optimize worker pool size.
// This info never leaves the client and is used only for performance.

let workers: Worker[] = [];
if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  const numWorkers = navigator.hardwareConcurrency || 4;
  workers = Array.from(
    { length: numWorkers },
    () => new Worker(new URL("./cryptoWorker.ts", import.meta.url))
  );
  console.log(
    `[NextPGP] Initialized ${workers.length} parallel worker thread${
      workers.length > 1 ? "s" : ""
    } to fully utilize multicore CPU performance.`
  );
}

let nextWorkerIndex = 0;
let nextTaskId = 0;

export function workerPool<T = any>(
  task: CryptoWorkerTask,
  _addToast?: unknown,
  timeoutMs = 30_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!workers.length) {
      return reject(
        new Error("Worker pool not initialized in this environment.")
      );
    }

    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

    const taskId = nextTaskId++;

    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Worker task timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const handleError = (err: ErrorEvent) => {
      cleanup();
      reject(new Error(err.message || "Worker crashed"));
    };

    const handleMessage = (e: MessageEvent<CryptoResponsePayload>) => {
      if (e.data.taskId !== taskId) return;

      cleanup();

      if (e.data.type === "error") {
        reject(new Error(e.data.error || "Worker error"));
        return;
      }

      if (e.data.type === task.responseType) {
        resolve(e.data.payload as T);
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    worker.postMessage({ ...task, taskId });
  });
}

export function terminatePool() {
  workers.forEach((worker) => worker.terminate());
}
