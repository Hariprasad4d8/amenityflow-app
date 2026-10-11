
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Role = { id: number | string; roleName: string };
type ModuleName = "employees" | "amenities" | "bookings" | "invoices";
type Permission = {
  id?: number;
  roleId: number | string;
  module: ModuleName;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canPublish: boolean;
};

const modules: { id: ModuleName; label: string; description: string }[] = [
  { id: "employees", label: "Employees", description: "Employee records and details" },
  { id: "amenities", label: "Amenities", description: "Amenities and publication status" },
  { id: "bookings", label: "Bookings", description: "Booking records and status" },
  { id: "invoices", label: "Invoices", description: "Invoices and payment status" },
];

const permissionKeys = [
  { key: "canCreate", label: "Create" },
  { key: "canRead", label: "Read" },
  { key: "canUpdate", label: "Update" },
  { key: "canDelete", label: "Delete" },
  { key: "canPublish", label: "Publish" },
] as const;

const panel: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e9f2",
  borderRadius: 14, padding: 22, marginBottom: 20,
};

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleId, setRoleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [roleResponse, permissionResponse] = await Promise.all([
        fetch("/api/roles"),
        fetch("/api/permissions"),
      ]);
      const roleData = await roleResponse.json();
      const permissionData = await permissionResponse.json();

      if (!roleResponse.ok) throw new Error(roleData.error || "Unable to load roles.");
      if (!permissionResponse.ok) throw new Error(permissionData.error || "Unable to load permissions.");

      const loadedRoles: Role[] = roleData.roles ?? [];
      setRoles(loadedRoles);
      setPermissions(permissionData.permissions ?? []);
      setRoleId((current) =>
        loadedRoles.some((role) => String(role.id) === current)
          ? current
          : String(loadedRoles[0]?.id ?? "")
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  function getPermission(moduleName: ModuleName): Permission {
    return permissions.find(
      (permission) =>
        String(permission.roleId) === roleId && permission.module === moduleName
    ) ?? {
      roleId,
      module: moduleName,
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      canPublish: false,
    };
  }

  function changePermission(moduleName: ModuleName, key: keyof Permission, value: boolean) {
    setPermissions((current) => {
      const existing = current.find(
        (permission) =>
          String(permission.roleId) === roleId && permission.module === moduleName
      );

      if (existing) {
        return current.map((permission) =>
          permission === existing ? { ...permission, [key]: value } : permission
        );
      }

      return [
        ...current,
        { ...getPermission(moduleName), [key]: value } as Permission,
      ];
    });
  }

  async function saveModule(moduleName: ModuleName) {
    if (!roleId) {
      setError("Create a role before configuring permissions.");
      return;
    }

    setSaving(moduleName);
    setError("");
    setMessage("");

    try {
      const permission = getPermission(moduleName);
      const response = await fetch("/api/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...permission, roleId: Number(roleId), module: moduleName }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Unable to save permissions.");

      setPermissions((current) => [
        ...current.filter(
          (item) =>
            !(String(item.roleId) === roleId && item.module === moduleName)
        ),
        data.permission,
      ]);
      setMessage(`Permissions for ${moduleName} saved successfully.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save permissions.");
    } finally {
      setSaving("");
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f7fb", color: "#172033", fontFamily: "Arial, sans-serif" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e9f2", padding: "20px 5%", display: "flex", justifyContent: "space-between", gap: 16 }}>
        <Link href="/dashboard" style={{ color: "#5947ce", textDecoration: "none", fontWeight: 800 }}>A AmenityFlow</Link>
        <Link href="/dashboard" style={{ color: "#5947ce", textDecoration: "none" }}>← Dashboard</Link>
      </header>

      <div style={{ width: "min(1100px, 90%)", margin: "35px auto" }}>
        <p style={{ color: "#5947ce", fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>ORGANIZATION SETTINGS</p>
        <h1 style={{ margin: "8px 0" }}>Permissions Management</h1>
        <p style={{ color: "#788399", marginBottom: 25 }}>Configure the actions each role is allowed to perform.</p>

        {error && <p role="alert" style={{ background: "#fff0f0", color: "#b42332", padding: 13, borderRadius: 8 }}>{error}</p>}
        {message && <p role="status" style={{ background: "#eaf9f0", color: "#187849", padding: 13, borderRadius: 8 }}>{message}</p>}

        <section style={panel}>
          <label htmlFor="permission-role" style={{ display: "block", fontWeight: 700, marginBottom: 9 }}>Select role</label>
          <select id="permission-role" value={roleId} onChange={(event) => setRoleId(event.target.value)} style={{ width: "100%", maxWidth: 420, padding: 12, border: "1px solid #dce1eb", borderRadius: 8, background: "#fff" }}>
            {roles.length === 0 && <option value="">No roles available</option>}
            {roles.map((role) => <option key={role.id} value={String(role.id)}>{role.roleName}</option>)}
          </select>
          {roles.length === 0 && !loading && <p style={{ color: "#788399" }}>Create a role first in <Link href="/roles">Roles Management</Link>.</p>}
        </section>

        {loading ? <p>Loading permissions...</p> : roles.length > 0 && modules.map((item) => {
          const permission = getPermission(item.id);
          return (
            <section key={item.id} style={panel}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>{item.label}</h2>
                  <p style={{ margin: 0, color: "#788399", fontSize: 13 }}>{item.description}</p>
                </div>
                <button
                  onClick={() => void saveModule(item.id)}
                  disabled={saving === item.id}
                  style={{ padding: "10px 15px", border: 0, borderRadius: 8, background: "#5947ce", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                >
                  {saving === item.id ? "Saving..." : "Save permissions"}
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))", gap: 12, marginTop: 22 }}>
                {permissionKeys.map(({ key, label }) => (
                  <label key={key} style={{ display: "flex", alignItems: "center", gap: 9, padding: 13, border: "1px solid #e5e9f2", borderRadius: 9, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={permission[key]}
                      onChange={(event) => changePermission(item.id, key, event.target.checked)}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}

        <p><Link href="/roles" style={{ color: "#5947ce", fontWeight: 700, textDecoration: "none" }}>← Manage roles</Link></p>
      </div>
    </main>
  );
}
