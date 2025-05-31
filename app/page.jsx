"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  addToast,
  Tooltip,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Chip,
  User,
  Pagination,
  Modal,
  ModalContent,
  DatePicker,
  Checkbox,
  Spinner,
  Textarea,
  Radio,
  RadioGroup,
} from "@heroui/react";
import {
  EyeFilledIcon,
  EyeSlashFilledIcon,
  VerticalDotsIcon,
  SearchIcon,
  ChevronDownIcon,
} from "@/components/icons";
import {
  openDB,
  getEncryptionKey,
  decryptData,
  encryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";
import { NProgressLink } from "@/components/nprogress";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import * as openpgp from "openpgp";

const statusColorMap = {
  active: "success",
  expired: "danger",
  revoked: "danger",
};

const passwordprotectedColorMap = {
  Yes: "success",
  No: "danger",
};

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "email",
  "creationdate",
  "expirydate",
  "status",
  "passwordprotected",
  "actions",
];

const columns = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  {
    name: "EMAIL",
    uid: "email",
    width: "30%",
    align: "center",
    sortable: true,
  },
  {
    name: "CREATION DATE",
    uid: "creationdate",
    width: "20%",
    sortable: true,
  },
  {
    name: "EXPIRY DATE",
    uid: "expirydate",
    width: "15%",
    sortable: true,
  },
  {
    name: "STATUS",
    uid: "status",
    width: "20%",
    align: "center",
    sortable: true,
  },
  {
    name: "PASSWORD",
    uid: "passwordprotected",
    width: "20%",
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "ACTIONS", uid: "actions", align: "center" },
];

const columnsModal = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  {
    name: "EMAIL",
    uid: "email",
    width: "50%",
    align: "center",
    sortable: true,
  },
  {
    name: "STATUS",
    uid: "status",
    align: "center",
    sortable: true,
  },
  { name: "PRIMARY", uid: "primary", align: "center" },
  { name: "DELETE", uid: "delete", align: "center" },
];

const capitalize = (s) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [page, setPage] = useState(1);
  const [filterValueModal, setFilterValueModal] = useState("");
  const [rowsPerPageModal, setRowsPerPageModal] = useState(5);
  const [sortDescriptorModal, setSortDescriptorModal] = useState({});
  const [pageModal, setPageModal] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedKeyName, setSelectedKeyName] = useState("");
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [validityModal, setvalidityModal] = useState(false);
  const [selectedValidityKey, setSelectedValidityKey] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [newKeyPassword, setnewKeyPassword] = useState(null);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPasswordChangeModal, setnewPasswordChangeModal] = useState(false);
  const [removePasswordModal, setremovePasswordModal] = useState(false);
  const [addUserIDModal, setaddUserIDModal] = useState(false);
  const [manageUserIDsModal, setmanageUserIDsModal] = useState(false);
  const [modalUserIDs, setModalUserIDs] = useState([]);
  const [userIDToDelete, setUserIDToDelete] = useState(null);
  const [deleteUserIDModal, setdeleteUserIDModal] = useState(false);
  const [revokeModal, setrevokeModal] = useState(false);
  const [revocationReason, setRevocationReason] = useState("0");
  const [revocationReasonText, setRevocationReasonText] = useState("");
  const [revocationReasonModal, setrevocationReasonModal] = useState(false);
  const [revocationInfo, setRevocationInfo] = useState(null);
  const [deleteModal, setdeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );

  useEffect(() => {
    openDB();
  }, []);

  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  const isPasswordProtected = async (privateKeyArmored) => {
    try {
      const privateKey = await openpgp.readPrivateKey({
        armoredKey: privateKeyArmored,
      });
      return privateKey.isPrivate() && !privateKey.isDecrypted();
    } catch {
      return false;
    }
  };

  const UserActionsDropdown = ({ user }) => {
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
      return () => {
        mounted = false;
      };
    }, [user.privateKey]);

    return (
      <div className="relative flex justify-end items-center gap-2 me-4">
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly size="sm" variant="light">
              <VerticalDotsIcon className="text-default-300" />
            </Button>
          </DropdownTrigger>
          <DropdownMenu>
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
              key="export-public-key"
              onPress={() => exportPublicKey(user)}
            >
              Export Public Key
            </DropdownItem>

            {user.privateKey?.trim() && isProtected !== null && (
              <>
                <DropdownItem
                  key="backup-keyring"
                  onPress={() => backupKeyring(user)}
                >
                  Backup Keyring
                </DropdownItem>

                <>
                  {user.status === "revoked" ? null : (
                    <DropdownItem
                      key="change-validity"
                      onPress={() => {
                        setSelectedValidityKey(user);
                        if (user.expirydate === "No Expiry") {
                          setIsNoExpiryChecked(true);
                          setExpiryDate(null);
                        } else {
                          setIsNoExpiryChecked(false);
                          const [day, month, year] = user.expirydate.split("-");
                          const monthMap = {
                            Jan: 0,
                            Feb: 1,
                            Mar: 2,
                            Apr: 3,
                            May: 4,
                            Jun: 5,
                            Jul: 6,
                            Aug: 7,
                            Sep: 8,
                            Oct: 9,
                            Nov: 10,
                            Dec: 11,
                          };
                          const date = new Date(
                            year,
                            monthMap[month],
                            parseInt(day)
                          );
                          setExpiryDate(
                            new CalendarDate(
                              date.getFullYear(),
                              date.getMonth() + 1,
                              date.getDate()
                            )
                          );
                        }
                        setvalidityModal(true);
                      }}
                    >
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
                          onPress={() =>
                            triggerRemovePasswordModal(user, user.name)
                          }
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

                  {user.status !== "revoked" && user.status !== "expired" && (
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

                  {user.userIdCount > 1 &&
                    user.status !== "revoked" &&
                    user.status !== "expired" && (
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

                  {user.status === "revoked" ? null : (
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
                  )}
                </>
              </>
            )}

            <DropdownItem
              key="delete-key"
              onPress={() => triggerdeleteModal(user.id, user.name)}
            >
              Delete
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    );
  };

  const loadKeysFromIndexedDB = async () => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readonly");
      const store = transaction.objectStore(dbPgpKeys);
      const encryptedRecords = [];
      const request = store.openCursor();

      request.onsuccess = async (e) => {
        const cursor = e.target.result;
        if (cursor) {
          encryptedRecords.push(cursor.value);
          cursor.continue();
        } else {
          try {
            const decryptedKeys = await Promise.all(
              encryptedRecords.map(async (record) => {
                return await decryptData(
                  record.encrypted,
                  encryptionKey,
                  record.iv
                );
              })
            );

            const formatDate = (isoDate) => {
              const date = new Date(isoDate);
              const monthNames = [
                "Jan",
                "Feb",
                "Mar",
                "Apr",
                "May",
                "Jun",
                "Jul",
                "Aug",
                "Sep",
                "Oct",
                "Nov",
                "Dec",
              ];

              const day = String(date.getDate()).padStart(2, "0");
              const month = monthNames[date.getMonth()];
              const year = date.getFullYear();

              return `${day}-${month}-${year}`;
            };

            const getKeyExpiryInfo = async (key) => {
              try {
                const isRevoked = await key.isRevoked();
                if (isRevoked) {
                  return { expirydate: "Revoked", status: "revoked" };
                }

                const expirationTime = await key.getExpirationTime();
                const now = new Date();
                if (expirationTime === null || expirationTime === Infinity) {
                  return { expirydate: "No Expiry", status: "active" };
                } else if (expirationTime < now) {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: "expired",
                  };
                } else {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: "active",
                  };
                }
              } catch {
                return { expirydate: "Error", status: "unknown" };
              }
            };

            const processedKeys = await Promise.all(
              decryptedKeys.map(async (key) => {
                const openpgpKey = await openpgp.readKey({
                  armoredKey: key.publicKey,
                });

                const userIDs = openpgpKey.getUserIDs();
                const userIdCount = userIDs.length;

                const firstUserID = userIDs[0];
                let name, email;

                const match = firstUserID.match(/^(.*?)\s*<(.+?)>$/);
                if (match) {
                  name = match[1].trim();
                  email = match[2].trim();
                } else {
                  name = firstUserID.trim();
                  email = "N/A";
                }

                const creationdate = formatDate(openpgpKey.getCreationTime());

                const { expirydate, status } =
                  await getKeyExpiryInfo(openpgpKey);

                const passwordProtected = key.privateKey
                  ? await isPasswordProtected(key.privateKey)
                  : false;

                const formatFingerprint = (fingerprint) => {
                  const parts = fingerprint.match(/.{1,4}/g);
                  const nbsp = "\u00A0";
                  return (
                    parts.slice(0, 5).join(" ") +
                    nbsp.repeat(6) +
                    parts.slice(5).join(" ")
                  );
                };
                const fingerprint = formatFingerprint(
                  openpgpKey.getFingerprint().toUpperCase()
                );

                const formatKeyID = (keyid) => keyid.match(/.{1,4}/g).join(" ");
                const keyid = formatKeyID(
                  openpgpKey.getKeyID().toHex().toUpperCase()
                );

                const formatAlgorithm = (algoInfo) => {
                  // ECC curve detection
                  const labelMap = {
                    curve25519: "Curve25519 (EdDSA/ECDH)",
                    nistP256: "NIST P-256 (ECDSA/ECDH)",
                    nistP521: "NIST P-521 (ECDSA/ECDH)",
                    brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
                    brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
                  };

                  if (
                    ["eddsa", "eddsaLegacy", "curve25519"].includes(
                      algoInfo.algorithm
                    )
                  ) {
                    return labelMap.curve25519;
                  }

                  if (algoInfo.curve && labelMap[algoInfo.curve]) {
                    return labelMap[algoInfo.curve];
                  }

                  // RSA detection
                  if (/^rsa/i.test(algoInfo.algorithm)) {
                    switch (algoInfo.bits) {
                      case 2048:
                        return "RSA 2048";
                      case 3072:
                        return "RSA 3072";
                      case 4096:
                        return "RSA 4096";
                      default:
                        return `RSA (${algoInfo.bits || "?"} bits)`;
                    }
                  }

                  return algoInfo.algorithm || "Unknown Algorithm";
                };

                const algorithm = formatAlgorithm(
                  openpgpKey.getAlgorithmInfo()
                );

                return {
                  id: key.id,
                  name,
                  email,
                  creationdate,
                  expirydate,
                  status,
                  passwordprotected: passwordProtected ? "Yes" : "No",
                  keyid,
                  fingerprint,
                  algorithm,
                  avatar: (() => {
                    const hasPrivateKey =
                      key.privateKey && key.privateKey.trim() !== "";
                    const hasPublicKey =
                      key.publicKey && key.publicKey.trim() !== "";
                    if (hasPrivateKey && hasPublicKey) {
                      return Keyring.src;
                    } else if (hasPublicKey) {
                      return Public.src;
                    }
                  })(),
                  publicKey: key.publicKey,
                  privateKey: key.privateKey,
                  userIdCount,
                };
              })
            );

            resolve(processedKeys);
          } catch (error) {
            reject(error);
          }
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  };

  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true);
      try {
        const pgpKeys = await loadKeysFromIndexedDB();
        setUsers(pgpKeys);
      } catch (error) {
        console.error("Error loading keys:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchKeys();

    const handleStorageChange = async () => {
      setIsLoading(true);
      try {
        const updatedKeys = await loadKeysFromIndexedDB();
        setUsers(updatedKeys);
      } catch (error) {
        console.error("Error loading keys:", error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];

    if (filterValue) {
      filteredUsers = filteredUsers.filter((user) =>
        user.name.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [users, filterValue]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const sortedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return [...filteredItems]
      .sort((a, b) => {
        const first = a[sortDescriptor.column];
        const second = b[sortDescriptor.column];
        const cmp = first < second ? -1 : first > second ? 1 : 0;

        return sortDescriptor.direction === "descending" ? -cmp : cmp;
      })
      .slice(start, end);
  }, [sortDescriptor, filteredItems, page, rowsPerPage]);

  const hasSearchFilter = Boolean(filterValue);

  const headerColumns = useMemo(() => {
    if (visibleColumns === "all") return columns;

    return columns.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns]);

  const renderCell = useCallback((user, columnKey) => {
    const cellValue = user[columnKey];

    switch (columnKey) {
      case "name":
        return (
          <User
            avatarProps={{ radius: "lg", src: user.avatar }}
            name={cellValue}
          ></User>
        );
      case "status":
        return (
          <Chip
            className="-ms-5 capitalize"
            color={statusColorMap[user.status]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "passwordprotected":
        return (
          <Chip
            className="-ms-6 capitalize"
            color={passwordprotectedColorMap[user.passwordprotected]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "actions":
        return <UserActionsDropdown user={user} />;
      default:
        return cellValue;
    }
  }, []);

  const exportPublicKey = (user) => {
    const keyid = user.keyid.replace(/\s/g, "");
    const publicKey = user.publicKey;
    const blob = new Blob([publicKey], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${user.name}_0x${keyid}_PUBLIC.asc`;
    link.click();
  };

  const backupKeyring = async (user, password = null) => {
    try {
      const keyid = user.keyid.replace(/\s/g, "");
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });

      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        if (!password) {
          const enteredPassword = await triggerKeyPasswordModal(user);
          password = enteredPassword;
        }

        try {
          privateKey = await openpgp.decryptKey({
            privateKey: privateKey,
            passphrase: password,
          });
        } catch {
          addToast({
            title: "Incorrect Password",
            color: "danger",
          });
          return;
        }
      }

      const privateKeyBackup = user.privateKey;
      const blob = new Blob([privateKeyBackup], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${user.name}_0x${keyid}_SECRET.asc`;
      link.click();
    } catch {
      addToast({
        title:
          "Failed to read or decrypt. The key is not valid or there was an error processing it",
        color: "danger",
      });
    }
  };

  const updateKeyValidity = async (keyId, updatedKeys) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pgpKeys", "readonly");
      const store = transaction.objectStore("pgpKeys");
      const getRequest = store.get(keyId);

      getRequest.onsuccess = async () => {
        const record = getRequest.result;
        if (!record) {
          return reject(new Error("Key record not found"));
        }

        try {
          const originalDecrypted = await decryptData(
            record.encrypted,
            encryptionKey,
            record.iv
          );
          const updatedDecrypted = {
            ...originalDecrypted,
            privateKey: updatedKeys.privateKey,
            publicKey: updatedKeys.publicKey,
          };

          const { encrypted, iv } = await encryptData(
            updatedDecrypted,
            encryptionKey
          );
          record.encrypted = encrypted;
          record.iv = iv;
        } catch (error) {
          return reject(error);
        }

        const writeTx = db.transaction("pgpKeys", "readwrite");
        const writeStore = writeTx.objectStore("pgpKeys");
        const putRequest = writeStore.put(record);

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = (e) => reject(e.target.error);
      };

      getRequest.onerror = (e) => reject(e.target.error);
    });
  };

  const handleUpdateValidity = async () => {
    if (!selectedValidityKey) return;
    try {
      const now = new Date();
      let keyExpirationTime;
      if (isNoExpiryChecked || !expiryDate) {
        keyExpirationTime = undefined;
      } else {
        const selected = new Date(expiryDate);
        const expiry = new Date(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate() + 1,
          0,
          0,
          0,
          0
        );
        keyExpirationTime = Math.floor((expiry - now) / 1000);
      }

      let privateKey = await openpgp.readKey({
        armoredKey: selectedValidityKey.privateKey,
      });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword =
          await triggerKeyPasswordModal(selectedValidityKey);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: selectedValidityKey.publicKey,
      });
      const existingUserIDs = fullPublicKey
        .getUserIDs()
        .map(parseUserId)
        .map((u) =>
          u.email && u.email !== "N/A"
            ? { name: u.name, email: u.email.trim() }
            : { name: u.name }
        );

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        keyExpirationTime,
        date: new Date(),
        format: "armored",
        userIDs: existingUserIDs,
      });

      await updateKeyValidity(selectedValidityKey.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedKeyPair.publicKey,
      });

      addToast({
        title: "Validity Updated Successfully",
        color: "success",
      });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);

      setvalidityModal(false);
      setSelectedValidityKey(null);
    } catch (error) {
      addToast({
        title: "Failed to update validity",
        color: "danger",
      });
      console.error(error);
    }
  };

  const triggerKeyPasswordModal = async (user) => {
    setPassword("");
    setPasswordModal(true);
    return new Promise((resolve) => {
      const tryPassword = async () => {
        const enteredPassword = await new Promise((res) => {
          setnewKeyPassword(() => res);
        });
        try {
          const privateKey = await openpgp.readKey({
            armoredKey: user.privateKey,
          });
          await openpgp.decryptKey({
            privateKey,
            passphrase: enteredPassword,
          });
          setPasswordModal(false);
          resolve(enteredPassword);
        } catch {
          addToast({
            title: "Incorrect Password",
            color: "danger",
          });
          tryPassword();
        }
      };

      tryPassword();
    });
  };

  const triggernewPasswordChangeModal = () =>
    new Promise((resolve) => {
      setPassword("");
      setnewPasswordChangeModal(true);
      setnewKeyPassword(() => (pwd) => {
        setnewPasswordChangeModal(false);
        setnewKeyPassword(null);
        resolve(pwd);
      });
    });

  const updateKeyPassword = async (user, newArmoredKey) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction("pgpKeys", "readonly");
      const store = transaction.objectStore("pgpKeys");
      const getRequest = store.get(user);

      getRequest.onsuccess = async () => {
        const record = getRequest.result;
        if (!record) {
          return reject(new Error("Key record not found"));
        }

        try {
          const originalDecrypted = await decryptData(
            record.encrypted,
            encryptionKey,
            record.iv
          );

          const updatedDecrypted = {
            ...originalDecrypted,
            privateKey: newArmoredKey,
          };

          const { encrypted, iv } = await encryptData(
            updatedDecrypted,
            encryptionKey
          );
          record.encrypted = encrypted;
          record.iv = iv;
        } catch (error) {
          return reject(error);
        }

        const writeTx = db.transaction("pgpKeys", "readwrite");
        const writeStore = writeTx.objectStore("pgpKeys");
        const putRequest = writeStore.put(record);

        putRequest.onsuccess = () => {
          resolve();
        };
        putRequest.onerror = (e) => {
          reject(e.target.error);
        };
      };

      getRequest.onerror = (e) => {
        reject(e.target.error);
      };
    });
  };

  const addOrChangeKeyPassword = async (user) => {
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const newPassword = await triggernewPasswordChangeModal();

      const updatedKey = await openpgp.encryptKey({
        privateKey,
        passphrase: newPassword,
      });
      const armored = updatedKey.armor();

      await updateKeyPassword(user.id, armored);

      const updatedKeys = await loadKeysFromIndexedDB();

      setUsers(updatedKeys);
      const toastMessage =
        user.passwordprotected === "No"
          ? "Password Added Successfully"
          : "Password Changed Successfully";

      addToast({
        title: toastMessage,
        color: "success",
      });
    } catch {
      addToast({
        title: "Failed to change password",
        color: "danger",
      });
    }
  };

  const triggerRemovePasswordModal = async (user, name) => {
    setSelectedUserId(user);
    setSelectedKeyName(name);
    setremovePasswordModal(true);
  };

  const removePasswordFromKey = async () => {
    try {
      let privateKey = await openpgp.readKey({
        armoredKey: selectedUserId.privateKey,
      });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }
      const armored = privateKey.armor();

      await updateKeyPassword(selectedUserId.id, armored);

      addToast({
        title: "Password removed successfully",
        color: "success",
      });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
    } catch {
      addToast({
        title: "Failed to remove password",
        color: "danger",
      });
    }
    closeremovePasswordModal();
  };

  const closeremovePasswordModal = () => {
    setSelectedUserId(null);
    setSelectedKeyName("");
    setremovePasswordModal(false);
  };

  const triggerdeleteModal = (user, name) => {
    setSelectedUserId(user);
    setSelectedKeyName(name);
    setdeleteModal(true);
  };

  const deleteKey = async (user) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readwrite");
      const store = transaction.objectStore(dbPgpKeys);

      const request = store.delete(user);

      request.onsuccess = async () => {
        const refreshedKeys = await loadKeysFromIndexedDB();
        setUsers(refreshedKeys);
        setPage(1);
        resolve();
      };

      request.onerror = (e) => {
        reject(e.target.error);
      };
    });
  };

  const addUserID = async (user) => {
    setNameInvalid(false);
    setEmailInvalid(false);
    if (!name.trim()) {
      setNameInvalid(true);
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailInvalid(true);
      return;
    }
    const validEmail = email.trim();
    setaddUserIDModal(false);
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }
      const fullPublicKey = await openpgp.readKey({
        armoredKey: user.publicKey,
      });
      const currentUserIDs = fullPublicKey.getUserIDs();

      // Parse a user ID string into an object.
      const parseUserId = (uid) => {
        const match = uid.match(/^(.*?)\s*<(.+?)>$/);
        return match
          ? { name: match[1].trim(), email: match[2].trim() }
          : { name: uid.trim() };
      };

      // Convert existing IDs to object format.
      const formattedUserIDs = currentUserIDs.map(parseUserId);

      // Build the new user id object.
      const newUserID = validEmail
        ? { name: name.trim(), email: validEmail }
        : { name: name.trim() };

      const updatedUserIDs = [...formattedUserIDs, newUserID];

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        userIDs: updatedUserIDs,
        date: new Date(),
        format: "armored",
      });

      await updateKeyValidity(user.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedKeyPair.publicKey,
      });
      addToast({
        title: "User ID added successfully",
        color: "success",
      });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
      setName("");
      setEmail("");
    } catch (error) {
      addToast({
        title: "Failed to add User ID",
        color: "danger",
      });
      console.error(error);
    }
  };

  const setPrimaryUserID = async (user, targetUserIDObj) => {
    try {
      const refreshedStart = await loadKeysFromIndexedDB();
      const currentUserObj = refreshedStart.find((u) => u.id === user.id);
      if (!currentUserObj) throw new Error("User not found in IndexedDB");

      // Check if the clicked User ID is already primary
      const freshPublicKey = await openpgp.readKey({
        armoredKey: currentUserObj.publicKey,
      });
      const freshUserIDs = freshPublicKey.getUserIDs().map(parseUserId);
      if (freshUserIDs[0]?.id === targetUserIDObj.id) {
        addToast({
          title: "Primary User ID already selected",
          color: "primary",
        });
        setUsers(refreshedStart);
        const updatedModalUserIDs =
          await getUserIDsFromKeyForModal(currentUserObj);
        setModalUserIDs(updatedModalUserIDs);
        return;
      }

      let privateKey = await openpgp.readKey({
        armoredKey: currentUserObj.privateKey,
      });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: currentUserObj.publicKey,
      });
      const currentUserIDs = fullPublicKey.getUserIDs().map(parseUserId);
      const targetUser = currentUserIDs.find(
        (u) => u.id === targetUserIDObj.id
      );
      if (!targetUser) throw new Error("Target user ID not found on key");

      const reorderedUserIDs = [
        targetUser,
        ...currentUserIDs.filter((u) => u.id !== targetUserIDObj.id),
      ].map((u) =>
        u.email && u.email !== "N/A"
          ? { name: u.name, email: u.email }
          : { name: u.name }
      );

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        userIDs: reorderedUserIDs,
        date: new Date(),
        format: "armored",
      });

      await updateKeyValidity(user.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedKeyPair.publicKey,
      });

      addToast({
        title: "Primary User ID updated successfully",
        color: "success",
      });

      const refreshed = await loadKeysFromIndexedDB();
      setUsers(refreshed);

      const updatedUser = refreshed.find((u) => u.id === user.id);
      if (updatedUser) {
        const updatedModalUserIDs =
          await getUserIDsFromKeyForModal(updatedUser);
        setModalUserIDs(updatedModalUserIDs);
      }
    } catch (error) {
      console.error("setPrimaryUserID error:", error);
      addToast({
        title: "Failed to update Primary User ID",
        color: "danger",
      });
    }
  };

  const deleteUserID = async (user, targetUserIDObj, showToast = true) => {
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: user.publicKey,
      });
      const currentUserIDs = fullPublicKey.getUserIDs().map(parseUserId);

      const updatedUserIDs = currentUserIDs.filter(
        (u) => u.id !== targetUserIDObj.id
      );

      const userIDsForKey = updatedUserIDs.map((u) =>
        u.email && u.email !== "N/A"
          ? { name: u.name, email: u.email }
          : { name: u.name }
      );

      const { privateKey: newArmoredPrivate, publicKey: newArmoredPublic } =
        await openpgp.reformatKey({
          privateKey,
          userIDs: userIDsForKey,
          date: new Date(),
          format: "armored",
        });

      await updateKeyValidity(user.id, {
        privateKey: newArmoredPrivate,
        publicKey: newArmoredPublic,
      });

      if (showToast) {
        addToast({
          title: "User ID deleted successfully",
          color: "success",
        });
      }

      const refreshed = await loadKeysFromIndexedDB();
      setUsers(refreshed);

      const updatedUser = refreshed.find((u) => u.id === user.id);
      if (updatedUser) {
        const updatedModalUserIDs =
          await getUserIDsFromKeyForModal(updatedUser);
        setModalUserIDs(updatedModalUserIDs);
      }
    } catch (error) {
      console.error("deleteUserID error:", error);
      addToast({
        title: "Failed to delete User ID",
        color: "danger",
      });
    }
  };

  const triggerDeleteUserIDModal = (user, targetUserIDObj) => {
    setSelectedUserId(user);
    setSelectedKeyName(user.name);
    setUserIDToDelete(targetUserIDObj);
    setdeleteUserIDModal(true);
  };

  const revokeKey = async (user) => {
    setRevocationReasonText("");
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const revokedKey = await openpgp.revokeKey({
        key: privateKey,
        format: "armored",
        reasonForRevocation: {
          flag: parseInt(revocationReason),
          string: revocationReasonText || undefined,
        },
        date: new Date(),
      });

      await updateKeyValidity(user.id, {
        privateKey: revokedKey.privateKey,
        publicKey: revokedKey.publicKey,
      });

      const keyid = user.keyid.replace(/\s/g, "");
      const blob = new Blob([revokedKey.publicKey], { type: "text/plain" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${user.name}_0x${keyid}_PUBLIC_REVOKED.asc`;
      link.click();

      addToast({
        title: "Key Revoked Successfully",
        color: "success",
      });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
    } catch (error) {
      console.error(error);
      addToast({
        title: "Failed to revoke key",
        color: "danger",
      });
    }
  };

  const getRevocationReason = async (user) => {
    const key = await openpgp.readKey({
      armoredKey: user.publicKey || user.privateKey,
    });

    if (!key.revocationSignatures || key.revocationSignatures.length === 0)
      return null;

    for (const sig of key.revocationSignatures) {
      if (typeof sig.reasonForRevocationFlag !== "undefined") {
        return {
          code: sig.reasonForRevocationFlag,
          text: sig.reasonForRevocationString || null,
        };
      }
    }

    return null;
  };

  const closedeleteModal = () => {
    setSelectedUserId(null);
    setSelectedKeyName("");
    setdeleteModal(false);
  };

  const onNextPage = useCallback(() => {
    if (page < pages) {
      setPage(page + 1);
    }
  }, [page, pages]);

  const onPreviousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const onRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  }, []);

  const onSearchChange = useCallback((value) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-center text-4xl dm-serif-text-regular">
          Manage Keyrings
        </h1>
        <br />
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[100%]"
            placeholder="Search by name..."
            startContent={<SearchIcon />}
            value={filterValue}
            onClear={() => onClear()}
            onValueChange={onSearchChange}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={<ChevronDownIcon className="text-small" />}
                variant="flat"
              >
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={visibleColumns}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumns}
            >
              {columns
                .filter((column) => column.uid !== "actions")
                .map((column) => (
                  <DropdownItem key={column.uid} className="capitalize">
                    {capitalize(column.name)}
                  </DropdownItem>
                ))}
            </DropdownMenu>
          </Dropdown>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total {users.length} keys
          </span>
          <label className="flex items-center text-default-400 text-small">
            Rows per page:
            <select
              className="bg-transparent outline-none text-default-400 text-small"
              onChange={onRowsPerPageChange}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [
    filterValue,
    onRowsPerPageChange,
    users.length,
    visibleColumns,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={page}
          total={pages}
          onChange={setPage}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button
            isDisabled={pages === 1}
            size="sm"
            variant="flat"
            onPress={onPreviousPage}
          >
            Previous
          </Button>
          <Button
            isDisabled={pages === 1}
            size="sm"
            variant="flat"
            onPress={onNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [page, pages, hasSearchFilter]);

  // Manage User IDs Modal Table

  const hasSearchFilterModal = Boolean(filterValueModal);

  const headerColumnsModal = columnsModal;

  const parseUserId = (uid) => {
    const match = uid.match(/^(.*?)\s*<(.+?)>$/);
    return match
      ? {
          id: uid,
          name: match[1].trim(),
          email: match[2].trim() || "N/A",
          status: "active",
        }
      : { id: uid, name: uid.trim(), email: "N/A", status: "active" };
  };

  const getUserIDsFromKeyForModal = async (user) => {
    if (!user || !user.publicKey) return [];
    try {
      const key = await openpgp.readKey({ armoredKey: user.publicKey });
      const uids = key.getUserIDs();
      const users = key.users;
      const parsedUsers = [];

      for (let i = 0; i < users.length; i++) {
        const uidStr = uids[i];
        const parsedUser = parseUserId(uidStr);
        const isRevoked = await users[i].isRevoked();
        if (isRevoked) {
          parsedUser.status = "revoked";
        }
        parsedUsers.push(parsedUser);
      }

      return parsedUsers;
    } catch (error) {
      console.error("Error fetching user IDs:", error);
      return [];
    }
  };

  useEffect(() => {
    if (manageUserIDsModal && selectedUserId) {
      (async () => {
        const result = await getUserIDsFromKeyForModal(selectedUserId);
        // Delete revoked user IDs automatically as openpgp does not support them yet
        for (const uid of result) {
          if (uid.status === "revoked") {
            await deleteUserID(selectedUserId, uid, false);
          }
        }
        const refreshedUserIDs =
          await getUserIDsFromKeyForModal(selectedUserId);
        setModalUserIDs(refreshedUserIDs);
      })();
    }
  }, [manageUserIDsModal, selectedUserId]);

  const filteredItemsModal = useMemo(() => {
    let filtered = [...modalUserIDs];
    if (Boolean(filterValueModal)) {
      filtered = filtered.filter((user) =>
        user.name.toLowerCase().includes(filterValueModal.toLowerCase())
      );
    }
    return filtered;
  }, [modalUserIDs, filterValueModal]);

  const pagesModal =
    Math.ceil(filteredItemsModal.length / rowsPerPageModal) || 1;

  const itemsModal = useMemo(() => {
    const start = (pageModal - 1) * rowsPerPageModal;
    const end = start + rowsPerPageModal;
    return filteredItemsModal.slice(start, end);
  }, [pageModal, filteredItemsModal, rowsPerPageModal]);

  const sortedItemsModal = useMemo(() => {
    return [...itemsModal].sort((a, b) => {
      const first = a[sortDescriptorModal.column];
      const second = b[sortDescriptorModal.column];
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDescriptorModal.direction === "descending" ? -cmp : cmp;
    });
  }, [sortDescriptorModal, itemsModal]);

  const renderCellModal = useCallback(
    (row, columnKey) => {
      const cellValue = row[columnKey];
      switch (columnKey) {
        case "name": {
          const isFirstRow = pageModal === 1 && itemsModal[0]?.id === row.id;
          return (
            <div className="flex flex-row">
              <span className="pe-1">{cellValue}</span>
              {isFirstRow && <Tooltip content="Primary">👑</Tooltip>}
            </div>
          );
        }
        case "status":
          return (
            <Chip
              className="capitalize -ms-4"
              color={statusColorMap[row.status]}
              size="sm"
              variant="flat"
            >
              {cellValue}
            </Chip>
          );
        case "primary":
          return !selectedUserId.privateKey ? (
            <Button
              isDisabled={true}
              className="ms-2"
              color="secondary"
              variant="flat"
            >
              Set as Primary
            </Button>
          ) : (
            <Button
              isDisabled={row.status === "revoked"}
              className="ms-2"
              color="secondary"
              variant="flat"
              onPress={() => setPrimaryUserID(selectedUserId, row)}
            >
              Set as Primary
            </Button>
          );
        case "delete":
          return !selectedUserId.privateKey ? (
            <Button
              isDisabled={true}
              className="ms-2"
              color="danger"
              variant="flat"
            >
              Delete
            </Button>
          ) : (
            <Button
              isDisabled={modalUserIDs.length === 1}
              className="ms-2"
              color="danger"
              variant="flat"
              onPress={() => triggerDeleteUserIDModal(selectedUserId, row)}
            >
              Delete
            </Button>
          );
        default:
          return cellValue;
      }
    },
    [pageModal, itemsModal, selectedUserId, modalUserIDs]
  );

  const onNextPageModal = useCallback(() => {
    if (pageModal < pagesModal) {
      setPageModal(pageModal + 1);
    }
  }, [pageModal, pagesModal]);

  const onPreviousPageModal = useCallback(() => {
    if (pageModal > 1) {
      setPageModal(pageModal - 1);
    }
  }, [pageModal]);

  const onRowsPerPageChangeModal = useCallback((e) => {
    setRowsPerPageModal(Number(e.target.value));
    setPageModal(1);
  }, []);

  const onSearchChangeModal = useCallback((value) => {
    if (value) {
      setFilterValueModal(value);
      setPageModal(1);
    } else {
      setFilterValueModal("");
    }
  }, []);

  const onClearModal = useCallback(() => {
    setFilterValueModal("");
    setPageModal(1);
  }, []);

  const topContentModal = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full"
            placeholder="Search by name..."
            startContent={<SearchIcon />}
            value={filterValueModal}
            onClear={() => onClearModal()}
            onValueChange={onSearchChangeModal}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total {modalUserIDs.length} User IDs
          </span>
          <label className="flex items-center text-default-400 text-small">
            Rows per page:
            <select
              className="bg-transparent outline-none text-default-400 text-small"
              onChange={onRowsPerPageChangeModal}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="15">20</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [
    filterValueModal,
    onRowsPerPageChangeModal,
    modalUserIDs.length,
    onSearchChangeModal,
    hasSearchFilterModal,
  ]);

  const bottomContentModal = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={pageModal}
          total={pagesModal}
          onChange={setPageModal}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button
            isDisabled={pagesModal === 1}
            size="sm"
            variant="flat"
            onPress={onPreviousPageModal}
          >
            Previous
          </Button>
          <Button
            isDisabled={pagesModal === 1}
            size="sm"
            variant="flat"
            onPress={onNextPageModal}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [itemsModal.length, pageModal, pagesModal, hasSearchFilterModal]);

  return (
    <>
      <Table
        isHeaderSticky
        aria-label="Example table with custom cells, pagination and sorting"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        sortDescriptor={sortDescriptor}
        topContent={topContent}
        topContentPlacement="outside"
        onSortChange={setSortDescriptor}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={
                [
                  "email",
                  "passwordprotected",
                  "status",
                  "keyid",
                  "fingerprint",
                  "algorithm",
                  "actions",
                ].includes(column.uid)
                  ? "center"
                  : "start"
              }
              allowsSorting={column.sortable}
              style={{ width: column.width }}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          loadingContent={
            <div className="flex justify-center items-center mt-12">
              <Spinner size="lg" color="warning" label="Loading keyrings..." />
            </div>
          }
          isLoading={isLoading}
          emptyContent={
            <>
              <span>No keyrings found</span>
              <br />
              <br />
              <div className="ms-6 flex justify-center">
                <Button as={NProgressLink} href="/import">
                  Import Key
                </Button>
                <span className="mx-3 mt-1">or</span>
                <Button as={NProgressLink} href="/cloud-manage">
                  Import Keyrings From Cloud
                </Button>
                <span className="mx-3 mt-1">or</span>
                <Button as={NProgressLink} href="/generate">
                  Generate Key
                </Button>
              </div>
            </>
          }
          items={sortedItems}
        >
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => (
                <TableCell>{renderCell(item, columnKey)}</TableCell>
              )}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Modal
        size="sm"
        backdrop="blur"
        isOpen={validityModal}
        onClose={() => {
          setvalidityModal(false);
          setSelectedValidityKey(null);
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
            minValue={today(getLocalTimeZone()).add({ days: 1 })}
            color="default"
            isDisabled={isNoExpiryChecked}
            label="Expiry date"
            value={expiryDate}
            onChange={(date) => setExpiryDate(date)}
          />
          <Button
            className="mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={handleUpdateValidity}
          >
            Confirm
          </Button>
        </ModalContent>
      </Modal>
      <Modal
        backdrop="blur"
        isOpen={passwordModal}
        onClose={() => setPasswordModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-4">Enter Password for Protected Key</h3>
          <Input
            id="passwordInput"
            name="password"
            placeholder="Enter Password"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (password.trim() === "") {
                  addToast({
                    title: "Please Enter a Password",
                    color: "danger",
                  });
                } else if (newKeyPassword) {
                  newKeyPassword(password);
                }
              }
            }}
            endContent={
              <button
                aria-label="toggle password visibility"
                className="focus:outline-none"
                type="button"
                onClick={toggleVisibility}
              >
                {isVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
          />
          <Button
            className="mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={() => {
              if (password.trim() === "") {
                addToast({
                  title: "Please Enter a Password",
                  color: "danger",
                });
              } else if (newKeyPassword) {
                newKeyPassword(password);
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
      <Modal
        backdrop="blur"
        isOpen={newPasswordChangeModal}
        onClose={() => setnewPasswordChangeModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-4">Enter New Password</h3>
          <Input
            id="newPasswordInput"
            name="password"
            placeholder="Enter Password"
            type={isVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (password.trim() === "") {
                  addToast({
                    title: "Please Enter a Password",
                    color: "danger",
                  });
                } else if (newKeyPassword) {
                  newKeyPassword(password);
                }
              }
            }}
            endContent={
              <button
                aria-label="toggle password visibility"
                className="focus:outline-none"
                type="button"
                onClick={toggleVisibility}
              >
                {isVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
          />
          <Button
            className="mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
            onPress={() => {
              if (password.trim() === "") {
                addToast({
                  title: "Please Enter a Password",
                  color: "danger",
                });
              } else if (newKeyPassword) {
                newKeyPassword(password);
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
      <Modal
        backdrop="blur"
        isOpen={removePasswordModal}
        onClose={closeremovePasswordModal}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Remove The Password From {selectedKeyName}
            &apos;s Key?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={closeremovePasswordModal}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={removePasswordFromKey}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  removePasswordFromKey();
                }
              }}
            >
              Yes
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        backdrop="blur"
        isOpen={addUserIDModal}
        onClose={() => setaddUserIDModal(false)}
      >
        <ModalContent className="p-5">
          <Input
            isRequired
            label="Name"
            labelPlacement="outside"
            placeholder="Enter your name"
            isInvalid={nameInvalid}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addUserID(selectedUserId);
              }
            }}
          />

          <br />

          <Input
            label="Email"
            labelPlacement="outside"
            placeholder="Enter your email"
            isInvalid={emailInvalid}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addUserID(selectedUserId);
              }
            }}
          />

          <br />

          <p className="text-sm text-gray-400 mb-2">
            This is how the new user ID will be stored in the key
          </p>

          {name || email ? (
            <p className="text-sm text-center font-bold">
              {name}
              {email ? ` <${email}>` : ""}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setaddUserIDModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => addUserID(selectedUserId)}
            >
              Add
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        size="4xl"
        backdrop="blur"
        isOpen={manageUserIDsModal}
        onClose={() => setmanageUserIDsModal(false)}
      >
        <ModalContent className="p-7">
          <Table
            isHeaderSticky
            bottomContent={bottomContentModal}
            bottomContentPlacement="outside"
            classNames={{
              wrapper: "max-h-[382px]",
            }}
            sortDescriptor={sortDescriptorModal}
            topContent={topContentModal}
            topContentPlacement="outside"
            onSortChange={setSortDescriptorModal}
          >
            <TableHeader columns={headerColumnsModal}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  align={
                    ["email", "status", "primary", "delete"].includes(
                      column.uid
                    )
                      ? "center"
                      : "start"
                  }
                  allowsSorting={column.sortable}
                  style={{ width: column.width }}
                >
                  {column.name}
                </TableColumn>
              )}
            </TableHeader>
            <TableBody items={sortedItemsModal}>
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => (
                    <TableCell>{renderCellModal(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ModalContent>
      </Modal>
      <Modal
        size="lg"
        backdrop="blur"
        isOpen={deleteUserIDModal}
        onClose={() => setdeleteUserIDModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2 font-semibold text-lg">
            Are You Sure You Want To Delete {userIDToDelete?.name}&apos;s User
            ID?
          </h3>
          <p className="text-sm text-red-500 mb-4">
            ⚠️ This will permanently remove the selected User ID from your local
            copy of the key. Deleting a User ID does <strong>not</strong> revoke
            it. There will be no record that this identity was invalidated, and
            anyone who previously trusted it may still do so. This action is
            irreversible.
          </p>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setdeleteUserIDModal(false)}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={async () => {
                await deleteUserID(selectedUserId, userIDToDelete);
                setdeleteUserIDModal(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  deleteUserID(selectedUserId, userIDToDelete);
                  setdeleteUserIDModal(false);
                }
              }}
            >
              Yes
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        size="xl"
        backdrop="blur"
        isOpen={revokeModal}
        onClose={() => setrevokeModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2 font-semibold">
            Are You Sure You Want To Revoke {selectedKeyName}&apos;s Key?
          </h3>

          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
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
            <li>
              You can still decrypt anything previously encrypted to this key.
            </li>
            <li>
              You will no longer be able to sign messages or data with it.
            </li>
            <li>The key will no longer be usable for encryption.</li>
            <li>
              This revocation only takes effect locally unless you share the
              revoked key.
            </li>
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
            classNames={{
              input: "min-h-[80px]",
            }}
            label="Description (Optional)"
            value={revocationReasonText}
            onChange={(e) => setRevocationReasonText(e.target.value)}
          />

          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setrevokeModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => {
                revokeKey(selectedUserId);
                setrevokeModal(false);
              }}
            >
              Revoke
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        size="lg"
        backdrop="blur"
        isOpen={revocationReasonModal}
        onClose={() => setrevocationReasonModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Revocation Reason for {selectedKeyName}&apos;s Key
          </h3>

          <div className="mb-4 p-3 bg-gray-800 rounded-lg">
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
            <div className="mb-4 p-3 bg-gray-800 rounded-lg text-sm">
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
              onPress={() => setrevocationReasonModal(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setrevocationReasonModal(false);
                }
              }}
            >
              Close
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal backdrop="blur" isOpen={deleteModal} onClose={closedeleteModal}>
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Delete {selectedKeyName}&apos;s Key?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={closedeleteModal}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => {
                deleteKey(selectedUserId);
                closedeleteModal();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  deleteKey(selectedUserId);
                  closedeleteModal();
                }
              }}
            >
              Yes
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
