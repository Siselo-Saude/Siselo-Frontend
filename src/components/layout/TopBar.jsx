import * as React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function TopBar({ section = "Inicio", title = "Painel de Controle", role = "Administrador", className }) {
  return (
    <header className={cn("sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-b bg-white/95 px-6 shadow-sm backdrop-blur", className)}>
      <div className="min-w-0">
        <span className="block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{section}</span>
        <strong className="block truncate text-sm font-black text-slate-900">{title}</strong>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="hidden border-blue-200 bg-blue-50 text-blue-700 sm:inline-flex">
          {role}
        </Badge>
        <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 md:inline-flex">{formatDate()}</span>
        <Button asChild size="sm" variant="outline">
          <a href="/login.html">Sair</a>
        </Button>
      </div>
    </header>
  );
}
