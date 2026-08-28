"use client";

import { useEffect, useCallback, useMemo, Key } from "react";
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
  Spinner,
} from "@heroui/react";
import { SearchIcon, ChevronDownIcon } from "@/components/icons";
import { NProgressLink } from "@/components/nprogress";
import { useRouter } from "next/navigation";
import { useVault } from "@/context/VaultContext";
import ConnectivityCheck from "@/components/connectivity-check";
import NProgress from "nprogress";
import { capitalize } from "@/lib/pgp";

export type CloudKeyRecord = {
  id?: string | number;
  name?: string;
  email?: string;
  creationdate?: string;
  expirydate?: string;
  keystatus?: "active" | "expired" | "Corrupted" | string;
  passwordprotected?: "Yes" | "No" | string;
  status?: "Backed Up" | "Not Backed Up" | "Imported" | "Not Imported" | string;
  keyid?: string;
  fingerprint?: string;
  algorithm?: string;
  avatar?: string;
  [key: string]: any;
};

import { useCloudTableState } from "@/hooks/useCloudTableState";

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
  { name: "NAME", uid: "name", sortable: true },
  { name: "EMAIL", uid: "email", align: "center", sortable: true },
  { name: "CREATION DATE", uid: "creationdate", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", sortable: true },
  { name: "KEY STATUS", uid: "keystatus", align: "center", sortable: true },
  { name: "PASSWORD", uid: "passwordprotected", align: "center", sortable: true },
  { name: "STATUS", uid: "status", align: "center", sortable: true },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "BACKUP", uid: "backup", align: "center" },
];
import { useCloudBackupOps } from "@/hooks/useCloudBackupOps";
import { usePasswordModal } from "@/hooks/usePasswordModal";
import PasswordModal from "@/components/keyring/modals/PasswordModal";

const statusColorMap: Record<string, any> = {
  "Backed Up": "success",
  "Not Backed Up": "danger",
};

const keyStatusColorMap: Record<string, any> = {
  active: "success",
  expired: "danger",
};

const passwordprotectedColorMap: Record<string, any> = {
  Yes: "success",
  No: "danger",
};

export default function CloudBackupPage() {
  const router = useRouter();
  const { getVaultPassword, getVaultKeyMaterial, lockVault } = useVault();

  // 1. Table State
  const tableState = useCloudTableState({
    initialColumns: INITIAL_VISIBLE_COLUMNS,
    allColumns: columns,
    storageKey: "cloudVisibleColumns",
  });

  // 2. Password Modal Hook
  const passwordModalState = usePasswordModal();
  const { triggerKeyPasswordModal } = passwordModalState;

  // 3. Cloud Backup Operations Hook
  const backupOps = useCloudBackupOps({
    page: tableState.page,
    rowsPerPage: tableState.rowsPerPage,
    setUsers: tableState.setUsers,
    setTotalKeys: tableState.setTotalKeys,
    setIsLoading: tableState.setIsLoading,
    isLoadingKeys: tableState.isLoadingKeys,
    setIsLoadingKeys: tableState.setIsLoadingKeys,
    getVaultPassword,
    getVaultKeyMaterial,
    router,
    triggerPasswordModal: triggerKeyPasswordModal,
  });

  const itemsWithLoading = useMemo(() => {
    return tableState.sortedItems.map((item: any) => ({
      ...item,
      isBackingUp: backupOps.backingUpKeyIds.has(item.id),
    }));
  }, [tableState.sortedItems, backupOps.backingUpKeyIds]);

  useEffect(() => {
    const checkVault = async () => {
      const vaultPassword = await getVaultPassword();
      if (!vaultPassword) {
        try {
          if (!(window as any).vaultLockInProgress) {
            await lockVault();
          }
        } catch (err) {
          console.error("Failed to lock vault:", err);
        } finally {
          NProgress.start();
          router.push("/vault");
        }
      }
    };
    checkVault();
  }, [router, getVaultPassword, lockVault]);

  // Fetch keys when page or rowsPerPage changes
  useEffect(() => {
    backupOps.fetchKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableState.page, tableState.rowsPerPage]);

  // Handle storage changes (e.g. key added in another tab)
  useEffect(() => {
    const handleStorageChange = async () => {
      try {
        backupOps.fetchInProgressRef.current = false;
        backupOps.fetchKeys();
      } catch (error) {
        console.error("Error loading keys:", error);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableState.page, tableState.rowsPerPage]);

  const renderCell = useCallback((user: CloudKeyRecord, columnKey: Key): any => {
    const cellValue = user[columnKey as keyof CloudKeyRecord];

    switch (columnKey) {
      case "name":
        return <User avatarProps={{ radius: "lg", src: user.avatar }} name={cellValue} />;
      case "keystatus":
        return <Chip className="-ms-5 capitalize" color={keyStatusColorMap[user.keystatus as string] as any} variant="flat">{cellValue}</Chip>;
      case "status":
        return <Chip className="capitalize -ms-4" color={statusColorMap[user.status as string] as any} variant="flat">{cellValue}</Chip>;
      case "passwordprotected":
        return <Chip className="-ms-6 capitalize" color={passwordprotectedColorMap[user.passwordprotected as string] as any} variant="flat">{cellValue}</Chip>;
      case "backup": {
        const isBackingUp = user.isBackingUp || (user.id !== undefined && backupOps.backingUpKeyIds.has(user.id));
        return (
          <Button
            className="ms-2"
            color="secondary"
            variant="flat"
            isLoading={isBackingUp}
            onPress={() => backupOps.backupKey(user)}
          >
            {!isBackingUp && "Backup"}
          </Button>
        );
      }
      default:
        return cellValue;
    }
  }, [backupOps]);

  const topContent = useMemo(() => {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-center text-4xl font-serif">Backup Keyrings On Cloud</h1>
        <br />
        <div className="flex justify-between gap-3 items-end">
          <Input
            isClearable
            type="search"
            name="search"
            autoComplete="off"
            data-1p-ignore="true"
            data-lpignore="true"
            className="w-full sm:max-w-[100%]"
            placeholder="Search all fields (name, email, dates, status, key ID, fingerprint, etc.)"
            startContent={<SearchIcon />}
            value={tableState.filterValue}
            onClear={() => tableState.onClear()}
            onValueChange={tableState.onSearchChange}
          />
          <Dropdown>
            <DropdownTrigger>
              <Button endContent={<ChevronDownIcon className="text-small" />} variant="faded" className="border-0">
                Columns
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Table Columns"
              closeOnSelect={false}
              selectedKeys={tableState.visibleColumns}
              selectionMode="multiple"
              onSelectionChange={tableState.setVisibleColumns as any}
            >
              {columns.filter((column) => column.uid !== "backup").map((column) => (
                <DropdownItem key={column.uid} className="capitalize">
                  {capitalize(column.name)}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-default-400 text-small">Total {tableState.totalKeys} keys</span>
          <label className="flex items-center text-default-400 text-small">
            Rows per page:
            <select
              className="bg-transparent outline-none text-default-400 text-small"
              onChange={tableState.onRowsPerPageChange}
              value={tableState.rowsPerPage}
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
    tableState.filterValue,
    tableState.onRowsPerPageChange,
    tableState.rowsPerPage,
    tableState.totalKeys,
    tableState.visibleColumns,
    tableState.onSearchChange,
    tableState.onClear,
    tableState.setVisibleColumns,
  ]);

  const bottomContent = useMemo(() => {
    return (
      <div className="py-2 px-2 relative flex justify-between items-center">
        <Pagination
          isCompact
          showControls
          showShadow
          color="default"
          page={tableState.page}
          total={tableState.pages}
          onChange={tableState.handlePageChange}
        />
        <div className="sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2">
          <Button
            className="sm:min-w-40 min-w-32 pl-3"
            isDisabled={tableState.locking}
            onPress={async () => {
              tableState.setLocking(true);
              try {
                await lockVault();
                NProgress.start();
                router.push("/vault");
              } catch {
                // Ignore
              } finally {
                tableState.setLocking(false);
              }
            }}
          >
            {tableState.locking ? <Spinner color="white" size="sm" /> : "🔒 Lock Vault"}
          </Button>
        </div>
        <div className="hidden sm:flex w-[30%] justify-end gap-2">
          <Button isDisabled={tableState.pages === 1} size="sm" variant="flat" onPress={() => tableState.handlePageChange(tableState.page - 1)}>
            Previous
          </Button>
          <Button isDisabled={tableState.pages === 1} size="sm" variant="flat" onPress={() => tableState.handlePageChange(tableState.page + 1)}>
            Next
          </Button>
        </div>
      </div>
    );
  }, [tableState.page, tableState.pages, tableState.locking, lockVault, router, tableState]);

  return (
    <>
      <ConnectivityCheck />
      <Table
        isHeaderSticky
        aria-label="Keyrings Table"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        classNames={{ wrapper: "max-h-[382px]" }}
        sortDescriptor={tableState.sortDescriptor}
        topContent={topContent}
        topContentPlacement="outside"
        onSortChange={tableState.setSortDescriptor}
      >
        <TableHeader columns={tableState.headerColumns}>
          {(column: any) => (
            <TableColumn
              key={column.uid}
              align={["email", "keystatus", "passwordprotected", "status", "keyid", "fingerprint", "algorithm", "backup"].includes(column.uid) ? "center" : "start"}
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
              <Spinner size="lg" color="warning" label={<div className="text-center">Loading keyrings...<br /><span className="text-gray-300 text-sm">This may take some time depending <br className="block sm:hidden" />on your device&apos;s performance.</span></div> as any} />
            </div>
          }
          isLoading={tableState.isLoading}
          emptyContent={
            <>
              <span>No keyrings found</span>
              <br />
              <br />
              <div className="ms-2 flex justify-center">
                <Button className="ps-10 pe-10" as={NProgressLink} href="/cloud-manage">
                  Import Keyrings From Cloud
                </Button>
              </div>
            </>
          }
          items={itemsWithLoading}
        >
          {(item: any) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey) as any}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>
      <PasswordModal
        isOpen={passwordModalState.passwordModal}
        onClose={passwordModalState.onPasswordModalClose}
        subkeyGlobalIndex={passwordModalState.subkeyGlobalIndex}
        password={passwordModalState.password}
        setPassword={passwordModalState.setPassword}
        isVisible={passwordModalState.isVisible}
        toggleVisibility={passwordModalState.toggleVisibility}
        newKeyPassword={passwordModalState.newKeyPassword}
        inputRef={passwordModalState.passwordInputRef}
      />
    </>
  );
}
