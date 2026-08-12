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
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            {COMPANY.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={COMPANY.logoPath}
                alt=""
                className="h-8 w-auto object-contain"
              />
            ) : null}
            <span className="text-sm font-semibold tracking-tight text-slate-900">
              {COMPANY.name}
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/quotations">Quotations</NavLink>
            <NavLink href="/invoices">Invoices</NavLink>
            <NavLink href="/customers">Customers</NavLink>
            <NavLink href="/products">Products</NavLink>
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white py-4">
        <div className="mx-auto max-w-6xl px-4 text-xs text-slate-400">
          {COMPANY.name} · GSTIN {COMPANY.gstin}
        </div>
      </footer>
    </>
  );
}
