// NextPGP uses navigator.hardwareConcurrency to optimize worker pool size.
// This info never leaves the client and is used only for performance.

let workers = [];
if (typeof window !== "undefined" && typeof Worker !== "undefined") {
  const numWorkers = navigator.hardwareConcurrency || 4;
  workers = Array.from(
    { length: numWorkers },
    () => new Worker(new URL("./decryptWorker.js", import.meta.url))
  );
  console.log(
    `[NextPGP] Initialized ${workers.length} parallel worker thread${workers.length > 1 ? "s" : ""} to fully utilize multicore CPU performance.`
  );
}

let nextWorkerIndex = 0;

export function workerPool(task) {
  return new Promise((resolve, reject) => {
    if (!workers.length) {
      return reject(
        new Error("Worker pool not initialized in this environment.")
      );
    }

    const worker = workers[nextWorkerIndex];
    nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

    // Destructure additional callbacks
    const {
      onDetails,
      onToast,
      onModal,
      onDecryptedMessage,
      onDecryptedFile,
      onCurrentPrivateKey,
      ...taskData
    } = task;

    let responseReceived = false;
    let detailsReceived = false;
    let toastHandled = false;
    let modalHandled = false;
    let responsePayload = null;

    const handleMessage = async (e) => {
      const { type, payload } = e.data;

      if (
        type === "setDecryptedMessage" &&
        typeof onDecryptedMessage === "function"
      ) {
        await onDecryptedMessage(payload);
        responsePayload = payload;
        responseReceived = true;
      }

      if (type === "downloadFile" && typeof onDecryptedFile === "function") {
        await onDecryptedFile(payload);
        responsePayload = payload;
        responseReceived = true;
      }

      if (type === "setDetails" && typeof onDetails === "function") {
        await onDetails(payload);
        detailsReceived = true;
      }

      if (
        type === "setCurrentPrivateKey" &&
        typeof onCurrentPrivateKey === "function"
      ) {
        await onCurrentPrivateKey(payload);
      }

      if (type === "addToast" && typeof onToast === "function") {
        await onToast(payload);
        toastHandled = true;
      }

      if (type === "setIsPasswordModalOpen" && typeof onModal === "function") {
        await onModal(payload);
        modalHandled = true;
      }

      if (type === "error") {
        worker.removeEventListener("message", handleMessage);
        return;
      }

      if (responseReceived && detailsReceived && toastHandled && modalHandled) {
        worker.removeEventListener("message", handleMessage);
        resolve(responsePayload);
      }
    };

    worker.addEventListener("message", handleMessage);
    worker.postMessage(taskData);
  });
}

export function terminatePool() {
  workers.forEach((worker) => worker.terminate());
}
