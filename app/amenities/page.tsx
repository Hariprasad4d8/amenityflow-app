
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Amenity = {
  id: number;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number;
  availableFrom: string;
  availableUntil: string;
  isPublished: boolean;
};

const emptyForm = {
  name: "",
  description: "",
  location: "",
  capacity: "1",
  availableFrom: "10:00",
  availableUntil: "18:00",
};

export default function AmenitiesPage() {
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAmenities = useCallback(async () => {
    try {
      const response = await fetch("/api/amenities");
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to load amenities.");
      }

      setAmenities(data.amenities || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load amenities."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAmenities();
  }, [loadAmenities]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const response = await fetch("/api/amenities", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          ...form,
          capacity: Number(form.capacity),
        }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to save amenity.");
      }

      setMessage(
        editingId ? "Amenity updated successfully!" : "Amenity added successfully!"
      );
      resetForm();
      await loadAmenities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save amenity.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(amenity: Amenity) {
    setEditingId(amenity.id);
    setForm({
      name: amenity.name,
      description: amenity.description || "",
      location: amenity.location || "",
      capacity: String(amenity.capacity),
      availableFrom: amenity.availableFrom,
      availableUntil: amenity.availableUntil,
    });
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function togglePublish(amenity: Amenity) {
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/amenities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: amenity.id,
          isPublished: !amenity.isPublished,
        }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to change publish status.");
      }

      setMessage(
        amenity.isPublished
          ? "Amenity unpublished successfully."
          : "Amenity published successfully."
      );
      await loadAmenities();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change publish status."
      );
    }
  }

  async function deleteAmenity(id: number) {
    if (!window.confirm("Are you sure you want to delete this amenity?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/amenities?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Unable to delete amenity.");
      }

      if (editingId === id) resetForm();

      setMessage("Amenity deleted successfully.");
      await loadAmenities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete amenity.");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    boxSizing: "border-box",
    fontSize: 14,
    background: "#fff",
    color: "#111827",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
    color: "#374151",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "10px 15px",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "30px 20px",
        background: "#f3f6fb",
        color: "#111827",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1150, margin: "0 auto" }}>
        <Link
          href="/dashboard"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          ← Back to dashboard
        </Link>

        <header style={{ margin: "25px 0" }}>
          <h1 style={{ fontSize: 30, margin: "0 0 8px" }}>
            Amenity Management
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Create and manage your organization's facilities and amenities.
          </p>
        </header>

        {(message || error) && (
          <div
            role="status"
            style={{
              padding: 13,
              marginBottom: 20,
              borderRadius: 8,
              background: error ? "#fee2e2" : "#dcfce7",
              color: error ? "#991b1b" : "#166534",
            }}
          >
            {error || message}
          </div>
        )}

        <section
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            marginBottom: 28,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            {editingId ? "Edit amenity" : "Add amenity"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              <div>
                <label style={labelStyle} htmlFor="name">
                  Amenity name *
                </label>
                <input
                  id="name"
                  style={inputStyle}
                  placeholder="e.g. Conference Room"
                  maxLength={150}
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  style={inputStyle}
                  placeholder="e.g. First floor"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="capacity">
                  Capacity *
                </label>
                <input
                  id="capacity"
                  style={inputStyle}
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="availableFrom">
                  Available from *
                </label>
                <input
                  id="availableFrom"
                  style={inputStyle}
                  type="time"
                  required
                  value={form.availableFrom}
                  onChange={(e) =>
                    setForm({ ...form, availableFrom: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="availableUntil">
                  Available until *
                </label>
                <input
                  id="availableUntil"
                  style={inputStyle}
                  type="time"
                  required
                  value={form.availableUntil}
                  onChange={(e) =>
                    setForm({ ...form, availableUntil: e.target.value })
                  }
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle} htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
                  placeholder="Describe this amenity..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...buttonStyle,
                  background: "#2563eb",
                  color: "#fff",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update amenity"
                    : "Add amenity"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    ...buttonStyle,
                    background: "#e5e7eb",
                    color: "#111827",
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section
          style={{
            background: "#fff",
            padding: 24,
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            Amenities ({amenities.length})
          </h2>

          {loading ? (
            <p>Loading amenities...</p>
          ) : amenities.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No amenities found. Add your first amenity above.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 14,
                  minWidth: 850,
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                    {[
                      "Name",
                      "Location",
                      "Capacity",
                      "Available hours",
                      "Status",
                      "Actions",
                    ].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {amenities.map((amenity) => (
                    <tr key={amenity.id}>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <strong>{amenity.name}</strong>
                        {amenity.description && (
                          <div
                            style={{
                              marginTop: 5,
                              color: "#6b7280",
                              maxWidth: 230,
                            }}
                          >
                            {amenity.description}
                          </div>
                        )}
                      </td>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {amenity.location || "—"}
                      </td>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {amenity.capacity}
                      </td>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {amenity.availableFrom} – {amenity.availableUntil}
                      </td>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        <span
                          style={{
                            padding: "5px 9px",
                            borderRadius: 20,
                            fontSize: 12,
                            fontWeight: 600,
                            background: amenity.isPublished
                              ? "#dcfce7"
                              : "#fef3c7",
                            color: amenity.isPublished
                              ? "#166534"
                              : "#92400e",
                          }}
                        >
                          {amenity.isPublished ? "Published" : "Draft"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: 13,
                          borderBottom: "1px solid #e5e7eb",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <div style={{ display: "flex", gap: 7 }}>
                          <button
                            type="button"
                            onClick={() => startEdit(amenity)}
                            style={{
                              ...buttonStyle,
                              background: "#dbeafe",
                              color: "#1d4ed8",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void togglePublish(amenity)}
                            style={{
                              ...buttonStyle,
                              background: "#f3f4f6",
                              color: "#374151",
                            }}
                          >
                            {amenity.isPublished ? "Unpublish" : "Publish"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteAmenity(amenity.id)}
                            style={{
                              ...buttonStyle,
                              background: "#fee2e2",
                              color: "#b91c1c",
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
