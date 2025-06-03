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
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Chip,
  User,
  Pagination,
  Modal,
  ModalContent,
  Spinner,
} from "@heroui/react";
import {
  EyeFilledIcon,
  EyeSlashFilledIcon,
  SearchIcon,
  ChevronDownIcon,
} from "@/components/icons";
import {
  openDB,
  getEncryptionKey,
  encryptData,
  decryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
import { decrypt, encrypt, hashKey } from "@/lib/cryptoUtils";
import { NProgressLink } from "@/components/nprogress";
import { useRouter } from "next/navigation";
import { useVault } from "@/context/VaultContext";
import ConnectivityCheck from "@/components/connectivity-check";
import NProgress from "nprogress";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import * as openpgp from "openpgp";

const statusColorMap = {
  "Backed Up": "success",
  "Not Backed Up": "danger",
};

const keyStatusColorMap = {
  active: "success",
  expired: "danger",
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
  "keystatus",
  "passwordprotected",
  "status",
  "backup",
];

const columns = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  {
    name: "EMAIL",
    uid: "email",
    width: "23%",
    align: "center",
    sortable: true,
  },
  {
    name: "CREATION DATE",
    uid: "creationdate",
    width: "15%",
    sortable: true,
  },
  {
    name: "EXPIRY DATE",
    uid: "expirydate",
    width: "12%",
    sortable: true,
  },
  {
    name: "KEY STATUS",
    uid: "keystatus",
    width: "10%",
    align: "center",
    sortable: true,
  },
  {
    name: "PASSWORD",
    uid: "passwordprotected",
    width: "10%",
    align: "center",
    sortable: true,
  },
  {
    name: "STATUS",
    uid: "status",
    width: "15%",
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "BACKUP", uid: "backup", width: "8%", align: "center" },
];

const capitalize = (s) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const processKey = async (key, openpgpKey, vaultPassword, backedUpKeys) => {
  try {
    const userIDs = openpgpKey.getUserIDs();
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
        const expirationTime = await key.getExpirationTime();
        const now = new Date();
        if (expirationTime === null || expirationTime === Infinity) {
          return { expirydate: "No Expiry", keystatus: "active" };
        } else if (expirationTime < now) {
          return {
            expirydate: formatDate(expirationTime),
            keystatus: "expired",
          };
        } else {
          return {
            expirydate: formatDate(expirationTime),
            keystatus: "active",
          };
        }
      } catch {
        return { expirydate: "Error", keystatus: "unknown" };
      }
    };

    const isBackedUp = await (async () => {
      const statuses = await Promise.all(
        backedUpKeys.map(async (backedUpKey) => {
          let decryptedCloudPublicKey = "";
          let decryptedCloudPrivateKey = "";
          if (backedUpKey.publicKey) {
            decryptedCloudPublicKey = await decrypt(
              backedUpKey.publicKey,
              vaultPassword
            );
          }
          if (backedUpKey.privateKey) {
            decryptedCloudPrivateKey = await decrypt(
              backedUpKey.privateKey,
              vaultPassword
            );
          }
          return (
            decryptedCloudPublicKey === key.publicKey ||
            (key.privateKey && decryptedCloudPrivateKey === key.privateKey)
          );
        })
      );
      return statuses.some((status) => status);
    })();

    const status = isBackedUp ? "Backed Up" : "Not Backed Up";

    const creationdate = formatDate(openpgpKey.getCreationTime());

    const { expirydate, keystatus } = await getKeyExpiryInfo(openpgpKey);

    const isPasswordProtected = async (privateKeyArmored) => {
      try {
        const privateKey = await openpgp.readPrivateKey({
          armoredKey: privateKeyArmored,
        });
        return privateKey.isPrivate() && !privateKey.isDecrypted();
      } catch (error) {
        console.error("Error reading private key:", error);
        return false;
      }
    };

    const passwordProtected = key.privateKey
      ? await isPasswordProtected(key.privateKey)
      : false;

    const formatFingerprint = (fingerprint) => {
      const parts = fingerprint.match(/.{1,4}/g);
      const nbsp = "\u00A0";
      return (
        parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ")
      );
    };
    const fingerprint = formatFingerprint(
      openpgpKey.getFingerprint().toUpperCase()
    );

    const formatKeyID = (keyid) => keyid.match(/.{1,4}/g).join(" ");
    const keyid = formatKeyID(openpgpKey.getKeyID().toHex().toUpperCase());

    const formatAlgorithm = (algoInfo) => {
      // ECC curve detection
      const labelMap = {
        curve25519: "Curve25519 (EdDSA/ECDH)",
        nistP256: "NIST P-256 (ECDSA/ECDH)",
        nistP521: "NIST P-521 (ECDSA/ECDH)",
        brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
        brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
      };

      if (["eddsa", "eddsaLegacy", "curve25519"].includes(algoInfo.algorithm)) {
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
    const algorithm = formatAlgorithm(openpgpKey.getAlgorithmInfo());

    return {
      id: key.id,
      name,
      email,
      creationdate,
      expirydate,
      keystatus,
      passwordprotected: passwordProtected ? "Yes" : "No",
      status,
      keyid,
      fingerprint,
      algorithm,
      avatar: (() => {
        const hasPrivateKey = key.privateKey && key.privateKey.trim() !== "";
        const hasPublicKey = key.publicKey && key.publicKey.trim() !== "";
        if (hasPrivateKey && hasPublicKey) {
          return Keyring.src;
        } else if (hasPublicKey) {
          return Public.src;
        }
      })(),
      publicKey: key.publicKey,
      privateKey: key.privateKey,
    };
  } catch (error) {
    console.error("Error processing key:", error);
    return null;
  }
};

const getTotalKeysCount = async () => {
  const db = await openDB();
  const transaction = db.transaction(dbPgpKeys, "readonly");
  const store = transaction.objectStore(dbPgpKeys);
  return new Promise((resolve, reject) => {
    const countRequest = store.count();
    countRequest.onsuccess = (e) => resolve(e.target.result);
    countRequest.onerror = (e) => reject(e.target.error);
  });
};

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [totalKeys, setTotalKeys] = useState(0);
  const [cache, setCache] = useState({});
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  const { getVaultPassword, lockVault } = useVault();

  useEffect(() => {
    const checkVault = async () => {
      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) {
        try {
          await lockVault();
        } catch (err) {
          console.error("Failed to lock vault:", err);
        } finally {
          NProgress.start();
          router.push("/vault");
        }
      }
    };
    checkVault();
  }, [router, getVaultPassword]);

  const pages = totalKeys > 0 ? Math.ceil(totalKeys / rowsPerPage) : 1;

  useEffect(() => {
    if (page > pages) {
      setPage(pages);
    }
  }, [pages, page]);

  useEffect(() => {
    setUsers([]);
    setIsLoading(true);
  }, [page, rowsPerPage]);

  useEffect(() => {
    const fetchKeys = async () => {
      const encryptionKey = await getEncryptionKey();
      setIsLoading(true);

      const cacheKey = `${page}-${rowsPerPage}`;
      if (cache[cacheKey]) {
        // Use cached data if available
        const decryptedKeys = await Promise.all(
          cache[cacheKey].map((encryptedItem) =>
            decryptData(
              encryptedItem.encrypted,
              encryptionKey,
              encryptedItem.iv
            )
          )
        );
        setUsers(decryptedKeys);
        setIsLoading(false);
      } else {
        try {
          const neededKeys = [];
          const startIndex = (page - 1) * rowsPerPage;
          const endIndex = startIndex + rowsPerPage;

          // Try to find keys in existing cache entries
          for (let i = startIndex; i < endIndex; i++) {
            let found = false;
            for (const [cacheKey, cacheData] of Object.entries(cache)) {
              const [cachePage, cacheRowsPerPage] = cacheKey
                .split("-")
                .map(Number);
              const cacheStartIndex = (cachePage - 1) * cacheRowsPerPage;
              const cacheEndIndex = cacheStartIndex + cacheData.length;

              if (i >= cacheStartIndex && i < cacheEndIndex) {
                const cacheIndex = i - cacheStartIndex;
                if (cacheData[cacheIndex]) {
                  neededKeys.push(cacheData[cacheIndex]);
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              neededKeys.length = 0;
              break;
            }
          }

          if (neededKeys.length === rowsPerPage) {
            const decryptedKeys = await Promise.all(
              neededKeys.map((encryptedItem) =>
                decryptData(
                  encryptedItem.encrypted,
                  encryptionKey,
                  encryptedItem.iv
                )
              )
            );
            setUsers(decryptedKeys);
            setCache((prevCache) => ({
              ...prevCache,
              [cacheKey]: neededKeys,
            }));
          } else {
            // Fetch from IndexedDB
            const offset = (page - 1) * rowsPerPage;
            const keys = await loadKeysFromIndexedDB(offset, rowsPerPage);
            const encryptedForCache = await Promise.all(
              keys.map(async (key) => await encryptData(key, encryptionKey))
            );
            setCache((prevCache) => ({
              ...prevCache,
              [cacheKey]: encryptedForCache,
            }));
            setUsers(keys);
          }

          if (totalKeys === 0) {
            const total = await getTotalKeysCount();
            setTotalKeys(total);
          }
        } catch (error) {
          console.error("Error loading keys:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchKeys();

    const handleStorageChange = async () => {
      try {
        const offset = (page - 1) * rowsPerPage;
        const updatedKeys = await loadKeysFromIndexedDB(offset, rowsPerPage);
        const encryptionKey = await getEncryptionKey();
        const cacheKey = `${page}-${rowsPerPage}`;
        const encryptedUpdated = await Promise.all(
          updatedKeys.map(async (key) => await encryptData(key, encryptionKey))
        );
        setCache((prevCache) => ({
          ...prevCache,
          [cacheKey]: encryptedUpdated,
        }));
        setUsers(updatedKeys);
        const total = await getTotalKeysCount();
        setTotalKeys(total);
      } catch (error) {
        console.error("Error loading keys:", error);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [page, rowsPerPage]);

  const loadKeysFromIndexedDB = async (offset, limit) => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();
    let backedUpKeys = [];

    try {
      const response = await fetch("/api/manage-keys/fetch-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        backedUpKeys = data.keys || [];
      }
    } catch (error) {
      console.error("Error fetching backed up keys:", error);
    }

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readonly");
      const store = transaction.objectStore(dbPgpKeys);
      let results = [];
      let skipped = 0;
      const request = store.openCursor();

      const processResults = async () => {
        try {
          const decryptedKeys = await Promise.all(
            results.map(async (record) =>
              decryptData(record.encrypted, encryptionKey, record.iv)
            )
          );
          let vaultPassword = await getVaultPassword();
          const processedKeys = await Promise.all(
            decryptedKeys.map(async (key) => {
              try {
                const openpgpKey = await openpgp.readKey({
                  armoredKey: key.publicKey,
                });
                return await processKey(
                  key,
                  openpgpKey,
                  vaultPassword,
                  backedUpKeys
                );
              } catch (error) {
                console.error("Error processing individual key:", error);
                return null;
              }
            })
          );

          vaultPassword = null;
          resolve(processedKeys.filter((key) => key !== null));
        } catch (error) {
          reject(error);
        }
      };

      request.onsuccess = async (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (skipped < offset) {
            skipped++;
            cursor.continue();
            return;
          }
          results.push(cursor.value);
          if (results.length < limit) {
            cursor.continue();
          } else {
            await processResults();
          }
        } else {
          await processResults();
        }
      };

      request.onerror = (e) => reject(e.target.error);
    });
  };

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];

    if (filterValue) {
      filteredUsers = filteredUsers.filter((user) =>
        user.name.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [users, filterValue]);

  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const first = a[sortDescriptor.column];
      const second = b[sortDescriptor.column];
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [sortDescriptor, filteredItems]);

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
      case "keystatus":
        return (
          <Chip
            className="-ms-5 capitalize"
            color={keyStatusColorMap[user.keystatus]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "status":
        return (
          <Chip
            className="capitalize -ms-4"
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
      case "backup":
        return (
          <Button
            className="ms-2"
            color="secondary"
            variant="flat"
            onPress={() => {
              backupKey(user);
            }}
          >
            Backup
          </Button>
        );
      default:
        return cellValue;
    }
  }, []);

  const backupKey = async (user, password = null) => {
    try {
      let key = null;
      let privateKeyRaw = null;
      let isPublicKeyOnly = false;

      if (user.privateKey) {
        try {
          key = await openpgp.readKey({ armoredKey: user.privateKey });
          if (key.isPrivate() && !key.isDecrypted()) {
            if (!password) {
              const enteredPassword = await triggerPasswordModal(user);
              password = enteredPassword;
            }
            try {
              key = await openpgp.decryptKey({
                privateKey: key,
                passphrase: password,
              });
            } catch {
              addToast({
                title: `Incorrect Password for ${user.name}'s Keyring`,
                color: "danger",
              });
              return;
            }
          }
          privateKeyRaw = user.privateKey;
        } catch {
          console.warn(
            "Failed to read or decrypt private key. Falling back to public key."
          );
          isPublicKeyOnly = true;
        }
      } else {
        isPublicKeyOnly = true;
      }

      // If no usable private key, try reading public key
      if (!key && user.publicKey) {
        try {
          key = await openpgp.readKey({ armoredKey: user.publicKey });
          privateKeyRaw = null;
        } catch {
          throw new Error("Failed to read both private and public keys.");
        }
      }

      if (!key) {
        throw new Error("No valid PGP key found.");
      }

      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) {
        addToast({
          title: "No vault password found. Please lock and reopen vault.",
          color: "danger",
        });
        return;
      }

      // Compute hashes and encrypt the keys
      let privateKeyHash = null,
        encryptedPrivateKey = null;
      let publicKeyHash = null,
        encryptedPublicKey = null;
      const hasPrivate = privateKeyRaw && privateKeyRaw.trim() !== "";
      const hasPublic = user.publicKey && user.publicKey.trim() !== "";

      if (hasPrivate) {
        privateKeyHash = await hashKey(privateKeyRaw);
        encryptedPrivateKey = await encrypt(privateKeyRaw, vaultPassword);
      }
      if (!hasPrivate && hasPublic) {
        publicKeyHash = await hashKey(user.publicKey);
        encryptedPublicKey = await encrypt(user.publicKey, vaultPassword);
      }

      // Construct payload with already hashed + encrypted keys
      const payload = {
        ...(encryptedPrivateKey ? { encryptedPrivateKey } : {}),
        ...(encryptedPublicKey ? { encryptedPublicKey } : {}),
        ...(privateKeyHash ? { privateKeyHash } : {}),
        ...(publicKeyHash ? { publicKeyHash } : {}),
      };

      const response = await fetch("/api/manage-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        if (responseData.message === "Key already backed up.") {
          addToast({
            title: `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} is already backed up`,
            color: "primary",
          });
        } else {
          addToast({
            title: `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} successfully backed up to the cloud!`,
            color: "success",
          });
          setUsers((prevUsers) =>
            prevUsers.map((prevUser) => {
              if (prevUser.id === user.id)
                return { ...prevUser, status: "Backed Up" };
              return prevUser;
            })
          );
        }
      } else {
        const errorMessage =
          responseData?.error ||
          `Failed to back up ${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"}`;
        addToast({
          title: errorMessage,
          color: "danger",
        });
      }
    } catch (error) {
      console.error(error);
      addToast({
        title: `Failed to process ${user.name}'s key.`,
        color: "danger",
      });
    }
  };

  const [passwordResolve, setPasswordResolve] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");

  const triggerPasswordModal = async (user) => {
    setIsOpen(true);
    return new Promise((resolve) => {
      const tryPassword = async () => {
        const enteredPassword = await new Promise((res) => {
          setPasswordResolve(() => res);
        });
        try {
          const key = await openpgp.readKey({
            armoredKey: user.privateKey,
          });
          await openpgp.decryptKey({
            privateKey: key,
            passphrase: enteredPassword,
          });
          setIsOpen(false);
          resolve(enteredPassword);
        } catch {
          addToast({
            title: `Incorrect Password for ${user.name}'s Keyring. Please try again.`,
            color: "danger",
          });
          tryPassword();
        }
      };
      tryPassword();
    });
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const onRowsPerPageChange = useCallback((e) => {
    const newRowsPerPage = Number(e.target.value);
    setRowsPerPage(newRowsPerPage);
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
          Backup Keyrings On Cloud
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
                .filter((column) => column.uid !== "backup")
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
            Total {totalKeys} keys
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
    totalKeys,
    visibleColumns,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 relative flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={page}
          total={pages}
          onChange={handlePageChange}
        />
        <div className="sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2">
          <Button
            className="sm:min-w-40 min-w-32 pl-3"
            isDisabled={locking}
            onPress={async () => {
              setLocking(true);
              try {
                await lockVault();
                NProgress.start();
                router.push("/vault");
              } catch (error) {
                console.error("Error locking vault:", error);
              } finally {
                setLocking(false);
              }
            }}
          >
            {locking ? <Spinner color="white" size="sm" /> : "🔒 Lock Vault"}
          </Button>
        </div>
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button
            isDisabled={pages === 1}
            size="sm"
            variant="flat"
            onPress={() => handlePageChange(page - 1)}
          >
            Previous
          </Button>
          <Button
            isDisabled={pages === 1}
            size="sm"
            variant="flat"
            onPress={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [page, pages, locking]);

  return (
    <>
      <ConnectivityCheck />
      <Table
        isHeaderSticky
        aria-label="Example table with custom cells, pagination and sorting"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        classNames={{
          wrapper: "max-h-[382px]",
        }}
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
                  "keystatus",
                  "passwordprotected",
                  "status",
                  "keyid",
                  "fingerprint",
                  "algorithm",
                  "backup",
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
              <Spinner
                size="lg"
                color="warning"
                label={
                  <div className="text-center">
                    Loading keyrings...
                    <br />
                    <span className="text-gray-300 text-sm">
                      This may take some time depending on your device&apos;s
                      performance.
                    </span>
                  </div>
                }
              />
            </div>
          }
          isLoading={isLoading}
          emptyContent={
            <>
              <span>No keyrings found</span>
              <br />
              <br />
              <div className="ms-2 flex justify-center">
                <Button
                  className="ps-10 pe-10"
                  as={NProgressLink}
                  href="/cloud-manage"
                >
                  Import Keyrings From Cloud
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
      <Modal backdrop="blur" isOpen={isOpen} onClose={() => setIsOpen(false)}>
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
                } else if (passwordResolve) {
                  passwordResolve(password);
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
              } else if (passwordResolve) {
                passwordResolve(password);
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
    </>
  );
}
