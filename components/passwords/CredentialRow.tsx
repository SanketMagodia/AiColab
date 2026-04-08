"use client";

import { useEffect, useRef, useState } from "react";
import { mutate } from "swr";
import type { Credential } from "@/lib/types";
import { useToast } from "@/hooks/useToast";
import Modal from "@/components/ui/Modal";

type Props = {
  cred: Credential;
  initialEdit?: boolean;
  onCancelNew?: () => void;
  swrKey: string;
};

export default function CredentialRow({ cred, initialEdit = false, onCancelNew, swrKey }: Props) {
  const [editing, setEditing] = useState(initialEdit);
  const [reveal, setReveal] = useState(false);
  const [label, setLabel] = useState(cred.label);
  const [username, setUsername] = useState(cred.username);
  const [password, setPassword] = useState(cred.password);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const wrapRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    setLabel(cred.label);
    setUsername(cred.username);
    setPassword(cred.password);
  }, [cred]);

  async function save() {
    if (cred._id.startsWith("new-")) {
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ env: cred.env, label, username, password }),
      });
      if (res.ok) toast.push("Credential added");
      onCancelNew?.();
    } else {
      await fetch(`/api/passwords/${cred._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, username, password, env: cred.env }),
      });
      toast.push("Credential saved");
    }
    setEditing(false);
    mutate(swrKey);
  }

  function cancel() {
    if (cred._id.startsWith("new-")) {
      onCancelNew?.();
      return;
    }
    setLabel(cred.label);
    setUsername(cred.username);
    setPassword(cred.password);
    setEditing(false);
  }

  async function remove() {
    await fetch(`/api/passwords/${cred._id}`, { method: "DELETE" });
    mutate(swrKey);
    toast.push("Credential deleted");
    setConfirmDelete(false);
  }

  function copy(text: string, what: string) {
    navigator.clipboard.writeText(text);
    toast.push(`${what} copied!`);
  }

  if (editing) {
    return (
      <tr ref={wrapRef}>
        <td>
          <input
            value={label}
            autoFocus
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          />
        </td>
        <td>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          />
        </td>
        <td>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          />
        </td>
        <td>
          <div className="pw-actions">
            <button className="icon-btn" onClick={save} title="Save">✓</button>
            <button className="icon-btn" onClick={cancel} title="Cancel">×</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr onDoubleClick={() => setEditing(true)}>
      <td>{cred.label || <em style={{ color: "var(--text-dim)" }}>(no label)</em>}</td>
      <td className="pw-cell mono" onClick={() => copy(cred.username, "Username")}>
        {cred.username}
      </td>
      <td className="pw-cell mono" onClick={() => copy(cred.password, "Password")}>
        {reveal ? cred.password : "••••••••••"}
      </td>
      <td>
        <div className="pw-actions">
          <button className="icon-btn" onClick={() => setReveal((r) => !r)} title="Reveal">
            {reveal ? "🙈" : "👁"}
          </button>
          <button className="icon-btn" onClick={() => setEditing(true)} title="Edit">✎</button>
          <button className="icon-btn" onClick={() => setConfirmDelete(true)} title="Delete">🗑</button>
        </div>
        <Modal
          open={confirmDelete}
          title="Delete credential?"
          message="This action cannot be undone."
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
          confirmLabel="Delete"
        />
      </td>
    </tr>
  );
}
