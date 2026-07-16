import * as React from "react";
import { cn } from "../../lib/utils";

const TooltipContext = React.createContext(null);

function TooltipProvider({ children }) {
  return <>{children}</>;
}

function Tooltip({ children }) {
  const [open, setOpen] = React.useState(false);
  return <TooltipContext.Provider value={{ open, setOpen }}>{children}</TooltipContext.Provider>;
}

function TooltipTrigger({ children, ...props }) {
  const context = React.useContext(TooltipContext);
  return (
    <span onMouseEnter={() => context?.setOpen(true)} onMouseLeave={() => context?.setOpen(false)} onFocus={() => context?.setOpen(true)} onBlur={() => context?.setOpen(false)} {...props}>
      {children}
    </span>
  );
}

const TooltipContent = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(TooltipContext);
  if (!context?.open) return null;
  return <div ref={ref} role="tooltip" className={cn("z-50 overflow-hidden rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground shadow-md", className)} {...props} />;
});
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
