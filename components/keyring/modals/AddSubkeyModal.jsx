"use client";

import {
  Modal,
  ModalContent,
  Autocomplete,
  AutocompleteItem,
  RadioGroup,
  Radio,
  Checkbox,
  DatePicker,
  Button,
} from "@heroui/react";
import { today, getLocalTimeZone } from "@internationalized/date";
import { parseExpiryToCalendarDate } from "@/lib/pgp";

const keyalgorithms = [
  { label: "Curve25519 (EdDSA/ECDH) - Recommended", key: "curve25519" },
  { label: "NIST P-256 (ECDSA/ECDH)", key: "nistP256" },
  { label: "NIST P-521 (ECDSA/ECDH)", key: "nistP521" },
  { label: "Brainpool P-256r1 (ECDSA/ECDH)", key: "brainpoolP256r1" },
  { label: "Brainpool P-512r1 (ECDSA/ECDH)", key: "brainpoolP512r1" },
  { label: "RSA 2048", key: "rsa2048" },
  { label: "RSA 3072", key: "rsa3072" },
  { label: "RSA 4096", key: "rsa4096" },
];

export default function AddSubkeyModal({
  isOpen,
  onClose,
  selectedUserId,
  isNoExpiryChecked,
  setIsNoExpiryChecked,
  expiryDate,
  setExpiryDate,
  selectedAlgorithm,
  setSelectedAlgorithm,
  subkeyOption,
  setSubkeyOption,
  onAdd,
}) {
  const primaryKeyMaxDate = parseExpiryToCalendarDate(selectedUserId?.expirydate);

  return (
    <Modal backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-8">
        <Autocomplete
          className="max-w-md"
          defaultItems={keyalgorithms}
          selectedKey={selectedAlgorithm}
          label="Select Key Algorithm"
          onSelectionChange={(selectedItem) => {
            const selectedKey =
              typeof selectedItem === "object" && selectedItem !== null
                ? selectedItem.key
                : selectedItem;
            if (selectedKey) setSelectedAlgorithm(selectedKey);
          }}
        >
          {(item) => (
            <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>
          )}
        </Autocomplete>

        <br />

        <RadioGroup
          label="Subkey Usage"
          className="mb-4"
          size="sm"
          color="success"
          value={subkeyOption}
          onValueChange={setSubkeyOption}
        >
          <Radio value="0">Signing</Radio>
          <Radio value="1">Encryption</Radio>
        </RadioGroup>

        <Checkbox
          defaultSelected={isNoExpiryChecked}
          color="default"
          onChange={(e) => setIsNoExpiryChecked(e.target.checked)}
        >
          No Expiry
        </Checkbox>

        <br />

        <DatePicker
          minValue={today(getLocalTimeZone()).add({ days: 1 })}
          maxValue={primaryKeyMaxDate ?? undefined}
          isDisabled={isNoExpiryChecked}
          className="max-w-[284px]"
          label="Expiry date"
          value={expiryDate}
          onChange={(date) => setExpiryDate(date)}
        />

        <br />

        <div className="mb-2">
          <span className="font-semibold">Primary Key Expiry:&nbsp;</span>
          <span>{selectedUserId?.expirydate || "Unknown"}</span>
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
