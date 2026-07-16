import * as React from "react";
import { cn } from "../../lib/utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "./dropdown-menu";

const Menubar = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-9 items-center space-x-1 rounded-md border bg-background p-1", className)} {...props} />
));
Menubar.displayName = "Menubar";

const MenubarMenu = DropdownMenu;
const MenubarTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuTrigger ref={ref} className={cn("flex cursor-default select-none items-center rounded-sm px-3 py-1 text-sm font-medium outline-none hover:bg-accent", className)} {...props} />
));
MenubarTrigger.displayName = "MenubarTrigger";
const MenubarContent = DropdownMenuContent;
const MenubarItem = DropdownMenuItem;
const MenubarSeparator = DropdownMenuSeparator;
const MenubarShortcut = ({ className, ...props }) => <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;
const MenubarSub = ({ children }) => <>{children}</>;
const MenubarSubTrigger = MenubarItem;
const MenubarSubContent = MenubarContent;
const MenubarCheckboxItem = MenubarItem;
const MenubarRadioGroup = ({ children }) => <>{children}</>;
const MenubarRadioItem = MenubarItem;
const MenubarLabel = ({ className, ...props }) => <div className={cn("px-2 py-1.5 text-sm font-semibold", className)} {...props} />;

export { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubTrigger, MenubarSubContent, MenubarCheckboxItem, MenubarRadioGroup, MenubarRadioItem, MenubarLabel };
