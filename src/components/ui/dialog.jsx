import * as React from "react";
import { cn, useControllableState, useStableId } from "../../lib/utils";

const DialogContext = React.createContext(null);

function useDialogContext() {
  return React.useContext(DialogContext);
}

function Dialog({ open, defaultOpen = false, onOpenChange, children }) {
  const [isOpen, setOpen] = useControllableState({
    value: open,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return <DialogContext.Provider value={{ open: Boolean(isOpen), setOpen }}>{children}</DialogContext.Provider>;
}

function DialogTrigger({ asChild = false, children, ...props }) {
  const context = React.useContext(DialogContext);
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: (event) => {
        children.props.onClick?.(event);
        if (!event.defaultPrevented) context?.setOpen(true);
      },
      ...props,
    });
  }
  return <button type="button" onClick={() => context?.setOpen(true)} {...props}>{children}</button>;
}

function DialogPortal({ children }) {
  return <>{children}</>;
}

function DialogOverlay({ className, ...props }) {
  const context = React.useContext(DialogContext);
  if (!context?.open) return null;
  return <div className={cn("fixed inset-0 z-50 bg-black/80", className)} {...props} />;
}

const DialogContent = React.forwardRef(({ className, children, role = "dialog", ...props }, ref) => {
  const context = React.useContext(DialogContext);
  const titleId = useStableId("dialog-title");
  if (!context?.open) return null;
  return (
    <DialogPortal>
      <DialogOverlay />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg",
          "rounded-lg duration-200",
          className,
        )}
        {...props}
      >
        <DialogTitle id={titleId} className="sr-only">Dialogo</DialogTitle>
        {children}
        <button type="button" className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onClick={() => context.setOpen(false)}>
          <span aria-hidden="true">x</span>
          <span className="sr-only">Fechar</span>
        </button>
      </div>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }) => <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />;
const DialogFooter = ({ className, ...props }) => <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />;
const DialogTitle = React.forwardRef(({ className, ...props }, ref) => <h2 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />);
DialogTitle.displayName = "DialogTitle";
const DialogDescription = React.forwardRef(({ className, ...props }, ref) => <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />);
DialogDescription.displayName = "DialogDescription";
const DialogClose = React.forwardRef(({ className, ...props }, ref) => {
  const context = React.useContext(DialogContext);
  return <button ref={ref} type="button" className={className} onClick={() => context?.setOpen(false)} {...props} />;
});
DialogClose.displayName = "DialogClose";

export { Dialog, DialogPortal, DialogOverlay, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, useDialogContext };
