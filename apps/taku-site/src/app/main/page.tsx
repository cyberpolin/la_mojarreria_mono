"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminSession, type AdminUser } from "@/lib/auth";

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
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type="button"
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
}: {
  placeholder: string;
  readOnly?: boolean;
}) {
  return (
    <input
      readOnly={readOnly}
      placeholder={placeholder}
      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200 read-only:bg-slate-100"
    />
  );
}

function TextArea({
  placeholder,
  rows = 4,
}: {
  placeholder: string;
  rows?: number;
}) {
  return (
    <textarea
      rows={rows}
      placeholder={placeholder}
      className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200"
    />
  );
}

function Select({ children }: { children: React.ReactNode }) {
  return (
    <select className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-4 focus:ring-slate-200">
      {children}
    </select>
  );
}

function Switch({
  checked = false,
  label,
}: {
  checked?: boolean;
  label: string;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
      <span>{label}</span>
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

function HomeSection({ role }: { role: Role }) {
  const shownMetrics = role === "agent" ? agentMetrics : metrics;

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
            <Button>Ir a conversaciones</Button>
          ) : (
            <Button>Conectar numero</Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shownMetrics.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-slate-950">
              El numero Soporte esta desconectado.
            </p>
            <p className="mt-1 text-sm text-slate-600">
              No se podran enviar ni recibir mensajes hasta reconectarlo.
            </p>
          </div>
          {role === "agent" ? (
            <Badge tone="warn">Contacta a un administrador</Badge>
          ) : (
            <Button variant="secondary">Reconectar</Button>
          )}
        </div>
      </div>

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
                {phoneNumbers.map((number) => (
                  <tr key={number.name}>
                    <td className="px-4 py-3 text-slate-700">{number.phone}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {number.name}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={number.status === "Conectado" ? "dark" : "warn"}
                      >
                        {number.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {number.lastEvent}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="ghost">Ver</Button>
                    </td>
                  </tr>
                ))}
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
              {[
                "Ana respondio una conversacion.",
                "Se conecto el numero Ventas.",
                "Se actualizo el horario de atencion.",
                "El bot respondio fuera de horario.",
              ].map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
            <Badge tone="dark">Conectado</Badge>
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            {[
              ["Nombre del numero", "Ventas"],
              ["Numero telefonico", "+52 993 120 4488"],
              ["Ultima conexion", "Hoy 10:31"],
              ["Ultima desconexion", "Ayer 18:02"],
              ["Automatizacion asociada", "General activa"],
              ["Horario asociado", "Horario empresa"],
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
              <p>Juan Perez · Necesito una cotizacion...</p>
              <p>Clinica Norte · horario</p>
              <p>Maria Lopez · Gracias, manana paso.</p>
            </div>
          </div>
        </section>

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

function ConversationsSection() {
  const [selected, setSelected] = useState(conversations[0]);

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
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.phone}
                onClick={() => setSelected(conversation)}
                className={cx(
                  "grid w-full gap-2 p-4 text-left hover:bg-slate-50",
                  selected.phone === conversation.phone && "bg-slate-100",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {conversation.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {conversation.phone}
                    </p>
                  </div>
                  {conversation.unread ? (
                    <Badge tone="dark">{conversation.unread}</Badge>
                  ) : null}
                </div>
                <p className="line-clamp-2 text-sm text-slate-600">
                  {conversation.preview}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{conversation.channel}</span>
                  <span>{conversation.time}</span>
                  <Badge
                    tone={
                      conversation.status === "Sin responder"
                        ? "warn"
                        : "default"
                    }
                  >
                    {conversation.status}
                  </Badge>
                  {conversation.bot ? <Badge>Bot</Badge> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[680px] flex-col rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h2 className="font-semibold text-slate-950">{selected.name}</h2>
              <p className="text-sm text-slate-500">
                Respondiendo desde: {selected.channel} ({selected.phone})
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary">Asignar</Button>
              <Button variant="secondary">Cerrar</Button>
            </div>
          </div>
          <div className="flex-1 space-y-4 bg-slate-50 p-4">
            <div className="max-w-[75%] rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold text-slate-500">
                Cliente · 12:34 PM
              </p>
              <p className="mt-2 text-sm text-slate-800">
                Hola, tienen servicio a domicilio?
              </p>
            </div>
            <div className="ml-auto max-w-[75%] rounded-lg bg-slate-950 p-3 text-white">
              <p className="text-xs font-semibold text-slate-300">
                Ana · 12:35 PM
              </p>
              <p className="mt-2 text-sm">Si, tenemos servicio a domicilio.</p>
              <p className="mt-2 text-xs text-slate-300">Entregado</p>
            </div>
            <div className="mx-auto max-w-md rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
              Conversacion asignada a Ana.
            </div>
            <div className="max-w-[78%] rounded-lg border border-slate-300 bg-white p-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-500">
                  Bot · 8:15 PM
                </p>
                <Badge>Automatico</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-800">
                Gracias por escribir. Estamos fuera de horario. Te responderemos
                manana a partir de las 9:00 AM.
              </p>
            </div>
          </div>
          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-700">
              No puedes responder porque el numero "Soporte" esta desconectado.
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
              <TextArea placeholder="Escribe un mensaje..." rows={2} />
              <Button variant="secondary">Adjuntar</Button>
              <Button>Enviar</Button>
            </div>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-950">
            Detalles del contacto
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["Nombre", selected.name],
              ["Telefono", selected.phone],
              ["Numero receptor", selected.channel],
              ["Estado", selected.status],
              ["Agente asignado", selected.agent],
              ["Primera conversacion", "12 Jun 2026"],
              ["Ultima actividad", selected.time],
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
              <Input placeholder={selected.phone} readOnly />
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

function NumbersSection() {
  return (
    <div className="grid gap-6">
      <SectionHeader
        label="Numeros de WhatsApp"
        title="Administra conexiones y QR"
        description="Owner y Admin conectan, reconectan, editan y monitorean cada numero del workspace."
        action={<Button>Agregar numero</Button>}
      />

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
              {phoneNumbers.map((number) => (
                <tr key={number.name}>
                  <td className="px-4 py-3 font-medium text-slate-950">
                    {number.name}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{number.phone}</td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={number.status === "Conectado" ? "dark" : "warn"}
                    >
                      {number.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {number.lastEvent}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {number.lastDisconnect}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {number.automation}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button variant="ghost">Ver</Button>
                      <Button variant="ghost">QR</Button>
                      <Button variant="ghost">Desconectar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Agregar numero de WhatsApp
          </h2>
          <div className="mt-5 grid gap-4">
            <Field label="Nombre del numero">
              <Input placeholder="Ej. Ventas, Soporte, Sucursal Centro" />
            </Field>
            <Field label="Descripcion interna">
              <TextArea placeholder="Ej. Numero principal para pedidos y cotizaciones" />
            </Field>
            <Field label="Zona horaria">
              <Select>
                <option>America/Mexico_City</option>
              </Select>
            </Field>
            <Switch checked label="Usar horario general de la empresa" />
            <Switch checked label="Usar configuracion general del bot" />
            <div className="flex gap-3">
              <Button>Crear numero</Button>
              <Button variant="secondary">Cancelar</Button>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">
            Conectar numero por QR
          </h2>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5 text-center">
            <div className="mx-auto grid h-56 w-56 place-items-center rounded-lg border border-slate-300 bg-white text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              QR listo
            </div>
            <p className="mt-4 font-semibold text-slate-950">
              Escanea este codigo QR con WhatsApp
            </p>
            <ol className="mx-auto mt-3 max-w-sm list-decimal space-y-1 pl-5 text-left text-sm text-slate-600">
              <li>Abre WhatsApp en tu telefono.</li>
              <li>Ve a Dispositivos vinculados.</li>
              <li>Toca Vincular dispositivo.</li>
              <li>Escanea el codigo QR.</li>
            </ol>
            <div className="mt-5 flex justify-center gap-3">
              <Button>Regenerar QR</Button>
              <Button variant="secondary">Cancelar</Button>
            </div>
          </div>
        </section>
      </div>
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

function renderSection(section: SectionId, role: Role) {
  if (section === "home") return <HomeSection role={role} />;
  if (section === "conversations") return <ConversationsSection />;
  if (section === "numbers") return <NumbersSection />;
  if (section === "automation") return <AutomationSection />;
  if (section === "hours") return <HoursSection />;
  if (section === "users") return <UsersSection />;
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
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<SectionId>("home");
  const role = dashboardRoleForAdmin(adminUser?.role);
  const visibleNav = useMemo(
    () => navItems.filter((item) => item.roles.includes(role)),
    [role],
  );

  useEffect(() => {
    setAdminUser(getAdminSession()?.adminUser ?? null);
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
                La Mojarreria
              </p>
              <p className="mt-1 text-xs text-slate-500">Workspace activo</p>
              <div className="mt-3">
                <Badge tone="dark">Activo</Badge>
              </div>
            </div>
          </div>

          <div className="border-b border-slate-200 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Sesion
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-950">
                {adminUser?.name ?? "Super Admin"}
              </p>
              <p className="mt-1 break-all text-xs text-slate-500">
                {adminUser?.email ?? "Sesion activa"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone="dark">{adminUser?.role ?? "super_owner"}</Badge>
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
                <Badge tone="warn">Soporte desconectado</Badge>
                <Badge tone="dark">{adminUser?.role ?? "super_owner"}</Badge>
                <Button variant="secondary">Mi perfil</Button>
              </div>
            </div>
          </header>
          <div className="p-4 md:p-6">{renderSection(section, role)}</div>
        </section>
      </div>
    </main>
  );
}
