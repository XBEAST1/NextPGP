"use client";

import {
  Modal,
  ModalContent,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Pagination,
  Chip,
  User,
  Spinner,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import { SearchIcon, ChevronDownIcon } from "@/components/icons";
import { capitalize } from "@/lib/pgp";
import UserActionsDropdownSubkey from "@/components/keyring/UserActionsDropdownSubkey";

const statusColorMap: Record<string, "success" | "danger" | "warning" | "default" | "primary" | "secondary"> = { active: "success", expired: "danger", revoked: "danger" };
const passwordprotectedColorMap: Record<string, "success" | "danger" | "warning" | "default" | "primary" | "secondary"> = { Yes: "success", No: "danger" };

const columnsModal4 = [
  { name: "USAGE", uid: "usage", width: "25%", sortable: true },
  { name: "CREATION DATE", uid: "creationdate", width: "25%", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", width: "18%", sortable: true },
  { name: "STATUS", uid: "status", width: "20%", align: "center", sortable: true },
  { name: "PASSWORD", uid: "passwordprotected", align: "center", sortable: true },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "ACTIONS", uid: "actions", align: "center" },
];

interface ManageSubkeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUserId?: any;
  filterValue?: string;
  onSearchChange?: (val: string) => void;
  onClear?: () => void;
  sortDescriptor?: any;
  setSortDescriptor?: (desc: any) => void;
  sortedItems?: any[];
  page?: number;
  setPage?: (page: number) => void;
  pages?: number;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  visibleColumns?: any;
  setVisibleColumns?: (cols: any) => void;
  totalItems?: number;
  isLoading?: boolean;
  onBackupSubkey?: (subkey: any) => void;
  onAddOrChangeSubkeyPassword?: (subkey: any) => void;
  onRemoveSubkeyPassword?: (subkey: any) => void;
  setSubkeyGlobalIndex?: (idx: number | null) => void;
  setSelectedSubkey?: (subkey: any) => void;
  setvalidityModal?: (open: boolean) => void;
  setIsNoExpiryChecked?: (checked: boolean) => void;
  setExpiryDate?: (date: any) => void;
  setrevokeModal?: (open: boolean) => void;
  setrevocationReasonModal?: (open: boolean) => void;
  setRevocationInfo?: (info: any) => void;
}

export default function ManageSubkeyModal({
  isOpen,
  onClose,
  selectedUserId,
  filterValue,
  onSearchChange,
  onClear,
  sortDescriptor,
  setSortDescriptor,
  sortedItems,
  page,
  setPage,
  pages,
  onNextPage,
  onPreviousPage,
  visibleColumns,
  setVisibleColumns,
  totalItems,
  isLoading,
  onBackupSubkey,
  onAddOrChangeSubkeyPassword,
  onRemoveSubkeyPassword,
  setSubkeyGlobalIndex,
  setSelectedSubkey,
  setvalidityModal,
  setIsNoExpiryChecked,
  setExpiryDate,
  setrevokeModal,
  setrevocationReasonModal,
  setRevocationInfo,
}: ManageSubkeyModalProps) {
  const headerColumns =
    visibleColumns === "all"
      ? columnsModal4
      : columnsModal4.filter((c) => Array.from(visibleColumns).includes(c.uid));

  const renderCell = (user: any, columnKey: any) => {
    const value = user[columnKey];
    switch (columnKey) {
      case "usage":
        return <User avatarProps={{ radius: "lg", src: user.avatar }} name={value} />;
      case "status":
        return (
          <Chip className="-ms-5 capitalize" color={statusColorMap[user.status]} variant="flat">
            {value}
          </Chip>
        );
      case "passwordprotected":
        return (
          <Chip className="-ms-6 capitalize" color={passwordprotectedColorMap[user.passwordprotected]} variant="flat">
            {value}
          </Chip>
        );
      case "actions":
        return (
          <UserActionsDropdownSubkey
            subkey={user}
            selectedUserId={selectedUserId}
            setSubkeyGlobalIndex={setSubkeyGlobalIndex as any}
            setSelectedSubkey={setSelectedSubkey as any}
            setvalidityModal={setvalidityModal as any}
            setIsNoExpiryChecked={setIsNoExpiryChecked as any}
            setExpiryDate={setExpiryDate as any}
            setrevokeModal={setrevokeModal as any}
            setrevocationReasonModal={setrevocationReasonModal as any}
            setRevocationInfo={setRevocationInfo as any}
            onBackupSubkey={onBackupSubkey as any}
            onAddOrChangeSubkeyPassword={onAddOrChangeSubkeyPassword as any}
            onRemoveSubkeyPassword={onRemoveSubkeyPassword as any}
          />
        );
      default:
        return value;
    }
  };

  const topContent = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[100%]"
          placeholder="Search all fields (usage, dates, status, key ID, fingerprint, algorithm)"
          startContent={<SearchIcon />}
          value={filterValue}
          onClear={onClear}
          onValueChange={onSearchChange}
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
            selectedKeys={visibleColumns}
            selectionMode="multiple"
            onSelectionChange={setVisibleColumns}
          >
            {columnsModal4
              .filter((c) => c.uid !== "actions")
              .map((c) => (
                <DropdownItem key={c.uid} className="capitalize">
                  {capitalize(c.name)}
                </DropdownItem>
              ))}
          </DropdownMenu>
        </Dropdown>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">Total {totalItems} keys</span>
      </div>
    </div>
  );

  const bottomContent = (
    <div className="py-2 px-2 flex justify-between items-center">
      <Pagination isCompact showControls showShadow color="default" page={page} total={pages ?? 1} onChange={setPage} />
      <div className="hidden sm:flex w-[30%] justify-end gap-4">
        <Button isDisabled={pages === 1} size="sm" variant="flat" onPress={onPreviousPage}>Previous</Button>
        <Button isDisabled={pages === 1} size="sm" variant="flat" onPress={onNextPage}>Next</Button>
      </div>
    </div>
  );

  return (
    <Modal size="5xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-8">
        <Table
          isHeaderSticky
          aria-label="Manage Subkey Table"
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
                  ["email","status","passwordprotected","keyid","fingerprint","algorithm","actions"].includes(column.uid)
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
                <Spinner size="lg" color="warning" label={<div className="text-center">Loading Subkeys...<br /><span className="text-gray-300 text-sm">This may take some time depending <br className="block sm:hidden" />on your device&apos;s performance.</span></div> as any} />
              </div>
            }
            isLoading={isLoading}
            emptyContent={<><span>No Subkeys found</span></>}
            items={sortedItems}
          >
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ModalContent>
    </Modal>
  );
}
