import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getUserCount } from "@/lib/database";

export async function GET() {
  await connection();
  try {
    const count = getUserCount();
    return NextResponse.json(
      { userCount: count },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Failed to fetch user count:", error);
    return NextResponse.json(
      { error: "Failed to determine user count." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  }
}
