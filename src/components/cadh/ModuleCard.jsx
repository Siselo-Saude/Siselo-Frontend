import * as React from "react";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";

const MODULE_COLORS = {
  users: "bg-blue-50 text-blue-700 border-blue-100",
  careplans: "bg-emerald-50 text-emerald-700 border-emerald-100",
  encounters: "bg-amber-50 text-amber-700 border-amber-100",
  transitions: "bg-teal-50 text-teal-700 border-teal-100",
};

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 14h4l2-7 4 14 2-7h4" />
    </svg>
  );
}

export default function ModuleCard({
  icon: Icon = DefaultIcon,
  label,
  description,
  count,
  status,
  active = false,
  disabled = false,
  moduleKey = "users",
  onClick,
  className,
}) {
  const color = MODULE_COLORS[moduleKey] || MODULE_COLORS.users;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "group grid min-h-[132px] w-full content-between rounded-lg border bg-white p-4 text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
        active && "border-teal-400 bg-teal-50/60 shadow-md",
        disabled && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-slate-200 hover:shadow-sm",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className={cn("grid h-10 w-10 place-items-center rounded-lg border transition-colors", color)}>
          <Icon />
        </span>
        {status ? (
          <Badge variant={status === "pendente" ? "warning" : "outline"} className="shrink-0">
            {status}
          </Badge>
        ) : null}
      </span>

      <span className="grid gap-1">
        <span className="flex items-end justify-between gap-2">
          <strong className="text-sm font-black text-slate-900">{label}</strong>
          {count !== undefined ? <span className="text-2xl font-black text-slate-900">{String(count).padStart(2, "0")}</span> : null}
        </span>
        {description ? <span className="text-xs leading-5 text-slate-500">{description}</span> : null}
      </span>
    </button>
  );
}
