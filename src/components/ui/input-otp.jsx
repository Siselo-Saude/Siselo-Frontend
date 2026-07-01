import * as React from "react";
import { cn } from "../../lib/utils";

const InputOTPContext = React.createContext(null);

function InputOTP({ value, onChange, maxLength = 6, className, children, ...props }) {
  const [internalValue, setInternalValue] = React.useState(value);
  const currentValue = value ?? internalValue ?? "";
  const setValue = (nextValue) => {
    const clipped = String(nextValue || "").slice(0, maxLength);
    if (value === undefined) setInternalValue(clipped);
    onChange?.(clipped);
  };

  return (
    <InputOTPContext.Provider value={{ value: currentValue, setValue, maxLength }}>
      <div className={cn("flex items-center gap-2", className)} {...props}>{children}</div>
    </InputOTPContext.Provider>
  );
}

function InputOTPGroup({ className, ...props }) {
  return <div className={cn("flex items-center", className)} {...props} />;
}

function InputOTPSlot({ index, className, ...props }) {
  const context = React.useContext(InputOTPContext);
  const character = context?.value?.[index] || "";
  return (
    <input
      value={character}
      maxLength={1}
      onChange={(event) => {
        const chars = (context?.value || "").split("");
        chars[index] = event.target.value.slice(-1);
        context?.setValue(chars.join(""));
      }}
      className={cn("relative flex h-10 w-10 items-center justify-center border-y border-r border-input text-center text-sm first:rounded-l-md first:border-l last:rounded-r-md", className)}
      {...props}
    />
  );
}

function InputOTPSeparator({ children = "-", ...props }) {
  return <div role="separator" {...props}>{children}</div>;
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
