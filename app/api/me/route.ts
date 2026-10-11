
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

export async function GET(request: Request) {
  // Read the cookie before the try block so the catch block
  // does not swallow framework-level prerendering signals.
  const cookieHeader = request.headers.get("cookie") || "";

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("amenity_session="))
    ?.slice("amenity_session=".length);

  try {
    const session = verifySession(token);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Please sign in",
        },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT
        organization_id,
        organization_name,
        country,
        email,
        subscription_plan,
        subscription_status,
        trial_end_date
       FROM master_user
       WHERE organization_id = $1
         AND email = $2
       LIMIT 1`,
      [session.organizationId, session.email]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Organization not found",
        },
        { status: 401 }
      );
    }

    const organization = result.rows[0];

    if (
      organization.subscription_status === "cancelled" ||
      organization.subscription_status === "suspended"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Organization account is inactive",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error("Session verification error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to verify session",
      },
      { status: 500 }
    );
  }
}
