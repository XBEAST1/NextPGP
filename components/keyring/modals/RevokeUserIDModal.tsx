"use client";

import { Modal, ModalContent, Button } from "@heroui/react";

interface RevokeUserIDModalProps {
  isOpen: boolean;
  onClose: () => void;
  userIDToRevoke?: any;
  onConfirm: () => Promise<void>;
}

export default function RevokeUserIDModal({
  isOpen,
  onClose,
  userIDToRevoke,
  onConfirm,
}: RevokeUserIDModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal size="md" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-2">
          Are You Sure You Want To Revoke {userIDToRevoke?.name}&apos;s User
          ID?
        </h3>
        <div className="flex gap-2">
          <Button
            className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={onClose}
          >
            No
          </Button>
          <Button
            className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
            onPress={handleConfirm}
            onKeyDown={async (e) => {
              if (e.key === "Enter") await handleConfirm();
            }}
          >
            Yes
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
