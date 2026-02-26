"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CostControlPayload } from "@/types/cost-control";
import { AppCard } from "@/components/ui/card";

const unitOptions = [
  { value: "kg", label: "kg" },
  { value: "l", label: "l" },
  { value: "u", label: "u" },
] as const;

const teamDayOptions = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) =>
  value ? new Date(value).toISOString() : undefined;

function WizardInfo({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-[10px] font-semibold text-slate-200"
    >
      i
    </span>
  );
}

type RecipeSummaryItem = {
  id: string;
  rawMaterialName: string;
  qtyPerProduct: number;
  wastePct: number;
};

function RecipeSummaryPreview({
  items,
  className = "text-xs text-slate-400",
}: {
  items: RecipeSummaryItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return <p className={className}>No recipe items configured.</p>;
  }

  return (
    <p className={className}>
      {items
        .map(
          (item) =>
            `${item.rawMaterialName}: ${item.qtyPerProduct.toFixed(3)} (waste ${item.wastePct}%)`,
        )
        .join(" | ")}
    </p>
  );
}

export default function CostControlPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CostControlPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [isTeamWizardOpen, setIsTeamWizardOpen] = useState(false);
  const [teamWizardStep, setTeamWizardStep] = useState(0);

  const [newMaterial, setNewMaterial] = useState({
    name: "",
    unit: "u" as "kg" | "l" | "u",
    active: true,
  });
  const [newPurchase, setNewPurchase] = useState({
    rawMaterialId: "",
    purchasedAt: "",
    quantity: "",
    totalCostCents: "",
    supplier: "",
    notes: "",
  });
  const [newRecipe, setNewRecipe] = useState({
    productId: "",
    rawMaterialId: "",
    qtyPerProduct: "",
    wastePct: "0",
  });

  const [materialEdits, setMaterialEdits] = useState<
    Record<string, { name: string; unit: "kg" | "l" | "u"; active: boolean }>
  >({});
  const [purchaseEdits, setPurchaseEdits] = useState<
    Record<
      string,
      {
        rawMaterialId: string;
        purchasedAt: string;
        quantity: string;
        totalCostCents: string;
        supplier: string;
        notes: string;
      }
    >
  >({});
  const [recipeEdits, setRecipeEdits] = useState<
    Record<
      string,
      {
        productId: string;
        rawMaterialId: string;
        qtyPerProduct: string;
        wastePct: string;
      }
    >
  >({});
  const [selectedBomProductId, setSelectedBomProductId] = useState<
    string | null
  >(null);
  const [editingRecipeItemId, setEditingRecipeItemId] = useState<string | null>(
    null,
  );
  const [wizardProductName, setWizardProductName] = useState("");
  const [wizardProductPrice, setWizardProductPrice] = useState("100");
  const [wizardProductRawCost, setWizardProductRawCost] = useState("50");
  const [wizardProductId, setWizardProductId] = useState<string | null>(null);
  const [wizardRecipeLines, setWizardRecipeLines] = useState<
    Array<{ rawMaterialId: string; qtyPerProduct: string; wastePct: string }>
  >([{ rawMaterialId: "", qtyPerProduct: "0.100", wastePct: "0" }]);
  const [teamFullName, setTeamFullName] = useState("");
  const [teamRole, setTeamRole] = useState<
    "COOK" | "ASSISTANT" | "DELIVERY" | "ADMIN"
  >("COOK");
  const [teamActive, setTeamActive] = useState(true);
  const [teamPhoneOrUsername, setTeamPhoneOrUsername] = useState("");
  const [teamPin, setTeamPin] = useState("");
  const [teamPassword, setTeamPassword] = useState("");
  const [teamExistingUserId, setTeamExistingUserId] = useState("");
  const [teamCreateNewUser, setTeamCreateNewUser] = useState(true);
  const [teamExistingUserSearch, setTeamExistingUserSearch] = useState("");
  const [teamSystemUsers, setTeamSystemUsers] = useState<
    Array<{ id: string; name: string; phone?: string }>
  >([]);
  const [teamDays, setTeamDays] = useState<string[]>([]);
  const [teamShiftStart, setTeamShiftStart] = useState("");
  const [teamShiftEnd, setTeamShiftEnd] = useState("");
  const [teamBreakMinutes, setTeamBreakMinutes] = useState("");

  const resetWizardState = () => {
    setIsWizardOpen(false);
    setWizardStep(0);
    setWizardProductName("");
    setWizardProductPrice("100");
    setWizardProductRawCost("50");
    setWizardProductId(null);
    setWizardRecipeLines([
      { rawMaterialId: "", qtyPerProduct: "0.100", wastePct: "0" },
    ]);
  };

  const resetTeamWizardState = () => {
    setIsTeamWizardOpen(false);
    setTeamWizardStep(0);
    setTeamFullName("");
    setTeamRole("COOK");
    setTeamActive(true);
    setTeamPhoneOrUsername("");
    setTeamPin("");
    setTeamPassword("");
    setTeamExistingUserId("");
    setTeamCreateNewUser(true);
    setTeamExistingUserSearch("");
    setTeamDays([]);
    setTeamShiftStart("");
    setTeamShiftEnd("");
    setTeamBreakMinutes("");
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cost-control", { cache: "no-store" });
      if (!response.ok) throw new Error(`Failed to load (${response.status})`);
      const payload = (await response.json()) as CostControlPayload;
      setData(payload);

      setMaterialEdits(
        Object.fromEntries(
          payload.rawMaterials.map((item) => [
            item.id,
            { name: item.name, unit: item.unit, active: item.active },
          ]),
        ),
      );
      setPurchaseEdits(
        Object.fromEntries(
          payload.purchases.map((item) => [
            item.id,
            {
              rawMaterialId: item.rawMaterial?.id ?? "",
              purchasedAt: toLocalInput(item.purchasedAt),
              quantity: String(item.quantity ?? 0),
              totalCostCents: String(item.totalCostCents ?? 0),
              supplier: item.supplier ?? "",
              notes: item.notes ?? "",
            },
          ]),
        ),
      );
      setRecipeEdits(
        Object.fromEntries(
          payload.recipeItems.map((item) => [
            item.id,
            {
              productId: item.product?.id ?? "",
              rawMaterialId: item.rawMaterial?.id ?? "",
              qtyPerProduct: String(item.qtyPerProduct ?? 0),
              wastePct: String(item.wastePct ?? 0),
            },
          ]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const openMenu = () => setIsContextMenuOpen(true);
    window.addEventListener("mojarreria:open-costs-menu", openMenu);
    return () =>
      window.removeEventListener("mojarreria:open-costs-menu", openMenu);
  }, []);

  useEffect(() => {
    if (searchParams.get("openMenu") !== "1") return;
    setIsContextMenuOpen(true);
    router.replace(pathname);
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!isTeamWizardOpen) return;
    let cancelled = false;

    const loadSystemUsers = async () => {
      try {
        const response = await fetch("/api/team-control", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          employees?: Array<{ id: string; name: string; phone?: string }>;
        };
        if (!cancelled) setTeamSystemUsers(payload.employees ?? []);
      } catch {
        if (!cancelled) setTeamSystemUsers([]);
      }
    };

    void loadSystemUsers();
    return () => {
      cancelled = true;
    };
  }, [isTeamWizardOpen]);

  const materialOptions = useMemo(() => data?.rawMaterials ?? [], [data]);
  const productOptions = useMemo(() => data?.products ?? [], [data]);
  const isDevEnv = process.env.NODE_ENV === "development";
  const hasProducts = productOptions.length > 0;
  const hasRecipes = (data?.recipeItems?.length ?? 0) > 0;
  const shouldShowCostsHelp = !hasProducts || !hasRecipes || isDevEnv;
  const selectedRecipeItems = useMemo(() => {
    const all = data?.recipeItems ?? [];
    if (!selectedBomProductId) return [];
    return all.filter((item) => item.product?.id === selectedBomProductId);
  }, [data, selectedBomProductId]);
  const wizardTargetProductId =
    wizardProductId ?? selectedBomProductId ?? productOptions[0]?.id ?? "";
  const wizardTargetProductName =
    productOptions.find((product) => product.id === wizardTargetProductId)
      ?.name ?? "selected product";
  const wizardRecipeCount = (data?.recipeItems ?? []).filter(
    (item) => item.product?.id === wizardTargetProductId,
  ).length;
  const recipeByProduct = useMemo(() => {
    const grouped = new Map<
      string,
      { productId: string; productName: string; items: RecipeSummaryItem[] }
    >();

    for (const row of data?.recipeItems ?? []) {
      const productId = row.product?.id ?? "unknown";
      const productName = row.product?.name ?? "Unknown product";
      const current = grouped.get(productId) ?? {
        productId,
        productName,
        items: [],
      };
      current.items.push({
        id: row.id,
        rawMaterialName: row.rawMaterial?.name ?? "Unknown material",
        qtyPerProduct: row.qtyPerProduct,
        wastePct: row.wastePct,
      });
      grouped.set(productId, current);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName),
    );
  }, [data]);
  const wizardRecipeSummaryItems =
    recipeByProduct.find((group) => group.productId === wizardTargetProductId)
      ?.items ?? [];

  const runMutation = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/cost-control", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Request failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const finishTeamSetupWizard = async () => {
    if (
      !isTeamStep2Complete ||
      !isTeamStep3Complete ||
      !isTeamStep4Complete ||
      !isTeamStep5Complete
    )
      return;

    setSaving(true);
    setError(null);
    try {
      let userId = teamExistingUserId;

      if (teamCreateNewUser) {
        const createEmployeeResponse = await fetch("/api/team-control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: "employee",
            name: teamFullName.trim(),
            phone: teamPhoneOrUsername.trim(),
            role: teamRole,
            active: teamActive,
          }),
        });
        const createEmployeePayload = (await createEmployeeResponse.json()) as {
          error?: string;
          id?: string;
        };
        if (!createEmployeeResponse.ok || !createEmployeePayload.id) {
          throw new Error(
            createEmployeePayload.error ??
              "Failed to create employee from wizard",
          );
        }
        userId = createEmployeePayload.id;
      }

      if (!userId) throw new Error("Missing user assignment for team setup.");

      const currentStateResponse = await fetch("/api/team-control", {
        cache: "no-store",
      });
      const currentStatePayload = (await currentStateResponse.json()) as {
        error?: string;
        accesses?: Array<{ id: string; user: { id: string } | null }>;
        schedules?: Array<{ id: string; user: { id: string } | null }>;
      };
      if (!currentStateResponse.ok) {
        throw new Error(
          currentStatePayload.error ??
            "Failed to load team state before saving.",
        );
      }

      const existingAccess = (currentStatePayload.accesses ?? []).find(
        (entry) => entry.user?.id === userId,
      );
      const accessMethod = existingAccess ? "PATCH" : "POST";
      const accessBody: Record<string, unknown> = {
        entity: "access",
        userId,
        email: teamPhoneOrUsername.trim(),
        pin: teamPin.trim(),
        password: teamPassword.trim() || "changeme",
      };
      if (existingAccess) accessBody.id = existingAccess.id;

      const saveAccessResponse = await fetch("/api/team-control", {
        method: accessMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessBody),
      });
      const saveAccessPayload = (await saveAccessResponse.json()) as {
        error?: string;
      };
      if (!saveAccessResponse.ok) {
        throw new Error(
          saveAccessPayload.error ?? "Failed to save access from wizard",
        );
      }

      const existingSchedule = (currentStatePayload.schedules ?? []).find(
        (entry) => entry.user?.id === userId,
      );
      const scheduleMethod = existingSchedule ? "PATCH" : "POST";
      const scheduleBody: Record<string, unknown> = {
        entity: "schedule",
        userId,
        days: teamDays,
        shiftStart: teamShiftStart,
        shiftEnd: teamShiftEnd,
        breakMinutes: Number(teamBreakMinutes || 0),
        active: true,
      };
      if (existingSchedule) scheduleBody.id = existingSchedule.id;

      const saveScheduleResponse = await fetch("/api/team-control", {
        method: scheduleMethod,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduleBody),
      });
      const saveSchedulePayload = (await saveScheduleResponse.json()) as {
        error?: string;
      };
      if (!saveScheduleResponse.ok) {
        throw new Error(
          saveSchedulePayload.error ?? "Failed to save schedule from wizard",
        );
      }

      await load();
      resetTeamWizardState();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to finish team setup.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createWizardProduct = async () => {
    if (!wizardProductName.trim()) {
      setError("Product name is required for wizard.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: wizardProductName.trim(),
          price: Number(wizardProductPrice || 0),
          rawCost: Number(wizardProductRawCost || 0),
          salePrice: null,
          description: "Created from cost tutorial wizard.",
          active: true,
          images: [
            {
              publicId: `wizard/products/${Date.now()}-${wizardProductName
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`,
              secureUrl:
                "https://res.cloudinary.com/demo/image/upload/v1/samples/food/fish-vegetables.jpg",
            },
          ],
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        product?: { id: string };
      };
      if (!response.ok || !payload.product?.id) {
        throw new Error(payload.error ?? "Could not create product in wizard");
      }
      setWizardProductId(payload.product.id);
      setSelectedBomProductId(payload.product.id);
      setNewRecipe((prev) => ({ ...prev, productId: payload.product!.id }));
      await load();
      setWizardStep(2);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Wizard product creation failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const createWizardRecipeLines = async () => {
    if (!wizardTargetProductId) {
      setError("Select a product first.");
      return;
    }

    const validLines = wizardRecipeLines.filter((line) => line.rawMaterialId);
    if (validLines.length === 0) {
      setError("Add at least one raw material line.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      for (const line of validLines) {
        const response = await fetch("/api/cost-control", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entity: "recipe",
            productId: wizardTargetProductId,
            rawMaterialId: line.rawMaterialId,
            qtyPerProduct: Number(line.qtyPerProduct || 0),
            wastePct: Number(line.wastePct || 0),
          }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok)
          throw new Error(payload.error ?? "Failed creating recipe line");
      }

      await load();
      setWizardRecipeLines([
        { rawMaterialId: "", qtyPerProduct: "0.100", wastePct: "0" },
      ]);
      setWizardStep(4);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed creating recipe lines",
      );
    } finally {
      setSaving(false);
    }
  };

  const isWizardLineComplete = (line: {
    rawMaterialId: string;
    qtyPerProduct: string;
    wastePct: string;
  }) =>
    Boolean(line.rawMaterialId) &&
    line.qtyPerProduct.trim() !== "" &&
    line.wastePct.trim() !== "";

  const isStep1Complete =
    wizardProductName.trim() !== "" && wizardProductPrice.trim() !== "";
  const isStep3Complete =
    wizardRecipeLines.length > 0 &&
    wizardRecipeLines.every((line) => isWizardLineComplete(line));
  const isStep4Complete = wizardRecipeCount > 0;
  const isTeamStep2Complete = teamFullName.trim() !== "";
  const isTeamStep3Complete =
    teamPhoneOrUsername.trim() !== "" && /^\d{4}$/.test(teamPin);
  const isTeamStep4Complete = teamCreateNewUser || teamExistingUserId !== "";
  const isTeamStep5Complete =
    teamDays.length > 0 &&
    teamShiftStart.trim() !== "" &&
    teamShiftEnd.trim() !== "";

  const accessModeSummary = useMemo(() => {
    if (teamPassword.trim()) return "PIN enabled + Password enabled";
    if (teamPin.trim()) return "PIN enabled";
    return "No access yet";
  }, [teamPassword, teamPin]);

  const scheduleSummary = useMemo(() => {
    if (!teamDays.length || !teamShiftStart || !teamShiftEnd)
      return "No schedule yet";
    const first = teamDays[0];
    const last = teamDays[teamDays.length - 1];
    const days = teamDays.length > 1 ? `${first}-${last}` : first;
    return `${days}, ${teamShiftStart}-${teamShiftEnd}`;
  }, [teamDays, teamShiftStart, teamShiftEnd]);
  const teamWizardMissingNote = useMemo(() => {
    if (teamWizardStep === 1 && !isTeamStep2Complete)
      return "Missing: full name is required.";
    if (teamWizardStep === 2 && !isTeamStep3Complete)
      return "Missing: phone/username and a 4-digit PIN are required.";
    if (teamWizardStep === 3 && !isTeamStep4Complete)
      return "Missing: link to an existing user or select create new user.";
    if (teamWizardStep === 4 && !isTeamStep5Complete)
      return "Missing: at least one working day, shift start, and shift end.";
    return "";
  }, [
    teamWizardStep,
    isTeamStep2Complete,
    isTeamStep3Complete,
    isTeamStep4Complete,
    isTeamStep5Complete,
  ]);
  const filteredTeamSystemUsers = useMemo(() => {
    const query = teamExistingUserSearch.trim().toLowerCase();
    if (!query) return teamSystemUsers;
    return teamSystemUsers.filter((user) => {
      const haystack = `${user.name} ${user.phone ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [teamExistingUserSearch, teamSystemUsers]);

  const wizardMissingNote = useMemo(() => {
    if (wizardStep === 1 && !isStep1Complete) {
      return "Missing: product name and sale price are required.";
    }

    if (wizardStep === 3 && !isStep3Complete) {
      return "Missing: complete all ingredient lines before continuing.";
    }

    if (wizardStep === 4 && !isStep4Complete) {
      return "Missing: add at least one ingredient to continue.";
    }

    return "";
  }, [wizardStep, isStep1Complete, isStep3Complete, isStep4Complete]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            MOJARRERIA OPERATIONS
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">Cost Control</h1>
          <p className="text-sm text-slate-300">
            Manage raw materials, purchases (last price), and product recipes
            from web.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="h-10 rounded-lg border border-slate-700 bg-slate-800 px-3 text-sm text-slate-100 hover:bg-slate-700 inline-flex items-center"
        >
          Back dashboard
        </Link>
      </header>

      {isContextMenuOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/70">
          <div className="ml-auto h-full w-full max-w-sm border-l border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-50">
                Costs Menu
              </h2>
              <button
                type="button"
                onClick={() => setIsContextMenuOpen(false)}
                className="h-9 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <Link
                href="/products"
                onClick={() => setIsContextMenuOpen(false)}
                className="block rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
              >
                Products
              </Link>
              <button
                type="button"
                onClick={() => {
                  setIsContextMenuOpen(false);
                  const el = document.getElementById(
                    "cost-control-card-recipe-items",
                  );
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
              >
                Recipes
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsContextMenuOpen(false);
                  resetTeamWizardState();
                  setIsTeamWizardOpen(true);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-sm text-slate-100 hover:bg-slate-800"
              >
                Add a employee
              </button>
              {shouldShowCostsHelp ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsContextMenuOpen(false);
                    resetWizardState();
                    setIsWizardOpen(true);
                  }}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-left text-sm text-slate-50 hover:bg-slate-700"
                >
                  What costs are about?
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isWizardOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md p-4 md:p-8">
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-slate-900 px-6 py-5 md:px-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-50">
                Configure Product Costs
              </h2>
              <button
                type="button"
                onClick={resetWizardState}
                className="h-9 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Step {wizardStep + 1} of 6
            </p>

            {wizardStep === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  To calculate real profit, each product needs a recipe. A
                  recipe tells the system which ingredients are used and how
                  much is consumed per unit sold.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Next: Add product
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Product name
                    <WizardInfo text="Name used in sales and recipe mapping." />
                  </span>
                  <input
                    value={wizardProductName}
                    onChange={(e) => setWizardProductName(e.target.value)}
                    placeholder="Product name"
                    className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Sale price
                    <WizardInfo text="Public selling price for one unit of this product." />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={wizardProductPrice}
                    onChange={(e) => setWizardProductPrice(e.target.value)}
                    placeholder="Sale price"
                    className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Raw cost
                    <WizardInfo text="Optional quick estimate. Final cost will be calculated from the recipe." />
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={wizardProductRawCost}
                    onChange={(e) => setWizardProductRawCost(e.target.value)}
                    placeholder="Raw cost"
                    className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    onClick={createWizardProduct}
                    disabled={saving || !isStep1Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Create product and continue
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  A recipe defines what raw materials a product consumes. One
                  product can have multiple recipe items.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Next: Add recipe item
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="mt-3 space-y-4">
                <p className="md:col-span-3 text-xs text-slate-400 inline-flex items-center gap-1">
                  Product: {wizardTargetProductName}
                  <WizardInfo text="You are defining the ingredients used to prepare this product." />
                </p>
                <div className="space-y-2">
                  {wizardRecipeLines.map((line, index) => {
                    const canAddAnother = isWizardLineComplete(line);
                    return (
                      <div
                        key={`wizard-step3-line-${index}`}
                        className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto]"
                      >
                        <label className="flex flex-col gap-1 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            Raw material
                            <WizardInfo text="Ingredient consumed when this product is sold." />
                          </span>
                          <select
                            value={line.rawMaterialId}
                            onChange={(e) =>
                              setWizardRecipeLines((prev) =>
                                prev.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        rawMaterialId: e.target.value,
                                      }
                                    : entry,
                                ),
                              )
                            }
                            className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                          >
                            <option value="">Select raw material</option>
                            {materialOptions.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            Qty per product
                            <WizardInfo text="Amount of this ingredient used per unit sold. Make sure units match the ingredient." />
                          </span>
                          <input
                            type="number"
                            step="0.001"
                            value={line.qtyPerProduct}
                            onChange={(e) =>
                              setWizardRecipeLines((prev) =>
                                prev.map((entry, i) =>
                                  i === index
                                    ? {
                                        ...entry,
                                        qtyPerProduct: e.target.value,
                                      }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Qty per product"
                            className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1">
                            Waste %
                            <WizardInfo text="Estimated percentage of extra material lost or discarded." />
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={line.wastePct}
                            onChange={(e) =>
                              setWizardRecipeLines((prev) =>
                                prev.map((entry, i) =>
                                  i === index
                                    ? { ...entry, wastePct: e.target.value }
                                    : entry,
                                ),
                              )
                            }
                            placeholder="Waste %"
                            className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                          />
                        </label>
                        <div className="flex items-end gap-1">
                          {index === wizardRecipeLines.length - 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setWizardRecipeLines((prev) => [
                                  ...prev,
                                  {
                                    rawMaterialId: "",
                                    qtyPerProduct: "0.100",
                                    wastePct: "0",
                                  },
                                ])
                              }
                              disabled={!canAddAnother}
                              className="h-10 w-10 rounded border border-slate-700 bg-slate-800 text-lg text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              title={
                                canAddAnother
                                  ? "Add another ingredient"
                                  : "Complete this line before adding another"
                              }
                            >
                              +
                            </button>
                          ) : null}
                          {wizardRecipeLines.length > 1 ? (
                            <button
                              type="button"
                              onClick={() =>
                                setWizardRecipeLines((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                              className="h-10 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-slate-200 hover:bg-slate-800"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={createWizardRecipeLines}
                    disabled={saving || !isStep3Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Save recipe and continue
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  Recipe created for{" "}
                  <span className="font-medium">{wizardTargetProductName}</span>
                  .
                </p>
                <p className="text-sm text-slate-400">
                  Total ingredients configured: {wizardRecipeCount}
                </p>
                <RecipeSummaryPreview
                  items={wizardRecipeSummaryItems}
                  className="text-sm text-slate-400"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setWizardStep(5)}
                    disabled={!isStep4Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Continue to summary
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 5 ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-300">Summary</p>
                <p className="text-sm text-slate-400">
                  Product: {wizardTargetProductName}
                </p>
                <p className="text-sm text-slate-400">
                  Ingredients configured: {wizardRecipeCount}
                </p>
                <RecipeSummaryPreview
                  items={wizardRecipeSummaryItems}
                  className="text-sm text-slate-400"
                />
                <p className="text-sm text-slate-400">
                  Once ingredient purchase prices are registered, DailyClose
                  will automatically calculate product cost and gross margin.
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={resetWizardState}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Close tutorial
                  </button>
                </div>
              </div>
            ) : null}

            {wizardMissingNote ? (
              <div className="mt-3 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                Note: {wizardMissingNote}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isTeamWizardOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-md p-4 md:p-8">
          <div className="mx-auto max-w-2xl rounded-xl border border-slate-700 bg-slate-900 px-6 py-5 md:px-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-50">
                Team Setup
              </h2>
              <button
                type="button"
                onClick={resetTeamWizardState}
                className="h-9 rounded border border-slate-700 bg-slate-800 px-2 text-xs text-slate-200 hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <p className="mt-2 text-xs text-slate-400">
              Step {teamWizardStep + 1} of 7
            </p>

            {teamWizardStep === 0 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  Let’s add your employees and give each person access with the
                  right role. You’ll also set their schedule so the system knows
                  who should be working and when.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTeamWizardStep(1)}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Next: Add employee
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 1 ? (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Full name
                    <WizardInfo text="Employee name as it will appear in reports and the dashboard." />
                  </span>
                  <input
                    value={teamFullName}
                    onChange={(e) => setTeamFullName(e.target.value)}
                    className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Role
                    <WizardInfo text="Select what this person does. This controls what they can see and do." />
                  </span>
                  <select
                    value={teamRole}
                    onChange={(e) =>
                      setTeamRole(
                        e.target.value as
                          | "COOK"
                          | "ASSISTANT"
                          | "DELIVERY"
                          | "ADMIN",
                      )
                    }
                    className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                  >
                    <option value="COOK">Cook</option>
                    <option value="ASSISTANT">Assistant</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    Active
                    <WizardInfo text="Turn off if the employee is no longer working with you." />
                  </span>
                  <div className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={teamActive}
                      onChange={(e) => setTeamActive(e.target.checked)}
                    />
                  </div>
                </label>
                <div className="md:col-span-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTeamWizardStep(2)}
                    disabled={!isTeamStep2Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Create employee and continue
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 2 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  This employee can have a login to use the system. You can skip
                  this step and enable access later.
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Phone / Username
                      <WizardInfo text="Used to identify the employee when logging in. Prefer a phone number." />
                    </span>
                    <input
                      value={teamPhoneOrUsername}
                      onChange={(e) => setTeamPhoneOrUsername(e.target.value)}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      PIN (4 digits)
                      <WizardInfo text="Simple access code for tablet and quick actions." />
                    </span>
                    <input
                      value={teamPin}
                      onChange={(e) =>
                        setTeamPin(
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Password (optional)
                      <WizardInfo text="Use a password if this employee will log in from their own device." />
                    </span>
                    <input
                      type="password"
                      value={teamPassword}
                      onChange={(e) => setTeamPassword(e.target.value)}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTeamWizardStep(3)}
                    disabled={!isTeamStep3Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Save access and continue
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 3 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  Link this employee to a system user record. This is required
                  for tracking actions (who closed, who edited, who created
                  orders).
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Link to existing user
                      <WizardInfo text="Select an existing user if already created." />
                    </span>
                    <input
                      value={teamExistingUserSearch}
                      onChange={(e) =>
                        setTeamExistingUserSearch(e.target.value)
                      }
                      placeholder="Search by name or phone"
                      disabled={teamCreateNewUser}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                    <select
                      value={teamExistingUserId}
                      onChange={(e) => setTeamExistingUserId(e.target.value)}
                      disabled={teamCreateNewUser}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 disabled:opacity-60"
                    >
                      <option value="">Select existing user</option>
                      {filteredTeamSystemUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.phone ? `(${user.phone})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Or create new user
                      <WizardInfo text="Create a new user record for this employee if none exists." />
                    </span>
                    <div className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={teamCreateNewUser}
                        onChange={(e) => {
                          setTeamCreateNewUser(e.target.checked);
                          if (e.target.checked) {
                            setTeamExistingUserId("");
                            setTeamExistingUserSearch("");
                          }
                        }}
                      />
                    </div>
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTeamWizardStep(4)}
                    disabled={!isTeamStep4Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Assign user and continue
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 4 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  Set when this employee is expected to work. This helps the
                  system show “who should be on shift” and supports reminders
                  and accountability.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-300 md:col-span-2">
                    <span className="inline-flex items-center gap-1">
                      Days of week
                      <WizardInfo text="Select working days." />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {teamDayOptions.map((day) => {
                        const selected = teamDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setTeamDays((prev) =>
                                selected
                                  ? prev.filter((entry) => entry !== day)
                                  : [...prev, day],
                              )
                            }
                            className={`h-8 rounded border px-2 text-xs ${
                              selected
                                ? "border-slate-500 bg-slate-700 text-slate-50"
                                : "border-slate-700 bg-slate-950 text-slate-300"
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Shift start time
                      <WizardInfo text="Example: 10:00" />
                    </span>
                    <input
                      type="time"
                      value={teamShiftStart}
                      onChange={(e) => setTeamShiftStart(e.target.value)}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Shift end time
                      <WizardInfo text="Example: 18:00" />
                    </span>
                    <input
                      type="time"
                      value={teamShiftEnd}
                      onChange={(e) => setTeamShiftEnd(e.target.value)}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      Break (optional)
                      <WizardInfo text="If needed, set break duration in minutes." />
                    </span>
                    <input
                      type="number"
                      value={teamBreakMinutes}
                      onChange={(e) => setTeamBreakMinutes(e.target.value)}
                      className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setTeamWizardStep(5)}
                    disabled={!isTeamStep5Complete}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Save schedule and continue
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 5 ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-slate-300">Review</p>
                <p className="text-sm text-slate-400">
                  Employee: {teamFullName || "-"}
                </p>
                <p className="text-sm text-slate-400">Role: {teamRole}</p>
                <p className="text-sm text-slate-400">
                  Access: {accessModeSummary}
                </p>
                <p className="text-sm text-slate-400">
                  Schedule: {scheduleSummary}
                </p>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={finishTeamSetupWizard}
                    disabled={saving}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Finish setup
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardStep === 6 ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-300">
                  You can now track actions by employee and know who is expected
                  to be working each day. Next, you can assign responsibilities
                  (close tasks, prep tasks, WhatsApp handling).
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={resetTeamWizardState}
                    className="h-10 rounded border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Close wizard
                  </button>
                </div>
              </div>
            ) : null}

            {teamWizardMissingNote ? (
              <div className="mt-3 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                Note: {teamWizardMissingNote}
              </div>
            ) : null}
            {error ? (
              <div className="mt-3 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
                Error: {error}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <AppCard
          id="cost-control-card-error"
          as="section"
          className="mb-4 border-slate-700 text-sm text-slate-200"
        >
          {error}
        </AppCard>
      ) : null}
      {loading ? (
        <AppCard
          id="cost-control-card-loading"
          as="section"
          className="mb-4 text-sm text-slate-300"
        >
          Loading...
        </AppCard>
      ) : null}

      <section className="space-y-5">
        <AppCard id="cost-control-card-raw-materials">
          <h2 className="text-base font-semibold text-slate-100">
            Raw materials
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-4">
            <input
              value={newMaterial.name}
              onChange={(e) =>
                setNewMaterial((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Name"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <select
              value={newMaterial.unit}
              onChange={(e) =>
                setNewMaterial((prev) => ({
                  ...prev,
                  unit: e.target.value as "kg" | "l" | "u",
                }))
              }
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              {unitOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={newMaterial.active}
                onChange={(e) =>
                  setNewMaterial((prev) => ({
                    ...prev,
                    active: e.target.checked,
                  }))
                }
              />
              Active
            </label>
            <button
              onClick={() =>
                runMutation("POST", {
                  entity: "rawMaterial",
                  ...newMaterial,
                }).then(() =>
                  setNewMaterial({ name: "", unit: "u", active: true }),
                )
              }
              disabled={saving || !newMaterial.name.trim()}
              className="h-10 rounded-lg border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
            >
              Add raw material
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Name</th>
                  <th className="px-2 py-2 text-left">Unit</th>
                  <th className="px-2 py-2 text-left">Active</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.rawMaterials ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <input
                        value={materialEdits[item.id]?.name ?? ""}
                        onChange={(e) =>
                          setMaterialEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              name: e.target.value,
                            },
                          }))
                        }
                        className="h-9 w-full rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={materialEdits[item.id]?.unit ?? "u"}
                        onChange={(e) =>
                          setMaterialEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              unit: e.target.value as "kg" | "l" | "u",
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      >
                        {unitOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(materialEdits[item.id]?.active)}
                        onChange={(e) =>
                          setMaterialEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              active: e.target.checked,
                            },
                          }))
                        }
                      />
                    </td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() =>
                          runMutation("PATCH", {
                            entity: "rawMaterial",
                            id: item.id,
                            ...materialEdits[item.id],
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          runMutation("DELETE", {
                            entity: "rawMaterial",
                            id: item.id,
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard id="cost-control-card-purchases">
          <h2 className="text-base font-semibold text-slate-100">
            Raw material purchases (last price input)
          </h2>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <select
              value={newPurchase.rawMaterialId}
              onChange={(e) =>
                setNewPurchase((prev) => ({
                  ...prev,
                  rawMaterialId: e.target.value,
                }))
              }
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            >
              <option value="">Select material</option>
              {materialOptions.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.unit})
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={newPurchase.purchasedAt}
              onChange={(e) =>
                setNewPurchase((prev) => ({
                  ...prev,
                  purchasedAt: e.target.value,
                }))
              }
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              type="number"
              step="0.001"
              value={newPurchase.quantity}
              onChange={(e) =>
                setNewPurchase((prev) => ({
                  ...prev,
                  quantity: e.target.value,
                }))
              }
              placeholder="Quantity"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              type="number"
              value={newPurchase.totalCostCents}
              onChange={(e) =>
                setNewPurchase((prev) => ({
                  ...prev,
                  totalCostCents: e.target.value,
                }))
              }
              placeholder="Total cost (cents)"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              value={newPurchase.supplier}
              onChange={(e) =>
                setNewPurchase((prev) => ({
                  ...prev,
                  supplier: e.target.value,
                }))
              }
              placeholder="Supplier"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <input
              value={newPurchase.notes}
              onChange={(e) =>
                setNewPurchase((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="Notes"
              className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
            />
            <button
              onClick={() =>
                runMutation("POST", {
                  entity: "purchase",
                  rawMaterialId: newPurchase.rawMaterialId,
                  purchasedAt: fromLocalInput(newPurchase.purchasedAt),
                  quantity: Number(newPurchase.quantity || 0),
                  totalCostCents: Number(newPurchase.totalCostCents || 0),
                  supplier: newPurchase.supplier,
                  notes: newPurchase.notes,
                }).then(() =>
                  setNewPurchase({
                    rawMaterialId: "",
                    purchasedAt: "",
                    quantity: "",
                    totalCostCents: "",
                    supplier: "",
                    notes: "",
                  }),
                )
              }
              disabled={saving || !newPurchase.rawMaterialId}
              className="h-10 rounded-lg border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60 md:col-span-3"
            >
              Add purchase
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Material</th>
                  <th className="px-2 py-2 text-left">Purchased At</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Total Cost</th>
                  <th className="px-2 py-2 text-right">Unit Cost</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(data?.purchases ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-2">
                      <select
                        value={purchaseEdits[item.id]?.rawMaterialId ?? ""}
                        onChange={(e) =>
                          setPurchaseEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              rawMaterialId: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      >
                        <option value="">Select</option>
                        {materialOptions.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="datetime-local"
                        value={purchaseEdits[item.id]?.purchasedAt ?? ""}
                        onChange={(e) =>
                          setPurchaseEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              purchasedAt: e.target.value,
                            },
                          }))
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.001"
                        value={purchaseEdits[item.id]?.quantity ?? ""}
                        onChange={(e) =>
                          setPurchaseEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              quantity: e.target.value,
                            },
                          }))
                        }
                        className="h-9 w-24 rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={purchaseEdits[item.id]?.totalCostCents ?? ""}
                        onChange={(e) =>
                          setPurchaseEdits((prev) => ({
                            ...prev,
                            [item.id]: {
                              ...prev[item.id],
                              totalCostCents: e.target.value,
                            },
                          }))
                        }
                        className="h-9 w-28 rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100"
                      />
                    </td>
                    <td className="px-2 py-2 text-right text-slate-300">
                      {item.unitCostCents}
                    </td>
                    <td className="px-2 py-2 text-right space-x-2">
                      <button
                        onClick={() =>
                          runMutation("PATCH", {
                            entity: "purchase",
                            id: item.id,
                            rawMaterialId:
                              purchaseEdits[item.id]?.rawMaterialId,
                            purchasedAt: fromLocalInput(
                              purchaseEdits[item.id]?.purchasedAt ?? "",
                            ),
                            quantity: Number(
                              purchaseEdits[item.id]?.quantity ?? 0,
                            ),
                            totalCostCents: Number(
                              purchaseEdits[item.id]?.totalCostCents ?? 0,
                            ),
                            supplier: purchaseEdits[item.id]?.supplier ?? "",
                            notes: purchaseEdits[item.id]?.notes ?? "",
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                      >
                        Save
                      </button>
                      <button
                        onClick={() =>
                          runMutation("DELETE", {
                            entity: "purchase",
                            id: item.id,
                          })
                        }
                        className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AppCard>

        <AppCard id="cost-control-card-recipe-items">
          <h2 className="text-base font-semibold text-slate-100">
            Product recipe items (BOM)
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            A product can have multiple recipe items. Only duplicate pairs (same
            product + same raw material) are blocked.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {recipeByProduct.length === 0 ? (
              <p className="text-sm text-slate-400">No recipe items yet.</p>
            ) : (
              recipeByProduct.map((group) => (
                <div
                  id={`cost-control-card-bom-product-${group.productId}`}
                  key={group.productId}
                  className={`rounded-lg border bg-slate-950 p-3 ${
                    selectedBomProductId === group.productId
                      ? "border-slate-500"
                      : "border-slate-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      const nextId =
                        selectedBomProductId === group.productId
                          ? null
                          : group.productId;
                      setSelectedBomProductId(nextId);
                      setEditingRecipeItemId(null);
                      setNewRecipe((prev) => ({
                        ...prev,
                        productId: nextId ?? "",
                      }));
                    }}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <p className="text-sm font-medium text-slate-100">
                      {group.productName} ({group.items.length})
                    </p>
                    <span className="text-xs text-slate-400">
                      {selectedBomProductId === group.productId
                        ? "Hide items"
                        : "Show items"}
                    </span>
                  </button>

                  {selectedBomProductId === group.productId ? (
                    <div className="mt-2">
                      <RecipeSummaryPreview items={group.items} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span>Editing scope:</span>
            {selectedBomProductId ? (
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1">
                {productOptions.find(
                  (product) => product.id === selectedBomProductId,
                )?.name ?? selectedBomProductId}
              </span>
            ) : (
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1">
                Select a product card above
              </span>
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">Raw Material</th>
                  <th className="px-2 py-2 text-right">Qty/Product</th>
                  <th className="px-2 py-2 text-right">Waste %</th>
                  <th className="px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {!selectedBomProductId ? (
                  <tr>
                    <td
                      className="px-2 py-6 text-sm text-slate-400"
                      colSpan={5}
                    >
                      Select a product card to view and edit recipe items.
                    </td>
                  </tr>
                ) : selectedRecipeItems.length === 0 ? (
                  <tr>
                    <td
                      className="px-2 py-6 text-sm text-slate-400"
                      colSpan={5}
                    >
                      No recipe items for selected product.
                    </td>
                  </tr>
                ) : (
                  selectedRecipeItems.map((item) => {
                    const isEditing = editingRecipeItemId === item.id;
                    return (
                      <tr key={item.id}>
                        <td className="px-2 py-2">
                          <select
                            value={recipeEdits[item.id]?.productId ?? ""}
                            onChange={(e) =>
                              setRecipeEdits((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  productId: e.target.value,
                                },
                              }))
                            }
                            disabled={!isEditing}
                            className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100 disabled:opacity-60"
                          >
                            <option value="">Select</option>
                            {productOptions.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={recipeEdits[item.id]?.rawMaterialId ?? ""}
                            onChange={(e) =>
                              setRecipeEdits((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  rawMaterialId: e.target.value,
                                },
                              }))
                            }
                            disabled={!isEditing}
                            className="h-9 rounded border border-slate-700 bg-slate-950 px-2 text-slate-100 disabled:opacity-60"
                          >
                            <option value="">Select</option>
                            {materialOptions.map((material) => (
                              <option key={material.id} value={material.id}>
                                {material.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.001"
                            value={recipeEdits[item.id]?.qtyPerProduct ?? ""}
                            onChange={(e) =>
                              setRecipeEdits((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  qtyPerProduct: e.target.value,
                                },
                              }))
                            }
                            disabled={!isEditing}
                            className="h-9 w-28 rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100 disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={recipeEdits[item.id]?.wastePct ?? "0"}
                            onChange={(e) =>
                              setRecipeEdits((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  wastePct: e.target.value,
                                },
                              }))
                            }
                            disabled={!isEditing}
                            className="h-9 w-20 rounded border border-slate-700 bg-slate-950 px-2 text-right text-slate-100 disabled:opacity-60"
                          />
                        </td>
                        <td className="px-2 py-2 text-right space-x-2">
                          {!isEditing ? (
                            <button
                              onClick={() => setEditingRecipeItemId(item.id)}
                              className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                            >
                              Edit
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  runMutation("PATCH", {
                                    entity: "recipe",
                                    id: item.id,
                                    productId: recipeEdits[item.id]?.productId,
                                    rawMaterialId:
                                      recipeEdits[item.id]?.rawMaterialId,
                                    qtyPerProduct: Number(
                                      recipeEdits[item.id]?.qtyPerProduct ?? 0,
                                    ),
                                    wastePct: Number(
                                      recipeEdits[item.id]?.wastePct ?? 0,
                                    ),
                                  }).then(() => setEditingRecipeItemId(null))
                                }
                                className="h-9 rounded border border-slate-700 bg-slate-200 px-3 text-xs font-medium text-slate-900 hover:bg-slate-100"
                              >
                                Save
                              </button>
                              <button
                                onClick={() =>
                                  runMutation("DELETE", {
                                    entity: "recipe",
                                    id: item.id,
                                  }).then(() => setEditingRecipeItemId(null))
                                }
                                className="h-9 rounded border border-slate-700 bg-slate-800 px-3 text-xs text-slate-200 hover:bg-slate-700"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {selectedBomProductId ? (
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <select
                value={newRecipe.rawMaterialId}
                onChange={(e) =>
                  setNewRecipe((prev) => ({
                    ...prev,
                    rawMaterialId: e.target.value,
                  }))
                }
                className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              >
                <option value="">Select material</option>
                {materialOptions.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                value={newRecipe.qtyPerProduct}
                onChange={(e) =>
                  setNewRecipe((prev) => ({
                    ...prev,
                    qtyPerProduct: e.target.value,
                  }))
                }
                placeholder="Qty per product"
                className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={newRecipe.wastePct}
                onChange={(e) =>
                  setNewRecipe((prev) => ({
                    ...prev,
                    wastePct: e.target.value,
                  }))
                }
                placeholder="Waste %"
                className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
              />
              <button
                onClick={() =>
                  runMutation("POST", {
                    entity: "recipe",
                    productId: selectedBomProductId,
                    rawMaterialId: newRecipe.rawMaterialId,
                    qtyPerProduct: Number(newRecipe.qtyPerProduct || 0),
                    wastePct: Number(newRecipe.wastePct || 0),
                  }).then(() =>
                    setNewRecipe((prev) => ({
                      ...prev,
                      productId: selectedBomProductId,
                      rawMaterialId: "",
                      qtyPerProduct: "",
                      wastePct: "0",
                    })),
                  )
                }
                disabled={saving || !newRecipe.rawMaterialId}
                className="h-10 rounded-lg border border-slate-700 bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
              >
                Add recipe item
              </button>
            </div>
          ) : null}
        </AppCard>
      </section>
    </main>
  );
}
