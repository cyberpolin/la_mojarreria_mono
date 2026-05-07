import { NextRequest, NextResponse } from "next/server";
import { getLatestRestaurant, upsertRestaurant } from "@/lib/restaurant";

export async function GET() {
  try {
    const restaurant = await getLatestRestaurant();
    return NextResponse.json({ restaurant }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load restaurant",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: string | null;
      name?: string;
      description?: string;
      logo?: {
        publicId: string;
        secureUrl: string;
        width?: number;
        height?: number;
        format?: string;
        bytes?: number;
      } | null;
    };

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const restaurant = await upsertRestaurant({
      id: body.id ?? null,
      name: body.name,
      description: body.description ?? "",
      logo: body.logo ?? null,
    });

    return NextResponse.json({ restaurant }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save restaurant",
      },
      { status: 500 },
    );
  }
}
