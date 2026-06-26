"use client";

import { Modal, ModalContent, Button, RadioGroup, Radio, Textarea } from "@heroui/react";

export default function RevokeKeyModal({
  isOpen,
  onClose,
  selectedKeyName,
  selectedUserId,
  subkeyGlobalIndex,
  revocationReason,
  setRevocationReason,
  revocationReasonText,
  setRevocationReasonText,
  onConfirm,
}) {
  const isSubkey =
    subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined;

  const title = isSubkey
    ? `Are You Sure You Want To Revoke ${selectedKeyName}'s Subkey #${subkeyGlobalIndex + 1}`
    : `Are You Sure You Want To Revoke ${selectedKeyName}'s Key`;

  return (
    <Modal
      size="xl"
      backdrop="blur"
      isOpen={isOpen}
      onClose={() => {
        onClose();
      }}
    >
      <ModalContent className="p-5">
        <h3 className="mb-2 font-semibold">{title}</h3>

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

        <RadioGroup
          className="mb-4"
          size="sm"
          color="primary"
          value={revocationReason}
          onValueChange={setRevocationReason}
        >
          <Radio value="0">Key is Compromised</Radio>
          <Radio value="1">Key is Superseded</Radio>
          <Radio value="2">Key is No Longer Used</Radio>
        </RadioGroup>

        <Textarea
          classNames={{ input: "min-h-[80px]" }}
          label="Description (Optional)"
          value={revocationReasonText}
          onChange={(e) => setRevocationReasonText(e.target.value)}
        />

        <div className="flex gap-2">
          <Button
            className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={onClose}
          >
            Cancel
          </Button>
          <Button
            className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
            onPress={async () => {
              onClose();
              await onConfirm();
            }}
          >
            Revoke
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
