import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

const SelectContext = React.createContext(null);

function Select({ value, defaultValue, onValueChange, children }) {
  const [currentValue, setValue] = useControllableState({ value, defaultValue, onChange: onValueChange });
  const [open, setOpen] = React.useState(false);
  return <SelectContext.Provider value={{ value: currentValue, setValue, open, setOpen }}>{children}</SelectContext.Provider>;
}

function SelectGroup({ children }) {
  return <div role="group">{children}</div>;
}

function SelectValue({ placeholder }) {
  const context = React.useContext(SelectContext);
  return <>{context?.value || placeholder}</>;
}

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  return (
    <button ref={ref} type="button" aria-expanded={context?.open} onClick={() => context?.setOpen(!context.open)} className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm", className)} {...props}>
      {children}
      <span aria-hidden="true">v</span>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context?.open) return null;
  return <div ref={ref} className={cn("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md", className)} {...props} />;
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={context?.value === value}
      onClick={() => {
        context?.setValue(value);
        context?.setOpen(false);
      }}
      className={cn("relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent", className)}
      {...props}
    >
      {children}
    </button>
  );
});
SelectItem.displayName = "SelectItem";

const SelectLabel = ({ className, ...props }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;
const SelectSeparator = ({ className, ...props }) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
const SelectScrollUpButton = ({ children = "^", ...props }) => <div {...props}>{children}</div>;
const SelectScrollDownButton = ({ children = "v", ...props }) => <div {...props}>{children}</div>;

export { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton };
