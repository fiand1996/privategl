import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getAppSettings, setAppSettings } from "@/lib/database";

export async function GET() {
  await connection();
  try {
    const settings = getAppSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      settings?: Record<string, string>;
      key?: string;
      value?: string;
    };

    let toSave: Record<string, string> = {};
    if (body.settings && typeof body.settings === "object") {
      toSave = { ...body.settings };
    }
    if (body.key && typeof body.key === "string" && body.value !== undefined) {
      toSave[body.key] = String(body.value);
    }

    if (Object.keys(toSave).length === 0) {
      return NextResponse.json(
        { error: "No settings provided to update." },
        { status: 400 },
      );
    }

    const updated = setAppSettings(toSave);
    return NextResponse.json({ settings: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
