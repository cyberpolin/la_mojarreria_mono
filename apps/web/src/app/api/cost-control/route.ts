import { NextRequest, NextResponse } from "next/server";
import {
  createPurchase,
  createRawMaterial,
  createRecipeItem,
  deletePurchase,
  deleteRawMaterial,
  deleteRecipeItem,
  getCostControlData,
  updatePurchase,
  updateRawMaterial,
  updateRecipeItem,
} from "@/lib/cost-control";

export async function GET() {
  try {
    const data = await getCostControlData();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load cost control data",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");

    if (entity === "rawMaterial") {
      await createRawMaterial({
        name: String(body.name ?? ""),
        unit: String(body.unit ?? "u") as "kg" | "l" | "u",
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (entity === "purchase") {
      await createPurchase({
        rawMaterialId: String(body.rawMaterialId ?? ""),
        purchasedAt: body.purchasedAt ? String(body.purchasedAt) : undefined,
        quantity: Number(body.quantity ?? 0),
        totalCostCents: Number(body.totalCostCents ?? 0),
        supplier: body.supplier ? String(body.supplier) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    if (entity === "recipe") {
      await createRecipeItem({
        productId: String(body.productId ?? ""),
        rawMaterialId: String(body.rawMaterialId ?? ""),
        qtyPerProduct: Number(body.qtyPerProduct ?? 0),
        wastePct: Number(body.wastePct ?? 0),
      });
      return NextResponse.json({ ok: true }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create cost control entity",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (entity === "rawMaterial") {
      await updateRawMaterial(id, {
        name: String(body.name ?? ""),
        unit: String(body.unit ?? "u") as "kg" | "l" | "u",
        active: Boolean(body.active ?? true),
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "purchase") {
      await updatePurchase(id, {
        rawMaterialId: String(body.rawMaterialId ?? ""),
        purchasedAt: body.purchasedAt ? String(body.purchasedAt) : undefined,
        quantity: Number(body.quantity ?? 0),
        totalCostCents: Number(body.totalCostCents ?? 0),
        supplier: body.supplier ? String(body.supplier) : undefined,
        notes: body.notes ? String(body.notes) : undefined,
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "recipe") {
      await updateRecipeItem(id, {
        productId: String(body.productId ?? ""),
        rawMaterialId: String(body.rawMaterialId ?? ""),
        qtyPerProduct: Number(body.qtyPerProduct ?? 0),
        wastePct: Number(body.wastePct ?? 0),
      });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update cost control entity",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const entity = String(body.entity ?? "");
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    if (entity === "rawMaterial") {
      await deleteRawMaterial(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "purchase") {
      await deletePurchase(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (entity === "recipe") {
      await deleteRecipeItem(id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid entity" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete cost control entity",
      },
      { status: 500 },
    );
  }
}
