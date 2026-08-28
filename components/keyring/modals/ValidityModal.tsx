"use client";

import {
  Modal,
  ModalContent,
  Checkbox,
  DatePicker,
  Button,
} from "@heroui/react";
import { today, getLocalTimeZone } from "@internationalized/date";

interface ValidityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isNoExpiryChecked?: boolean;
  setIsNoExpiryChecked: (checked: boolean) => void;
  expiryDate?: any;
  setExpiryDate: (date: any) => void;
  onConfirm: () => void;
}

export default function ValidityModal({
  isOpen,
  onClose,
  isNoExpiryChecked,
  setIsNoExpiryChecked,
  expiryDate,
  setExpiryDate,
  onConfirm,
}: ValidityModalProps) {
  return (
    <Modal
      size="sm"
      backdrop="blur"
      isOpen={isOpen}
      onClose={() => {
        onClose();
        setIsNoExpiryChecked(true);
        setExpiryDate(null);
      }}
    >
      <ModalContent className="p-5">
        <Checkbox
          defaultSelected={isNoExpiryChecked}
          color="default"
          onChange={(e) => setIsNoExpiryChecked(e.target.checked)}
        >
          No Expiry
        </Checkbox>
        <br />
        <DatePicker
          minValue={today(getLocalTimeZone()).add({ days: 1 }) as any}
          color="default"
          isDisabled={isNoExpiryChecked}
          label="Expiry date"
          value={expiryDate}
          onChange={(date) => setExpiryDate(date)}
        />
        <Button
          className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
          onPress={onConfirm}
        >
          Confirm
        </Button>
      </ModalContent>
    </Modal>
  );
}
