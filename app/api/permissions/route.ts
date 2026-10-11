
import { NextResponse } from "next/server";
import { Client } from "pg";
import { verifySession } from "@/lib/session";

const MODULES = [
  "employees",
  "amenities",
  "bookings",
  "invoices",
] as const;

function getTenantConnectionString(organizationId: string): string {
  // Organization IDs must match the registration rules.
  if (!/^[A-Za-z0-9]{1,50}$/.test(organizationId)) {
    throw new Error("Invalid organization ID.");
  }

  const configuredUrl = process.env.DATABASE_URL;

  if (!configuredUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const url = new URL(configuredUrl);

  if (url.hostname.includes("-pooler")) {
    throw new Error(
      "Use a direct Neon connection for tenant database access."
    );
  }

  url.pathname = `/${organizationId}`;

  return url.toString();
}

async function getAuthenticatedOrganization(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";

  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("amenity_session="));

  const token = cookie
    ? decodeURIComponent(
        cookie.slice("amenity_session=".length)
      )
    : undefined;

  const session = verifySession(token);

  if (!session) {
    return null;
  }

  return session;
}

async function getTenantClient(organizationId: string) {
  const client = new Client({
    connectionString:
      getTenantConnectionString(organizationId),
    connectionTimeoutMillis: 10000,
  });

  await client.connect();

  return client;
}

export async function GET(request: Request) {
  let client: Client | undefined;

  try {
    const session = await getAuthenticatedOrganization(request);

    if (!session) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    client = await getTenantClient(session.organizationId);

    // Confirm the organization account is still active.
    const result = await client.query(
      `SELECT subscription_status
       FROM master_db.public.master_user
       WHERE organization_id = $1
         AND email = $2
       LIMIT 1`,
      [session.organizationId, session.email]
    ).catch(async () => {
      // The tenant connection cannot query master_db on all
      // PostgreSQL hosting configurations. Validate using the
      // master connection separately if cross-database queries
      // are unavailable.
      throw new Error(
        "Unable to verify organization status. Check the master database connection."
      );
    });

    if (
      !result.rows.length ||
      ["cancelled", "canceled", "suspended"].includes(
        String(result.rows[0].subscription_status).toLowerCase()
      )
    ) {
      return NextResponse.json(
        { error: "Organization account is inactive." },
        { status: 403 }
      );
    }

    const permissions = await client.query(
      `SELECT
         p.id,
         p.role_id AS "roleId",
         r.role_name AS "roleName",
         p.module,
         p.can_create AS "canCreate",
         p.can_read AS "canRead",
         p.can_update AS "canUpdate",
         p.can_delete AS "canDelete",
         p.can_publish AS "canPublish"
       FROM permissions p
       JOIN roles r ON r.id = p.role_id
       ORDER BY r.id, p.module`
    );

    return NextResponse.json({
      success: true,
      permissions: permissions.rows,
    });
  } catch (error) {
    console.error("Get permissions error:", error);

    return NextResponse.json(
      { error: "Unable to load permissions." },
      { status: 500 }
    );
  } finally {
    await client?.end().catch(() => undefined);
  }
}

export async function POST(request: Request) {
  let client: Client | undefined;

  try {
    const session = await getAuthenticatedOrganization(request);

    if (!session) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const roleId = Number(body.roleId);
    const moduleName = String(body.module ?? "");

    if (
      !Number.isSafeInteger(roleId) ||
      roleId <= 0 ||
      !MODULES.includes(
        moduleName as (typeof MODULES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Select a valid role and module." },
        { status: 400 }
      );
    }

    client = await getTenantClient(session.organizationId);

    // The signed-in email must be linked to a tenant employee
    // whose assigned role is super-admin.
    const actor = await client.query(
      `SELECT e.id
       FROM employee e
       JOIN roles r ON r.id = e.role_id
       WHERE LOWER(e.email) = LOWER($1)
         AND r.role_name = 'super-admin'
         AND e.status = 'active'
       LIMIT 1`,
      [session.email]
    );

    if (!actor.rows.length) {
      return NextResponse.json(
        {
          error:
            "Permission changes require an active super-admin employee account.",
        },
        { status: 403 }
      );
    }

    const targetRole = await client.query(
      `SELECT id
       FROM roles
       WHERE id = $1`,
      [roleId]
    );

    if (!targetRole.rows.length) {
      return NextResponse.json(
        { error: "Role not found." },
        { status: 404 }
      );
    }

    const permission = await client.query(
      `INSERT INTO permissions (
         role_id,
         module,
         can_create,
         can_read,
         can_update,
         can_delete,
         can_publish
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (role_id, module)
       DO UPDATE SET
         can_create = EXCLUDED.can_create,
         can_read = EXCLUDED.can_read,
         can_update = EXCLUDED.can_update,
         can_delete = EXCLUDED.can_delete,
         can_publish = EXCLUDED.can_publish
       RETURNING
         id,
         role_id AS "roleId",
         module,
         can_create AS "canCreate",
         can_read AS "canRead",
         can_update AS "canUpdate",
         can_delete AS "canDelete",
         can_publish AS "canPublish"`,
      [
        roleId,
        moduleName,
        body.canCreate === true,
        body.canRead === true,
        body.canUpdate === true,
        body.canDelete === true,
        body.canPublish === true,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "Permissions saved.",
      permission: permission.rows[0],
    });
  } catch (error) {
    console.error("Save permissions error:", error);

    return NextResponse.json(
      { error: "Unable to save permissions." },
      { status: 500 }
    );
  } finally {
    await client?.end().catch(() => undefined);
  }
}
