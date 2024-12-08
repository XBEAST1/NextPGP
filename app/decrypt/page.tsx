"use client";

import { useState } from "react";
import { Textarea } from "@nextui-org/input";
import { Checkbox } from "@nextui-org/checkbox";
export default function App() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <>
      <Textarea
        disableAutosize
        classNames={{
          input: "resize-y min-h-[150px]",
        }}
        label="Decrypt"
        placeholder="Enter your pgp message"
      />
      <br />
      <Checkbox
        defaultSelected={isChecked}
        color="default"
        onChange={(e) => setIsChecked(e.target.checked)}
      >
        Use Password
      </Checkbox>

      <br />
      <br />

      <Textarea
        isDisabled={!isChecked}
        classNames={{
          input: "min-h-[10px]",
        }}
        placeholder="Enter your password"
      />

      <br />

      <Textarea
        isReadOnly
        disableAutosize
        classNames={{
          input: "resize-y min-h-[150px]",
        }}
        label="Output"
      />
    </>
  );
}
