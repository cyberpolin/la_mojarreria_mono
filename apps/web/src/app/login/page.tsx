import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-lg shadow-black/40">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Mojarreria
          </p>
          <h1 className="text-2xl font-semibold">Superadmin login</h1>
          <p className="text-sm text-slate-400">
            Use your superadmin credentials to access the dashboard.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
