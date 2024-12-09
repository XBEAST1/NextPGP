"use client";

import { useState } from "react";
import { Textarea, Checkbox } from "@nextui-org/react";

export default function App() {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <>
      <Textarea
        disableAutosize
        classNames={{
          input: "resize-y min-h-[150px]",
        }}
        label="Encrypt"
        placeholder="Enter your message"
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
