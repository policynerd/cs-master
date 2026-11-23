import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import { getOrganization } from "@/lib/public";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

// Every page reads live meeting data; never serve a stale agenda from the build.
export const dynamic = "force-dynamic";

const display = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const ui = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const org = await getOrganization();
  return {
    title: { default: `${org.name} · Meetings & Agendas`, template: `%s · ${org.shortName ?? org.name}` },
    description: `Public meeting agendas, minutes and votes for ${org.name} boards and commissions.`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const org = await getOrganization();
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">
              <span className="brand-sub">Public Meetings</span>
              <span className="brand-name">{org.name}</span>
            </Link>
            <SiteNav />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span>
              {org.name} · Office of the Clerk
            </span>
            <span>
              Meeting times are shown in {org.timezone.replace("_", " ")} time. Agendas may be amended up to
              the legal notice deadline.
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
