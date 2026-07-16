import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";
import { Toggle } from "./toggle";

const ToggleGroupContext = React.createContext(null);

const ToggleGroup = React.forwardRef(({ className, type = "single", value, defaultValue, onValueChange, children, ...props }, ref) => {
  const [currentValue, setCurrentValue] = useControllableState({
    value,
    defaultValue: defaultValue ?? (type === "multiple" ? [] : undefined),
    onChange: onValueChange,
  });

  const toggleValue = (itemValue) => {
    if (type === "multiple") {
      const values = Array.isArray(currentValue) ? currentValue : [];
      setCurrentValue(values.includes(itemValue) ? values.filter((item) => item !== itemValue) : [...values, itemValue]);
      return;
    }
    setCurrentValue(currentValue === itemValue ? undefined : itemValue);
  };

  const isPressed = (itemValue) => (type === "multiple" ? Array.isArray(currentValue) && currentValue.includes(itemValue) : currentValue === itemValue);

  return (
    <ToggleGroupContext.Provider value={{ isPressed, toggleValue }}>
      <div ref={ref} className={cn("flex items-center gap-1", className)} {...props}>
        {children}
      </div>
    </ToggleGroupContext.Provider>
  );
});
ToggleGroup.displayName = "ToggleGroup";

const ToggleGroupItem = React.forwardRef(({ value, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext);
  return <Toggle ref={ref} pressed={context?.isPressed(value)} onPressedChange={() => context?.toggleValue(value)} {...props} />;
});
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
