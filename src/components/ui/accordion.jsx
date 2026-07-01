import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

const AccordionContext = React.createContext(null);
const AccordionItemContext = React.createContext(null);

function Accordion({ type = "single", value, defaultValue, onValueChange, collapsible = false, className, children, ...props }) {
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? (type === "multiple" ? [] : undefined),
    onChange: onValueChange,
  });

  const toggleItem = React.useCallback(
    (itemValue) => {
      if (type === "multiple") {
        const values = Array.isArray(currentValue) ? currentValue : [];
        setCurrentValue(
          values.includes(itemValue)
            ? values.filter((item) => item !== itemValue)
            : [...values, itemValue],
        );
        return;
      }

      setCurrentValue(currentValue === itemValue && collapsible ? undefined : itemValue);
    },
    [collapsible, currentValue, setCurrentValue, type],
  );

  const isOpen = React.useCallback(
    (itemValue) => (type === "multiple" ? Array.isArray(currentValue) && currentValue.includes(itemValue) : currentValue === itemValue),
    [currentValue, type],
  );

  return (
    <AccordionContext.Provider value={{ isOpen, toggleItem }}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

const AccordionItem = React.forwardRef(({ className, value, children, ...props }, ref) => (
  <AccordionItemContext.Provider value={value}>
    <div ref={ref} className={cn("border-b", className)} {...props}>
      {children}
    </div>
  </AccordionItemContext.Provider>
));
AccordionItem.displayName = "AccordionItem";

const AccordionTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const value = React.useContext(AccordionItemContext);
  const accordion = React.useContext(AccordionContext);
  const open = accordion?.isOpen(value);

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={Boolean(open)}
      data-state={open ? "open" : "closed"}
      onClick={() => accordion?.toggleItem(value)}
      className={cn(
        "flex w-full flex-1 items-center justify-between py-4 text-left text-sm font-medium transition-all hover:underline",
        className,
      )}
      {...props}
    >
      {children}
      <span className={cn("ml-2 transition-transform", open && "rotate-180")} aria-hidden="true">v</span>
    </button>
  );
});
AccordionTrigger.displayName = "AccordionTrigger";

const AccordionContent = React.forwardRef(({ className, children, ...props }, ref) => {
  const value = React.useContext(AccordionItemContext);
  const accordion = React.useContext(AccordionContext);
  const open = accordion?.isOpen(value);

  return (
    <div ref={ref} hidden={!open} data-state={open ? "open" : "closed"} className="overflow-hidden text-sm" {...props}>
      <div className={cn("pb-4 pt-0", className)}>{children}</div>
    </div>
  );
});
AccordionContent.displayName = "AccordionContent";

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
