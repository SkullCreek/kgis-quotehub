import Link from "next/link";
import { COMPANY } from "@/config/company";
import { NavLink } from "@/components/nav-link";
import { SignOutButton } from "@/components/sign-out-button";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            {COMPANY.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={COMPANY.logoPath}
                alt=""
                className="h-7 sm:h-8 w-auto object-contain"
              />
            ) : null}
            <span className="text-sm font-semibold tracking-tight text-slate-900 truncate max-w-[200px] sm:max-w-none">
              {COMPANY.name}
            </span>
          </Link>

          <nav className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs sm:text-sm">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/quotations">Quotations</NavLink>
            <NavLink href="/invoices">Invoices</NavLink>
            <NavLink href="/customers">Customers</NavLink>
            <NavLink href="/products">Products</NavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-3 sm:px-4 py-4 sm:py-6">
        {children}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4 text-xs text-slate-400 text-center sm:text-left">
          {COMPANY.name} · GSTIN {COMPANY.gstin}
        </div>
      </footer>
    </>
  );
}
