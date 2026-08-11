"use client";

import { Modal, ModalContent, Snippet, Button } from "@heroui/react";

interface PublicKeySnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKeySnippet?: string;
  onDownload: () => void;
}

export default function PublicKeySnippetModal({
  isOpen,
  onClose,
  publicKeySnippet,
  onDownload,
}: PublicKeySnippetModalProps) {
  return (
    <Modal size="xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-8">
        <Snippet
          symbol=""
          classNames={{
            base: "max-w-full p-5 overflow-auto",
            content: "whitespace-pre-wrap break-all",
            pre: "whitespace-pre-wrap break-all max-h-[300px] overflow-auto",
          }}
        >
          {publicKeySnippet}
        </Snippet>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            className="px-4 py-2 text-white rounded-full"
            color="success"
            variant="flat"
            onPress={() => {
              onDownload();
              onClose();
            }}
          >
            Download Public Key
          </Button>
          <Button
            className="px-4 py-2 bg-default-200 text-white rounded-full"
            onPress={onClose}
          >
            Close
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
