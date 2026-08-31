/**
 * Shared type definitions for the decrypt worker and worker pool.
 *
 * These types define the message contract between the main thread
 * and the decrypt Web Worker.
 */

/** The shape of a stored PGP key as received from the main thread */
export interface StoredPGPKey {
  id?: string | number;
  publicKey?: string;
  privateKey?: string;
  passphrase?: string;
  userIDs?: string[];
  canEncrypt?: boolean;
  selectedUserId?: string;
}

/** Message types sent TO the worker */
export type DecryptWorkerMessageType =
  | "messageDecrypt"
  | "messagePasswordDecrypt"
  | "fileDecrypt"
  | "filePasswordDecrypt";

/** Data payload sent TO the worker via postMessage */
export interface DecryptWorkerMessageData {
  type: DecryptWorkerMessageType;
  inputMessage?: string;
  pgpKeys?: StoredPGPKey[];
  password?: string;
  currentPrivateKey?: string;
  files?: File[];
}

/** Message types sent FROM the worker back to the main thread */
export type DecryptResponseType =
  | "setDecryptedMessage"
  | "setDetails"
  | "addToast"
  | "error"
  | "setCurrentPrivateKey"
  | "setIsPasswordModalOpen"
  | "downloadFile"
  | "passworderror"
  | "complete";

/** Response payload sent FROM the worker via postMessage */
export interface DecryptResponsePayload {
  type: DecryptResponseType;
  payload: unknown;
}

/** Task passed to the workerPool function (message data + callbacks) */
export interface DecryptWorkerTask extends DecryptWorkerMessageData {
  responseType?: string;
  onDetails?: (details: string) => unknown;
  onToast?: (toast: { title: string; description?: string; color: string }) => unknown;
  onModal?: (isOpen: boolean) => unknown;
  onError?: (error?: { message: string }) => unknown;
  onDecryptedMessage?: (message: string) => unknown;
  onDecryptedFile?: (file: { fileName: string; decrypted: Uint8Array }) => unknown;
  onCurrentPrivateKey?: (key: string | null) => unknown;
}
