"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMsal, getRedirectResult } from "@/lib/msal";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    getMsal()
      .then(() => {
        router.replace("/dashboard");
      })
      .catch(() => {
        router.replace("/dashboard");
      });
  }, [router]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "var(--bg, #09090b)", color: "var(--text-dim, #a1a1aa)",
      fontFamily: "system-ui, sans-serif", fontSize: "13px",
    }}>
      Completing sign-in…
    </div>
  );
}
