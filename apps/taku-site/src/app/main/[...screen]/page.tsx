const routeLabels: Record<string, string> = {
  login: "Login",
  "forgot-password": "Recuperar contrasena",
  "reset-password": "Restablecer contrasena",
  dashboard: "Dashboard",
  conversations: "Conversaciones",
  "whatsapp-accounts": "Numeros de WhatsApp",
  automation: "Automatizacion",
  "business-hours": "Horarios",
  users: "Usuarios",
  settings: "Configuracion",
};

function titleFromSegments(segments: string[]) {
  const first = segments[0] ?? "dashboard";
  const label = routeLabels[first] ?? first;

  if (segments.includes("connect")) {
    return "Conectar numero por QR";
  }

  if (segments.length > 1 && first === "conversations") {
    return "Detalle de conversacion";
  }

  if (segments.length > 1 && first === "whatsapp-accounts") {
    return "Detalle de numero de WhatsApp";
  }

  if (first === "settings" && segments[1]) {
    return `Configuracion: ${segments[1]}`;
  }

  return label;
}

export default function MainMockRoutePage({
  params,
}: {
  params: { screen?: string[] };
}) {
  const segments = params.screen ?? [];
  const path = `/main/${segments.join("/")}`;
  const title = titleFromSegments(segments);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 md:px-6">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6">
        <a
          href="/main"
          className="text-sm font-semibold text-slate-700 hover:text-slate-950"
        >
          Volver al prototipo principal
        </a>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Ruta mock
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Esta ruta existe para representar la estructura del MVP descrita en la
          especificacion. La experiencia funcional y visual completa esta
          concentrada en el prototipo navegable de <code>/main</code>.
        </p>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Path
          </p>
          <code className="mt-2 block break-all text-sm text-slate-800">
            {path}
          </code>
        </div>
      </section>
    </main>
  );
}
