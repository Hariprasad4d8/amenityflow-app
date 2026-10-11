
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

const VALID_STATUSES = ["pending", "paid", "overdue", "cancelled"];

async function getOrg(request: Request) {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("amenity_session="));

  const token = cookie
    ? decodeURIComponent(cookie.slice("amenity_session=".length))
    : undefined;

  const session = verifySession(token);

  if (!session) return null;

  const result = await pool.query(
    `SELECT organization_id
     FROM master_user
     WHERE organization_id = $1
       AND email = $2
       AND subscription_status NOT IN ('canceled', 'suspended')`,
    [session.organizationId, session.email]
  );

  return result.rows[0]?.organization_id ?? null;
}

function handleError(error: unknown) {
  const dbError = error as { code?: string };

  if (dbError?.code === "23505") {
    return NextResponse.json(
      {
        error:
          "This invoice number already exists. Please enter a different invoice number.",
      },
      { status: 409 }
    );
  }

  console.error("Invoice API error:", error);

  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    const org = await getOrg(request);

    if (!org) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const result = await pool.query(
      `SELECT id, invoice_number AS "invoiceNumber",
              employee_id AS "employeeId", amount, status,
              invoice_date::text AS "invoiceDate"
       FROM invoice_history
       WHERE organization_id = $1
       ORDER BY invoice_date DESC, id DESC`,
      [org]
    );

    return NextResponse.json({ invoices: result.rows });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const org = await getOrg(request);

    if (!org) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const invoiceNumber = String(body.invoiceNumber ?? "").trim();
    const amount = Number(body.amount);
    const status = body.status ?? "pending";
    const invoiceDate = body.invoiceDate;

    const employeeId =
      body.employeeId === "" || body.employeeId == null
        ? null
        : Number(body.employeeId);

    if (
      !invoiceNumber ||
      invoiceNumber.length > 100 ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !VALID_STATUSES.includes(status) ||
      typeof invoiceDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ||
      (employeeId !== null &&
        (!Number.isSafeInteger(employeeId) || employeeId <= 0))
    ) {
      return NextResponse.json(
        { error: "Enter a valid invoice number, amount, date and status." },
        { status: 400 }
      );
    }

    if (employeeId !== null) {
      const employee = await pool.query(
        `SELECT id
         FROM employees
         WHERE id = $1 AND organization_id = $2`,
        [employeeId, org]
      );

      if (!employee.rows.length) {
        return NextResponse.json(
          { error: "Employee not found in your organization." },
          { status: 400 }
        );
      }
    }

    const result = await pool.query(
      `INSERT INTO invoice_history
         (organization_id, invoice_number, employee_id, amount, status, invoice_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, invoice_number AS "invoiceNumber",
         employee_id AS "employeeId", amount, status,
         invoice_date::text AS "invoiceDate"`,
      [org, invoiceNumber, employeeId, amount, status, invoiceDate]
    );

    return NextResponse.json(
      {
        message: "Invoice created successfully.",
        invoice: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const org = await getOrg(request);

    if (!org) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const id = Number(body.id);
    const status = body.status;

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !VALID_STATUSES.includes(status)
    ) {
      return NextResponse.json(
        { error: "Invalid invoice ID or status." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE invoice_history
       SET status = $1
       WHERE id = $2 AND organization_id = $3
       RETURNING id, invoice_number AS "invoiceNumber",
         amount, status, invoice_date::text AS "invoiceDate"`,
      [status, id, org]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Invoice status updated successfully.",
      invoice: result.rows[0],
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const org = await getOrg(request);

    if (!org) {
      return NextResponse.json(
        { error: "Please log in again." },
        { status: 401 }
      );
    }

    const id = Number(new URL(request.url).searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid invoice ID." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM invoice_history
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, org]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Invoice deleted successfully.",
    });
  } catch (error) {
    return handleError(error);
  }
}
