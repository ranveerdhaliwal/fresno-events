import { Link, Outlet, useRouterState } from "@tanstack/react-router";

import { useAdminMode } from "@/features/admin-mode/AdminModeProvider";

import styles from "./AdminShell.module.css";

const TABS = [
  { to: "/admin" as const, label: "Review", exact: true },
  { to: "/admin/homepage" as const, label: "Homepage", exact: false }
];

export function AdminShell() {
  const { adminModeEnabled, toggleAdminMode } = useAdminMode();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <>
      <header className={styles.bar}>
        <Link to="/" className={styles.home}>
          ← What Up Fresno
        </Link>
        <nav className={styles.tabs} aria-label="Admin sections">
          {TABS.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={active ? styles.tabActive : styles.tab}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <label className={styles.modeToggle}>
          <input type="checkbox" checked={adminModeEnabled} onChange={toggleAdminMode} />
          Admin mode
        </label>
      </header>
      <div className={styles.content}>
        <Outlet />
      </div>
    </>
  );
}
