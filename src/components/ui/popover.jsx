import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

const PopoverContext = React.createContext(null);

function Popover({ open, defaultOpen = false, onOpenChange, children }) {
  const [isOpen, setOpen] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  return <PopoverContext.Provider value={{ open: Boolean(isOpen), setOpen }}>{children}</PopoverContext.Provider>;
}

function PopoverTrigger({ asChild = false, children, ...props }) {
  const context = React.useContext(PopoverContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (event) => {
        children.props.onClick?.(event);
        if (!event.defaultPrevented) context?.setOpen(!context.open);
      },
      ...props,
    });
  }
  return <button type="button" onClick={() => context?.setOpen(!context.open)} {...props}>{children}</button>;
}

const PopoverContent = React.forwardRef(({ className, align = "center", ...props }, ref) => {
  const context = React.useContext(PopoverContext);
  if (!context?.open) return null;
  return (
    <div
      ref={ref}
      data-align={align}
      className={cn("z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)}
      {...props}
    />
  );
});
PopoverContent.displayName = "PopoverContent";

function PopoverAnchor({ children }) {
  return <>{children}</>;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
