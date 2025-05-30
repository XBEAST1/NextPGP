"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useVault } from "@/context/VaultContext";
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
  getStoredKeys,
  dbPgpKeys,
} from "@/lib/indexeddb";
import {
  computeKeyHash,
  decrypt,
} from "@/lib/cryptoUtils";
import { toast, ToastContainer } from "react-toastify";
import { NProgressLink } from "@/components/nprogress";
import { useRouter } from "next/navigation";
import ConnectivityCheck from "@/components/connectivity-check";
import NProgress from "nprogress";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";

const statusColorMap = {
  Imported: "success",
  "Not Imported": "danger",
};

const keyStatusColorMap = {
  active: "success",
  expired: "danger",
};

const passwordprotectedColorMap = {
  Yes: "success",
  No: "danger",
};

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

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "email",
  "creationdate",
  "expirydate",
  "keystatus",
  "passwordprotected",
  "status",
  "import",
  "delete",
];

const columns = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  {
    name: "EMAIL",
    uid: "email",
    width: "25%",
    align: "center",
    sortable: true,
  },
  {
    name: "CREATION DATE",
    uid: "creationdate",
    width: "12%",
    sortable: true,
  },
  {
    name: "EXPIRY DATE",
    uid: "expirydate",
    width: "10%",
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
  { name: "IMPORT", uid: "import", width: "10%", align: "center" },
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
  const [isLoading, setIsLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const router = useRouter();

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

  const loadKeysFromCloud = async () => {
    try {
      // Get vault password from context
      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) {
        throw new Error("Vault password not available");
      }

      // Fetch keys from API
      const response = await fetch("/api/manage-keys/fetch-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch keys from API");
      }

      const data = await response.json();
      const keys = data.keys || [];

      // Get locally stored keys first
      const storedKeys = await getStoredKeys();

      // Process and decrypt each key from cloud
      const processedKeys = await Promise.all(
        keys.map(async (key) => {
          try {
            // Decrypt Cloud privateKey and publicKey using the vault password.
            let decryptedCloudPrivateKey = "";
            let decryptedCloudPublicKey = "";
            if (key.privateKey) {
              decryptedCloudPrivateKey = await decrypt(
                key.privateKey,
                vaultPassword
              );
            }
            if (key.publicKey) {
              decryptedCloudPublicKey = await decrypt(
                key.publicKey,
                vaultPassword
              );
            }

            const openpgpKey = await openpgp.readKey({
              armoredKey: decryptedCloudPrivateKey || decryptedCloudPublicKey,
            });

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

            const creationdate = formatDate(openpgpKey.getCreationTime());

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
            const { expirydate, keystatus } =
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

            const algorithm = formatAlgorithm(openpgpKey.getAlgorithmInfo());

            // Check if this key is already imported
            const isImported = storedKeys.some((storedKey) => {
              if (decryptedCloudPublicKey && storedKey.publicKey) {
                return storedKey.publicKey === decryptedCloudPublicKey;
              }
              if (decryptedCloudPrivateKey && storedKey.privateKey) {
                return storedKey.privateKey === decryptedCloudPrivateKey;
              }
              return false;
            });

            return {
              id: key.id || Date.now(),
              name,
              email,
              creationdate,
              expirydate,
              keystatus,
              passwordprotected: passwordProtected ? "Yes" : "No",
              status: isImported ? "Imported" : "Not Imported",
              keyid,
              fingerprint,
              algorithm,
              avatar: (() => {
                const hasPrivateKey =
                  key.privateKey &&
                  key.privateKey !== "null" &&
                  key.privateKey.trim() !== "";
                const hasPublicKey =
                  key.publicKey && key.publicKey.trim() !== "";
                if (hasPrivateKey) {
                  return Keyring.src;
                } else if (hasPublicKey) {
                  return Public.src;
                }
                return null;
              })(),
              decryptedPrivateKey: decryptedCloudPrivateKey,
              decryptedPublicKey: decryptedCloudPublicKey,
            };
          } catch (error) {
            console.error("Error processing key:", error);
            return null;
          }
        })
      );

      return processedKeys.filter((key) => key !== null);
    } catch (error) {
      console.error("Error loading keys:", error);
      toast.error(
        "Failed to load keys. Please check your connection and try again."
      );
      return [];
    }
  };

  const saveKeyToIndexedDB = async (keyData) => {
    const encryptionKey = await getEncryptionKey();
    const { encrypted, iv } = await encryptData(keyData, encryptionKey);

    const db = await openDB();
    const transaction = db.transaction(dbPgpKeys, "readwrite");
    const store = transaction.objectStore(dbPgpKeys);

    store.put({ id: keyData.id, encrypted, iv });
  };

  const checkIfKeyExists = async (newKeyData) => {
    const existingKeys = await getStoredKeys();

    return existingKeys.some((key) => {
      // If newKeyData has a private key, match only private keys
      if (newKeyData.privateKey) {
        // Normalize both keys by removing whitespace and converting to same case
        const normalizedNewKey = newKeyData.privateKey
          .replace(/\s+/g, "")
          .trim()
          .toLowerCase();
        const normalizedExistingKey = key.privateKey
          ?.replace(/\s+/g, "")
          .trim()
          .toLowerCase();

        return normalizedNewKey === normalizedExistingKey;
      }
      // If newKeyData only has public key, match only public keys
      return key.publicKey === newKeyData.publicKey;
    });
  };

  const importFromCloud = async (selectedUser) => {
    try {
      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) {
        throw new Error("Vault password not available");
      }

      let keyname;
      let publicKey = selectedUser.decryptedPublicKey;
      const privateKey = selectedUser.decryptedPrivateKey;

      // If there's only a private key, generate the public key
      if (privateKey && (!publicKey || publicKey.trim() === "")) {
        try {
          const privateKeyObj = await openpgp.readKey({
            armoredKey: privateKey,
          });
          const publicKeyObj = privateKeyObj.toPublic();
          publicKey = publicKeyObj.armor();
          keyname =
            privateKeyObj.getUserIDs()[0]?.split("<")[0].trim() ||
            "Unknown User";
        } catch (err) {
          console.error("Error generating public key:", err);
          throw new Error("Failed to generate public key from private key");
        }
      }

      if (!keyname && publicKey && publicKey.trim() !== "") {
        try {
          const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey });
          keyname =
            publicKeyObj.getUserIDs()[0]?.split("<")[0].trim() ||
            "Unknown User";
        } catch (err) {
          console.error("Error reading public key for user name:", err);
          keyname = "Unknown User";
        }
      }

      const keyData = {
        id: Date.now(),
        publicKey: publicKey,
        privateKey:
          privateKey &&
          privateKey.trim().toLowerCase() !== "null" &&
          privateKey.trim() !== ""
            ? privateKey
            : null,
      };

      // Check if key already exists
      const exists = await checkIfKeyExists(keyData);
      if (!exists) {
        await saveKeyToIndexedDB(keyData);

        // Determine if it's a public key or keyring based on privateKey being null
        const keyType = keyData.privateKey === null ? "Public Key" : "Keyring";
        toast.success(`Imported ${keyname}'s ${keyType}`, {
          position: "top-right",
        });

        // Refresh the keys list immediately after successful import
        const refreshedKeys = await loadKeysFromCloud();
        setUsers(refreshedKeys);
      } else {
        // Update the "already exists" message too
        const keyType = keyData.privateKey === null ? "Public Key" : "Keyring";
        toast.info(`${keyname}'s ${keyType} already exists`, {
          position: "top-right",
        });
      }
    } catch (error) {
      console.error("Error processing key:", error);
      toast.error(`Failed to import key: ${error.message}`, {
        position: "top-right",
      });
    }
  };

  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true);
      try {
        const pgpKeys = await loadKeysFromCloud();
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
        const updatedKeys = await loadKeysFromCloud();
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
            className="capitalize -ms-3"
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
      case "import":
        return (
          <Button
            className="ms-2"
            color="secondary"
            variant="flat"
            onPress={() => importFromCloud(user)}
          >
            Import
          </Button>
        );
      case "delete":
        return (
          <Button
            className="ms-2"
            color="danger"
            variant="flat"
            onPress={() => triggerDeleteModal(user)}
          >
            Delete
          </Button>
        );
      default:
        return cellValue;
    }
  }, []);

  const deleteKey = async (user) => {
    try {
      // Use the decrypted keys for deletion
      const keyForHash = user.decryptedPrivateKey || user.decryptedPublicKey;
      if (!keyForHash) {
        throw new Error("No key data found");
      }

      let requestBody = { keyId: user.id };

      if (user.decryptedPrivateKey) {
        const privateKeyHash = await computeKeyHash(user.decryptedPrivateKey);
        requestBody.privateKeyHash = privateKeyHash;
      } else if (user.decryptedPublicKey) {
        const publicKeyHash = await computeKeyHash(user.decryptedPublicKey);
        requestBody.publicKeyHash = publicKeyHash;
      }

      const deleteResponse = await fetch("/api/manage-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || "Failed to delete key");
      }

      toast.success(`${user.name}'s Key successfully deleted from the cloud`, {
        position: "top-right",
      });
      const refreshedKeys = await loadKeysFromCloud();
      setUsers(refreshedKeys);
      setPage(1);
    } catch (error) {
      console.error("Error in deleteKey:", error);
      toast.error(`Failed to delete key: ${error.message}`, {
        position: "top-right",
      });
    }
  };

  const [passwordResolve, setPasswordResolve] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");

  const [DeleteModal, setDeleteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedKeyName, setSelectedKeyName] = useState("");

  const triggerDeleteModal = (user) => {
    setSelectedUserId(user);
    setSelectedKeyName(user.name);
    setDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setSelectedUserId(null);
    setSelectedKeyName("");
    setDeleteModal(false);
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
          Manage Keyrings On Cloud
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
                .filter((column) => !["import", "delete"].includes(column.uid))
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
      <div className="py-2 px-2 relative flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={page}
          total={pages}
          onChange={setPage}
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
  }, [page, pages, locking, onPreviousPage, onNextPage]);

  return (
    <>
      <ConnectivityCheck />
      <ToastContainer theme="dark" />
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
                  "import",
                  "delete",
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
              <div className="ms-2 flex justify-center">
                <Button
                  className="ps-10 pe-10"
                  as={NProgressLink}
                  href="/cloud-backup"
                >
                  Backup Keyrings On Cloud
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
                  toast.error("Please Enter a Password", {
                    position: "top-right",
                  });
                } else {
                  if (passwordResolve) {
                    passwordResolve(password);
                    setPasswordResolve(null);
                    setIsOpen(false);
                    setPassword("");
                  } else {
                    console.error("passwordResolve is not set");
                  }
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
              } else {
                if (passwordResolve) {
                  passwordResolve(password);
                  setPasswordResolve(null);
                  setIsOpen(false);
                  setPassword("");
                }
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
      <Modal backdrop="blur" isOpen={DeleteModal} onClose={closeDeleteModal}>
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Delete {selectedKeyName}&apos;s Key From
            Cloud?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={closeDeleteModal}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => {
                deleteKey(selectedUserId);
                closeDeleteModal();
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
