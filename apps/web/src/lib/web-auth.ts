export const SESSION_COOKIE = "MOJARRERIA_WEB_SESSION";

const getEnvOrThrow = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

export const getExpectedSessionToken = () => getEnvOrThrow("WEB_SESSION_TOKEN");

export const validateCredentials = (email: string, password: string) => {
  const expectedEmail = getEnvOrThrow("SUPERADMIN_EMAIL");
  const expectedPassword = getEnvOrThrow("SUPERADMIN_PASSWORD");
  return email.trim() === expectedEmail && password === expectedPassword;
};
