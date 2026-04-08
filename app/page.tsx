"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function GatePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("teamhub_auth") === "true") {
      router.replace("/scrum");
    }
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("teamhub_auth", "true");
        router.replace("/scrum");
      } else {
        setError("Incorrect password");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-theme">
        <ThemeToggle />
      </div>
      <form className="gate-box" onSubmit={submit}>
        <h1>AI Colab</h1>
        <p>Enter the team password to continue</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <div className="err">{error}</div>}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Verifying…" : "Enter"}
        </button>
      </form>
    </div>
  );
}
