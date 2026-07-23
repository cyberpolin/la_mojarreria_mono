"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getWorkspaceSession, takuApi, takuList } from "@/lib/taku-api";
import {
  hasOwnerModeAdminBackup,
  restoreOwnerModeAdminSession,
  type WorkspaceSession,
} from "@/lib/auth";

type Role = "owner" | "admin" | "agent";
type AdminRole =
  | "super_owner"
  | "super_admin"
  | "support_admin"
  | "billing_admin"
  | "readonly_admin";
type SectionId =
  | "home"
  | "conversations"
  | "numbers"
  | "automation"
  | "hours"
  | "users"
  | "settings"
  | "billing"
  | "auth"
  | "onboarding"
  | "states"
  | "profile";

type DashboardOverview = {
  metrics?: Record<string, number>;
  alerts?: Array<{ message: string; type: string }>;
  recentActivity?: Array<{ id: string; message: string; createdAt: string }>;
};

type WhatsAppAccount = {
  id: string;
  displayName: string;
  description: string | null;
  phoneNumber: string | null;
  status: string;
  automationEnabled?: boolean;
  enabled: boolean;
  useWorkspaceBusinessHours: boolean;
  useWorkspaceBotSettings: boolean;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
};

type Conversation = {
  id: string;
  status: string;
  contact: { id: string; name: string | null; phoneNumber: string } | null;
  whatsappAccount: {
    id: string;
    displayName: string;
    phoneNumber: string | null;
    status: string;
  } | null;
  assignedUser: { id: string; name: string } | null;
  lastMessage: {
    body: string | null;
    direction: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  lastMessageAt: string | null;
};

type Message = {
  id: string;
  direction: string;
  body: string | null;
  status: string;
  createdAt: string;
};

type TakuBot = {
  id: string;
  name: string;
  instructions: string;
  status: string;
  externalAssistantId: string | null;
  clientId: string | null;
  hasClientToken?: boolean;
};

type BotAssignment = {
  id: string;
  whatsappAccountId: string;
  botId: string;
  enabled: boolean;
  mode: string;
  bot?: TakuBot | null;
};

type BotSettings = {
  id: string;
  enabled: boolean;
  afterHoursEnabled: boolean;
  afterHoursResponder?: "static_message" | "assigned_bot" | "none";
  afterHoursMessage: string | null;
  rulesEnabled: boolean;
  aiEnabled: boolean;
};

type AutomationSettingsForm = {
  enabled: boolean;
  afterHoursEnabled: boolean;
  afterHoursResponder: "static_message" | "assigned_bot" | "none";
  afterHoursMessage: string;
  rulesEnabled: boolean;
  aiEnabled: boolean;
};

type AutomationRule = {
  id: string;
  keyword: string;
  matchType: string;
  responseText: string;
  enabled: boolean;
  whatsappAccountId: string | null;
};

type AutomationBlockedContact = {
  id: string;
  phoneNumber: string;
  label: string | null;
  reason: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type BusinessHoursPayload = {
  timezone: string;
  currentStatus?: { isOpen: boolean; label: string; nextChangeAt?: string };
  days: Array<{
    id: string;
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    isClosed: boolean;
  }>;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
};

type TakuData = {
  overview: DashboardOverview | null;
  accounts: WhatsAppAccount[];
  conversations: Conversation[];
  bots: TakuBot[];
  assignments: BotAssignment[];
  botSettings: BotSettings | null;
  rules: AutomationRule[];
  blockedContacts: AutomationBlockedContact[];
  hours: BusinessHoursPayload | null;
  users: UserRow[];
};

const emptyData: TakuData = {
  overview: null,
  accounts: [],
  conversations: [],
  bots: [],
  assignments: [],
  botSettings: null,
  rules: [],
  blockedContacts: [],
  hours: null,
  users: [],
};

const navItems: Array<{
  id: SectionId;
  label: string;
  roles: Role[];
}> = [
  { id: "home", label: "Inicio", roles: ["owner", "admin", "agent"] },
  {
    id: "conversations",
    label: "Conversaciones",
    roles: ["owner", "admin", "agent"],
  },
  { id: "numbers", label: "Numeros WhatsApp", roles: ["owner", "admin"] },
  { id: "automation", label: "Automatizacion", roles: ["owner", "admin"] },
  { id: "hours", label: "Horarios", roles: ["owner", "admin"] },
  { id: "users", label: "Usuarios", roles: ["owner", "admin"] },
  { id: "settings", label: "Configuracion", roles: ["owner", "admin"] },
  { id: "profile", label: "Mi perfil", roles: ["agent"] },
  { id: "billing", label: "Plan y facturacion", roles: ["owner"] },
  {
    id: "onboarding",
    label: "Onboarding",
    roles: ["owner", "admin", "agent"],
  },
  {
    id: "states",
    label: "Estados y UX",
    roles: ["owner", "admin", "agent"],
  },
  { id: "auth", label: "Acceso publico", roles: ["owner", "admin", "agent"] },
];

const metrics = [
  ["Conversaciones abiertas", "28"],
  ["Mensajes sin responder", "12"],
  ["Numeros conectados", "2"],
  ["Automatizaciones activas", "5"],
];

const agentMetrics = [
  ["Mis conversaciones abiertas", "9"],
  ["Sin asignar", "6"],
  ["Sin responder", "12"],
  ["Ultimas conversaciones", "18"],
];

const phoneNumbers = [
  {
    name: "Ventas",
    phone: "+52 993 120 4488",
    status: "Conectado",
    lastEvent: "Hace 5 min",
    lastDisconnect: "Ayer 18:02",
    automation: "Activa",
  },
  {
    name: "Soporte",
    phone: "+52 993 204 7711",
    status: "Desconectado",
    lastEvent: "Hace 2 h",
    lastDisconnect: "Hace 2 h",
    automation: "Inactiva",
  },
  {
    name: "Sucursal Centro",
    phone: "+52 993 775 0091",
    status: "Esperando QR",
    lastEvent: "QR listo",
    lastDisconnect: "-",
    automation: "General",
  },
];

const conversations = [
  {
    name: "Juan Perez",
    phone: "+52 993 111 2233",
    preview: "Necesito una cotizacion para hoy...",
    channel: "Ventas",
    time: "Hace 3 min",
    status: "Sin responder",
    agent: "Ana",
    unread: 3,
    bot: false,
  },
  {
    name: "Maria Lopez",
    phone: "+52 993 222 3344",
    preview: "Gracias, manana paso por el pedido.",
    channel: "Soporte",
    time: "Hace 15 min",
    status: "Cerrada",
    agent: "Roberto",
    unread: 0,
    bot: false,
  },
  {
    name: "Clinica Norte",
    phone: "+52 993 555 4488",
    preview: "horario",
    channel: "Ventas",
    time: "Hace 22 min",
    status: "Pendiente",
    agent: "Sin asignar",
    unread: 1,
    bot: true,
  },
];

const users = [
  {
    name: "Carlos",
    email: "carlos@empresa.com",
    role: "Owner",
    status: "Activo",
    lastAccess: "Hoy",
  },
  {
    name: "Ana Perez",
    email: "ana@empresa.com",
    role: "Admin",
    status: "Activo",
    lastAccess: "Ayer",
  },
  {
    name: "Juan Gomez",
    email: "juan@empresa.com",
    role: "Agent",
    status: "Invitado",
    lastAccess: "Nunca",
  },
];

const rules = [
  {
    keyword: "horario",
    match: "Contiene",
    response: "Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM.",
    appliesTo: "Todos",
    status: "Activa",
  },
  {
    keyword: "ubicacion",
    match: "Exacta",
    response: "Estamos ubicados en Av. Principal 120.",
    appliesTo: "Ventas",
    status: "Activa",
  },
  {
    keyword: "factura",
    match: "Contiene",
    response: "Para facturar necesitamos tu RFC y correo.",
    appliesTo: "Todos",
    status: "Inactiva",
  },
];

const week = [
  ["Lunes", true, "09:00", "18:00"],
  ["Martes", true, "09:00", "18:00"],
  ["Miercoles", true, "09:00", "18:00"],
  ["Jueves", true, "09:00", "18:00"],
  ["Viernes", true, "09:00", "18:00"],
  ["Sabado", true, "10:00", "14:00"],
  ["Domingo", false, "-", "-"],
] as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "dark" | "warn";
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-7 items-center rounded-full px-3 text-xs font-semibold",
        tone === "dark" && "bg-slate-950 text-white",
        tone === "warn" && "border border-slate-300 bg-white text-slate-800",
        tone === "default" && "bg-slate-100 text-slate-700",
      )}
    >
      {children}
    </span>
  );
}

function Button({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "secondary" &&
          "border border-slate-300 bg-white text-slate-900 hover:border-slate-950",
        variant === "ghost" && "text-slate-700 hover:bg-slate-100",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint ? (
        <span className="text-xs font-normal text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}

function Input({
  placeholder,
  readOnly,
  value,
  onChange,
  type = "text",
}: {
  placeholder: string;
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 read-only:bg-slate-100"
    />
  );
}

function TextArea({
  placeholder,
  rows = 4,
  value,
  onChange,
  readOnly,
}: {
  placeholder: string;
  rows?: number;
  value?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <textarea
      rows={rows}
      readOnly={readOnly}
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 read-only:bg-slate-100"
    />
  );
}

function Select({
  children,
  value,
  onChange,
}: {
  children: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
    >
      {children}
    </select>
  );
}

function Switch({
  checked = false,
  label,
  disabled,
  compact = false,
  onChange,
}: {
  checked?: boolean;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={cx(
        "flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700",
        compact && "min-h-9 border-transparent px-0",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
        className="sr-only"
      />
      <span
        className={cx(
          "flex h-6 w-11 items-center rounded-full p-1",
          checked ? "justify-end bg-slate-950" : "justify-start bg-slate-300",
        )}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </label>
  );
}

function SectionHeader({
  label,
  title,
  description,
  action,
}: {
  label: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950 md:text-3xl">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

async function optional<T>(request: Promise<T>, fallback: T): Promise<T> {
  try {
    return await request;
  } catch {
    return fallback;
  }
}

function useTakuData(refreshKey: number) {
  const [data, setData] = useState<TakuData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(refreshKey === 0);
      setError(null);
      try {
        const [
          overview,
          accounts,
          conversationsData,
          bots,
          assignments,
          botSettings,
          rulesData,
          blockedContacts,
          hours,
          usersData,
        ] = await Promise.all([
          optional(takuApi<DashboardOverview>("/dashboard/overview"), null),
          optional(takuList<WhatsAppAccount>("/whatsapp-accounts"), []),
          optional(takuList<Conversation>("/conversations"), []),
          optional(takuList<TakuBot>("/bots"), []),
          optional(takuList<BotAssignment>("/bot-assignments"), []),
          optional(takuApi<BotSettings>("/bot-settings"), null),
          optional(takuList<AutomationRule>("/automation-rules"), []),
          optional(
            takuList<AutomationBlockedContact>("/automation-blocked-contacts"),
            [],
          ),
          optional(takuApi<BusinessHoursPayload>("/business-hours"), null),
          optional(takuList<UserRow>("/users"), []),
        ]);
        if (!cancelled) {
          setData({
            overview,
            accounts,
            conversations: conversationsData,
            bots,
            assignments,
            botSettings,
            rules: rulesData,
            blockedContacts,
            hours,
            users: usersData,
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar TAKU.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { data, isLoading, error };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    connected: "Conectado",
    disconnected: "Desconectado",
    connecting: "Conectando",
    pending: "Pendiente",
    qr_required: "Esperando QR",
    failed: "Error",
    disabled: "Deshabilitado",
  };
  return labels[status] ?? status;
}

function HomeSection({
  role,
  data,
  onSection,
}: {
  role: Role;
  data: TakuData;
  onSection: (section: SectionId) => void;
}) {
  const overviewMetrics = data.overview?.metrics ?? {};
  const shownMetrics =
    role === "agent"
      ? [
          [
            "Mis conversaciones abiertas",
            overviewMetrics.myOpenConversations ?? 0,
          ],
          ["Sin asignar", overviewMetrics.unassignedConversations ?? 0],
          ["Sin responder", overviewMetrics.unansweredMessages ?? 0],
          ["Conversaciones", data.conversations.length],
        ]
      : [
          ["Conversaciones abiertas", overviewMetrics.openConversations ?? 0],
          ["Mensajes sin responder", overviewMetrics.unansweredMessages ?? 0],
          [
            "Numeros conectados",
            overviewMetrics.connectedWhatsappAccounts ?? 0,
          ],
          [
            "Automatizaciones activas",
            overviewMetrics.activeAutomationRules ?? 0,
          ],
        ];
  const disconnected = data.accounts.find(
    (account) => account.status !== "connected",
  );

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Inicio"
        title={role === "agent" ? "Trabajo diario" : "Estado operativo"}
        description={
          role === "agent"
            ? "Vista enfocada en conversaciones, pendientes y asignaciones del agente."
            : "Resumen rapido para saber si los numeros estan conectados, si hay mensajes pendientes y si la automatizacion esta lista."
        }
        action={
          role === "agent" ? (
            <Button onClick={() => onSection("conversations")}>
              Ir a conversaciones
            </Button>
          ) : (
            <Button onClick={() => onSection("numbers")}>
              Conectar numero
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shownMetrics.map(([label, value]) => (
          <MetricCard
            key={String(label)}
            label={String(label)}
            value={String(value)}
          />
        ))}
      </div>

      {disconnected ? (
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold text-slate-950">
                El numero {disconnected.displayName} esta desconectado.
              </p>
              <p className="mt-1 text-sm text-slate-600">
                No se podran enviar ni recibir mensajes hasta reconectarlo.
              </p>
            </div>
            {role === "agent" ? (
              <Badge tone="warn">Contacta a un administrador</Badge>
            ) : (
              <Button variant="secondary" onClick={() => onSection("numbers")}>
                Reconectar
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Estado de numeros</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Numero</th>
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Ultimo evento</th>
                  <th className="px-4 py-3">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.accounts.map((number) => (
                  <tr key={number.id}>
                    <td className="px-4 py-3 text-slate-700">
                      {number.phoneNumber ?? "Sin vincular"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {number.displayName}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={number.status === "connected" ? "dark" : "warn"}
                      >
                        {statusLabel(number.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(number.lastConnectedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        onClick={() => onSection("numbers")}
                      >
                        Ver
                      </Button>
                    </td>
                  </tr>
                ))}
                {data.accounts.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-8 text-sm text-slate-500"
                      colSpan={5}
                    >
                      No hay numeros configurados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">
              Configura tu cuenta
            </h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-700">
              {[
                "Conectar primer numero",
                "Configurar horario",
                "Activar respuesta fuera de horario",
                "Invitar usuarios",
              ].map((item, index) => (
                <label key={item} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    readOnly
                    checked={index < 2}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold text-slate-950">Actividad reciente</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              {(data.overview?.recentActivity ?? []).slice(0, 4).map((item) => (
                <p key={item.id}>
                  {item.message} · {formatDate(item.createdAt)}
                </p>
              ))}
              {(data.overview?.recentActivity ?? []).length === 0 ? (
                <p>No hay actividad reciente.</p>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        {data.accounts[0] ? (
          <section className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-950">
                  Detalle de numero
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Vista de monitoreo para Owner/Admin.
                </p>
              </div>
              <Badge
                tone={data.accounts[0].status === "connected" ? "dark" : "warn"}
              >
                {statusLabel(data.accounts[0].status)}
              </Badge>
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Nombre del numero", data.accounts[0].displayName],
                [
                  "Numero telefonico",
                  data.accounts[0].phoneNumber ?? "Sin vincular",
                ],
                [
                  "Ultima conexion",
                  formatDate(data.accounts[0].lastConnectedAt),
                ],
                [
                  "Ultima desconexion",
                  formatDate(data.accounts[0].lastDisconnectedAt),
                ],
                [
                  "Automatizacion asociada",
                  data.accounts[0].automationEnabled ? "Activa" : "Inactiva",
                ],
                [
                  "Horario asociado",
                  data.accounts[0].useWorkspaceBusinessHours
                    ? "Horario empresa"
                    : "Horario propio",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 font-medium text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-950">
                Conversaciones recientes
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                {data.conversations
                  .filter(
                    (conversation) =>
                      conversation.whatsappAccount?.id === data.accounts[0]?.id,
                  )
                  .slice(0, 3)
                  .map((conversation) => (
                    <p key={conversation.id}>
                      {conversation.contact?.name ??
                        conversation.contact?.phoneNumber ??
                        "Contacto"}{" "}
                      · {conversation.lastMessage?.body ?? "Sin mensaje"}
                    </p>
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Editar numero</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre del numero">
              <Input placeholder="Ej. Ventas" />
            </Field>
            <Field label="Descripcion interna">
              <TextArea placeholder="Numero principal para pedidos y cotizaciones" />
            </Field>
            <Switch checked label="Numero habilitado" />
            <Switch checked label="Usar horario general" />
            <Switch checked label="Usar configuracion general del bot" />
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              Si se deshabilita un numero conectado, pedir confirmacion antes de
              guardar.
            </div>
            <div className="flex gap-3">
              <Button>Guardar cambios</Button>
              <Button variant="secondary">Cancelar</Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ConversationsSection({
  data,
  onRefresh,
}: {
  data: TakuData;
  onRefresh: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected =
    data.conversations.find((conversation) => conversation.id === selectedId) ??
    data.conversations[0] ??
    null;

  useEffect(() => {
    if (!selected && selectedId) setSelectedId(null);
    if (!selectedId && data.conversations[0])
      setSelectedId(data.conversations[0].id);
  }, [data.conversations, selected, selectedId]);

  useEffect(() => {
    let cancelled = false;
    async function loadMessages() {
      if (!selected) {
        setMessages([]);
        return;
      }
      try {
        const rows = await takuList<Message>(
          `/conversations/${selected.id}/messages?pageSize=100`,
        );
        if (!cancelled) setMessages(rows);
      } catch (caught) {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudieron cargar mensajes.",
          );
      }
    }
    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function sendMessage() {
    if (!selected || !draft.trim()) return;
    setIsSending(true);
    setError(null);
    try {
      await takuApi(`/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ type: "text", body: draft.trim() }),
      });
      setDraft("");
      onRefresh();
      const rows = await takuList<Message>(
        `/conversations/${selected.id}/messages?pageSize=100`,
      );
      setMessages(rows);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "No se pudo enviar mensaje.",
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Conversaciones"
        title="Bandeja compartida de WhatsApp"
        description="Filtra, atiende, asigna y responde conversaciones desde el navegador."
        action={<Button variant="secondary">Ver sin responder</Button>}
      />

      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              "Todas",
              "Abiertas",
              "Sin responder",
              "Asignadas a mi",
              "Sin asignar",
              "Cerradas",
              "Archivadas",
            ].map((filter, index) => (
              <button
                key={filter}
                type="button"
                className={cx(
                  "min-h-10 rounded-full px-4 text-sm font-semibold",
                  index === 2
                    ? "bg-slate-950 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:border-slate-950",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
          <input
            placeholder="Buscar por nombre, telefono o mensaje..."
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 lg:max-w-sm"
          />
        </div>
      </div>

      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[320px_1fr_320px]">
        <aside className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Lista</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {data.conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={cx(
                  "grid w-full gap-2 p-4 text-left hover:bg-slate-50",
                  selected?.id === conversation.id && "bg-slate-100",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {conversation.contact?.name ??
                        conversation.contact?.phoneNumber ??
                        "Contacto"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {conversation.contact?.phoneNumber ?? "-"}
                    </p>
                  </div>
                  {conversation.unreadCount ? (
                    <Badge tone="dark">{conversation.unreadCount}</Badge>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm text-slate-600">
                  {conversation.lastMessage?.body ?? "Sin mensajes"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>
                    {conversation.whatsappAccount?.displayName ?? "-"}
                  </span>
                  <span>{formatDate(conversation.lastMessageAt)}</span>
                  <Badge
                    tone={conversation.unreadCount > 0 ? "warn" : "default"}
                  >
                    {conversation.status}
                  </Badge>
                  {conversation.lastMessage?.direction === "bot" ? (
                    <Badge>Bot</Badge>
                  ) : null}
                </div>
              </button>
            ))}
            {data.conversations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No hay conversaciones todavia.
              </div>
            ) : null}
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="font-semibold text-slate-950">
                {selected?.contact?.name ??
                  selected?.contact?.phoneNumber ??
                  "Conversacion"}
              </h2>
              <p className="text-sm text-slate-500">
                Respondiendo desde:{" "}
                {selected?.whatsappAccount?.displayName ?? "-"} (
                {selected?.contact?.phoneNumber ?? "-"})
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">Asignar</Button>
              <Button variant="secondary">Cerrar</Button>
            </div>
          </div>
          <div className="flex-1 space-y-4 bg-slate-50 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cx(
                  "max-w-[78%] rounded-lg p-3",
                  message.direction === "inbound"
                    ? "border border-slate-200 bg-white text-slate-800"
                    : "ml-auto bg-slate-950 text-white",
                )}
              >
                <p
                  className={cx(
                    "text-xs font-semibold",
                    message.direction === "inbound"
                      ? "text-slate-500"
                      : "text-slate-300",
                  )}
                >
                  {message.direction === "inbound"
                    ? "Cliente"
                    : message.direction === "bot"
                      ? "Bot"
                      : "Equipo"}{" "}
                  · {formatDate(message.createdAt)}
                </p>
                <p className="mt-2 text-sm">{message.body}</p>
                <p className="mt-2 text-xs opacity-70">{message.status}</p>
              </div>
            ))}
            {messages.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
                Selecciona una conversacion para ver mensajes.
              </div>
            ) : null}
          </div>
          <div className="border-t border-slate-200 p-4">
            {error ? (
              <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
                {error}
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <TextArea
                placeholder="Escribe un mensaje..."
                rows={2}
                value={draft}
                onChange={setDraft}
              />
              <Button variant="secondary">Adjuntar</Button>
              <Button disabled={!selected || isSending} onClick={sendMessage}>
                {isSending ? "Enviando..." : "Enviar"}
              </Button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">
            Detalles del contacto
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["Nombre", selected?.contact?.name ?? "-"],
              ["Telefono", selected?.contact?.phoneNumber ?? "-"],
              [
                "Numero receptor",
                selected?.whatsappAccount?.displayName ?? "-",
              ],
              ["Estado", selected?.status ?? "-"],
              [
                "Agente asignado",
                selected?.assignedUser?.name ?? "Sin asignar",
              ],
              ["Ultima actividad", formatDate(selected?.lastMessageAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </dt>
                <dd className="mt-1 text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-6 grid gap-3">
            <Field label="Nombre del contacto">
              <Input placeholder="Nombre del cliente" />
            </Field>
            <Field label="Telefono" hint="Solo lectura en MVP">
              <Input
                placeholder={selected?.contact?.phoneNumber ?? "-"}
                readOnly
              />
            </Field>
            <Field label="Notas internas">
              <TextArea placeholder="Notas visibles solo para el equipo" />
            </Field>
            <Button>Guardar cambios</Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function NumbersSection({
  data,
  onRefresh,
  onConfigureAutomation,
}: {
  data: TakuData;
  onRefresh: () => void;
  onConfigureAutomation: (accountId: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qr, setQr] = useState<{
    payload?: string | null;
    imageUrl?: string | null;
    expiresAt?: string | null;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairingStatus, setPairingStatus] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [savingAutomationId, setSavingAutomationId] = useState<string | null>(
    null,
  );
  const selected =
    data.accounts.find((account) => account.id === selectedId) ??
    data.accounts[0] ??
    null;
  const disconnectingAccount =
    data.accounts.find((account) => account.id === disconnectingId) ?? null;
  const selectedIsConnected = selected?.status === "connected";

  useEffect(() => {
    if (!selectedId || !qr || selectedIsConnected) {
      setPairing(false);
      return;
    }

    let cancelled = false;
    setPairing(true);
    setPairingStatus("Esperando vinculacion...");

    async function syncStatus() {
      try {
        const synced = await takuApi<WhatsAppAccount>(
          `/whatsapp-accounts/${selectedId}/sync`,
          { method: "POST" },
        );
        if (cancelled) return;
        if (synced.status === "connected") {
          setPairing(false);
          setPairingStatus("Conectado");
          setQr(null);
          setMessage("Numero conectado correctamente.");
          onRefresh();
        }
      } catch {
        if (!cancelled) {
          setPairingStatus("Seguimos esperando la vinculacion...");
        }
      }
    }

    void syncStatus();
    const interval = window.setInterval(() => void syncStatus(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [onRefresh, qr, selectedId, selectedIsConnected]);

  async function createNumber(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const response = await takuApi<{ provisioningWarning?: string | null }>(
        "/whatsapp-accounts",
        {
          method: "POST",
          body: JSON.stringify({
            displayName,
            description,
            timezone: "America/Mexico_City",
          }),
        },
      );
      setDisplayName("");
      setDescription("");
      setMessage(
        response.provisioningWarning
          ? "Numero creado. WhatsApp Service no pudo preparar la conexion todavia; intenta pedir el QR en unos segundos."
          : "Numero creado. Ahora puedes pedir el QR.",
      );
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el numero.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function requestQr(accountId: string) {
    setMessage(null);
    try {
      const response = await takuApi<{
        id: string;
        status: string;
        qr: {
          payload?: string | null;
          imageUrl?: string | null;
          expiresAt?: string | null;
        };
      }>(`/whatsapp-accounts/${accountId}/connect`, { method: "POST" });
      setSelectedId(accountId);
      setQr(response.qr);
      setPairing(true);
      setPairingStatus("Esperando vinculacion...");
      setMessage(
        "QR solicitado. Si no aparece, intenta regenerarlo en unos segundos.",
      );
      onRefresh();
    } catch (error) {
      setSelectedId(accountId);
      setQr(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo comunicar con WhatsApp Service.",
      );
    }
  }

  async function disconnect(accountId: string) {
    setMessage(null);
    try {
      await takuApi(`/whatsapp-accounts/${accountId}/disconnect`, {
        method: "POST",
        body: JSON.stringify({ reason: "manual_from_taku_site" }),
      });
      setDisconnectingId(null);
      setQr(null);
      setPairing(false);
      setMessage("Numero desconectado.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo desconectar el numero.",
      );
    }
  }

  async function updateSelected() {
    if (!selected) return;
    await takuApi(`/whatsapp-accounts/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        displayName: selected.displayName,
        description: selected.description,
        enabled: selected.enabled,
        useWorkspaceBusinessHours: selected.useWorkspaceBusinessHours,
        useWorkspaceBotSettings: selected.useWorkspaceBotSettings,
      }),
    });
    setMessage("Cambios guardados.");
    onRefresh();
  }

  async function toggleAutomation(accountId: string, enabled: boolean) {
    setMessage(null);
    setSavingAutomationId(accountId);
    try {
      await takuApi("/bot-settings", {
        method: "PATCH",
        body: JSON.stringify({
          whatsappAccountId: accountId,
          enabled,
        }),
      });
      setMessage(
        enabled
          ? "Automatizacion activada para el numero."
          : "Automatizacion desactivada para el numero.",
      );
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar la automatizacion.",
      );
    } finally {
      setSavingAutomationId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Numeros de WhatsApp"
        title="Administra conexiones y QR"
        description="Owner y Admin conectan, reconectan, editan y monitorean cada numero del workspace."
        action={
          <Button onClick={() => setSelectedId(null)}>Agregar numero</Button>
        }
      />
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {[
                  "Nombre",
                  "Numero",
                  "Estado",
                  "Ultima conexion",
                  "Ultima desconexion",
                  "Automatizacion",
                  "Acciones",
                ].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.accounts.map((number) => (
                <tr key={number.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {number.displayName}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {number.phoneNumber ?? "Asignado despues del QR"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={number.status === "connected" ? "dark" : "warn"}
                    >
                      {statusLabel(number.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(number.lastConnectedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(number.lastDisconnectedAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <div className="flex min-w-[220px] items-center gap-3">
                      <Switch
                        compact
                        checked={number.automationEnabled}
                        disabled={savingAutomationId === number.id}
                        label={
                          savingAutomationId === number.id
                            ? "Guardando"
                            : number.automationEnabled
                              ? "Activa"
                              : "Inactiva"
                        }
                        onChange={(enabled) =>
                          void toggleAutomation(number.id, enabled)
                        }
                      />
                      <Button
                        variant="ghost"
                        onClick={() => onConfigureAutomation(number.id)}
                      >
                        Configuracion
                      </Button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setSelectedId(number.id)}
                      >
                        Ver
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => void requestQr(number.id)}
                      >
                        QR
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setDisconnectingId(number.id)}
                      >
                        Desconectar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.accounts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={7}>
                    No hay numeros conectados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={createNumber}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-950">
            Agregar numero de WhatsApp
          </h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre del numero">
              <Input
                placeholder="Ej. Ventas, Soporte, Sucursal Centro"
                value={displayName}
                onChange={setDisplayName}
              />
            </Field>
            <Field label="Descripcion interna">
              <TextArea
                placeholder="Ej. Numero principal para pedidos y cotizaciones"
                value={description}
                onChange={setDescription}
              />
            </Field>
            <Field label="Zona horaria">
              <Select>
                <option>America/Mexico_City</option>
              </Select>
            </Field>
            <Switch checked label="Usar horario general de la empresa" />
            <Switch checked label="Usar configuracion general del bot" />
            <div className="flex gap-3">
              <Button type="submit" disabled={!displayName.trim() || creating}>
                {creating ? "Creando..." : "Crear numero"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setDisplayName("");
                  setDescription("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </form>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Conectar numero por QR
          </h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            {selectedIsConnected ? (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-5 text-center">
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-950 text-2xl font-semibold text-white">
                    ✓
                  </div>
                  <p className="mt-4 text-sm font-semibold text-slate-950">
                    Conectado
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {selected.phoneNumber ?? "WhatsApp vinculado"}
                  </p>
                </div>
              </div>
            ) : qr?.imageUrl ? (
              <img
                src={qr.imageUrl}
                alt="WhatsApp QR"
                className="mx-auto h-56 w-56 rounded-lg border border-slate-300 bg-white object-contain"
              />
            ) : qr?.payload ? (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-4 text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                QR recibido sin imagen. Regenera el QR en unos segundos.
              </div>
            ) : (
              <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white p-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {selected ? "Pide o regenera el QR" : "Selecciona un numero"}
              </div>
            )}
            <p className="mt-4 font-semibold text-slate-950">
              {selectedIsConnected
                ? "Numero conectado"
                : "Escanea este codigo QR con WhatsApp"}
            </p>
            {selectedIsConnected ? (
              <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">
                La vinculacion ya esta activa para este workspace.
              </p>
            ) : (
              <ol className="mx-auto mt-3 max-w-sm list-decimal space-y-1 pl-5 text-left text-sm text-slate-600">
                <li>Abre WhatsApp en tu telefono.</li>
                <li>Ve a Dispositivos vinculados.</li>
                <li>Toca Vincular dispositivo.</li>
                <li>Escanea el codigo QR.</li>
              </ol>
            )}
            {pairing && pairingStatus ? (
              <p className="mt-3 text-xs font-semibold text-slate-600">
                {pairingStatus}
              </p>
            ) : null}
            {qr?.expiresAt ? (
              <p className="mt-3 text-xs text-slate-500">
                Expira: {formatDate(qr.expiresAt)}
              </p>
            ) : null}
            <div className="mt-5 flex justify-center gap-3">
              <Button
                disabled={!selected}
                onClick={() => selected && void requestQr(selected.id)}
              >
                Regenerar QR
              </Button>
              <Button variant="secondary" onClick={() => setQr(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </section>
      </div>

      {disconnectingAccount ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-950">
              Desconectar numero
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esta accion cerrara la conexion activa de{" "}
              <span className="font-semibold text-slate-950">
                {disconnectingAccount.displayName}
              </span>
              . El numero dejara de recibir y enviar mensajes desde TAKU hasta
              que se vuelva a vincular por QR.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setDisconnectingId(null)}
              >
                Cancelar
              </Button>
              <Button onClick={() => void disconnect(disconnectingAccount.id)}>
                Confirmar desconexion
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AutomationSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Automatizacion"
        title="Respuestas simples y seguras"
        description="Configura respuestas fuera de horario y reglas por palabra clave sin presentar el producto como IA avanzada."
        action={<Button>Guardar configuracion</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Estado de automatizacion
          </h2>
          <div className="mt-5 grid gap-3">
            <Switch checked label="Automatizacion activa" />
            <Switch checked label="Aplicar a todos los numeros" />
            <Switch checked label="Respuestas fuera de horario activas" />
            <Switch checked label="Reglas por palabra clave activas" />
            <Switch label="IA activa - proximamente" />
          </div>
          <div className="mt-5 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
            Si activas automatizacion sin numeros conectados, el sistema debe
            mostrar advertencia.
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Respuesta fuera de horario
          </h2>
          <div className="mt-5 grid gap-4">
            <Switch checked label="Activar respuesta fuera de horario" />
            <Field label="Aplicacion">
              <Select>
                <option>Toda la empresa</option>
                <option>Numero especifico</option>
              </Select>
            </Field>
            <Field label="Mensaje automatico">
              <TextArea placeholder="Gracias por escribir. En este momento estamos fuera de horario. Te responderemos el siguiente dia habil." />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary">Insertar nombre del negocio</Button>
              <Button variant="secondary">
                Insertar proxima hora de apertura
              </Button>
            </div>
            <Switch checked label="Enviar solo una vez por conversacion" />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Vista previa
              </p>
              <p className="mt-3 text-sm text-slate-800">
                Bot: Gracias por escribir. Estamos fuera de horario. Te
                responderemos manana a partir de las 9:00 AM.
              </p>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-950">
            Reglas por palabra clave
          </h2>
          <Button>Nueva regla</Button>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {[
                  "Palabra clave",
                  "Coincidencia",
                  "Respuesta",
                  "Aplica a",
                  "Estado",
                  "Acciones",
                ].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rules.map((rule) => (
                <tr key={rule.keyword}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {rule.keyword}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{rule.match}</td>
                  <td className="px-4 py-3 text-slate-600">{rule.response}</td>
                  <td className="px-4 py-3 text-slate-600">{rule.appliesTo}</td>
                  <td className="px-4 py-3">
                    <Badge>{rule.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost">Editar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">
          Crear regla por palabra clave
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            <Switch checked label="Regla activa" />
            <Field label="Aplicacion">
              <Select>
                <option>Todos los numeros</option>
                <option>Numero especifico</option>
              </Select>
            </Field>
            <Field label="Palabra clave">
              <Input placeholder="Ej. horario, precio, ubicacion" />
            </Field>
            <Field label="Tipo de coincidencia">
              <Select>
                <option>Contiene la palabra</option>
                <option>Es exactamente igual</option>
                <option>Empieza con la palabra</option>
              </Select>
            </Field>
            <Switch label="Sensible a mayusculas/minusculas" />
          </div>
          <div className="grid gap-4">
            <Field label="Respuesta automatica">
              <TextArea placeholder="Nuestro horario es de lunes a viernes de 9:00 AM a 6:00 PM." />
            </Field>
            <Switch
              checked
              label="Evitar responder si ya respondio un agente"
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Cliente: Cual es su horario?
              <br />
              Respuesta automatica: Nuestro horario es de lunes a viernes de
              9:00 AM a 6:00 PM.
            </div>
            <div className="flex gap-3">
              <Button>Guardar regla</Button>
              <Button variant="secondary">Probar regla</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HoursSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Horarios"
        title="Horario de atencion"
        description="Define si la empresa esta abierta y cuando debe dispararse la respuesta fuera de horario."
        action={<Button>Guardar horario</Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Vista previa actual</h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <Badge tone="dark">Abierto ahora</Badge>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              Cierra hoy a las 6:00 PM
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Zona horaria: America/Mexico_City
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            <Field label="Configurar horario para">
              <Select>
                <option>Toda la empresa</option>
                <option>Ventas</option>
                <option>Soporte</option>
              </Select>
            </Field>
            <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              Si seleccionas un numero especifico, reemplaza el horario general.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Horario semanal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {["Dia", "Abierto", "Apertura", "Cierre", "Bloques"].map(
                    (head) => (
                      <th key={head} className="px-4 py-3">
                        {head}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {week.map(([day, open, start, end]) => (
                  <tr key={day}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {day}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={open ? "dark" : "default"}>
                        {open ? "Si" : "No"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Input placeholder={start} readOnly={!open} />
                    </td>
                    <td className="px-4 py-3">
                      <Input placeholder={end} readOnly={!open} />
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost">Agregar bloque</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-slate-200 p-4">
            <Button>Guardar horario</Button>
            <Button variant="secondary">Copiar lunes a viernes</Button>
            <Button variant="secondary">Copiar a todos los dias</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Usuarios"
        title="Equipo y roles"
        description="Owner y Admin administran usuarios del workspace. Agent no ve esta seccion."
        action={<Button>Invitar usuario</Button>}
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {[
                  "Nombre",
                  "Email",
                  "Rol",
                  "Estado",
                  "Ultimo acceso",
                  "Acciones",
                ].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {users.map((user) => (
                <tr key={user.email}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.status === "Activo" ? "dark" : "default"}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {user.lastAccess}
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost">Editar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Invitar usuario</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre">
              <Input placeholder="Nombre del usuario" />
            </Field>
            <Field label="Email">
              <Input placeholder="correo@empresa.com" />
            </Field>
            <Field label="Rol">
              <Select>
                <option>Admin</option>
                <option>Agent</option>
              </Select>
            </Field>
            <Field label="Mensaje de invitacion">
              <TextArea placeholder="Hola, te invito a acceder al panel de WhatsApp de la empresa." />
            </Field>
            <div className="flex gap-3">
              <Button>Enviar invitacion</Button>
              <Button variant="secondary">Cancelar</Button>
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Editar usuario</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre">
              <Input placeholder="Ana Perez" />
            </Field>
            <Field label="Email" hint="Solo lectura inicialmente">
              <Input placeholder="ana@empresa.com" readOnly />
            </Field>
            <Field label="Rol">
              <Select>
                <option>Admin</option>
                <option>Agent</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select>
                <option>Activo</option>
                <option>Deshabilitado</option>
              </Select>
            </Field>
            <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              No permitir deshabilitar al ultimo owner ni que admin modifique
              owner.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SettingsSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Configuracion"
        title="Empresa, preferencias y perfil"
        description="Configuracion operativa del workspace y datos personales del usuario."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Empresa</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre de empresa">
              <Input placeholder="La Mojarreria" />
            </Field>
            <Field label="Slug">
              <Input placeholder="la-mojarreria" />
            </Field>
            <Field label="Zona horaria">
              <Select>
                <option>America/Mexico_City</option>
              </Select>
            </Field>
            <div className="flex gap-2">
              <Badge>Trial</Badge>
              <Badge>Starter</Badge>
            </div>
            <Button>Guardar cambios</Button>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Preferencias</h2>
          <div className="mt-5 grid gap-3">
            <Field label="Conversacion nueva por defecto">
              <Select>
                <option>Abierta</option>
                <option>Pendiente</option>
              </Select>
            </Field>
            <Switch label="Cerrar conversacion automaticamente" />
            <Field label="Tiempo para cierre automatico">
              <Select>
                <option>24 horas sin respuesta</option>
                <option>48 horas sin respuesta</option>
                <option>7 dias sin respuesta</option>
              </Select>
            </Field>
            <Switch
              checked
              label="Mostrar mensajes del bot en conversaciones"
            />
            <Switch
              checked
              label="Permitir que agentes cierren conversaciones"
            />
            <Switch label="Permitir que agentes reasignen conversaciones" />
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Mi perfil</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre">
              <Input placeholder="Carlos" />
            </Field>
            <Field label="Email">
              <Input placeholder="carlos@empresa.com" readOnly />
            </Field>
            <Field label="Contrasena actual">
              <Input placeholder="Tu contrasena actual" />
            </Field>
            <Field label="Nueva contrasena">
              <Input placeholder="Minimo 8 caracteres" />
            </Field>
            <Field label="Confirmar nueva contrasena">
              <Input placeholder="Repite la nueva contrasena" />
            </Field>
            <Button>Guardar perfil</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function BillingSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Plan y facturacion"
        title="Informativo para MVP"
        description="Reservamos el espacio para plan, limites y estado de cuenta sin implementar cobros todavia."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Plan actual", "Starter"],
          ["Estado de cuenta", "Activo"],
          ["Limite de numeros", "3 numeros"],
          ["Limite de usuarios", "8 usuarios"],
          ["Fecha de renovacion", "Proximamente"],
          ["Metodo de pago", "No configurado"],
        ].map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="font-semibold text-slate-950">
          La administracion de pagos estara disponible proximamente.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Owner ve esta seccion completa. Admin puede verla limitada. Agent no
          la ve.
        </p>
      </div>
    </div>
  );
}

function ProfileSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Mi perfil"
        title="Perfil personal"
        description="Pantalla disponible para todos los roles. Para Agent es la unica configuracion visible."
      />
      <section className="max-w-2xl rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4">
          <Field label="Nombre">
            <Input placeholder="Juan Gomez" />
          </Field>
          <Field label="Email" hint="Solo lectura inicialmente">
            <Input placeholder="juan@empresa.com" readOnly />
          </Field>
          <Field label="Contrasena actual">
            <Input placeholder="Requerida solo para cambiar contrasena" />
          </Field>
          <Field label="Nueva contrasena">
            <Input placeholder="Minimo 8 caracteres" />
          </Field>
          <Field label="Confirmar nueva contrasena">
            <Input placeholder="Debe coincidir con la nueva contrasena" />
          </Field>
          <div className="flex gap-3">
            <Button>Guardar perfil</Button>
            <Button variant="secondary">Cancelar</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AuthSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Pantallas publicas"
        title="Login, recuperacion y restablecimiento"
        description="Mocks de las pantallas publicas necesarias para entrar al dashboard."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Login</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Email">
              <Input placeholder="correo@empresa.com" />
            </Field>
            <Field label="Contrasena">
              <Input placeholder="Tu contrasena" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" /> Recordarme
            </label>
            <Button>Entrar</Button>
            <p className="text-sm text-slate-600">
              Email o contrasena incorrectos.
            </p>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Recuperar contrasena</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Email">
              <Input placeholder="correo@empresa.com" />
            </Field>
            <Button>Enviar instrucciones</Button>
            <Button variant="secondary">Volver a login</Button>
            <p className="text-sm text-slate-600">
              Si el correo existe, enviaremos instrucciones.
            </p>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Restablecer contrasena
          </h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nueva contrasena">
              <Input placeholder="Minimo 8 caracteres" />
            </Field>
            <Field label="Confirmar nueva contrasena">
              <Input placeholder="Repite la contrasena" />
            </Field>
            <Button>Guardar nueva contrasena</Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-slate-100" />
      <h3 className="mt-4 font-semibold text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {text}
      </p>
      {action ? (
        <div className="mt-4">
          <Button>{action}</Button>
        </div>
      ) : null}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="h-4 w-1/3 rounded bg-slate-200" />
          <div className="mt-3 h-3 w-2/3 rounded bg-slate-100" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function MockModal({
  title,
  description,
  confirm,
}: {
  title: string;
  description: string;
  confirm: string;
}) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100 p-4">
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/10">
        <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="secondary">Cancelar</Button>
          <Button>{confirm}</Button>
        </div>
      </div>
    </div>
  );
}

function MockDrawer() {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-100 p-4">
      <div className="ml-auto max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Drawer lateral
        </p>
        <h3 className="mt-2 text-lg font-semibold text-slate-950">
          Asignar conversacion
        </h3>
        <div className="mt-5 grid gap-4">
          <Field label="Agente">
            <Select>
              <option>Ana Perez</option>
              <option>Roberto</option>
              <option>Sin asignar</option>
            </Select>
          </Field>
          <Field label="Comentario interno">
            <TextArea placeholder="Comentario opcional para el agente" />
          </Field>
          <div className="flex justify-end gap-3">
            <Button variant="secondary">Cancelar</Button>
            <Button>Asignar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingSection() {
  const routes = [
    "/main/login",
    "/main/forgot-password",
    "/main/reset-password",
    "/main/dashboard",
    "/main/conversations",
    "/main/conversations/:id",
    "/main/whatsapp-accounts",
    "/main/whatsapp-accounts/:id",
    "/main/whatsapp-accounts/:id/connect",
    "/main/automation",
    "/main/business-hours",
    "/main/users",
    "/main/settings/company",
    "/main/settings/preferences",
    "/main/settings/profile",
  ];

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Onboarding inicial"
        title="Guia de primera configuracion"
        description="Flujo visual mock para que una empresa complete datos, conecte su primer numero, configure horario, active respuesta fuera de horario e invite a su equipo."
        action={<Button>Conectar numero</Button>}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Bienvenida
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-950">
          Bienvenido a tu panel de WhatsApp Business.
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Vamos a conectar tu primer numero para que puedas centralizar tus
          conversaciones.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button>Conectar numero</Button>
          <Button variant="secondary">Configurar despues</Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Checklist de configuracion
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-700">
            {[
              ["Completa datos de empresa", true],
              ["Conectar primer numero", false],
              ["Configurar horario", false],
              ["Activar respuesta fuera de horario", false],
              ["Invitar usuarios", false],
            ].map(([label, checked]) => (
              <label key={String(label)} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  readOnly
                  checked={Boolean(checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Rutas previstas para MVP
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            En este prototipo viven dentro de una sola experiencia mock, pero
            quedan mapeadas como pantallas futuras.
          </p>
          <div className="mt-5 grid gap-2 md:grid-cols-2">
            {routes.map((route) => (
              <code
                key={route}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {route}
              </code>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatesSection({ role }: { role: Role }) {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Estados globales y UX"
        title="Casos que el frontend debe prever"
        description="Mocks de empty states, errores simples, permisos, modales, drawers, skeletons, toasts, QR y flujo movil/tablet."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <EmptyState
          title="Aun no tienes numeros de WhatsApp conectados."
          text={
            role === "agent"
              ? "Aun no hay numeros conectados. Contacta a un administrador."
              : "Conecta tu primer numero para empezar a recibir conversaciones."
          }
          action={role === "agent" ? undefined : "Conectar numero"}
        />
        <EmptyState
          title="Todavia no hay conversaciones."
          text="Cuando tus clientes escriban por WhatsApp, apareceran aqui."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <Badge tone="warn">Numero desconectado</Badge>
          <p className="mt-3 text-sm text-slate-700">
            El numero "Ventas" esta desconectado. No se podran enviar ni recibir
            mensajes hasta reconectarlo.
          </p>
          <div className="mt-4">
            {role === "agent" ? (
              <Badge>Contacta a un administrador</Badge>
            ) : (
              <Button variant="secondary">Reconectar</Button>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <Badge tone="warn">WhatsApp Service</Badge>
          <p className="mt-3 text-sm text-slate-700">
            No pudimos comunicarnos con el servicio de WhatsApp. Intenta de
            nuevo.
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 bg-white p-4">
          <Badge tone="warn">Bot Service</Badge>
          <p className="mt-3 text-sm text-slate-700">
            La automatizacion no esta disponible temporalmente. La atencion
            manual sigue funcionando.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Estados de QR</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            "Generando QR...",
            "QR listo",
            "QR expirado",
            "Conectando...",
            "Conectado",
            "Error al conectar",
          ].map((state) => (
            <div
              key={state}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"
            >
              <div className="mx-auto grid h-20 w-20 place-items-center rounded-lg border border-slate-300 bg-white text-[10px] font-semibold uppercase text-slate-500">
                QR
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-950">
                {state}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Modales de confirmacion y prueba
          </h2>
          <div className="mt-5 grid gap-4">
            <MockModal
              title="Desconectar este numero?"
              description="El numero dejara de enviar y recibir mensajes dentro de la plataforma hasta que vuelva a conectarse."
              confirm="Desconectar numero"
            />
            <MockModal
              title="Probar regla"
              description="Mensaje de prueba: Cual es su horario? Resultado: Regla encontrada horario. Respuesta: Nuestro horario es..."
              confirm="Probar regla"
            />
            <MockModal
              title="Probar respuesta automatica"
              description="Responderia porque actualmente esta fuera de horario. Se enviaria el mensaje configurado para la empresa."
              confirm="Probar respuesta"
            />
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Drawer, toast y loading
          </h2>
          <div className="mt-5 grid gap-4">
            <MockDrawer />
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/10">
              <p className="font-semibold text-slate-950">Toast</p>
              <p className="mt-1 text-sm text-slate-600">
                Numero conectado correctamente.
              </p>
            </div>
            <SkeletonRows />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">
          Flujo movil / tablet de conversaciones
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            [
              "1",
              "Lista de conversaciones",
              "Filtros, busqueda, no leidos y canal receptor.",
            ],
            [
              "2",
              "Detalle de conversacion",
              "Historial, composer y estado del numero.",
            ],
            [
              "3",
              "Contacto y acciones",
              "Asignar agente, cambiar estado y editar nombre.",
            ],
          ].map(([step, title, text]) => (
            <div
              key={step}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                {step}
              </span>
              <p className="mt-4 font-semibold text-slate-950">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Permisos insuficientes</h2>
        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-4">
          <p className="font-semibold text-slate-950">
            No tienes permiso para acceder a esta seccion.
          </p>
          <p className="mt-2 text-sm text-slate-600">
            No se muestran botones que el usuario no puede usar. Agent solo ve
            Inicio, Conversaciones, Mi perfil y esta pagina demo.
          </p>
        </div>
      </section>
    </div>
  );
}

function settingsFormFromBotSettings(
  botSettings: BotSettings | null | undefined,
): AutomationSettingsForm {
  return {
    enabled: botSettings?.enabled ?? false,
    afterHoursEnabled: botSettings?.afterHoursEnabled ?? false,
    afterHoursResponder: botSettings?.afterHoursResponder ?? "static_message",
    afterHoursMessage: botSettings?.afterHoursMessage ?? "",
    rulesEnabled: botSettings?.rulesEnabled ?? false,
    aiEnabled: botSettings?.aiEnabled ?? false,
  };
}

function AutomationSectionConnected({
  data,
  onRefresh,
  initialAccountId,
}: {
  data: TakuData;
  onRefresh: () => void;
  initialAccountId?: string | null;
}) {
  const [botName, setBotName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [keyword, setKeyword] = useState("");
  const [responseText, setResponseText] = useState("");
  const [matchType, setMatchType] = useState("contains");
  const [blockedPhoneNumber, setBlockedPhoneNumber] = useState("");
  const [blockedLabel, setBlockedLabel] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [assignmentPhone, setAssignmentPhone] = useState("");
  const [assignmentBot, setAssignmentBot] = useState("");
  const [assignmentMode, setAssignmentMode] = useState(
    "outside_business_hours",
  );
  const [settings, setSettings] = useState<AutomationSettingsForm>(() =>
    settingsFormFromBotSettings(data.botSettings),
  );
  const [numberSettings, setNumberSettings] = useState<AutomationSettingsForm>(
    () => settingsFormFromBotSettings(data.botSettings),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingNumberSettings, setLoadingNumberSettings] = useState(false);
  const [savingNumberSettings, setSavingNumberSettings] = useState(false);
  const [creatingBot, setCreatingBot] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);
  const [creatingBlockedContact, setCreatingBlockedContact] = useState(false);
  const [savingBlockedContactId, setSavingBlockedContactId] = useState<
    string | null
  >(null);
  const [deletingBlockedContactId, setDeletingBlockedContactId] = useState<
    string | null
  >(null);
  const [assigningBot, setAssigningBot] = useState(false);
  const [savingBotStatusId, setSavingBotStatusId] = useState<string | null>(
    null,
  );
  const [deletingBotId, setDeletingBotId] = useState<string | null>(null);
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editBotName, setEditBotName] = useState("");
  const [editBotInstructions, setEditBotInstructions] = useState("");
  const [editBotStatus, setEditBotStatus] = useState<
    "draft" | "active" | "paused"
  >("active");
  const [savingBotEdit, setSavingBotEdit] = useState(false);
  const activeBots = useMemo(
    () => data.bots.filter((bot) => bot.status === "active"),
    [data.bots],
  );
  const editingBot = data.bots.find((bot) => bot.id === editingBotId) ?? null;

  useEffect(() => {
    setSettings(settingsFormFromBotSettings(data.botSettings));
  }, [data.botSettings]);

  useEffect(() => {
    if (
      initialAccountId &&
      data.accounts.some((account) => account.id === initialAccountId)
    ) {
      setAssignmentPhone(initialAccountId);
      return;
    }
    if (!assignmentPhone && data.accounts[0]) {
      setAssignmentPhone(data.accounts[0].id);
    }
  }, [assignmentPhone, data.accounts, initialAccountId]);

  useEffect(() => {
    const currentAssignment = data.assignments.find(
      (assignment) => assignment.whatsappAccountId === assignmentPhone,
    );
    if (currentAssignment) {
      setAssignmentBot(
        activeBots.some((bot) => bot.id === currentAssignment.botId)
          ? currentAssignment.botId
          : "",
      );
      setAssignmentMode(currentAssignment.mode);
      return;
    }
    if (assignmentBot && !activeBots.some((bot) => bot.id === assignmentBot)) {
      setAssignmentBot("");
      return;
    }
    if (!assignmentBot && activeBots[0]) {
      setAssignmentBot(activeBots[0].id);
    }
    if (!currentAssignment) {
      setAssignmentMode("outside_business_hours");
    }
  }, [activeBots, assignmentBot, assignmentPhone, data.assignments]);

  useEffect(() => {
    if (!assignmentPhone) {
      setNumberSettings(settingsFormFromBotSettings(data.botSettings));
      return;
    }

    let cancelled = false;
    async function loadNumberSettings() {
      setLoadingNumberSettings(true);
      try {
        const loaded = await takuApi<BotSettings>(
          `/bot-settings?whatsappAccountId=${encodeURIComponent(assignmentPhone)}`,
        );
        if (!cancelled) setNumberSettings(settingsFormFromBotSettings(loaded));
      } catch {
        if (!cancelled) {
          setNumberSettings(settingsFormFromBotSettings(data.botSettings));
        }
      } finally {
        if (!cancelled) setLoadingNumberSettings(false);
      }
    }

    void loadNumberSettings();
    return () => {
      cancelled = true;
    };
  }, [assignmentPhone, data.botSettings]);

  async function saveSettings() {
    setMessage(null);
    if (
      settings.afterHoursEnabled &&
      settings.afterHoursResponder === "static_message" &&
      !settings.afterHoursMessage.trim()
    ) {
      setMessage(
        "Escribe el mensaje fijo fuera de horario o elige otro responder.",
      );
      return;
    }
    setSavingSettings(true);
    try {
      await takuApi("/bot-settings", {
        method: "PATCH",
        body: JSON.stringify({
          ...settings,
          afterHoursMessage: settings.afterHoursMessage.trim(),
        }),
      });
      setMessage("Configuracion guardada.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuracion.",
      );
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveNumberSettings() {
    setMessage(null);
    if (!assignmentPhone) {
      setMessage("Selecciona un numero para configurar su automatizacion.");
      return;
    }
    if (
      numberSettings.afterHoursEnabled &&
      numberSettings.afterHoursResponder === "static_message" &&
      !numberSettings.afterHoursMessage.trim()
    ) {
      setMessage(
        "Escribe el mensaje fijo fuera de horario o elige otro responder.",
      );
      return;
    }
    setSavingNumberSettings(true);
    try {
      await takuApi("/bot-settings", {
        method: "PATCH",
        body: JSON.stringify({
          whatsappAccountId: assignmentPhone,
          ...numberSettings,
          afterHoursMessage: numberSettings.afterHoursMessage.trim(),
        }),
      });
      setMessage("Automatizacion del numero guardada.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la automatizacion del numero.",
      );
    } finally {
      setSavingNumberSettings(false);
    }
  }

  async function createBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreatingBot(true);
    try {
      await takuApi("/bots", {
        method: "POST",
        body: JSON.stringify({ name: botName, instructions, status: "active" }),
      });
      setBotName("");
      setInstructions("");
      setMessage("Bot creado y provisionado en Bot Service.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el bot.",
      );
    } finally {
      setCreatingBot(false);
    }
  }

  async function updateBotStatus(bot: TakuBot, status: "active" | "paused") {
    setMessage(null);
    setSavingBotStatusId(bot.id);
    try {
      await takuApi(`/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: bot.name,
          instructions: bot.instructions,
          status,
        }),
      });
      setMessage(status === "active" ? "Bot reactivado." : "Bot pausado.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el bot.",
      );
    } finally {
      setSavingBotStatusId(null);
    }
  }

  function startEditingBot(bot: TakuBot) {
    setEditingBotId(bot.id);
    setEditBotName(bot.name);
    setEditBotInstructions(bot.instructions);
    setEditBotStatus(
      bot.status === "draft" || bot.status === "paused" ? bot.status : "active",
    );
  }

  async function saveBotEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBot) return;
    setMessage(null);
    setSavingBotEdit(true);
    try {
      await takuApi(`/bots/${editingBot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editBotName.trim(),
          instructions: editBotInstructions.trim(),
          status: editBotStatus,
        }),
      });
      setMessage("Bot actualizado.");
      setEditingBotId(null);
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el bot.",
      );
    } finally {
      setSavingBotEdit(false);
    }
  }

  async function deleteBot(bot: TakuBot) {
    const confirmed = window.confirm(
      `Eliminar el bot "${bot.name}"? Sus asignaciones quedaran desactivadas.`,
    );
    if (!confirmed) return;
    setMessage(null);
    setDeletingBotId(bot.id);
    try {
      await takuApi(`/bots/${bot.id}`, { method: "DELETE" });
      if (assignmentBot === bot.id) setAssignmentBot("");
      if (editingBotId === bot.id) setEditingBotId(null);
      setMessage("Bot eliminado y asignaciones desactivadas.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo eliminar el bot.",
      );
    } finally {
      setDeletingBotId(null);
    }
  }

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreatingRule(true);
    try {
      await takuApi("/automation-rules", {
        method: "POST",
        body: JSON.stringify({
          keyword: keyword.trim(),
          matchType,
          responseText: responseText.trim(),
          enabled: true,
        }),
      });
      setKeyword("");
      setResponseText("");
      setMessage("Regla creada.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear la regla.",
      );
    } finally {
      setCreatingRule(false);
    }
  }

  async function createBlockedContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setCreatingBlockedContact(true);
    try {
      await takuApi("/automation-blocked-contacts", {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: blockedPhoneNumber.trim(),
          label: blockedLabel.trim(),
          reason: blockedReason.trim(),
          enabled: true,
        }),
      });
      setBlockedPhoneNumber("");
      setBlockedLabel("");
      setBlockedReason("");
      setMessage("Numero agregado a la lista de no responder.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo bloquear el numero.",
      );
    } finally {
      setCreatingBlockedContact(false);
    }
  }

  async function updateBlockedContact(
    contact: AutomationBlockedContact,
    enabled: boolean,
  ) {
    setMessage(null);
    setSavingBlockedContactId(contact.id);
    try {
      await takuApi(`/automation-blocked-contacts/${contact.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setMessage(
        enabled
          ? "Bloqueo activado para el numero."
          : "Bloqueo desactivado para el numero.",
      );
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el bloqueo.",
      );
    } finally {
      setSavingBlockedContactId(null);
    }
  }

  async function deleteBlockedContact(contact: AutomationBlockedContact) {
    const confirmed = window.confirm(
      `Quitar ${contact.phoneNumber} de la lista de no responder?`,
    );
    if (!confirmed) return;
    setMessage(null);
    setDeletingBlockedContactId(contact.id);
    try {
      await takuApi(`/automation-blocked-contacts/${contact.id}`, {
        method: "DELETE",
      });
      setMessage("Numero removido de la lista de no responder.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el bloqueo.",
      );
    } finally {
      setDeletingBlockedContactId(null);
    }
  }

  async function assignBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setAssigningBot(true);
    try {
      await takuApi("/bot-assignments", {
        method: "POST",
        body: JSON.stringify({
          whatsappAccountId: assignmentPhone,
          botId: assignmentBot,
          mode: assignmentMode,
          enabled: true,
        }),
      });
      setMessage("Bot asignado al numero.");
      onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo asignar el bot.",
      );
    } finally {
      setAssigningBot(false);
    }
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Automatizacion"
        title="Bots, reglas y asignaciones"
        description="TAKU decide cuando responder: reglas, fuera de horario o bot asignado a un numero."
        action={
          <Button disabled={savingSettings} onClick={() => void saveSettings()}>
            {savingSettings ? "Guardando..." : "Guardar configuracion"}
          </Button>
        }
      />
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Motor global de respuestas
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Base general para todos los numeros. Puedes ajustar cada numero en
            la seccion por numero.
          </p>
          <div className="mt-5 grid gap-3">
            <Switch
              checked={settings.enabled}
              label="Automatizacion activa"
              onChange={(enabled) =>
                setSettings((current) => ({ ...current, enabled }))
              }
            />
            <Switch
              checked={settings.afterHoursEnabled}
              label="Respuesta fuera de horario"
              onChange={(afterHoursEnabled) =>
                setSettings((current) => ({ ...current, afterHoursEnabled }))
              }
            />
            <Field label="Fuera de horario responde con">
              <Select
                value={settings.afterHoursResponder}
                onChange={(afterHoursResponder) =>
                  setSettings((current) => ({
                    ...current,
                    afterHoursResponder: afterHoursResponder as
                      | "static_message"
                      | "assigned_bot"
                      | "none",
                    afterHoursEnabled:
                      afterHoursResponder === "assigned_bot"
                        ? true
                        : current.afterHoursEnabled,
                    aiEnabled:
                      afterHoursResponder === "assigned_bot"
                        ? true
                        : current.aiEnabled,
                  }))
                }
              >
                <option value="static_message">Mensaje fijo</option>
                <option value="assigned_bot">Bot asignado</option>
                <option value="none">Nada</option>
              </Select>
            </Field>
            <Switch
              checked={settings.rulesEnabled}
              label="Reglas por palabra clave"
              onChange={(rulesEnabled) =>
                setSettings((current) => ({ ...current, rulesEnabled }))
              }
            />
            <Switch
              checked={settings.aiEnabled}
              label="Bots IA asignados a numeros"
              onChange={(aiEnabled) =>
                setSettings((current) => ({ ...current, aiEnabled }))
              }
            />
            <Field label="Mensaje fuera de horario">
              <TextArea
                placeholder="Gracias por escribir. Estamos fuera de horario."
                value={settings.afterHoursMessage}
                readOnly={settings.afterHoursResponder !== "static_message"}
                onChange={(afterHoursMessage) =>
                  setSettings((current) => ({ ...current, afterHoursMessage }))
                }
              />
            </Field>
          </div>
        </section>

        <form
          onSubmit={createBot}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-950">Crear bot</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre">
              <Input
                placeholder="Ej. Ventas automaticas"
                value={botName}
                onChange={setBotName}
              />
            </Field>
            <Field label="Instrucciones">
              <TextArea
                placeholder="Responde breve, pide nombre y pasa a un agente si falta informacion."
                value={instructions}
                onChange={setInstructions}
              />
            </Field>
            <Button
              type="submit"
              disabled={!botName.trim() || !instructions.trim() || creatingBot}
            >
              {creatingBot ? "Creando..." : "Crear bot"}
            </Button>
          </div>
        </form>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-950">Bots</h2>
          <Badge>{data.bots.length}</Badge>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {[
                  "Nombre",
                  "Estado",
                  "Assistant",
                  "Client ID",
                  "Token",
                  "Acciones",
                ].map((head) => (
                  <th key={head} className="px-4 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.bots.map((bot) => (
                <tr key={bot.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {bot.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge>{bot.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {bot.externalAssistantId ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {bot.clientId ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {bot.hasClientToken ? "Configurado" : "Falta"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        disabled={savingBotEdit || deletingBotId === bot.id}
                        onClick={() => startEditingBot(bot)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={
                          savingBotStatusId === bot.id ||
                          deletingBotId === bot.id
                        }
                        onClick={() =>
                          void updateBotStatus(
                            bot,
                            bot.status === "active" ? "paused" : "active",
                          )
                        }
                      >
                        {savingBotStatusId === bot.id
                          ? "Guardando..."
                          : bot.status === "active"
                            ? "Desactivar"
                            : "Reactivar"}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={
                          savingBotStatusId === bot.id ||
                          deletingBotId === bot.id
                        }
                        onClick={() => void deleteBot(bot)}
                      >
                        {deletingBotId === bot.id
                          ? "Eliminando..."
                          : "Eliminar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {editingBot ? (
          <form
            onSubmit={saveBotEdit}
            className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-semibold text-slate-950">Editar bot</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Cambia nombre, instrucciones o estado. Las instrucciones se
                  sincronizan con Bot Service.
                </p>
              </div>
              <Badge>{editingBot.name}</Badge>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
              <Field label="Nombre">
                <Input
                  placeholder="Ej. Ventas automaticas"
                  value={editBotName}
                  onChange={setEditBotName}
                />
              </Field>
              <Field label="Estado">
                <Select
                  value={editBotStatus}
                  onChange={(status) =>
                    setEditBotStatus(status as "draft" | "active" | "paused")
                  }
                >
                  <option value="active">Activo</option>
                  <option value="paused">Pausado</option>
                  <option value="draft">Borrador</option>
                </Select>
              </Field>
              <div className="lg:col-span-2">
                <Field label="Instrucciones">
                  <TextArea
                    rows={8}
                    placeholder="Responde breve, pide nombre y pasa a un agente si falta informacion."
                    value={editBotInstructions}
                    onChange={setEditBotInstructions}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={
                  savingBotEdit ||
                  !editBotName.trim() ||
                  !editBotInstructions.trim()
                }
              >
                {savingBotEdit ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button
                variant="secondary"
                disabled={savingBotEdit}
                onClick={() => setEditingBotId(null)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">
              Automatizacion por numero
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Selecciona un numero, activa o pausa su automatizacion y define
              cuando responde el bot.
            </p>
          </div>
          <Button
            disabled={!assignmentPhone || savingNumberSettings}
            onClick={() => void saveNumberSettings()}
          >
            {savingNumberSettings ? "Guardando..." : "Guardar numero"}
          </Button>
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="grid gap-4">
            <Field label="Numero">
              <Select value={assignmentPhone} onChange={setAssignmentPhone}>
                <option value="">Selecciona numero</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} · {statusLabel(account.status)}
                  </option>
                ))}
              </Select>
            </Field>
            {data.accounts.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Primero agrega y vincula un numero de WhatsApp.
              </p>
            ) : null}
            {loadingNumberSettings ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Cargando configuracion del numero...
              </p>
            ) : null}
            <Switch
              checked={numberSettings.enabled}
              label="Automatizacion activa para este numero"
              onChange={(enabled) =>
                setNumberSettings((current) => ({ ...current, enabled }))
              }
            />
            <Switch
              checked={numberSettings.rulesEnabled}
              label="Aplicar reglas por palabra clave a este numero"
              onChange={(rulesEnabled) =>
                setNumberSettings((current) => ({ ...current, rulesEnabled }))
              }
            />
            <Switch
              checked={numberSettings.aiEnabled}
              label="Permitir bot asignado en este numero"
              onChange={(aiEnabled) =>
                setNumberSettings((current) => ({ ...current, aiEnabled }))
              }
            />
          </div>

          <div className="grid gap-4">
            <Switch
              checked={numberSettings.afterHoursEnabled}
              label="Respuesta fuera de horario para este numero"
              onChange={(afterHoursEnabled) =>
                setNumberSettings((current) => ({
                  ...current,
                  afterHoursEnabled,
                }))
              }
            />
            <Field label="Fuera de horario responde con">
              <Select
                value={numberSettings.afterHoursResponder}
                onChange={(afterHoursResponder) =>
                  setNumberSettings((current) => ({
                    ...current,
                    afterHoursResponder: afterHoursResponder as
                      | "static_message"
                      | "assigned_bot"
                      | "none",
                    afterHoursEnabled:
                      afterHoursResponder === "assigned_bot"
                        ? true
                        : current.afterHoursEnabled,
                    aiEnabled:
                      afterHoursResponder === "assigned_bot"
                        ? true
                        : current.aiEnabled,
                  }))
                }
              >
                <option value="static_message">Mensaje fijo</option>
                <option value="assigned_bot">Bot asignado</option>
                <option value="none">Nada</option>
              </Select>
            </Field>
            <Field label="Mensaje fijo fuera de horario">
              <TextArea
                placeholder="Gracias por escribir. Estamos fuera de horario."
                value={numberSettings.afterHoursMessage}
                readOnly={
                  numberSettings.afterHoursResponder !== "static_message"
                }
                onChange={(afterHoursMessage) =>
                  setNumberSettings((current) => ({
                    ...current,
                    afterHoursMessage,
                  }))
                }
              />
            </Field>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={assignBot}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-950">
            Bot y horario de respuesta
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Define que bot usa el numero seleccionado y en que horario puede
            responder.
          </p>
          <div className="mt-5 grid gap-4">
            <Field label="Numero">
              <Select value={assignmentPhone} onChange={setAssignmentPhone}>
                <option value="">Selecciona numero</option>
                {data.accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.displayName} · {statusLabel(account.status)}
                  </option>
                ))}
              </Select>
            </Field>
            {data.accounts.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Primero agrega y vincula un numero de WhatsApp.
              </p>
            ) : null}
            <Field label="Bot">
              <Select value={assignmentBot} onChange={setAssignmentBot}>
                <option value="">Selecciona bot</option>
                {activeBots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name}
                  </option>
                ))}
              </Select>
            </Field>
            {activeBots.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Primero crea o reactiva un bot.
              </p>
            ) : null}
            <Field label="Horario en que responde el bot">
              <Select value={assignmentMode} onChange={setAssignmentMode}>
                <option value="outside_business_hours">Fuera de horario</option>
                <option value="business_hours">Dentro de horario</option>
                <option value="always">Siempre</option>
                <option value="disabled">Deshabilitado</option>
              </Select>
            </Field>
            <Button
              type="submit"
              disabled={!assignmentPhone || !assignmentBot || assigningBot}
            >
              {assigningBot ? "Guardando..." : "Guardar asignacion"}
            </Button>
          </div>
        </form>

        <form
          onSubmit={createRule}
          className="rounded-lg border border-slate-200 bg-white p-5"
        >
          <h2 className="font-semibold text-slate-950">Crear regla</h2>
          <div className="mt-5 grid gap-4">
            <Field label="Palabra clave">
              <Input
                placeholder="horario"
                value={keyword}
                onChange={setKeyword}
              />
            </Field>
            <Field label="Tipo de coincidencia">
              <Select value={matchType} onChange={setMatchType}>
                <option value="contains">Contiene</option>
                <option value="exact">Exacta</option>
                <option value="starts_with">Empieza con</option>
              </Select>
            </Field>
            <Field label="Respuesta">
              <TextArea
                placeholder="Nuestro horario es de lunes a viernes..."
                value={responseText}
                onChange={setResponseText}
              />
            </Field>
            <Button
              type="submit"
              disabled={!keyword.trim() || !responseText.trim() || creatingRule}
            >
              {creatingRule ? "Guardando..." : "Guardar regla"}
            </Button>
          </div>
        </form>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">Nunca responder</h2>
            <p className="mt-2 text-sm text-slate-600">
              Numeros que TAKU puede recibir y guardar en conversaciones, pero
              nunca contestara con reglas ni bot.
            </p>
          </div>
          <Badge>{data.blockedContacts.length}</Badge>
        </div>

        <form
          onSubmit={createBlockedContact}
          className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <Field label="Numero">
            <Input
              placeholder="5219931175435"
              value={blockedPhoneNumber}
              onChange={setBlockedPhoneNumber}
            />
          </Field>
          <Field label="Nombre o etiqueta">
            <Input
              placeholder="Proveedor, socio, equipo interno"
              value={blockedLabel}
              onChange={setBlockedLabel}
            />
          </Field>
          <Field label="Motivo">
            <Input
              placeholder="No automatizar este contacto"
              value={blockedReason}
              onChange={setBlockedReason}
            />
          </Field>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={
                blockedPhoneNumber.replace(/\D/g, "").length < 8 ||
                creatingBlockedContact
              }
            >
              {creatingBlockedContact ? "Agregando..." : "Agregar"}
            </Button>
          </div>
        </form>

        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {["Numero", "Etiqueta", "Motivo", "Estado", "Acciones"].map(
                  (head) => (
                    <th key={head} className="px-4 py-3">
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.blockedContacts.map((contact) => (
                <tr key={contact.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {contact.phoneNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {contact.label ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {contact.reason ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      compact
                      checked={contact.enabled}
                      disabled={savingBlockedContactId === contact.id}
                      label={
                        savingBlockedContactId === contact.id
                          ? "Guardando"
                          : contact.enabled
                            ? "Activo"
                            : "Inactivo"
                      }
                      onChange={(enabled) =>
                        void updateBlockedContact(contact, enabled)
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="secondary"
                      disabled={deletingBlockedContactId === contact.id}
                      onClick={() => void deleteBlockedContact(contact)}
                    >
                      {deletingBlockedContactId === contact.id
                        ? "Eliminando..."
                        : "Eliminar"}
                    </Button>
                  </td>
                </tr>
              ))}
              {data.blockedContacts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={5}>
                    No hay numeros excluidos de respuestas automaticas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Asignaciones y reglas</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-3 font-semibold">
              Asignaciones
            </div>
            <div className="divide-y divide-slate-200">
              {data.assignments.map((assignment) => (
                <div key={assignment.id} className="grid gap-1 p-3 text-sm">
                  <p className="font-medium text-slate-950">
                    {data.accounts.find(
                      (account) => account.id === assignment.whatsappAccountId,
                    )?.displayName ?? "Numero"}{" "}
                    ·{" "}
                    {assignment.bot?.name ??
                      data.bots.find((bot) => bot.id === assignment.botId)
                        ?.name ??
                      "Bot"}
                  </p>
                  <p className="text-slate-500">
                    {assignment.mode} ·{" "}
                    {assignment.enabled ? "activo" : "inactivo"}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200">
            <div className="border-b border-slate-200 p-3 font-semibold">
              Reglas
            </div>
            <div className="divide-y divide-slate-200">
              {data.rules.map((rule) => (
                <div key={rule.id} className="grid gap-1 p-3 text-sm">
                  <p className="font-medium text-slate-950">{rule.keyword}</p>
                  <p className="text-slate-500">
                    {rule.matchType} · {rule.enabled ? "activa" : "inactiva"}
                  </p>
                  <p className="text-slate-700">{rule.responseText}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function HoursSectionConnected({
  data,
  onRefresh,
}: {
  data: TakuData;
  onRefresh: () => void;
}) {
  const dayNames = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miercoles",
    "Jueves",
    "Viernes",
    "Sabado",
  ];
  const [days, setDays] = useState(
    dayNames.map((_, dayOfWeek) => ({
      dayOfWeek,
      isClosed: false,
      opensAt: "09:00",
      closesAt: "18:00",
    })),
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!data.hours?.days.length) return;
    setDays(
      dayNames.map((_, dayOfWeek) => {
        const found = data.hours?.days.find(
          (day) => day.dayOfWeek === dayOfWeek,
        );
        return {
          dayOfWeek,
          isClosed: found?.isClosed ?? false,
          opensAt: found?.opensAt ?? "09:00",
          closesAt: found?.closesAt ?? "18:00",
        };
      }),
    );
  }, [data.hours]);

  async function saveHours() {
    await takuApi("/business-hours", {
      method: "PUT",
      body: JSON.stringify({ days }),
    });
    setMessage("Horario guardado.");
    onRefresh();
  }

  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Horarios"
        title="Horario de atencion"
        description="Si no hay horario configurado, TAKU considera el numero siempre activo."
        action={
          <Button onClick={() => void saveHours()}>Guardar horario</Button>
        }
      />
      {message ? (
        <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Estado actual</h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
            <Badge
              tone={
                data.hours?.currentStatus?.isOpen === false ? "warn" : "dark"
              }
            >
              {data.hours?.currentStatus?.label ?? "Siempre activo"}
            </Badge>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {data.hours?.currentStatus?.isOpen === false
                ? "Fuera de horario"
                : "Activo para responder"}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Zona horaria: {data.hours?.timezone ?? "America/Mexico_City"}
            </p>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold text-slate-950">Horario semanal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  {["Dia", "Abierto", "Apertura", "Cierre"].map((head) => (
                    <th key={head} className="px-4 py-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {days.map((day) => (
                  <tr key={day.dayOfWeek}>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {dayNames[day.dayOfWeek]}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={!day.isClosed}
                        label={day.isClosed ? "Cerrado" : "Abierto"}
                        onChange={(open) =>
                          setDays((current) =>
                            current.map((item) =>
                              item.dayOfWeek === day.dayOfWeek
                                ? { ...item, isClosed: !open }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        placeholder="09:00"
                        value={day.opensAt}
                        onChange={(opensAt) =>
                          setDays((current) =>
                            current.map((item) =>
                              item.dayOfWeek === day.dayOfWeek
                                ? { ...item, opensAt }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="time"
                        placeholder="18:00"
                        value={day.closesAt}
                        onChange={(closesAt) =>
                          setDays((current) =>
                            current.map((item) =>
                              item.dayOfWeek === day.dayOfWeek
                                ? { ...item, closesAt }
                                : item,
                            ),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function UsersSectionConnected({ data }: { data: TakuData }) {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Usuarios"
        title="Equipo y roles"
        description="Usuarios reales del workspace actual."
      />
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                {["Nombre", "Email", "Rol", "Estado", "Ultimo acceso"].map(
                  (head) => (
                    <th key={head} className="px-4 py-3">
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{user.email}</td>
                  <td className="px-4 py-3">
                    <Badge>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={user.status === "active" ? "dark" : "default"}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(user.lastLoginAt)}
                  </td>
                </tr>
              ))}
              {data.users.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-sm text-slate-500" colSpan={5}>
                    No hay usuarios visibles.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderSection(
  section: SectionId,
  role: Role,
  data: TakuData,
  onRefresh: () => void,
  onSection: (section: SectionId) => void,
  automationAccountId: string | null,
  onConfigureAutomation: (accountId: string) => void,
) {
  if (section === "home")
    return <HomeSection role={role} data={data} onSection={onSection} />;
  if (section === "conversations")
    return <ConversationsSection data={data} onRefresh={onRefresh} />;
  if (section === "numbers")
    return (
      <NumbersSection
        data={data}
        onRefresh={onRefresh}
        onConfigureAutomation={onConfigureAutomation}
      />
    );
  if (section === "automation")
    return (
      <AutomationSectionConnected
        data={data}
        onRefresh={onRefresh}
        initialAccountId={automationAccountId}
      />
    );
  if (section === "hours")
    return <HoursSectionConnected data={data} onRefresh={onRefresh} />;
  if (section === "users") return <UsersSectionConnected data={data} />;
  if (section === "settings") return <SettingsSection />;
  if (section === "billing") return <BillingSection />;
  if (section === "profile") return <ProfileSection />;
  if (section === "onboarding") return <OnboardingSection />;
  if (section === "states") return <StatesSection role={role} />;
  return <AuthSection />;
}

function dashboardRoleForAdmin(adminRole: string | undefined): Role {
  if (adminRole === "readonly_admin") return "agent";
  if (adminRole === "support_admin") return "admin";
  return "owner";
}

export default function MainDashboardMockPage() {
  const router = useRouter();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [hasAdminBackup, setHasAdminBackup] = useState(false);
  const [section, setSection] = useState<SectionId>("home");
  const [automationAccountId, setAutomationAccountId] = useState<string | null>(
    null,
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, isLoading, error } = useTakuData(refreshKey);
  const role = (session?.role as Role | undefined) ?? "owner";
  const visibleNav = useMemo(
    () => navItems.filter((item) => item.roles.includes(role)),
    [role],
  );

  useEffect(() => {
    setSession(getWorkspaceSession());
    setHasAdminBackup(hasOwnerModeAdminBackup());
  }, []);

  useEffect(() => {
    if (!navItems.find((nav) => nav.id === section)?.roles.includes(role)) {
      setSection("home");
    }
  }, [role, section]);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-5">
            <a href="/" className="flex items-center gap-3">
              <img
                src="/taku.png"
                alt="TAKU"
                className="h-10 w-10 rounded-lg border border-slate-200"
              />
              <div>
                <p className="text-sm font-bold tracking-[0.18em]">TAKU</p>
                <p className="text-xs text-slate-500">Orquestador</p>
              </div>
            </a>
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">
                {session?.currentWorkspace.name ?? "Workspace"}
              </p>
              <p className="mt-1 text-xs text-slate-500">Workspace activo</p>
              <div className="mt-3">
                <Badge tone="dark">
                  {session?.currentWorkspace.status ?? "activo"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sesion
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">
                {session?.user.name ?? "Usuario"}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {session?.user.email ?? "Sesion activa"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="dark">{session?.role ?? "owner"}</Badge>
                <Badge>{role}</Badge>
              </div>
            </div>
          </div>

          <nav className="grid gap-1 p-4">
            {visibleNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={cx(
                  "min-h-11 rounded-lg px-3 text-left text-sm font-semibold",
                  section === item.id
                    ? "bg-slate-950 text-white"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Dashboard web multitenant
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {navItems.find((item) => item.id === section)?.label}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  placeholder="Buscar..."
                  className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 sm:w-64"
                />
                {data.accounts.some(
                  (account) => account.status !== "connected",
                ) ? (
                  <Badge tone="warn">Hay numeros desconectados</Badge>
                ) : null}
                <Badge tone="dark">{session?.role ?? "owner"}</Badge>
                {hasAdminBackup ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      restoreOwnerModeAdminSession();
                      router.push("/admin");
                    }}
                  >
                    Volver a superowner
                  </Button>
                ) : (
                  <Button variant="secondary">Mi perfil</Button>
                )}
              </div>
            </div>
          </header>
          <div className="p-4 md:p-6">
            {error ? (
              <div className="mb-4 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700">
                {error}
              </div>
            ) : null}
            {isLoading ? (
              <div className="rounded-lg border border-slate-200 bg-white p-5 text-sm font-semibold text-slate-700">
                Cargando datos...
              </div>
            ) : (
              renderSection(
                section,
                role,
                data,
                () => setRefreshKey((current) => current + 1),
                setSection,
                automationAccountId,
                (accountId) => {
                  setAutomationAccountId(accountId);
                  setSection("automation");
                },
              )
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
