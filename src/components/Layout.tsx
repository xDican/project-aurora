import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { es } from "@/lib/i18n/es";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CalendarCheck,
  BedDouble,
  Users,
  BookOpen,
  Map,
  BarChart3,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
}

type UserRole = "admin" | "receptionist";

const navItems: Array<{
  path: string;
  label: string;
  icon: typeof Calendar;
  roles?: UserRole[];
}> = [
  { path: "/hoy", label: "Hoy", icon: Calendar },
  { path: "/disponibilidad", label: "Disponibilidad", icon: CalendarCheck },
  { path: "/rooms", label: "Habitaciones", icon: BedDouble, roles: ["admin"] },
  { path: "/guests", label: "Huéspedes", icon: Users },
  { path: "/reservas", label: "Reservas", icon: BookOpen },
  { path: "/mapa", label: "Mapa", icon: Map },
  { path: "/reportes", label: "Reportes", icon: BarChart3, roles: ["admin"] },
];

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, session, role, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const roleLabel = currentUser?.role
    ? es.auth.roles[currentUser.role as keyof typeof es.auth.roles]
    : null;

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">Project Aurora</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "gap-2",
                    isActive && "bg-secondary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* User info & Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {currentUser?.email || session?.user?.email}
              </span>
              {roleLabel && (
                <Badge variant="outline" className="text-xs">
                  {roleLabel}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              {es.auth.logout}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden border-t px-4 py-2 flex gap-1 overflow-x-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Button
                key={item.path}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate(item.path)}
                className="gap-1 flex-shrink-0"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
