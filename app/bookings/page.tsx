
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Employee = {
  id: number;
  fullName: string;
};

type Amenity = {
  id: number;
  name: string;
  capacity: number;
};

type Booking = {
  id: number;
  amenityId: number;
  employeeId: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: string;
  amenityName: string;
  employeeName: string;
};

type BookingForm = {
  amenityId: string;
  employeeId: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
};

function todayLocal(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const initialForm: BookingForm = {
  amenityId: "",
  employeeId: "",
  bookingDate: "",
  startTime: "10:00",
  endTime: "11:00",
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [form, setForm] = useState<BookingForm>(initialForm);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Calculate the local date after the component mounts.
  // This avoids calling new Date() during prerendering.
  useEffect(() => {
    const currentDate = todayLocal();

    setToday(currentDate);
    setForm((previous) => ({
      ...previous,
      bookingDate: previous.bookingDate || currentDate,
    }));
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError("");

      const response = await fetch("/api/bookings");
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to load booking data.");
      }

      setBookings(data.bookings || []);
      setEmployees(data.employees || []);
      setAmenities(data.amenities || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load booking data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function createBooking(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.bookingDate || !form.employeeId || !form.amenityId) {
      setError("Please complete all required booking fields.");
      return;
    }

    if (form.startTime >= form.endTime) {
      setError("End time must be later than start time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amenityId: Number(form.amenityId),
          employeeId: Number(form.employeeId),
        }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to create booking.");
      }

      setMessage("Booking created successfully!");

      setForm({
        ...initialForm,
        bookingDate: today,
      });

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create booking."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to update booking.");
      }

      setMessage(data.message || "Booking status updated.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update booking."
      );
    }
  }

  async function deleteBooking(id: number) {
    if (!window.confirm("Are you sure you want to delete this booking?")) {
      return;
    }

    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/bookings?id=${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete booking.");
      }

      setMessage("Booking deleted successfully.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete booking."
      );
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    background: "#fff",
    color: "#111827",
    fontSize: 14,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
  };

  const buttonStyle: React.CSSProperties = {
    padding: "9px 12px",
    border: "none",
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  const statusStyle = (status: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "5px 9px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    background:
      status === "approved"
        ? "#dcfce7"
        : status === "cancelled"
          ? "#fee2e2"
          : status === "completed"
            ? "#dbeafe"
            : "#fef3c7",
    color:
      status === "approved"
        ? "#166534"
        : status === "cancelled"
          ? "#991b1b"
          : status === "completed"
            ? "#1d4ed8"
            : "#92400e",
  });

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
            Booking Management
          </h1>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Schedule amenities for employees and track booking status.
          </p>
        </header>

        {(message || error) && (
          <div
            role="status"
            style={{
              marginBottom: 20,
              padding: 13,
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
            Create a booking
          </h2>

          {employees.length === 0 && (
            <p style={{ color: "#92400e" }}>
              Add an active employee before creating a booking.
            </p>
          )}

          {amenities.length === 0 && (
            <p style={{ color: "#92400e" }}>
              Publish an amenity first. Only published amenities can be booked.
            </p>
          )}

          <form onSubmit={createBooking}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 18,
              }}
            >
              <div>
                <label style={labelStyle} htmlFor="employeeId">
                  Employee *
                </label>
                <select
                  id="employeeId"
                  style={inputStyle}
                  required
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm({ ...form, employeeId: e.target.value })
                  }
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="amenityId">
                  Published amenity *
                </label>
                <select
                  id="amenityId"
                  style={inputStyle}
                  required
                  value={form.amenityId}
                  onChange={(e) =>
                    setForm({ ...form, amenityId: e.target.value })
                  }
                >
                  <option value="">Select amenity</option>
                  {amenities.map((amenity) => (
                    <option key={amenity.id} value={amenity.id}>
                      {amenity.name} (capacity: {amenity.capacity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="bookingDate">
                  Booking date *
                </label>
                <input
                  id="bookingDate"
                  type="date"
                  min={today || undefined}
                  required
                  style={inputStyle}
                  value={form.bookingDate}
                  onChange={(e) =>
                    setForm({ ...form, bookingDate: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="startTime">
                  Start time *
                </label>
                <input
                  id="startTime"
                  type="time"
                  required
                  style={inputStyle}
                  value={form.startTime}
                  onChange={(e) =>
                    setForm({ ...form, startTime: e.target.value })
                  }
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="endTime">
                  End time *
                </label>
                <input
                  id="endTime"
                  type="time"
                  required
                  style={inputStyle}
                  value={form.endTime}
                  onChange={(e) =>
                    setForm({ ...form, endTime: e.target.value })
                  }
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={
                saving ||
                !today ||
                employees.length === 0 ||
                amenities.length === 0
              }
              style={{
                ...buttonStyle,
                marginTop: 20,
                background: "#2563eb",
                color: "#fff",
                opacity:
                  saving ||
                  !today ||
                  employees.length === 0 ||
                  amenities.length === 0
                    ? 0.6
                    : 1,
              }}
            >
              {saving ? "Creating..." : "Create booking"}
            </button>
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
            Booking history ({bookings.length})
          </h2>

          {loading ? (
            <p>Loading bookings...</p>
          ) : bookings.length === 0 ? (
            <p style={{ color: "#6b7280" }}>
              No bookings yet. Create your first booking above.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: 850,
                  borderCollapse: "collapse",
                  fontSize: 14,
                }}
              >
                <thead>
                  <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                    {[
                      "Employee",
                      "Amenity",
                      "Date",
                      "Time",
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
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        {booking.employeeName}
                      </td>

                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        {booking.amenityName}
                      </td>

                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        {booking.bookingDate}
                      </td>

                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        {booking.startTime} – {booking.endTime}
                      </td>

                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        <span style={statusStyle(booking.status)}>
                          {booking.status}
                        </span>
                      </td>

                      <td style={{ padding: 13, borderBottom: "1px solid #e5e7eb" }}>
                        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                          {booking.status === "pending" && (
                            <button
                              type="button"
                              onClick={() =>
                                void updateStatus(booking.id, "approved")
                              }
                              style={{
                                ...buttonStyle,
                                background: "#dcfce7",
                                color: "#166534",
                              }}
                            >
                              Approve
                            </button>
                          )}

                          {booking.status !== "cancelled" &&
                            booking.status !== "completed" && (
                              <button
                                type="button"
                                onClick={() =>
                                  void updateStatus(booking.id, "cancelled")
                                }
                                style={{
                                  ...buttonStyle,
                                  background: "#fef3c7",
                                  color: "#92400e",
                                }}
                              >
                                Cancel
                              </button>
                            )}

                          {booking.status === "approved" && (
                            <button
                              type="button"
                              onClick={() =>
                                void updateStatus(booking.id, "completed")
                              }
                              style={{
                                ...buttonStyle,
                                background: "#dbeafe",
                                color: "#1d4ed8",
                              }}
                            >
                              Complete
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void deleteBooking(booking.id)}
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
