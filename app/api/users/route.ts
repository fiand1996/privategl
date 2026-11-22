import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createUser,
  deleteUser,
  getUserCount,
  listUsers,
} from "@/lib/database";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const users = listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Failed to list users:", error);
    return NextResponse.json(
      { error: "Failed to retrieve user list." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const count = getUserCount();
    const session = await auth();

    // If users already exist, only an admin can create new accounts
    if (count > 0) {
      if (!session?.user || session.user.role !== "admin") {
        return NextResponse.json(
          { error: "Forbidden. Only administrators can create new users." },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: "admin" | "viewer";
    };

    const username = body.username?.trim().toLowerCase();
    const password = body.password;
    const displayName = body.displayName?.trim() || null;
    // First user must be admin
    const role: "admin" | "viewer" = count === 0 ? "admin" : (body.role || "viewer");

    if (!username) {
      return NextResponse.json(
        { error: "Username is required." },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (role !== "admin" && role !== "viewer") {
      return NextResponse.json(
        { error: "Invalid role. Must be 'admin' or 'viewer'." },
        { status: 400 }
      );
    }

    const newUser = createUser(
      username,
      password,
      role,
      displayName || undefined
    );

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Administrator privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get("id");
    if (!idParam) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    const id = Number(idParam);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid user ID." },
        { status: 400 }
      );
    }

    if (session.user.id && Number(session.user.id) === id) {
      return NextResponse.json(
        { error: "You cannot delete your own active account." },
        { status: 400 }
      );
    }

    deleteUser(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
