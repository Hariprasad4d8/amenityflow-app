
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Employee = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  status: string;
};

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await fetch("/api/employees", {
        cache: "no-store",
      });
      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to load employees.");
        return;
      }

      setEmployees(data.employees);
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  function changeField(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/employees", {
        method: editingId === null ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: editingId,
          status: "active",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to save employee.");
        return;
      }

      setMessage(data.message);
      setForm(emptyForm);
      setEditingId(null);
      await loadEmployees();
    } catch {
      setMessage("Could not connect to the server.");
    } finally {
      setSaving(false);
    }
  }

  function editEmployee(employee: Employee) {
    setEditingId(employee.id);
    setForm({
      full_name: employee.full_name,
      email: employee.email,
      phone: employee.phone || "",
      job_title: employee.job_title || "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteEmployee(employee: Employee) {
    if (!window.confirm(`Delete ${employee.full_name}?`)) return;

    setMessage("");

    try {
      const response = await fetch(
        `/api/employees?id=${employee.id}`,
        { method: "DELETE" }
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        setMessage(data.message || "Unable to delete employee.");
        return;
      }

      setMessage(data.message);
      await loadEmployees();
    } catch {
      setMessage("Could not connect to the server.");
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      background: "#f4f7fb",
      padding: "32px 16px",
      color: "#172033",
      fontFamily: "Arial, sans-serif",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <Link href="/dashboard" style={{ color: "#4257d6" }}>
          ← Back to dashboard
        </Link>

        <h1 style={{ marginBottom: 8 }}>Employee Management</h1>
        <p style={{ color: "#64748b" }}>
          Add and manage your organization&apos;s employees.
        </p>

        <section style={{
          background: "#fff",
          padding: 24,
          borderRadius: 14,
          margin: "24px 0",
          boxShadow: "0 4px 20px #1720330d",
        }}>
          <h2>{editingId === null ? "Add employee" : "Edit employee"}</h2>

          <form
            onSubmit={submitForm}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            {([
              ["full_name", "Full name", "Enter employee name"],
              ["email", "Email", "employee@company.com"],
              ["phone", "Phone", "Phone number"],
              ["job_title", "Job title", "e.g. Manager"],
            ] as const).map(([name, label, placeholder]) => (
              <label key={name} style={{
                display: "flex",
                flexDirection: "column",
                gap: 7,
                fontSize: 14,
                fontWeight: 600,
              }}>
                {label}
                <input
                  name={name}
                  type={name === "email" ? "email" : "text"}
                  placeholder={placeholder}
                  value={form[name]}
                  onChange={changeField}
                  required={name === "full_name" || name === "email"}
                  maxLength={
                    name === "full_name" ? 150 :
                    name === "email" ? 255 :
                    name === "phone" ? 30 : 100
                  }
                  style={{
                    padding: 12,
                    border: "1px solid #d7deea",
                    borderRadius: 8,
                    fontSize: 14,
                    width: "100%",
                    boxSizing: "border-box",
                  }}
                />
              </label>
            ))}

            <div style={{
              display: "flex",
              alignItems: "end",
              gap: 10,
            }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: "12px 18px",
                  border: 0,
                  borderRadius: 8,
                  background: "#4257d6",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." :
                  editingId === null ? "Add employee" : "Save changes"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "1px solid #d7deea",
                    background: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {message && (
            <p role="status" style={{ marginTop: 16, color: "#334155" }}>
              {message}
            </p>
          )}
        </section>

        <section style={{
          background: "#fff",
          padding: 24,
          borderRadius: 14,
          boxShadow: "0 4px 20px #1720330d",
          overflowX: "auto",
        }}>
          <h2>Employees ({employees.length})</h2>

          {loading ? (
            <p>Loading employees...</p>
          ) : employees.length === 0 ? (
            <p>No employees yet. Use the form above to add your first employee.</p>
          ) : (
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              minWidth: 650,
            }}>
              <thead>
                <tr>
                  {["Name", "Email", "Phone", "Job title", "Status", "Actions"].map(
                    (heading) => (
                      <th key={heading} style={{
                        padding: 12,
                        borderBottom: "1px solid #e2e8f0",
                        color: "#64748b",
                        fontSize: 13,
                      }}>
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    {[
                      employee.full_name,
                      employee.email,
                      employee.phone || "—",
                      employee.job_title || "—",
                      employee.status,
                    ].map((value, index) => (
                      <td key={index} style={{
                        padding: 12,
                        borderBottom: "1px solid #eef2f7",
                      }}>
                        {value}
                      </td>
                    ))}
                    <td style={{
                      padding: 12,
                      borderBottom: "1px solid #eef2f7",
                      whiteSpace: "nowrap",
                    }}>
                      <button
                        type="button"
                        onClick={() => editEmployee(employee)}
                        style={{
                          marginRight: 8,
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: "1px solid #d7deea",
                          background: "white",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEmployee(employee)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 6,
                          border: "1px solid #fecaca",
                          background: "#fff1f2",
                          color: "#be123c",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
