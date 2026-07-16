import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";

const NAV_ITEMS = [
  { label: "Home", href: "/index.html", key: "home" },
  { label: "CADH", href: "/cadh/index.html", key: "cadh" },
  { label: "UBS", href: "/ubs/index.html", key: "ubs" },
];

export default function TopNav({ activeKey = "home", className }) {
  return (
    <header className={cn("sticky top-0 z-40 flex min-h-14 items-center justify-between bg-teal-700 px-5 text-white shadow-md", className)}>
      <a href="/index.html" className="flex items-center gap-2 font-black tracking-wide">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15">+</span>
        SISELO
      </a>
      <nav className="flex items-center gap-2" aria-label="Navegacao principal">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            aria-current={activeKey === item.key ? "page" : undefined}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-bold text-white/80 hover:bg-white/10 hover:text-white", activeKey === item.key && "bg-white text-teal-700")}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <Button asChild size="sm" variant="secondary">
        <a href="/admin/users/list.html">Configuracoes</a>
      </Button>
    </header>
  );
}
