import * as React from "react";
import { cn } from "../../lib/utils";

const Checkbox = React.forwardRef(({ className, checked, defaultChecked, onCheckedChange, ...props }, ref) => {
  const [internalChecked, setInternalChecked] = React.useState(Boolean(defaultChecked));
  const currentChecked = checked ?? internalChecked;

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={currentChecked}
      onChange={(event) => {
        if (checked === undefined) setInternalChecked(event.target.checked);
        onCheckedChange?.(event.target.checked);
      }}
      className={cn("h-4 w-4 shrink-0 rounded-sm border border-primary accent-primary disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
