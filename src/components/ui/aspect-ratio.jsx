import * as React from "react";
import { cn } from "../../lib/utils";

const AspectRatio = React.forwardRef(({ ratio = 16 / 9, className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("relative w-full overflow-hidden", className)}
    style={{ aspectRatio: String(ratio), ...style }}
    {...props}
  />
));
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
