import { useCallback, useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Search, X } from "lucide-react";

import { Text } from "@/components/Text";
import { cn } from "@/lib/cn";

import styles from "./MobileNav.module.css";

export type MobileNavVariant = "home" | "day" | "event";

export interface MobileNavProps {
  variant?: MobileNavVariant;
  title?: string;
}

const menuLinks = [
  { to: "/" as const, label: "EVENTS", exact: true },
  { to: "/search" as const, label: "SEARCH", exact: false, search: { q: "" } },
  { to: "/map" as const, label: "MAP", exact: false }
];

export function MobileNav({ variant = "home", title }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeMenu, menuOpen]);

  return (
    <>
      <header className={styles.nav} data-testid="mobile-nav">
        {variant === "home" ? (
          <>
            <button
              type="button"
              className={styles.iconBtn}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={openMenu}
            >
              <Menu size={22} />
            </button>
            <Link to="/" className={styles.logoCenter}>
              <img src="/brand/fresno-logo.png" alt="What Up Fresno" height={40} />
            </Link>
            <Link to="/search" search={{ q: "" }} className={styles.iconBtn} aria-label="Search">
              <Search size={20} />
            </Link>
          </>
        ) : variant === "day" ? (
          <>
            <Link to="/" className={styles.iconBtn} aria-label="Back">
              ←
            </Link>
            <Text variant="navLabel" tone="onNav" as="span" className={styles.title}>
              {title}
            </Text>
            <Link to="/search" search={{ q: "" }} className={styles.iconBtn} aria-label="Search">
              <Search size={20} />
            </Link>
          </>
        ) : (
          <>
            <Link to="/" className={styles.iconBtn} aria-label="Back">
              ←
            </Link>
            <Text variant="navLabel" tone="onNav" as="span" className={styles.title}>
              EVENT DETAILS
            </Text>
            <span className={styles.iconSpacer} aria-hidden />
          </>
        )}
      </header>

      {variant === "home" ? (
        <div
          className={cn(styles.menuRoot, menuOpen && styles.menuOpen)}
          data-testid="mobile-nav-menu"
          aria-hidden={!menuOpen}
          {...(!menuOpen ? { inert: true } : {})}
        >
          <button
            type="button"
            className={styles.menuBackdrop}
            aria-label="Close menu"
            tabIndex={menuOpen ? 0 : -1}
            onClick={closeMenu}
          />
          <nav id={menuId} className={styles.menuPanel} aria-label="Site">
            <button
              type="button"
              className={styles.menuClose}
              aria-label="Close navigation"
              tabIndex={menuOpen ? 0 : -1}
              onClick={closeMenu}
            >
              <X size={22} />
            </button>
            {menuLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                {...("search" in link ? { search: link.search } : {})}
                className={styles.menuLink}
                activeProps={{ className: styles.menuLinkActive }}
                activeOptions={{ exact: link.exact }}
                tabIndex={menuOpen ? 0 : -1}
                onClick={closeMenu}
              >
                <Text variant="navLabel" tone="inherit" as="span">
                  {link.label}
                </Text>
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
