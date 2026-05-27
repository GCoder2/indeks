import { Link, NavLink, useLocation } from "react-router-dom";
import { Search, Heart, Clock, Image as ImageIcon, ShieldCheck, Compass } from "lucide-react";

const navItems = [
  { to: "/", label: "Ana Sayfa", icon: Compass, end: true },
  { to: "/favorites", label: "Favoriler", icon: Heart },
  { to: "/history", label: "Geçmiş", icon: Clock },
  { to: "/admin", label: "Yönetim", icon: ShieldCheck },
];

export default function Layout({ children, hideHeader = false }) {
  const location = useLocation();
  const onHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-main)]">
      {!hideHeader && (
        <header
          data-testid="app-header"
          className="sticky top-0 z-30 w-full border-b border-zinc-200 bg-white/85 backdrop-blur"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
            <Link to="/" data-testid="brand-link" className="flex items-center gap-2">
              <div
                className="grid h-8 w-8 place-items-center rounded-md text-white"
                style={{ backgroundColor: "var(--brand)" }}
              >
                <Search className="h-4 w-4" strokeWidth={2.25} />
              </div>
              <span className="font-display text-lg font-bold tracking-tight">
                indeks<span style={{ color: "var(--brand)" }}>.</span>
              </span>
            </Link>
            <nav className="ml-auto flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  data-testid={`nav-${item.to.replace("/", "") || "home"}`}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-700 hover:bg-zinc-100"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
      )}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-zinc-500 flex items-center justify-between">
          <span>indeks. — kendi internetini indeksle</span>
          <span className="font-mono">v0.1 · Gemini 3 Flash</span>
        </div>
      </footer>
    </div>
  );
}
