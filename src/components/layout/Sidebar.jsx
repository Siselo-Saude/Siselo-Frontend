import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const NAV_ITEMS = [
  { label: "Inicio", description: "Painel geral", href: "/index.html", key: "home" },
  { label: "CADH", description: "Atenção secundária", href: "/cadh/index.html", key: "cadh" },
  { label: "UBS", description: "Atencao primaria", href: "/ubs/index.html", key: "ubs" },
];

function iconFor(key) {
  const icons = {
    home: <path d="m4 10 8-6 8 6v10H4V10Z" />,
    cadh: <path d="M3 13h4l2-7 4 14 2-7h6" />,
    ubs: <path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" />,
  };
  return icons[key] || icons.home;
}

export default function Sidebar({ collapsed = false, onCollapsedChange, activeKey = "home", user, className }) {
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-[#07345d] text-white transition-all duration-200",
        collapsed ? "w-16" : "w-60",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 12h14M12 5c2 2.1 3 4.4 3 7s-1 4.9-3 7M12 5c-2 2.1-3 4.4-3 7s1 4.9 3 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {!collapsed ? (
          <span className="grid leading-tight">
            <strong className="text-sm font-black tracking-wide">SISELO</strong>
            <small className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-200">Sistema de Saude</small>
          </span>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Modulos principais">
        {!collapsed ? <p className="mb-3 px-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">Modulos</p> : null}
        {NAV_ITEMS.map((item) => {
          const active = activeKey === item.key;
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative grid min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm text-blue-200 transition-colors hover:bg-white/10 hover:text-white",
                collapsed ? "grid-cols-1 place-items-center" : "grid-cols-[24px_1fr]",
                active && "bg-[#315c82] text-white before:absolute before:inset-y-3 before:left-0 before:w-1 before:rounded-r-full before:bg-teal-300",
              )}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {iconFor(item.key)}
              </svg>
              {!collapsed ? (
                <span className="min-w-0">
                  <strong className="block truncate text-sm">{item.label}</strong>
                  <small className="block truncate text-xs text-blue-200/80">{item.description}</small>
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>

      <div className="grid gap-2 border-t border-white/10 p-3">
        {!collapsed ? (
          <a href="/admin/users/list.html" className="rounded-xl px-3 py-2 text-sm font-bold text-blue-200 hover:bg-white/10 hover:text-white">
            Configuracoes
          </a>
        ) : null}
        <div className={cn("grid items-center gap-2 rounded-xl bg-white/10 p-2", collapsed ? "place-items-center" : "grid-cols-[32px_1fr]")}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="3" />
              <path d="M5 20a7 7 0 0 1 14 0" />
            </svg>
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <strong className="block truncate text-xs">{user?.name || "Administrador"}</strong>
              <small className="block truncate text-[11px] text-blue-200">{user?.email || "admin@local"}</small>
            </span>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" className="text-blue-100 hover:bg-white/10 hover:text-white" onClick={() => onCollapsedChange?.(!collapsed)}>
          {collapsed ? "Abrir" : "Recolher"}
        </Button>
      </div>
    </aside>
  );
}
