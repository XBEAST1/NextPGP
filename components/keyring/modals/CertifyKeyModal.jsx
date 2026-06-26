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

const statusColorMap = { active: "success", expired: "danger", revoked: "danger" };
const passwordprotectedColorMap = { Yes: "success", No: "danger" };

const columnsModal2 = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  { name: "EMAIL", uid: "email", width: "30%", align: "center", sortable: true },
  { name: "CREATION DATE", uid: "creationdate", align: "center", width: "20%", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", width: "15%", sortable: true },
  { name: "STATUS", uid: "status", width: "20%", align: "center", sortable: true },
  { name: "PASSWORD", uid: "passwordprotected", align: "center", sortable: true },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "SELECT", uid: "select", align: "center" },
];


export default function CertifyKeyModal({
  isOpen,
  onClose,
  // table state
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
  // action
  onCertify,
}) {
  const headerColumns =
    visibleColumns === "all"
      ? columnsModal2
      : columnsModal2.filter((c) => Array.from(visibleColumns).includes(c.uid));

  const renderCell = (user, columnKey) => {
    const value = user[columnKey];
    switch (columnKey) {
      case "name":
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
      case "select":
        return (
          <Button onPress={() => onCertify(user)} className="ms-2" color="secondary" variant="flat">
            Select
          </Button>
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
          placeholder="Search all fields (name, email, dates, status, key ID, fingerprint, etc.)"
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
            {columnsModal2
              .filter((c) => c.uid !== "select")
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
      <Pagination isCompact showControls showShadow color="default" page={page} total={pages} onChange={setPage} />
      <div className="hidden sm:flex w-[30%] justify-end gap-2">
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
          aria-label="Certify Table"
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
                  ["email","passwordprotected","status","keyid","fingerprint","algorithm","select"].includes(column.uid)
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
                <Spinner size="lg" color="warning" label={<div className="text-center">Loading keyrings...<br /><span className="text-gray-300 text-sm">This may take some time depending <br className="block sm:hidden" />on your device&apos;s performance.</span></div>} />
              </div>
            }
            isLoading={isLoading}
            emptyContent={<><span>No keyrings found</span></>}
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
