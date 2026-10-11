
import { NextResponse } from "next/server";
import { Client } from "pg";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

const ORG_ID_PATTERN = /^[A-Za-z0-9]{1,50}$/;

function getDirectConnectionString(database: string): string {
  const configuredUrl = process.env.DATABASE_URL;

  if (!configuredUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const url = new URL(configuredUrl);

  if (url.hostname.includes("-pooler")) {
    throw new Error(
      "DATABASE_URL must use Neon's direct connection for database provisioning."
    );
  }

  url.pathname = `/${database}`;
  return url.toString();
}

async function createOrganizationDatabase(
  organizationId: string,
  ownerEmail: string,
  ownerName: string
): Promise<void> {
  const admin = new Client({
    connectionString: getDirectConnectionString("master_db"),
  });

  await admin.connect();

  try {
    await admin.query(`CREATE DATABASE "${organizationId}"`);
  } finally {
    await admin.end();
  }

  const organizationDb = new Client({
    connectionString: getDirectConnectionString(organizationId),
  });

  let connected = false;

  try {
    await organizationDb.connect();
    connected = true;

    // 1. Create all six tenant tables.
    await organizationDb.query(`
      CREATE TABLE employee (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(150) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(30),
        job_title VARCHAR(100),
        role_id BIGINT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE amenities (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        description TEXT,
        location VARCHAR(255),
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        available_from TIME NOT NULL,
        available_until TIME NOT NULL,
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (available_from < available_until)
      );

      CREATE TABLE booking_history (
        id BIGSERIAL PRIMARY KEY,
        amenity_id BIGINT
          REFERENCES amenities(id) ON DELETE SET NULL,
        employee_id BIGINT
          REFERENCES employee(id) ON DELETE SET NULL,
        booking_date DATE,
        start_time TIME,
        end_time TIME,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE invoice_history (
        id BIGSERIAL PRIMARY KEY,
        invoice_number VARCHAR(100) NOT NULL UNIQUE,
        employee_id BIGINT
          REFERENCES employee(id) ON DELETE SET NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0
          CHECK (amount >= 0),
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE roles (
        id BIGSERIAL PRIMARY KEY,
        role_name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE permissions (
        id BIGSERIAL PRIMARY KEY,
        role_id BIGINT NOT NULL
          REFERENCES roles(id) ON DELETE CASCADE,
        module VARCHAR(50) NOT NULL,
        can_create BOOLEAN NOT NULL DEFAULT FALSE,
        can_read BOOLEAN NOT NULL DEFAULT FALSE,
        can_update BOOLEAN NOT NULL DEFAULT FALSE,
        can_delete BOOLEAN NOT NULL DEFAULT FALSE,
        can_publish BOOLEAN NOT NULL DEFAULT FALSE,
        UNIQUE (role_id, module)
      );
    `);

    // 2. Create the four roles.
    await organizationDb.query(`
      INSERT INTO roles (role_name)
      VALUES
        ('operation-manager'),
        ('receptionist'),
        ('account-manager'),
        ('super-admin')
      ON CONFLICT (role_name) DO NOTHING;
    `);

    // 3. Create the organization owner as a super-admin.
    // The role ID is looked up instead of hard-coded.
    await organizationDb.query(
      `INSERT INTO employee (
         full_name,
         email,
         job_title,
         role_id,
         status
       )
       SELECT
         $1,
         $2,
         'Organization Owner',
         r.id,
         'active'
       FROM roles r
       WHERE r.role_name = 'super-admin'
       ON CONFLICT (email) DO NOTHING`,
      [ownerName, ownerEmail]
    );

    // 4. Seed four modules for each of the four roles.
    await organizationDb.query(`
      INSERT INTO permissions (
        role_id,
        module,
        can_create,
        can_read,
        can_update,
        can_delete,
        can_publish
      )
      SELECT
        r.id,
        p.module,
        p.can_create,
        p.can_read,
        p.can_update,
        p.can_delete,
        p.can_publish
      FROM (
        VALUES
          ('operation-manager', 'amenities',
            TRUE, TRUE, TRUE, TRUE, TRUE),
          ('operation-manager', 'bookings',
            FALSE, FALSE, FALSE, FALSE, FALSE),
          ('operation-manager', 'employees',
            FALSE, FALSE, FALSE, FALSE, FALSE),
          ('operation-manager', 'invoices',
            FALSE, FALSE, FALSE, FALSE, FALSE),

          ('receptionist', 'amenities',
            FALSE, TRUE, FALSE, FALSE, FALSE),
          ('receptionist', 'bookings',
            TRUE, TRUE, TRUE, FALSE, FALSE),
          ('receptionist', 'employees',
            FALSE, FALSE, FALSE, FALSE, FALSE),
          ('receptionist', 'invoices',
            FALSE, FALSE, FALSE, FALSE, FALSE),

          ('account-manager', 'amenities',
            FALSE, TRUE, FALSE, FALSE, FALSE),
          ('account-manager', 'bookings',
            FALSE, TRUE, FALSE, FALSE, FALSE),
          ('account-manager', 'employees',
            FALSE, FALSE, FALSE, FALSE, FALSE),
          ('account-manager', 'invoices',
            FALSE, TRUE, TRUE, FALSE, FALSE),

          ('super-admin', 'amenities',
            TRUE, TRUE, TRUE, TRUE, TRUE),
          ('super-admin', 'bookings',
            TRUE, TRUE, TRUE, TRUE, TRUE),
          ('super-admin', 'employees',
            TRUE, TRUE, TRUE, TRUE, TRUE),
          ('super-admin', 'invoices',
            TRUE, TRUE, TRUE, TRUE, TRUE)
      ) AS p(
        role_name,
        module,
        can_create,
        can_read,
        can_update,
        can_delete,
        can_publish
      )
      JOIN roles r ON r.role_name = p.role_name
      ON CONFLICT (role_id, module) DO NOTHING;
    `);

    // 5. Verify roles, permissions, and owner assignment.
    const roleResult = await organizationDb.query(`
      SELECT COUNT(*)::int AS count
      FROM roles
      WHERE role_name IN (
        'operation-manager',
        'receptionist',
        'account-manager',
        'super-admin'
      );
    `);

    const permissionResult = await organizationDb.query(`
      SELECT COUNT(*)::int AS count
      FROM permissions;
    `);

    const ownerResult = await organizationDb.query(
      `SELECT e.id
       FROM employee e
       JOIN roles r ON r.id = e.role_id
       WHERE LOWER(e.email) = LOWER($1)
         AND r.role_name = 'super-admin'
         AND e.status = 'active'
       LIMIT 1`,
      [ownerEmail]
    );

    if (
      roleResult.rows[0].count !== 4 ||
      permissionResult.rows[0].count !== 16 ||
      ownerResult.rows.length !== 1
    ) {
      throw new Error(
        "Initialization failed: expected four roles, 16 permissions, and one super-admin owner."
      );
    }
  } catch (error) {
    // Close the tenant connection before dropping its database.
    if (connected) {
      await organizationDb.end().catch(() => undefined);
    }

    const cleanup = new Client({
      connectionString: getDirectConnectionString("master_db"),
    });

    try {
      await cleanup.connect();
      await cleanup.query(
        `DROP DATABASE IF EXISTS "${organizationId}"`
      );
    } catch (cleanupError) {
      console.error(
        "Failed to clean up organization database:",
        cleanupError
      );
    } finally {
      await cleanup.end().catch(() => undefined);
    }

    throw error;
  } finally {
    if (connected) {
      await organizationDb.end().catch(() => undefined);
    }
  }
}

async function dropOrganizationDatabase(
  organizationId: string
): Promise<void> {
  const cleanup = new Client({
    connectionString: getDirectConnectionString("master_db"),
  });

  try {
    await cleanup.connect();
    await cleanup.query(
      `DROP DATABASE IF EXISTS "${organizationId}"`
    );
  } finally {
    await cleanup.end();
  }
}

export async function POST(request: Request) {
  let createdOrganizationId: string | null = null;

  try {
    const body = await request.json();

    const organizationId =
      typeof body.organizationId === "string"
        ? body.organizationId.trim()
        : "";

    const organizationName =
      typeof body.organizationName === "string"
        ? body.organizationName.trim()
        : "";

    const country =
      typeof body.country === "string"
        ? body.country.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    const confirmPassword =
      typeof body.confirmPassword === "string"
        ? body.confirmPassword
        : "";

    // 1. Validate required fields.
    if (
      !organizationId ||
      !organizationName ||
      !country ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        { success: false, message: "All fields are required." },
        { status: 400 }
      );
    }

    // 2. Validate organization ID and input lengths.
    if (!ORG_ID_PATTERN.test(organizationId)) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Organization ID must contain 1–50 letters or numbers only.",
        },
        { status: 400 }
      );
    }

    if (
      organizationName.length > 150 ||
      country.length > 100 ||
      email.length > 255
    ) {
      return NextResponse.json(
        { success: false, message: "Input is too long." },
        { status: 400 }
      );
    }

    // 3. Validate email and password.
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid email and a password of 8–72 UTF-8 bytes.",
        },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Passwords do not match." },
        { status: 400 }
      );
    }

    // 4. Check whether the organization ID or email exists.
    const existing = await pool.query(
      `SELECT organization_id, email
       FROM master_user
       WHERE organization_id = $1 OR LOWER(email) = $2
       LIMIT 1`,
      [organizationId, email]
    );

    if (existing.rowCount) {
      const emailExists = existing.rows.some(
        (row) => String(row.email).toLowerCase() === email
      );

      return NextResponse.json(
        {
          success: false,
          message: emailExists
            ? "Email is already registered."
            : "Organization ID is already taken.",
        },
        { status: 409 }
      );
    }

    // 5. Provision the database, roles, permissions, and owner.
    await createOrganizationDatabase(
      organizationId,
      email,
      organizationName
    );

    createdOrganizationId = organizationId;

    // 6. Hash the password.
    const passwordHash = await bcrypt.hash(password, 12);

    // 7. Register the organization in master_db.
    const result = await pool.query(
      `INSERT INTO master_user (
         organization_id,
         organization_name,
         country,
         email,
         password_hash,
         subscription_plan,
         subscription_status,
         trial_start_date,
         trial_end_date,
         created_at
       )
       VALUES (
         $1, $2, $3, $4, $5,
         'free',
         'trial',
         CURRENT_TIMESTAMP,
         CURRENT_TIMESTAMP + INTERVAL '30 days',
         CURRENT_TIMESTAMP
       )
       RETURNING
         id,
         organization_id,
         organization_name,
         country,
         email,
         subscription_plan,
         subscription_status,
         trial_start_date,
         trial_end_date,
         created_at`,
      [
        organizationId,
        organizationName,
        country,
        email,
        passwordHash,
      ]
    );

    createdOrganizationId = null;

    return NextResponse.json(
      {
        success: true,
        message:
          "Organization registered with its database, roles, permissions, and super-admin owner.",
        organization: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    if (createdOrganizationId) {
      try {
        await dropOrganizationDatabase(createdOrganizationId);
      } catch (cleanupError) {
        console.error(
          "Organization database cleanup failed:",
          cleanupError
        );
      }
    }

    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String(error.code)
        : "";

    if (code === "23505" || code === "42P04") {
      return NextResponse.json(
        {
          success: false,
          message: "Email or organization ID already exists.",
        },
        { status: 409 }
      );
    }

    console.error("Registration/provisioning error:", error);

    const message =
      error instanceof Error &&
      error.message.includes("direct connection")
        ? error.message
        : "Registration failed. Please check the server logs.";

    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
