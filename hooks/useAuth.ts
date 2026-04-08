"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function useAuth() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("teamhub_auth") !== "true") {
      router.replace("/");
    } else {
      setAuthed(true);
    }
  }, [router]);
  return authed;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("teamhub_auth");
    window.location.href = "/";
  }
}
