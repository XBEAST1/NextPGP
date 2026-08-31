"use client";

import type {
  EncryptWorkerTask,
  EncryptToastPayload,
  EncryptResponsePayload,
} from "./encryptWorker.types";

// NextPGP uses navigator.hardwareConcurrency to optimize worker pool size.
// This info never leaves the client and is used only for performance.

let workers: Worker[] = [];
if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  const numWorkers = navigator.hardwareConcurrency || 4;
  workers = Array.from(
    { length: numWorkers },
    () => new Worker(new URL("./encryptWorker.ts", import.meta.url))
  );
  console.log(
    `[NextPGP] Initialized ${workers.length} parallel worker thread${
      workers.length > 1 ? "s" : ""
    } to fully utilize multicore CPU performance.`
  );
}

let nextWorkerIndex = 0;

export function workerPool<T = any>(
  task: EncryptWorkerTask,
  onToast?: (payload: EncryptToastPayload) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!workers.length) {
      return reject(
        new Error("Worker pool not initialized in this environment.")
      );
    }

    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

    const handleMessage = (e: MessageEvent<EncryptResponsePayload>) => {
      // If a toast message is sent, call the provided callback.
      if (e.data.type === "addToast" && onToast) {
        onToast(e.data.payload);
      }
      if (e.data.type === task.responseType) {
        worker.removeEventListener("message", handleMessage);
        resolve(e.data.payload as T);
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage(task);
  });
}

export function terminatePool() {
  workers.forEach((worker) => worker.terminate());
}
