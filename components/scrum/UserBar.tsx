"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { fetcher } from "@/lib/fetcher";
import type { User } from "@/lib/types";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/hooks/useToast";

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default function UserBar() {
  const { data: users = [] } = useSWR<User[]>("/api/users", fetcher, { refreshInterval: 5000 });
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);
  const toast = useToast();

  async function add() {
    if (!name.trim()) return;
    await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    });
    setName("");
    setAdding(false);
    mutate("/api/users");
    toast.push("User added");
  }

  async function remove(id: string) {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    mutate("/api/users");
    mutate("/api/tasks");
    setConfirmDelete(null);
    toast.push("User removed");
  }

  return (
    <div className="user-bar">
      <strong>Team:</strong>
      {users.map((u) => (
        <div key={u._id} className="user-chip">
          <div className="avatar" style={{ background: u.color }}>{initials(u.name)}</div>
          <span>{u.name}</span>
          <span className="x" onClick={() => setConfirmDelete(u)}>×</span>
        </div>
      ))}
      {adding ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            autoFocus
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
              if (e.key === "Escape") setAdding(false);
            }}
            style={{ width: 140 }}
          />
          <div className="color-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={c === color ? "active" : ""}
                style={{ background: c }}
              />
            ))}
          </div>
          <button className="btn" onClick={add}>Add</button>
          <button className="btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add User</button>
      )}
      <Modal
        open={!!confirmDelete}
        title="Delete user?"
        message={confirmDelete ? `Remove ${confirmDelete.name} from the team?` : ""}
        onConfirm={() => confirmDelete && remove(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
        confirmLabel="Delete"
      />
    </div>
  );
}
