/**
 * hooks/usePasswordModal.ts
 *
 * Manages all password-entry modal state and the promise-based
 * modal trigger functions matching the proven design from previous commits.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";

export type PasswordSubmitHandler = (pwd: string) => void | Promise<void>;

export function usePasswordModal() {
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [newKeyPassword, setNewKeyPassword] = useState<PasswordSubmitHandler | null>(null);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPasswordChangeModal, setNewPasswordChangeModal] = useState(false);
  const [subkeyGlobalIndex, setSubkeyGlobalIndex] = useState<number | null>(null);

  // Refs for auto-focusing inputs when modals open
  const passwordInputRef = useRef<any>(null);
  const newPasswordInputRef = useRef<any>(null);

  const toggleVisibility = () => setIsVisible((v) => !v);

  // Auto-focus effects
  useEffect(() => {
    if (passwordModal && passwordInputRef.current) {
      setTimeout(() => passwordInputRef.current?.focus(), 100);
    }
  }, [passwordModal]);

  useEffect(() => {
    if (newPasswordChangeModal && newPasswordInputRef.current) {
      setTimeout(() => newPasswordInputRef.current?.focus(), 100);
    }
  }, [newPasswordChangeModal]);

  const onPasswordModalClose = useCallback(() => {
    setPasswordModal(false);
    setNewKeyPassword(null);
  }, []);

  const onNewPasswordModalClose = useCallback(() => {
    setNewPasswordChangeModal(false);
    setNewKeyPassword(null);
  }, []);

  /**
   * Open the password entry modal and wait for the user to enter a correct
   * password for the given user's private key. Retries until correct.
   */
  const triggerKeyPasswordModal = useCallback(
    async (user: any): Promise<string> => {
      setPassword("");
      setPasswordModal(true);
      return new Promise<string>((resolve, reject) => {
        let isProcessing = false;
        const tryPassword = () => {
          setNewKeyPassword(() => async (enteredPassword: string) => {
            if (isProcessing) return;
            if (!enteredPassword) {
              setPasswordModal(false);
              setNewKeyPassword(null);
              reject(new Error("Password entry cancelled"));
              return;
            }
            isProcessing = true;
            try {
              const privateKey = (await openpgp.readKey({
                armoredKey: user.privateKey,
              })) as any;
              if (privateKey.isDecrypted()) {
                setPasswordModal(false);
                setNewKeyPassword(null);
                resolve(enteredPassword);
                return;
              }
              await openpgp.decryptKey({ privateKey, passphrase: enteredPassword });
              setPasswordModal(false);
              setNewKeyPassword(null);
              resolve(enteredPassword);
            } catch (err: any) {
              if (/already decrypted/i.test(err?.message)) {
                setPasswordModal(false);
                setNewKeyPassword(null);
                resolve(enteredPassword);
                return;
              }
              addToast({ title: "Incorrect Password", color: "danger" });
              isProcessing = false;
            }
          });
        };
        tryPassword();
      });
    },
    []
  );

  /**
   * Open the new-password entry modal and wait for the user to submit.
   */
  const triggerNewPasswordChangeModal = useCallback(
    (): Promise<string> =>
      new Promise<string>((resolve) => {
        setPassword("");
        setNewPasswordChangeModal(true);
        let submitted = false;
        setNewKeyPassword(() => (pwd: string) => {
          if (submitted) return;
          submitted = true;
          setNewPasswordChangeModal(false);
          setNewKeyPassword(null);
          resolve(pwd);
        });
      }),
    []
  );

  /**
   * Open the password entry modal for a specific subkey and wait for
   * a correct passphrase. Retries on wrong password.
   */
  const triggerSubkeyPasswordModal = useCallback(
    async (selectedSubkey: any): Promise<string> => {
      setPassword("");
      setPasswordModal(true);

      return new Promise<string>((resolve, reject) => {
        let isProcessing = false;
        const tryPassword = () => {
          setNewKeyPassword(() => async (pwd: string) => {
            if (isProcessing) return;
            if (!pwd) {
              setPasswordModal(false);
              setNewKeyPassword(null);
              reject(new Error("Password entry cancelled"));
              return;
            }
            isProcessing = true;
            try {
              if (selectedSubkey.isDecrypted()) {
                setPasswordModal(false);
                setNewKeyPassword(null);
                resolve(pwd);
                return;
              }
              await selectedSubkey.keyPacket.decrypt(pwd);
              if (!selectedSubkey.isDecrypted()) {
                throw new Error("Incorrect Password");
              }
              setPasswordModal(false);
              setNewKeyPassword(null);
              resolve(pwd);
            } catch (err: any) {
              if (/already decrypted/i.test(err?.message)) {
                setPasswordModal(false);
                setNewKeyPassword(null);
                resolve(pwd);
                return;
              }
              addToast({ title: "Incorrect Password", color: "danger" });
              isProcessing = false;
            }
          });
        };
        tryPassword();
      });
    },
    []
  );

  return {
    // State
    password,
    setPassword,
    isVisible,
    toggleVisibility,
    newKeyPassword,
    setNewKeyPassword,
    passwordModal,
    setPasswordModal,
    newPasswordChangeModal,
    setNewPasswordChangeModal,
    subkeyGlobalIndex,
    setSubkeyGlobalIndex,
    // Close handlers
    onPasswordModalClose,
    onNewPasswordModalClose,
    // Refs
    passwordInputRef,
    newPasswordInputRef,
    // Trigger functions
    triggerKeyPasswordModal,
    triggerNewPasswordChangeModal,
    triggerSubkeyPasswordModal,
  };
}
