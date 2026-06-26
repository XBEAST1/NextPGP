/**
 * hooks/usePasswordModal.js
 *
 * Manages all password-entry modal state and the promise-based
 * modal trigger functions.
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { addToast } from "@heroui/react";
import * as openpgp from "openpgp";

export function usePasswordModal() {
  const [password, setPassword] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [newKeyPassword, setnewKeyPassword] = useState(null);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPasswordChangeModal, setnewPasswordChangeModal] = useState(false);
  const [subkeyGlobalIndex, setSubkeyGlobalIndex] = useState(null);

  // Refs for auto-focusing inputs when modals open
  const passwordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);

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

  /**
   * Open the password entry modal and wait for the user to enter a correct
   * password for the given user's private key.  Retries until correct.
   */
  const triggerKeyPasswordModal = useCallback(
    async (user) => {
      setPassword("");
      setPasswordModal(true);
      return new Promise((resolve) => {
        const tryPassword = async () => {
          const enteredPassword = await new Promise((res) => {
            setnewKeyPassword(() => res);
          });
          try {
            const privateKey = await openpgp.readKey({
              armoredKey: user.privateKey,
            });
            await openpgp.decryptKey({ privateKey, passphrase: enteredPassword });
            setPasswordModal(false);
            resolve(enteredPassword);
          } catch {
            addToast({ title: "Incorrect Password", color: "danger" });
            tryPassword();
          }
        };
        tryPassword();
      });
    },
    []
  );

  /**
   * Open the new-password entry modal and wait for the user to submit.
   */
  const triggernewPasswordChangeModal = useCallback(
    () =>
      new Promise((resolve) => {
        setPassword("");
        setnewPasswordChangeModal(true);
        setnewKeyPassword(() => (pwd) => {
          setnewPasswordChangeModal(false);
          setnewKeyPassword(null);
          resolve(pwd);
        });
      }),
    []
  );

  /**
   * Open the password entry modal for a specific subkey and wait for
   * a correct passphrase.  Retries on wrong password.
   */
  const triggerSubkeyPasswordModal = useCallback(
    async (selectedSubkey) => {
      setPassword("");
      setPasswordModal(true);

      return new Promise((resolve, reject) => {
        const tryPassword = () => {
          setnewKeyPassword(() => async (pwd) => {
            if (!pwd) {
              setPasswordModal(false);
              setnewKeyPassword(null);
              reject(new Error("Password entry cancelled"));
              return;
            }
            try {
              await selectedSubkey.keyPacket.decrypt(pwd);
              if (!selectedSubkey.isDecrypted()) {
                throw new Error("Incorrect Password");
              }
              setPasswordModal(false);
              setnewKeyPassword(null);
              resolve(pwd);
            } catch {
              addToast({ title: "Incorrect Password", color: "danger" });
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
    setnewKeyPassword,
    passwordModal,
    setPasswordModal,
    newPasswordChangeModal,
    setnewPasswordChangeModal,
    subkeyGlobalIndex,
    setSubkeyGlobalIndex,
    // Refs
    passwordInputRef,
    newPasswordInputRef,
    // Trigger functions
    triggerKeyPasswordModal,
    triggernewPasswordChangeModal,
    triggerSubkeyPasswordModal,
  };
}
