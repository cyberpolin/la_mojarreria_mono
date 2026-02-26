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
  clean: true,
  seed: true,
  keepAwake: {
    enabled: true,
    from: "9:00",
    to: "18:00",
  },
  dimScreen: {
    enabled: true,
    timeout: "1",
    to: 0.2,
  },
  apiUrl: "http://192.168.1.241:3000",
  qrUrl: "http://192.168.1.241:19000",
  pinEmail: "cyberpolin@gmail.com",
  bootstrapTeamUser: {
    userId: "11111111-1111-4111-8111-111111111111",
    name: "Super Admin",
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
