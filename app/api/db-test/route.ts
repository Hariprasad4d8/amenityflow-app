
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const organizationName =
      typeof body.organizationName === "string"
        ? body.organizationName.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!organizationName || !email || !password) {
      return NextResponse.json(
        { success: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    if (organizationName.length > 150 || email.length > 255) {
      return NextResponse.json(
        { success: false, message: "Input is too long" },
        { status: 400 }
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Enter a valid email and a password of 8–72 UTF-8 bytes",
        },
        { status: 400 }
      );
    }

    const existing = await pool.query(
      "SELECT id FROM master_user WHERE email = $1",
      [email]
    );

    if (existing.rowCount) {
      return NextResponse.json(
        { success: false, message: "Email is already registered" },
        { status: 409 }
      );
    }

    const organizationId = `ORG-${randomUUID()}`;
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO master_user
        (organization_id, organization_name, email, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, organization_id, organization_name, email,
                 subscription_plan, subscription_status, created_at`,
      [organizationId, organizationName, email, passwordHash]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Organization registered successfully",
        organization: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);

    return NextResponse.json(
      { success: false, message: "Registration failed" },
      { status: 500 }
    );
  }
}
