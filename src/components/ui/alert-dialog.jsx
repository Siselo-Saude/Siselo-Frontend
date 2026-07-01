import * as React from "react";
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./dialog";
import { cn } from "../../lib/utils";
import { buttonVariants } from "./button";

const AlertDialog = Dialog;
const AlertDialogPortal = DialogPortal;
const AlertDialogOverlay = DialogOverlay;
const AlertDialogTrigger = DialogTrigger;
const AlertDialogContent = React.forwardRef((props, ref) => <DialogContent ref={ref} role="alertdialog" {...props} />);
AlertDialogContent.displayName = "AlertDialogContent";
const AlertDialogHeader = DialogHeader;
const AlertDialogFooter = DialogFooter;
const AlertDialogTitle = DialogTitle;
const AlertDialogDescription = DialogDescription;
const AlertDialogCancel = React.forwardRef(({ className, ...props }, ref) => <DialogClose ref={ref} className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />);
AlertDialogCancel.displayName = "AlertDialogCancel";
const AlertDialogAction = React.forwardRef(({ className, ...props }, ref) => <DialogClose ref={ref} className={cn(buttonVariants(), className)} {...props} />);
AlertDialogAction.displayName = "AlertDialogAction";

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
