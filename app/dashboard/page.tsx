
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import "./dashboard.css";

type Organization = {
  organization_id: string;
  organization_name: string;
  country: string | null;
  email: string;
  subscription_plan: string;
  subscription_status: string;
  trial_end_date: string | null;
};

const modules = [
  {
    title: "Employees",
    description: "Add, edit, and manage organization employees.",
    href: "/employees",
    icon: "👥",
    category: "PEOPLE MANAGEMENT",
  },
  {
    title: "Amenities",
    description: "Create, publish, and manage organization amenities.",
    href: "/amenities",
    icon: "🏢",
    category: "FACILITY MANAGEMENT",
  },
  {
    title: "Booking history",
    description: "Create bookings and manage their status.",
    href: "/bookings",
    icon: "📅",
    category: "RESERVATIONS",
  },
  {
    title: "Invoice history",
    description: "Create invoices and track payments.",
    href: "/invoices",
    icon: "🧾",
    category: "FINANCE & BILLING",
  },
  {
    title: "Roles",
    description: "Create, edit, and manage organization roles.",
    href: "/roles",
    icon: "🛡️",
    category: "ACCESS MANAGEMENT",
  },
  {
    title: "Permissions",
    description: "Configure permissions for each management module.",
    href: "/permissions",
    icon: "🔐",
    category: "ACCESS MANAGEMENT",
  },
];

export default function DashboardPage() {
  const router = useRouter();

  const [organization, setOrganization] =
    useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadOrganization() {
      try {
        const response = await fetch("/api/me", {
          cache: "no-store",
        });

        const data = await response.json();

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          if (active) {
            setError(
              data.message ||
                data.error ||
                "Unable to load dashboard."
            );
          }
          return;
        }

        if (active) {
          setOrganization(data.organization);
        }
      } catch {
        if (active) {
          setError("Unable to connect to the server.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadOrganization();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    setError("");
    setLoggingOut(true);

    try {
      const response = await fetch("/api/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setError("Logout failed. Please try again.");
        setLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
      setLoggingOut(false);
    }
  }

  async function copyOrganizationId() {
    if (!organization) return;

    try {
      await navigator.clipboard.writeText(
        organization.organization_id
      );
      setCopied(true);
      setError("");

      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy organization ID.");
    }
  }

  if (loading) {
    return (
      <main className="dashboard-loading">
        <div className="dashboard-loading-content">
          <span className="dashboard-logo">A</span>
          <p>Loading your workspace...</p>
        </div>
      </main>
    );
  }

  if (!organization) {
    return (
      <main className="dashboard-loading">
        <div className="dashboard-loading-content">
          <span className="dashboard-logo">A</span>
          <p>{error || "Redirecting to sign in..."}</p>
          {error && (
            <button
              className="logout-button"
              onClick={() => router.refresh()}
            >
              Try again
            </button>
          )}
        </div>
      </main>
    );
  }

  const plan = organization.subscription_plan || "free";
  const subscriptionStatus =
    organization.subscription_status || "unknown";

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link
          href="/dashboard"
          className="dashboard-brand"
          aria-label="AmenityFlow dashboard"
        >
          <span className="dashboard-logo">A</span>

          <span className="dashboard-brand-text">
            <strong>AmenityFlow</strong>
            <small>Organization Management</small>
          </span>
        </Link>

        <div className="dashboard-header-actions">
          <span className="dashboard-account-label">
            {organization.organization_name}
          </span>

          <button
            onClick={handleLogout}
            className="logout-button"
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <section className="dashboard-content">
        <div className="dashboard-welcome">
          <div>
            <p className="dashboard-eyebrow">
              ORGANIZATION OVERVIEW
            </p>

            <h1>
              Welcome, {organization.organization_name}!
            </h1>

            <p className="dashboard-subtitle">
              Your workspace is ready. Manage your people,
              facilities, bookings, billing, and access from
              one place.
            </p>
          </div>

          <div className="dashboard-welcome-mark" aria-hidden="true">
            <span>✦</span>
          </div>
        </div>

        {error && (
          <div className="dashboard-error" role="alert">
            <span>{error}</span>
            <button
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        <section className="dashboard-overview-grid">
          <article className="dashboard-card organization-summary-card">
            <div className="dashboard-card-heading">
              <span className="dashboard-card-icon organization-icon">
                <span>⌂</span>
              </span>
              <span className="dashboard-card-label">
                ORGANIZATION
              </span>
            </div>

            <h2>{organization.organization_name}</h2>

            <p>
              <span className="dashboard-online-dot" />
              {organization.country || "Country not provided"}
            </p>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <span className="dashboard-card-icon plan-icon">
                <span>✧</span>
              </span>
              <span className="dashboard-card-label">
                SUBSCRIPTION PLAN
              </span>
            </div>

            <h2 className="dashboard-capitalize">{plan}</h2>

            <p>
              Status:
              <span className="dashboard-status-badge">
                {subscriptionStatus}
              </span>
            </p>
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <span className="dashboard-card-icon trial-icon">
                <span>◷</span>
              </span>
              <span className="dashboard-card-label">
                SUBSCRIPTION DETAILS
              </span>
            </div>

            <h2>
              {organization.trial_end_date
                ? new Date(
                    organization.trial_end_date
                  ).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })
                : "Not set"}
            </h2>

            <p>Trial end date</p>
          </article>
        </section>

        <section className="dashboard-modules">
          <div className="dashboard-section-heading">
            <div>
              <p className="dashboard-eyebrow">
                YOUR WORKSPACE
              </p>

              <h2>Management modules</h2>

              <p>
                Everything you need to run your organization,
                organized in one workspace.
              </p>
            </div>

            <span className="dashboard-module-count">
              {modules.length} modules
            </span>
          </div>

          <div className="module-grid">
            {modules.map((module) => (
              <Link
                key={module.href}
                href={module.href}
                className="module-card"
              >
                <div className="module-card-top">
                  <span
                    className="module-card-icon"
                    aria-hidden="true"
                  >
                    {module.icon}
                  </span>

                  <span className="module-card-arrow">
                    ↗
                  </span>
                </div>

                <span className="module-card-category">
                  {module.category}
                </span>

                <h3>{module.title}</h3>

                <p>{module.description}</p>

                <span className="module-card-link">
                  Open module <span>→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="organization-id-card">
          <div className="organization-id-info">
            <span className="organization-id-icon">⌘</span>

            <div>
              <strong>Organization ID</strong>
              <p>
                Your unique organization identifier for
                reference and support.
              </p>
              <code>{organization.organization_id}</code>
            </div>
          </div>

          <button
            onClick={copyOrganizationId}
            className="copy-organization-button"
          >
            {copied ? "✓ Copied!" : "Copy organization ID"}
          </button>
        </section>

        <footer className="dashboard-footer">
          <span>© AmenityFlow · Organization Management</span>
          <span>One workspace. Everything organized.</span>
        </footer>
      </section>
    </main>
  );
}
