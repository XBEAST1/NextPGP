import type {
  DecryptWorkerMessageData,
  DecryptResponsePayload,
} from "@/app/decrypt/decryptWorker.types";
import { handleDecryptWorkerMessage } from "@/app/decrypt/decryptWorker";

export interface WorkerHarnessResult {
  messages: DecryptResponsePayload[];
  decryptedMessage?: string;
  details?: string;
  toasts: Array<{ title: string; description?: string; color: string }>;
  downloadFiles: Array<{ fileName: string; decrypted: Uint8Array }>;
  errors: Array<{ message: string }>;
  passwordErrors: Array<{ message: string }>;
  isPasswordModalOpen?: boolean;
  currentPrivateKey?: string | null;
  isComplete: boolean;
}

/**
 * Runs a decrypt worker task inside a controlled test harness and captures all postMessage events.
 */
export async function runDecryptWorkerHarness(
  data: DecryptWorkerMessageData
): Promise<WorkerHarnessResult> {
  const messages: DecryptResponsePayload[] = [];

  const originalPostMessage = globalThis.postMessage;

  // Mock global postMessage for worker context
  (globalThis as any).postMessage = (response: DecryptResponsePayload) => {
    messages.push(response);
  };

  try {
    const event = { data } as MessageEvent<DecryptWorkerMessageData>;
    await handleDecryptWorkerMessage(event);
  } finally {
    (globalThis as any).postMessage = originalPostMessage;
  }

  const result: WorkerHarnessResult = {
    messages,
    toasts: [],
    downloadFiles: [],
    errors: [],
    passwordErrors: [],
    isComplete: false,
  };

  for (const msg of messages) {
    switch (msg.type) {
      case "setDecryptedMessage":
        result.decryptedMessage = msg.payload as string;
        break;
      case "setDetails":
        result.details = msg.payload as string;
        break;
      case "addToast":
        result.toasts.push(
          msg.payload as { title: string; description?: string; color: string }
        );
        break;
      case "downloadFile":
        result.downloadFiles.push(
          msg.payload as { fileName: string; decrypted: Uint8Array }
        );
        break;
      case "setCurrentPrivateKey":
        result.currentPrivateKey = msg.payload as string | null;
        break;
      case "setIsPasswordModalOpen":
        result.isPasswordModalOpen = msg.payload as boolean;
        break;
      case "error":
        result.errors.push(msg.payload as { message: string });
        break;
      case "passworderror":
        result.passwordErrors.push(msg.payload as { message: string });
        break;
      case "complete":
        result.isComplete = true;
        break;
    }
  }

  return result;
}
