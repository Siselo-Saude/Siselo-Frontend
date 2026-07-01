import * as React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { cn } from "../../lib/utils";

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 64;

export default function AppLayout({
  children,
  activeKey = "home",
  section = "Inicio",
  title = "Painel de Controle",
  user,
  className,
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <div className={cn("min-h-screen bg-[#edf3f7] text-slate-900", className)}>
      <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed} activeKey={activeKey} user={user} />
      <div className="min-h-screen transition-[margin] duration-200" style={{ marginLeft: sidebarWidth }}>
        <TopBar section={section} title={title} role={user?.role || "Administrador"} />
        <main className="mx-auto w-full max-w-[1320px] px-5 py-5">{children}</main>
      </div>
    </div>
  );
}
