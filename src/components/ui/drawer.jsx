import * as React from "react";
import { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogHeader, DialogFooter, DialogTitle, DialogDescription, useDialogContext } from "./dialog";
import { cn } from "../../lib/utils";

const Drawer = Dialog;
const DrawerTrigger = DialogTrigger;
const DrawerClose = DialogClose;
const DrawerPortal = DialogPortal;
const DrawerOverlay = DialogOverlay;

const DrawerContent = React.forwardRef(({ className, ...props }, ref) => {
  const context = useDialogContext();
  if (!context?.open) return null;
  return (
    <>
      <DrawerOverlay />
      <div
        ref={ref}
        className={cn("fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85vh] flex-col rounded-t-lg border bg-background p-6 shadow-lg", className)}
        {...props}
      />
    </>
  );
});
DrawerContent.displayName = "DrawerContent";

const DrawerHeader = DialogHeader;
const DrawerFooter = DialogFooter;
const DrawerTitle = DialogTitle;
const DrawerDescription = DialogDescription;

export { Drawer, DrawerPortal, DrawerOverlay, DrawerTrigger, DrawerClose, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription };
