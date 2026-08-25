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
  User,
  Chip,
  Pagination,
  Modal,
  ModalContent,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  addToast,
  Spinner,
  SortDescriptor,
} from "@heroui/react";
import { openDB, getStoredKeys, saveKeyToIndexedDB } from "@/lib/indexeddb";
import { SearchIcon } from "@/components/icons";
import Public from "@/assets/Public.png";
import * as openpgp from "openpgp";

const statusColorMap = {
  active: "success",
  expired: "danger",
  revoked: "danger",
};

const columns = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  {
    name: "EMAIL",
    uid: "email",
    width: "30%",
    align: "center",
    sortable: true,
  },
  { name: "CREATION DATE", uid: "creationdate", width: "20%", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", width: "15%", sortable: true },
  {
    name: "STATUS",
    uid: "status",
    width: "20%",
    align: "center",
    sortable: true,
  },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "IMPORT", uid: "import", align: "center" },
];

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "email",
  "creationdate",
  "expirydate",
  "status",
  "import",
];

const capitalize = (s: string) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const processKey = async (key: { id: number; publicKey: string }) => {
  const startIndex = key.publicKey.indexOf(
    "-----BEGIN PGP PUBLIC KEY BLOCK-----"
  );
  if (startIndex === -1) {
    throw new Error("No PGP public key block header found");
  }

  let armored = key.publicKey.substring(startIndex);

  // Ensure there's a mandatory blank line between the armor headers and base64 data.
  if (!armored.match(/\n\n/)) {
    const firstLineBreak = armored.indexOf("\n");
    if (firstLineBreak !== -1) {
      armored =
        armored.slice(0, firstLineBreak) +
        "\n\n" +
        armored.slice(firstLineBreak + 1);
    }
  }

  const openpgpKey = await openpgp.readKey({ armoredKey: armored });

  const formatDate = (isoDate: Date) => {
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

  const getKeyExpiryInfo = async (key: openpgp.Key) => {
    try {
      const isRevoked = await key.isRevoked();
      if (isRevoked) return { expirydate: "Revoked", status: "revoked" };
      const expirationTime = await key.getExpirationTime();
      const now = new Date();
      if (expirationTime === null || expirationTime === Infinity) {
        return { expirydate: "No Expiry", status: "active" };
      } else if ((expirationTime as Date).getTime() < now.getTime()) {
        return { expirydate: formatDate(expirationTime as Date), status: "expired" };
      } else {
        return { expirydate: formatDate(expirationTime as Date), status: "active" };
      }
    } catch {
      return { expirydate: "Error", status: "unknown" };
    }
  };

  const userIDs = openpgpKey.getUserIDs();

  const primaryUser = await openpgpKey.getPrimaryUser();
  const userID = primaryUser.user.userID?.userID || '';

  let name, email;
  const match = userID.match(/^(.*?)\s*<(.+?)>$/);
  if (match) {
    name = match[1].trim();
    email = match[2].trim();
  } else {
    name = userID.trim();
    email = "N/A";
  }

  const creationdate = formatDate(openpgpKey.getCreationTime());
  const { expirydate, status } = await getKeyExpiryInfo(openpgpKey);

  const formatFingerprint = (fingerprint: string) => {
    const parts = fingerprint.match(/.{1,4}/g) || [];
    const nbsp = "\u00A0";
    return (
      parts.slice(0, 5).join(" ") + nbsp.repeat(6) + parts.slice(5).join(" ")
    );
  };
  const fingerprint = formatFingerprint(
    openpgpKey.getFingerprint().toUpperCase()
  );

  const formatKeyID = (keyid: string) => (keyid.match(/.{1,4}/g) || []).join(" ");
  const keyid = formatKeyID(openpgpKey.getKeyID().toHex().toUpperCase());

  const formatAlgorithm = (algoInfo: Record<string, any>) => {
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
    if (algoInfo.curve && (labelMap as any)[algoInfo.curve]) {
      return (labelMap as any)[algoInfo.curve];
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
    keyid,
    fingerprint,
    algorithm,
    avatar: key.publicKey?.trim() ? Public.src : undefined,
    publicKey: key.publicKey,
    userIdCount: userIDs.length,
  };
};

export interface KeyserverKey {
  id: number;
  name: string;
  email: string;
  creationdate: string;
  expirydate: string;
  status: string;
  keyid: string;
  fingerprint: string;
  algorithm: string;
  avatar?: string;
  publicKey?: string;
  userIdCount: number;
}

interface KeyServerProps {
  isOpen: boolean;
  onClose: () => void;
  initialSearch?: string;
  onKeyImported?: () => void;
}

const KeyServer = ({ isOpen, onClose, initialSearch, onKeyImported }: KeyServerProps) => {
  const [inputValue, setInputValue] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [rows, setRows] = useState<KeyserverKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({} as SortDescriptor);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );

  useEffect(() => {
    openDB();
  }, []);

  // Define fetchKeys first
  const fetchKeys = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setRows([]);
      return;
    }
    if (!isValidSearch(trimmed)) {
      addToast({
        title: "Search by email, key ID, or fingerprint only",
        color: "danger",
      });
      setRows([]);
      return;
    }

    setLoading(true);
    try {
      const emailList = trimmed
        .split(",")
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);

      const csrfRes = await fetch("/api/csrf", { method: "GET" });
      if (!csrfRes.ok) {
        throw new Error("Failed to get CSRF token");
      }
      const { csrfToken } = await csrfRes.json();

      const params = new URLSearchParams({
        search: trimmed,
        csrfToken: csrfToken,
      });
      const apiUrl = `/api/keyserver?${params.toString()}`;

      const res = await fetch(apiUrl);
      const text = await res.text();
      const blocks = text
        .split(/(?=-----BEGIN PGP PUBLIC KEY BLOCK-----)/g)
        .filter(Boolean);

      // 2) Process all the blocks
      const processed = (
        await Promise.all(
          blocks.map(async (armored: string, index: number) => {
            try {
              return await processKey({ id: index, publicKey: armored });
            } catch (err) {
              console.error("processKey error", err);
              return null;
            }
          })
        )
      ).filter(k => k !== null) as KeyserverKey[];

      const certifierNames = (processed as KeyserverKey[]).filter((k: KeyserverKey) => emailList.includes(k.email.toLowerCase()))
        .map((k: KeyserverKey) => k.name);

      const decorated = (processed as KeyserverKey[]).map((k: KeyserverKey) => {
        if (
          certifierNames.length > 0 &&
          !emailList.includes(k.email.toLowerCase())
        ) {
          const suffix = ` (Certified ${certifierNames.join(", ")})`;
          return { ...k, name: k.name + suffix };
        }
        return k;
      });

      setRows(decorated);
    } catch (err) {
      console.error(err);
      addToast({ title: "Error fetching keys", color: "danger" });
    } finally {
      setLoading(false);
    }
  }, []);

  const doSearch = useCallback(() => {
    setPage(1);
    fetchKeys(inputValue);
  }, [inputValue, fetchKeys]);

  useEffect(() => {
    if (isOpen && initialSearch) {
      setInputValue(initialSearch);
      fetchKeys(initialSearch);
    }
  }, [isOpen, initialSearch, fetchKeys]);

  const extractPGPKeys = (content: string) => {
    const publicKeyRegex =
      /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/;

    const publicKeyMatch = content.match(publicKeyRegex);

    return {
      publicKey: publicKeyMatch ? publicKeyMatch[0] : null,
    };
  };

  const checkIfKeyExists = async (newKeyData: { publicKey: string }) => {
    const existingKeys = await getStoredKeys();
    return (existingKeys as { publicKey: string }[]).some((key: { publicKey: string }) => key.publicKey === newKeyData.publicKey);
  };

  const importKey = async (keyArmored: string) => {
    try {
      const { publicKey } = extractPGPKeys(keyArmored);

      if (!publicKey) {
        addToast({
          title: "No valid PGP public key block found",
          color: "danger",
        });
        return;
      }

      const key = await openpgp.readKey({
        armoredKey: publicKey,
      });

      if (!key || !key.getUserIDs || key.getUserIDs().length === 0) {
        addToast({
          title: "The PGP key is Corrupted",
          color: "danger",
        });
        return;
      }

      let keyData = {
        id: Date.now(),
        publicKey: publicKey,
      };

      const primaryUser = await key.getPrimaryUser();
      const userID = primaryUser.user.userID?.userID || '';
      let keyname = userID?.split("<")[0].trim() || "Unknown User";

      if (await checkIfKeyExists(keyData)) {
        addToast({
          title: `${keyname}'s Key already exists`,
          color: "primary",
        });
        return;
      }

      await saveKeyToIndexedDB(keyData);

      addToast({
        title: `${keyname}'s Public key imported`,
        color: "success",
      });

      if (onKeyImported) {
        onKeyImported();
      }
    } catch (error: any) {
      addToast({
        title: `Failed to import key: ${error.message}`,
        color: "danger",
      });
    }
  };

  const isValidSearch = (val: string) => {
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const hexRegex = /^[A-Fa-f0-9]{8,}$/;

    // split on commas, strip internal spaces, then validate each piece
    return val
      .split(",")
      .map((term: string) => term.trim().replace(/\s+/g, ""))
      .filter(Boolean)
      .every((term: string) => emailRegex.test(term) || hexRegex.test(term));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") doSearch();
  };

  const filteredRows = useMemo(() => {
    if (!filterValue) return rows;
    return rows.filter(
      (row) =>
        (row: KeyserverKey) =>
        row.name.toLowerCase().includes(filterValue.toLowerCase()) ||
        row.creationdate.toLowerCase().includes(filterValue.toLowerCase()) ||
        row.expirydate.toLowerCase().includes(filterValue.toLowerCase()) ||
        row.status.toLowerCase().includes(filterValue.toLowerCase()) ||
        row.keyid.toLowerCase().includes(filterValue.toLowerCase()) ||
        row.fingerprint.toLowerCase().includes(filterValue.toLowerCase())
    );
  }, [rows, filterValue]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const sortedRows = useMemo(() => {
    const column = sortDescriptor.column;
    if (!column) return paginatedRows;
    return [...paginatedRows].sort((a: any, b: any) => {
      const aVal = a[column] || "";
      const bVal = b[column] || "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [paginatedRows, sortDescriptor]);

  const renderCell = useCallback((user: KeyserverKey, columnKey: React.Key) => {
    const cellValue = user[columnKey as keyof KeyserverKey];
    switch (columnKey) {
      case "name":
        return (
          <User
            className="mt-1"
            avatarProps={{ radius: "lg", src: user.avatar }}
            name={cellValue}
          ></User>
        );
      case "status":
        return (
          <Chip
            className="capitalize -ms-5"
            color={(statusColorMap as any)[user.status]}
            variant="flat"
          >
            {cellValue}
          </Chip>
        );
      case "import":
        return (
          <Button
            size="md"
            color="secondary"
            variant="flat"
            onPress={() => importKey(user.publicKey || "")}
          >
            Import
          </Button>
        );
      default:
        return <span>{cellValue}</span>;
    }
  }, []);

  const headerColumns = columns.filter((col) => visibleColumns.has(col.uid));

  const onSearchChange = useCallback((value?: string) => {
    if (value) {
      setFilterValue(value || "");
      setPage(1);
    } else {
      setFilterValue("");
    }
  }, []);

  const onClear = useCallback(() => {
    setFilterValue("");
    setPage(1);
  }, []);

  const topContent = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3">
        <Input
          isClearable
          className="w-full"
          placeholder="Enter email, key ID, or fingerprint, or separate by commas to search multiple keys"
          startContent={<SearchIcon />}
          value={inputValue}
          onValueChange={setInputValue}
          onKeyDown={onKeyDown}
        />
        <div className="flex gap-3 w-full sm:w-auto">
          <Button variant="flat" onPress={doSearch} className="w-1/2 sm:w-auto">
            Search
          </Button>
          <Dropdown>
            <DropdownTrigger>
              <Button variant="flat" className="w-1/2 sm:w-auto">
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={visibleColumns}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumns as any}
            >
              {columns
                .filter((column) => column.uid !== "import")
                .map((column) => (
                  <DropdownItem key={column.uid} className="capitalize">
                    {capitalize(column.name)}
                  </DropdownItem>
                ))}
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">
          Total {filteredRows.length} Keys
        </span>
        <label className="flex items-center text-default-400 text-small">
          Rows per page:
          <select
            className="bg-transparent outline-none text-default-400 text-small"
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </label>
      </div>
    </div>
  );

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 justify-between">
        <div className="flex-shrink-0">
          <Pagination
            isCompact
            showControls
            showShadow
            color="default"
            page={page}
            total={Math.ceil(filteredRows.length / rowsPerPage) || 1}
            onChange={setPage}
          />
        </div>

        <div className="w-full sm:flex-1 sm:min-w-0 order-2 sm:order-none mt-2 sm:mt-0">
          <Input
            isClearable
            className="w-full"
            placeholder="Filter across all fields (name, email, dates, status, key ID, fingerprint, etc.)"
            startContent={<SearchIcon />}
            value={filterValue}
            onClear={onClear}
            onValueChange={onSearchChange}
          />
        </div>

        <div className="flex-shrink-0 flex space-x-2">
          <Button
            size="sm"
            variant="flat"
            onPress={() => setPage((p) => (p > 1 ? p - 1 : p))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={() =>
              setPage((p) =>
                p < Math.ceil(filteredRows.length / rowsPerPage) ? p + 1 : p
              )
            }
          >
            Next
          </Button>
        </div>
      </div>
    );
  }, [filterValue, filteredRows, rowsPerPage, page]);

  return (
    <Modal size="5xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-7">
        <Table
          isHeaderSticky
          aria-label="Keys Table"
          topContent={topContent}
          topContentPlacement="outside"
          bottomContent={bottomContent}
          bottomContentPlacement="outside"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          classNames={{ wrapper: "max-h-[400px]" }}
        >
          <TableHeader columns={headerColumns}>
            {(column) => (
              <TableColumn
                key={column.uid}
                align={
                  [
                    "email",
                    "status",
                    "keyid",
                    "fingerprint",
                    "algorithm",
                    "import",
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
                  label={(
                    <div className="text-center">
                      Loading Keys...
                      <br />
                      <span className="text-gray-300 text-sm">
                        This may take a while
                      </span>
                    </div>
                  ) as any}
                />
              </div>
            }
            isLoading={loading}
            emptyContent={
              <>
                <span>No keys found</span>
              </>
            }
            items={loading ? [] : sortedRows}
          >
            {(row) => (
              <TableRow key={row.keyid}>
                {(colKey) => <TableCell>{renderCell(row, colKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ModalContent>
    </Modal>
  );
};

export default KeyServer;
