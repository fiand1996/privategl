import fs from "node:fs";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  createBackup,
  deleteBackup,
  getBackupPath,
  listBackups,
  restoreBackup,
} from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const downloadFile = searchParams.get("download");

    if (downloadFile) {
      const fullPath = getBackupPath(downloadFile);
      const stat = await fs.promises.stat(fullPath);
      const fileBuffer = await fs.promises.readFile(fullPath);

      return new Response(fileBuffer, {
        headers: {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="${downloadFile}"`,
          "Content-Length": String(stat.size),
          "Cache-Control": "no-store",
        },
      });
    }

    const backups = await listBackups();
    return NextResponse.json({ backups });
  } catch (error) {
    console.error("Backup GET error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load backups.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required." },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      action?: "create" | "restore";
      filename?: string;
    };

    const action = body.action || "create";

    if (action === "create") {
      const backup = await createBackup();
      return NextResponse.json({ success: true, backup });
    }

    if (action === "restore") {
      if (!body.filename) {
        return NextResponse.json(
          { error: "Filename is required to restore database." },
          { status: 400 },
        );
      }
      await restoreBackup(body.filename);
      return NextResponse.json({
        success: true,
        message: `Database successfully restored from ${body.filename}.`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Supported: create, restore" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Backup POST error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to perform backup action.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user?.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Admin privileges required." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    let filename = searchParams.get("filename");

    if (!filename) {
      const body = (await request.json().catch(() => ({}))) as {
        filename?: string;
      };
      filename = body.filename || null;
    }

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required to delete backup." },
        { status: 400 },
      );
    }

    await deleteBackup(filename);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Backup DELETE error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete backup.",
      },
      { status: 500 },
    );
  }
}
