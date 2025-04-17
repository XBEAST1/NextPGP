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
  active: "success",
  expired: "danger",
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
    { name: "EMAIL", uid: "email", width: "20%" },
    { name: "EXPIRY DATE", uid: "expirydate", sortable: true, width: "20%" },
    { name: "STATUS", uid: "status", sortable: true, width: "15%" },
    {
      name: "PASSWORD",
      uid: "passwordprotected",
      sortable: true,
      width: "15%",
    },
    { name: "ACTIONS", uid: "actions", width: "11%" },
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
            size="sm"
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "passwordprotected":
        return (
          <Chip
            className="ms-5 capitalize"
            color={passwordprotectedColorMap[user.passwordprotected]}
            size="sm"
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "actions":
        return (
          <div className="relative flex justify-end items-center gap-2 me-10">
            <Dropdown>
              <DropdownTrigger>
                <Button isIconOnly size="sm" variant="light">
                  <VerticalDotsIcon className="text-default-300 " />
                </Button>
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem onPress={() => exportPublicKey(user)}>
                  Export Public Key
                </DropdownItem>
                {user.privateKey && user.privateKey.trim() !== "" ? (
                  <DropdownItem onPress={() => backupKeyring(user)}>
                    Backup Keyring
                  </DropdownItem>
                ) : (
                  ""
                )}
                <DropdownItem
                  onPress={() => triggerDeleteModal(user.id, user.name)}
                >
                  Delete
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </div>
        );
      default:
        return cellValue;
    }
  }, []);

  function generateRandomHexCode() {
    const randomValue = Math.floor(Math.random() * 0xffffffff);
    return `0x${randomValue.toString(16).toUpperCase().padStart(8, "0")}`;
  }

  const exportPublicKey = (user) => {
    const randomHex = generateRandomHexCode();
    const publicKey = user.publicKey;
    const blob = new Blob([publicKey], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${user.name}_${randomHex}_PUBLIC.asc`;
    link.click();
  };

  const backupKeyring = async (user, password = null) => {
    try {
      const randomHex = generateRandomHexCode();
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });

      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        if (!password) {
          const enteredPassword = await triggerPasswordModal(user);
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
      link.download = `${user.name}_${randomHex}_SECRET.asc`;
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

  const [passwordResolve, setPasswordResolve] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState("");

  const triggerPasswordModal = () => {
    setIsOpen(true);

    return new Promise((resolve) => {
      setPasswordResolve(() => resolve);
    });
  };

  const deleteKey = async (userId) => {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(dbPgpKeys, "readwrite");
      const store = transaction.objectStore(dbPgpKeys);

      const request = store.delete(userId);

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
              <div className="ms-6 flex justify-center">
                <Button as={Link} href="/import">
                  Import Key
                </Button>
                <span className="mx-3 mt-1">or</span>
                <Button as={Link} href="/cloud-manage">
                  Import Keyrings From Cloud
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
