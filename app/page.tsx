
"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import "./page.css";

type Organization = {
  organization_id: string;
  organization_name: string;
  country: string;
  email: string;
};

type RegistrationForm = {
  organizationId: string;
  organizationName: string;
  country: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const initialForm: RegistrationForm = {
  organizationId: "",
  organizationName: "",
  country: "",
  email: "",
  password: "",
  confirmPassword: "",
};

export default function Home() {
  const [form, setForm] = useState<RegistrationForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [organization, setOrganization] =
    useState<Organization | null>(null);
  const [copied, setCopied] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    // Clear the old password error when either password changes.
    if (name === "password" || name === "confirmPassword") {
      setMessage("");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setOrganization(null);
    setCopied(false);

    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage(
        "Passwords do not match. Please re-enter both passwords."
      );
      return;
    }

    if (!/^[A-Za-z0-9]{1,50}$/.test(form.organizationId.trim())) {
      setMessage("Organization ID must contain only letters and numbers.");
      return;
    }

    if (!form.organizationName.trim()) {
      setMessage("Please enter your organization name.");
      return;
    }

    if (!form.country) {
      setMessage("Please select your country.");
      return;
    }

    if (!form.email.trim()) {
      setMessage("Please enter your work email.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: form.organizationId.trim(),
          organizationName: form.organizationName.trim(),
          country: form.country,
          email: form.email.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Registration failed.");
        return;
      }

      if (!data.organization?.organization_id) {
        setMessage(
          "Registration succeeded, but the organization ID was not returned. Please check the registration API."
        );
        return;
      }

      setOrganization(data.organization);
      setMessage(
        data.message || "Organization registered successfully!"
      );
      setForm({ ...initialForm });
    } catch {
      setMessage(
        "Unable to connect to the server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyOrganizationId() {
    if (!organization?.organization_id) return;

    try {
      await navigator.clipboard.writeText(
        organization.organization_id
      );
      setCopied(true);
      setMessage("Organization ID copied successfully!");

      window.setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch {
      setMessage(
        "Automatic copying is unavailable. Select the organization ID and copy it manually."
      );
    }
  }

  return (
    <main className="register-page">
      <section className="register-card">
        <div className="brand">
          <div className="brand-icon">A</div>
          <div>
            <h1>AmenityFlow</h1>
            <p>Organization Management Platform</p>
          </div>
        </div>

        <div className="form-heading">
          <span className="eyebrow">GET STARTED</span>
          <h2>Create your organization</h2>
          <p>
            Register your organization to start your free 30-day trial.
          </p>
        </div>

        {!organization && (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="organizationId">Organization ID</label>
              <input
                id="organizationId"
                name="organizationId"
                type="text"
                placeholder="e.g. Acme123"
                value={form.organizationId}
                onChange={handleChange}
                maxLength={50}
                pattern="[A-Za-z0-9]+"
                title="Use letters and numbers only; this will be your organization database name."
                autoCapitalize="off"
                autoCorrect="off"
                required
              />
              <small>
                Letters and numbers only. This ID will be your organization
                database name.
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="organizationName">Organization name</label>
              <input
                id="organizationName"
                name="organizationName"
                type="text"
                placeholder="Enter organization name"
                value={form.organizationName}
                onChange={handleChange}
                maxLength={150}
                autoComplete="organization"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="country">Country</label>
              <select
                id="country"
                name="country"
                value={form.country}
                onChange={handleChange}
                required
              >
                <option value="">Select your country</option>
                <option value="India">India</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
                <option value="United Arab Emirates">
                  United Arab Emirates
                </option>
                <option value="Singapore">Singapore</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Japan">Japan</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="email">Work email</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                maxLength={255}
                autoComplete="email"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
            </div>

            <div className="trial-note">
              <span className="trial-icon">✓</span>
              <div>
                <strong>30-day free trial</strong>
                <p>Start free. No payment details required.</p>
              </div>
            </div>

            <button type="submit" disabled={loading}>
              {loading ? "Creating organization..." : "Create organization"}
              {!loading && <span aria-hidden="true"> →</span>}
            </button>
          </form>
        )}

        {message && (
          <div
            className={`message ${
              organization ? "success-message" : "error-message"
            }`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        )}

        {organization && (
          <div className="organization-result">
            <h3>Organization details</h3>

            <p>
              <strong>Name:</strong> {organization.organization_name}
            </p>
            <p>
              <strong>Country:</strong> {organization.country}
            </p>
            <p>
              <strong>Email:</strong> {organization.email}
            </p>

            <p>
              <strong>Organization ID:</strong>
            </p>

            <code className="organization-id">
              {organization.organization_id}
            </code>

            <button
              type="button"
              className="copy-button"
              onClick={handleCopyOrganizationId}
            >
              {copied ? "✓ ID Copied!" : "Copy organization ID"}
            </button>

            <p className="save-id">
              Save this ID. You may need it when signing in.
            </p>

            <p className="login-note">
              Ready to continue?{" "}
              <Link href="/login" className="login-link">
                Sign in here →
              </Link>
            </p>
          </div>
        )}

        {!organization && (
          <p className="login-note">
            Already registered?{" "}
            <Link href="/login" className="login-link">
              Sign in here →
            </Link>
          </p>
        )}

        <footer>© 2026 AmenityFlow. All rights reserved.</footer>
      </section>
    </main>
  );
}
