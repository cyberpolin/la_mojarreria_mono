import React, { useCallback, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import GlobalProvider from "@/GlobalProvider";
import { ApolloProvider } from "@apollo/client";
import { StatusBar } from "expo-status-bar";
import { AppState, View } from "react-native";
import Inventory from "./app/(drawer)/Inventory";
import Board from "./app/(drawer)/Board";
// import useAuth from "./hooks/UseAuth";
import Toast from "react-native-toast-message";
import * as SplashScreen from "expo-splash-screen";
import LandingNavigationStack from "./app/DailyCloseFeature/NavigationStack";
import { useDailyCloseStore } from "./app/DailyCloseFeature/useDailyCloseStore";

import GeneralErrorScreen from "./app/DailyCloseFeature/GeneralErrorScreen";
import ErrorBoundary from "@/components/ErrorBoundary";
import Loading from "./components/Loading";

import { useInternetStatus } from "./hooks/UseInternetStatus";
import useToast from "./hooks/useToast";
import { useIntervalTasks } from "./hooks/UseInterval";
import { syncDailyCloses } from "./hooks/UseDailyClose";
import { useHealth } from "./hooks/UseHealth";
import dayjs from "dayjs";
import { client } from "./apollo/client";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Brightness from "expo-brightness";
import { APP_CONFIG } from "./constants/config";
import { reportError } from "./utils/errorLogger";
import {
  getOperatorCacheSummary,
  hasCachedOperators,
  syncDailyCloseOperators,
} from "./app/DailyCloseFeature/operatorCache";

// TODO: Error boundary testing with .env variable missing
SplashScreen.preventAutoHideAsync();

const Stack = createStackNavigator();
const BUSINESS_HOURS_KEEP_AWAKE_TAG = "business-hours-keep-awake";
const KEEP_AWAKE_ENABLED = APP_CONFIG.keepAwake.enabled;
const KEEP_AWAKE_FROM = APP_CONFIG.keepAwake.from;
const KEEP_AWAKE_TO = APP_CONFIG.keepAwake.to;
const DIM_SCREEN_ENABLED = APP_CONFIG.dimScreen.enabled;
const DIM_SCREEN_TIMEOUT = APP_CONFIG.dimScreen.timeout;
const DIM_SCREEN_TO = APP_CONFIG.dimScreen.to;

const parseTimeToMinutes = (value: string): number | null => {
  const normalized = value.trim();
  const match = normalized.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);

  if (!match) return null;

  const [, hourString, minuteString] = match;
  const hour = Number(hourString);
  const minute = Number(minuteString);

  return hour * 60 + minute;
};

const parseDurationToMs = (value: string): number | null => {
  const normalized = value.trim();

  if (!normalized) return null;

  if (/^\d+$/.test(normalized)) {
    return Number(normalized) * 60_000;
  }

  const match = normalized.match(/^(\d+):([0-5]\d)$/);
  if (!match) return null;

  const [, minutesString, secondsString] = match;
  const minutes = Number(minutesString);
  const seconds = Number(secondsString);

  return (minutes * 60 + seconds) * 1000;
};

const clampDimTo = (value: number): number => {
  if (!Number.isFinite(value)) return 0.5;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const KEEP_AWAKE_START_MINUTES = parseTimeToMinutes(KEEP_AWAKE_FROM);
const KEEP_AWAKE_END_MINUTES = parseTimeToMinutes(KEEP_AWAKE_TO);
const HAS_VALID_KEEP_AWAKE_WINDOW =
  KEEP_AWAKE_START_MINUTES !== null && KEEP_AWAKE_END_MINUTES !== null;
const DIM_TIMEOUT_MS = parseDurationToMs(DIM_SCREEN_TIMEOUT) ?? 5 * 60_000;
const CLAMPED_DIM_TO = clampDimTo(DIM_SCREEN_TO);
const SENTRY_ENABLED =
  APP_CONFIG.sentry.enabled && APP_CONFIG.sentry.dsn.trim().length > 0;

Sentry.init({
  dsn: APP_CONFIG.sentry.dsn,
  enabled: SENTRY_ENABLED,
  environment: APP_CONFIG.env,
  tracesSampleRate: APP_CONFIG.sentry.tracesSampleRate,
  debug: __DEV__,
});

const isWithinKeepAwakeWindow = (date: Date = new Date()) => {
  if (!HAS_VALID_KEEP_AWAKE_WINDOW) return false;

  const nowMinutes = date.getHours() * 60 + date.getMinutes();

  if (KEEP_AWAKE_START_MINUTES === KEEP_AWAKE_END_MINUTES) return true;

  if (KEEP_AWAKE_START_MINUTES < KEEP_AWAKE_END_MINUTES) {
    return (
      nowMinutes >= KEEP_AWAKE_START_MINUTES &&
      nowMinutes < KEEP_AWAKE_END_MINUTES
    );
  }

  return (
    nowMinutes >= KEEP_AWAKE_START_MINUTES ||
    nowMinutes < KEEP_AWAKE_END_MINUTES
  );
};

const useBusinessHoursKeepAwake = () => {
  useEffect(() => {
    if (!KEEP_AWAKE_ENABLED) return;

    if (!HAS_VALID_KEEP_AWAKE_WINDOW) {
      console.warn(
        "[KEEP_AWAKE]: Invalid time window. Use HH:mm format in EXPO_PUBLIC_KEEP_AWAKE_FROM / EXPO_PUBLIC_KEEP_AWAKE_TO",
      );
      return;
    }

    let isKeepAwakeEnabled = false;

    const syncKeepAwake = async () => {
      try {
        const shouldEnable = isWithinKeepAwakeWindow();

        if (shouldEnable && !isKeepAwakeEnabled) {
          await activateKeepAwakeAsync(BUSINESS_HOURS_KEEP_AWAKE_TAG);
          isKeepAwakeEnabled = true;
        } else if (!shouldEnable && isKeepAwakeEnabled) {
          await deactivateKeepAwake(BUSINESS_HOURS_KEEP_AWAKE_TAG);
          isKeepAwakeEnabled = false;
        }
      } catch (error) {
        console.warn("[KEEP_AWAKE]:", error);
      }
    };

    syncKeepAwake();

    const intervalId = setInterval(() => {
      syncKeepAwake();
    }, 60 * 1000);

    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          syncKeepAwake();
        }
      },
    );

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();

      if (isKeepAwakeEnabled) {
        deactivateKeepAwake(BUSINESS_HOURS_KEEP_AWAKE_TAG).catch(() => {});
      }
    };
  }, []);
};

// const AuthStack = ({ login }: { login: () => void }) => (
//   <Stack.Navigator
//     initialRouteName="Login"
//     screenOptions={{ headerShown: false }}
//   >
//     <Stack.Screen name="Login">
//       {(props) => <Login {...props} login={login} />}
//     </Stack.Screen>
//   </Stack.Navigator>
// );

const AppStack = ({ logout }: { logout: () => void }) => {
  //   const [initialRoute, setInitialRoute] = useState<string | null>(null);
  //   const [isLoading, setIsLoading] = useState(true);

  // useEffect(() => {
  //   const checkInitialRoute = async () => {
  //     try {
  //       const inBoard = await AsyncStorage.getItem("inBoard");
  //       setInitialRoute(inBoard === "true" ? "Board" : "Inventory");
  //     } catch (error) {
  //       console.error("Error reading AsyncStorage:", error);
  //       setInitialRoute("Inventory");
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   }

  //   checkInitialRoute();
  // }, []);

  return (
    <Stack.Navigator
      initialRouteName={"Board"}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Inventory">
        {(props) => <Inventory {...props} logout={logout} />}
      </Stack.Screen>
      <Stack.Screen name="Board" component={Board} />
    </Stack.Navigator>
  );
};

const RootComponent = () => {
  useBusinessHoursKeepAwake();

  const { showWarning, showInfo } = useToast();
  // const { user, loginWithCredentials, handleLogout } = useAuth();
  const state = useDailyCloseStore((s) => s);
  const hasHydrated = useDailyCloseStore((s) => s.hasHydrated);
  const { stepPosition } = useDailyCloseStore((s) => s.temporalSale);
  const setLastSyncedDate = useDailyCloseStore((s) => s.setLastSyncedDate);
  const { isInternetReachable } = useInternetStatus();
  const shouldSync = useDailyCloseStore((s) => s.shouldSync());
  const { addTask, removeTask } = useIntervalTasks();
  const { data: health, error: healthError } = useHealth(true);
  const dimmerStateRef = useRef<{
    lastActivityAt: number;
    isDimmed: boolean;
    originalBrightness: number | null;
  }>({
    lastActivityAt: Date.now(),
    isDimmed: false,
    originalBrightness: null,
  });

  const restoreBrightness = useCallback(async () => {
    const dimmerState = dimmerStateRef.current;
    if (!dimmerState.isDimmed) return;

    try {
      await Brightness.setBrightnessAsync(dimmerState.originalBrightness ?? 1);
    } catch (error) {
      console.warn("[DIM_SCREEN]: restore failed", error);
    } finally {
      dimmerState.isDimmed = false;
    }
  }, []);

  const registerUserActivity = useCallback(() => {
    dimmerStateRef.current.lastActivityAt = Date.now();
    restoreBrightness();
  }, [restoreBrightness]);

  console.log("[ROOT]:state", {
    lastSyncedDate: state.lastSyncedDate,
    closesByDate: state.closesByDate,
  });

  useEffect(() => {
    if (health) console.log("[HEALTH]:", health);
    if (healthError) console.error("[HEALTH_ERROR]:", healthError);
  }, [health, healthError]);

  useEffect(() => {
    if (!health?.ok || !isInternetReachable) return;

    let cancelled = false;
    const bootstrapOperators = async () => {
      try {
        const result = await syncDailyCloseOperators(client);
        if (cancelled) return;
        if (result.changed) {
          showInfo("Equipo actualizado", "Usuarios de cierre sincronizados.");
        }
      } catch (error) {
        if (cancelled) return;
        const hasUsers = await hasCachedOperators();
        if (!hasUsers) {
          showWarning(
            "Sin usuarios de cierre",
            "No se pudieron descargar usuarios del equipo. Contacta soporte.",
          );
        }
        reportError(error, {
          tags: { scope: "daily_close_operator_bootstrap" },
        });
      } finally {
        if (!cancelled) {
          const summary = await getOperatorCacheSummary();
          console.log("[TEAM_USERS_CACHE]:", summary);
        }
      }
    };

    bootstrapOperators();
    return () => {
      cancelled = true;
    };
  }, [health?.ok, isInternetReachable, showInfo, showWarning]);

  useEffect(() => {
    if (shouldSync) {
      addTask("syncDailyCloses", async () => {
        if (!isInternetReachable) return;

        const sync = await syncDailyCloses();

        if (sync.ok) {
          setLastSyncedDate(dayjs(sync.syncedAt).format("YYYY-MM-DD"));
          showInfo(
            "Sincronización exitosa",
            "Los cierres diarios se han sincronizado correctamente.",
          );
        } else {
          showWarning(
            "Error de sincronización",
            "No se pudieron sincronizar los cierres diarios.",
          );
        }
      });
    } else {
      removeTask("syncDailyCloses");
    }
  }, [
    shouldSync,
    isInternetReachable,
    addTask,
    removeTask,
    showInfo,
    showWarning,
    setLastSyncedDate,
  ]);

  useEffect(() => {
    if (!DIM_SCREEN_ENABLED) {
      removeTask("dimScreen");
      return;
    }

    if (parseDurationToMs(DIM_SCREEN_TIMEOUT) === null) {
      console.warn(
        `[DIM_SCREEN]: Invalid EXPO_PUBLIC_DIM_TIMEOUT "${DIM_SCREEN_TIMEOUT}". Falling back to 5:00.`,
      );
    }

    addTask("dimScreen", async () => {
      const dimmerState = dimmerStateRef.current;
      const idleForMs = Date.now() - dimmerState.lastActivityAt;
      const shouldDim = idleForMs >= DIM_TIMEOUT_MS;

      if (!shouldDim || dimmerState.isDimmed) return;

      try {
        dimmerState.originalBrightness = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(CLAMPED_DIM_TO);
        dimmerState.isDimmed = true;
      } catch (error) {
        console.warn("[DIM_SCREEN]: dim failed", error);
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        registerUserActivity();
      }
    });

    return () => {
      removeTask("dimScreen");
      appStateSubscription.remove();
      restoreBrightness();
    };
  }, [addTask, registerUserActivity, removeTask, restoreBrightness]);

  if (!hasHydrated) {
    // TODO: move it into its own screen component
    return <Loading />;
  }

  return (
    <>
      <StatusBar hidden />
      {/* // create a notification toast when internet is not reachable */}
      <View
        style={{ flex: 1 }}
        onTouchStart={registerUserActivity}
        onStartShouldSetResponderCapture={() => {
          registerUserActivity();
          return false;
        }}
      >
        <NavigationContainer>
          {/* {user || true ? (
        <AppStack logout={handleLogout} />
        ) : (
          <AuthStack login={loginWithCredentials} />
          )} */}
          <LandingNavigationStack initialPosition={stepPosition} />
        </NavigationContainer>
      </View>
    </>
  );
};

const App = () => {
  useEffect(() => {
    const timer = setTimeout(async () => {
      await SplashScreen.hideAsync();
    }, 100); // TODO:whats this for?

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const errorUtils = (
      global as unknown as {
        ErrorUtils?: {
          getGlobalHandler?: () =>
            | ((error: Error, isFatal?: boolean) => void)
            | undefined;
          setGlobalHandler?: (
            handler: (error: Error, isFatal?: boolean) => void,
          ) => void;
        };
      }
    ).ErrorUtils;

    const previousHandler = errorUtils?.getGlobalHandler?.();

    errorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      reportError(error, {
        tags: { scope: "global_handler", fatal: String(Boolean(isFatal)) },
      });
      previousHandler?.(error, isFatal);
    });

    return () => {
      if (previousHandler) {
        errorUtils?.setGlobalHandler?.(previousHandler);
      }
    };
  }, []);

  return (
    <ErrorBoundary FallbackComponent={GeneralErrorScreen}>
      <GlobalProvider>
        <ApolloProvider client={client}>
          <RootComponent />
          <Toast />
        </ApolloProvider>
      </GlobalProvider>
    </ErrorBoundary>
  );
};

export default Sentry.wrap(App);
