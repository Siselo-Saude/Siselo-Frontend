import * as React from "react";
import { Dialog, DialogTrigger, DialogClose, DialogPortal, DialogOverlay, DialogHeader, DialogFooter, DialogTitle, DialogDescription, useDialogContext } from "./dialog";
import { cn } from "../../lib/utils";

const Sheet = Dialog;
const SheetTrigger = DialogTrigger;
const SheetClose = DialogClose;
const SheetPortal = DialogPortal;
const SheetOverlay = DialogOverlay;

const SheetContent = React.forwardRef(({ side = "right", className, children, ...props }, ref) => {
  const context = useDialogContext();
  const sides = {
    top: "inset-x-0 top-0 border-b",
    bottom: "inset-x-0 bottom-0 border-t",
    left: "inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
    right: "inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm",
  };
  if (!context?.open) return null;
  return (
    <>
      <SheetOverlay />
      <div ref={ref} className={cn("fixed z-50 gap-4 bg-background p-6 shadow-lg", sides[side] || sides.right, className)} {...props}>
        {children}
      </div>
    </>
  );
});
SheetContent.displayName = "SheetContent";

const SheetHeader = DialogHeader;
const SheetFooter = DialogFooter;
const SheetTitle = DialogTitle;
const SheetDescription = DialogDescription;

export { Sheet, SheetPortal, SheetOverlay, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
