import * as React from "react";
import { cn } from "../../lib/utils";

const NavigationMenu = React.forwardRef(({ className, ...props }, ref) => (
  <nav ref={ref} className={cn("relative z-10 flex max-w-max flex-1 items-center justify-center", className)} {...props} />
));
NavigationMenu.displayName = "NavigationMenu";
const NavigationMenuList = React.forwardRef(({ className, ...props }, ref) => <ul ref={ref} className={cn("group flex flex-1 list-none items-center justify-center space-x-1", className)} {...props} />);
NavigationMenuList.displayName = "NavigationMenuList";
const NavigationMenuItem = React.forwardRef(({ className, ...props }, ref) => <li ref={ref} className={cn("relative", className)} {...props} />);
NavigationMenuItem.displayName = "NavigationMenuItem";
const NavigationMenuTrigger = React.forwardRef(({ className, ...props }, ref) => <button ref={ref} type="button" className={cn("inline-flex h-9 items-center justify-center rounded-md px-4 py-2 text-sm font-medium hover:bg-accent", className)} {...props} />);
NavigationMenuTrigger.displayName = "NavigationMenuTrigger";
const NavigationMenuContent = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("absolute left-0 top-full mt-1 w-max rounded-md border bg-popover p-4 shadow-md", className)} {...props} />);
NavigationMenuContent.displayName = "NavigationMenuContent";
const NavigationMenuLink = React.forwardRef(({ className, ...props }, ref) => <a ref={ref} className={cn("block select-none rounded-md p-3 leading-none no-underline outline-none hover:bg-accent hover:text-accent-foreground", className)} {...props} />);
NavigationMenuLink.displayName = "NavigationMenuLink";
const NavigationMenuViewport = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("origin-top-center relative mt-1 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-md border bg-popover shadow", className)} {...props} />);
NavigationMenuViewport.displayName = "NavigationMenuViewport";
const NavigationMenuIndicator = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("top-full z-10 flex h-1.5 items-end justify-center overflow-hidden", className)} {...props} />);
NavigationMenuIndicator.displayName = "NavigationMenuIndicator";

export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuContent, NavigationMenuTrigger, NavigationMenuLink, NavigationMenuIndicator, NavigationMenuViewport };
