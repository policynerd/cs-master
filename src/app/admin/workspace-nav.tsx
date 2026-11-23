"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav({ admin }: { admin: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: "Dashboard", active: path === "/admin" },
    { href: "/admin/meetings", label: "Meetings", active: path.startsWith("/admin/meetings") },
    ...(admin ? [{ href: "/admin/users", label: "Staff access", active: path.startsWith("/admin/users") }] : []),
  ];
  return (
    <nav className="ws-nav" aria-label="Clerk workspace">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.active ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
