"use client";

import { Modal, ModalContent, Button } from "@heroui/react";

interface RevocationReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKeyName?: string;
  selectedUserId?: any;
  subkeyGlobalIndex?: number | null;
  revocationInfo?: any;
}

export default function RevocationReasonModal({
  isOpen,
  onClose,
  selectedKeyName,
  selectedUserId,
  subkeyGlobalIndex,
  revocationInfo,
}: RevocationReasonModalProps) {
  const isSubkey =
    subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined;

  const title = isSubkey
    ? `Revocation Reason for ${selectedKeyName}'s Subkey #${subkeyGlobalIndex + 1}`
    : `Revocation Reason for ${selectedKeyName}'s Key`;

  return (
    <Modal size="lg" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-2">{title}</h3>

        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-default-400">Creation Date:</p>
              <p className="font-mono">{selectedUserId?.creationdate}</p>
            </div>
            <div className="sm:-ms-5 -ms-6">
              <p className="text-default-400">Key ID:</p>
              <p className="font-mono">{selectedUserId?.keyid}</p>
            </div>
            <div className="col-span-2">
              <p className="text-default-400">Fingerprint:</p>
              <p className="font-mono">{selectedUserId?.fingerprint}</p>
            </div>
          </div>
        </div>

        {revocationInfo ? (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
            <p>
              <strong>Revocation Reason:</strong>{" "}
              {revocationInfo.reason ?? "Unknown"}
            </p>
            {revocationInfo.text ? (
              <p>
                <strong>Revocation Description:</strong> {revocationInfo.text}
              </p>
            ) : (
              <p>
                <em>No description provided.</em>
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-default-400">
            No revocation information found.
          </p>
        )}

        <div className="flex justify-end">
          <Button
            className="px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={onClose}
          >
            Close
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
