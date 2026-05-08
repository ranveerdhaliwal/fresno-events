import { Link, Outlet } from "@tanstack/react-router";
import { CalendarDays, Compass, Map, Search, Settings, Star, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/cn";

const navItems = [
  { to: "/", label: "Today", icon: Compass },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/explore", label: "Explore", icon: Search },
  { to: "/map", label: "Map", icon: Map },
  { to: "/saved", label: "Saved", icon: Star },
  { to: "/settings", label: "Settings", icon: Settings }
] as const;

export function AppShell() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/82 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="group rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background">
            <span className="block font-display text-2xl font-semibold tracking-tight text-foreground">
              What Up Fresno
            </span>
            <span className="block text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
              Central Valley
            </span>
          </Link>
          <nav aria-label="Desktop primary navigation" className="hidden items-center gap-1 rounded-full border border-border/70 bg-card/70 p-1 shadow-soft md:flex">
            {navItems.map((item) => (
              <NavLink key={item.to} {...item} />
            ))}
          </nav>
          <nav aria-label="Mobile utility navigation" className="flex items-center gap-1 md:hidden">
            <MobileUtilityLink to="/saved" label="Saved" icon={Star} />
            <MobileUtilityLink to="/settings" label="Settings" icon={Settings} />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-8 md:pb-8 lg:px-8">
        <Outlet />
      </main>

      <nav aria-label="Mobile primary navigation" className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 grid grid-cols-5 rounded-[1.75rem] border border-border/70 bg-card/90 p-2 shadow-float backdrop-blur-xl md:hidden">
        {navItems.slice(0, 5).map((item) => (
          <MobileNavLink key={item.to} {...item} />
        ))}
      </nav>
    </div>
  );
}

function MobileUtilityLink({ to, label, icon: Icon }: { to: (typeof navItems)[number]["to"]; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-full border border-border/70 bg-card/75 text-muted-foreground shadow-soft outline-none transition hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon aria-hidden="true" className="size-5" />
    </Link>
  );
}

function NavLink({ to, label, icon: Icon }: (typeof navItems)[number]) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      activeProps={{ className: "bg-primary text-primary-foreground shadow-soft" }}
      inactiveProps={{ className: "text-muted-foreground hover:bg-muted hover:text-foreground" }}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </Link>
  );
}

function MobileNavLink({ to, label, icon: Icon }: (typeof navItems)[number]) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[0.68rem] font-semibold text-muted-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring"
      activeProps={{ className: "bg-primary text-primary-foreground" }}
    >
      {({ isActive }) => (
        <>
          <Icon aria-hidden="true" className={cn("size-5", isActive && "stroke-[2.4]")} />
          <span>{label}</span>
        </>
      )}
    </Link>
  );
}
