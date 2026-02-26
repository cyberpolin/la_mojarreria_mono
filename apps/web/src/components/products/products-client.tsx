"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductRecord } from "@/types/product";
import { ProductOperationalReportRow } from "@/types/dashboard";

const toMoney = (value: number) => `$${value.toFixed(2)}`;
const toMoneyFromCents = (value: number) => `$${(value / 100).toFixed(2)}`;
const margin = (price: number, rawCost: number) =>
  price > 0 ? ((price - rawCost) / price) * 100 : 0;
const MAX_IMAGES = 5;

type UploadedImage = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

const toDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`Failed to read file ${file.name}`));
    reader.readAsDataURL(file);
  });

export function ProductsClient() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [report, setReport] = useState<ProductOperationalReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [rawCost, setRawCost] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsRes, dashboardRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch(
          `/api/operational-dashboard?date=${new Date().toISOString().slice(0, 10)}`,
          {
            cache: "no-store",
          },
        ),
      ]);

      if (!productsRes.ok)
        throw new Error(`Products request failed (${productsRes.status})`);
      if (!dashboardRes.ok)
        throw new Error(`Report request failed (${dashboardRes.status})`);

      const productsPayload = (await productsRes.json()) as {
        products: ProductRecord[];
      };
      const dashboardPayload = (await dashboardRes.json()) as {
        productReport: ProductOperationalReportRow[];
      };
      setProducts(productsPayload.products ?? []);
      setReport(dashboardPayload.productReport ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (images.length < 1 || images.length > MAX_IMAGES) {
      setError("Add between 1 and 5 product images.");
      return;
    }
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: Number(price),
          rawCost: Number(rawCost),
          salePrice: salePrice.trim() ? Number(salePrice) : null,
          description,
          active: true,
          images,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to create product");
      }

      setName("");
      setPrice("");
      setRawCost("");
      setSalePrice("");
      setDescription("");
      setImages([]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (arr.length === 0) return;

    const availableSlots = MAX_IMAGES - images.length;
    const selected = arr.slice(0, availableSlots);
    if (selected.length === 0) {
      setError(`Maximum ${MAX_IMAGES} images allowed.`);
      return;
    }

    if (!name.trim()) {
      setError(
        "Set product name first to upload images with naming convention.",
      );
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const productKey = `${name}-${Date.now()}`;
      const uploaded: UploadedImage[] = [];

      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index];
        setUploadProgress(
          `Uploading ${index + 1}/${selected.length}: ${file.name}`,
        );
        const dataUrl = await toDataUrl(file);

        const response = await fetch("/api/products/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataUrl,
            productName: name,
            productKey,
            imageIndex: images.length + index,
          }),
        });

        const payload = (await response.json()) as {
          image?: UploadedImage;
          error?: string;
        };
        if (!response.ok || !payload.image) {
          throw new Error(
            payload.error ?? `Image upload failed (${response.status})`,
          );
        }

        uploaded.push(payload.image);
      }

      setImages((prev) => [...prev, ...uploaded].slice(0, MAX_IMAGES));
      setUploadProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload images");
    } finally {
      setUploading(false);
    }
  };

  const sortedProducts = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA CATALOG
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Products</h1>
        </div>
        <Link
          href="/dashboard"
          className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
        >
          Back dashboard
        </Link>
      </header>

      {error ? (
        <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200">
          {error}
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-base font-semibold text-slate-100">Add product</h2>
        <form
          onSubmit={onSubmit}
          className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <input
            required
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Sale price"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <input
            required
            type="number"
            step="0.01"
            value={rawCost}
            onChange={(e) => setRawCost(e.target.value)}
            placeholder="Raw cost"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <input
            type="number"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            placeholder="Optional promo price"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="h-11 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 md:col-span-2"
          />
          <div className="md:col-span-2 lg:col-span-3">
            <ImageDrop
              disabled={uploading}
              onFiles={uploadFiles}
              helperText={
                uploading
                  ? uploadProgress
                  : `Drag/drop or select images (1 to ${MAX_IMAGES}).`
              }
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {images.map((image, index) => (
              <div
                key={image.publicId}
                className="rounded-lg border border-slate-800 bg-slate-950 p-2"
              >
                <Image
                  src={image.secureUrl}
                  alt={`Product image ${index + 1}`}
                  width={300}
                  height={180}
                  className="h-24 w-full rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImages((prev) =>
                      prev.filter((entry) => entry.publicId !== image.publicId),
                    )
                  }
                  className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button className="h-11 rounded-lg border border-slate-700 bg-slate-100 px-4 text-sm font-medium text-slate-900 hover:bg-slate-50">
            Create product
          </button>
        </form>
      </section>

      <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-base font-semibold text-slate-100">Product list</h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-300">Loading...</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-right">Imgs</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-2 py-2 text-right">Raw Cost</th>
                  <th className="px-2 py-2 text-right">Unit Profit</th>
                  <th className="px-2 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sortedProducts.map((product) => (
                  <tr key={product.id}>
                    <td className="px-2 py-2 text-slate-200">{product.name}</td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {product.images?.length ?? 0}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-100">
                      {toMoney(product.price)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {toMoney(product.rawCost)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-100">
                      {toMoney(product.price - product.rawCost)}
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {margin(product.price, product.rawCost).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-base font-semibold text-slate-100">
          Operational report by product (last 7 closes)
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Product</th>
                <th className="px-2 py-2 text-right">Sold Qty</th>
                <th className="px-2 py-2 text-right">Sales</th>
                <th className="px-2 py-2 text-right">Gross Profit</th>
                <th className="px-2 py-2 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {report.map((row) => (
                <tr key={row.productId}>
                  <td className="px-2 py-2 text-slate-200">{row.name}</td>
                  <td className="px-2 py-2 text-right text-slate-300">
                    {row.soldQty}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-100">
                    {toMoneyFromCents(row.soldSales)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-100">
                    {toMoney(row.estimatedGrossProfit)}
                  </td>
                  <td className="px-2 py-2 text-right text-slate-300">
                    {row.marginPercent.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function ImageDrop({
  onFiles,
  helperText,
  disabled,
}: {
  onFiles: (files: FileList | File[]) => Promise<void>;
  helperText: string;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  const onDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;
    await onFiles(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`rounded-xl border-2 border-dashed p-4 ${
        dragging
          ? "border-slate-400 bg-slate-800"
          : "border-slate-700 bg-slate-900"
      }`}
    >
      <p className="text-sm text-slate-200">ImageDrop</p>
      <p className="mt-1 text-xs text-slate-400">{helperText}</p>
      <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 hover:bg-slate-800">
        Select images
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={disabled}
          className="hidden"
          onChange={(event) => {
            const files = event.target.files;
            if (files && files.length > 0) void onFiles(files);
            event.currentTarget.value = "";
          }}
        />
      </label>
    </div>
  );
}
