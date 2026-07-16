import * as React from "react";
import { cn } from "../../lib/utils";

function ResizablePanelGroup({ className, direction = "horizontal", ...props }) {
  return <div className={cn("flex h-full w-full", direction === "vertical" && "flex-col", className)} {...props} />;
}

function ResizablePanel({ className, defaultSize, style, ...props }) {
  return <div className={cn("min-w-0 flex-1", className)} style={{ flexBasis: defaultSize ? `${defaultSize}%` : undefined, ...style }} {...props} />;
}

function ResizableHandle({ className, withHandle = false, ...props }) {
  return (
    <div className={cn("relative flex w-px items-center justify-center bg-border", className)} {...props}>
      {withHandle ? <div className="z-10 h-4 w-3 rounded-sm border bg-border" /> : null}
    </div>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
