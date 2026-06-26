"use client";

import { useState, useEffect } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { VerticalDotsIcon } from "@/components/icons";
import { isPasswordProtected } from "@/lib/pgp";
import { CalendarDate } from "@internationalized/date";

export default function UserActionsDropdown({
  user,
  // modal open setters
  setSelectedUserId,
  setSelectedKeyName,
  setSelectedKeyId,
  setrevocationReasonModal,
  setRevocationInfo,
  setmanageUserIDsModal,
  setpublishKeyModal,
  setSelectedUserPublicKey,
  setPublicKeySnippet,
  setpublicKeyModal,
  setvalidityModal,
  setIsNoExpiryChecked,
  setExpiryDate,
  setremovePasswordModal,
  setaddUserIDModal,
  setmanageSubkeyModal,
  setaddSubkeyModal,
  setcertifyUserModal,
  setviewCertificateModal,
  setrevokeModal,
  setrevokeUsingCertificateModal,
  setdeleteModal,
  // action handlers
  backupKeyring,
  addOrChangeKeyPassword,
  GenerateRevocationCertificate,
  getRevocationReason,
}) {
  const [isProtected, setIsProtected] = useState(null);

  useEffect(() => {
    let mounted = true;
    const checkProtected = async () => {
      if (user.privateKey?.trim()) {
        const result = await isPasswordProtected(user.privateKey);
        if (mounted) setIsProtected(result);
      } else {
        setIsProtected(false);
      }
    };
    checkProtected();
    return () => { mounted = false; };
  }, [user.privateKey]);

  const openValidityModal = () => {
    setSelectedUserId(user);
    if (user.expirydate === "No Expiry") {
      setIsNoExpiryChecked(true);
      setExpiryDate(null);
    } else {
      setIsNoExpiryChecked(false);
      const [day, month, year] = user.expirydate.split("-");
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
    <div className="relative flex justify-center items-center gap-2">
      <Dropdown>
        <DropdownTrigger>
          <Button isIconOnly size="sm" variant="light">
            <VerticalDotsIcon className="text-default-300" />
          </Button>
        </DropdownTrigger>
        <DropdownMenu
          aria-label="User actions"
          shouldBlockScroll={true}
          closeOnSelect={true}
          classNames={{
            base: "max-w-[280px] sm:max-w-[320px]",
            list: "max-h-[80vh] overflow-y-auto",
          }}
        >
          {user.status !== "revoked" ? null : (
            <DropdownItem
              key="revocation-reason"
              onPress={async () => {
                setSelectedUserId(user);
                setSelectedKeyName(user.name);
                const info = await getRevocationReason(user);
                if (info) {
                  const reasonsMap = {
                    0: "Key is Compromised",
                    1: "Key is Superseded",
                    2: "Key is No Longer Used",
                  };
                  info.reason = reasonsMap[info.code] || "Unknown reason";
                }
                setRevocationInfo(info);
                setrevocationReasonModal(true);
              }}
            >
              Revocation Reason
            </DropdownItem>
          )}

          {user.userIdCount > 1 &&
            user.status !== "revoked" &&
            user.status !== "expired" &&
            !user.privateKey?.trim() && (
              <DropdownItem
                key="view-userids"
                onPress={() => {
                  setSelectedUserId(user);
                  setmanageUserIDsModal(true);
                }}
              >
                View User IDs
              </DropdownItem>
            )}

          <DropdownItem
            key="publish-key"
            onPress={() => {
              setSelectedUserId(user);
              setSelectedKeyName(user.name);
              setpublishKeyModal(true);
            }}
          >
            Publish On Server
          </DropdownItem>

          <DropdownItem
            key="export-public-key"
            onPress={() => {
              setSelectedUserPublicKey(user);
              setPublicKeySnippet(user.publicKey);
              setpublicKeyModal(true);
            }}
          >
            Export Public Key
          </DropdownItem>

          {user.privateKey?.trim() && (
            <>
              <DropdownItem
                key="backup-keyring"
                onPress={() => backupKeyring(user)}
              >
                Backup Keyring
              </DropdownItem>

              {user.status === "revoked" ? null : (
                <DropdownItem key="change-validity" onPress={openValidityModal}>
                  Change Validity
                </DropdownItem>
              )}

              {user.status !== "revoked" &&
                (isProtected ? (
                  <>
                    <DropdownItem
                      key="change-password"
                      onPress={() => addOrChangeKeyPassword(user)}
                    >
                      Change Password
                    </DropdownItem>
                    <DropdownItem
                      key="remove-password"
                      onPress={() => {
                        setSelectedUserId(user);
                        setSelectedKeyName(user.name);
                        setremovePasswordModal(true);
                      }}
                    >
                      Remove Password
                    </DropdownItem>
                  </>
                ) : (
                  <>
                    <DropdownItem
                      key="add-password"
                      onPress={() => addOrChangeKeyPassword(user)}
                    >
                      Add Password
                    </DropdownItem>
                  </>
                ))}

              {user.status !== "revoked" && (
                <DropdownItem
                  key="add-userid"
                  onPress={() => {
                    setSelectedUserId(user);
                    setaddUserIDModal(true);
                  }}
                >
                  Add User ID
                </DropdownItem>
              )}

              {user.userIdCount > 1 && user.status !== "revoked" && (
                <DropdownItem
                  key="manage-userids"
                  onPress={() => {
                    setSelectedUserId(user);
                    setmanageUserIDsModal(true);
                  }}
                >
                  Manage User IDs
                </DropdownItem>
              )}

              {user.status !== "revoked" && user.status !== "expired" && (
                <DropdownItem
                  key="add-subkey"
                  onPress={() => {
                    setSelectedUserId(user);
                    setaddSubkeyModal(true);
                  }}
                >
                  Add Subkey
                </DropdownItem>
              )}

              {user.subkeysCount > 1 &&
                user.status !== "revoked" &&
                user.status !== "expired" && (
                  <DropdownItem
                    key="manage-subkey"
                    onPress={() => {
                      setSelectedUserId(user);
                      setSelectedKeyName(user.name);
                      setSelectedKeyId(user.keyid);
                      setmanageSubkeyModal(true);
                    }}
                  >
                    Manage Subkey
                  </DropdownItem>
                )}
            </>
          )}

          {user.status === "revoked" ? null : (
            <>
              <DropdownItem
                key="certify-key"
                onPress={() => {
                  setSelectedUserId(user);
                  setcertifyUserModal(true);
                }}
              >
                Certify
              </DropdownItem>

              <DropdownItem
                key="certifications-key"
                onPress={() => {
                  setSelectedUserId(user);
                  setviewCertificateModal(true);
                }}
              >
                View Certifications
              </DropdownItem>
            </>
          )}

          {user.privateKey?.trim() && (
            <>
              {user.status === "revoked" ? null : (
                <>
                  <DropdownItem
                    key="revocation-certificate"
                    onPress={() => GenerateRevocationCertificate(user)}
                  >
                    Get Revocation Certificate
                  </DropdownItem>

                  <DropdownItem
                    key="revoke-key"
                    onPress={() => {
                      setSelectedUserId(user);
                      setSelectedKeyName(user.name);
                      setrevokeModal(true);
                    }}
                  >
                    Revoke Key
                  </DropdownItem>
                </>
              )}
            </>
          )}

          {user.status === "revoked" ? null : (
            <DropdownItem
              key="revoke-using-certificate"
              onPress={() => {
                setSelectedUserId(user);
                setSelectedKeyName(user.name);
                setrevokeUsingCertificateModal(true);
              }}
            >
              Revoke Using Certificate
            </DropdownItem>
          )}

          <DropdownItem
            key="delete-key"
            onPress={() => {
              setSelectedUserId(user.id);
              setSelectedKeyName(user.name);
              setdeleteModal(true);
            }}
          >
            Delete
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </div>
  );
}
