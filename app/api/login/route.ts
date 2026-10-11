
import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const secret = process.env.SESSION_SECRET;

    if (!secret || secret.length < 32) {
      console.error("SESSION_SECRET is missing or too short.");

      return NextResponse.json(
        {
          success: false,
          message: "Server configuration error.",
        },
        { status: 500 }
      );
    }

    let body: {
      organizationId?: unknown;
      email?: unknown;
      password?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const organizationId =
      typeof body.organizationId === "string"
        ? body.organizationId.trim()
        : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string" ? body.password : "";

    if (!organizationId || !email || !password) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required.",
        },
        { status: 400 }
      );
    }

    if (
      organizationId.length > 50 ||
      email.length > 255 ||
      password.length > 1024 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter valid login details.",
        },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `SELECT
         organization_id,
         organization_name,
         country,
         email,
         password_hash,
         subscription_plan,
         subscription_status,
         trial_end_date
       FROM master_user
       WHERE organization_id = $1
         AND LOWER(email) = $2
       LIMIT 1`,
      [organizationId, email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization ID, email, or password.",
        },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid organization ID, email, or password.",
        },
        { status: 401 }
      );
    }

    const status = String(user.subscription_status).toLowerCase();

    if (["cancelled", "suspended"].includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "This organization account is inactive.",
        },
        { status: 403 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    const payload = Buffer.from(
      JSON.stringify({
        organizationId: user.organization_id,
        email: user.email,
        iat: now,
        exp: now + 7 * 24 * 60 * 60,
      })
    ).toString("base64url");

    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");

    const response = NextResponse.json({
      success: true,
      message: "Login successful.",
      organization: {
        organization_id: user.organization_id,
        organization_name: user.organization_name,
        country: user.country,
        email: user.email,
        subscription_plan: user.subscription_plan,
        subscription_status: user.subscription_status,
        trial_end_date: user.trial_end_date,
      },
    });

    response.cookies.set(
      "amenity_session",
      `${payload}.${signature}`,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error("Login API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to sign in. Please try again.",
      },
      { status: 500 }
    );
  }
}
