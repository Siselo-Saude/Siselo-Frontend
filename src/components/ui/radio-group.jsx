import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

const RadioGroupContext = React.createContext(null);

const RadioGroup = React.forwardRef(
  ({ className, value, defaultValue, onValueChange, name, children, ...props }, ref) => {
    const [currentValue, setCurrentValue] = useControllableState({
      value,
      defaultValue,
      onChange: onValueChange,
    });

    return (
      <RadioGroupContext.Provider value={{ value: currentValue, setValue: setCurrentValue, name }}>
        <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)} {...props}>
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  },
);
RadioGroup.displayName = "RadioGroup";

const RadioGroupItem = React.forwardRef(({ className, value, children, ...props }, ref) => {
  const context = React.useContext(RadioGroupContext);
  const checked = context?.value === value;

  return (
    <label className={cn("inline-flex items-center gap-2 text-sm", className)}>
      <input
        ref={ref}
        type="radio"
        name={context?.name}
        value={value}
        checked={checked}
        onChange={() => context?.setValue(value)}
        className="h-4 w-4 accent-primary"
        {...props}
      />
      {children}
    </label>
  );
});
RadioGroupItem.displayName = "RadioGroupItem";

export { RadioGroup, RadioGroupItem };
