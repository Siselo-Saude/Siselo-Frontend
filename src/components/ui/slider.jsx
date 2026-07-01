import * as React from "react";
import { cn } from "../../lib/utils";

const Slider = React.forwardRef(({ className, value, defaultValue = 0, onValueChange, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const currentValue = value ?? internalValue;

  return (
    <input
      ref={ref}
      type="range"
      value={currentValue}
      onChange={(event) => {
        const nextValue = Number(event.target.value);
        if (value === undefined) setInternalValue(nextValue);
        onValueChange?.(nextValue);
      }}
      className={cn("h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  );
});
Slider.displayName = "Slider";

export { Slider };
