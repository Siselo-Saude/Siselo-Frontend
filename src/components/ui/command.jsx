import * as React from "react";
import { cn } from "../../lib/utils";
import { Dialog, DialogContent } from "./dialog";

const Command = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)} {...props} />
));
Command.displayName = "Command";

function CommandDialog({ children, ...props }) {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command>{children}</Command>
      </DialogContent>
    </Dialog>
  );
}

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3">
    <span className="mr-2 opacity-50" aria-hidden="true">?</span>
    <input ref={ref} className={cn("flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground", className)} {...props} />
  </div>
));
CommandInput.displayName = "CommandInput";
const CommandList = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)} {...props} />);
CommandList.displayName = "CommandList";
const CommandEmpty = React.forwardRef((props, ref) => <div ref={ref} className="py-6 text-center text-sm" {...props} />);
CommandEmpty.displayName = "CommandEmpty";
const CommandGroup = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("overflow-hidden p-1 text-foreground", className)} {...props} />);
CommandGroup.displayName = "CommandGroup";
const CommandSeparator = React.forwardRef(({ className, ...props }, ref) => <div ref={ref} className={cn("-mx-1 h-px bg-border", className)} {...props} />);
CommandSeparator.displayName = "CommandSeparator";
const CommandItem = React.forwardRef(({ className, ...props }, ref) => <button ref={ref} type="button" className={cn("relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent", className)} {...props} />);
CommandItem.displayName = "CommandItem";
const CommandShortcut = ({ className, ...props }) => <span className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />;

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandShortcut, CommandSeparator };
