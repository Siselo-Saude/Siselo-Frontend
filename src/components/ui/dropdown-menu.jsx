import * as React from "react";
import { cn } from "../../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "./popover";

const DropdownMenu = Popover;
const DropdownMenuTrigger = PopoverTrigger;
const DropdownMenuContent = React.forwardRef(({ className, ...props }, ref) => (
  <PopoverContent ref={ref} className={cn("w-56 p-1", className)} {...props} />
));
DropdownMenuContent.displayName = "DropdownMenuContent";
const DropdownMenuGroup = ({ className, ...props }) => <div className={cn("p-1", className)} {...props} />;
const DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => <button ref={ref} type="button" className={cn("relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground", inset && "pl-8", className)} {...props} />);
DropdownMenuItem.displayName = "DropdownMenuItem";
const DropdownMenuCheckboxItem = DropdownMenuItem;
const DropdownMenuRadioItem = DropdownMenuItem;
const DropdownMenuLabel = ({ className, inset, ...props }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)} {...props} />;
const DropdownMenuSeparator = ({ className, ...props }) => <div className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />;
const DropdownMenuShortcut = ({ className, ...props }) => <span className={cn("ml-auto text-xs tracking-widest opacity-60", className)} {...props} />;
const DropdownMenuSub = ({ children }) => <>{children}</>;
const DropdownMenuSubTrigger = DropdownMenuItem;
const DropdownMenuSubContent = DropdownMenuContent;
const DropdownMenuPortal = ({ children }) => <>{children}</>;
const DropdownMenuRadioGroup = ({ children }) => <>{children}</>;

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
