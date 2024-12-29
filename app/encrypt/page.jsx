"use client";

import { React, useState, useEffect, useRef } from "react";
import {
  Textarea,
  Checkbox,
  Input,
  Autocomplete,
  AutocompleteItem,
  Button,
  Modal,
  ModalContent,
  Snippet,
} from "@nextui-org/react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import secureLocalStorage from "react-secure-storage";
import * as openpgp from "openpgp";

const EyeSlashFilledIcon = (props) => {
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
        d="M21.2714 9.17834C20.9814 8.71834 20.6714 8.28834 20.3514 7.88834C19.9814 7.41834 19.2814 7.37834 18.8614 7.79834L15.8614 10.7983C16.0814 11.4583 16.1214 12.2183 15.9214 13.0083C15.5714 14.4183 14.4314 15.5583 13.0214 15.9083C12.2314 16.1083 11.4714 16.0683 10.8114 15.8483C10.8114 15.8483 9.38141 17.2783 8.35141 18.3083C7.85141 18.8083 8.01141 19.6883 8.68141 19.9483C9.75141 20.3583 10.8614 20.5683 12.0014 20.5683C13.7814 20.5683 15.5114 20.0483 17.0914 19.0783C18.7014 18.0783 20.1514 16.6083 21.3214 14.7383C22.2714 13.2283 22.2214 10.6883 21.2714 9.17834Z"
        fill="currentColor"
      />
      <path
        d="M14.0206 9.98062L9.98062 14.0206C9.47062 13.5006 9.14062 12.7806 9.14062 12.0006C9.14062 10.4306 10.4206 9.14062 12.0006 9.14062C12.7806 9.14062 13.5006 9.47062 14.0206 9.98062Z"
        fill="currentColor"
      />
      <path
        d="M18.25 5.74969L14.86 9.13969C14.13 8.39969 13.12 7.95969 12 7.95969C9.76 7.95969 7.96 9.76969 7.96 11.9997C7.96 13.1197 8.41 14.1297 9.14 14.8597L5.76 18.2497H5.75C4.64 17.3497 3.62 16.1997 2.75 14.8397C1.75 13.2697 1.75 10.7197 2.75 9.14969C3.91 7.32969 5.33 5.89969 6.91 4.91969C8.49 3.95969 10.22 3.42969 12 3.42969C14.23 3.42969 16.39 4.24969 18.25 5.74969Z"
        fill="currentColor"
      />
      <path
        d="M14.8581 11.9981C14.8581 13.5681 13.5781 14.8581 11.9981 14.8581C11.9381 14.8581 11.8881 14.8581 11.8281 14.8381L14.8381 11.8281C14.8581 11.8881 14.8581 11.9381 14.8581 11.9981Z"
        fill="currentColor"
      />
      <path
        d="M21.7689 2.22891C21.4689 1.92891 20.9789 1.92891 20.6789 2.22891L2.22891 20.6889C1.92891 20.9889 1.92891 21.4789 2.22891 21.7789C2.37891 21.9189 2.56891 21.9989 2.76891 21.9989C2.96891 21.9989 3.15891 21.9189 3.30891 21.7689L21.7689 3.30891C22.0789 3.00891 22.0789 2.52891 21.7689 2.22891Z"
        fill="currentColor"
      />
    </svg>
  );
};

const EyeFilledIcon = (props) => {
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
        d="M21.25 9.14969C18.94 5.51969 15.56 3.42969 12 3.42969C10.22 3.42969 8.49 3.94969 6.91 4.91969C5.33 5.89969 3.91 7.32969 2.75 9.14969C1.75 10.7197 1.75 13.2697 2.75 14.8397C5.06 18.4797 8.44 20.5597 12 20.5597C13.78 20.5597 15.51 20.0397 17.09 19.0697C18.67 18.0897 20.09 16.6597 21.25 14.8397C22.25 13.2797 22.25 10.7197 21.25 9.14969ZM12 16.0397C9.76 16.0397 7.96 14.2297 7.96 11.9997C7.96 9.76969 9.76 7.95969 12 7.95969C14.24 7.95969 16.04 9.76969 16.04 11.9997C16.04 14.2297 14.24 16.0397 12 16.0397Z"
        fill="currentColor"
      />
      <path
        d="M11.9984 9.14062C10.4284 9.14062 9.14844 10.4206 9.14844 12.0006C9.14844 13.5706 10.4284 14.8506 11.9984 14.8506C13.5684 14.8506 14.8584 13.5706 14.8584 12.0006C14.8584 10.4306 13.5684 9.14062 11.9984 9.14062Z"
        fill="currentColor"
      />
    </svg>
  );
};

export default function App() {
  const [pgpKeys, setPgpKeys] = useState([]);
  const [signerKeys, setSignerKeys] = useState([]);
  const [signerKey, setSignerKey] = useState(null);
  const [recipientKeys, setRecipientKeys] = useState([]);
  const [isChecked, setIsChecked] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [recipients, setRecipients] = useState([""]);
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [output, setOutput] = useState("");
  const [modalpassword, setModalpassword] = useState("");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const onSubmitPassword = useRef(null);

  const toggleVisibility = () => setIsVisible(!isVisible);

  // Fetch and filter PGP keys from localStorage
  useEffect(() => {
    const keysFromStorage =
      JSON.parse(secureLocalStorage.getItem("pgpKeys")) || [];

    const filteredSignerKeys = keysFromStorage.filter(
      (key) => key.publicKey && key.privateKey
    );
    const filteredRecipientKeys = keysFromStorage.filter(
      (key) => key.publicKey
    );

    setPgpKeys(keysFromStorage);
    setSignerKeys(filteredSignerKeys);
    setRecipientKeys(filteredRecipientKeys);
  }, []);

  useEffect(() => {
    const savedSignerKey = secureLocalStorage.getItem("selectedSignerKey");
    const savedRecipients = JSON.parse(
      secureLocalStorage.getItem("selectedRecipients")
    ) || [""];

    // Set the retrieved values
    if (savedSignerKey) setSignerKey(savedSignerKey);
    if (savedRecipients.length > 0) setRecipients(savedRecipients);
  }, []);

  const handleSignerSelection = (selectedKey) => {
    secureLocalStorage.setItem("selectedSignerKey", selectedKey);
    setSignerKey(selectedKey);
  };

  const handleSelection = (index, selectedKey) => {
    const updatedRecipients = [...recipients];

    if (selectedKey) {
      updatedRecipients[index] = selectedKey;

      // Make sure the last slot is always empty for new entries
      if (updatedRecipients[updatedRecipients.length - 1] !== "") {
        updatedRecipients.push("");
      }
    } else {
      // Replace the deselected value with an empty string
      updatedRecipients[index] = "";

      // Remove trailing empty slots
      while (
        updatedRecipients.length > 1 &&
        updatedRecipients[updatedRecipients.length - 2] === "" &&
        updatedRecipients[updatedRecipients.length - 1] === ""
      ) {
        updatedRecipients.pop();
      }
    }

    setRecipients(updatedRecipients);

    secureLocalStorage.setItem(
      "selectedRecipients",
      JSON.stringify(updatedRecipients)
    );
  };

  const encryptMessage = async () => {
    try {
      const recipientKeysPublic = recipientKeys
        .filter((key) => recipients.includes(key.id.toString()))
        .map((key) => key.publicKey);

      // Find the selected signer
      const signer = signerKeys.find((key) => key.id.toString() === signerKey);

      if (!isChecked && recipientKeysPublic.length === 0) {
        toast.error("Please select at least one recipient.", {
          position: "top-right",
        });
        return;
      }

      let privateKey = null;
      if (signer) {
        const privateKeyObject = await openpgp.readPrivateKey({
          armoredKey: signer.privateKey,
        });

        // Check if the private key is encrypted
        if (!privateKeyObject.isDecrypted()) {
          setIsPasswordModalOpen(true);

          // Wait for the passphrase from the modal
          const passphrase = await new Promise((resolve) => {
            onSubmitPassword.current = resolve;
          });

          // Decrypt the private key
          privateKey = await openpgp.decryptKey({
            privateKey: privateKeyObject,
            passphrase: passphrase,
          });

          if (!privateKey || !privateKey.isDecrypted()) {
            throw new Error("Failed to decrypt the private key.");
          }
        } else {
          privateKey = privateKeyObject;
        }
      }

      const messageToEncrypt = await openpgp.createMessage({ text: message });

      const encryptionOptions = {
        message: messageToEncrypt,
        ...(isChecked && password && { passwords: [password] }),
        ...(recipientKeysPublic.length > 0 && {
          encryptionKeys: await Promise.all(
            recipientKeysPublic.map((key) =>
              openpgp.readKey({ armoredKey: key })
            )
          ),
        }),
        ...(privateKey && { signingKeys: privateKey }),
      };

      // Encrypt the message
      const encryptedMessage = await openpgp.encrypt(encryptionOptions);
      setOutput(encryptedMessage);
    } catch (error) {
      toast.error("Incorrect Password.", {
        position: "top-right",
      });
    }
  };

  return (
    <>
      <ToastContainer theme="dark" />
      <h1 className="text-center text-4xl dm-serif-text-regular">
        Encrypt Message
      </h1>
      <br />
      <br />
      <Textarea
        disableAutosize
        classNames={{
          input: "resize-y min-h-[150px]",
        }}
        label="Encrypt"
        placeholder="Enter your message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <br />
      <div className="flex flex-col gap-4">
        <h5 className="mt-4 ms-1">Sign as:</h5>
        <Autocomplete
          className="max-w-full"
          label="Select the signer"
          allowsCustomValue={false}
          selectedKey={signerKey}
          defaultItems={signerKeys}
          onSelectionChange={handleSignerSelection}
        >
          {(item) => (
            <AutocompleteItem
              key={item.id}
              textValue={`${item.name} (${item.email})`}
            >
              {item.name} ({item.email})
            </AutocompleteItem>
          )}
        </Autocomplete>
      </div>
      <div className="flex flex-col gap-4">
        <h5 className="mt-4 ms-1">Encrypt for:</h5>
        {recipients.map((selectedKey, index) => (
          <Autocomplete
            key={index}
            className="max-w-full"
            label={`Select recipient ${index + 1}`}
            selectedKey={selectedKey}
            onSelectionChange={(key) => handleSelection(index, key)}
            defaultItems={recipientKeys.filter(
              (key) => !recipients.includes(key.id) || key.id === selectedKey
            )}
          >
            {(item) => (
              <AutocompleteItem
                key={item.id}
                textValue={`${item.name} (${item.email})`}
              >
                {item.name} ({item.email})
              </AutocompleteItem>
            )}
          </Autocomplete>
        ))}
      </div>
      <br />
      <Checkbox
        defaultSelected={isChecked}
        color="default"
        onChange={(e) => setIsChecked(e.target.checked)}
      >
        <span className="text-medium">Encrypt With Password.</span>
        <p className="text-sm">
          Anyone you share the password with can read it.
        </p>
      </Checkbox>
      <br />
      <br />
      <Input
        isDisabled={!isChecked}
        classNames={{
          input: "min-h-[10px]",
        }}
        placeholder="Enter your password"
        type={isVisible ? "text" : "password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        endContent={
          <button
            aria-label="toggle password visibility"
            className="focus:outline-none"
            type="button"
            onClick={toggleVisibility}
          >
            {isVisible ? (
              <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
            ) : (
              <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
            )}
          </button>
        }
      />
      <br />
      <h5 className="ms-1">Encrypted PGP Message:</h5>
      <br />
      <Snippet
        symbol=""
        classNames={{
          base: "max-w-full p-5 overflow-auto",
          content: "whitespace-pre-wrap break-all",
          pre: "whitespace-pre-wrap break-all",
        }}
      >
        {output}
      </Snippet>
      <br />
      <br />
      <Button onPress={encryptMessage}>Encrypt</Button>
      <Modal
        backdrop="blur"
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      >
        <ModalContent className="p-5">
          <h3 className="mb-4">Signing Key Password Protected</h3>
          <Input
            placeholder="Enter Password"
            type={isVisible ? "text" : "password"}
            value={modalpassword}
            onChange={(e) => setModalpassword(e.target.value)}
            endContent={
              <button
                aria-label="toggle password visibility"
                className="focus:outline-none"
                type="button"
                onClick={toggleVisibility}
              >
                {isVisible ? (
                  <EyeSlashFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                ) : (
                  <EyeFilledIcon className="text-2xl text-default-400 pointer-events-none" />
                )}
              </button>
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Simulate the button click on Enter key press
                if (modalpassword) {
                  setIsPasswordModalOpen(false);
                  if (onSubmitPassword.current) {
                    onSubmitPassword.current(modalpassword);
                  }
                } else {
                  toast.error("Please enter a password.");
                }
              }
            }}
          />
          <br />
          <Button
            onPress={() => {
              if (modalpassword) {
                setIsPasswordModalOpen(false);
                if (onSubmitPassword.current) {
                  onSubmitPassword.current(modalpassword);
                }
              } else {
                toast.error("Please enter a password.");
              }
            }}
          >
            Submit
          </Button>
        </ModalContent>
      </Modal>
    </>
  );
}
