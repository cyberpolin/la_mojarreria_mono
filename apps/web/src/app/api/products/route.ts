import { NextRequest, NextResponse } from "next/server";
import { createProduct, getProducts } from "@/lib/products";

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load products",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      name?: string;
      price?: number;
      rawCost?: number;
      salePrice?: number | null;
      description?: string;
      active?: boolean;
      images?: Array<{
        publicId: string;
        secureUrl: string;
        width?: number;
        height?: number;
        format?: string;
        bytes?: number;
      }>;
    };

    if (
      !body.name ||
      typeof body.price !== "number" ||
      typeof body.rawCost !== "number"
    ) {
      return NextResponse.json(
        { error: "name, price and rawCost are required" },
        { status: 400 },
      );
    }
    if (
      !Array.isArray(body.images) ||
      body.images.length < 1 ||
      body.images.length > 5
    ) {
      return NextResponse.json(
        { error: "images must include between 1 and 5 entries" },
        { status: 400 },
      );
    }

    const product = await createProduct({
      name: body.name,
      price: body.price,
      rawCost: body.rawCost,
      salePrice: body.salePrice ?? null,
      description: body.description ?? "",
      active: body.active ?? true,
      images: body.images,
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create product",
      },
      { status: 500 },
    );
  }
}
