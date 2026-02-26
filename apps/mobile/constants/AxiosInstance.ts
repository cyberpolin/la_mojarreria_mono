import { APP_CONFIG } from "./config";

const delayTime = APP_CONFIG.env !== "prod" ? 500 : 0;

type RequestConfig = {
  timeout?: number;
  headers?: Record<string, string>;
};

type ApiResponse<T> = {
  data: T;
  status: number;
  headers: Headers;
};

function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  controller.signal.addEventListener("abort", () => clearTimeout(timer), {
    once: true,
  });
  return controller.signal;
}

async function get<T>(
  path: string,
  config: RequestConfig = {},
): Promise<ApiResponse<T>> {
  const timeout = config.timeout ?? 10000;
  const response = await fetch(`${APP_CONFIG.apiUrl}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(config.headers ?? {}),
    },
    signal: createTimeoutSignal(timeout),
  });

  let data: T;
  try {
    data = (await response.json()) as T;
  } catch {
    data = {} as T;
  }

  if (!response.ok) {
    if (response.status === 401) {
      console.log("Session expired or unauthorized");
    }
    throw new Error(`HTTP ${response.status}`);
  }

  if (delayTime > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayTime));
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  };
}

const axiosInstance = { get };

export default axiosInstance;
