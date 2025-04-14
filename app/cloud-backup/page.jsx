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
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Chip,
  User,
  Pagination,
  Modal,
  ModalContent,
} from "@heroui/react";
import {
  EyeFilledIcon,
  EyeSlashFilledIcon,
  VerticalDotsIcon,
  SearchIcon,
} from "@/components/icons";
import Link from "next/link";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as openpgp from "openpgp";

const statusColorMap = {
  "Backed Up": "success",
  "No Backed Up": "danger",
};

const passwordprotectedColorMap = {
  Yes: "success",
  No: "danger",
};

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [page, setPage] = useState(1);

  const columns = [
    { name: "NAME", uid: "name", sortable: true },
    { name: "EMAIL", uid: "email" },
    { name: "EXPIRY DATE", uid: "expirydate", sortable: true },
    { name: "STATUS", uid: "status", sortable: true },
    { name: "BACKUP", uid: "backup", sortable: true },
    { name: "DELETE", uid: "delete" },
  ];

  const [isVisible, setIsVisible] = React.useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  const dbName = "NextPGP";
  const dbPgpKeys = "pgpKeys";
  const selectedSigners = "selectedSigners";
  const selectedRecipients = "selectedRecipients";
  const dbCryptoKeys = "cryptoKeys";

  const openDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName, 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;

        if (!db.objectStoreNames.contains(dbPgpKeys)) {
          db.createObjectStore(dbPgpKeys, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(selectedSigners)) {
          db.createObjectStore(selectedSigners, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(selectedRecipients)) {
          db.createObjectStore(selectedRecipients, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(dbCryptoKeys)) {
          db.createObjectStore(dbCryptoKeys, { keyPath: "id" });
        }
      };

      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  };

  // Retrieves (or generates) the master encryption key using the Web Crypto API.
  const getEncryptionKey = async () => {
    const db = await openDB();
    const tx = db.transaction(dbCryptoKeys, "readonly");
    const store = tx.objectStore(dbCryptoKeys);
    const request = store.get("mainKey");

    return new Promise(async (resolve, reject) => {
      request.onsuccess = async () => {
        if (request.result) {
          const importedKey = await crypto.subtle.importKey(
            "raw",
            request.result.key,
            { name: "AES-GCM" },
            true,
            ["encrypt", "decrypt"]
          );
          resolve(importedKey);
        } else {
          // Generate Key if not found
          const key = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
          );
          const exportedKey = await crypto.subtle.exportKey("raw", key);

          const txWrite = db.transaction(dbCryptoKeys, "readwrite");
          const storeWrite = txWrite.objectStore(dbCryptoKeys);
          storeWrite.put({ id: "mainKey", key: new Uint8Array(exportedKey) });

          resolve(key);
        }
      };
      request.onerror = (e) => reject(e.target.error);
    });
  };

  // Decrypts data using the provided encryption key and IV.
  const decryptData = async (encryptedData, key, iv) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
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

            const getKeyExpiryInfo = async (key) => {
              try {
                const expirationTime = await key.getExpirationTime();
                const now = new Date();
                if (expirationTime === null || expirationTime === Infinity) {
                  return { expirydate: "No Expiry", status: "Backed Up" };
                } else if (expirationTime < now) {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: "expired",
                  };
                } else {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: "Backed Up",
                  };
                }
              } catch (error) {
                console.error("Error getting key expiration time:", error);
                return { expirydate: "Error", status: "unknown" };
              }
            };

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

            const processedKeys = await Promise.all(
              decryptedKeys.map(async (key) => {
                const openpgpKey = await openpgp.readKey({
                  armoredKey: key.publicKey,
                });
                const { expirydate, status } =
                  await getKeyExpiryInfo(openpgpKey);
                const passwordProtected = key.privateKey
                  ? await isPasswordProtected(key.privateKey)
                  : false;
                return {
                  id: key.id,
                  name: key.name,
                  email: key.email,
                  expirydate: expirydate,
                  status: status,
                  passwordprotected: passwordProtected ? "Yes" : "No",
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
      const pgpKeys = await loadKeysFromIndexedDB();
      setUsers(pgpKeys);
    };

    fetchKeys();

    const handleStorageChange = async () => {
      const updatedKeys = await loadKeysFromIndexedDB();
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
            className="capitalize"
            color={statusColorMap[user.status]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "backup":
        return (
          <Button
            color="secondary"
            variant="flat"
            onPress={() => backupKey(user)}
          >
            Backup
          </Button>
        );
      case "delete":
        return (
          <Button
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

  const backupKey = async (user, password = null) => {
    try {
      if (user.privateKey) {
        let key = await openpgp.readKey({ armoredKey: user.privateKey });
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
          } catch (error) {
            toast.error("Incorrect Password", { position: "top-right" });
            return;
          }
        }
      }

      const payload = {
        vaultId: user.id.toString(),
        privateKey: user.privateKey || null,
        publicKey: user.publicKey || null,
      };

      const response = await fetch("/api/manage-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success("Key successfully backed up to the database!", {
          position: "top-right",
        });
      } else {
        let errorMessage = "Unknown error";
        const contentType = response.headers.get("content-type");

        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch (jsonError) {
            try {
              const rawText = await response.text();
              errorMessage = rawText || errorMessage;
            } catch (textError) {}
          }
        } else {
          try {
            const rawText = await response.text();
            errorMessage = rawText || errorMessage;
          } catch (textError) {}
        }

        toast.error("Failed to back up the key", {
          position: "top-right",
        });
      }
    } catch (error) {
      toast.error(
        "Failed to process the key. The key is not valid or there was an error.",
        { position: "top-right" }
      );
    }
  };

  const deleteKey = async (user) => {
    const keyValue = user.publicKey ? user.publicKey : user.privateKey;
    try {
      const response = await fetch("/api/manage-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyValue }),
      });

      if (response.ok) {
        toast.success("Key deleted successfully", { position: "top-right" });
        const refreshedKeys = await loadKeysFromIndexedDB();
        setUsers(refreshedKeys);
        setPage(1);
      } else {
        let errorMessage = "Unknown error";
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const text = await response.text();
            if (text.trim()) {
              const errorData = JSON.parse(text);
              errorMessage = errorData.error || text;
              console.log("Error data from response (JSON):", errorData);
            } else {
              errorMessage = "Empty response received";
            }
          } catch (jsonError) {
            console.log("Failed to parse JSON response:", jsonError);
          }
        } else {
          try {
            const rawText = await response.text();
            errorMessage = rawText || errorMessage;
            console.log("Error text from response:", rawText);
          } catch (textError) {
            console.log("Failed to parse text response:", textError);
          }
        }
        toast.error(`Error deleting key: ${errorMessage}`, {
          position: "top-right",
        });
      }
    } catch (error) {
      toast.error("Error deleting key", { position: "top-right" });
      console.error("Error in deleteKey:", error);
    }
  };

  const [passwordResolve, setPasswordResolve] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");

  const triggerPasswordModal = () => {
    setIsOpen(true);

    return new Promise((resolve) => {
      setPasswordResolve(() => resolve);
    });
  };

  const [DeleteModal, setDeleteModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedKeyName, setSelectedKeyName] = useState("");

  const triggerDeleteModal = (userId, name) => {
    setSelectedUserId(userId);
    setSelectedKeyName(name);
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
          Backup Keyrings
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
                <Button as={Link} href="/import">
                  Import Key
                </Button>
                <span className="mx-3 mt-1">or</span>
                <Button as={Link} href="/generate">
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
            Are You Sure You Want To Delete {selectedKeyName}&apos;s Key?
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
