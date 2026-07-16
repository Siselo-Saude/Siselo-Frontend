import * as React from "react";
import { cn } from "../../lib/utils";

const SPECIALTY_COLORS = {
  endocrinologia: "bg-orange-50 text-orange-700 border-orange-100",
  cardiologia: "bg-red-50 text-red-700 border-red-100",
  psicologia: "bg-purple-50 text-purple-700 border-purple-100",
  enfermagem: "bg-teal-50 text-teal-700 border-teal-100",
  nutricao: "bg-green-50 text-green-700 border-green-100",
  fisioterapia: "bg-blue-50 text-blue-700 border-blue-100",
  farmacia: "bg-yellow-50 text-yellow-700 border-yellow-100",
  social: "bg-pink-50 text-pink-700 border-pink-100",
  oftalmologia: "bg-indigo-50 text-indigo-700 border-indigo-100",
  tecnico: "bg-cyan-50 text-cyan-700 border-cyan-100",
};

function DefaultIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function SpecialtyCard({
  icon: Icon = DefaultIcon,
  label,
  description,
  specialtyKey = "enfermagem",
  selected = false,
  locked = false,
  onClick,
  className,
}) {
  const color = SPECIALTY_COLORS[specialtyKey] || SPECIALTY_COLORS.enfermagem;

  return (
    <button
      type="button"
      disabled={locked}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "group flex min-h-[74px] w-full items-center gap-3 rounded-lg border bg-white px-4 py-3 text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400",
        selected && "border-teal-400 bg-teal-50/70",
        locked && "cursor-not-allowed opacity-50 hover:translate-y-0 hover:border-slate-200 hover:shadow-sm",
        className,
      )}
    >
      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg border", color)}>
        <Icon />
      </span>
      <span className="min-w-0">
        <strong className="block truncate text-sm font-bold text-slate-900">{label}</strong>
        {description ? <small className="block truncate text-xs text-slate-500">{description}</small> : null}
      </span>
    </button>
  );
}
