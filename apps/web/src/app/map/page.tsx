import Link from "next/link";

type RouteEntry = {
  path: string;
  title: string;
  kind: "page" | "api" | "external";
  description: string;
};

const routes: RouteEntry[] = [
  {
    path: "/",
    title: "Console",
    kind: "page",
    description: "Main web console landing page.",
  },
  {
    path: "/map",
    title: "Route Map",
    kind: "page",
    description: "This route inventory screen.",
  },
  {
    path: "/dashboard",
    title: "Operational Dashboard",
    kind: "page",
    description: "KPIs, alerts, actionables, top products and recent closes.",
  },
  {
    path: "/daily-close/new",
    title: "Create Daily Close",
    kind: "page",
    description: "Entry point for creating a new close flow.",
  },
  {
    path: "/daily-close/:date",
    title: "Daily Close Detail",
    kind: "page",
    description: "Detail view for a specific date.",
  },
  {
    path: "/weekly",
    title: "Weekly Summary",
    kind: "page",
    description: "7-day operational summary and trend view.",
  },
  {
    path: "/products",
    title: "Products",
    kind: "page",
    description: "Product management and product operational report.",
  },
  {
    path: "/cost-control",
    title: "Cost Control",
    kind: "page",
    description: "Manage raw materials, purchases, and recipe items.",
  },
  {
    path: "/team-control",
    title: "Team Control",
    kind: "page",
    description: "Manage employees, access, and work schedules.",
  },
  {
    path: "/sync-logs",
    title: "Sync Logs",
    kind: "page",
    description: "List and review synchronization logs.",
  },
  {
    path: "/admin/error-logs",
    title: "Admin Error Logs",
    kind: "page",
    description: "Operational error visibility and filtering.",
  },
  {
    path: "/ui-system",
    title: "UI System",
    kind: "page",
    description: "Component catalog and states reference.",
  },
  {
    path: "/api/operational-dashboard?date=YYYY-MM-DD",
    title: "Operational Dashboard API",
    kind: "api",
    description: "Returns dashboard payload for selected date.",
  },
  {
    path: "/api/products",
    title: "Products API",
    kind: "api",
    description: "GET products and POST create product.",
  },
  {
    path: "/api/cost-control",
    title: "Cost Control API",
    kind: "api",
    description: "CRUD bridge for raw materials, purchases, and recipes.",
  },
  {
    path: "/api/team-control",
    title: "Team Control API",
    kind: "api",
    description: "CRUD bridge for employees, access, and schedules.",
  },
  {
    path: "http://localhost:3000",
    title: "Keystone Admin UI",
    kind: "external",
    description: "Backend admin lists and operations.",
  },
  {
    path: "http://localhost:3000/api/graphql",
    title: "Keystone GraphQL",
    kind: "external",
    description: "GraphQL endpoint used by web and mobile.",
  },
];

const badgeClassByKind: Record<RouteEntry["kind"], string> = {
  page: "border-slate-700 bg-slate-900 text-slate-200",
  api: "border-slate-600 bg-slate-800 text-slate-100",
  external: "border-slate-500 bg-slate-800 text-slate-50",
};

export default function MapPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
          MOJARRERIA WEB
        </p>
        <h1 className="text-2xl font-semibold text-slate-50">Route Map</h1>
        <p className="text-sm text-slate-300">
          Current route inventory for web and connected API surfaces.
        </p>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 md:p-6">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-2 py-2 text-left">Route</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {routes.map((route) => {
                const isExternal = route.path.startsWith("http");
                return (
                  <tr key={route.path}>
                    <td className="px-2 py-2">
                      {isExternal ? (
                        <a
                          href={route.path}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-100 underline underline-offset-4 hover:text-slate-50"
                        >
                          {route.path}
                        </a>
                      ) : (
                        <Link
                          href={
                            route.path.includes(":") ? "/dashboard" : route.path
                          }
                          className="text-slate-100 underline underline-offset-4 hover:text-slate-50"
                        >
                          {route.path}
                        </Link>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-xs ${badgeClassByKind[route.kind]}`}
                      >
                        {route.kind}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-300">
                      {route.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
