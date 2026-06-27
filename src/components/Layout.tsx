import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTracking } from "@/hooks/usePageTracking";
import { es } from "@/lib/i18n/es";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

type UserRole = "admin" | "receptionist";

const navItems: Array<{
  path: string;
  label: string;
  icon: string;
  roles?: UserRole[];
}> = [
  { path: "/hoy", label: "Hoy", icon: "today" },
  { path: "/disponibilidad", label: "Disponibilidad", icon: "calendar_view_month" },
  { path: "/reservas", label: "Reservas", icon: "event_note" },
  { path: "/mapa", label: "Mapa", icon: "map" },
  { path: "/salon", label: "Salón", icon: "event_seat" },
  { path: "/rooms", label: "Habitaciones", icon: "door_front", roles: ["admin"] },
  { path: "/guests", label: "Huéspedes", icon: "group" },
  { path: "/empresas", label: "Empresas", icon: "domain", roles: ["admin"] },
  { path: "/reportes", label: "Reportes", icon: "assessment", roles: ["admin"] },
];

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, session, role, signOut } = useAuth();

  usePageTracking();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const roleLabel = currentUser?.role
    ? es.auth.roles[currentUser.role as keyof typeof es.auth.roles]
    : null;
  const userInitials = (roleLabel ?? currentUser?.email ?? "??").slice(0, 2).toUpperCase();

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const todayLabel = new Date()
    .toLocaleDateString("es-ES", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    .replace(/,/g, "");

  return (
    <div className="bg-background text-foreground antialiased h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-sidebar_width bg-inverse-surface z-50 flex flex-col py-container_padding gap-stack_gap_md">
        <div className="px-container_padding pb-stack_gap_md flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary-foreground text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              hotel
            </span>
          </div>
          <div>
            <h1 className="text-headline-md font-bold leading-tight text-primary-container">Aurora PMS</h1>
            <p className="text-body-sm text-outline-variant">Hospitality Suite</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left",
                  isActive
                    ? "bg-primary-container text-on-primary-container font-bold"
                    : "text-outline-variant hover:text-on-primary-fixed hover:bg-on-secondary-fixed-variant"
                )}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span className="text-body-md">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 ml-sidebar_width flex flex-col h-full overflow-hidden">
        {/* Top App Bar */}
        <header className="bg-surface-container-lowest border-b border-surface-variant flex justify-between items-center w-full px-container_padding h-16 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-headline-md font-bold text-foreground">
              {filteredNavItems.find((item) => item.path === location.pathname)?.label ?? "Aurora PMS"}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-on-surface-variant text-label-md">
              <span className="material-symbols-outlined text-lg">calendar_today</span>
              <span>{todayLabel}</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 cursor-pointer hover:bg-surface-container-high py-1 px-2 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center overflow-hidden">
                    <span className="text-label-bold text-on-secondary-container">{userInitials}</span>
                  </div>
                  <span className="text-label-md font-semibold text-foreground">
                    {roleLabel ?? currentUser?.email ?? session?.user?.email}
                  </span>
                  <span className="material-symbols-outlined text-on-surface-variant text-sm">
                    expand_more
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled className="text-muted-foreground">
                  {currentUser?.email || session?.user?.email}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>{es.auth.logout}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Scrollable Canvas */}
        <main className="flex-1 overflow-y-auto p-container_padding bg-background">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
