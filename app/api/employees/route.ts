
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

async function getOrganization(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("amenity_session="))
    ?.slice("amenity_session=".length);

  const session = verifySession(token);

  if (!session) return null;

  const result = await pool.query(
    `SELECT organization_id
     FROM master_user
     WHERE organization_id = $1
       AND LOWER(email) = LOWER($2)
       AND subscription_status NOT IN ('cancelled', 'suspended')
     LIMIT 1`,
    [session.organizationId, session.email]
  );

  return result.rows[0]?.organization_id ?? null;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const organizationId = await getOrganization(request);

    if (!organizationId) {
      return errorResponse("Please sign in again.", 401);
    }

    const result = await pool.query(
      `SELECT id, full_name, email, phone, job_title, status, created_at
       FROM employees
       WHERE organization_id = $1
       ORDER BY created_at DESC`,
      [organizationId]
    );

    return NextResponse.json({
      success: true,
      employees: result.rows,
    });
  } catch (error) {
    console.error("List employees error:", error);
    return errorResponse("Unable to load employees.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const organizationId = await getOrganization(request);

    if (!organizationId) {
      return errorResponse("Please sign in again.", 401);
    }

    const body = await request.json();
    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : null;
    const jobTitle =
      typeof body.job_title === "string" ? body.job_title.trim() : null;

    if (!fullName || !email) {
      return errorResponse("Employee name and email are required.", 400);
    }

    if (
      fullName.length > 150 ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (phone && phone.length > 30) ||
      (jobTitle && jobTitle.length > 100)
    ) {
      return errorResponse("Please enter valid employee details.", 400);
    }

    const result = await pool.query(
      `INSERT INTO employees
        (organization_id, full_name, email, phone, job_title)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, phone, job_title, status, created_at`,
      [organizationId, fullName, email, phone, jobTitle]
    );

    return NextResponse.json(
      {
        success: true,
        message: "Employee added successfully.",
        employee: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return errorResponse(
        "An employee with this email already exists.",
        409
      );
    }

    console.error("Add employee error:", error);
    return errorResponse("Unable to add employee.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const organizationId = await getOrganization(request);

    if (!organizationId) {
      return errorResponse("Please sign in again.", 401);
    }

    const body = await request.json();
    const id = Number(body.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return errorResponse("A valid employee ID is required.", 400);
    }

    const fullName =
      typeof body.full_name === "string" ? body.full_name.trim() : "";
    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof body.phone === "string" ? body.phone.trim() : null;
    const jobTitle =
      typeof body.job_title === "string" ? body.job_title.trim() : null;
    const status =
      typeof body.status === "string" ? body.status.trim() : "active";

    if (
      !fullName ||
      !email ||
      fullName.length > 150 ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      (phone && phone.length > 30) ||
      (jobTitle && jobTitle.length > 100) ||
      !["active", "inactive"].includes(status)
    ) {
      return errorResponse("Please enter valid employee details.", 400);
    }

    const result = await pool.query(
      `UPDATE employees
       SET full_name = $1,
           email = $2,
           phone = $3,
           job_title = $4,
           status = $5
       WHERE id = $6 AND organization_id = $7
       RETURNING id, full_name, email, phone, job_title, status, created_at`,
      [fullName, email, phone, jobTitle, status, id, organizationId]
    );

    if (result.rows.length === 0) {
      return errorResponse("Employee not found.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Employee updated successfully.",
      employee: result.rows[0],
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return errorResponse(
        "An employee with this email already exists.",
        409
      );
    }

    console.error("Update employee error:", error);
    return errorResponse("Unable to update employee.", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const organizationId = await getOrganization(request);

    if (!organizationId) {
      return errorResponse("Please sign in again.", 401);
    }

    const id = Number(new URL(request.url).searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id <= 0) {
      return errorResponse("A valid employee ID is required.", 400);
    }

    const result = await pool.query(
      `DELETE FROM employees
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, organizationId]
    );

    if (result.rows.length === 0) {
      return errorResponse("Employee not found.", 404);
    }

    return NextResponse.json({
      success: true,
      message: "Employee deleted successfully.",
    });
  } catch (error) {
    console.error("Delete employee error:", error);
    return errorResponse(
      "Unable to delete employee. Check whether they have booking or invoice records.",
      500
    );
  }
}
