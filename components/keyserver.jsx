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

const capitalize = (s) => {
  if (!s) return "";
  if (s.toLowerCase() === "key id") return "Key ID";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

const processKey = async (key) => {
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
  const { expirydate, status } = await getKeyExpiryInfo(openpgpKey);

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
    keyid,
    fingerprint,
    algorithm,
    avatar: key.publicKey?.trim() ? Public.src : undefined,
    publicKey: key.publicKey,
    userIdCount: userIDs.length,
  };
};

const KeyServer = ({ isOpen, onClose, initialSearch, onKeyImported }) => {
  const [inputValue, setInputValue] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({});
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );

  useEffect(() => {
    openDB();
  }, []);

  // Define fetchKeys first
  const fetchKeys = useCallback(async (value) => {
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
      const params = new URLSearchParams({ search: trimmed });
      const apiUrl = `/api/keyserver?${params.toString()}`;

      const res = await fetch(apiUrl);
      const text = await res.text();
      const blocks = text
        .split(/(?=-----BEGIN PGP PUBLIC KEY BLOCK-----)/g)
        .filter(Boolean);

      const processed = await Promise.all(
        blocks.map(async (armored, index) => {
          try {
            return await processKey({ id: index, publicKey: armored });
          } catch (e) {
            console.error("processKey error", e);
            return null;
          }
        })
      );
      setRows(processed.filter(Boolean));
    } catch (e) {
      console.error(e);
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

  const extractPGPKeys = (content) => {
    const publicKeyRegex =
      /-----BEGIN PGP PUBLIC KEY BLOCK-----[\s\S]+?-----END PGP PUBLIC KEY BLOCK-----/;

    const publicKeyMatch = content.match(publicKeyRegex);

    return {
      publicKey: publicKeyMatch ? publicKeyMatch[0] : null,
    };
  };

  const checkIfKeyExists = async (newKeyData) => {
    const existingKeys = await getStoredKeys();
    return existingKeys.some((key) => key.publicKey === newKeyData.publicKey);
  };

  const importKey = async (keyArmored) => {
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

      let keyname = key.getUserIDs()[0]?.split("<")[0].trim() || "Unknown User";

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
    } catch (error) {
      addToast({
        title: `Failed to import key: ${error.message}`,
        color: "danger",
      });
    }
  };

  const isValidSearch = (val) => {
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    const hexRegex = /^[A-Fa-f0-9]{8,}$/;

    // split on commas, strip internal spaces, then validate each piece
    return val
      .split(",")
      .map((term) => term.trim().replace(/\s+/g, ""))
      .filter(Boolean)
      .every((term) => emailRegex.test(term) || hexRegex.test(term));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") doSearch();
  };

  const filteredRows = useMemo(() => {
    if (!filterValue) return rows;
    return rows.filter(
      (row) =>
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
    if (!sortDescriptor.column) return paginatedRows;
    return [...paginatedRows].sort((a, b) => {
      const aVal = a[sortDescriptor.column] || "";
      const bVal = b[sortDescriptor.column] || "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [paginatedRows, sortDescriptor]);

  const renderCell = useCallback((user, columnKey) => {
    const cellValue = user[columnKey];
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
            color={statusColorMap[user.status]}
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
            onPress={() => importKey(user.publicKey)}
          >
            Import
          </Button>
        );
      default:
        return <span>{cellValue}</span>;
    }
  }, []);

  const headerColumns = columns.filter((col) => visibleColumns.has(col.uid));

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

  const topContent = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[100%]"
          placeholder="Enter email, key ID, or fingerprint, or separate by commas to search multiple keys"
          startContent={<SearchIcon />}
          value={inputValue}
          onValueChange={setInputValue}
          onKeyDown={onKeyDown}
        />
        <Button variant="flat" onPress={doSearch}>
          Search
        </Button>
        <Dropdown>
          <DropdownTrigger>
            <Button variant="flat">Columns</Button>
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
              .filter((column) => column.uid !== "import")
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
                  label={
                    <div className="text-center">
                      Loading Keys...
                      <br />
                      <span className="text-gray-300 text-sm">
                        This may take a while
                      </span>
                    </div>
                  }
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
