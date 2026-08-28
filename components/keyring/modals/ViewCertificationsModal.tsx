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

const statusColorMap: Record<string, "success" | "danger" | "warning" | "default" | "primary" | "secondary"> = { active: "success", expired: "danger", revoked: "danger" };
const passwordprotectedColorMap: Record<string, "success" | "danger" | "warning" | "default" | "primary" | "secondary"> = { Yes: "success", No: "danger" };

const columnsModal3 = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  { name: "EMAIL", uid: "email", width: "30%", align: "center", sortable: true },
  { name: "CREATION DATE", uid: "creationdate", align: "center", width: "20%", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", width: "15%", sortable: true },
  { name: "STATUS", uid: "status", width: "20%", align: "center", sortable: true },
  { name: "PASSWORD", uid: "passwordprotected", align: "center", sortable: true },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
];

interface ViewCertificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  hasUnknownCertifier?: boolean;
  onSearchUnknownCertifiers?: () => void;
}

export default function ViewCertificationsModal({
  isOpen,
  onClose,
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
  hasUnknownCertifier,
  onSearchUnknownCertifiers,
}: ViewCertificationsModalProps) {
  const headerColumns =
    visibleColumns === "all"
      ? columnsModal3
      : columnsModal3.filter((c) => Array.from(visibleColumns).includes(c.uid));

  const renderCell = (user: any, columnKey: any) => {
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
      default:
        return value;
    }
  };

  const topContent = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          type="search"
          name="certs-search"
          autoComplete="off"
          data-1p-ignore="true"
          data-lpignore="true"
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
            {columnsModal3.map((c) => (
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
    <div className="py-2 px-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-4 justify-between">
      <div className="flex-shrink-0">
        <Pagination isCompact showControls showShadow color="default" page={page} total={pages ?? 1} onChange={setPage} />
      </div>

      {hasUnknownCertifier && (
        <div className="flex justify-center sm:min-w-0 order-2 sm:order-none mt-2 sm:mt-0">
          <Button variant="flat" className="text-wrap p-7 sm:p-4" onPress={onSearchUnknownCertifiers}>
            🔍 Search Unknown Certifiers Keys On Key Server
          </Button>
        </div>
      )}

      <div className="flex-shrink-0 flex space-x-2">
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
          aria-label="Certifications Table"
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
                <Spinner size="lg" color="warning" label={<div className="text-center">Loading Certifications...<br /><span className="text-gray-300 text-sm">This may take some time depending <br className="block sm:hidden" />on your device&apos;s performance.</span></div> as any} />
              </div>
            }
            isLoading={isLoading}
            emptyContent={<><span>No Certifications found</span></>}
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
