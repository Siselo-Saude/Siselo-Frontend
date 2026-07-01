import * as React from "react";
import { clamp, cn } from "../../lib/utils";

const Progress = React.forwardRef(({ className, value = 0, max = 100, ...props }, ref) => {
  const percentage = max > 0 ? clamp((Number(value) / Number(max)) * 100, 0, 100) : 0;

  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Number(value)}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <div className="h-full w-full flex-1 bg-primary transition-all" style={{ transform: `translateX(-${100 - percentage}%)` }} />
    </div>
  );
});
Progress.displayName = "Progress";

export { Progress };
