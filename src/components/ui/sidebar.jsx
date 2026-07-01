import * as React from "react";
import { cn, useControllableState } from "../../lib/utils";
import { Button } from "./button";

const SidebarContext = React.createContext(null);

function SidebarProvider({ defaultOpen = true, open, onOpenChange, children }) {
  const [isOpen, setOpen] = useControllableState({ value: open, defaultValue: defaultOpen, onChange: onOpenChange });
  return <SidebarContext.Provider value={{ open: Boolean(isOpen), setOpen }}>{children}</SidebarContext.Provider>;
}

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    return { open: true, setOpen: () => {} };
  }
  return context;
}

function Sidebar({ className, children, ...props }) {
  const { open } = useSidebar();
  return (
    <aside data-state={open ? "expanded" : "collapsed"} className={cn("flex h-screen flex-col border-r bg-sidebar text-sidebar-foreground transition-all", open ? "w-60" : "w-16", className)} {...props}>
      {children}
    </aside>
  );
}

function SidebarHeader({ className, ...props }) {
  return <div className={cn("flex min-h-16 items-center gap-3 border-b px-4", className)} {...props} />;
}

function SidebarContent({ className, ...props }) {
  return <div className={cn("flex-1 overflow-auto p-3", className)} {...props} />;
}

function SidebarFooter({ className, ...props }) {
  return <div className={cn("border-t p-3", className)} {...props} />;
}

function SidebarTrigger({ className, children = "Menu", ...props }) {
  const { open, setOpen } = useSidebar();
  return <Button type="button" variant="ghost" size="sm" className={className} onClick={() => setOpen(!open)} {...props}>{children}</Button>;
}

function SidebarMenu({ className, ...props }) {
  return <nav className={cn("grid gap-1", className)} {...props} />;
}

function SidebarMenuItem({ className, ...props }) {
  return <div className={cn("", className)} {...props} />;
}

function SidebarMenuButton({ className, active, ...props }) {
  return <a className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-sidebar-accent", active && "bg-sidebar-accent text-sidebar-accent-foreground", className)} {...props} />;
}

export { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar };
