import * as React from "react";
import { cn } from "../../lib/utils";

const HoverCardContext = React.createContext(null);

function HoverCard({ children }) {
  const [open, setOpen] = React.useState(false);
  return <HoverCardContext.Provider value={{ open, setOpen }}>{children}</HoverCardContext.Provider>;
}

function HoverCardTrigger({ children, ...props }) {
  const context = React.useContext(HoverCardContext);
  return (
    <span onMouseEnter={() => context?.setOpen(true)} onMouseLeave={() => context?.setOpen(false)} onFocus={() => context?.setOpen(true)} onBlur={() => context?.setOpen(false)} {...props}>
      {children}
    </span>
  );
}

const HoverCardContent = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(HoverCardContext);
  if (!context?.open) return null;
  return <div ref={ref} className={cn("z-50 w-64 rounded-md border bg-popover p-4 text-popover-foreground shadow-md", className)} {...props} />;
});
HoverCardContent.displayName = "HoverCardContent";

export { HoverCard, HoverCardTrigger, HoverCardContent };
