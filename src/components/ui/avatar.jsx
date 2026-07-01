import * as React from "react";
import { cn, getInitials } from "../../lib/utils";

const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)} {...props} />
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef(({ className, alt = "", ...props }, ref) => (
  <img ref={ref} alt={alt} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef(({ className, children, name, ...props }, ref) => (
  <span ref={ref} className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)} {...props}>
    {children ?? getInitials(name)}
  </span>
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
