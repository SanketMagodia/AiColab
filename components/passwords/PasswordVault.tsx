"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { Credential } from "@/lib/types";
import CredentialRow from "./CredentialRow";
import Skeleton from "@/components/ui/Skeleton";

const ENVS: Credential["env"][] = ["DEV", "QA", "UAT", "STAGING", "PROD"];

export default function PasswordVault() {
  const [tab, setTab] = useState<Credential["env"]>("DEV");
  const swrKey = `/api/passwords?env=${tab}`;
  const { data: creds, isLoading } = useSWR<Credential[]>(swrKey, fetcher, { refreshInterval: 5000 });
  const [newRows, setNewRows] = useState<Credential[]>([]);

  function addRow() {
    setNewRows((r) => [
      ...r,
      {
        _id: `new-${Date.now()}`,
        env: tab,
        label: "",
        username: "",
        password: "",
        createdAt: "",
      },
    ]);
  }

  function removeNew(id: string) {
    setNewRows((r) => r.filter((x) => x._id !== id));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h1 className="page-title">Password Vault</h1>
        <button className="btn" onClick={addRow}>+ Add Credential</button>
      </div>
      <div className="tabs">
        {ENVS.map((e) => (
          <button key={e} className={tab === e ? "active" : ""} onClick={() => { setTab(e); setNewRows([]); }}>
            {e}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Skeleton height={200} />
      ) : (
        <div className="pw-table-wrap">
        <table className="pw-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Username</th>
              <th>Password</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {(!creds || creds.length === 0) && newRows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <div className="empty">
                    <span className="icon">🔑</span>
                    No credentials in {tab} yet. Click "Add Credential" to begin.
                  </div>
                </td>
              </tr>
            )}
            {creds?.map((c) => (
              <CredentialRow key={c._id} cred={c} swrKey={swrKey} />
            ))}
            {newRows.map((c) => (
              <CredentialRow key={c._id} cred={c} initialEdit swrKey={swrKey} onCancelNew={() => removeNew(c._id)} />
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
