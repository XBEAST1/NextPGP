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
import { toast, ToastContainer } from "react-toastify";
import { NProgressLink } from "@/components/nprogress";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import "react-toastify/dist/ReactToastify.css";
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
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedKeyName, setSelectedKeyName] = useState("");
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [validityModal, setvalidityModal] = useState(false);
  const [selectedValidityKey, setSelectedValidityKey] = useState(null);
  const [expiryDate, setExpiryDate] = useState(null);
  const [password, setPassword] = useState("");
  const [newKeyPassword, setnewKeyPassword] = useState(null);
  const [passwordModal, setPasswordModal] = useState(false);
  const [newPasswordChangeModal, setnewPasswordChangeModal] = useState(false);
  const [removePasswordModal, setremovePasswordModal] = useState(false);
  const [revokeModal, setrevokeModal] = useState(false);
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
    } catch (error) {
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

              const day = String(date.getUTCDate()).padStart(2, "0");
              const month = monthNames[date.getUTCMonth()];
              const year = date.getUTCFullYear();

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
              } catch (error) {
                return { expirydate: "Error", status: "unknown" };
              }
            };

            const processedKeys = await Promise.all(
              decryptedKeys.map(async (key) => {
                const openpgpKey = await openpgp.readKey({
                  armoredKey: key.publicKey,
                });

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
                  name: key.name,
                  email: key.email,
                  creationdate: creationdate,
                  expirydate: expirydate,
                  status: status,
                  passwordprotected: passwordProtected ? "Yes" : "No",
                  keyid: keyid,
                  fingerprint: fingerprint,
                  algorithm: algorithm,
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
        } catch (error) {
          toast.error("Incorrect Password", {
            position: "top-right",
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
    } catch (error) {
      toast.error(
        "Failed to read or decrypt. The key is not valid or there was an error processing it",
        {
          position: "top-right",
        }
      );
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
          Date.UTC(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate() + 1,
            0,
            0,
            0,
            0
          )
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

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey: privateKey,
        keyExpirationTime: keyExpirationTime,
        date: new Date(),
        format: "armored",
        userIDs: [
          { name: selectedValidityKey.name, email: selectedValidityKey.email },
        ],
      });

      await updateKeyValidity(selectedValidityKey.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedKeyPair.publicKey,
      });

      toast.success("Validity Updated Successfully", { position: "top-right" });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);

      setvalidityModal(false);
      setSelectedValidityKey(null);
    } catch (error) {
      toast.error("Failed to update validity", { position: "top-right" });
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
        } catch (error) {
          toast.error("Incorrect Password", {
            position: "top-right",
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
      toast.success("Password Changed Successfully", { position: "top-right" });
    } catch (error) {
      toast.error("Failed to change password", { position: "top-right" });
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

      toast.success("Password removed successfully", { position: "top-right" });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
    } catch (error) {
      toast.error("Failed to remove password", { position: "top-right" });
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

  const revokeKey = async (user) => {
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Revoke the key
      const revokedKey = await openpgp.revokeKey({
        key: privateKey,
        format: "armored",
        reasonForRevocation: "key compromised",
        date: new Date(),
      });

      // Update the key in the database
      await updateKeyValidity(user.id, {
        privateKey: revokedKey.privateKey,
        publicKey: revokedKey.publicKey,
      });

      toast.success("Key Revoked Successfully", { position: "top-right" });
      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
    } catch (error) {
      console.error(error);
      toast.error("Failed to revoke key", { position: "top-right" });
    }
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

  return (
    <>
      <ToastContainer theme="dark" />
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
                  toast.error("Please Enter a Password", {
                    position: "top-right",
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
                toast.error("Please Enter a Password", {
                  position: "top-right",
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
                  toast.error("Please Enter a Password", {
                    position: "top-right",
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
                toast.error("Please Enter a Password", {
                  position: "top-right",
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
              <div className="-ms-12">
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

          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setrevokeModal(false)}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => {
                revokeKey(selectedUserId);
                setrevokeModal(false);
              }}
            >
              Yes
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
            >
              Yes
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
