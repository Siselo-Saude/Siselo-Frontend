import * as React from "react";
import { cn } from "../../lib/utils";

const ChartContext = React.createContext({});

function ChartContainer({ id, className, config = {}, children, ...props }) {
  return (
    <ChartContext.Provider value={config}>
      <div id={id} className={cn("flex aspect-video justify-center text-xs", className)} {...props}>
        {children}
      </div>
    </ChartContext.Provider>
  );
}

function useChart() {
  return React.useContext(ChartContext);
}

function ChartTooltipContent({ active, payload, label, className }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn("grid min-w-[8rem] gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl", className)}>
      {label ? <div className="font-medium">{label}</div> : null}
      {payload.map((item) => (
        <div key={item.name || item.dataKey} className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{item.name || item.dataKey}</span>
          <span className="font-mono font-medium tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function ChartLegendContent({ payload = [], className }) {
  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      {payload.map((item) => (
        <div key={item.value} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export { ChartContainer, ChartTooltipContent, ChartLegendContent, useChart };
