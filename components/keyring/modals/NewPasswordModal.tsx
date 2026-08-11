"use client";

import { Modal, ModalContent, Input, Button, addToast } from "@heroui/react";
import { EyeFilledIcon, EyeSlashFilledIcon } from "@/components/icons";

interface NewPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  subkeyGlobalIndex?: number | null;
  password: string;
  setPassword: (val: string) => void;
  isVisible: boolean;
  toggleVisibility: () => void;
  newKeyPassword?: (pwd: string) => void;
  inputRef?: any;
}

export default function NewPasswordModal({
  isOpen,
  onClose,
  subkeyGlobalIndex,
  password,
  setPassword,
  isVisible,
  toggleVisibility,
  newKeyPassword,
  inputRef,
}: NewPasswordModalProps) {
  const handleSubmit = () => {
    if (password.trim() === "") {
      addToast({ title: "Please Enter a Password", color: "danger" });
    } else if (newKeyPassword) {
      newKeyPassword(password);
    }
  };

  return (
    <Modal backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-4">
          {subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined
            ? `Enter New Password For Subkey #${subkeyGlobalIndex + 1}`
            : "Enter New Password"}
        </h3>
        <Input
          ref={inputRef}
          id="newPasswordInput"
          name="password"
          placeholder="Enter Password"
          type={isVisible ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          endContent={
            <button
              aria-label="toggle password visibility"
              className="focus:outline-none"
              type="button"
              onClick={toggleVisibility}
            >
              {isVisible ? (
                <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
              ) : (
                <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
              )}
            </button>
          }
        />
        <Button
          className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
          onPress={handleSubmit}
        >
          Submit
        </Button>
      </ModalContent>
    </Modal>
  );
}
