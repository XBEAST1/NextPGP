"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { VerticalDotsIcon } from "@/components/icons";
import * as openpgp from "openpgp";
import { CalendarDate } from "@internationalized/date";

export default function UserActionsDropdownSubkey({
  subkey,
  selectedUserId,
  // state setters passed from parent
  setSubkeyGlobalIndex,
  setSelectedSubkey,
  setvalidityModal,
  setIsNoExpiryChecked,
  setExpiryDate,
  setrevokeModal,
  setrevocationReasonModal,
  setRevocationInfo,
  // action callbacks
  onBackupSubkey,
  onAddOrChangeSubkeyPassword,
  onRemoveSubkeyPassword,
}) {
  const [armoredSubkey, setArmoredSubkey] = useState([]);
  const [isSubkeyProtected, setIsSubkeyProtected] = useState(false);
  const revocationReasonsRef = useRef([]);

  useEffect(() => {
    const extractArmoredSubkeysFromMasterKey = async () => {
      try {
        if (!selectedUserId?.privateKey?.trim()) return;

        const privateKey = await openpgp.readPrivateKey({
          armoredKey: selectedUserId.privateKey,
        });

        const primaryPacket = privateKey.keyPacket;
        const subkeys = privateKey.getSubkeys();

        const packetList = privateKey.toPacketList();
        const userIDPackets = packetList.filterByTag(openpgp.enums.packet.userID);
        const userIDSigs = packetList
          .filterByTag(openpgp.enums.packet.signature)
          .filter((sig) => sig.signatureType === openpgp.enums.signature.certPositive);

        if (userIDPackets.length === 0 || userIDSigs.length === 0) {
          console.warn("No User IDs or certifications found in the original key.");
          return;
        }

        const reasonsMap = {
          0: "Key is Compromised",
          1: "Key is Superseded",
          2: "Key is No Longer Used",
        };

        const allSubkeys = [];
        const allReasons = [];

        const protectionStatuses = subkeys.map((sk) => !sk.isDecrypted());
        const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);
        setIsSubkeyProtected(protectionStatuses[subkeyIndex]);

        subkeys.forEach((sk) => {
          const standalone = new openpgp.PacketList();
          standalone.push(primaryPacket);
          userIDPackets.forEach((uid) => standalone.push(uid));
          userIDSigs.forEach((sig) => standalone.push(sig));
          standalone.push(sk.keyPacket);
          sk.bindingSignatures?.forEach((sig) => standalone.push(sig));
          sk.revocationSignatures?.forEach((sig) => standalone.push(sig));

          let reasonInfo = null;
          for (const sig of sk.revocationSignatures) {
            if (sig.reasonForRevocationFlag !== undefined) {
              reasonInfo = {
                code: sig.reasonForRevocationFlag,
                reason: reasonsMap[sig.reasonForRevocationFlag] || "Unknown reason",
                text: sig.reasonForRevocationString,
              };
              break;
            }
          }
          allReasons.push(reasonInfo);

          const armored = openpgp.armor(
            openpgp.enums.armor.privateKey,
            standalone.write()
          );
          allSubkeys.push(armored);
        });

        setArmoredSubkey(allSubkeys);
        revocationReasonsRef.current = allReasons;
      } catch (err) {
        console.error("Failed to export standalone subkeys", err);
      }
    };

    extractArmoredSubkeysFromMasterKey();
  }, []);

  const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);

  const openValidityModal = () => {
    setSubkeyGlobalIndex(subkeyIndex);
    setSelectedSubkey(armoredSubkey[subkeyIndex]);
    if (subkey.expirydate === "No Expiry") {
      setIsNoExpiryChecked(true);
      setExpiryDate(null);
    } else {
      setIsNoExpiryChecked(false);
      const [day, month, year] = subkey.expirydate.split("-");
      const monthMap = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      const date = new Date(year, monthMap[month], parseInt(day));
      setExpiryDate(new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate()));
    }
    setvalidityModal(true);
  };

  return (
    <div className="relative flex justify-end items-center gap-2 me-8">
      <Dropdown>
        <DropdownTrigger>
          <Button isIconOnly size="sm" variant="light">
            <VerticalDotsIcon className="text-default-300" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="Subkey actions"
          shouldBlockScroll={true}
          closeOnSelect={true}
          classNames={{
            base: "max-w-[280px] sm:max-w-[320px]",
            list: "max-h-[80vh] overflow-y-auto",
          }}
        >
          <DropdownItem
            onPress={() => {
              setSubkeyGlobalIndex(subkeyIndex);
              onBackupSubkey(subkey, subkeyIndex, armoredSubkey[subkeyIndex]);
            }}
          >
            Backup Subkey
          </DropdownItem>

          {subkey.status === "revoked" ? null : (
            <DropdownItem key="change-subkey-validity" onPress={openValidityModal}>
              Change Validity
            </DropdownItem>
          )}

          {subkey.status !== "revoked" &&
            (isSubkeyProtected ? (
              <>
                <DropdownItem
                  key="change-subkey-password"
                  onPress={() => {
                    setSubkeyGlobalIndex(subkeyIndex);
                    onAddOrChangeSubkeyPassword(subkeyIndex);
                  }}
                >
                  Change Password
                </DropdownItem>
                <DropdownItem
                  key="remove-subkey-password"
                  onPress={() => {
                    setSubkeyGlobalIndex(subkeyIndex);
                    onRemoveSubkeyPassword(subkeyIndex);
                  }}
                >
                  Remove Password
                </DropdownItem>
              </>
            ) : (
              <>
                <DropdownItem
                  key="add-subkey-password"
                  onPress={() => {
                    setSubkeyGlobalIndex(subkeyIndex);
                    onAddOrChangeSubkeyPassword(subkeyIndex);
                  }}
                >
                  Add Password
                </DropdownItem>
              </>
            ))}

          {subkey.status === "revoked" ? null : (
            <>
              <DropdownItem
                key="revoke-subkey"
                onPress={() => {
                  setSelectedSubkey(subkeyIndex);
                  setSubkeyGlobalIndex(subkeyIndex);
                  setrevokeModal(true);
                }}
              >
                Revoke Subkey
              </DropdownItem>
            </>
          )}

          {subkey.status !== "revoked" ? null : (
            <DropdownItem
              key="revocation-reason-subkey"
              onPress={() => {
                setSubkeyGlobalIndex(subkeyIndex);
                const info = revocationReasonsRef.current[subkeyIndex];
                setRevocationInfo(info || null);
                setrevocationReasonModal(true);
              }}
            >
              Revocation Reason
            </DropdownItem>
          )}
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
