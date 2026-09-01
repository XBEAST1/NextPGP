/**
 * Shared type definitions for the vault crypto worker and worker pool.
 */

export type CryptoWorkerTaskType =
  | "encrypt"
  | "decrypt"
  | "deriveMasterKey"
  | "extractSalt"
  | "hashKey";

export type CryptoWorkerResponseType =
  | "encryptResponse"
  | "decryptResponse"
  | "deriveMasterKeyResponse"
  | "extractSaltResponse"
  | "hashKeyResponse"
  | "error"
  | (string & {});

export interface DeriveMasterKeyResult {
  keyMaterial: number[];
  salt: number[];
}

export interface EncryptTaskOptions {
  password?: string;
  keyMaterial?: number[] | Uint8Array | null;
  salt?: number[] | Uint8Array | null;
  iterations?: number;
}

export interface DecryptTaskOptions {
  password?: string;
  keyMaterial?: number[] | Uint8Array | null;
  expectedSalt?: number[] | Uint8Array | null;
}

export interface CryptoWorkerMessageData {
  taskId?: number;
  type: CryptoWorkerTaskType;
  responseType?: CryptoWorkerResponseType;
  text?: string;
  encryptedBase64?: string;
  password?: string;
  keyMaterial?: number[] | Uint8Array | null;
  salt?: number[] | Uint8Array | null;
  expectedSalt?: number[] | Uint8Array | null;
  iterations?: number;
}

export interface CryptoResponsePayload {
  type: CryptoWorkerResponseType;
  taskId?: number;
  payload?: unknown;
  error?: string;
}

export interface CryptoWorkerTask extends CryptoWorkerMessageData {
  responseType?: CryptoWorkerResponseType;
}
