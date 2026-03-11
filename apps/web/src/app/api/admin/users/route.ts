import { NextResponse } from "next/server";
import { ApiError, getAdminUsers } from "@/lib/api";

export async function GET() {
  try {
    const data = await getAdminUsers();
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
