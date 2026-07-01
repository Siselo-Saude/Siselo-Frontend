import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";

export const toggleVariants = ({ variant = "default", size = "default", className } = {}) => {
  const variants = {
    default: "bg-transparent",
    outline: "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
  };
  const sizes = {
    default: "h-9 px-3",
    sm: "h-8 px-2",
    lg: "h-10 px-3",
  };
  return cn(
    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground",
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground",
    variants[variant] || variants.default,
    sizes[size] || sizes.default,
    className,
  );
};

const Toggle = React.forwardRef(({ className, variant, size, pressed, defaultPressed = false, onPressedChange, ...props }, ref) => {
  const [isPressed, setPressed] = useControllableState({
    value: pressed,
    defaultValue: defaultPressed,
    onChange: onPressedChange,
  });

  return (
    <button
      ref={ref}
      type="button"
      aria-pressed={Boolean(isPressed)}
      data-state={isPressed ? "on" : "off"}
      onClick={() => setPressed(!isPressed)}
      className={toggleVariants({ variant, size, className })}
      {...props}
    />
  );
});
Toggle.displayName = "Toggle";

export { Toggle };
