"use client";

import { Modal, ModalContent, Input, Button } from "@heroui/react";

interface AddUserIDModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  setName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  nameInvalid?: boolean;
  emailInvalid?: boolean;
  onAdd: () => void;
  nameInputRef?: any;
}

export default function AddUserIDModal({
  isOpen,
  onClose,
  name,
  setName,
  email,
  setEmail,
  nameInvalid,
  emailInvalid,
  onAdd,
  nameInputRef,
}: AddUserIDModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onAdd();
  };

  return (
    <Modal backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <Input
          ref={nameInputRef}
          isRequired
          name="pgp-username"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          label="Name"
          labelPlacement="outside"
          placeholder="Enter your name"
          isInvalid={nameInvalid}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <br />

        <Input
          label="Email"
          name="pgp-email"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
          labelPlacement="outside"
          placeholder="Enter your email"
          isInvalid={emailInvalid}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <br />

        <p className="text-sm text-gray-400 mb-2">
          This is how the new user ID will be stored in the key
        </p>

        {name || email ? (
          <p className="text-sm text-center font-bold">
            {name}
            {email ? ` <${email}>` : ""}
          </p>
        ) : null}

        <div className="flex gap-2">
          <Button
            className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            className="w-full mt-4 px-4 py-2 text-white rounded-full"
            color="success"
            variant="flat"
            onPress={onAdd}
          >
            Add
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
