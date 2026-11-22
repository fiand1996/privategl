import { connection } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { enqueueScan, getRecentTasks } from "@/lib/database";
import { triggerScanQueue } from "@/lib/scan-runner";

export async function GET() {
  await connection();
  try {
    const tasks = getRecentTasks();
    const hasPending = tasks.some(
      (t) => t.status === "queued" || t.status === "running",
    );
    if (hasPending) {
      triggerScanQueue();
    }
    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("Failed to load scan tasks:", error);
    return NextResponse.json(
      { error: "Scan status could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { libraryId?: unknown };
    const libraryId = Number(body.libraryId);
    if (!Number.isSafeInteger(libraryId) || libraryId < 1) {
      return NextResponse.json({ error: "Invalid library." }, { status: 400 });
    }

    const result = enqueueScan(libraryId);
    if (result.error === "not_found") {
      return NextResponse.json({ error: "Library not found." }, { status: 404 });
    }
    if (result.error === "active") {
      // Trigger scan queue just in case a previous task was waiting
      triggerScanQueue();
      return NextResponse.json(
        { error: "A scan for this library is already running or queued." },
        { status: 409 },
      );
    }

    // Immediately start the in-process background scanner
    triggerScanQueue();

    return NextResponse.json({ task: result.task }, { status: 202 });
  } catch (error) {
    console.error("Failed to queue library scan:", error);
    return NextResponse.json(
      { error: "The scan could not be queued." },
      { status: 500 },
    );
  }
}
