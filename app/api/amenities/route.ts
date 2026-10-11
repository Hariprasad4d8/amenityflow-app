
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifySession } from "@/lib/session";

async function getOrganization(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("amenity_session="));

  const token = sessionCookie
    ? decodeURIComponent(sessionCookie.substring("amenity_session=".length))
    : undefined;

  const session = verifySession(token);

  if (!session) {
    return { error: "Unauthorized", status: 401 as const };
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

  if (result.rows.length === 0) {
    return { error: "Organization not found or inactive", status: 403 as const };
  }

  return { organizationId: result.rows[0].organization_id };
}

function validAmenity(body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const capacity = Number(body.capacity);
  const availableFrom =
    typeof body.availableFrom === "string" ? body.availableFrom : "";
  const availableUntil =
    typeof body.availableUntil === "string" ? body.availableUntil : "";

  return (
    name.length > 0 &&
    name.length <= 150 &&
    Number.isInteger(capacity) &&
    capacity > 0 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(availableFrom) &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(availableUntil) &&
    availableFrom < availableUntil
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

    const result = await pool.query(
      `SELECT
         id,
         name,
         description,
         location,
         capacity,
         TO_CHAR(available_from, 'HH24:MI') AS "availableFrom",
         TO_CHAR(available_until, 'HH24:MI') AS "availableUntil",
         is_published AS "isPublished",
         created_at AS "createdAt"
       FROM amenities
       WHERE organization_id = $1
       ORDER BY id DESC`,
      [auth.organizationId]
    );

    return NextResponse.json({ amenities: result.rows });
  } catch (error) {
    console.error("Get amenities error:", error);
    return NextResponse.json(
      { error: "Failed to load amenities" },
      { status: 500 }
    );
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

    if (!validAmenity(body)) {
      return NextResponse.json(
        { error: "Enter a name, positive capacity, and valid available hours." },
        { status: 400 }
      );
    }

    const name = (body.name as string).trim();
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    const location =
      typeof body.location === "string" ? body.location.trim() : "";

    const result = await pool.query(
      `INSERT INTO amenities
         (organization_id, name, description, location, capacity,
          available_from, available_until)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, description, location, capacity,
         TO_CHAR(available_from, 'HH24:MI') AS "availableFrom",
         TO_CHAR(available_until, 'HH24:MI') AS "availableUntil",
         is_published AS "isPublished",
         created_at AS "createdAt"`,
      [
        auth.organizationId,
        name,
        description || null,
        location || null,
        Number(body.capacity),
        body.availableFrom,
        body.availableUntil,
      ]
    );

    return NextResponse.json(
      { message: "Amenity added successfully", amenity: result.rows[0] },
      { status: 201 }
    );
  } catch (error: unknown) {
    const dbError = error as { code?: string };
    if (dbError.code === "23505") {
      return NextResponse.json(
        { error: "An amenity with this name already exists." },
        { status: 409 }
      );
    }

    console.error("Create amenity error:", error);
    return NextResponse.json(
      { error: "Failed to add amenity" },
      { status: 500 }
    );
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

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid amenity ID" }, { status: 400 });
    }

    const fields: Record<string, { column: string; value: unknown }> = {
      name: { column: "name", value: body.name },
      description: { column: "description", value: body.description },
      location: { column: "location", value: body.location },
      capacity: { column: "capacity", value: body.capacity },
      availableFrom: { column: "available_from", value: body.availableFrom },
      availableUntil: { column: "available_until", value: body.availableUntil },
      isPublished: { column: "is_published", value: body.isPublished },
    };

    const updates = Object.entries(fields)
      .filter(([key]) => Object.prototype.hasOwnProperty.call(body, key));

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    if (
      ("name" in body || "capacity" in body ||
        "availableFrom" in body || "availableUntil" in body) &&
      !validAmenity(body)
    ) {
      // For partial updates, load current values before validating.
      const current = await pool.query(
        `SELECT name, capacity,
           TO_CHAR(available_from, 'HH24:MI') AS "availableFrom",
           TO_CHAR(available_until, 'HH24:MI') AS "availableUntil"
         FROM amenities
         WHERE id = $1 AND organization_id = $2`,
        [id, auth.organizationId]
      );

      if (current.rows.length === 0) {
        return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
      }

      const merged = { ...current.rows[0], ...body };
      if (!validAmenity(merged)) {
        return NextResponse.json(
          { error: "Please check the amenity name, capacity, and available hours." },
          { status: 400 }
        );
      }
    }

    if ("isPublished" in body && typeof body.isPublished !== "boolean") {
      return NextResponse.json(
        { error: "isPublished must be true or false" },
        { status: 400 }
      );
    }

    const values: unknown[] = [id, auth.organizationId];
    const assignments = updates.map(([key, field]) => {
      let value = field.value;

      if (key === "name" && typeof value === "string") value = value.trim();
      if ((key === "description" || key === "location") && typeof value === "string") {
        value = value.trim() || null;
      }
      if (key === "capacity") value = Number(value);

      values.push(value);
      return `${field.column} = $${values.length}`;
    });

    const result = await pool.query(
      `UPDATE amenities
       SET ${assignments.join(", ")}
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name, description, location, capacity,
         TO_CHAR(available_from, 'HH24:MI') AS "availableFrom",
         TO_CHAR(available_until, 'HH24:MI') AS "availableUntil",
         is_published AS "isPublished",
         created_at AS "createdAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Amenity updated successfully",
      amenity: result.rows[0],
    });
  } catch (error: unknown) {
    const dbError = error as { code?: string };

    if (dbError.code === "23505") {
      return NextResponse.json(
        { error: "An amenity with this name already exists." },
        { status: 409 }
      );
    }

    if (dbError.code === "23514") {
      return NextResponse.json(
        { error: "Available-from time must be earlier than available-until time." },
        { status: 400 }
      );
    }

    console.error("Update amenity error:", error);
    return NextResponse.json(
      { error: "Failed to update amenity" },
      { status: 500 }
    );
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

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    if (!Number.isSafeInteger(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid amenity ID" }, { status: 400 });
    }

    const result = await pool.query(
      `DELETE FROM amenities
       WHERE id = $1 AND organization_id = $2
       RETURNING id`,
      [id, auth.organizationId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Amenity not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Amenity deleted successfully" });
  } catch (error: unknown) {
    const dbError = error as { code?: string };

    if (dbError.code === "23503") {
      return NextResponse.json(
        { error: "This amenity has booking records and cannot be deleted." },
        { status: 409 }
      );
    }

    console.error("Delete amenity error:", error);
    return NextResponse.json(
      { error: "Failed to delete amenity" },
      { status: 500 }
    );
  }
}
