"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu as HeroUIDropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
const DropdownMenu = HeroUIDropdownMenu as any;
import { VerticalDotsIcon } from "@/components/icons";
import * as openpgp from "openpgp";
import { CalendarDate } from "@internationalized/date";

import { DropdownUser } from "./UserActionsDropdown";

export interface DropdownSubkey {
  id: string;
  status: string;
  expirydate: string;
}

interface UserActionsDropdownSubkeyProps {
  subkey: DropdownSubkey;
  selectedUserId?: DropdownUser;
  setSubkeyGlobalIndex: (index: number) => void;
  setSelectedSubkey: (subkey: number | string) => void;
  setvalidityModal: (open: boolean) => void;
  setIsNoExpiryChecked: (checked: boolean) => void;
  setExpiryDate: (date: any) => void;
  setrevokeModal: (open: boolean) => void;
  setrevocationReasonModal: (open: boolean) => void;
  setRevocationInfo: (info: any) => void;
  onBackupSubkey: (subkey: DropdownSubkey, index: number, armored: string) => void;
  onAddOrChangeSubkeyPassword: (index: number) => void;
  onRemoveSubkeyPassword: (index: number) => void;
}

export default function UserActionsDropdownSubkey({
  subkey,
  selectedUserId,
  setSubkeyGlobalIndex,
  setSelectedSubkey,
  setvalidityModal,
  setIsNoExpiryChecked,
  setExpiryDate,
  setrevokeModal,
  setrevocationReasonModal,
  setRevocationInfo,
  onBackupSubkey,
  onAddOrChangeSubkeyPassword,
  onRemoveSubkeyPassword,
}: UserActionsDropdownSubkeyProps) {
  const [armoredSubkey, setArmoredSubkey] = useState<string[]>([]);
  const [isSubkeyProtected, setIsSubkeyProtected] = useState(false);
  const revocationReasonsRef = useRef<any[]>([]);

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
          .filter((sig: any) => sig.signatureType === openpgp.enums.signature.certPositive);

        if (userIDPackets.length === 0 || userIDSigs.length === 0) {
          console.warn("No User IDs or certifications found in the original key.");
          return;
        }

        const reasonsMap: Record<number, string> = {
          0: "Key is Compromised",
          1: "Key is Superseded",
          2: "Key is No Longer Used",
        };

        const allSubkeys: string[] = [];
        const allReasons: any[] = [];

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
                reason: (sig.reasonForRevocationFlag != null ? reasonsMap[sig.reasonForRevocationFlag] : undefined) || "Unknown reason",
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
      const monthMap: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      const date = new Date(parseInt(year), monthMap[month], parseInt(day));
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
          <DropdownItem key="backup-subkey"
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

          {subkey.status !== "revoked" ? (
            isSubkeyProtected ? (
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
            )
          ) : null}

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
