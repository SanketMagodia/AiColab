"use client";

import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { LogoutIcon } from "./icons";

export default function TopBar() {
  const router = useRouter();
  function logout() {
    localStorage.removeItem("teamhub_auth");
    router.replace("/");
  }
  return (
    <div className="topbar">
      <div />
      <div className="topbar-actions">
        <ThemeToggle />
        <button className="btn-ghost" onClick={logout} title="Logout">
          <LogoutIcon size={16} />
          <span className="hide-mobile">Logout</span>
        </button>
      </div>
    </div>
  );
}
