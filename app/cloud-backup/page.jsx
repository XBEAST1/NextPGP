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
import NProgress from "nprogress";
import { NProgressLink } from "@/components/nprogress";
import { useRouter } from "next/navigation";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  openDB,
  getEncryptionKey,
  decryptData,
  dbPgpKeys,
} from "@/lib/indexeddb";
import * as openpgp from "openpgp";
import ConnectivityCheck from "@/components/connectivity-check";

const statusColorMap = {
  "Backed Up": "success",
  "Not Backed Up": "danger",
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
  const [locking, setLocking] = useState(false);
  const router = useRouter();

  const columns = [
    { name: "NAME", uid: "name", sortable: true },
    { name: "EMAIL", uid: "email", width: "23%" },
    { name: "EXPIRY DATE", uid: "expirydate", sortable: true },
    { name: "PASSWORD", uid: "passwordprotected", sortable: true },
    {
      name: "STATUS",
      uid: "status",
      sortable: true,
      width: "15%",
      align: "center",
    },
    { name: "BACKUP", uid: "backup", width: "8%" },
  ];

  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = () => setIsVisible(!isVisible);

  const decryptVaultPassword = async (encryptedData, key, iv) => {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    return new TextDecoder().decode(decrypted);
  };

  useEffect(() => {
    const checkVaultPassword = sessionStorage.getItem("encryptedVaultPassword");
    
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
          NProgress.start();
          router.push("/vault");
        }
      };

      lockVault();
    }
  }, [router]);

  const loadKeysFromIndexedDB = async () => {
    const db = await openDB();
    const encryptionKey = await getEncryptionKey();

    let backedUpKeys = [];
    try {
      const storedVaultData = sessionStorage.getItem("encryptedVaultPassword");
      if (!storedVaultData) {
        console.warn("No vault password found in sessionStorage");
      } else {
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
          vaultPassword = await decryptVaultPassword(
            encryptedPasswordBytes,
            encryptionKey,
            ivBytes
          );
        }
        if (vaultPassword) {
          const response = await fetch("/api/manage-keys/fetch-keys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vaultPassword }),
          });

          if (response.ok) {
            const data = await response.json();
            backedUpKeys = data.keys || [];
          }
        }
      }
    } catch (error) {
      console.error("Error fetching backed up keys:", error);
    }

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

            const getKeyExpiryInfo = async (key, isBackedUp) => {
              try {
                const expirationTime = await key.getExpirationTime();
                const now = new Date();
                if (expirationTime === null || expirationTime === Infinity) {
                  return {
                    expirydate: "No Expiry",
                    status: isBackedUp ? "Backed Up" : "Not Backed Up",
                  };
                } else if (expirationTime < now) {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: "expired",
                  };
                } else {
                  return {
                    expirydate: formatDate(expirationTime),
                    status: isBackedUp ? "Backed Up" : "Not Backed Up",
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

                // Check if the key is backed up
                const isBackedUp = backedUpKeys.some(
                  (backedUpKey) =>
                    backedUpKey.publicKey === key.publicKey ||
                    (key.privateKey &&
                      backedUpKey.privateKey === key.privateKey)
                );

                const { expirydate, status } = await getKeyExpiryInfo(
                  openpgpKey,
                  isBackedUp
                );

                const passwordProtected = key.privateKey
                  ? await isPasswordProtected(key.privateKey)
                  : false;

                return {
                  id: key.id,
                  name: key.name,
                  email: key.email,
                  expirydate: expirydate,
                  passwordprotected: passwordProtected ? "Yes" : "No",
                  status: status,
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

  const headerColumns = columns;

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
            className="ms-5 capitalize"
            color={passwordprotectedColorMap[user.passwordprotected]}
            size="sm"
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "backup":
        return (
          <Button
            className="-ms-3"
            color="secondary"
            variant="flat"
            onPress={() => backupKey(user)}
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
      let privateKey = null;
      let isPublicKeyOnly = false;

      // Try loading private key if available
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
              toast.error(`Incorrect Password for ${user.name}'s Keyring`, {
                position: "top-right",
              });
              return;
            }
          }
          privateKey = user.privateKey;
        } catch (e) {
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
          privateKey = null;
        } catch {
          throw new Error("Failed to read both private and public keys.");
        }
      }

      if (!key) {
        throw new Error("No valid PGP key found.");
      }

      let vaultPassword;
      try {
        const storedVaultData = sessionStorage.getItem(
          "encryptedVaultPassword"
        );
        if (!storedVaultData) {
          toast.error(
            "No vault password found in session. Please lock the vault and open again.",
            {
              position: "top-right",
            }
          );
        }

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
        console.warn("Failed to decrypt vault password");
        return;
      }

      const payload = {
        privateKey: privateKey,
        publicKey: user.publicKey,
        vaultPassword,
      };

      const response = await fetch("/api/manage-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      if (response.ok) {
        if (responseData.message === "Key already backed up.") {
          toast.info(
            `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} is already backed up`,
            {
              position: "top-right",
            }
          );
        } else {
          toast.success(
            `${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"} successfully backed up to the cloud!`,
            {
              position: "top-right",
            }
          );

          setUsers((prevUsers) =>
            prevUsers.map((prevUser) => {
              if (prevUser.id === user.id) {
                return {
                  ...prevUser,
                  status: "Backed Up",
                };
              }
              return prevUser;
            })
          );
        }
      } else {
        const errorMessage =
          responseData?.error ||
          `Failed to back up ${user.name}'s ${isPublicKeyOnly ? "Public Key" : "Keyring"}`;
        toast.error(errorMessage, { position: "top-right" });
      }
    } catch (error) {
      console.log(error);
      toast.error(
        `Failed to process ${user.name}'s key. The key is not valid or there was an error.`,
        { position: "top-right" }
      );
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
        } catch (error) {
          toast.error(
            `Incorrect Password for ${user.name}'s Keyring. Please try again.`,
            {
              position: "top-right",
            }
          );
          tryPassword();
        }
      };
      tryPassword();
    });
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
      <ConnectivityCheck/>
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
                  toast.error("Please Enter a Password", {
                    position: "top-right",
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
                toast.error("Please Enter a Password", {
                  position: "top-right",
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
