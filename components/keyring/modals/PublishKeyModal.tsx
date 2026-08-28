"use client";

import { Modal, ModalContent, Button } from "@heroui/react";

interface PublishKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKeyName?: string;
  onConfirm: () => Promise<void>;
}

export default function PublishKeyModal({
  isOpen,
  onClose,
  selectedKeyName,
  onConfirm,
}: PublishKeyModalProps) {
  const handlePublish = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal size="2xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-2 font-semibold text-lg">
          Are you sure you want to publish {selectedKeyName}&apos;s public key
          to the server?
        </h3>

        <div className="mb-4 text-sm text-yellow-400">
          <p className="font-semibold mb-2">
            ⚠️ Once an OpenPGP public key is published to a public directory
            server, it cannot be removed.
          </p>
          <p className="mb-2">
            Before proceeding, ensure you have generated a revocation
            certificate. This is essential in case your key is compromised,
            lost, or if you forget the passphrase.
          </p>
          <p>Do you still want to continue?</p>
        </div>

        <div className="flex gap-2">
          <Button
            className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            className="w-full mt-4 px-4 py-2 text-white rounded-full"
            color="warning"
            variant="flat"
            onPress={handlePublish}
          >
            Yes, Publish Key
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
