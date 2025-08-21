"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
  Snippet,
  Autocomplete,
  AutocompleteItem,
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
  updateKeyInIndexeddb,
} from "@/lib/indexeddb";
import { today, getLocalTimeZone, CalendarDate } from "@internationalized/date";
import { NProgressLink } from "@/components/nprogress";
import { PasswordStatus } from "@/context/password-protection";
import KeyServer from "@/components/keyserver";
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

const INITIAL_VISIBLE_COLUMNS_MODAL2 = [
  "name",
  "email",
  "creationdate",
  "expirydate",
  "status",
  "passwordprotected",
  "select",
];

const INITIAL_VISIBLE_COLUMNS_MODAL3 = [
  "name",
  "email",
  "creationdate",
  "expirydate",
  "status",
  "passwordprotected",
];

const INITIAL_VISIBLE_COLUMNS_MODAL4 = [
  "usage",
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
    width: "20%",
    align: "center",
    sortable: true,
  },
  { name: "PRIMARY", uid: "primary", align: "center" },
  { name: "REVOKE", uid: "revoke", align: "center" },
];

const columnsModal2 = [
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
    align: "center",
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
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "SELECT", uid: "select", align: "center" },
];

const columnsModal3 = [
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
    align: "center",
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
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
];

const columnsModal4 = [
  { name: "USAGE", uid: "usage", width: "25%", sortable: true },
  {
    name: "CREATION DATE",
    uid: "creationdate",
    width: "25%",
    sortable: true,
  },
  {
    name: "EXPIRY DATE",
    uid: "expirydate",
    width: "18%",
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
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "ACTIONS", uid: "actions", align: "center" },
];

const keyalgorithms = [
  {
    label: "Curve25519 (EdDSA/ECDH) - Recommended",
    key: "curve25519",
  },
  {
    label: "NIST P-256 (ECDSA/ECDH)",
    key: "nistP256",
  },
  {
    label: "NIST P-521 (ECDSA/ECDH)",
    key: "nistP521",
  },
  {
    label: "Brainpool P-256r1 (ECDSA/ECDH)",
    key: "brainpoolP256r1",
  },
  {
    label: "Brainpool P-512r1 (ECDSA/ECDH)",
    key: "brainpoolP512r1",
  },
  {
    label: "RSA 2048",
    key: "rsa2048",
  },
  {
    label: "RSA 3072",
    key: "rsa3072",
  },
  {
    label: "RSA 4096",
    key: "rsa4096",
  },
];

const parseExpiryToCalendarDate = (expiryStr) => {
  if (
    !expiryStr ||
    expiryStr === "No Expiry" ||
    expiryStr === "Revoked" ||
    expiryStr === "Error"
  )
    return null;
  const [day, monthStr, year] = expiryStr.split("-");
  const monthMap = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
  };
  return new CalendarDate(Number(year), monthMap[monthStr], Number(day));
};

const capitalize = (s) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

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

const processKey = async (key) => {
  const openpgpKey = await openpgp.readKey({ armoredKey: key.publicKey });

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
      if (isRevoked) return { expirydate: "Revoked", status: "revoked" };
      const expirationTime = await key.getExpirationTime();
      const now = new Date();
      if (expirationTime === null || expirationTime === Infinity) {
        return { expirydate: "No Expiry", status: "active" };
      } else if (expirationTime < now) {
        return { expirydate: formatDate(expirationTime), status: "expired" };
      } else {
        return { expirydate: formatDate(expirationTime), status: "active" };
      }
    } catch {
      return { expirydate: "Error", status: "unknown" };
    }
  };

  const userIDs = openpgpKey.getUserIDs();
  const userIdCount = userIDs.length;

  const primaryUser = await openpgpKey.getPrimaryUser();
  const userID = primaryUser.user.userID.userID;

  let name, email;
  const match = userID.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    name = match[1].trim();
    email = match[2].trim();
  } else {
    name = userID.trim();
    email = "N/A";
  }

  const subkeysCount = openpgpKey.getSubkeys().length;

  const creationdate = formatDate(openpgpKey.getCreationTime());
  const { expirydate, status } = await getKeyExpiryInfo(openpgpKey);

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
    status,
    passwordprotected: passwordProtected ? "Yes" : "No",
    keyid,
    fingerprint,
    algorithm,
    avatar: (() => {
      const hasPrivateKey = key.privateKey && key.privateKey.trim() !== "";
      const hasPublicKey = key.publicKey && key.publicKey.trim() !== "";
      if (hasPrivateKey && hasPublicKey) return Keyring.src;
      else if (hasPublicKey) return Public.src;
    })(),
    publicKey: key.publicKey,
    privateKey: key.privateKey,
    userIdCount,
    subkeysCount,
  };
};

const loadKeysFromIndexedDB = async () => {
  const db = await openDB();
  const encryptionKey = await getEncryptionKey();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(dbPgpKeys, "readonly");
    const store = transaction.objectStore(dbPgpKeys);
    let results = [];
    const request = store.openCursor();

    const finish = async () => {
      try {
        const decryptedKeys = await Promise.all(
          results.map((record) =>
            decryptData(record.encrypted, encryptionKey, record.iv)
          )
        );
        const processedKeys = await Promise.all(decryptedKeys.map(processKey));
        resolve(processedKeys.filter((key) => key !== null));
      } catch (err) {
        reject(err);
      }
    };

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        finish();
      }
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
};

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [page, setPage] = useState(1);
  const [filterValueModal, setFilterValueModal] = useState("");
  const [sortDescriptorModal, setSortDescriptorModal] = useState({});
  const [pageModal, setPageModal] = useState(1);
  const [isLoadingModal2, setIsLoadingModal2] = useState(false);
  const [usersModal2, setUsersModal2] = useState([]);
  const [filterValueModal2, setFilterValueModal2] = useState("");
  const [pageModal2, setPageModal2] = useState(1);
  const [sortDescriptorModal2, setSortDescriptorModal2] = useState({});
  const [isLoadingModal3, setIsLoadingModal3] = useState(false);
  const [certificationsModal3, setCertificationsModal3] = useState([]);
  const [filterValueModal3, setFilterValueModal3] = useState("");
  const [pageModal3, setPageModal3] = useState(1);
  const [sortDescriptorModal3, setSortDescriptorModal3] = useState({});
  const [usersModal4, setUsersModal4] = useState([]);
  const [isLoadingModal4, setIsLoadingModal4] = useState(false);
  const [filterValueModal4, setFilterValueModal4] = useState("");
  const [pageModal4, setPageModal4] = useState(1);
  const [sortDescriptorModal4, setSortDescriptorModal4] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedKeyName, setSelectedKeyName] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [validityModal, setvalidityModal] = useState(false);
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
  const [userIDToRevoke, setUserIDToRevoke] = useState(null);
  const [revokeUserIDModal, setrevokeUserIDModal] = useState(false);
  const [addSubkeyModal, setaddSubkeyModal] = useState(false);
  const [manageSubkeyModal, setmanageSubkeyModal] = useState(false);
  const [selectedSubkey, setSelectedSubkey] = useState(null);
  const [subkeyOption, setsubkeyOption] = useState("1");
  const [subkeyGlobalIndex, setsubkeyGlobalIndex] = useState(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("curve25519");
  const [certifyUserModal, setcertifyUserModal] = useState(false);
  const [viewCertificateModal, setviewCertificateModal] = useState(false);
  const [keyServerModal, setkeyServerModal] = useState(false);
  const [keyserverQuery, setKeyserverQuery] = useState("");
  const [keyInput, setKeyInput] = useState("");
  const [revokeModal, setrevokeModal] = useState(false);
  const [revocationReason, setRevocationReason] = useState("0");
  const [revocationReasonText, setRevocationReasonText] = useState("");
  const [revocationReasonModal, setrevocationReasonModal] = useState(false);
  const [revocationInfo, setRevocationInfo] = useState(null);
  const [publishKeyModal, setpublishKeyModal] = useState(false);
  const [publicKeyModal, setpublicKeyModal] = useState(false);
  const [selectedUserPublicKey, setSelectedUserPublicKey] = useState(null);
  const [publicKeySnippet, setPublicKeySnippet] = useState("");
  const [deleteModal, setdeleteModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [revokeUsingCertificateModal, setrevokeUsingCertificateModal] =
    useState(false);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const [visibleColumnsModal2, setVisibleColumnsModal2] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS_MODAL2)
  );
  const [visibleColumnsModal3, setVisibleColumnsModal3] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS_MODAL3)
  );
  const [visibleColumnsModal4, setVisibleColumnsModal4] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS_MODAL4)
  );

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    openDB();
  }, []);

  useEffect(() => {
    const fetchKeys = async () => {
      setIsLoading(true);
      try {
        const pgpKeys = await loadKeysFromIndexedDB();
        setUsers(pgpKeys);
      } catch {}
      setIsLoading(false);
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

  // Auto-focus effects for modals
  useEffect(() => {
    if (passwordModal && passwordInputRef.current) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [passwordModal]);

  useEffect(() => {
    if (newPasswordChangeModal && newPasswordInputRef.current) {
      setTimeout(() => {
        newPasswordInputRef.current?.focus();
      }, 100);
    }
  }, [newPasswordChangeModal]);

  useEffect(() => {
    if (addUserIDModal && nameInputRef.current) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [addUserIDModal]);

  // Refs for auto-focusing inputs in modals
  const passwordInputRef = useRef(null);
  const newPasswordInputRef = useRef(null);
  const nameInputRef = useRef(null);

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
                  <DropdownItem
                    key="change-validity"
                    onPress={() => {
                      setSelectedUserId(user);
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
  };

  const UserActionsDropdownSubkey = ({ subkey }) => {
    const [armoredSubkey, setArmoredSubkey] = useState([]);
    const [isSubkeyProtected, setIsSubkeyProtected] = useState(false);
    const revocationReasonsRef = useRef([]);

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
          const userIDPackets = packetList.filterByTag(
            openpgp.enums.packet.userID
          );
          const userIDSigs = packetList
            .filterByTag(openpgp.enums.packet.signature)
            .filter(
              (sig) =>
                sig.signatureType === openpgp.enums.signature.certPositive
            );

          if (userIDPackets.length === 0 || userIDSigs.length === 0) {
            console.warn(
              "No User IDs or certifications found in the original key."
            );
            return;
          }

          const reasonsMap = {
            0: "Key is Compromised",
            1: "Key is Superseded",
            2: "Key is No Longer Used",
          };

          const allSubkeys = [];
          const allReasons = [];

          const protectionStatuses = subkeys.map(
            (subkey) => !subkey.isDecrypted()
          );

          const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);

          setIsSubkeyProtected(protectionStatuses[subkeyIndex]);

          subkeys.forEach((subkey) => {
            const standalone = new openpgp.PacketList();
            standalone.push(primaryPacket);
            userIDPackets.forEach((uid) => standalone.push(uid));
            userIDSigs.forEach((sig) => standalone.push(sig));
            standalone.push(subkey.keyPacket);
            subkey.bindingSignatures?.forEach((sig) => standalone.push(sig));
            subkey.revocationSignatures?.forEach((sig) => standalone.push(sig));

            let reasonInfo = null;
            for (const sig of subkey.revocationSignatures) {
              if (sig.reasonForRevocationFlag !== undefined) {
                reasonInfo = {
                  code: sig.reasonForRevocationFlag,
                  reason:
                    reasonsMap[sig.reasonForRevocationFlag] || "Unknown reason",
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
            <DropdownItem
              onPress={() => {
                const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);
                setsubkeyGlobalIndex(subkeyIndex);
                backupSubkey(subkey, subkeyIndex, armoredSubkey[subkeyIndex]);
              }}
            >
              Backup Subkey
            </DropdownItem>

            {subkey.status === "revoked" ? null : (
              <DropdownItem
                key="change-subkey-validity"
                onPress={() => {
                  const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);
                  setsubkeyGlobalIndex(subkeyIndex);
                  setSelectedSubkey(armoredSubkey[subkeyIndex]);
                  setvalidityModal(true);
                  if (subkey.expirydate === "No Expiry") {
                    setIsNoExpiryChecked(true);
                    setExpiryDate(null);
                  } else {
                    setIsNoExpiryChecked(false);
                    const [day, month, year] = subkey.expirydate.split("-");
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
                    const date = new Date(year, monthMap[month], parseInt(day));
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

            {subkey.status !== "revoked" &&
              (isSubkeyProtected ? (
                <>
                  <DropdownItem
                    key="change-subkey-password"
                    onPress={() => {
                      const subkeyIndex = parseInt(
                        subkey.id.split("-subkey-")[1]
                      );
                      setsubkeyGlobalIndex(subkeyIndex);
                      addOrChangeSubkeyPassword(subkeyIndex);
                    }}
                  >
                    Change Password
                  </DropdownItem>

                  <DropdownItem
                    key="remove-subkey-password"
                    onPress={() => {
                      const subkeyIndex = parseInt(
                        subkey.id.split("-subkey-")[1]
                      );
                      setsubkeyGlobalIndex(subkeyIndex);
                      RemoveSubkeyPassword(subkeyIndex);
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
                      const subkeyIndex = parseInt(
                        subkey.id.split("-subkey-")[1]
                      );
                      setsubkeyGlobalIndex(subkeyIndex);
                      addOrChangeSubkeyPassword(subkeyIndex);
                    }}
                  >
                    Add Password
                  </DropdownItem>
                </>
              ))}

            {subkey.status === "revoked" ? null : (
              <>
                <DropdownItem
                  key="revoke-subkey"
                  onPress={() => {
                    const subkeyIndex = parseInt(
                      subkey.id.split("-subkey-")[1]
                    );
                    setSelectedSubkey(subkeyIndex);
                    setsubkeyGlobalIndex(subkeyIndex);
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
                  const subkeyIndex = parseInt(subkey.id.split("-subkey-")[1]);
                  setsubkeyGlobalIndex(subkeyIndex);
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
  };

  const filteredItems = useMemo(() => {
    let filteredUsers = [...users];

    if (filterValue) {
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.email.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.creationdate.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.expirydate.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.status.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.passwordprotected
            .toLowerCase()
            .includes(filterValue.toLowerCase()) ||
          user.keyid.toLowerCase().includes(filterValue.toLowerCase()) ||
          user.fingerprint.toLowerCase().includes(filterValue.toLowerCase())
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

  const publishKeyOnServer = async () => {
    try {
      const response = await fetch("/api/keyserver", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicKey: selectedUserId.publicKey,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to publish key on the server.");
      }
      addToast({
        title: `${selectedKeyName}'s Key published successfully`,
        color: "success",
      });
    } catch (error) {
      console.error("Error publishing key:", error);
      addToast({
        title: `Failed to publish ${selectedKeyName}'s key`,
        color: "danger",
      });
    }
  };

  const exportPublicKey = (user) => {
    const keyid = user.keyid.replace(/\s/g, "");
    const publicKey = user.publicKey;
    const blob = new Blob([publicKey], { type: "text/plain" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `${user.name}_0x${keyid}_PUBLIC.asc`;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setPublicKeySnippet(publicKey);
    setpublicKeyModal(true);
  };

  const backupKeyring = async (user) => {
    try {
      const keyid = user.keyid.replace(/\s/g, "");

      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }
      }

      const privateKeyBackup = user.privateKey;
      const blob = new Blob([privateKeyBackup], { type: "text/plain" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${user.name}_0x${keyid}_SECRET.asc`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      addToast({
        title:
          "Failed to read or decrypt. The key is not valid or there was an error processing it",
        color: "danger",
      });
    }
  };

  const backupSubkey = async (subkey, subkeyIndex, armoredSubkey) => {
    try {
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: selectedUserId.privateKey,
      });

      let currentPassword = null;

      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(selectedUserId);

        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      const subkeys = privateKey.getSubkeys();
      const targetSubkey = subkeys[subkeyIndex];

      if (!targetSubkey.isDecrypted()) {
        await triggerSubkeyPasswordModal(targetSubkey);
      }

      const mainkeyid = selectedKeyId.replace(/\s/g, "");
      const keyid = subkey.keyid.replace(/\s/g, "");
      const label =
        subkey.usage.toLowerCase() === "signing" ? "SIGN" : "ENCRYPT";

      const blob = new Blob([armoredSubkey], { type: "text/plain" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${selectedKeyName}_0x${mainkeyid}_SECRET_SUBKEY_0x${keyid}_${label}.asc`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      addToast({
        title: "Failed to process or export the subkey.",
        color: "danger",
      });
    }
  };

  const certifyUserKey = async (certifierUser, targetUser) => {
    try {
      let privateKey = await openpgp.readKey({
        armoredKey: certifierUser.privateKey,
      });

      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(certifierUser);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }
      }

      const theirPub = await openpgp.readKey({
        armoredKey: targetUser.publicKey,
      });

      // Check for existing certification by this signer (using key ID)
      const signerKeyId = privateKey.getKeyIDs()[0].toHex().toLowerCase();

      const existingKeyIds = theirPub.users.flatMap((user) =>
        user.otherCertifications.map((sig) =>
          sig.issuerKeyID.toHex().toLowerCase()
        )
      );

      if (existingKeyIds.includes(signerKeyId)) {
        addToast({
          title: `${targetUser.name}'s Key Already Certified By ${certifierUser.name}'s Key`,
          color: "primary",
        });
        return targetUser.publicKey;
      }

      // Create a key with only the primary key to force primary key signing
      const primaryKeyOnly = await openpgp.readKey({
        armoredKey: privateKey.armor(),
      });

      // Remove all subkeys to force using only the primary key
      // Was signing incorrectly using the last subkey instead of the primary key when multiple subkeys were present in the primary key
      primaryKeyOnly.subkeys = [];

      // Perform the certification using only the primary key
      const certifiedKey = await theirPub.signAllUsers(
        [primaryKeyOnly],
        new Date()
      );

      const updatedArmored = certifiedKey.armor();

      await updateKeyInIndexeddb(targetUser.id, {
        privateKey: targetUser.privateKey,
        publicKey: updatedArmored,
      });

      setcertifyUserModal(false);

      setUsers(await loadKeysFromIndexedDB());

      addToast({
        title: `${targetUser.name}'s Key Successfully Certified By ${certifierUser.name}'s Key`,
        color: "success",
      });

      return updatedArmored;
    } catch (err) {
      console.error("Certification failed:", err);
      addToast({
        title: `Certification Error: ${err.message || err}`,
        color: "danger",
      });
      throw err;
    }
  };

  const getKeyCertifications = async (selectedUser, allKeys) => {
    if (!selectedUser?.publicKey) return [];

    try {
      const pubKey = await openpgp.readKey({
        armoredKey: selectedUser.publicKey,
      });
      const certifications = pubKey.users.flatMap((user) =>
        user.otherCertifications.map((sig) => ({
          issuerKeyID: sig.issuerKeyID.toHex().toUpperCase(),
          fingerprint: sig.issuerFingerprint
            ? Buffer.from(sig.issuerFingerprint).toString("hex").toUpperCase()
            : "",
          creationTime: sig.created,
        }))
      );

      // Remove duplicates by issuerKeyID
      const uniqueCerts = [];
      const seen = new Set();
      for (const cert of certifications) {
        if (!seen.has(cert.issuerKeyID)) {
          uniqueCerts.push(cert);
          seen.add(cert.issuerKeyID);
        }
      }

      return uniqueCerts.map((cert) => {
        const match = allKeys.find(
          (k) => k.keyid.replace(/\s/g, "") === cert.issuerKeyID
        );
        if (match) {
          return { ...match, certificationTime: cert.creationTime };
        } else {
          return {
            id: cert.issuerKeyID,
            name: "Unknown",
            email: "Unknown",
            creationdate: "Unknown",
            expirydate: "Unknown",
            status: "Unknown",
            passwordprotected: "Unknown",
            keyid:
              cert.issuerKeyID.match(/.{1,4}/g)?.join(" ") || cert.issuerKeyID,
            fingerprint: cert.fingerprint
              ? cert.fingerprint.match(/.{1,4}/g)?.join(" ") || cert.fingerprint
              : "Unknown",
            algorithm: "Unknown",
            avatar: Public.src,
            certificationTime: cert.creationTime,
          };
        }
      });
    } catch (e) {
      console.error("Error reading certifications:", e);
      return [];
    }
  };

  const ChangeKeyValidity = async () => {
    if (!selectedUserId) return;
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

      let privateKey = await openpgp.readPrivateKey({
        armoredKey: selectedUserId.privateKey,
      });

      let currentPassword = null;

      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: selectedUserId.publicKey,
      });

      // Preserve revoked user IDs
      const userRevocationMap = new Map();
      fullPublicKey.users.forEach((user) => {
        if (user.userID) {
          userRevocationMap.set(user.userID.userID, {
            isRevoked: user.isRevoked(),
            revocationSignatures: [...user.revocationSignatures],
          });
        }
      });

      // Prepare userIDs array for reformatKey (revoked + active)
      const allUserIDsForReformat = fullPublicKey.users
        .filter((u) => !!u.userID)
        .map((u) => parseUserId(u.userID.userID))
        .map((u) =>
          u.email && u.email !== "N/A"
            ? { name: u.name, email: u.email.trim() }
            : { name: u.name }
        );

      // Preserve revoked subkeys
      const originalSubkeys = privateKey.getSubkeys();
      const subkeyRevocationMap = new Map();
      originalSubkeys.forEach((subkey) => {
        const fingerprint = subkey.getFingerprint();
        subkeyRevocationMap.set(fingerprint, {
          isRevoked: subkey.isRevoked(),
          revocationSignatures: [...subkey.revocationSignatures],
        });
      });

      // Reformat key (updates expiration time)
      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        keyExpirationTime,
        date: new Date(),
        format: "armored",
        userIDs: allUserIDsForReformat,
      });

      // Re‑apply subkey revocations
      let updatedPrivateKey = await openpgp.readPrivateKey({
        armoredKey: updatedKeyPair.privateKey,
      });

      const updatedSubkeys = updatedPrivateKey.getSubkeys();
      for (const subkey of updatedSubkeys) {
        const fingerprint = subkey.getFingerprint();
        const originalData = subkeyRevocationMap.get(fingerprint);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !subkey.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              subkey.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Re‑apply user‑ID revocations
      for (const user of updatedPrivateKey.users) {
        if (!user.userID) continue;
        const uid = user.userID.userID;
        const originalData = userRevocationMap.get(uid);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !user.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              user.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Serialize the modified key
      const restoredKey = updatedPrivateKey.armor();
      const restoredPublicKey = updatedPrivateKey.toPublic().armor();

      // Re-encryption if needed
      let finalPrivateKey = restoredKey;
      if (currentPassword) {
        const reEncrypted = await openpgp.encryptKey({
          privateKey: await openpgp.readPrivateKey({ armoredKey: restoredKey }),
          passphrase: currentPassword,
        });
        finalPrivateKey = reEncrypted.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        finalPrivateKey = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(selectedUserId.id, {
        privateKey: finalPrivateKey,
        publicKey: restoredPublicKey,
      });

      addToast({
        title: "Validity Updated Successfully",
        color: "success",
      });

      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
      setvalidityModal(false);
      setSelectedUserId(null);
    } catch (error) {
      addToast({
        title: "Failed to update validity",
        color: "danger",
      });
      console.error(error);
    }
  };

  const ChangeSubkeyValidity = async (armoredSelectedSubkey) => {
    if (!selectedUserId || !armoredSelectedSubkey) return;

    try {
      const now = new Date();
      let keyExpirationTime;
      if (isNoExpiryChecked || !expiryDate) {
        keyExpirationTime = undefined;
      } else {
        const sel = new Date(expiryDate);
        const expiry = new Date(
          sel.getFullYear(),
          sel.getMonth(),
          sel.getDate() + 1,
          0,
          0,
          0,
          0
        );
        keyExpirationTime = Math.floor((expiry - now) / 1000);
      }

      let privateKey = await openpgp.readPrivateKey({
        armoredKey: selectedUserId.privateKey,
      });

      let currentPassword = null;
      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      // Resolve selected subkey on the primary key
      const subkeyContainer = await openpgp.readKey({
        armoredKey: armoredSelectedSubkey,
      });

      const targetPacket = subkeyContainer.subkeys?.[0]?.keyPacket;
      if (!targetPacket) throw new Error("Invalid subkey data");

      const keyIDhex = targetPacket.getKeyID().toHex();
      const targetSubkey = privateKey.subkeys.find(
        (s) => s.keyPacket.getKeyID().toHex() === keyIDhex
      );
      if (!targetSubkey) throw new Error("Subkey not found on primary key");

      // Gather existing UserIDs (for reformatKey helper)
      const fullPublicKey = await openpgp.readKey({
        armoredKey: selectedUserId.publicKey,
      });

      const existingUserIDs = fullPublicKey
        .getUserIDs()
        .map(parseUserId)
        .map((u) =>
          u.email && u.email !== "N/A"
            ? { name: u.name, email: u.email.trim() }
            : { name: u.name }
        );

      // Build a helper key that contains the desired new expiration
      const { privateKey: helperKey } = await openpgp.reformatKey({
        privateKey,
        userIDs: existingUserIDs,
        keyExpirationTime,
        date: new Date(),
        format: "object",
      });

      // Extract the updated subkey from the helper key
      const updatedSubkey = helperKey.subkeys.find(
        (s) => s.keyPacket.getKeyID().toHex() === keyIDhex
      );
      if (!updatedSubkey) throw new Error("Failed to locate updated subkey");

      // Merge the updated subkey back into the original key
      await targetSubkey.update(updatedSubkey, new Date());

      // Serialize updated keys
      let finalPrivateKey = privateKey.armor();
      const finalPublicKey = privateKey.toPublic().armor();

      // Re‑encrypt if needed
      if (currentPassword) {
        const decryptedKey = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const reEncrypted = await openpgp.encryptKey({
          privateKey: decryptedKey,
          passphrase: currentPassword,
        });
        finalPrivateKey = reEncrypted.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        finalPrivateKey = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(selectedUserId.id, {
        privateKey: finalPrivateKey,
        publicKey: finalPublicKey,
      });

      const refreshed = await loadKeysFromIndexedDB();
      setUsers(refreshed);
      const updatedUser = refreshed.find((u) => u.id === selectedUserId.id);
      if (updatedUser) setSelectedUserId(updatedUser);

      addToast({ title: "Subkey Validity Updated", color: "success" });
      setvalidityModal(false);
      setSelectedSubkey(null);
    } catch (err) {
      console.error(err);
      addToast({ title: "Failed to update subkey validity", color: "danger" });
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

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      setsubkeyGlobalIndex(null);
      const newPassword = await triggernewPasswordChangeModal();

      const updatedKey = await openpgp.encryptKey({
        privateKey,
        passphrase: newPassword,
      });
      let finalPrivateKey = updatedKey.armor();

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        finalPrivateKey = keyToReEncrypt.armor();
      }

      await updateKeyPassword(user.id, finalPrivateKey);

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
    } catch (err) {
      console.error(err);
      addToast({
        title: "Failed to change password",
        color: "danger",
      });
    }
  };

  const triggerSubkeyPasswordModal = async (selectedSubkey) => {
    setPassword("");
    setPasswordModal(true);

    return new Promise((resolve, reject) => {
      const tryPassword = async () => {
        setnewKeyPassword(() => async (pwd) => {
          if (!pwd) {
            setPasswordModal(false);
            setnewKeyPassword(null);
            reject(new Error("Password entry cancelled"));
            return;
          }
          try {
            await selectedSubkey.keyPacket.decrypt(pwd);
            if (!selectedSubkey.isDecrypted()) {
              throw new Error("Incorrect Password");
            }
            setPasswordModal(false);
            setnewKeyPassword(null);
            resolve(pwd);
          } catch {
            addToast({
              title: "Incorrect Password",
              color: "danger",
            });
          }
        });
      };
      tryPassword();
    });
  };

  const addOrChangeSubkeyPassword = async (subkeyIndex) => {
    if (!selectedUserId || subkeyIndex === undefined) {
      return;
    }

    try {
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: selectedUserId.privateKey,
      });

      let ownerPassphrase = null;
      if (!privateKey.isDecrypted()) {
        ownerPassphrase = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: ownerPassphrase,
        });
      }

      const subkeys = privateKey.getSubkeys();
      const selectedSubkey = subkeys[subkeyIndex];

      if (!selectedSubkey) {
        throw new Error("Subkey not found");
      }

      const isEncrypted = !selectedSubkey.isDecrypted();
      let currentSubkeyPassphrase = null;

      if (isEncrypted) {
        try {
          currentSubkeyPassphrase =
            await triggerSubkeyPasswordModal(selectedSubkey);
        } catch {
          return;
        }
      }

      const newPassphrase = await triggernewPasswordChangeModal();
      let targetSubkey = subkeys[subkeyIndex];
      await targetSubkey.keyPacket.encrypt(newPassphrase);

      // Serialize the modified key
      let finalPrivate = privateKey.armor();
      const finalPublic = privateKey.toPublic().armor();

      // Re-encryption if needed
      if (ownerPassphrase !== null) {
        const reProtected = await openpgp.encryptKey({
          privateKey,
          passphrase: ownerPassphrase,
        });
        finalPrivate = reProtected.armor();
      }

      await updateKeyInIndexeddb(selectedUserId.id, {
        privateKey: finalPrivate,
        publicKey: finalPublic,
      });

      const refreshed = await loadKeysFromIndexedDB();
      setUsers(refreshed);

      const updated = refreshed.find((u) => u.id === selectedUserId.id);
      if (updated) setSelectedUserId(updated);

      if (ownerPassphrase === null) {
        addToast({
          title:
            currentSubkeyPassphrase === null
              ? "Subkey Password Added Successfully"
              : "Subkey Password Changed Successfully",
          color: "success",
        });
      }

      if (ownerPassphrase !== null) {
        addToast({
          title:
            "The primary key is already password-protected, so subkey passwords cannot differ from the primary passphrase.",
          color: "warning",
        });
      }

      setSelectedSubkey(null);
      setsubkeyGlobalIndex(null);
    } catch (err) {
      console.error("Error in addOrChangeSubkeyPassword:", err);
      addToast({
        title: "Failed To Change Subkey Password",
        color: "danger",
      });
    }
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

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      let finalPrivateKey = privateKey.armor();

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        finalPrivateKey = keyToReEncrypt.armor();
      }

      await updateKeyPassword(selectedUserId.id, finalPrivateKey);

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
    setremovePasswordModal(false);
  };

  const RemoveSubkeyPassword = async (subkeyIndex) => {
    if (!selectedUserId || subkeyIndex === undefined) {
      return;
    }

    try {
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: selectedUserId.privateKey,
      });

      let ownerPassphrase = null;
      if (!privateKey.isDecrypted()) {
        ownerPassphrase = await triggerKeyPasswordModal(selectedUserId);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: ownerPassphrase,
        });
      }

      const subkeys = privateKey.getSubkeys();
      const selectedSubkey = subkeys[subkeyIndex];

      if (!selectedSubkey) {
        throw new Error("Subkey not found");
      }

      const isEncrypted = !selectedSubkey.isDecrypted();
      let currentSubkeyPassphrase = null;

      if (isEncrypted) {
        try {
          currentSubkeyPassphrase =
            await triggerSubkeyPasswordModal(selectedSubkey);
        } catch {
          return;
        }
      }

      // Ensure the target subkey is decrypted
      let targetSubkey = subkeys[subkeyIndex];
      if (!targetSubkey.isDecrypted() && currentSubkeyPassphrase) {
        await targetSubkey.keyPacket.decrypt(currentSubkeyPassphrase);
      }

      // Serialize the modified key
      let finalPrivate = privateKey.armor();
      const finalPublic = privateKey.toPublic().armor();

      // Re-encryption if needed
      if (ownerPassphrase !== null) {
        const reparsed = await openpgp.readPrivateKey({
          armoredKey: finalPrivate,
        });
        const reProtected = await openpgp.encryptKey({
          privateKey: reparsed,
          passphrase: ownerPassphrase,
        });
        finalPrivate = reProtected.armor();
      }

      await updateKeyInIndexeddb(selectedUserId.id, {
        privateKey: finalPrivate,
        publicKey: finalPublic,
      });

      const refreshed = await loadKeysFromIndexedDB();
      setUsers(refreshed);

      const updated = refreshed.find((u) => u.id === selectedUserId.id);
      if (updated) setSelectedUserId(updated);

      if (ownerPassphrase === null) {
        addToast({
          title: "Subkey Password removed successfully",
          color: "success",
        });
      }

      if (ownerPassphrase !== null) {
        addToast({
          title:
            "The primary key is already password-protected, so subkey passwords cannot be removed.",
          color: "warning",
        });
      }

      setSelectedSubkey(null);
      setsubkeyGlobalIndex(null);
    } catch {
      addToast({
        title: "Failed To Remove Subkey Password",
        color: "danger",
      });
    }
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

        const totalPages = Math.ceil(refreshedKeys.length / rowsPerPage);
        if (page > totalPages) {
          setPage(Math.max(1, totalPages));
        }
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
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: user.privateKey,
      });
      let currentPassword = null;

      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: user.publicKey,
      });

      // Preserve revoked user IDs
      const userRevocationMap = new Map();
      fullPublicKey.users.forEach((user) => {
        if (user.userID) {
          userRevocationMap.set(user.userID.userID, {
            isRevoked: user.isRevoked(),
            revocationSignatures: [...user.revocationSignatures],
          });
        }
      });

      // Preserve subkey revocations
      const originalSubkeys = privateKey.getSubkeys();
      const subkeyRevocationMap = new Map();
      originalSubkeys.forEach((subkey) => {
        const fingerprint = subkey.getFingerprint();
        subkeyRevocationMap.set(fingerprint, {
          isRevoked: subkey.isRevoked(),
          revocationSignatures: [...subkey.revocationSignatures],
        });
      });

      const currentUserIDs = fullPublicKey.getUserIDs();

      const parseUserId = (uid) => {
        const match = uid.match(/^(.*?)\s*<(.+?)>$/);
        return match
          ? { name: match[1].trim(), email: match[2].trim() }
          : { name: uid.trim() };
      };

      const formattedUserIDs = currentUserIDs.map(parseUserId);

      const newUserID = validEmail
        ? { name: name.trim(), email: validEmail }
        : { name: name.trim() };

      const updatedUserIDs = [...formattedUserIDs, newUserID];

      const creationTime = privateKey.getCreationTime();
      const expirationTime = await privateKey.getExpirationTime();
      const expirationSeconds = expirationTime
        ? Math.floor((expirationTime - creationTime) / 1000)
        : undefined;

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        userIDs: updatedUserIDs,
        date: creationTime,
        keyExpirationTime: expirationSeconds,
        format: "armored",
      });

      let updatedPrivateKey = await openpgp.readPrivateKey({
        armoredKey: updatedKeyPair.privateKey,
      });

      // Re-apply subkey revocations
      const updatedSubkeys = updatedPrivateKey.getSubkeys();
      for (const subkey of updatedSubkeys) {
        const fingerprint = subkey.getFingerprint();
        const originalData = subkeyRevocationMap.get(fingerprint);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !subkey.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              subkey.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Re-apply user-ID revocations
      for (const user of updatedPrivateKey.users) {
        if (!user.userID) continue;
        const uid = user.userID.userID;
        const originalData = userRevocationMap.get(uid);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !user.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              user.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Re-encrypt if needed
      if (currentPassword) {
        const reEncrypted = await openpgp.encryptKey({
          privateKey: updatedPrivateKey,
          passphrase: currentPassword,
        });
        updatedKeyPair.privateKey = reEncrypted.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: updatedKeyPair.privateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        updatedKeyPair.privateKey = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(user.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedPrivateKey.toPublic().armor(),
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

      const publicKey = await openpgp.readKey({
        armoredKey: currentUserObj.publicKey,
      });

      // Preserve revoked user IDs
      const userRevocationMap = new Map();
      publicKey.users.forEach((user) => {
        if (user.userID) {
          userRevocationMap.set(user.userID.userID, {
            isRevoked: user.isRevoked(),
            revocationSignatures: [...user.revocationSignatures],
          });
        }
      });

      // Parse all user IDs
      const freshUserIDs = publicKey.getUserIDs().map(parseUserId);
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

      let privateKey = await openpgp.readPrivateKey({
        armoredKey: currentUserObj.privateKey,
      });

      let currentPassword = null;
      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      // Preserve subkey revocations
      const originalSubkeys = privateKey.getSubkeys();
      const subkeyRevocationMap = new Map();
      originalSubkeys.forEach((subkey) => {
        const fingerprint = subkey.getFingerprint();
        subkeyRevocationMap.set(fingerprint, {
          isRevoked: subkey.isRevoked(),
          revocationSignatures: [...subkey.revocationSignatures],
        });
      });

      const currentUserIDs = publicKey.getUserIDs().map(parseUserId);
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

      const creationTime = privateKey.getCreationTime();
      const expirationTime = await privateKey.getExpirationTime();
      const expirationSeconds = expirationTime
        ? Math.floor((expirationTime - creationTime) / 1000)
        : undefined;

      const updatedKeyPair = await openpgp.reformatKey({
        privateKey,
        userIDs: reorderedUserIDs,
        date: creationTime,
        keyExpirationTime: expirationSeconds,
        format: "armored",
      });

      let updatedPrivateKey = await openpgp.readPrivateKey({
        armoredKey: updatedKeyPair.privateKey,
      });

      // Re-apply subkey revocations
      const updatedSubkeys = updatedPrivateKey.getSubkeys();
      for (const subkey of updatedSubkeys) {
        const fingerprint = subkey.getFingerprint();
        const originalData = subkeyRevocationMap.get(fingerprint);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !subkey.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              subkey.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Re-apply user-ID revocations
      for (const user of updatedPrivateKey.users) {
        if (!user.userID) continue;
        const uid = user.userID.userID;
        const originalData = userRevocationMap.get(uid);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !user.revocationSignatures.some((existingSig) =>
                existingSig.equals(sig)
              )
            ) {
              user.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Re-encrypt if needed
      if (currentPassword) {
        const reEncrypted = await openpgp.encryptKey({
          privateKey: updatedPrivateKey,
          passphrase: currentPassword,
        });
        updatedKeyPair.privateKey = reEncrypted.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: updatedKeyPair.privateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        updatedKeyPair.privateKey = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(user.id, {
        privateKey: updatedKeyPair.privateKey,
        publicKey: updatedPrivateKey.toPublic().armor(),
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

  const revokeUserID = async (user, targetUserIDObj) => {
    try {
      const refreshedStart = await loadKeysFromIndexedDB();
      const currentUserObj = refreshedStart.find((u) => u.id === user.id);
      if (!currentUserObj) throw new Error("User not found in IndexedDB");

      let privateKey = await openpgp.readPrivateKey({
        armoredKey: currentUserObj.privateKey,
      });

      let currentPassword = null;

      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      // Locate the target User ID on the key
      const targetUser = privateKey.users.find((u) => {
        if (!u.userID) return false;
        const parsed = parseUserId(u.userID.userID);
        return parsed.id === targetUserIDObj.id;
      });
      if (!targetUser) throw new Error("Target user ID not found on key");

      // Revoke the User ID
      const revokedUser = await targetUser.revoke(privateKey.keyPacket);
      const idx = privateKey.users.indexOf(targetUser);
      if (idx !== -1) privateKey.users[idx] = revokedUser;

      // Get updated armored keys
      let updatedPrivateKeyArmored = privateKey.armor();
      const updatedPublicKeyArmored = privateKey.toPublic().armor();

      // Re-encrypt if needed
      if (currentPassword) {
        const reEncryptedKey = await openpgp.encryptKey({
          privateKey,
          passphrase: currentPassword,
        });
        updatedPrivateKeyArmored = reEncryptedKey.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: updatedPrivateKeyArmored,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        updatedPrivateKeyArmored = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(user.id, {
        privateKey: updatedPrivateKeyArmored,
        publicKey: updatedPublicKeyArmored,
      });

      addToast({
        title: "User ID revoked successfully",
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
        title: "Failed to revoke User ID",
        color: "danger",
      });
    }
  };

  const triggerRevokeUserIDModal = (user, targetUserIDObj) => {
    setSelectedUserId(user);
    setSelectedKeyName(user.name);
    setUserIDToRevoke(targetUserIDObj);
    setrevokeUserIDModal(true);
  };

  const addSubkey = async (user) => {
    if (!user || !user.privateKey) return;

    try {
      let privateKey = await openpgp.readPrivateKey({
        armoredKey: user.privateKey,
      });
      let currentPassword = null;

      if (!privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
      }

      // Preserve subkey revocations BEFORE modification
      const originalSubkeys = privateKey.getSubkeys();
      const subkeyRevocationMap = new Map();
      originalSubkeys.forEach((subkey) => {
        const fingerprint = subkey.getFingerprint();
        subkeyRevocationMap.set(fingerprint, {
          isRevoked: subkey.isRevoked(),
          revocationSignatures: [...subkey.revocationSignatures],
        });
      });

      const opt = String(subkeyOption);
      const isSign = opt === "0";
      const isEncrypt = opt === "1";

      let subkeyOpts = {
        date: new Date(),
        sign: isSign,
        encrypt: isEncrypt,
      };

      if (!isNoExpiryChecked && expiryDate) {
        const now = Date.now();
        const sel = new Date(expiryDate);
        const midnightAfter = new Date(
          sel.getFullYear(),
          sel.getMonth(),
          sel.getDate() + 1
        ).getTime();
        subkeyOpts.keyExpirationTime = Math.floor((midnightAfter - now) / 1000);
      }

      if (selectedAlgorithm.startsWith("rsa")) {
        subkeyOpts.type = "rsa";
        subkeyOpts.rsaBits = parseInt(selectedAlgorithm.replace("rsa", ""), 10);
      } else if (selectedAlgorithm === "curve25519") {
        subkeyOpts.type = "ecc";
        subkeyOpts.curve = "curve25519Legacy";
      } else if (selectedAlgorithm === "ed25519") {
        subkeyOpts.type = "ecc";
        subkeyOpts.curve = "ed25519Legacy";
      } else {
        subkeyOpts.type = "ecc";
        subkeyOpts.curve = selectedAlgorithm;
      }

      privateKey = await privateKey.addSubkey(subkeyOpts);

      // Re-apply subkey revocations
      const updatedSubkeys = privateKey.getSubkeys();
      for (const subkey of updatedSubkeys) {
        const fingerprint = subkey.getFingerprint();
        const originalData = subkeyRevocationMap.get(fingerprint);
        if (originalData?.isRevoked) {
          originalData.revocationSignatures.forEach((sig) => {
            if (
              !subkey.revocationSignatures.some(
                (existingSig) =>
                  JSON.stringify(existingSig) === JSON.stringify(sig)
              )
            ) {
              subkey.revocationSignatures.push(sig);
            }
          });
        }
      }

      // Serialize the modified key
      let updatedPrivateArmored = privateKey.armor();
      let updatedPublicArmored = privateKey.toPublic().armor();

      // Re-encrypt if needed
      if (currentPassword) {
        const decryptedKey = await openpgp.readPrivateKey({
          armoredKey: updatedPrivateArmored,
        });
        const reEncryptedKey = await openpgp.encryptKey({
          privateKey: decryptedKey,
          passphrase: currentPassword,
        });
        updatedPrivateArmored = reEncryptedKey.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: updatedPrivateArmored,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        updatedPrivateArmored = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(user.id, {
        privateKey: updatedPrivateArmored,
        publicKey: updatedPublicArmored,
      });

      addToast({ title: "Subkey added successfully", color: "success" });
      setaddSubkeyModal(false);
      setUsers(await loadKeysFromIndexedDB());
    } catch (err) {
      console.error(err);
      addToast({ title: "Failed to add subkey", color: "danger" });
    }
  };

  const manageSubkeys = async (user) => {
    if (!user || !user.privateKey) return [];

    try {
      const privateKey = await openpgp.readPrivateKey({
        armoredKey: user.privateKey,
      });

      const formatDate = (isoDate) => {
        const date = new Date(isoDate);
        if (!(date instanceof Date) || isNaN(date.getTime())) return "Unknown";
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

      const getSubkeyExpiryInfo = async (subkey) => {
        try {
          const isRevoked = await subkey.isRevoked();
          if (isRevoked) return { expirydate: "Revoked", status: "revoked" };

          const expirationTime = await subkey.getExpirationTime();
          const now = new Date();

          if (!expirationTime || expirationTime === Infinity) {
            return { expirydate: "No Expiry", status: "active" };
          } else if (expirationTime < now) {
            return {
              expirydate: formatDate(expirationTime),
              status: "expired",
            };
          } else {
            return { expirydate: formatDate(expirationTime), status: "active" };
          }
        } catch {
          return { expirydate: "Error", status: "unknown" };
        }
      };

      const getSubkeyUsage = (subkey) => {
        const usage = [];
        for (const sig of subkey.bindingSignatures) {
          const flagsArray = sig.keyFlags || sig.parsedKeyFlags || [];
          for (const f of flagsArray) {
            if (f & openpgp.enums.keyFlags.signData) usage.push("Signing");
            if (
              f &
              (openpgp.enums.keyFlags.encryptCommunication |
                openpgp.enums.keyFlags.encryptStorage)
            ) {
              usage.push("Encryption");
            }
          }
        }
        return [...new Set(usage)].join(", ") || "Unknown";
      };

      const privateSubs = privateKey.getSubkeys();

      const subkeyInfos = await Promise.all(
        privateSubs.map(async (subkey, idx) => {
          const algoInfo = subkey.getAlgorithmInfo();
          const { expirydate, status } = await getSubkeyExpiryInfo(subkey);
          const isEncrypted = !subkey.isDecrypted();

          return {
            id: `${user.id}-subkey-${idx}`,
            name: user.name,
            email: user.email,
            creationdate: formatDate(subkey.getCreationTime()),
            expirydate,
            status,
            passwordprotected: isEncrypted ? "Yes" : "No",
            usage: getSubkeyUsage(subkey),
            keyid: subkey
              .getKeyID()
              .toHex()
              .toUpperCase()
              .match(/.{1,4}/g)
              .join(" "),
            fingerprint: subkey
              .getFingerprint()
              .toUpperCase()
              .match(/.{1,4}/g)
              .join(" "),
            algorithm: (() => {
              const labelMap = {
                curve25519: "Curve25519 (EdDSA/ECDH)",
                nistP256: "NIST P-256 (ECDSA/ECDH)",
                nistP521: "NIST P-521 (ECDSA/ECDH)",
                brainpoolP256r1: "Brainpool P-256r1 (ECDSA/ECDH)",
                brainpoolP512r1: "Brainpool P-512r1 (ECDSA/ECDH)",
              };
              if (
                ["eddsa", "ecdh", "eddsaLegacy", "curve25519"].includes(
                  algoInfo.algorithm
                )
              )
                return labelMap.curve25519;
              if (algoInfo.curve && labelMap[algoInfo.curve])
                return labelMap[algoInfo.curve];
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
              return algoInfo.algorithm || "Unknown";
            })(),
            avatar: Keyring.src,
          };
        })
      );

      return subkeyInfos;
    } catch (e) {
      console.error("Error extracting subkeys:", e);
      return [];
    }
  };

  const GenerateRevocationCertificate = async (user) => {
    try {
      let privateKey = await openpgp.readKey({
        armoredKey: user.privateKey,
      });
      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        const currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }
      }

      const fullPublicKey = await openpgp.readKey({
        armoredKey: user.publicKey,
      });

      const currentUserIDs = fullPublicKey.getUserIDs();

      const parseUserId = (uid) => {
        const match = uid.match(/^(.*?)\s*<(.+?)>$/);
        return match
          ? { name: match[1].trim(), email: match[2].trim() }
          : { name: uid.trim() };
      };

      const formattedUserIDs = currentUserIDs.map(parseUserId);

      const { revocationCertificate } = await openpgp.reformatKey({
        privateKey,
        userIDs: formattedUserIDs,
        format: "armored",
      });

      const keyid = user.keyid.replace(/\s/g, "");
      const blob = new Blob([revocationCertificate], { type: "text/plain" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${user.name}_0x${keyid}_REVOCATION_CERTIFICATE.asc`;
      link.click();
      URL.revokeObjectURL(objectUrl);

      addToast({
        title: "Revocation Certificate Generated",
        color: "success",
      });
    } catch {
      addToast({
        title: "Failed to generate revocation certificate",
        color: "danger",
      });
    }
  };

  const handleFileInput = (event) => {
    const files = event.target.files;
    if (files) {
      const newContents = [];
      let processedFiles = 0;
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          newContents.push(e.target.result);
          processedFiles++;
          if (processedFiles === files.length) {
            if (files.length === 1) {
              setKeyInput(newContents[0]);
            }
          }
        };
        reader.readAsText(file);
      });
    }
  };

  const RevokeUsingCertificate = async (user, revocationCertificate) => {
    setKeyInput("");
    try {
      // If we have a private key, handle all password and subkey logic
      if (user.privateKey && user.privateKey.trim()) {
        let privateKey = await openpgp.readKey({
          armoredKey: user.privateKey,
        });

        let currentPassword = null;

        if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
          currentPassword = await triggerKeyPasswordModal(user);
          privateKey = await openpgp.decryptKey({
            privateKey,
            passphrase: currentPassword,
          });
        }

        // Decrypt all encrypted subkeys
        const subkeys = privateKey.getSubkeys();
        const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

        let primaryPassword;
        const triedPasswords = new Set();

        // Prime it with the primary key password
        if (primaryPassword) {
          triedPasswords.add(primaryPassword);
        }

        for (let i = 0; i < subkeys.length; i++) {
          const subkey = subkeys[i];
          if (await subkey.isRevoked()) continue;
          if (subkey.isDecrypted()) continue; // top‑level guard

          setsubkeyGlobalIndex(i);
          let subkeyPass = null;

          // Try every password we've already got cached
          for (const pass of triedPasswords) {
            if (subkey.isDecrypted()) break;
            try {
              if (!subkey.isDecrypted()) {
                await subkey.keyPacket.decrypt(pass);
              }
              subkeyPass = pass;
              break;
            } catch (err) {
              // if it's "already decrypted", treat as success
              if (/already decrypted/i.test(err.message)) {
                subkeyPass = pass;
                break;
              }
            }
          }

          // If we still haven't unlocked, prompt the user
          if (!subkeyPass) {
            try {
              const pass = await triggerSubkeyPasswordModal(subkey);
              triedPasswords.add(pass);

              if (!subkey.isDecrypted()) {
                await subkey.keyPacket.decrypt(pass);
              }
              subkeyPass = pass;
            } catch (err) {
              addToast({
                title: "Failed to decrypt subkey",
                color: "danger",
              });
              console.error(`Failed to decrypt subkey ${i}:`, err);
              return;
            }
          }

          // Store the passphrase we ended up using
          subkeyPassphrases.set(i, subkeyPass);
        }

        // Now revoke the key using the certificate
        const revokedKey = await openpgp.revokeKey({
          key: privateKey,
          format: "armored",
          revocationCertificate,
          date: new Date(),
        });

        // Read the revoked key and perform all operations on it
        const revokedPrivateKeyObj = await openpgp.readPrivateKey({
          armoredKey: revokedKey.privateKey,
        });

        // Serialize the revoked private and public key
        let finalPrivateKey = revokedPrivateKeyObj.armor();
        const finalPublicKey = revokedPrivateKeyObj.toPublic().armor();

        // Re-encryption if needed
        if (currentPassword) {
          const reEncrypted = await openpgp.encryptKey({
            privateKey: revokedPrivateKeyObj,
            passphrase: currentPassword,
          });
          finalPrivateKey = reEncrypted.armor();
        }

        // Re-encrypt subkeys with their respective passwords
        if (subkeyPassphrases.size > 0) {
          const keyToReEncrypt = await openpgp.readPrivateKey({
            armoredKey: finalPrivateKey,
          });
          const subkeys = keyToReEncrypt.getSubkeys();

          for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
            if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
              await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
            }
          }

          finalPrivateKey = keyToReEncrypt.armor();
        }

        await updateKeyInIndexeddb(user.id, {
          privateKey: finalPrivateKey,
          publicKey: finalPublicKey,
        });

        const keyid = user.keyid.replace(/\s/g, "");
        const blob = new Blob([finalPublicKey], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`;
        link.click();
        URL.revokeObjectURL(url);

        addToast({
          title: "Key Revoked",
          description:
            "Both public and private keys have been updated with the revocation signature.",
          color: "success",
        });
      } else {
        // Only public key: just revoke and update
        const publicKey = await openpgp.readKey({ armoredKey: user.publicKey });

        const revokedKey = await openpgp.revokeKey({
          key: publicKey,
          format: "armored",
          revocationCertificate,
          date: new Date(),
        });

        await updateKeyInIndexeddb(user.id, {
          publicKey: revokedKey.publicKey,
        });

        const keyid = user.keyid.replace(/\s/g, "");
        const blob = new Blob([revokedKey.publicKey], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${user.name}_0x${keyid}_REVOKED_PUBLIC_KEY.asc`;
        link.click();
        URL.revokeObjectURL(url);

        addToast({
          title: "Public Key Revoked",
          description:
            "Your public key has been updated with the revocation signature.",
          color: "success",
        });
      }

      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);
    } catch (error) {
      addToast({
        title: "Revocation Failed",
        description: error.message || "An unexpected error occurred.",
        color: "danger",
      });
    }
  };

  const revokeKey = async (user) => {
    setRevocationReasonText("");
    try {
      let privateKey = await openpgp.readKey({ armoredKey: user.privateKey });

      let currentPassword = null;

      if (privateKey.isPrivate() && !privateKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(user);
        privateKey = await openpgp.decryptKey({
          privateKey,
          passphrase: currentPassword,
        });
      }

      // Decrypt all encrypted subkeys
      const subkeys = privateKey.getSubkeys();
      const subkeyPassphrases = new Map(); // Store subkey passphrases for re-encryption

      let primaryPassword;
      const triedPasswords = new Set();

      // Prime it with the primary key password
      if (primaryPassword) {
        triedPasswords.add(primaryPassword);
      }

      for (let i = 0; i < subkeys.length; i++) {
        const subkey = subkeys[i];
        if (await subkey.isRevoked()) continue;
        if (subkey.isDecrypted()) continue; // top‑level guard

        setsubkeyGlobalIndex(i);
        let subkeyPass = null;

        // Try every password we've already got cached
        for (const pass of triedPasswords) {
          if (subkey.isDecrypted()) break;
          try {
            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
            break;
          } catch (err) {
            // if it's "already decrypted", treat as success
            if (/already decrypted/i.test(err.message)) {
              subkeyPass = pass;
              break;
            }
            // else wrong pass, keep going
          }
        }

        // If we still haven't unlocked, prompt the user
        if (!subkeyPass) {
          try {
            const pass = await triggerSubkeyPasswordModal(subkey);
            triedPasswords.add(pass);

            if (!subkey.isDecrypted()) {
              await subkey.keyPacket.decrypt(pass);
            }
            subkeyPass = pass;
          } catch (err) {
            addToast({
              title: "Failed to decrypt subkey",
              color: "danger",
            });
            console.error(`Failed to decrypt subkey ${i}:`, err);
            return;
          }
        }

        // Store the passphrase we ended up using
        subkeyPassphrases.set(i, subkeyPass);
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

      // Read the revoked key and perform all operations on it
      const revokedPrivateKeyObj = await openpgp.readPrivateKey({
        armoredKey: revokedKey.privateKey,
      });

      // Serialize the revoked private and public key
      let finalPrivateKey = revokedPrivateKeyObj.armor();
      const finalPublicKey = revokedPrivateKeyObj.toPublic().armor();

      // Re-encryption if needed
      if (currentPassword) {
        const reEncrypted = await openpgp.encryptKey({
          privateKey: revokedPrivateKeyObj,
          passphrase: currentPassword,
        });
        finalPrivateKey = reEncrypted.armor();
      }

      // Re-encrypt subkeys with their respective passwords
      if (subkeyPassphrases.size > 0) {
        const keyToReEncrypt = await openpgp.readPrivateKey({
          armoredKey: finalPrivateKey,
        });
        const subkeys = keyToReEncrypt.getSubkeys();

        for (const [subkeyIndex, passphrase] of subkeyPassphrases) {
          if (subkeys[subkeyIndex] && subkeys[subkeyIndex].isDecrypted()) {
            await subkeys[subkeyIndex].keyPacket.encrypt(passphrase);
          }
        }

        finalPrivateKey = keyToReEncrypt.armor();
      }

      await updateKeyInIndexeddb(user.id, {
        privateKey: finalPrivateKey,
        publicKey: finalPublicKey,
      });

      const keyid = user.keyid.replace(/\s/g, "");
      const blob = new Blob([revokedKey.publicKey], { type: "text/plain" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${user.name}_0x${keyid}_PUBLIC_REVOKED.asc`;
      link.click();
      URL.revokeObjectURL(objectUrl);

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

  const revokeSubkey = async (subkeyIndex) => {
    setRevocationReasonText("");
    try {
      let primaryKey = await openpgp.readKey({
        armoredKey: selectedUserId.privateKey,
      });
      let currentPassword = null;
      if (primaryKey.isPrivate() && !primaryKey.isDecrypted()) {
        currentPassword = await triggerKeyPasswordModal(selectedUserId);
        primaryKey = await openpgp.decryptKey({
          privateKey: primaryKey,
          passphrase: currentPassword,
        });
      }

      const subkeys = primaryKey.getSubkeys();
      const selectedSubkey = subkeys[subkeyIndex];

      if (!selectedSubkey) {
        throw new Error("Subkey not found");
      }

      const isEncrypted = !selectedSubkey.isDecrypted();
      let currentSubkeyPassphrase = null;

      if (isEncrypted) {
        try {
          currentSubkeyPassphrase =
            await triggerSubkeyPasswordModal(selectedSubkey);
        } catch {
          return;
        }
      }

      // Ensure the target subkey is decrypted
      let targetSubkey = subkeys[subkeyIndex];
      if (!targetSubkey.isDecrypted() && currentSubkeyPassphrase) {
        await targetSubkey.keyPacket.decrypt(currentSubkeyPassphrase);
      }

      const revokedSubkey = await targetSubkey.revoke(
        primaryKey.keyPacket,
        {
          flag: parseInt(revocationReason),
          string: revocationReasonText || undefined,
        },
        new Date()
      );

      await targetSubkey.update(revokedSubkey);

      // Re-encrypt the subkey if it was originally encrypted
      if (isEncrypted && currentSubkeyPassphrase) {
        await targetSubkey.keyPacket.encrypt(currentSubkeyPassphrase);
      }

      // Re‑armor both private and public full keys
      let newPrivateArmored = primaryKey.armor();
      let newPublicArmored = primaryKey.toPublic().armor();

      // Re-encryption if needed
      if (currentPassword !== null) {
        const reProtected = await openpgp.encryptKey({
          privateKey: primaryKey,
          passphrase: currentPassword,
        });
        newPrivateArmored = reProtected.armor();
      }

      await updateKeyInIndexeddb(selectedUserId.id, {
        privateKey: newPrivateArmored,
        publicKey: newPublicArmored,
      });

      const refreshedKeys = await loadKeysFromIndexedDB();
      setUsers(refreshedKeys);

      const updated = refreshedKeys.find((u) => u.id === selectedUserId.id);
      if (updated) setSelectedUserId(updated);

      addToast({ title: "Subkey Revoked Successfully", color: "success" });
    } catch (error) {
      console.error(error);
      addToast({ title: "Failed to revoke subkey", color: "danger" });
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

  useEffect(() => {
    const storedRowsPerPage = localStorage.getItem("rowsPerPage");
    if (storedRowsPerPage) {
      setRowsPerPage(Number(storedRowsPerPage));
    }
  }, []);

  const onRowsPerPageChange = useCallback((e) => {
    const selectedRowsPerPage = Number(e.target.value);
    setRowsPerPage(selectedRowsPerPage);
    setPage(1);
    localStorage.setItem("rowsPerPage", selectedRowsPerPage);
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
        <h1 className="text-center text-4xl font-serif">Manage Keyrings</h1>
        <br />
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[100%]"
            placeholder="Search all fields (name, email, dates, status, key ID, fingerprint, etc.)"
            startContent={<SearchIcon />}
            value={filterValue}
            onClear={() => onClear()}
            onValueChange={onSearchChange}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={<ChevronDownIcon className="text-small" />}
                variant="faded"
                className="border-0"
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
              value={rowsPerPage}
              onChange={onRowsPerPageChange}
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
              <option value="40">40</option>
              <option value="50">50</option>
            </select>
          </label>
        </div>
      </div>
    );
  }, [
    filterValue,
    onRowsPerPageChange,
    rowsPerPage,
    users.length,
    visibleColumns,
    onSearchChange,
    hasSearchFilter,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="px-2 flex justify-between items-center py-2 sm:py-12 flex-col sm:flex-row gap-2 sm:gap-0">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={page}
          total={pages}
          onChange={setPage}
        />
        <div className="w-full flex justify-center mt-3 sm:mt-0 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:w-auto">
          <PasswordStatus />
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
        const refreshedUserIDs =
          await getUserIDsFromKeyForModal(selectedUserId);
        setModalUserIDs(refreshedUserIDs);
      })();
    }
  }, [manageUserIDsModal, selectedUserId]);

  const filteredItemsModal = useMemo(() => {
    let filtered = [...modalUserIDs];
    if (Boolean(filterValueModal)) {
      filtered = filtered.filter(
        (user) =>
          user.name.toLowerCase().includes(filterValueModal.toLowerCase()) ||
          user.email.toLowerCase().includes(filterValueModal.toLowerCase())
      );
    }
    return filtered;
  }, [modalUserIDs, filterValueModal]);

  const pagesModal = Math.ceil(filteredItemsModal.length / 5) || 1;

  const itemsModal = useMemo(() => {
    const start = (pageModal - 1) * 5;
    const end = start + 5;
    return filteredItemsModal.slice(start, end);
  }, [pageModal, filteredItemsModal]);

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
        case "revoke":
          return !selectedUserId.privateKey ? (
            <Button
              isDisabled={true}
              className="ms-2"
              color="danger"
              variant="flat"
            >
              Revoke
            </Button>
          ) : (
            <Button
              isDisabled={modalUserIDs.length === 1}
              className="ms-2"
              color="danger"
              variant="flat"
              onPress={() => triggerRevokeUserIDModal(selectedUserId, row)}
            >
              Revoke
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
            placeholder="Search by name or email..."
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
        </div>
      </div>
    );
  }, [
    filterValueModal,
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

  // Certification Modal Table

  useEffect(() => {
    if (!certifyUserModal) return;

    const fetchKeys = async () => {
      setIsLoadingModal2(true);
      try {
        const pgpKeys = await loadKeysFromIndexedDB();
        setUsersModal2(pgpKeys);
      } catch (error) {
        console.error("Error loading keys:", error);
      } finally {
        setIsLoadingModal2(false);
      }
    };

    fetchKeys();
  }, [certifyUserModal]);

  const filteredItemsModal2 = useMemo(() => {
    let items = [...usersModal2];

    items = items.filter(
      (user) =>
        user.privateKey &&
        user.privateKey.trim() !== "" &&
        user.status !== "revoked" &&
        user.status !== "expired" &&
        (!selectedUserId || user.id !== selectedUserId.id)
    );

    if (filterValueModal2) {
      items = items.filter(
        (user) =>
          [
            "name",
            "email",
            "creationdate",
            "expirydate",
            "status",
            "keyid",
            "fingerprint",
          ].some((field) =>
            user[field].toLowerCase().includes(filterValueModal2.toLowerCase())
          ) ||
          user.passwordprotected
            .toLowerCase()
            .includes(filterValueModal2.toLowerCase())
      );
    }
    return items;
  }, [usersModal2, filterValueModal2]);

  const pagesModal2 = useMemo(
    () => Math.ceil(filteredItemsModal2.length / 5),
    [filteredItemsModal2]
  );

  const hasSearchFilterModal2 = Boolean(filterValueModal2);

  const sortedItemsModal2 = useMemo(() => {
    const start = (pageModal2 - 1) * 5;
    const end = start + 5;
    return [...filteredItemsModal2]
      .sort((a, b) => {
        const aVal = a[sortDescriptorModal2.column];
        const bVal = b[sortDescriptorModal2.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDescriptorModal2.direction === "descending" ? -cmp : cmp;
      })
      .slice(start, end);
  }, [filteredItemsModal2, pageModal2, sortDescriptorModal2]);

  const onNextPageModal2 = useCallback(() => {
    if (pageModal2 < pagesModal2) setPageModal2(pageModal2 + 1);
  }, [pageModal2, pagesModal2]);

  const onPreviousPageModal2 = useCallback(() => {
    if (pageModal2 > 1) setPageModal2(pageModal2 - 1);
  }, [pageModal2]);

  const onSearchChangeModal2 = useCallback((value) => {
    setFilterValueModal2(value || "");
    setPageModal2(1);
  }, []);

  const onClearModal2 = useCallback(() => {
    setFilterValueModal2("");
    setPageModal2(1);
  }, []);

  const headerColumnsModal2 = useMemo(() => {
    if (visibleColumnsModal2 === "all") return columnsModal2;

    return columnsModal2.filter((column) =>
      Array.from(visibleColumnsModal2).includes(column.uid)
    );
  }, [visibleColumnsModal2]);

  const renderCellModal2 = useCallback(
    (user, columnKey) => {
      const value = user[columnKey];
      switch (columnKey) {
        case "name":
          return (
            <User
              avatarProps={{ radius: "lg", src: user.avatar }}
              name={value}
            />
          );
        case "status":
          return (
            <Chip
              className="-ms-5 capitalize"
              color={statusColorMap[user.status]}
              variant="flat"
            >
              {value}
            </Chip>
          );
        case "passwordprotected":
          return (
            <Chip
              className="-ms-6 capitalize"
              color={passwordprotectedColorMap[user.passwordprotected]}
              variant="flat"
            >
              {value}
            </Chip>
          );
        case "select":
          return (
            <Button
              onPress={() => certifyUserKey(user, selectedUserId)}
              className="ms-2"
              color="secondary"
              variant="flat"
            >
              Select
            </Button>
          );
        default:
          return value;
      }
    },
    [selectedUserId]
  );

  const topContentModal2 = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[100%]"
            placeholder="Search all fields (name, email, dates, status, key ID, fingerprint, etc.)"
            startContent={<SearchIcon />}
            value={filterValueModal2}
            onClear={() => onClearModal2()}
            onValueChange={onSearchChangeModal2}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={<ChevronDownIcon className="text-small" />}
                variant="faded"
                className="border-0"
              >
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={visibleColumnsModal2}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumnsModal2}
            >
              {columnsModal2
                .filter((column) => column.uid !== "select")
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
            Total {usersModal2.length} keys
          </span>
        </div>
      </div>
    );
  }, [
    filterValueModal2,
    usersModal2.length,
    visibleColumnsModal2,
    onSearchChangeModal2,
    hasSearchFilterModal2,
  ]);

  const bottomContentModal2 = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={pageModal2}
          total={pagesModal2}
          onChange={setPageModal2}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button
            isDisabled={pagesModal2 === 1}
            size="sm"
            variant="flat"
            onPress={onPreviousPageModal2}
          >
            Previous
          </Button>
          <Button
            isDisabled={pagesModal2 === 1}
            size="sm"
            variant="flat"
            onPress={onNextPageModal2}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [pageModal2, pagesModal2, hasSearchFilterModal2]);

  // View Certification Modal

  useEffect(() => {
    if (!viewCertificateModal || !selectedUserId) {
      setCertificationsModal3([]);
      return;
    }
    (async () => {
      setIsLoadingModal3(true);
      try {
        const allKeys = await loadKeysFromIndexedDB();
        const certs = await getKeyCertifications(selectedUserId, allKeys);
        setCertificationsModal3(certs);
      } catch {
        setCertificationsModal3([]);
      } finally {
        setIsLoadingModal3(false);
      }
    })();
  }, [viewCertificateModal, selectedUserId]);

  const filteredItemsModal3 = useMemo(() => {
    let items = [...certificationsModal3];
    if (filterValueModal3) {
      items = items.filter(
        (user) =>
          [
            "name",
            "email",
            "creationdate",
            "expirydate",
            "status",
            "keyid",
            "fingerprint",
          ].some((field) =>
            (user[field] || "")
              .toLowerCase()
              .includes(filterValueModal3.toLowerCase())
          ) ||
          (user.passwordprotected || "")
            .toLowerCase()
            .includes(filterValueModal3.toLowerCase())
      );
    }
    return items;
  }, [certificationsModal3, filterValueModal3]);

  const pagesModal3 = useMemo(
    () => Math.ceil(filteredItemsModal3.length / 5),
    [filteredItemsModal3]
  );

  const hasSearchFilterModal3 = Boolean(filterValueModal3);

  const sortedItemsModal3 = useMemo(() => {
    const start = (pageModal3 - 1) * 5;
    const end = start + 5;
    return [...filteredItemsModal3]
      .sort((a, b) => {
        const aVal = a[sortDescriptorModal3.column];
        const bVal = b[sortDescriptorModal3.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDescriptorModal3.direction === "descending" ? -cmp : cmp;
      })
      .slice(start, end);
  }, [filteredItemsModal3, pageModal3, sortDescriptorModal3]);

  const onNextPageModal3 = useCallback(() => {
    if (pageModal3 < pagesModal3) setPageModal3(pageModal3 + 1);
  }, [pageModal3, pagesModal3]);

  const onPreviousPageModal3 = useCallback(() => {
    if (pageModal3 > 1) setPageModal3(pageModal3 - 1);
  }, [pageModal3]);

  const onSearchChangeModal3 = useCallback((value) => {
    setFilterValueModal3(value || "");
    setPageModal3(1);
  }, []);

  const onClearModal3 = useCallback(() => {
    setFilterValueModal3("");
    setPageModal3(1);
  }, []);

  const headerColumnsModal3 = useMemo(() => {
    if (visibleColumnsModal3 === "all") return columnsModal3;

    return columnsModal3.filter((column) =>
      Array.from(visibleColumnsModal3).includes(column.uid)
    );
  }, [visibleColumnsModal3]);

  const renderCellModal3 = useCallback((user, columnKey) => {
    const value = user[columnKey];
    switch (columnKey) {
      case "name":
        return (
          <User avatarProps={{ radius: "lg", src: user.avatar }} name={value} />
        );
      case "status":
        return (
          <Chip
            className="-ms-5 capitalize"
            color={statusColorMap[user.status]}
            variant="flat"
          >
            {value}
          </Chip>
        );
      case "passwordprotected":
        return (
          <Chip
            className="-ms-6 capitalize"
            color={passwordprotectedColorMap[user.passwordprotected]}
            variant="flat"
          >
            {value}
          </Chip>
        );
      default:
        return value;
    }
  }, []);

  const topContentModal3 = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[100%]"
            placeholder="Search all fields (name, email, dates, status, key ID, fingerprint, etc.)"
            startContent={<SearchIcon />}
            value={filterValueModal3}
            onClear={() => onClearModal3()}
            onValueChange={onSearchChangeModal3}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={<ChevronDownIcon className="text-small" />}
                variant="faded"
                className="border-0"
              >
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={visibleColumnsModal3}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumnsModal3}
            >
              {columnsModal3.map((column) => (
                <DropdownItem key={column.uid} className="capitalize">
                  {capitalize(column.name)}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">
            Total {certificationsModal3.length} keys
          </span>
        </div>
      </div>
    );
  }, [
    filterValueModal3,
    certificationsModal3.length,
    visibleColumnsModal3,
    onSearchChangeModal3,
    hasSearchFilterModal3,
  ]);

  const hasUnknownCertifier = useMemo(
    () =>
      certificationsModal3.some(
        (cert) => cert.name === "Unknown" || cert.email === "Unknown"
      ),
    [certificationsModal3]
  );

  const handleSearchUnknownCertifiers = useCallback(() => {
    const unknownFingerprints = certificationsModal3
      .filter((cert) => cert.name === "Unknown" || cert.email === "Unknown")
      .map((cert) => {
        const fp = (cert.fingerprint || "")
          .replace(/\s/g, "")
          .replace(/[^A-F0-9]/gi, "")
          .toUpperCase();
        return fp.match(/.{1,4}/g)?.join(" ") || fp;
      })
      .filter((fp) => fp.length > 0);
    const uniqueFingerprints = Array.from(new Set(unknownFingerprints));
    setKeyserverQuery(uniqueFingerprints.join(","));
    setkeyServerModal(true);
  }, [certificationsModal3]);

  const refreshKeys = useCallback(async () => {
    const refreshedKeys = await loadKeysFromIndexedDB();
    setUsers(refreshedKeys);
  }, []);

  const bottomContentModal3 = useMemo(() => {
    return (
      <div className="py-2 px-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 justify-between">
        <div className="flex-shrink-0">
          <Pagination
            isCompact
            showControls
            showShadow
            color="default"
            page={pageModal3}
            total={pagesModal3}
            onChange={setPageModal3}
          />
        </div>

        {hasUnknownCertifier && (
          <div className="flex justify-center sm:min-w-0 order-2 sm:order-none mt-2 sm:mt-0">
            <Button
              variant="flat"
              className="text-wrap p-7 sm:p-4"
              onPress={handleSearchUnknownCertifiers}
            >
              🔍 Search Unknown Certifiers Keys On Key Server
            </Button>
          </div>
        )}

        <div className="flex-shrink-0 flex space-x-2">
          <Button
            isDisabled={pagesModal3 === 1}
            size="sm"
            variant="flat"
            onPress={onPreviousPageModal3}
          >
            Previous
          </Button>

          <Button
            isDisabled={pagesModal3 === 1}
            size="sm"
            variant="flat"
            onPress={onNextPageModal3}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [
    pageModal3,
    pagesModal3,
    hasSearchFilterModal3,
    hasUnknownCertifier,
    handleSearchUnknownCertifiers,
    keyServerModal,
    keyserverQuery,
  ]);

  // Manage Subkey Modal Table

  useEffect(() => {
    if (!manageSubkeyModal || !selectedUserId) return;
    setIsLoadingModal4(true);
    setUsersModal4([]);

    manageSubkeys(selectedUserId)
      .then(setUsersModal4)
      .catch((e) => {
        setUsersModal4([]);
        console.error("Error loading subkeys for modal4:", e);
      })
      .finally(() => setIsLoadingModal4(false));
  }, [manageSubkeyModal, selectedUserId]);

  const filteredItemsModal4 = useMemo(() => {
    let items = [...usersModal4];

    if (filterValueModal4) {
      items = items.filter(
        (user) =>
          [
            "usage",
            "creationdate",
            "expirydate",
            "status",
            "keyid",
            "fingerprint",
          ].some((field) =>
            user[field].toLowerCase().includes(filterValueModal4.toLowerCase())
          ) ||
          user.passwordprotected
            .toLowerCase()
            .includes(filterValueModal4.toLowerCase())
      );
    }
    return items;
  }, [usersModal4, filterValueModal4]);

  const pagesModal4 = useMemo(
    () => Math.ceil(filteredItemsModal4.length / 5),
    [filteredItemsModal4]
  );

  const hasSearchFilterModal4 = Boolean(filterValueModal4);

  const sortedItemsModal4 = useMemo(() => {
    const start = (pageModal4 - 1) * 5;
    const end = start + 5;
    return [...filteredItemsModal4]
      .sort((a, b) => {
        const aVal = a[sortDescriptorModal4.column];
        const bVal = b[sortDescriptorModal4.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDescriptorModal4.direction === "descending" ? -cmp : cmp;
      })
      .slice(start, end);
  }, [filteredItemsModal4, pageModal4, sortDescriptorModal4]);

  const onNextPageModal4 = useCallback(() => {
    if (pageModal4 < pagesModal4) setPageModal4(pageModal4 + 1);
  }, [pageModal4, pagesModal4]);

  const onPreviousPageModal4 = useCallback(() => {
    if (pageModal4 > 1) setPageModal4(pageModal4 - 1);
  }, [pageModal4]);

  const onSearchChangeModal4 = useCallback((value) => {
    setFilterValueModal4(value || "");
    setPageModal4(1);
  }, []);

  const onClearModal4 = useCallback(() => {
    setFilterValueModal4("");
    setPageModal4(1);
  }, []);

  const headerColumnsModal4 = useMemo(() => {
    if (visibleColumnsModal4 === "all") return columnsModal4;

    return columnsModal4.filter((column) =>
      Array.from(visibleColumnsModal4).includes(column.uid)
    );
  }, [visibleColumnsModal4]);

  const renderCellModal4 = useCallback(
    (user, columnKey) => {
      const value = user[columnKey];
      switch (columnKey) {
        case "usage":
          return (
            <User
              avatarProps={{ radius: "lg", src: user.avatar }}
              name={value}
            />
          );
        case "status":
          return (
            <Chip
              className="-ms-5 capitalize"
              color={statusColorMap[user.status]}
              variant="flat"
            >
              {value}
            </Chip>
          );
        case "passwordprotected":
          return (
            <Chip
              className="-ms-6 capitalize"
              color={passwordprotectedColorMap[user.passwordprotected]}
              variant="flat"
            >
              {value}
            </Chip>
          );
        case "actions":
          return <UserActionsDropdownSubkey subkey={user} />;
        default:
          return value;
      }
    },
    [selectedUserId]
  );

  const topContentModal4 = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            className="w-full sm:max-w-[100%]"
            placeholder="Search all fields (usage, dates, status, key ID, fingerprint, algorithm)"
            startContent={<SearchIcon />}
            value={filterValueModal4}
            onClear={() => onClearModal4()}
            onValueChange={onSearchChangeModal4}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button
                endContent={<ChevronDownIcon className="text-small" />}
                variant="faded"
                className="border-0"
              >
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={visibleColumnsModal4}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumnsModal4}
            >
              {columnsModal4
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
            Total {usersModal4.length} keys
          </span>
        </div>
      </div>
    );
  }, [
    filterValueModal4,
    usersModal4.length,
    visibleColumnsModal4,
    onSearchChangeModal4,
    hasSearchFilterModal4,
  ]);

  const bottomContentModal4 = useMemo(() => {
    return (
      <div className="py-2 px-2 flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={pageModal4}
          total={pagesModal4}
          onChange={setPageModal4}
        />
        <div className="hidden sm:flex w-[30%] justify-end gap-4">
          <Button
            isDisabled={pagesModal4 === 1}
            size="sm"
            variant="flat"
            onPress={onPreviousPageModal4}
          >
            Previous
          </Button>
          <Button
            isDisabled={pagesModal4 === 1}
            size="sm"
            variant="flat"
            onPress={onNextPageModal4}
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [pageModal4, pagesModal4, hasSearchFilterModal4]);

  return (
    <>
      <KeyServer
        isOpen={keyServerModal}
        onClose={() => setkeyServerModal(false)}
        initialSearch={keyserverQuery}
        onKeyImported={refreshKeys}
      />

      <Table
        isHeaderSticky
        aria-label="Keyrings Table"
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
              <Spinner
                size="lg"
                color="warning"
                label={
                  <div className="text-center">
                    Loading keyrings...
                    <br />
                    <span className="text-gray-300 text-sm">
                      This may take some time depending{" "}
                      <br className="block sm:hidden" />
                      on your device&apos;s performance.
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
              <div className="ms-6 flex justify-center">
                <Button as={NProgressLink} href="/import">
                  Import Key
                </Button>
                <span className="mx-3 mt-2">or</span>
                <Button as={NProgressLink} href="/cloud-manage">
                  Import Keyrings From Cloud
                </Button>
                <span className="mx-3 mt-2">or</span>
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
            className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
            onPress={async () => {
              if (manageSubkeyModal && selectedSubkey !== null) {
                await ChangeSubkeyValidity(selectedSubkey);
              } else {
                ChangeKeyValidity();
              }
            }}
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
          <h3 className="mb-4">
            {subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined
              ? `Enter Password For Protected Subkey #${subkeyGlobalIndex + 1}`
              : "Enter Password For Protected Key"}
          </h3>
          <Input
            ref={passwordInputRef}
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
            className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
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
          <h3 className="mb-4">
            {subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined
              ? `Enter New Password For Subkey #${subkeyGlobalIndex + 1}`
              : "Enter New Password"}
          </h3>

          <Input
            ref={newPasswordInputRef}
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
            className="mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
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
        onClose={() => setremovePasswordModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Remove The Password From {selectedKeyName}
            &apos;s Key?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setremovePasswordModal(false)}
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
            ref={nameInputRef}
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
              className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
              onPress={() => setaddUserIDModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 text-white rounded-full"
              color="success"
              variant="flat"
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
            aria-label="User ID Table"
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
                    ["email", "status", "primary", "revoke"].includes(
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
        size="md"
        backdrop="blur"
        isOpen={revokeUserIDModal}
        onClose={() => setrevokeUserIDModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Revoke {userIDToRevoke?.name}&apos;s User
            ID?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setrevokeUserIDModal(false)}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={async () => {
                await revokeUserID(selectedUserId, userIDToRevoke);
                setrevokeUserIDModal(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await revokeUserID(selectedUserId, userIDToRevoke);
                  setrevokeUserIDModal(false);
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
        isOpen={addSubkeyModal}
        onClose={() => setaddSubkeyModal(false)}
      >
        <ModalContent className="p-8">
          <Autocomplete
            className="max-w-md"
            defaultItems={keyalgorithms}
            defaultSelectedKey="curve25519"
            label="Select Key Algorithm"
            onSelectionChange={(selectedItem) => {
              const selectedKey =
                typeof selectedItem === "object" && selectedItem !== null
                  ? selectedItem.key
                  : selectedItem;
              if (selectedKey) {
                setSelectedAlgorithm(selectedKey);
              }
            }}
          >
            {(item) => (
              <AutocompleteItem key={item.key}>{item.label}</AutocompleteItem>
            )}
          </Autocomplete>

          <br />

          <RadioGroup
            label="Subkey Usage"
            className="mb-4"
            size="sm"
            color="success"
            value={subkeyOption}
            onValueChange={setsubkeyOption}
          >
            <Radio value="0">Signing</Radio>
            <Radio value="1">Encryption</Radio>
          </RadioGroup>

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
            maxValue={(() => {
              const calDate = parseExpiryToCalendarDate(
                selectedUserId?.expirydate
              );
              return calDate ? calDate : undefined;
            })()}
            isDisabled={isNoExpiryChecked}
            className="max-w-[284px]"
            label="Expiry date"
            value={expiryDate}
            onChange={(date) => setExpiryDate(date)}
          />

          <br />

          <div className="mb-2">
            <span className="font-semibold">Primary Key Expiry:&nbsp;</span>
            <span>{selectedUserId?.expirydate || "Unknown"}</span>
          </div>

          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
              onPress={() => setaddSubkeyModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 text-white rounded-full"
              color="success"
              variant="flat"
              onPress={() => addSubkey(selectedUserId)}
            >
              Add
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        size="5xl"
        backdrop="blur"
        isOpen={certifyUserModal}
        onClose={() => setcertifyUserModal(false)}
      >
        <ModalContent className="p-8">
          <Table
            isHeaderSticky
            aria-label="Certify Table"
            bottomContent={bottomContentModal2}
            bottomContentPlacement="outside"
            sortDescriptor={sortDescriptorModal2}
            topContent={topContentModal2}
            topContentPlacement="outside"
            onSortChange={setSortDescriptorModal2}
          >
            <TableHeader columns={headerColumnsModal2}>
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
                      "select",
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
                          This may take some time depending{" "}
                          <br className="block sm:hidden" />
                          on your device&apos;s performance.
                        </span>
                      </div>
                    }
                  />
                </div>
              }
              isLoading={isLoadingModal2}
              emptyContent={
                <>
                  <span>No keyrings found</span>
                </>
              }
              items={sortedItemsModal2}
            >
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => (
                    <TableCell>{renderCellModal2(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ModalContent>
      </Modal>
      <Modal
        size="5xl"
        backdrop="blur"
        isOpen={manageSubkeyModal}
        onClose={() => setmanageSubkeyModal(false)}
      >
        <ModalContent className="p-8">
          <Table
            isHeaderSticky
            aria-label="Manage Subkey Table"
            bottomContent={bottomContentModal4}
            bottomContentPlacement="outside"
            sortDescriptor={sortDescriptorModal4}
            topContent={topContentModal4}
            topContentPlacement="outside"
            onSortChange={setSortDescriptorModal4}
          >
            <TableHeader columns={headerColumnsModal4}>
              {(column) => (
                <TableColumn
                  key={column.uid}
                  align={
                    [
                      "email",
                      "status",
                      "passwordprotected",
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
                  <Spinner
                    size="lg"
                    color="warning"
                    label={
                      <div className="text-center">
                        Loading Subkeys...
                        <br />
                        <span className="text-gray-300 text-sm">
                          This may take some time depending{" "}
                          <br className="block sm:hidden" />
                          on your device&apos;s performance.
                        </span>
                      </div>
                    }
                  />
                </div>
              }
              isLoading={isLoadingModal4}
              emptyContent={
                <>
                  <span>No Subkeys found</span>
                </>
              }
              items={sortedItemsModal4}
            >
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => (
                    <TableCell>{renderCellModal4(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ModalContent>
      </Modal>
      <Modal
        size="5xl"
        backdrop="blur"
        isOpen={viewCertificateModal}
        onClose={() => setviewCertificateModal(false)}
      >
        <ModalContent className="p-8">
          <Table
            isHeaderSticky
            aria-label="Certifications Table"
            bottomContent={bottomContentModal3}
            bottomContentPlacement="outside"
            sortDescriptor={sortDescriptorModal3}
            topContent={topContentModal3}
            topContentPlacement="outside"
            onSortChange={setSortDescriptorModal3}
          >
            <TableHeader columns={headerColumnsModal3}>
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
                      "select",
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
                        Loading Certifications...
                        <br />
                        <span className="text-gray-300 text-sm">
                          This may take some time depending{" "}
                          <br className="block sm:hidden" />
                          on your device&apos;s performance.
                        </span>
                      </div>
                    }
                  />
                </div>
              }
              isLoading={isLoadingModal3}
              emptyContent={
                <>
                  <span>No Certifications found</span>
                </>
              }
              items={sortedItemsModal3}
            >
              {(item) => (
                <TableRow key={item.id}>
                  {(columnKey) => (
                    <TableCell>{renderCellModal3(item, columnKey)}</TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ModalContent>
      </Modal>
      <Modal
        size="xl"
        backdrop="blur"
        isOpen={revokeUsingCertificateModal}
        onClose={() => setrevokeUsingCertificateModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2 font-semibold text-lg">
            Are You Sure You Want To Revoke {selectedKeyName}&apos;s Key?
          </h3>
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Input
              className="w-full"
              multiple
              type="file"
              accept=".asc,.txt,.key,.rev"
              onChange={handleFileInput}
            />
          </div>
          <br />
          <Textarea
            disableAutosize
            classNames={{
              input: "resize-y min-h-[120px]",
            }}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Paste Revocation Certificate Here"
          />
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setrevokeUsingCertificateModal(false)}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={async () => {
                await RevokeUsingCertificate(selectedUserId, keyInput);
                setrevokeUsingCertificateModal(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await RevokeUsingCertificate(selectedUserId, keyInput);
                  setrevokeUsingCertificateModal(false);
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
        onClose={() => {
          setrevokeModal(false);
          setsubkeyGlobalIndex(null);
        }}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2 font-semibold">
            {subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined
              ? `Are You Sure You Want To Revoke ${selectedKeyName}'s Subkey #${subkeyGlobalIndex + 1}`
              : `Are You Sure You Want To Revoke ${selectedKeyName}'s Key`}
          </h3>

          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
              onPress={async () => {
                setrevokeModal(false);
                if (manageSubkeyModal && selectedSubkey !== null) {
                  await revokeSubkey(selectedSubkey);
                } else {
                  await revokeKey(selectedUserId);
                }
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
            {subkeyGlobalIndex !== null && subkeyGlobalIndex !== undefined
              ? `Revocation Reason for ${selectedKeyName}'s Subkey #${subkeyGlobalIndex + 1}`
              : `Revocation Reason for ${selectedKeyName}'s Key`}
          </h3>

          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
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
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
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
      <Modal
        size="2xl"
        backdrop="blur"
        isOpen={publishKeyModal}
        onClose={() => setpublishKeyModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2 font-semibold text-lg">
            Are you sure you want to publish {selectedKeyName}&apos;s public key
            to the server?
          </h3>

          <div className="mb-4 text-sm text-yellow-400">
            <p className="font-semibold mb-2">
              ⚠️ Once an OpenPGP public key is published to a public directory
              server, it cannot be removed.
            </p>
            <p className="mb-2">
              Before proceeding, ensure you have generated a revocation
              certificate. This is essential in case your key is compromised,
              lost, or if you forget the passphrase.
            </p>
            <p>Do you still want to continue?</p>
          </div>

          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-200 text-white rounded-full"
              onPress={() => setpublishKeyModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 text-white rounded-full"
              color="warning"
              variant="flat"
              onPress={async () => {
                await publishKeyOnServer();
                setpublishKeyModal(false);
              }}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  await publishKeyOnServer();
                  setpublishKeyModal(false);
                }
              }}
            >
              Yes, Publish Key
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        size="xl"
        backdrop="blur"
        isOpen={publicKeyModal}
        onClose={() => setpublicKeyModal(false)}
      >
        <ModalContent className="p-8">
          <Snippet
            symbol=""
            classNames={{
              base: "max-w-full p-5 overflow-auto",
              content: "whitespace-pre-wrap break-all",
              pre: "whitespace-pre-wrap break-all max-h-[300px] overflow-auto",
            }}
          >
            {publicKeySnippet}
          </Snippet>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              className="px-4 py-2 text-white rounded-full"
              color="success"
              variant="flat"
              onPress={() => {
                exportPublicKey(selectedUserPublicKey);
                setpublicKeyModal(false);
              }}
            >
              Download Public Key
            </Button>
            <Button
              className="px-4 py-2 bg-default-200 text-white rounded-full"
              onPress={() => setpublicKeyModal(false)}
            >
              Close
            </Button>
          </div>
        </ModalContent>
      </Modal>
      <Modal
        backdrop="blur"
        isOpen={deleteModal}
        onClose={() => setdeleteModal(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-2">
            Are You Sure You Want To Delete {selectedKeyName}&apos;s Key?
          </h3>
          <div className="flex gap-2">
            <Button
              className="w-full mt-4 px-4 py-2 bg-default-300 text-white rounded-full"
              onPress={() => setdeleteModal(false)}
            >
              No
            </Button>
            <Button
              className="w-full mt-4 px-4 py-2 bg-danger-300 text-white rounded-full"
              onPress={() => {
                deleteKey(selectedUserId);
                setdeleteModal(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  deleteKey(selectedUserId);
                  setdeleteModal(false);
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
