import { NextRequest, NextResponse } from "next/server";

const getApiBaseUrl = () => {
  const graphqlUrl =
    process.env.KEYSTONE_GRAPHQL_URL ??
    process.env.NEXT_PUBLIC_KEYSTONE_GRAPHQL_URL ??
    "http://localhost:3000/api/graphql";

  try {
    const url = new URL(graphqlUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:3000";
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      dataUrl?: string;
      productName?: string;
      productKey?: string;
      imageIndex?: number;
    };

    if (!body.dataUrl || !body.productName) {
      return NextResponse.json(
        { error: "dataUrl and productName are required" },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${getApiBaseUrl()}/rest/uploads/product-image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as {
      image?: unknown;
      error?: string;
    };
    if (!response.ok) {
      return NextResponse.json(
        { error: payload.error ?? `Upload failed (${response.status})` },
        { status: response.status },
      );
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to upload image",
      },
      { status: 500 },
    );
  }
}
