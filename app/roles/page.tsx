
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./roles.css";

type Role = { id: number | string; roleName: string };

const panel: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e9f2", borderRadius: 14,
  padding: 22, marginBottom: 20,
};
const button: React.CSSProperties = {
  border: 0, borderRadius: 8, padding: "10px 15px",
  background: "#5947ce", color: "#fff", fontWeight: 700, cursor: "pointer",
};
const field: React.CSSProperties = {
  padding: 11, border: "1px solid #dce1eb", borderRadius: 8,
  fontSize: 14, minWidth: 0,
};

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleName, setRoleName] = useState("");
  const [editing, setEditing] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/roles");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load roles.");
      setRoles(data.roles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRoles(); }, [loadRoles]);

  async function submitRole(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);

    try {
      const response = await fetch("/api/roles", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleName: roleName.trim(),
          ...(editing ? { id: editing.id } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save role.");

      setRoleName("");
      setEditing(null);
      setMessage(editing ? "Role updated successfully." : "Role created successfully.");
      await loadRoles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save role.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteRole(role: Role) {
    if (!window.confirm(`Delete the "${role.roleName}" role and its permissions?`)) return;
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/roles?id=${encodeURIComponent(String(role.id))}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to delete role.");
      setRoles((current) => current.filter((item) => String(item.id) !== String(role.id)));
      if (String(editing?.id) === String(role.id)) {
        setEditing(null);
        setRoleName("");
      }
      setMessage("Role deleted successfully.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to delete role.");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e9f2", padding: "20px 5%", display: "flex", justifyContent: "space-between", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "#5947ce", textDecoration: "none", fontWeight: 800 }}>A AmenityFlow</Link>
        <Link href="/dashboard" style={{ color: "#5947ce", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ width: "min(1000px, 90%)", margin: "35px auto" }}>
        <p style={{ color: "#5947ce", fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>ORGANIZATION SETTINGS</p>
        <h1 style={{ margin: "8px 0" }}>Roles Management</h1>
        <p style={{ color: "#788399", marginBottom: 25 }}>Create and manage the roles used by your organization.</p>

        {error && <p role="alert" style={{ background: "#fff0f0", color: "#b42332", padding: 13, borderRadius: 8 }}>{error}</p>}
        {message && <p role="status" style={{ background: "#eaf9f0", color: "#187849", padding: 13, borderRadius: 8 }}>{message}</p>}

        <section style={panel}>
          <h2 style={{ marginTop: 0, fontSize: 18 }}>{editing ? "Edit role" : "Create a role"}</h2>
          <form onSubmit={submitRole} style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <input
              style={{ ...field, flex: "1 1 240px" }}
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="e.g. HR Manager"
              maxLength={50}
              required
            />
            <button style={button} type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "＋ Create role"}</button>
            {editing && <button type="button" style={{ ...button, background: "#687386" }} onClick={() => { setEditing(null); setRoleName(""); }}>Cancel</button>}
          </form>
        </section>

        <section style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Organization roles</h2>
            <span style={{ color: "#5947ce", background: "#f0edff", padding: "7px 10px", borderRadius: 20, fontSize: 12 }}>{roles.length} roles</span>
          </div>

          {loading ? <p>Loading roles...</p> : roles.length === 0 ? (
            <p style={{ color: "#788399", padding: "25px 0" }}>No roles created yet. Add your first role above.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 15 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead><tr style={{ background: "#f7f8fc", color: "#788399", fontSize: 12 }}>
                  <th style={{ padding: 13 }}>ROLE NAME</th>
                  <th style={{ padding: 13 }}>ROLE ID</th>
                  <th style={{ padding: 13, textAlign: "right" }}>ACTIONS</th>
                </tr></thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} style={{ borderBottom: "1px solid #edf0f5" }}>
                      <td style={{ padding: 13, fontWeight: 700 }}>{role.roleName}</td>
                      <td style={{ padding: 13, color: "#788399" }}>{role.id}</td>
                      <td style={{ padding: 13, textAlign: "right", whiteSpace: "nowrap" }}>
                        <button style={{ ...button, padding: "8px 11px", marginRight: 7 }} onClick={() => { setEditing(role); setRoleName(role.roleName); setError(""); setMessage(""); }}>Edit</button>
                        <button style={{ ...button, padding: "8px 11px", background: "#fff", color: "#c03945", border: "1px solid #f0d1d4" }} onClick={() => void deleteRole(role)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ marginTop: 22 }}><Link href="/permissions" style={{ color: "#5947ce", fontWeight: 700, textDecoration: "none" }}>Configure permissions →</Link></p>
        </section>
      </div>
    </main>
  );
}
