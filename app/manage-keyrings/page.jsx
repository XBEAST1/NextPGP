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
} from "@nextui-org/react";
import * as openpgp from "openpgp";
import Keyring from "@/assets/Keyring.png";
import Public from "@/assets/Public.png";

export const columns = [
  { name: "NAME", uid: "name", sortable: true },
  { name: "EMAIL", uid: "email" },
  { name: "EXPIRY DATE", uid: "expirydate" },
  { name: "STATUS", uid: "status", sortable: true },
  { name: "ACTIONS", uid: "actions" },
];

export const statusOptions = [
  { name: "Active", uid: "active" },
  { name: "Expired", uid: "expired" },
];

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

export const VerticalDotsIcon = ({ size = 24, width, height, ...props }) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height={size || height}
      role="presentation"
      viewBox="0 0 24 24"
      width={size || width}
      {...props}
    >
      <path
        d="M12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 12c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
        fill="currentColor"
      />
    </svg>
  );
};

export const SearchIcon = (props) => {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      focusable="false"
      height="1em"
      role="presentation"
      viewBox="0 0 24 24"
      width="1em"
      {...props}
    >
      <path
        d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M22 22L20 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
};

const statusColorMap = {
  active: "success",
  paused: "danger",
};

const INITIAL_VISIBLE_COLUMNS = [
  "name",
  "email",
  "expirydate",
  "status",
  "actions",
];

export default function App() {
  const [filterValue, setFilterValue] = useState("");
  const [users, setUsers] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(INITIAL_VISIBLE_COLUMNS)
  );
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [sortDescriptor, setSortDescriptor] = useState({
    column: "expirydate",
    direction: "ascending",
  });
  const [page, setPage] = useState(1);

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const year = date.getUTCFullYear();
    return `${day}-${month}-${year}`;
  };

  const loadKeysFromLocalStorage = async () => {
    const keys = JSON.parse(localStorage.getItem("pgpKeys")) || [];

    const getKeyExpiryInfo = async (key) => {
      try {
        const expirationTime = await key.getExpirationTime();
        const now = new Date();

        if (expirationTime === null || expirationTime === Infinity) {
          return {
            expirydate: "No Expiry",
            status: "active",
          };
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
        return {
          expirydate: "Error",
          status: "unknown",
        };
      }
    };

    // Process keys and fetch expiry details
    const processedKeys = await Promise.all(
      keys.map(async (key) => {
        const openpgpKey = await openpgp.readKey({ armoredKey: key.publicKey });
        const { expirydate, status } = await getKeyExpiryInfo(openpgpKey);

        return {
          id: key.id,
          name: key.name,
          email: key.email,
          expirydate: expirydate,
          status: status,
          avatar: (() => {
            const hasPrivateKey =
              key.privateKey && key.privateKey.trim() !== "";
            const hasPublicKey = key.publicKey && key.publicKey.trim() !== "";

            if (hasPrivateKey && hasPublicKey) {
              return Keyring.src;
            } else if (hasPublicKey) {
              return Public.src;
            }
          })(),
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          publicKey: key.publicKey,
          privateKey: key.privateKey,
        };
      })
    );

    return processedKeys;
  };

  useEffect(() => {
    const fetchKeys = async () => {
      const pgpKeys = await loadKeysFromLocalStorage();
      setUsers(pgpKeys);
    };

    fetchKeys();

    const handleStorageChange = async () => {
      const updatedKeys = await loadKeysFromLocalStorage();
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

  const headerColumns = React.useMemo(() => {
    if (visibleColumns === "all") return columns;

    return columns.filter((column) =>
      Array.from(visibleColumns).includes(column.uid)
    );
  }, [visibleColumns]);

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
                <DropdownItem onClick={() => exportPublicKey(user)}>
                  Export Public Key
                </DropdownItem>
                <DropdownItem onClick={() => backupKeyring(user)}>
                  Backup Keyring
                </DropdownItem>
                <DropdownItem onClick={() => deleteKey(user.id)}>
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

  const backupKeyring = (user) => {
    const randomHex = generateRandomHexCode();
    const privateKey = user.privateKey;
    const blob = new Blob([privateKey], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${user.name}_${randomHex}_SECRET.asc`;
    link.click();
  };

  const deleteKey = async (userId) => {
    const currentKeys = JSON.parse(localStorage.getItem("pgpKeys")) || [];
    const updatedKeys = currentKeys.filter((key) => key.id !== userId);
    localStorage.setItem("pgpKeys", JSON.stringify(updatedKeys));

    const refreshedKeys = await loadKeysFromLocalStorage();
    setUsers(refreshedKeys);
    setPage(1);
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
    visibleColumns,
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
      <TableBody emptyContent={"No keyrings found"} items={sortedItems}>
        {(item) => (
          <TableRow key={item.id}>
            {(columnKey) => (
              <TableCell>{renderCell(item, columnKey)}</TableCell>
            )}
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
