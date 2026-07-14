import { Modal, ModalContent, Button } from "@heroui/react";

export default function DeleteCloudKeyModal({
  isOpen,
  onClose,
  selectedKeyName,
  onConfirm,
}) {
  return (
    <Modal backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-5">
        <h3 className="mb-2">
          Are You Sure You Want To Delete {selectedKeyName}&apos;s Key From
          Cloud?
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
            onPress={onConfirm}
          >
            Yes
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}
