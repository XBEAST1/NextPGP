"use client";

import { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  addToast,
  Input,
  useDisclosure,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Spinner,
} from "@heroui/react";
import {
  EyeFilledIcon,
  EyeSlashFilledIcon,
  LockIcon,
  ShieldIcon,
} from "@/components/icons";
import {
  checkIfPasswordProtected,
  setAppPassword as setAppPasswordInDB,
  verifyAppPassword,
  removeAppPassword,
  deleteAllData,
  isSessionValid,
  clearDecryptedMainKey,
  getDecryptedMainKey,
} from "@/lib/indexeddb";

const PasswordProtectionContext = createContext();

export const usePasswordProtection = () => {
  const context = useContext(PasswordProtectionContext);
  if (!context) {
    throw new Error(
      "usePasswordProtection must be used within PasswordProtectionProvider"
    );
  }
  return context;
};

const PasswordSetupModal = ({ isOpen, onClose, onPasswordSet }) => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmPasswordRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && passwordInputRef.current) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError("");

    if (password !== confirmPassword) {
      addToast({
        title: "Passwords do not match",
        color: "danger",
      });
      return;
    }

    setIsLoading(true);
    try {
      await onPasswordSet(password);
      setPassword("");
      setConfirmPassword("");
      addToast({
        title: "Password set successfully",
        color: "success",
      });
      onClose();
    } catch {
      setError("Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirmPassword("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <ShieldIcon className="text-primary" />
            <span>Set App Password</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-default-500">
              Set a password to encrypt your PGP keys and protect your data.
              This password will be required each time you open the app.
            </p>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                ref={passwordInputRef}
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    confirmPasswordRef.current?.focus();
                  }
                }}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    ) : (
                      <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    )}
                  </button>
                }
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                ref={confirmPasswordRef}
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="focus:outline-none"
                  >
                    {showConfirmPassword ? (
                      <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    ) : (
                      <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    )}
                  </button>
                }
              />
            </div>

            {error && <div className="text-danger text-sm">{error}</div>}

            <div className="bg-danger-50 dark:bg-danger-200/20 p-3 rounded-lg">
              <p className="text-danger-700 dark:text-danger-500 text-sm">
                <strong>Important:</strong> Make sure to remember this password.
                If you forget it, you won&apos;t be able to access your
                encrypted data.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleSubmit}
            isDisabled={!password || !confirmPassword}
          >
            {isLoading && <Spinner size="sm" color="white" className="mr-2" />}
            Set Password
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const PasswordUnlockModal = ({
  isOpen,
  onClose,
  onPasswordVerified,
  onDeleteData,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const passwordInputRef = useRef(null);

  const handleSubmit = async () => {
    setIsLoading(true);

    const result = await onPasswordVerified(password);
    if (result.success) {
      setPassword("");
      setIsLoading(false);
      onClose();
    } else {
      addToast({
        title: "Incorrect password",
        color: "danger",
      });
      setIsLoading(false);
    }
  };

  const handleDeleteData = async () => {
    try {
      await onDeleteData();
      setPassword("");
      onClose();
    } catch (error) {
      console.error("Error deleting data:", error);
    }
  };

  useEffect(() => {
    if (isOpen && passwordInputRef.current) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        size="md"
        isDismissable={false}
        hideCloseButton={true}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <LockIcon className="text-primary" />
              <span>Unlock App</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p className="text-sm text-default-500">
                Enter your password to unlock the app and access your encrypted
                data.
              </p>

              <div className="space-y-2">
                <label htmlFor="unlockPassword" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  ref={passwordInputRef}
                  id="unlockPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleSubmit();
                    }
                  }}
                  endContent={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none"
                    >
                      {showPassword ? (
                        <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                      ) : (
                        <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                      )}
                    </button>
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="flex flex-col gap-3">
            <Button
              onPress={handleSubmit}
              isDisabled={!password}
              className="w-full rounded-full"
            >
              {isLoading && (
                <Spinner size="sm" color="white" className="mr-2" />
              )}
              Unlock
            </Button>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-default-500">Forgot your password?</p>
              <Button
                color="danger"
                variant="flat"
                onPress={() => setShowDeleteModal(true)}
                size="sm"
                className="text-xs"
              >
                Delete All Data
              </Button>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <DeleteDataModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onDeleteData={handleDeleteData}
      />
    </>
  );
};

const PasswordRemoveModal = ({ isOpen, onClose, onPasswordVerified }) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const passwordInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && passwordInputRef.current) {
      const timer = setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setError("");
    setIsLoading(true);

    const result = await onPasswordVerified(password);
    if (result && result.success) {
      setPassword("");
      setIsLoading(false);
      addToast({
        title: "Password removed successfully",
        color: "success",
      });
      onClose();
    } else {
      addToast({
        title: "Incorrect password",
        color: "danger",
      });
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setError("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <LockIcon className="text-danger" />
            <span>Remove Password Protection</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-default-500">
              Enter your current password to remove password protection from the
              app. This will allow anyone to access your encrypted data.
            </p>

            <div className="space-y-2">
              <label htmlFor="removePassword" className="text-sm font-medium">
                Current Password
              </label>
              <Input
                ref={passwordInputRef}
                id="removePassword"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
                endContent={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none"
                  >
                    {showPassword ? (
                      <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    ) : (
                      <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                    )}
                  </button>
                }
              />
            </div>

            {error && <div className="text-danger text-sm">{error}</div>}

            <div className="bg-warning-50 dark:bg-warning-400/20 p-3 rounded-lg">
              <p className="text-warning-700 dark:text-warning-500 text-sm">
                <strong>Warning:</strong> Removing password protection will make
                your encrypted data accessible without authentication. Make sure
                you want to proceed.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button color="danger" onPress={handleSubmit} isDisabled={!password}>
            {isLoading && <Spinner size="sm" color="white" className="mr-2" />}
            Remove Password
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const DeleteDataModal = ({ isOpen, onClose, onDeleteData }) => {
  const [confirmationText, setConfirmationText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const confirmationInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && confirmationInputRef.current) {
      const timer = setTimeout(() => {
        confirmationInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    setError("");
    setIsLoading(true);

    try {
      await onDeleteData();
      setConfirmationText("");
      onClose();
    } catch {
      setError("Failed to delete data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setConfirmationText("");
    setError("");
    onClose();
  };

  const isDeleteEnabled = confirmationText === "DeleteMyData";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <LockIcon className="text-danger" />
            <span>Delete All Data</span>
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-sm text-default-500">
              This action will permanently delete all your encrypted data and
              remove password protection. This action cannot be undone.
            </p>

            <div className="space-y-2">
              <label htmlFor="confirmationText" className="text-sm font-medium">
                Type &quot;DeleteMyData&quot; to confirm
              </label>
              <Input
                ref={confirmationInputRef}
                id="confirmationText"
                type="text"
                placeholder="Type DeleteMyData"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && isDeleteEnabled) {
                    handleDelete();
                  }
                }}
              />
            </div>

            {error && <div className="text-danger text-sm">{error}</div>}

            <div className="bg-danger-50 dark:bg-danger-400/20 p-3 rounded-lg">
              <p className="text-danger-700 dark:text-danger-500 text-sm">
                <strong>Danger:</strong> This will permanently delete all your
                PGP keys, encrypted data, and remove password protection. You
                will need to start fresh with the app.
              </p>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={handleClose}>
            Cancel
          </Button>
          <Button
            className="bg-danger-300 text-white"
            onPress={handleDelete}
            isDisabled={!isDeleteEnabled}
          >
            {isLoading && <Spinner size="sm" color="white" className="mr-2" />}
            Delete All Data
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

const PasswordStatus = () => {
  const { isProtected, setPassword, removePassword } = usePasswordProtection();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isRemoveOpen,
    onOpen: onRemoveOpen,
    onClose: onRemoveClose,
  } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);

  const handleSetPassword = async (password) => {
    setIsLoading(true);
    try {
      await setPassword(password);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePassword = async (password) => {
    setIsLoading(true);
    try {
      const result = await removePassword(password);
      return result;
    } catch {
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Card className="w-60 mt-16">
        <CardHeader className="flex gap-3">
          <div className="flex items-center gap-2">
            {isProtected ? (
              <ShieldIcon className="text-success" />
            ) : (
              <LockIcon className="text-warning" />
            )}
            <div className="flex flex-col">
              <p className="text-md">App Security</p>
              <p className="text-small text-default-500">
                {isProtected
                  ? "Password protection enabled"
                  : "No password protection"}
              </p>
            </div>
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Chip
                color={isProtected ? "success" : "warning"}
                variant="flat"
                size="sm"
              >
                {isProtected ? "Protected" : "Unprotected"}
              </Chip>
            </div>
            <div className="flex gap-2">
              {isProtected ? (
                <>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={onRemoveOpen}
                  >
                    {isLoading && (
                      <Spinner size="sm" color="white" className="mr-2" />
                    )}
                    Remove Password
                  </Button>
                </>
              ) : (
                <Button size="sm" color="default" onPress={onOpen}>
                  {isLoading && (
                    <Spinner size="sm" color="white" className="mr-2" />
                  )}
                  Set Password
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <PasswordSetupModal
        isOpen={isOpen}
        onClose={onClose}
        onPasswordSet={handleSetPassword}
      />

      <PasswordRemoveModal
        isOpen={isRemoveOpen}
        onClose={onRemoveClose}
        onPasswordVerified={handleRemovePassword}
      />
    </>
  );
};

export const PasswordProtectionProvider = ({ children }) => {
  const [isProtected, setIsProtected] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const {
    isOpen: isUnlockOpen,
    onOpen: onUnlockOpen,
    onClose: onUnlockClose,
  } = useDisclosure();

  // Check if password protection is enabled on mount
  useEffect(() => {
    const checkPasswordProtection = async () => {
      try {
        const hasPassword = await checkIfPasswordProtected();
        setIsProtected(hasPassword);

        if (hasPassword) {
          const sessionValid = isSessionValid();

          if (sessionValid) {
            const decryptedKey = await getDecryptedMainKey();

            if (decryptedKey) {
              setIsUnlocked(true);
              setRefreshKey((prev) => prev + 1);
            } else {
              sessionStorage.removeItem("appPasswordKey");
              clearDecryptedMainKey();
              onUnlockOpen();
            }
          } else {
            // For security, always require password on page load/refresh
            // Clear any existing session to force password entry
            sessionStorage.removeItem("appPasswordKey");
            clearDecryptedMainKey();

            // Show unlock modal
            onUnlockOpen();
          }
        } else {
          // If no password, app is ready
          setIsUnlocked(true);
          setRefreshKey((prev) => prev + 1);
        }
      } catch {
        setIsUnlocked(true); // Fallback to unlocked state
        setRefreshKey((prev) => prev + 1);
      } finally {
        setIsLoading(false);
      }
    };

    checkPasswordProtection();
  }, [onUnlockOpen]);

  const handleSetPassword = async (password) => {
    try {
      await setAppPasswordInDB(password);
      setIsProtected(true);
      setIsUnlocked(true);
      setRefreshKey((prev) => prev + 1);
      // The session is now valid since we just set the password
      sessionStorage.setItem("appPasswordKey", "true");

      // Verify the session is properly set
      if (!isSessionValid()) {
        throw new Error("Failed to establish session");
      }

      // Verify the decrypted key is available
      const decryptedKey = await getDecryptedMainKey();
      if (!decryptedKey) {
        throw new Error("Failed to store decrypted key");
      }
    } catch {
      // Clear any partial state
      sessionStorage.removeItem("appPasswordKey");
      clearDecryptedMainKey();
      setIsProtected(false);
      setIsUnlocked(false);
      throw new Error("Failed to set password");
    }
  };

  const handleRemovePassword = async (password) => {
    try {
      await verifyAppPassword(password);
      await removeAppPassword();
      clearDecryptedMainKey();
      setIsProtected(false);
      setIsUnlocked(true);
      setRefreshKey((prev) => prev + 1);
      return { success: true };
    } catch {
      return { success: false };
    }
  };

  const handlePasswordVerified = async (password) => {
    try {
      await verifyAppPassword(password);

      sessionStorage.setItem("appPasswordKey", "true");

      if (!isSessionValid()) {
        throw new Error(
          "Failed to establish session after password verification"
        );
      }

      // Verify the decrypted main key
      const decryptedKey = await getDecryptedMainKey();
      if (!decryptedKey) {
        throw new Error(
          "Failed to store decrypted key after password verification"
        );
      }

      setIsUnlocked(true);
      setRefreshKey((prev) => prev + 1);
      return { success: true };
    } catch {
      sessionStorage.removeItem("appPasswordKey");
      clearDecryptedMainKey();
      return { success: false };
    }
  };

  const handleDeleteAllData = async () => {
    try {
      await deleteAllData();
      clearDecryptedMainKey();
      setIsProtected(false);
      setIsUnlocked(true);
      setRefreshKey((prev) => prev + 1);
    } catch {
      throw new Error("Failed to delete data");
    }
  };

  const value = {
    isProtected,
    isUnlocked,
    isLoading,
    refreshKey,
    setPassword: handleSetPassword,
    removePassword: handleRemovePassword,
    verifyPassword: handlePasswordVerified,
    deleteAllData: handleDeleteAllData,
  };

  return (
    <PasswordProtectionContext.Provider value={value}>
      {children}

      <PasswordUnlockModal
        isOpen={isUnlockOpen}
        onClose={onUnlockClose}
        onPasswordVerified={handlePasswordVerified}
        onDeleteData={handleDeleteAllData}
      />
    </PasswordProtectionContext.Provider>
  );
};

export { PasswordStatus };
