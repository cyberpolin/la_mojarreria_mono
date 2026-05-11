"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "MOJARRERIA_ONBOARDING_V1";

type ProductDraft = {
  name: string;
  salePrice: string;
  rawCost: string;
};

type RecipeLine = {
  id: string;
  rawMaterial: string;
  quantity: string;
  wastePct: string;
};

type TeamMemberDraft = {
  name: string;
  role: string;
  pin: string;
  schedule: string;
};

type RestaurantLogo = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

type RestaurantDraft = {
  name: string;
  description: string;
  logo: RestaurantLogo | null;
};

type OnboardingState = {
  step: number;
  completed: boolean;
  restaurant: RestaurantDraft;
  products: ProductDraft[];
  recipes: RecipeLine[];
  team: TeamMemberDraft[];
  whatsappConnected: boolean;
};

const defaultState: OnboardingState = {
  step: 1,
  completed: false,
  restaurant: {
    name: "",
    description: "",
    logo: null,
  },
  products: [],
  recipes: [
    { id: crypto.randomUUID(), rawMaterial: "", quantity: "", wastePct: "0" },
  ],
  team: [],
  whatsappConnected: false,
};

const loadState = (): OnboardingState => {
  if (typeof window === "undefined") return defaultState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState;
  try {
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    return {
      ...defaultState,
      ...parsed,
      recipes:
        parsed.recipes && parsed.recipes.length > 0
          ? parsed.recipes
          : defaultState.recipes,
    };
  } catch {
    return defaultState;
  }
};

const persistState = (state: OnboardingState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const StepLabel = ({ step }: { step: number }) => (
  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
    Step {step} of 8
  </p>
);

const MockHeader = () => (
  <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-300">
    MOCK
  </div>
);

export default function OnboardingPage() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [errors, setErrors] = useState<string[]>([]);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [restaurantReady, setRestaurantReady] = useState<boolean | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  useEffect(() => {
    persistState(state);
  }, [state]);

  useEffect(() => {
    let active = true;
    const checkRestaurant = async () => {
      try {
        const response = await fetch("/api/restaurant", { cache: "no-store" });
        if (!response.ok) {
          if (active) setRestaurantReady(false);
          return;
        }
        const payload = (await response.json()) as {
          restaurant?: { name?: string | null } | null;
        };
        const name = payload.restaurant?.name?.trim() ?? "";
        if (active) setRestaurantReady(Boolean(name));
      } catch {
        if (active) setRestaurantReady(false);
      }
    };

    checkRestaurant();
    return () => {
      active = false;
    };
  }, []);

  const isCompleted = state.completed;
  const step = Math.min(Math.max(state.step, 1), 8);

  const stepTitle = useMemo(() => {
    switch (step) {
      case 1:
        return "Restaurant info";
      case 2:
        return "Welcome to your restaurant control system";
      case 3:
        return "Add the products you sell";
      case 4:
        return "Define your product recipe";
      case 5:
        return "Add your team members";
      case 6:
        return "Connect WhatsApp orders";
      case 7:
        return "Daily closing";
      case 8:
        return "Your dashboard is ready";
      default:
        return "";
    }
  }, [step]);

  const goNext = () => {
    setErrors([]);
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 8),
    }));
  };

  const goBack = () => {
    setErrors([]);
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1),
    }));
  };

  const markComplete = () => {
    setState((prev) => ({
      ...prev,
      completed: true,
    }));
  };

  const resetOnboarding = () => {
    setErrors([]);
    setState(defaultState);
  };

  const saveProductAndContinue = () => {
    const last = state.products[state.products.length - 1];
    const draft = last ?? { name: "", salePrice: "", rawCost: "" };
    const missing = [];
    if (!draft.name.trim()) missing.push("Product name is required.");
    if (!draft.salePrice.trim()) missing.push("Sale price is required.");

    if (missing.length > 0) {
      setErrors(missing);
      return;
    }
    goNext();
  };

  const saveRecipe = () => {
    setErrors([]);
    goNext();
  };

  const saveTeamMember = () => {
    const last = state.team[state.team.length - 1];
    const missing = [];
    if (!last?.name?.trim()) missing.push("Employee name is required.");
    if (!last?.pin?.trim() || last.pin.trim().length !== 4)
      missing.push("4-digit PIN is required.");

    if (missing.length > 0) {
      setErrors(missing);
      return;
    }
    goNext();
  };

  const addProductDraft = () => {
    setState((prev) => ({
      ...prev,
      products: [...prev.products, { name: "", salePrice: "", rawCost: "" }],
    }));
  };

  const addRecipeLine = () => {
    setState((prev) => ({
      ...prev,
      recipes: [
        ...prev.recipes,
        {
          id: crypto.randomUUID(),
          rawMaterial: "",
          quantity: "",
          wastePct: "0",
        },
      ],
    }));
  };

  const addTeamMember = () => {
    setState((prev) => ({
      ...prev,
      team: [...prev.team, { name: "", role: "", pin: "", schedule: "" }],
    }));
  };

  useEffect(() => {
    if (step === 3 && state.products.length === 0) {
      addProductDraft();
    }
    if (step === 5 && state.team.length === 0) {
      addTeamMember();
    }
  }, [step, state.products.length, state.team.length]);

  const updateRestaurant = (
    field: keyof RestaurantDraft,
    value: RestaurantDraft[keyof RestaurantDraft],
  ) => {
    setState((prev) => ({
      ...prev,
      restaurant: { ...prev.restaurant, [field]: value },
    }));
  };

  const updateProduct = (
    index: number,
    field: keyof ProductDraft,
    value: string,
  ) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const updateRecipe = (id: string, field: keyof RecipeLine, value: string) => {
    setState((prev) => ({
      ...prev,
      recipes: prev.recipes.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const updateTeam = (
    index: number,
    field: keyof TeamMemberDraft,
    value: string,
  ) => {
    setState((prev) => ({
      ...prev,
      team: prev.team.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleLogoFile = (file: File | null) => {
    if (!file) {
      setLogoDraft(null);
      updateRestaurant("logo", null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrors(["Logo must be an image file."]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        setLogoDraft(result);
      }
    };
    reader.onerror = () => {
      setErrors(["Failed to read logo file."]);
    };
    reader.readAsDataURL(file);
  };

  const uploadLogoIfNeeded = async () => {
    if (!logoDraft) return state.restaurant.logo;
    setUploadingLogo(true);
    try {
      const response = await fetch("/api/restaurant/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: logoDraft,
          restaurantName: state.restaurant.name.trim() || "restaurant",
        }),
      });
      const payload = (await response.json()) as {
        image?: RestaurantLogo;
        error?: string;
      };
      if (!response.ok || !payload.image) {
        throw new Error(payload.error ?? "Failed to upload logo.");
      }
      setLogoDraft(null);
      updateRestaurant("logo", payload.image);
      return payload.image;
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveRestaurant = async () => {
    const name = state.restaurant.name.trim();
    if (!name) {
      setErrors(["Restaurant name is required."]);
      return false;
    }

    setErrors([]);
    setSavingRestaurant(true);
    try {
      const logo = await uploadLogoIfNeeded();
      const response = await fetch("/api/restaurant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: state.restaurant.description.trim(),
          logo,
        }),
      });
      const payload = (await response.json()) as {
        restaurant?: RestaurantDraft & { id?: string };
        error?: string;
      };
      if (!response.ok || !payload.restaurant) {
        throw new Error(payload.error ?? "Failed to save restaurant.");
      }
      const restaurant = payload.restaurant;
      setState((prev) => ({
        ...prev,
        restaurant: {
          name: restaurant.name,
          description: restaurant.description ?? "",
          logo: restaurant.logo ?? null,
        },
      }));
      return true;
    } catch (error) {
      setErrors([
        error instanceof Error ? error.message : "Failed to save restaurant.",
      ]);
      return false;
    } finally {
      setSavingRestaurant(false);
    }
  };

  const saveRestaurantAndContinue = async () => {
    const ok = await saveRestaurant();
    if (ok) goNext();
  };

  const saveRestaurantAndFinish = async () => {
    const ok = await saveRestaurant();
    if (ok) {
      setState((prev) => ({ ...prev, completed: true }));
      router.replace("/dashboard");
    }
  };

  if (isCompleted) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-2xl space-y-10">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Onboarding complete
            </p>
            <h1 className="text-2xl font-semibold">
              Today has no recorded sales yet
            </h1>
            <p className="text-sm text-slate-300">
              Start your first Daily Close to begin tracking your restaurant.
            </p>
          </header>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/daily-close"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Start Daily Close
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 px-5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-slate-50"
            >
              Go to dashboard
            </Link>
          </div>
          <button
            onClick={resetOnboarding}
            className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300"
          >
            Restart onboarding
          </button>
        </div>
      </main>
    );
  }

  if (restaurantReady === null) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Checking setup
          </p>
          <h1 className="text-2xl font-semibold">Loading onboarding...</h1>
          <p className="text-sm text-slate-300">
            Verifying restaurant setup status.
          </p>
        </div>
      </main>
    );
  }

  if (restaurantReady) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Onboarding complete
          </p>
          <h1 className="text-2xl font-semibold">
            Restaurant setup is already complete
          </h1>
          <p className="text-sm text-slate-300">
            This onboarding only runs when no restaurant name is configured.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => router.replace("/login")}
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Go to login
            </button>
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <header className="space-y-3">
          <StepLabel step={step} />
          <h1 className="text-2xl font-semibold">{stepTitle}</h1>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/40">
          {step === 1 && (
            <div className="space-y-6">
              <p className="text-sm text-slate-300">
                Tell us a little about your restaurant. This information appears
                on receipts and dashboards.
              </p>
              <div className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <label className="grid gap-2 text-sm text-slate-200">
                  Restaurant name
                  <input
                    value={state.restaurant.name}
                    onChange={(event) =>
                      updateRestaurant("name", event.target.value)
                    }
                    placeholder="La Mojarreria"
                    className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-200">
                  Logo (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) =>
                      handleLogoFile(event.target.files?.[0] ?? null)
                    }
                    className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-900 hover:file:bg-white"
                  />
                  <span className="text-xs text-slate-400">
                    PNG or JPG recommended.
                  </span>
                </label>
                {(logoDraft || state.restaurant.logo?.secureUrl) && (
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Logo preview
                    </p>
                    <div className="mt-3 flex items-center gap-4">
                      <img
                        src={
                          logoDraft ?? state.restaurant.logo?.secureUrl ?? ""
                        }
                        alt="Restaurant logo preview"
                        className="h-16 w-16 rounded-lg border border-slate-800 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleLogoFile(null)}
                        className="text-xs uppercase tracking-[0.2em] text-slate-500 hover:text-slate-300"
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>
                )}
                <label className="grid gap-2 text-sm text-slate-200">
                  Description (optional)
                  <textarea
                    value={state.restaurant.description}
                    onChange={(event) =>
                      updateRestaurant("description", event.target.value)
                    }
                    placeholder="Fresh seafood, daily specials, and family recipes."
                    rows={4}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
                  />
                </label>
              </div>
              {errors.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={saveRestaurantAndContinue}
                  disabled={savingRestaurant || uploadingLogo}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingRestaurant || uploadingLogo
                    ? "Saving..."
                    : "Save and continue"}
                </button>
                <button
                  onClick={saveRestaurantAndFinish}
                  disabled={savingRestaurant || uploadingLogo}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {savingRestaurant || uploadingLogo
                    ? "Saving..."
                    : "Save and start using"}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <p className="text-sm text-slate-300">This system helps you:</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>Track daily sales</li>
                <li>Understand food costs</li>
                <li>Control expenses</li>
                <li>Keep your team organized</li>
              </ul>
              <p className="text-sm text-slate-300">
                In a few steps we will prepare your restaurant so you can start
                recording daily operations.
              </p>
              <button
                onClick={() => setState((prev) => ({ ...prev, step: 3 }))}
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                Start setup
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <MockHeader />
              <p className="text-sm text-slate-300">
                Products are the items customers buy. Example: Mojarra Frita,
                Empanada de Camarón, Refresco. These products will be used to
                record daily sales.
              </p>
              {state.products.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Add your first product below.
                </p>
              ) : null}
              {state.products.map((product, index) => (
                <div
                  key={`product-${index}`}
                  className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <label className="grid gap-2 text-sm text-slate-200">
                    Product name
                    <input
                      value={product.name}
                      onChange={(event) =>
                        updateProduct(index, "name", event.target.value)
                      }
                      placeholder="Mojarra Frita"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                    <span className="text-xs text-slate-400">
                      Name of the dish or item you sell.
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Sale price
                    <input
                      value={product.salePrice}
                      onChange={(event) =>
                        updateProduct(index, "salePrice", event.target.value)
                      }
                      placeholder="120"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                    <span className="text-xs text-slate-400">
                      Price customers pay for one unit.
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Raw cost (optional)
                    <input
                      value={product.rawCost}
                      onChange={(event) =>
                        updateProduct(index, "rawCost", event.target.value)
                      }
                      placeholder="45"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                    <span className="text-xs text-slate-400">
                      Quick estimate of how much it costs to produce one unit.
                    </span>
                  </label>
                </div>
              ))}
              <button
                onClick={addProductDraft}
                className="text-sm text-slate-300 underline underline-offset-4 hover:text-slate-100"
              >
                Add another product
              </button>
              {errors.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={saveProductAndContinue}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Save product and continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <MockHeader />
              <p className="text-sm text-slate-300">
                Each product uses ingredients. This helps the system calculate
                food cost automatically.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                Example for Mojarra Frita: Mojarra, Oil, Seasoning
              </div>
              <div className="space-y-4">
                {state.recipes.map((line) => (
                  <div
                    key={line.id}
                    className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <label className="grid gap-2 text-sm text-slate-200">
                      Raw material
                      <input
                        value={line.rawMaterial}
                        onChange={(event) =>
                          updateRecipe(
                            line.id,
                            "rawMaterial",
                            event.target.value,
                          )
                        }
                        placeholder="Mojarra"
                        className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                      />
                      <span className="text-xs text-slate-400">
                        Ingredient used to produce the dish.
                      </span>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-200">
                      Quantity per product
                      <input
                        value={line.quantity}
                        onChange={(event) =>
                          updateRecipe(line.id, "quantity", event.target.value)
                        }
                        placeholder="1.0 kg"
                        className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                      />
                      <span className="text-xs text-slate-400">
                        How much ingredient is used per unit sold.
                      </span>
                    </label>
                    <label className="grid gap-2 text-sm text-slate-200">
                      Waste %
                      <input
                        value={line.wastePct}
                        onChange={(event) =>
                          updateRecipe(line.id, "wastePct", event.target.value)
                        }
                        placeholder="5"
                        className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                      />
                      <span className="text-xs text-slate-400">
                        Expected waste or loss during preparation.
                      </span>
                    </label>
                  </div>
                ))}
                <button
                  onClick={addRecipeLine}
                  className="text-sm text-slate-300 underline underline-offset-4 hover:text-slate-100"
                >
                  Add another ingredient
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={saveRecipe}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Save recipe
                </button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <MockHeader />
              <p className="text-sm text-slate-300">
                Team members can clock in and out using the tablet. This helps
                you know who is working and how long.
              </p>
              {state.team.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Add your first employee below.
                </p>
              ) : null}
              {state.team.map((member, index) => (
                <div
                  key={`team-${index}`}
                  className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <label className="grid gap-2 text-sm text-slate-200">
                    Employee name
                    <input
                      value={member.name}
                      onChange={(event) =>
                        updateTeam(index, "name", event.target.value)
                      }
                      placeholder="Juan Perez"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Role (optional)
                    <input
                      value={member.role}
                      onChange={(event) =>
                        updateTeam(index, "role", event.target.value)
                      }
                      placeholder="Cocinero"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    4-digit PIN
                    <input
                      value={member.pin}
                      onChange={(event) =>
                        updateTeam(index, "pin", event.target.value)
                      }
                      placeholder="1234"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                    <span className="text-xs text-slate-400">
                      Used to check in or check out.
                    </span>
                  </label>
                  <label className="grid gap-2 text-sm text-slate-200">
                    Schedule (optional)
                    <input
                      value={member.schedule}
                      onChange={(event) =>
                        updateTeam(index, "schedule", event.target.value)
                      }
                      placeholder="Mon–Sat, 10am–6pm"
                      className="h-11 rounded-lg border border-slate-700 bg-slate-900 px-3 text-slate-100"
                    />
                  </label>
                </div>
              ))}
              <button
                onClick={addTeamMember}
                className="text-sm text-slate-300 underline underline-offset-4 hover:text-slate-100"
              >
                Add another team member
              </button>
              {errors.length > 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
                  {errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={saveTeamMember}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Save employee
                </button>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <MockHeader />
              <p className="text-sm text-slate-300">
                Your WhatsApp will help receive orders even when the restaurant
                is closed. The system can answer customers automatically,
                collect orders, and notify your team.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                {state.whatsappConnected
                  ? "WhatsApp connection captured (mock)."
                  : "No WhatsApp number connected yet."}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={() =>
                    setState((prev) => ({ ...prev, whatsappConnected: true }))
                  }
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Connect WhatsApp number
                </button>
                <button
                  onClick={goNext}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Skip and configure later
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6">
              <p className="text-sm text-slate-300">
                At the end of the day you will record: quantity sold per
                product, cash received, transfers received, and expenses paid.
                This takes less than 2 minutes and gives you a complete
                financial overview.
              </p>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                Example: 32 Mojarra Frita, $4,800 cash, $1,200 transfers, $250
                expenses paid.
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={goNext}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  See example
                </button>
              </div>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-6">
              <p className="text-sm text-slate-300">
                You can now: record daily sales, track food cost, monitor team
                activity, and see your profit margin. Your restaurant system is
                now ready.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={goBack}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Back
                </button>
                <button
                  onClick={markComplete}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-700 bg-slate-100 px-5 text-sm font-semibold text-slate-900 transition hover:bg-white"
                >
                  Start today’s Daily Close
                </button>
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-800 px-5 text-sm text-slate-200 hover:border-slate-600"
                >
                  Go to dashboard
                </Link>
              </div>
            </div>
          )}
        </section>

        {step > 1 && step < 8 ? (
          <p className="text-xs text-slate-500">
            Your progress is saved locally so you can continue later.
          </p>
        ) : null}
      </div>
    </main>
  );
}
