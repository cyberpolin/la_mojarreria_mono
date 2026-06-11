type AppConfig = {
  env: "development" | "prod" | "production";
  deviceId: string;
  clean: boolean;
  seed: boolean;
  keepAwake: {
    enabled: boolean;
    from: string;
    to: string;
  };
  dimScreen: {
    enabled: boolean;
    timeout: string;
    to: number;
  };
  apiUrl: string;
  apiMaintenanceApiKey: string;
  waApiBaseUrl: string;
  waApiKey: string;
  waChatApiKey: string;
  waClientDomain: string;
  qrUrl: string;
  pinEmail: string;
  bootstrapTeamUser: {
    userId: string;
    name: string;
    phone: string;
    pin: string;
  };
  timeoutMs: number;
  sentry: {
    dsn: string;
    enabled: boolean;
    tracesSampleRate: number;
  };
};

export const APP_CONFIG: AppConfig = {
  env: "development",
  deviceId: "Kiosk001",
  clean: false,
  seed: false,
  keepAwake: {
    enabled: true,
    from: "09:00",
    to: "18:00",
  },
  dimScreen: {
    enabled: true,
    timeout: "1",
    to: 0.2,
  },
  apiUrl: "http://192.168.0.251:3000",
  apiMaintenanceApiKey: "DAILY_CLOSE_REPROCESS_API_KEY",
  waApiBaseUrl: "https://api.wa.lamojarreria.com",
  waApiKey: "e9f82f13f65f1d07cda3b558e59e99bc696dbc4d57e0f000b4f544809eb15f9a",
  waChatApiKey: "DAILY_CLOSE_REPROCESS_API_KEY",
  waClientDomain: "lamojarreria.com",
  qrUrl: "https://app.lamojarreria.com",
  pinEmail: "cyberpolin@gmail.com",
  bootstrapTeamUser: {
    userId: "11111111-1111-4111-8111-111111111111",
    name: "SuperAdmin",
    phone: "521999999999",
    pin: "1234",
  },
  timeoutMs: 15000,
  sentry: {
    dsn: "",
    enabled: true,
    tracesSampleRate: 0.2,
  },
};
