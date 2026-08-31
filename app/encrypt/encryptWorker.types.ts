/**
 * Shared type definitions for the encrypt worker and worker pool.
 */

export interface EncryptRecipientKey {
  id: string | number;
  publicKey: string;
  privateKey?: string;
  userIDs?: string[];
  canEncrypt?: boolean;
  selectedUserId?: string;
}

export type EncryptRecipientSelection =
  | string
  | { keyId: string; userId: string };

export type EncryptWorkerMessageType =
  | "messageEncrypt"
  | "fileEncrypt"
  | (string & {});

export type EncryptWorkerResponseType =
  | "setEncryptedMessage"
  | "downloadFile"
  | "addToast"
  | (string & {});

export interface EncryptWorkerMessageData {
  type: EncryptWorkerMessageType;
  responseType?: EncryptWorkerResponseType;
  message?: string;
  recipientKeys?: EncryptRecipientKey[];
  recipients?: EncryptRecipientSelection[];
  isChecked?: boolean;
  encryptionPassword?: string;
  decryptedPrivateKey?: string | null;
  files?: File[] | null;
  directoryFiles?: File[] | null;
  signerKey?: { id: string; selectedUserId?: string } | null;
}

export interface EncryptToastPayload {
  title: string;
  description?: string;
  color: "primary" | "success" | "warning" | "danger";
}

export interface EncryptDownloadPayload {
  fileName: string;
  encrypted: Uint8Array | string;
}

export type EncryptResponsePayload =
  | { type: "setEncryptedMessage"; payload: string }
  | { type: "downloadFile"; payload: EncryptDownloadPayload }
  | { type: "addToast"; payload: EncryptToastPayload };

export interface EncryptWorkerTask extends EncryptWorkerMessageData {
  responseType?: EncryptWorkerResponseType;
}
