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
  Tooltip,
} from "@heroui/react";
import { SearchIcon } from "@/components/icons";

const statusColorMap = {
  active: "success",
  expired: "danger",
  revoked: "danger",
};

const columnsModal = [
  { name: "NAME", uid: "name", width: "15%", sortable: true },
  { name: "EMAIL", uid: "email", width: "50%", align: "center", sortable: true },
  { name: "STATUS", uid: "status", width: "20%", align: "center", sortable: true },
  { name: "PRIMARY", uid: "primary", align: "center" },
  { name: "REVOKE", uid: "revoke", align: "center" },
];

export default function ManageUserIDsModal({
  isOpen,
  onClose,
  selectedUserId,
  modalUserIDs,
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
  // actions
  onSetPrimary,
  onTriggerRevoke,
}) {
  const renderCell = (row, columnKey) => {
    const cellValue = row[columnKey];
    const isFirstRow = page === 1 && sortedItems[0]?.id === row.id;

    switch (columnKey) {
      case "name":
        return (
          <div className="flex flex-row">
            <span className="pe-1">{cellValue}</span>
            {isFirstRow && <Tooltip content="Primary">👑</Tooltip>}
          </div>
        );
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
        return !selectedUserId?.privateKey ? (
          <Button isDisabled className="ms-2" color="secondary" variant="flat">
            Set as Primary
          </Button>
        ) : (
          <Button
            isDisabled={row.status === "revoked"}
            className="ms-2"
            color="secondary"
            variant="flat"
            onPress={() => onSetPrimary(selectedUserId, row)}
          >
            Set as Primary
          </Button>
        );
      case "revoke":
        return !selectedUserId?.privateKey ? (
          <Button isDisabled className="ms-2" color="danger" variant="flat">
            Revoke
          </Button>
        ) : (
          <Button
            isDisabled={modalUserIDs.length === 1}
            className="ms-2"
            color="danger"
            variant="flat"
            onPress={() => onTriggerRevoke(selectedUserId, row)}
          >
            Revoke
          </Button>
        );
      default:
        return cellValue;
    }
  };

  const topContent = (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full"
          placeholder="Search by name or email..."
          startContent={<SearchIcon />}
          value={filterValue}
          onClear={onClear}
          onValueChange={onSearchChange}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">
          Total {modalUserIDs.length} User IDs
        </span>
      </div>
    </div>
  );

  const bottomContent = (
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

  return (
    <Modal size="4xl" backdrop="blur" isOpen={isOpen} onClose={onClose}>
      <ModalContent className="p-7">
        <Table
          aria-label="User ID Table"
          isHeaderSticky
          bottomContent={bottomContent}
          bottomContentPlacement="outside"
          classNames={{ wrapper: "max-h-[382px]" }}
          sortDescriptor={sortDescriptor}
          topContent={topContent}
          topContentPlacement="outside"
          onSortChange={setSortDescriptor}
        >
          <TableHeader columns={columnsModal}>
            {(column) => (
              <TableColumn
                key={column.uid}
                align={
                  ["email", "status", "primary", "revoke"].includes(column.uid)
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
          <TableBody items={sortedItems}>
            {(item) => (
              <TableRow key={item.id}>
                {(columnKey) => (
                  <TableCell>{renderCell(item, columnKey)}</TableCell>
                )}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </ModalContent>
    </Modal>
  );
}
