
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./login.css";

export default function LoginPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    organizationId: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((previousForm) => ({
      ...previousForm,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setLoading(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationId: form.organizationId.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setIsError(true);
        setMessage(data.message || "Unable to sign in.");
        return;
      }

      setMessage("Login successful! Redirecting to dashboard...");

      // Navigate to the dashboard after successful login.
      window.location.href = "/dashboard";
    } catch (error) {
      console.error("Login request failed:", error);
      setIsError(true);
      setMessage("Unable to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <Link href="/" className="login-brand">
          <span className="login-brand-icon">A</span>
          <span>
            <strong>AmenityFlow</strong>
            <small>Organization Management</small>
          </span>
        </Link>

        <div className="login-heading">
          <span className="login-eyebrow">WELCOME BACK</span>
          <h1>Sign in to your account</h1>
          <p>Enter your organization details to continue.</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="organizationId">Organization ID</label>
            <input
              id="organizationId"
              name="organizationId"
              type="text"
              placeholder="Enter your organization ID"
              value={form.organizationId}
              onChange={handleChange}
              autoComplete="off"
              maxLength={50}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              maxLength={255}
              required
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>
        </form>

        {message && (
          <div
            className={`login-message ${
              isError ? "login-error" : ""
            }`}
            role={isError ? "alert" : "status"}
          >
            {message}
          </div>
        )}

        <p className="register-link">
          New to AmenityFlow? <Link href="/">Create an organization</Link>
        </p>

        <footer>© 2026 AmenityFlow. All rights reserved.</footer>
      </section>
    </main>
  );
}