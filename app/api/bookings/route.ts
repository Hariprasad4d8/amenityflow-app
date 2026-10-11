
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

function apiError(message: string, error: unknown) {
  console.error(message, error);

  return NextResponse.json(
    {
      error: message,
      details:
        process.env.NODE_ENV === "development" &&
        error instanceof Error
          ? error.message
          : undefined,
    },
    { status: 500 }
  );
}

async function getOrganization(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith("amenity_session="));

  let token: string | undefined;

  try {
    token = cookie
      ? decodeURIComponent(
          cookie.substring("amenity_session=".length)
        )
      : undefined;
  } catch {
    return {
      error: "Invalid session cookie. Please log in again.",
      status: 401 as const,
    };
  }

  const session = verifySession(token);

  if (!session) {
    return {
      error: "Please log in again.",
      status: 401 as const,
    };
  }

  const result = await pool.query(
    `SELECT organization_id
     FROM master_user
     WHERE organization_id = $1
       AND email = $2
       AND subscription_status NOT IN ('canceled', 'suspended')
     LIMIT 1`,
    [session.organizationId, session.email]
  );

  if (!result.rows.length) {
    return {
      error: "Organization not found or inactive.",
      status: 403 as const,
    };
  }

  return {
    organizationId: result.rows[0].organization_id as string,
  };
}

function validDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function validTime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  );
}

export async function GET(request: Request) {
  try {
    const auth = await getOrganization(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const organizationId = auth.organizationId;

    const [bookings, employees, amenities] = await Promise.all([
      pool.query(
        `SELECT
           b.id,
           b.amenity_id AS "amenityId",
           b.employee_id AS "employeeId",
           b.booking_date::text AS "bookingDate",
           TO_CHAR(b.start_time, 'HH24:MI') AS "startTime",
           TO_CHAR(b.end_time, 'HH24:MI') AS "endTime",
           b.status,
           b.created_at AS "createdAt",
           a.name AS "amenityName",
           e.full_name AS "employeeName"
         FROM booking_history b
         JOIN amenities a
           ON a.id = b.amenity_id
          AND a.organization_id = b.organization_id
         JOIN employees e
           ON e.id = b.employee_id
          AND e.organization_id = b.organization_id
         WHERE b.organization_id = $1
         ORDER BY b.booking_date DESC, b.start_time DESC`,
        [organizationId]
      ),

      pool.query(
        `SELECT id, full_name AS "fullName"
         FROM employees
         WHERE organization_id = $1
           AND status = 'active'
         ORDER BY full_name`,
        [organizationId]
      ),

      pool.query(
        `SELECT id, name, capacity
         FROM amenities
         WHERE organization_id = $1
           AND is_published = TRUE
         ORDER BY name`,
        [organizationId]
      ),
    ]);

    return NextResponse.json({
      bookings: bookings.rows,
      employees: employees.rows,
      amenities: amenities.rows,
    });
  } catch (error) {
    return apiError("Failed to load bookings.", error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getOrganization(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();

    const amenityId = Number(body.amenityId);
    const employeeId = Number(body.employeeId);
    const bookingDate = body.bookingDate;
    const startTime = body.startTime;
    const endTime = body.endTime;

    if (
      !Number.isSafeInteger(amenityId) ||
      amenityId <= 0 ||
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0 ||
      !validDate(bookingDate) ||
      !validTime(startTime) ||
      !validTime(endTime) ||
      startTime >= endTime
    ) {
      return NextResponse.json(
        {
          error:
            "Enter a valid amenity, employee, date, and time range.",
        },
        { status: 400 }
      );
    }

    const amenityResult = await pool.query(
      `SELECT id, available_from, available_until
       FROM amenities
       WHERE id = $1
         AND organization_id = $2
         AND is_published = TRUE`,
      [amenityId, auth.organizationId]
    );

    if (!amenityResult.rows.length) {
      return NextResponse.json(
        { error: "Select an available, published amenity." },
        { status: 400 }
      );
    }

    const employeeResult = await pool.query(
      `SELECT id
       FROM employees
       WHERE id = $1
         AND organization_id = $2
         AND status = 'active'`,
      [employeeId, auth.organizationId]
    );

    if (!employeeResult.rows.length) {
      return NextResponse.json(
        {
          error:
            "Select an active employee from your organization.",
        },
        { status: 400 }
      );
    }

    const availabilityResult = await pool.query(
      `SELECT
         $1::time >= available_from
         AND $2::time <= available_until AS allowed
       FROM amenities
       WHERE id = $3
         AND organization_id = $4
         AND is_published = TRUE`,
      [
        startTime,
        endTime,
        amenityId,
        auth.organizationId,
      ]
    );

    if (!availabilityResult.rows[0]?.allowed) {
      return NextResponse.json(
        {
          error:
            "Booking time must be within the amenity's available hours.",
        },
        { status: 400 }
      );
    }

    const conflict = await pool.query(
      `SELECT id
       FROM booking_history
       WHERE organization_id = $1
         AND amenity_id = $2
         AND booking_date = $3::date
         AND status <> 'cancelled'
         AND start_time < $5::time
         AND end_time > $4::time
       LIMIT 1`,
      [
        auth.organizationId,
        amenityId,
        bookingDate,
        startTime,
        endTime,
      ]
    );

    if (conflict.rows.length) {
      return NextResponse.json(
        {
          error:
            "This amenity already has a booking during that time.",
        },
        { status: 409 }
      );
    }

    const result = await pool.query(
      `INSERT INTO booking_history (
         organization_id,
         amenity_id,
         employee_id,
         booking_date,
         start_time,
         end_time,
         status
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING
         id,
         amenity_id AS "amenityId",
         employee_id AS "employeeId",
         booking_date::text AS "bookingDate",
         TO_CHAR(start_time, 'HH24:MI') AS "startTime",
         TO_CHAR(end_time, 'HH24:MI') AS "endTime",
         status`,
      [
        auth.organizationId,
        amenityId,
        employeeId,
        bookingDate,
        startTime,
        endTime,
      ]
    );

    return NextResponse.json(
      {
        message: "Booking created successfully.",
        booking: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    return apiError("Failed to create booking.", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await getOrganization(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const body = await request.json();
    const id = Number(body.id);

    const allowedStatuses = [
      "pending",
      "approved",
      "cancelled",
      "completed",
    ];

    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      !allowedStatuses.includes(body.status)
    ) {
      return NextResponse.json(
        { error: "Provide a valid booking ID and status." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE booking_history
       SET status = $1
       WHERE id = $2
         AND organization_id = $3
       RETURNING id, status`,
      [body.status, id, auth.organizationId]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Booking status updated.",
      booking: result.rows[0],
    });
  } catch (error) {
    return apiError("Failed to update booking.", error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getOrganization(request);

    if ("error" in auth) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status }
      );
    }

    const id = Number(
      new URL(request.url).searchParams.get("id")
    );

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid booking ID." },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `DELETE FROM booking_history
       WHERE id = $1
         AND organization_id = $2
       RETURNING id`,
      [id, auth.organizationId]
    );

    if (!result.rows.length) {
      return NextResponse.json(
        { error: "Booking not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Booking deleted successfully.",
    });
  } catch (error) {
    return apiError("Failed to delete booking.", error);
  }
}
