
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import "./invoices.css";

type InvoiceStatus = "pending" | "paid" | "overdue" | "cancelled";

type Invoice = {
  id: number | string;
  invoiceNumber: string;
  amount: number | string;
  status: InvoiceStatus;
  invoiceDate: string;
};

const currency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);

const formatDate = (date: string) => {
  if (!date) return "—";

  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amount, setAmount] = useState("");
  // Set the current date after the browser mounts to avoid prerender errors.
  const [invoiceDate, setInvoiceDate] = useState("");
  const [status, setStatus] = useState<InvoiceStatus>("pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const today = new Date();

    const localDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    setInvoiceDate(localDate);
  }, []);

  const loadInvoices = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/invoices");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to load invoices.");
      }

      setInvoices(data.invoices ?? []);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load invoices."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  async function createInvoice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (
      !invoiceNumber.trim() ||
      !amount ||
      !Number.isFinite(Number(amount)) ||
      Number(amount) <= 0 ||
      !invoiceDate
    ) {
      setError("Enter an invoice number, valid amount, and invoice date.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          amount: Number(amount),
          invoiceDate,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create invoice.");
      }

      setInvoices((current) => [data.invoice, ...current]);
      setInvoiceNumber("");
      setAmount("");
      setStatus("pending");
      setNotice("Invoice created successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invoice."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    id: Invoice["id"],
    nextStatus: InvoiceStatus
  ) {
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update invoice.");
      }

      setInvoices((current) =>
        current.map((invoice) =>
          String(invoice.id) === String(id)
            ? { ...invoice, status: nextStatus }
            : invoice
        )
      );

      setNotice("Invoice status updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update invoice."
      );
      await loadInvoices();
    }
  }

  async function deleteInvoice(id: Invoice["id"]) {
    if (!window.confirm("Are you sure you want to delete this invoice?")) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/invoices?id=${encodeURIComponent(String(id))}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete invoice.");
      }

      setInvoices((current) =>
        current.filter((invoice) => String(invoice.id) !== String(id))
      );

      setNotice("Invoice deleted successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete invoice."
      );
    }
  }

  const totalAmount = invoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount || 0),
    0
  );

  const paidAmount = invoices
    .filter((invoice) => invoice.status === "paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const pendingAmount = invoices
    .filter((invoice) => invoice.status === "pending")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  return (
    <main className="invoice-page">
      <header className="invoice-topbar">
        <Link href="/dashboard" className="invoice-brand">
          <span className="invoice-brand-icon">A</span>
          <span>
            <strong>AmenityFlow</strong>
            <small>Organization Management</small>
          </span>
        </Link>

        <Link href="/dashboard" className="back-dashboard">
          ← Back to dashboard
        </Link>
      </header>

      <div className="invoice-content">
        <section className="invoice-heading">
          <div>
            <span className="eyebrow">FINANCE &amp; BILLING</span>
            <h1>Invoice Management</h1>
            <p>
              Create invoices, monitor payments, and manage billing records.
            </p>
          </div>

          <div className="invoice-heading-icon" aria-hidden="true">
            ₹
          </div>
        </section>

        <section className="invoice-stats">
          <article className="invoice-stat">
            <div className="stat-top">
              <span>Total invoices</span>
              <span className="stat-icon purple">▤</span>
            </div>
            <strong>{invoices.length}</strong>
            <small>All billing records</small>
          </article>

          <article className="invoice-stat">
            <div className="stat-top">
              <span>Total invoice value</span>
              <span className="stat-icon blue">₹</span>
            </div>
            <strong>{currency(totalAmount)}</strong>
            <small>Across all invoices</small>
          </article>

          <article className="invoice-stat">
            <div className="stat-top">
              <span>Amount paid</span>
              <span className="stat-icon green">✓</span>
            </div>
            <strong>{currency(paidAmount)}</strong>
            <small>Invoices marked paid</small>
          </article>

          <article className="invoice-stat">
            <div className="stat-top">
              <span>Pending amount</span>
              <span className="stat-icon orange">◷</span>
            </div>
            <strong>{currency(pendingAmount)}</strong>
            <small>Awaiting payment</small>
          </article>
        </section>

        {error && (
          <div className="invoice-alert error-alert" role="alert">
            <span>!</span>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div className="invoice-alert success-alert" role="status">
            <span>✓</span>
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section className="invoice-create-card">
          <div className="section-heading">
            <div className="section-icon">＋</div>
            <div>
              <h2>Create an invoice</h2>
              <p>Add a new billing record to your organization.</p>
            </div>
          </div>

          <form className="invoice-form" onSubmit={createInvoice}>
            <label>
              Invoice number
              <input
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="e.g. INV-002"
                maxLength={100}
                required
              />
            </label>

            <label>
              Amount (₹)
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="e.g. 5000"
                required
              />
            </label>

            <label>
              Invoice date
              <input
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                required
              />
            </label>

            <label>
              Initial status
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as InvoiceStatus)
                }
              >
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <div className="invoice-form-actions">
              <button
                type="submit"
                className="create-invoice-button"
                disabled={saving || !invoiceDate}
              >
                {saving ? "Creating..." : "＋ Create invoice"}
              </button>
            </div>
          </form>
        </section>

        <section className="invoice-history-card">
          <div className="history-heading">
            <div>
              <h2>Invoice history</h2>
              <p>Review invoices and update their payment status.</p>
            </div>
            <span className="invoice-count">{invoices.length} records</span>
          </div>

          {loading ? (
            <div className="invoice-empty">
              <div className="invoice-spinner" />
              <p>Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="invoice-empty">
              <div className="empty-invoice-icon">▤</div>
              <h3>No invoices yet</h3>
              <p>Create your first invoice using the form above.</p>
            </div>
          ) : (
            <div className="invoice-table-wrap">
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>INVOICE</th>
                    <th>AMOUNT</th>
                    <th>INVOICE DATE</th>
                    <th>STATUS</th>
                    <th className="actions-heading">ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <div className="invoice-number-cell">
                          <span className="invoice-row-icon">▤</span>
                          <span>
                            <strong>{invoice.invoiceNumber}</strong>
                            <small>Billing record</small>
                          </span>
                        </div>
                      </td>
                      <td className="invoice-amount">
                        {currency(Number(invoice.amount))}
                      </td>
                      <td>{formatDate(invoice.invoiceDate)}</td>
                      <td>
                        <span className={`status-badge status-${invoice.status}`}>
                          <span className="status-dot" />
                          {invoice.status.charAt(0).toUpperCase() +
                            invoice.status.slice(1)}
                        </span>
                      </td>
                      <td>
                        <div className="invoice-row-actions">
                          <select
                            aria-label={`Update status for ${invoice.invoiceNumber}`}
                            className="status-select"
                            value={invoice.status}
                            onChange={(event) =>
                              void updateStatus(
                                invoice.id,
                                event.target.value as InvoiceStatus
                              )
                            }
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="cancelled">Cancelled</option>
                          </select>

                          <button
                            type="button"
                            className="delete-invoice-button"
                            onClick={() => void deleteInvoice(invoice.id)}
                            aria-label={`Delete ${invoice.invoiceNumber}`}
                            title="Delete invoice"
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

        <footer className="invoice-footer">
          <span>AmenityFlow · Finance &amp; Billing</span>
          <Link href="/dashboard">Return to dashboard →</Link>
        </footer>
      </div>
    </main>
  );
}
