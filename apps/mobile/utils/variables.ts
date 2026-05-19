import { APP_CONFIG } from "@/constants/config";

const ENV_VARS: Record<string, string> = {
  EXPO_PUBLIC_ENV: APP_CONFIG.env,
  EXPO_PUBLIC_DEVICE_ID: APP_CONFIG.deviceId,
  EXPO_PUBLIC_CLEAN: String(APP_CONFIG.clean),
  EXPO_PUBLIC_SEED: String(APP_CONFIG.seed),
  EXPO_PUBLIC_KEEP_AWAKE: String(APP_CONFIG.keepAwake.enabled),
  EXPO_PUBLIC_KEEP_AWAKE_FROM: APP_CONFIG.keepAwake.from,
  EXPO_PUBLIC_KEEP_AWAKE_TO: APP_CONFIG.keepAwake.to,
  EXPO_PUBLIC_DIM_SCREEN: String(APP_CONFIG.dimScreen.enabled),
  EXPO_PUBLIC_DIM_TIMEOUT: APP_CONFIG.dimScreen.timeout,
  EXPO_PUBLIC_DIM_TO: String(APP_CONFIG.dimScreen.to),
  EXPO_PUBLIC_API_URL: APP_CONFIG.apiUrl,
  EXPO_PUBLIC_QR_URL: APP_CONFIG.qrUrl,
  EXPO_PUBLIC_PIN_EMAIL: APP_CONFIG.pinEmail,
  EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_ID: APP_CONFIG.bootstrapTeamUser.userId,
  EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_NAME: APP_CONFIG.bootstrapTeamUser.name,
  EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PHONE: APP_CONFIG.bootstrapTeamUser.phone,
  EXPO_PUBLIC_BOOTSTRAP_TEAM_USER_PIN: APP_CONFIG.bootstrapTeamUser.pin,
  EXPO_PUBLIC_TIMEOUT: String(APP_CONFIG.timeoutMs),
};

export const getENV = (key: string) => {
  const value = ENV_VARS[key];
  if (value === undefined) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};
