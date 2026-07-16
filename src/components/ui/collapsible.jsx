import * as React from "react";
import { useControllableState } from "../../lib/utils";

const CollapsibleContext = React.createContext(null);

function Collapsible({ open, defaultOpen = false, onOpenChange, children, ...props }) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });

  return (
    <CollapsibleContext.Provider value={{ open: Boolean(isOpen), setOpen }}>
      <div data-state={isOpen ? "open" : "closed"} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

const CollapsibleTrigger = React.forwardRef(({ children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={context?.open}
      data-state={context?.open ? "open" : "closed"}
      onClick={() => context?.setOpen(!context.open)}
      {...props}
    >
      {children}
    </button>
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef(({ children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  return (
    <div ref={ref} hidden={!context?.open} data-state={context?.open ? "open" : "closed"} {...props}>
      {children}
    </div>
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
