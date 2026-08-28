"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { Selection } from "@heroui/react";

export interface KeyringUser {
  id: string;
  name?: string;
  email?: string;
  creationdate?: string;
  expirydate?: string;
  status?: string;
  passwordprotected?: string;
  usage?: string;
  keyid?: string;
  fingerprint?: string;
  algorithm?: string;
  avatar?: string;
  privateKey?: string;
}

export interface CertifierUser {
  name: string;
  email: string;
  fingerprint?: string;
  creationdate?: string;
  expirydate?: string;
  status?: string;
  passwordprotected?: string;
  keyid?: string;
}

export interface SubkeyInfo {
  id: string;
  usage?: string;
  creationdate?: string;
  expirydate?: string;
  status?: string;
  keyid?: string;
  fingerprint?: string;
  algorithm?: string;
  passwordprotected?: string;
  avatar?: string;
}
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  User,
  Pagination,
  Spinner,
} from "@heroui/react";
import { SearchIcon, ChevronDownIcon } from "@/components/icons";
import { NProgressLink } from "@/components/nprogress";
import { PasswordStatus } from "@/context/password-protection";
import KeyServer from "@/components/keyserver";

// Hooks
import { useKeyring } from "@/hooks/useKeyring";
import { useTableState } from "@/hooks/useTableState";
import { usePasswordModal } from "@/hooks/usePasswordModal";
import { useKeyOperations } from "@/hooks/useKeyOperations";

// Components
import UserActionsDropdown from "@/components/keyring/UserActionsDropdown";

// Modals
import ValidityModal from "@/components/keyring/modals/ValidityModal";
import PasswordModal from "@/components/keyring/modals/PasswordModal";
import NewPasswordModal from "@/components/keyring/modals/NewPasswordModal";
import RemovePasswordModal from "@/components/keyring/modals/RemovePasswordModal";
import AddUserIDModal from "@/components/keyring/modals/AddUserIDModal";
import ManageUserIDsModal from "@/components/keyring/modals/ManageUserIDsModal";
import RevokeUserIDModal from "@/components/keyring/modals/RevokeUserIDModal";
import AddSubkeyModal from "@/components/keyring/modals/AddSubkeyModal";
import CertifyKeyModal from "@/components/keyring/modals/CertifyKeyModal";
import ManageSubkeyModal from "@/components/keyring/modals/ManageSubkeyModal";
import ViewCertificationsModal from "@/components/keyring/modals/ViewCertificationsModal";
import RevokeUsingCertificateModal from "@/components/keyring/modals/RevokeUsingCertificateModal";
import RevokeKeyModal from "@/components/keyring/modals/RevokeKeyModal";
import RevocationReasonModal from "@/components/keyring/modals/RevocationReasonModal";
import PublishKeyModal from "@/components/keyring/modals/PublishKeyModal";
import PublicKeySnippetModal from "@/components/keyring/modals/PublicKeySnippetModal";
import DeleteKeyModal from "@/components/keyring/modals/DeleteKeyModal";

import { capitalize, loadKeysFromIndexedDB } from "@/lib/pgp";

// ---------------------------------------------------------------------------
// Table column definitions
// ---------------------------------------------------------------------------

const statusColorMap = { active: "success", expired: "danger", revoked: "danger" };
const passwordprotectedColorMap = { Yes: "success", No: "danger" };

const INITIAL_VISIBLE_COLUMNS = [
  "name", "email", "creationdate", "expirydate", "status", "passwordprotected", "actions",
];

const columns = [
  { name: "NAME", uid: "name", sortable: true },
  { name: "EMAIL", uid: "email", align: "center", sortable: true },
  { name: "CREATION DATE", uid: "creationdate", sortable: true },
  { name: "EXPIRY DATE", uid: "expirydate", sortable: true },
  { name: "STATUS", uid: "status", align: "center", sortable: true },
  { name: "PASSWORD", uid: "passwordprotected", align: "center", sortable: true },
  { name: "KEY ID", uid: "keyid", align: "center" },
  { name: "FINGERPRINT", uid: "fingerprint", align: "center" },
  { name: "ALGORITHM", uid: "algorithm", align: "center" },
  { name: "ACTIONS", uid: "actions", align: "center" },
];

const INITIAL_VISIBLE_COLUMNS_MODAL2 = [
  "name", "email", "creationdate", "expirydate", "status", "passwordprotected", "select",
];
const INITIAL_VISIBLE_COLUMNS_MODAL3 = [
  "name", "email", "creationdate", "expirydate", "status", "passwordprotected",
];
const INITIAL_VISIBLE_COLUMNS_MODAL4 = [
  "usage", "creationdate", "expirydate", "status", "passwordprotected", "actions",
];

// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

export default function App() {
  // --- Data ---
  const { users, setUsers, isLoading } = useKeyring();

  // --- Main table state ---
  const mainTable = useTableState({
    items: users,
    persistKey: "rowsPerPage",
    rowsPerPage: 10,
    filterFn: (user, val) => {
      const lv = val.toLowerCase();
      return [
        user.name, user.email, user.creationdate, user.expirydate,
        user.status, user.keyid, user.fingerprint, user.algorithm,
        user.passwordprotected,
      ].some((f) => f?.toLowerCase().includes(lv));
    },
  });

  const [visibleColumns, setVisibleColumns] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS));

  const headerColumns = useMemo(() =>
    visibleColumns === "all"
      ? columns
      : columns.filter((c) => Array.from(visibleColumns as Set<any>).includes(c.uid)),
    [visibleColumns]
  );

  // --- Shared selected-key state ---
  const [selectedUserId, setSelectedUserId] = useState<any | null>(null);
  const [selectedKeyName, setSelectedKeyName] = useState<any>("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [selectedUserPublicKey, setSelectedUserPublicKey] = useState<string | null>(null);
  const [publicKeySnippet, setPublicKeySnippet] = useState("");
  const [selectedSubkey, setSelectedSubkey] = useState<any | null>(null);

  // --- Modal open/close booleans ---
  const [validityModal, setvalidityModal] = useState(false);
  const [removePasswordModal, setremovePasswordModal] = useState(false);
  const [addUserIDModal, setaddUserIDModal] = useState(false);
  const [manageUserIDsModal, setmanageUserIDsModal] = useState(false);
  const [revokeUserIDModal, setrevokeUserIDModal] = useState(false);
  const [addSubkeyModal, setaddSubkeyModal] = useState(false);
  const [manageSubkeyModal, setmanageSubkeyModal] = useState(false);
  const [certifyUserModal, setcertifyUserModal] = useState(false);
  const [viewCertificateModal, setviewCertificateModal] = useState(false);
  const [revokeModal, setrevokeModal] = useState(false);
  const [revokeUsingCertificateModal, setrevokeUsingCertificateModal] = useState(false);
  const [revocationReasonModal, setrevocationReasonModal] = useState(false);
  const [publishKeyModal, setpublishKeyModal] = useState(false);
  const [publicKeyModal, setpublicKeyModal] = useState(false);
  const [deleteModal, setdeleteModal] = useState(false);
  const [keyServerModal, setkeyServerModal] = useState(false);
  const [keyserverQuery, setKeyserverQuery] = useState("");

  // --- Validity modal state ---
  const [isNoExpiryChecked, setIsNoExpiryChecked] = useState(true);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);

  // --- Revocation state ---
  const [revocationReason, setRevocationReason] = useState("0");
  const [revocationReasonText, setRevocationReasonText] = useState("");
  const [revocationInfo, setRevocationInfo] = useState<any | null>(null);

  // --- Add User ID state ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameInvalid, setNameInvalid] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const nameInputRef = useRef(null);

  // --- Add Subkey state ---
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("curve25519");
  const [subkeyOption, setSubkeyOption] = useState("0");

  // --- Revoke User ID state ---
  const [userIDToRevoke, setUserIDToRevoke] = useState<any | null>(null);

  // --- Revoke Using Certificate state ---
  const [keyInput, setKeyInput] = useState("");

  // --- Password modal ---
  const passwordModalState = usePasswordModal();
  const {
    password, setPassword, isVisible, toggleVisibility,
    newKeyPassword, passwordModal,
    newPasswordChangeModal,
    subkeyGlobalIndex, setSubkeyGlobalIndex,
    passwordInputRef, newPasswordInputRef,
    onPasswordModalClose, onNewPasswordModalClose,
    triggerKeyPasswordModal, triggerNewPasswordChangeModal, triggerSubkeyPasswordModal,
  } = passwordModalState;

  // --- Manage User IDs modal state ---
  const [modalUserIDs, setModalUserIDs] = useState<KeyringUser[]>([]);

  useEffect(() => {
    if (manageUserIDsModal && selectedUserId) {
      (async () => {
        const { getUserIDsFromKeyForModal } = ops;
        const ids = await getUserIDsFromKeyForModal(selectedUserId);
        setModalUserIDs(ids);
      })();
    }
  }, [manageUserIDsModal, selectedUserId]);

  const manageUserIDsTable = useTableState({
    items: modalUserIDs,
    rowsPerPage: 5,
    filterFn: (u, val) =>
      Boolean(
        u.name?.toLowerCase().includes(val.toLowerCase()) ||
        u.email?.toLowerCase().includes(val.toLowerCase())
      ),
  });

  // --- Certify modal state (Modal2) ---
  const [usersModal2, setUsersModal2] = useState<KeyringUser[]>([]);
  const [isLoadingModal2, setIsLoadingModal2] = useState(false);

  useEffect(() => {
    if (!certifyUserModal) return;
    setIsLoadingModal2(true);
    loadKeysFromIndexedDB()
      .then((data) => setUsersModal2(data as any))
      .catch(console.error)
      .finally(() => setIsLoadingModal2(false));
  }, [certifyUserModal]);

  const [visibleColumnsModal2, setVisibleColumnsModal2] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS_MODAL2));

  const certifyTable = useTableState({
    items: usersModal2.filter(
      (u) =>
        u.privateKey?.trim() &&
        u.status !== "revoked" &&
        u.status !== "expired" &&
        (!selectedUserId || u.id !== selectedUserId.id)
    ),
    rowsPerPage: 5,
    filterFn: (user, val) => {
      const lv = val.toLowerCase();
      return [
        user.name, user.email, user.creationdate, user.expirydate,
        user.status, user.keyid, user.fingerprint, user.passwordprotected,
      ].some((f) => f?.toLowerCase().includes(lv));
    },
  });

  // --- View Certifications modal state (Modal3) ---
  const [certificationsModal3, setCertificationsModal3] = useState<CertifierUser[]>([]);
  const [isLoadingModal3, setIsLoadingModal3] = useState(false);
  const [visibleColumnsModal3, setVisibleColumnsModal3] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS_MODAL3));

  useEffect(() => {
    if (!viewCertificateModal || !selectedUserId) {
      setCertificationsModal3([]);
      return;
    }
    setIsLoadingModal3(true);
    (async () => {
      try {
        const allKeys = (await loadKeysFromIndexedDB()) as any[];
        const certs = await ops.getKeyCertifications(selectedUserId, allKeys);
        setCertificationsModal3(certs as any);
      } catch {
        setCertificationsModal3([]);
      } finally {
        setIsLoadingModal3(false);
      }
    })();
  }, [viewCertificateModal, selectedUserId]);

  const certViewTable = useTableState({
    items: certificationsModal3,
    rowsPerPage: 5,
    filterFn: (user, val) => {
      const lv = val.toLowerCase();
      return [
        user.name, user.email, user.creationdate, user.expirydate,
        user.status, user.keyid, user.fingerprint, user.passwordprotected,
      ].some((f) => (f || "").toLowerCase().includes(lv));
    },
  });

  const hasUnknownCertifier = useMemo(
    () => certificationsModal3.some((c) => c.name === "Unknown" || c.email === "Unknown"),
    [certificationsModal3]
  );

  const handleSearchUnknownCertifiers = useCallback(() => {
    const fps = certificationsModal3
      .filter((c) => c.name === "Unknown" || c.email === "Unknown")
      .map((c) => {
        const fp = (c.fingerprint || "").replace(/\s/g, "").replace(/[^A-F0-9]/gi, "").toUpperCase();
        return fp.match(/.{1,4}/g)?.join(" ") || fp;
      })
      .filter((fp) => fp.length > 0);
    setKeyserverQuery([...new Set(fps)].join(","));
    setkeyServerModal(true);
  }, [certificationsModal3]);

  // --- Manage Subkeys modal state (Modal4) ---
  const [usersModal4, setUsersModal4] = useState<SubkeyInfo[]>([]);
  const [isLoadingModal4, setIsLoadingModal4] = useState(false);
  const [visibleColumnsModal4, setVisibleColumnsModal4] = useState<Selection>(new Set(INITIAL_VISIBLE_COLUMNS_MODAL4));

  // --- Key operations ---
  const ops = useKeyOperations({
    setUsers,
    triggerKeyPasswordModal,
    triggerNewPasswordChangeModal,
    triggerSubkeyPasswordModal,
    setSubkeyGlobalIndex,
    selectedUserId,
    selectedKeyName,
    selectedKeyId,
    revocationReason,
    revocationReasonText,
    setRevocationReasonText,
    page: mainTable.page,
    setPage: mainTable.setPage,
    rowsPerPage: mainTable.rowsPerPage,
  });

  useEffect(() => {
    if (!manageSubkeyModal || !selectedUserId) return;
    setIsLoadingModal4(true);
    setUsersModal4([]);
    ops.manageSubkeys(selectedUserId)
      .then(setUsersModal4)
      .catch((e) => { setUsersModal4([]); console.error(e); })
      .finally(() => setIsLoadingModal4(false));
  }, [manageSubkeyModal, selectedUserId]);

  const subkeyTable = useTableState({
    items: usersModal4,
    rowsPerPage: 5,
    filterFn: (user, val) => {
      const lv = val.toLowerCase();
      return [
        user.usage, user.creationdate, user.expirydate,
        user.status, user.keyid, user.fingerprint, user.passwordprotected,
      ].some((f) => f?.toLowerCase().includes(lv));
    },
  });

  const refreshKeys = useCallback(async () => {
    const refreshedKeys = await loadKeysFromIndexedDB();
    setUsers(refreshedKeys as any);
  }, [setUsers]);

  // ---------------------------------------------------------------------------
  // renderCell for the main keyrings table
  // ---------------------------------------------------------------------------

  const renderCell = useCallback(
    (user: any, columnKey: any) => {
      const cellValue = user[columnKey as keyof typeof user];
      switch (columnKey) {
        case "name":
          return (
            <User avatarProps={{ radius: "lg", src: user.avatar }} name={cellValue} />
          ) as any;
        case "status":
          return (
            <Chip
              className="-ms-5 capitalize"
              color={statusColorMap[user.status as keyof typeof statusColorMap] as any}
              variant="flat"
            >
              {cellValue}
            </Chip>
          ) as any;
        case "passwordprotected":
          return (
            <Chip
              className="-ms-6 capitalize"
              color={passwordprotectedColorMap[user.passwordprotected as keyof typeof passwordprotectedColorMap] as any}
              variant="flat"
            >
              {cellValue}
            </Chip>
          ) as any;
        case "actions":
          return (
            <UserActionsDropdown
              user={user}
              setSelectedUserId={setSelectedUserId}
              setSelectedKeyName={setSelectedKeyName as any}
              setSelectedKeyId={setSelectedKeyId}
              setrevocationReasonModal={setrevocationReasonModal}
              setRevocationInfo={setRevocationInfo}
              setmanageUserIDsModal={setmanageUserIDsModal}
              setpublishKeyModal={setpublishKeyModal}
              setSelectedUserPublicKey={setSelectedUserPublicKey as any}
              setPublicKeySnippet={setPublicKeySnippet}
              setpublicKeyModal={setpublicKeyModal}
              setvalidityModal={setvalidityModal}
              setIsNoExpiryChecked={setIsNoExpiryChecked}
              setExpiryDate={setExpiryDate}
              setremovePasswordModal={setremovePasswordModal}
              setaddUserIDModal={setaddUserIDModal}
              setmanageSubkeyModal={setmanageSubkeyModal}
              setaddSubkeyModal={setaddSubkeyModal}
              setcertifyUserModal={setcertifyUserModal}
              setviewCertificateModal={setviewCertificateModal}
              setrevokeModal={setrevokeModal}
              setrevokeUsingCertificateModal={setrevokeUsingCertificateModal}
              setdeleteModal={setdeleteModal}
              backupKeyring={ops.backupKeyring}
              addOrChangeKeyPassword={ops.addOrChangeKeyPassword}
              generateRevocationCertificate={ops.generateRevocationCertificate}
              getRevocationReason={ops.getRevocationReason}
            />
          );
        default:
          return cellValue as any;
      }
    },
    [ops, setSelectedUserId]
  );

  // ---------------------------------------------------------------------------
  // topContent / bottomContent for the main table
  // ---------------------------------------------------------------------------

  const topContent = useMemo(() => (
    <div className="flex flex-col gap-4">
      <h1 className="text-center text-4xl font-serif">Manage Keyrings</h1>
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
          value={mainTable.filterValue}
          onClear={mainTable.onClear}
          onValueChange={mainTable.onSearchChange}
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
            {columns
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
        <span className="text-default-400 text-small">Total {users.length} keys</span>
        <label className="flex items-center text-default-400 text-small">
          Rows per page:
          <select
            className="bg-transparent outline-none text-default-400 text-small"
            value={mainTable.rowsPerPage}
            onChange={mainTable.onRowsPerPageChange}
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
  ), [mainTable.filterValue, mainTable.rowsPerPage, users.length, visibleColumns]);

  const bottomContent = useMemo(() => (
    <div className="px-2 flex justify-between items-center py-2 sm:py-12 flex-col sm:flex-row gap-2 sm:gap-0">
      <Pagination
        isCompact showControls showShadow
        color="default"
        page={mainTable.page}
        total={mainTable.pages}
        onChange={mainTable.setPage}
      />
      <div className="w-full flex justify-center mt-3 sm:mt-0 sm:absolute sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:w-auto">
        <PasswordStatus />
      </div>
      <div className="hidden sm:flex w-[30%] justify-end gap-2">
        <Button isDisabled={mainTable.pages === 1} size="sm" variant="flat" onPress={mainTable.onPreviousPage}>Previous</Button>
        <Button isDisabled={mainTable.pages === 1} size="sm" variant="flat" onPress={mainTable.onNextPage}>Next</Button>
      </div>
    </div>
  ), [mainTable.page, mainTable.pages]);

  // ---------------------------------------------------------------------------
  // handleFileInput (used by RevokeUsingCertificateModal)
  // ---------------------------------------------------------------------------

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setKeyInput(event.target?.result as string);
    reader.readAsText(file);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Key Server search dialog */}
      <KeyServer
        isOpen={keyServerModal}
        onClose={() => setkeyServerModal(false)}
        initialSearch={keyserverQuery}
        onKeyImported={refreshKeys}
      />

      {/* Main keyrings table */}
      <Table
        isHeaderSticky
        aria-label="Keyrings Table"
        bottomContent={bottomContent}
        bottomContentPlacement="outside"
        sortDescriptor={mainTable.sortDescriptor as any}
        topContent={topContent}
        topContentPlacement="outside"
        onSortChange={mainTable.setSortDescriptor as any}
      >
        <TableHeader columns={headerColumns}>
          {(column) => (
            <TableColumn
              key={column.uid}
              align={
                ["email","passwordprotected","status","keyid","fingerprint","algorithm","actions"].includes(column.uid)
                  ? "center"
                  : "start"
              }
              allowsSorting={column.sortable}
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
                  (<div className="text-center">
                    Loading keyrings...<br />
                    <span className="text-gray-300 text-sm">
                      This may take some time depending{" "}
                      <br className="block sm:hidden" />
                      on your device&apos;s performance.
                    </span>
                  </div>) as any
                }
              />
            </div>
          }
          isLoading={isLoading}
          emptyContent={
            <>
              <span>No keyrings found</span>
              <br /><br />
              <div className="ms-6 flex justify-center">
                <Button as={NProgressLink} href="/import">Import Key</Button>
                <span className="mx-3 mt-2">or</span>
                <Button as={NProgressLink} href="/cloud-manage">Import Keyrings From Cloud</Button>
                <span className="mx-3 mt-2">or</span>
                <Button as={NProgressLink} href="/generate">Generate Key</Button>
              </div>
            </>
          }
          items={mainTable.sortedItems}
        >
          {(item) => (
            <TableRow key={item.id}>
              {(columnKey) => <TableCell>{renderCell(item, columnKey)}</TableCell>}
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* ------------------------------------------------------------------ */}
      {/* Modals                                                               */}
      {/* ------------------------------------------------------------------ */}

      <ValidityModal
        isOpen={validityModal}
        onClose={() => setvalidityModal(false)}
        isNoExpiryChecked={isNoExpiryChecked}
        setIsNoExpiryChecked={setIsNoExpiryChecked}
        expiryDate={expiryDate}
        setExpiryDate={setExpiryDate}
        onConfirm={async () => {
          if (manageSubkeyModal && selectedSubkey !== null) {
            const ok = await ops.changeSubkeyValidity(selectedSubkey, {
              isNoExpiryChecked,
              expiryDate,
            });
            if (ok) {
              setvalidityModal(false);
              setSelectedSubkey(null);
              if (selectedUserId) {
                const refreshed = await loadKeysFromIndexedDB();
                const updated = refreshed.find((u: any) => u.id === selectedUserId.id);
                if (updated) {
                  setSelectedUserId(updated);
                  const subkeys = await ops.manageSubkeys(updated);
                  setUsersModal4(subkeys);
                }
              }
            }
          } else {
            const ok = await ops.changeKeyValidity({
              isNoExpiryChecked,
              expiryDate,
            });
            if (ok) {
              setvalidityModal(false);
              setSelectedUserId(null);
            }
          }
        }}
      />

      <PasswordModal
        isOpen={passwordModal}
        onClose={onPasswordModalClose}
        subkeyGlobalIndex={subkeyGlobalIndex}
        password={password}
        setPassword={setPassword}
        isVisible={isVisible}
        toggleVisibility={toggleVisibility}
        newKeyPassword={newKeyPassword}
        inputRef={passwordInputRef}
      />

      <NewPasswordModal
        isOpen={newPasswordChangeModal}
        onClose={onNewPasswordModalClose}
        subkeyGlobalIndex={subkeyGlobalIndex}
        password={password}
        setPassword={setPassword}
        isVisible={isVisible}
        toggleVisibility={toggleVisibility}
        newKeyPassword={newKeyPassword}
        inputRef={newPasswordInputRef}
      />

      <RemovePasswordModal
        isOpen={removePasswordModal}
        onClose={() => setremovePasswordModal(false)}
        selectedKeyName={selectedKeyName}
        onConfirm={async () => {
          const ok = await ops.removePasswordFromKey();
          if (ok) {
            setremovePasswordModal(false);
          }
        }}
      />

      <AddUserIDModal
        isOpen={addUserIDModal}
        onClose={() => setaddUserIDModal(false)}
        name={name}
        setName={setName}
        email={email}
        setEmail={setEmail}
        nameInvalid={nameInvalid}
        emailInvalid={emailInvalid}
        nameInputRef={nameInputRef}
        onAdd={async () => {
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
          const ok = await ops.addUserID(selectedUserId, { name, email });
          if (ok) {
            setaddUserIDModal(false);
            setName("");
            setEmail("");
          }
        }}
      />

      <ManageUserIDsModal
        isOpen={manageUserIDsModal}
        onClose={() => setmanageUserIDsModal(false)}
        selectedUserId={selectedUserId}
        modalUserIDs={modalUserIDs}
        filterValue={manageUserIDsTable.filterValue}
        onSearchChange={manageUserIDsTable.onSearchChange}
        onClear={manageUserIDsTable.onClear}
        sortDescriptor={manageUserIDsTable.sortDescriptor as any}
        setSortDescriptor={manageUserIDsTable.setSortDescriptor as any}
        sortedItems={manageUserIDsTable.sortedItems}
        page={manageUserIDsTable.page}
        setPage={manageUserIDsTable.setPage}
        pages={manageUserIDsTable.pages}
        onNextPage={manageUserIDsTable.onNextPage}
        onPreviousPage={manageUserIDsTable.onPreviousPage}
        onSetPrimary={async (user, row) => {
          const ok = await ops.setPrimaryUserID(user, row);
          if (ok && selectedUserId) {
            const ids = await ops.getUserIDsFromKeyForModal(selectedUserId);
            setModalUserIDs(ids);
          }
        }}
        onTriggerRevoke={(_user, row) => {
          setUserIDToRevoke(row);
          setrevokeUserIDModal(true);
        }}
      />

      <RevokeUserIDModal
        isOpen={revokeUserIDModal}
        onClose={() => setrevokeUserIDModal(false)}
        userIDToRevoke={userIDToRevoke}
        onConfirm={async () => {
          const ok = await ops.revokeUserID(selectedUserId, userIDToRevoke);
          if (ok) {
            setrevokeUserIDModal(false);
            if (selectedUserId) {
              const ids = await ops.getUserIDsFromKeyForModal(selectedUserId);
              setModalUserIDs(ids);
            }
          }
        }}
      />

      <AddSubkeyModal
        isOpen={addSubkeyModal}
        onClose={() => setaddSubkeyModal(false)}
        selectedUserId={selectedUserId}
        isNoExpiryChecked={isNoExpiryChecked}
        setIsNoExpiryChecked={setIsNoExpiryChecked}
        expiryDate={expiryDate}
        setExpiryDate={setExpiryDate}
        selectedAlgorithm={selectedAlgorithm}
        setSelectedAlgorithm={setSelectedAlgorithm}
        subkeyOption={subkeyOption}
        setSubkeyOption={setSubkeyOption}
        onAdd={async () => {
          const ok = await ops.addSubkey(selectedUserId, {
            selectedAlgorithm,
            subkeyOption,
            isNoExpiryChecked,
            expiryDate,
          });
          if (ok) {
            setaddSubkeyModal(false);
            if (selectedUserId) {
              const refreshed = await loadKeysFromIndexedDB();
              const updated = refreshed.find((u: any) => u.id === selectedUserId.id);
              if (updated) {
                setSelectedUserId(updated);
                if (manageSubkeyModal) {
                  const subkeys = await ops.manageSubkeys(updated);
                  setUsersModal4(subkeys);
                }
              }
            }
          }
        }}
      />

      <CertifyKeyModal
        isOpen={certifyUserModal}
        onClose={() => setcertifyUserModal(false)}
        filterValue={certifyTable.filterValue}
        onSearchChange={certifyTable.onSearchChange}
        onClear={certifyTable.onClear}
        sortDescriptor={certifyTable.sortDescriptor as any}
        setSortDescriptor={certifyTable.setSortDescriptor as any}
        sortedItems={certifyTable.sortedItems}
        page={certifyTable.page}
        setPage={certifyTable.setPage}
        pages={certifyTable.pages}
        onNextPage={certifyTable.onNextPage}
        onPreviousPage={certifyTable.onPreviousPage}
        visibleColumns={visibleColumnsModal2}
        setVisibleColumns={setVisibleColumnsModal2}
        totalItems={certifyTable.filteredItems.length}
        isLoading={isLoadingModal2}
        onCertify={async (certifierUser) => {
          const ok = await ops.certifyUserKey(certifierUser, selectedUserId);
          if (ok) {
            setcertifyUserModal(false);
          }
        }}
      />

      <ManageSubkeyModal
        isOpen={manageSubkeyModal}
        onClose={() => {
          setmanageSubkeyModal(false);
          setSubkeyGlobalIndex(null);
        }}
        selectedUserId={selectedUserId}
        filterValue={subkeyTable.filterValue}
        onSearchChange={subkeyTable.onSearchChange}
        onClear={subkeyTable.onClear}
        sortDescriptor={subkeyTable.sortDescriptor as any}
        setSortDescriptor={subkeyTable.setSortDescriptor as any}
        sortedItems={subkeyTable.sortedItems}
        page={subkeyTable.page}
        setPage={subkeyTable.setPage}
        pages={subkeyTable.pages}
        onNextPage={subkeyTable.onNextPage}
        onPreviousPage={subkeyTable.onPreviousPage}
        visibleColumns={visibleColumnsModal4}
        setVisibleColumns={setVisibleColumnsModal4}
        totalItems={usersModal4.length}
        isLoading={isLoadingModal4}
        onBackupSubkey={ops.backupSubkey as any}
        onAddOrChangeSubkeyPassword={async (idx: number) => {
          const updated = await ops.addOrChangeSubkeyPassword(idx);
          if (updated) {
            setSelectedUserId(updated);
            const subkeys = await ops.manageSubkeys(updated);
            setUsersModal4(subkeys);
          }
        }}
        onRemoveSubkeyPassword={async (idx: number) => {
          const updated = await ops.removeSubkeyPassword(idx);
          if (updated) {
            setSelectedUserId(updated);
            const subkeys = await ops.manageSubkeys(updated);
            setUsersModal4(subkeys);
          }
        }}
        setSubkeyGlobalIndex={setSubkeyGlobalIndex}
        setSelectedSubkey={setSelectedSubkey}
        setvalidityModal={setvalidityModal}
        setIsNoExpiryChecked={setIsNoExpiryChecked}
        setExpiryDate={setExpiryDate}
        setrevokeModal={setrevokeModal}
        setrevocationReasonModal={setrevocationReasonModal}
        setRevocationInfo={setRevocationInfo}
      />

      <ViewCertificationsModal
        isOpen={viewCertificateModal}
        onClose={() => setviewCertificateModal(false)}
        filterValue={certViewTable.filterValue}
        onSearchChange={certViewTable.onSearchChange}
        onClear={certViewTable.onClear}
        sortDescriptor={certViewTable.sortDescriptor as any}
        setSortDescriptor={certViewTable.setSortDescriptor as any}
        sortedItems={certViewTable.sortedItems}
        page={certViewTable.page}
        setPage={certViewTable.setPage}
        pages={certViewTable.pages}
        onNextPage={certViewTable.onNextPage}
        onPreviousPage={certViewTable.onPreviousPage}
        visibleColumns={visibleColumnsModal3}
        setVisibleColumns={setVisibleColumnsModal3}
        totalItems={certificationsModal3.length}
        isLoading={isLoadingModal3}
        hasUnknownCertifier={hasUnknownCertifier}
        onSearchUnknownCertifiers={handleSearchUnknownCertifiers}
      />

      <RevokeUsingCertificateModal
        isOpen={revokeUsingCertificateModal}
        onClose={() => setrevokeUsingCertificateModal(false)}
        selectedKeyName={selectedKeyName}
        selectedUserId={selectedUserId}
        keyInput={keyInput}
        setKeyInput={setKeyInput}
        handleFileInput={handleFileInput}
        onConfirm={async (user, cert) => {
          const ok = await ops.revokeUsingCertificate(user, cert);
          if (ok) {
            setrevokeUsingCertificateModal(false);
            setKeyInput("");
          }
        }}
      />

      <RevokeKeyModal
        isOpen={revokeModal}
        onClose={() => {
          setrevokeModal(false);
          setSubkeyGlobalIndex(null);
        }}
        selectedKeyName={selectedKeyName}
        selectedUserId={selectedUserId}
        subkeyGlobalIndex={subkeyGlobalIndex}
        revocationReason={revocationReason}
        setRevocationReason={setRevocationReason}
        revocationReasonText={revocationReasonText}
        setRevocationReasonText={setRevocationReasonText}
        onConfirm={async () => {
          if (manageSubkeyModal && selectedSubkey !== null) {
            const ok = await ops.revokeSubkey(selectedSubkey);
            if (ok) {
              setrevokeModal(false);
              setSelectedSubkey(null);
              if (selectedUserId) {
                const refreshed = await loadKeysFromIndexedDB();
                const updated = refreshed.find((u: any) => u.id === selectedUserId.id);
                if (updated) {
                  setSelectedUserId(updated);
                  const subkeys = await ops.manageSubkeys(updated);
                  setUsersModal4(subkeys);
                }
              }
            }
          } else {
            const ok = await ops.revokeKey(selectedUserId);
            if (ok) {
              setrevokeModal(false);
            }
          }
        }}
      />

      <RevocationReasonModal
        isOpen={revocationReasonModal}
        onClose={() => setrevocationReasonModal(false)}
        selectedKeyName={selectedKeyName}
        selectedUserId={selectedUserId}
        subkeyGlobalIndex={subkeyGlobalIndex}
        revocationInfo={revocationInfo}
      />

      <PublishKeyModal
        isOpen={publishKeyModal}
        onClose={() => setpublishKeyModal(false)}
        selectedKeyName={selectedKeyName}
        onConfirm={async () => {
          const ok = await ops.publishKeyOnServer();
          if (ok) {
            setpublishKeyModal(false);
          }
        }}
      />

      <PublicKeySnippetModal
        isOpen={publicKeyModal}
        onClose={() => setpublicKeyModal(false)}
        publicKeySnippet={publicKeySnippet}
        onDownload={() => {
          ops.exportPublicKey(selectedUserPublicKey);
          setpublicKeyModal(false);
        }}
      />

      <DeleteKeyModal
        isOpen={deleteModal}
        onClose={() => setdeleteModal(false)}
        selectedKeyName={selectedKeyName}
        onConfirm={async () => {
          await ops.deleteKey(selectedUserId);
          setdeleteModal(false);
        }}
      />
    </>
  );
}
