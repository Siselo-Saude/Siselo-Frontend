import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

const Switch = React.forwardRef(({ className, checked, defaultChecked = false, onCheckedChange, ...props }, ref) => {
  const [isChecked, setChecked] = useControllableState({
    value: checked,
    defaultValue: defaultChecked,
    onChange: onCheckedChange,
  });

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={Boolean(isChecked)}
      data-state={isChecked ? "checked" : "unchecked"}
      onClick={() => setChecked(!isChecked)}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className,
      )}
      {...props}
    >
      <span
        data-state={isChecked ? "checked" : "unchecked"}
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          isChecked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
});
Switch.displayName = "Switch";

export { Switch };
