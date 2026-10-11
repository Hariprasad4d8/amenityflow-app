
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

async function getOrg(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("amenity_session="));

  const token = cookie
    ? decodeURIComponent(cookie.slice("amenity_session=".length))
    : undefined;
  const session = verifySession(token);
  if (!session) return null;

  const result = await pool.query(
    `SELECT organization_id FROM master_user
     WHERE organization_id = $1 AND email = $2
       AND subscription_status NOT IN ('canceled', 'suspended')`,
    [session.organizationId, session.email]
  );

  return result.rows[0]?.organization_id ?? null;
}

function errorResponse(error: unknown) {
  if ((error as { code?: string })?.code === "23505") {
    return NextResponse.json(
      { error: "That role name already exists." },
      { status: 409 }
    );
  }
  console.error("Roles API error:", error);
  return NextResponse.json({ error: "Unable to process roles." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const org = await getOrg(request);
    if (!org) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

    const result = await pool.query(
      `SELECT id, role_name AS "roleName"
       FROM organization_roles
       WHERE organization_id = $1
       ORDER BY role_name`,
      [org]
    );

    return NextResponse.json({ roles: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const org = await getOrg(request);
    if (!org) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

    const body = await request.json();
    const roleName = String(body.roleName ?? "").trim();

    if (!roleName || roleName.length > 50) {
      return NextResponse.json({ error: "Role name must be 1–50 characters." }, { status: 400 });
    }

    const result = await pool.query(
      `INSERT INTO organization_roles (organization_id, role_name)
       VALUES ($1, $2)
       RETURNING id, role_name AS "roleName"`,
      [org, roleName]
    );

    return NextResponse.json({ role: result.rows[0] }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const org = await getOrg(request);
    if (!org) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

    const body = await request.json();
    const id = Number(body.id);
    const roleName = String(body.roleName ?? "").trim();

    if (!Number.isSafeInteger(id) || id <= 0 || !roleName || roleName.length > 50) {
      return NextResponse.json({ error: "Enter a valid role and name." }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE organization_roles
       SET role_name = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING id, role_name AS "roleName"`,
      [roleName, id, org]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    return NextResponse.json({ role: result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const org = await getOrg(request);
    if (!org) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid role ID." }, { status: 400 });
    }

    const result = await pool.query(
      `DELETE FROM organization_roles
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, org]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Role deleted." });
  } catch (error) {
    return errorResponse(error);
  }
}
