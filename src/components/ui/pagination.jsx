import * as React from "react";
import { cn } from "../../lib/utils";
import { Button, buttonVariants } from "./button";

const Pagination = ({ className, ...props }) => <nav role="navigation" aria-label="pagination" className={cn("mx-auto flex w-full justify-center", className)} {...props} />;
const PaginationContent = React.forwardRef(({ className, ...props }, ref) => <ul ref={ref} className={cn("flex flex-row items-center gap-1", className)} {...props} />);
PaginationContent.displayName = "PaginationContent";
const PaginationItem = React.forwardRef(({ className, ...props }, ref) => <li ref={ref} className={cn("", className)} {...props} />);
PaginationItem.displayName = "PaginationItem";

function PaginationLink({ className, isActive, size = "icon", ...props }) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  );
}

const PaginationPrevious = ({ className, children = "Anterior", ...props }) => (
  <PaginationLink aria-label="Ir para pagina anterior" size="default" className={cn("gap-1 pl-2.5", className)} {...props}>{children}</PaginationLink>
);

const PaginationNext = ({ className, children = "Proxima", ...props }) => (
  <PaginationLink aria-label="Ir para proxima pagina" size="default" className={cn("gap-1 pr-2.5", className)} {...props}>{children}</PaginationLink>
);

const PaginationEllipsis = ({ className, ...props }) => (
  <span aria-hidden className={cn("flex h-9 w-9 items-center justify-center", className)} {...props}>...</span>
);

function PaginationButton(props) {
  return <Button variant="ghost" size="icon" {...props} />;
}

export { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis, PaginationButton };
