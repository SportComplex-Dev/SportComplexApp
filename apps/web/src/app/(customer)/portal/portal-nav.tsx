"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Brand } from "@/components/brand";
import { useThemeToggle } from "@/components/theme-toggle";

export function PortalNav() {
  const pathname = usePathname();
  const { dark, toggleTheme } = useThemeToggle();
  const linkClass = (href: string) =>
    pathname === href
      ? "text-sm font-semibold text-[#183e30] dark:text-[#c9ef75]"
      : "text-sm font-medium text-[#68776d] transition hover:text-[#183e30] dark:text-[#bdc9bf] dark:hover:text-white";
  const mobileLinkClass = (href: string) =>
    pathname === href
      ? "text-xs font-bold text-[#183e30] dark:text-[#c9ef75]"
      : "text-xs font-medium text-[#68776d] dark:text-[#bdc9bf]";

  return (
    <nav
      aria-label="Navegación del portal"
      className="sticky top-0 z-40 border-b border-[#e5e9e2] bg-white/95 backdrop-blur dark:border-[#29352e] dark:bg-[#18221c]/95"
    >
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AKROS SportComplex, inicio" className="shrink-0">
          <Brand />
        </Link>
        <div className="hidden items-center gap-7 sm:flex">
          <Link
            href="/portal/book"
            aria-current={pathname === "/portal/book" ? "page" : undefined}
            className={linkClass("/portal/book")}
          >
            Reservar
          </Link>
          <Link
            href="/portal/history"
            aria-current={pathname === "/portal/history" ? "page" : undefined}
            className={linkClass("/portal/history")}
          >
            Historial
          </Link>
          <Link
            href="/portal/membership"
            aria-current={pathname === "/portal/membership" ? "page" : undefined}
            className={linkClass("/portal/membership")}
          >
            Membresía
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className="grid h-10 w-10 place-items-center rounded-full border border-[#e0e6df] text-[#385344] transition hover:bg-[#f1f4ee] dark:border-[#39483e] dark:text-[#dce8dd] dark:hover:bg-[#26342b]"
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="hidden h-7 border-l border-[#e0e6df] dark:border-[#39483e] sm:block" />
          <Link
            href="/portal"
            className="hidden rounded-full bg-[#183e30] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24543e] sm:inline-flex dark:bg-[#c9ef75] dark:text-[#19352a] dark:hover:bg-[#d6f694]"
          >
            Mi portal
          </Link>
        </div>
      </div>
      <div className="flex gap-5 border-t border-[#edf0eb] px-4 py-2.5 sm:hidden dark:border-[#29352e]">
        <Link href="/portal/book" aria-current={pathname === "/portal/book" ? "page" : undefined} className={mobileLinkClass("/portal/book")}>
          Reservar
        </Link>
        <Link href="/portal/history" aria-current={pathname === "/portal/history" ? "page" : undefined} className={mobileLinkClass("/portal/history")}>
          Historial
        </Link>
        <Link href="/portal/membership" aria-current={pathname === "/portal/membership" ? "page" : undefined} className={mobileLinkClass("/portal/membership")}>
          Membresía
        </Link>
      </div>
    </nav>
  );
}
