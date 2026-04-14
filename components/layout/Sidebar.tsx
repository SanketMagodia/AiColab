"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GridIcon, KanbanIcon, KeyIcon, NoteIcon, PenIcon } from "./icons";

const links = [
  { href: "/dashboard", icon: GridIcon, label: "Dashboard" },
  { href: "/scrum", icon: KanbanIcon, label: "Tasks" },
  { href: "/passwords", icon: KeyIcon, label: "Vault" },
  { href: "/notes", icon: NoteIcon, label: "Notes" },
  { href: "/drawing", icon: PenIcon, label: "Draw" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark" />
        <span className="logo-text">AI Colab</span>
      </div>
      <nav>
        {links.map((l) => {
          const Icon = l.icon;
          const active = pathname?.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""}>
              <Icon size={18} />
              <span className="label">{l.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
