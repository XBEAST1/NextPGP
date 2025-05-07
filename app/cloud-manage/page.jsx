"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
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
} from "@/components/icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import {
  openDB,
  getEncryptionKey,
  encryptData,
  getStoredKeys,
  dbPgpKeys,
} from "@/lib/indexeddb";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";

const statusColorMap = {
  Imported: "success",
  "Not Imported": "danger",
};

const formatDate = (isoDate) => {
  const date = new Date(isoDate);
  if (
    date.getUTCHours() === 23 &&
    date.getUTCMinutes() === 59 &&
    date.getUTCSeconds() === 59
  ) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
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

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [page, setPage] = useState(1);
  const [locking, setLocking] = useState(false);
  const router = useRouter();

  const columns = [
    { name: "NAME", uid: "name", sortable: true },
    { name: "EMAIL", uid: "email", width: "17%" },
    { name: "EXPIRY DATE", uid: "expirydate", sortable: true, width: "20%" },
    { name: "STATUS", uid: "status", sortable: true, width: "20%", align: "center" },
    { name: "IMPORT", uid: "import" },
    { name: "DELETE", uid: "delete", width: "8%" },
  ];

  const [isVisible, setIsVisible] = React.useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  // Add this new function alongside your other utility functions
  const decryptVaultPassword = async (encryptedData, key, iv) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    // Simply return the decoded string without JSON parsing
    return new TextDecoder().decode(decrypted);
  };

  const checkVaultPassword = sessionStorage.getItem("encryptedVaultPassword");

  useEffect(() => {
    if (!checkVaultPassword) {
      const lockVault = async () => {
        try {
          await fetch("/api/vault/lock", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
          });
        } catch (err) {
          console.error("Failed to lock vault:", err);
        } finally {
          router.push("/vault");
        }
      };

      lockVault();
    }
  }, [checkVaultPassword, router]);

  const loadKeysFromCloud = async () => {
    try {
      // Get vault password from session storage
      const storedVaultData = sessionStorage.getItem("encryptedVaultPassword");
      if (!storedVaultData) {
        console.warn("No vault password found in sessionStorage");
        return [];
      }

      let vaultPassword;
      let parsedVaultData;
      try {
        parsedVaultData = JSON.parse(storedVaultData);
      } catch {
        vaultPassword = storedVaultData;
      }

      if (!vaultPassword && parsedVaultData) {
        const ivBytes = new Uint8Array(parsedVaultData.iv);
        const encryptedPasswordBytes = new Uint8Array(parsedVaultData.data);
        const encryptionKey = await getEncryptionKey();
        vaultPassword = await decryptVaultPassword(
          encryptedPasswordBytes,
          encryptionKey,
          ivBytes
        );
      }

      if (!vaultPassword) {
        throw new Error("Failed to decrypt vault password");
      }

      // Fetch keys from API
      const response = await fetch("/api/manage-keys/fetch-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPassword }),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch keys from API");
      }

      const data = await response.json();
      const keys = data.keys || [];

      // Get locally stored keys first
      const storedKeys = await getStoredKeys();

      // Process and format each key from cloud
      const processedKeys = await Promise.all(
        keys.map(async (key) => {
          try {
            const openpgpKey = await openpgp.readKey({
              armoredKey: key.publicKey || key.privateKey,
            });

            // Extract User IDs
            const userIds = openpgpKey.users.map((user) => {
              const userId = user.userID;
              const name = userId?.userID.split(" <")[0] || "N/A";
              const email = userId?.email || "N/A";
              return { name, email };
            });

            // Get expiration info
            const expirationTime = await openpgpKey.getExpirationTime();
            const now = new Date();
            let expirydate = "No Expiry";

            if (expirationTime !== null && expirationTime !== Infinity) {
              if (expirationTime < now) {
                status = "expired";
              }
              expirydate = formatDate(expirationTime);
            }

            // Check if this key is already imported
            const isImported = storedKeys.some((storedKey) => {
              if (key.publicKey && storedKey.publicKey) {
                return storedKey.publicKey === key.publicKey;
              }
              if (key.privateKey && storedKey.privateKey) {
                return storedKey.privateKey === key.privateKey;
              }
              return false;
            });

            return {
              id: key.id || Date.now(),
              name: userIds[0]?.name || "N/A",
              email: userIds[0]?.email || "N/A",
              expirydate: expirydate,
              status: isImported ? "Imported" : "Not Imported",
              avatar: (() => {
                const hasPrivateKey =
                  key.privateKey &&
                  key.privateKey !== "null" &&
                  key.privateKey.trim() !== "";
                const hasPublicKey =
                  key.publicKey && key.publicKey.trim() !== "";
                if (hasPrivateKey && hasPublicKey) {
                  return Keyring.src;
                } else if (hasPublicKey) {
                  return Public.src;
                }
                return null;
              })(),
              publicKey: key.publicKey,
              privateKey: key.privateKey,
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
      let vaultPassword;
      try {
        const storedVaultData = sessionStorage.getItem(
          "encryptedVaultPassword"
        );
        if (!storedVaultData)
          throw new Error("No vault password found in sessionStorage.");

        let parsedVaultData;
        try {
          parsedVaultData = JSON.parse(storedVaultData);
        } catch {
          vaultPassword = storedVaultData;
        }

        if (!vaultPassword) {
          if (!parsedVaultData.iv || !parsedVaultData.data) {
            throw new Error("Encrypted vault password data is incomplete.");
          }
          const ivBytes = new Uint8Array(parsedVaultData.iv);
          const encryptedPasswordBytes = new Uint8Array(parsedVaultData.data);
          const encryptionKey = await getEncryptionKey();
          vaultPassword = await decryptVaultPassword(
            encryptedPasswordBytes,
            encryptionKey,
            ivBytes
          );
        }

        if (!vaultPassword) throw new Error("Vault password is missing.");
      } catch (e) {
        console.error(e);
        toast.error("Failed to decrypt vault password", {
          position: "top-right",
        });
        return;
      }

      try {
        const keyData = {
          id: Date.now(),
          name: selectedUser.name,
          email: selectedUser.email,
          publicKey: selectedUser.publicKey,
          privateKey:
            selectedUser.privateKey &&
            selectedUser.privateKey.trim().toLowerCase() !== "null" &&
            selectedUser.privateKey.trim() !== ""
              ? selectedUser.privateKey
              : null,
        };

        // Check if key already exists
        const exists = await checkIfKeyExists(keyData);
        if (!exists) {
          await saveKeyToIndexedDB(keyData);

          // Determine if it's a public key or keyring based on privateKey being null
          const keyType =
            keyData.privateKey === null ? "Public Key" : "Keyring";
          toast.success(`Imported ${keyData.name}'s ${keyType}`, {
            position: "top-right",
          });

          // Refresh the keys list immediately after successful import
          const refreshedKeys = await loadKeysFromCloud();
          setUsers(refreshedKeys);
        } else {
          // Update the "already exists" message too
          const keyType =
            keyData.privateKey === null ? "Public Key" : "Keyring";
          toast.info(`${keyData.name}'s ${keyType} already exists`, {
            position: "top-right",
          });
        }
      } catch (error) {
        console.error("Error processing key:", error);
        toast.error(`Failed to import key: ${error.message}`, {
          position: "top-right",
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(
        "Failed to import key from cloud. Please check your connection and try again.",
        { position: "top-right" }
      );
    }
  };

  useEffect(() => {
    const fetchKeys = async () => {
      const keys = await loadKeysFromCloud();
      setUsers(keys);
    };

    fetchKeys();

    const handleStorageChange = async () => {
      const updatedKeys = await loadKeysFromCloud();
      setUsers(updatedKeys);
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const filteredItems = React.useMemo(() => {
    let filteredUsers = [...users];

    if (filterValue) {
      filteredUsers = filteredUsers.filter((user) =>
        user.name.toLowerCase().includes(filterValue.toLowerCase())
      );
    }

    return filteredUsers;
  }, [users, filterValue]);

  const pages = Math.ceil(filteredItems.length / rowsPerPage);

  const sortedItems = React.useMemo(() => {
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

  const headerColumns = columns;

  const renderCell = React.useCallback((user, columnKey) => {
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
            className="capitalize -ms-3"
            color={statusColorMap[user.status]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "import":
        return (
          <Button
            className="-ms-4"
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
            className="-ms-4"
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
      // Get vault password from session storage for authentication
      const storedVaultData = sessionStorage.getItem("encryptedVaultPassword");
      if (!storedVaultData) {
        toast.error("No vault password found", { position: "top-right" });
        return;
      }

      let vaultPassword;
      try {
        const parsedVaultData = JSON.parse(storedVaultData);
        const ivBytes = new Uint8Array(parsedVaultData.iv);
        const encryptedPasswordBytes = new Uint8Array(parsedVaultData.data);
        const encryptionKey = await getEncryptionKey();
        vaultPassword = await decryptVaultPassword(
          encryptedPasswordBytes,
          encryptionKey,
          ivBytes
        );
      } catch (e) {
        vaultPassword = storedVaultData;
      }

      if (!vaultPassword) {
        toast.error("Failed to decrypt vault password", {
          position: "top-right",
        });
        return;
      }

      // Send delete request to the correct endpoint
      const deleteResponse = await fetch("/api/manage-keys", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyId: user.id,
          vaultPassword: vaultPassword,
          publicKey: user.publicKey,
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.error || "Failed to delete key");
      }

      const responseData = await deleteResponse.json();
      toast.success("Key deleted successfully", { position: "top-right" });
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

  const onNextPage = React.useCallback(() => {
    if (page < pages) {
      setPage(page + 1);
    }
  }, [page, pages]);

  const onPreviousPage = React.useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const onRowsPerPageChange = React.useCallback((e) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  }, []);

  const onSearchChange = React.useCallback((value) => {
    if (value) {
      setFilterValue(value);
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = React.useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const topContent = React.useMemo(() => {
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
              <option value="15">15</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [
    filterValue,
    onRowsPerPageChange,
    users.length,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = React.useMemo(() => {
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
                const response = await fetch("/api/vault/lock", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                });

                if (!response.ok) {
                  throw new Error("Failed to lock vault");
                }

                sessionStorage.removeItem("encryptedVaultPassword");

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
              align={column.uid === "actions" ? "center" : "start"}
              allowsSorting={column.sortable}
              style={{ width: column.width }}
            >
              {column.name}
            </TableColumn>
          )}
        </TableHeader>
        <TableBody
          emptyContent={
            <>
              <span>No keyrings found</span>
              <br />
              <br />
              <div className="ms-2 flex justify-center">
                <Button className="ps-10 pe-10" as={Link} href="/cloud-backup">
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
