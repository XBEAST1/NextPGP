"use client";

import { Modal, ModalContent, Input, Button, Textarea } from "@heroui/react";

interface RevokeUsingCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKeyName?: string;
  selectedUserId?: any;
  keyInput: string;
  setKeyInput: (val: string) => void;
  handleFileInput: (e: any) => void;
  onConfirm: (userId: any, input: string) => Promise<void>;
}

export default function RevokeUsingCertificateModal({
  isOpen,
  onClose,
  selectedKeyName,
  selectedUserId,
  keyInput,
  setKeyInput,
  handleFileInput,
  onConfirm,
}: RevokeUsingCertificateModalProps) {
  const handleYes = async () => {
    await onConfirm(selectedUserId, keyInput);
    onClose();
  };

  return (
    <Modal size="xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-2 font-semibold text-lg">
          Are You Sure You Want To Revoke {selectedKeyName}&apos;s Key?
        </h3>
        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-default-400">Creation Date:</p>
              <p className="font-mono">{selectedUserId?.creationdate}</p>
            </div>
            <div className="sm:-ms-12 -ms-6">
              <p className="text-default-400">Key ID:</p>
              <p className="font-mono">{selectedUserId?.keyid}</p>
            </div>
            <div className="col-span-2">
              <p className="text-default-400">Fingerprint:</p>
              <p className="font-mono">{selectedUserId?.fingerprint}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-red-500 font-semibold mb-2">
          This action is permanent and will take effect immediately.
        </p>

        <ul className="list-disc list-inside text-sm mb-4 text-default-500">
          <li>You can still decrypt anything previously encrypted to this key.</li>
          <li>You will no longer be able to sign messages or data with it.</li>
          <li>The key will no longer be usable for encryption.</li>
          <li>This revocation only takes effect locally unless you share the revoked key.</li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <Input
            className="w-full"
            multiple
            type="file"
            accept=".asc,.txt,.key,.rev"
            onChange={handleFileInput}
          />
        </div>
        <br />
        <Textarea
          disableAutosize
          classNames={{ input: "resize-y min-h-[120px]" }}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          placeholder="Paste Revocation Certificate Here"
        />
        <div className="flex gap-2">
          <Button
            className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={onClose}
          >
            No
          </Button>
          <Button
            className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
            onPress={handleYes}
            onKeyDown={async (e) => {
              if (e.key === "Enter") await handleYes();
            }}
          >
            Yes
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
