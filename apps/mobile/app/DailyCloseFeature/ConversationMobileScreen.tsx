import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import dayjs from "dayjs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Label } from "@/components/Typography";
import { APP_CONFIG } from "@/constants/config";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";
import { useOpenAppMenu } from "./appMenuContext";
import { isAfterDailyCloseHour } from "./helpers";
import { useDailyCloseStore } from "./useDailyCloseStore";

const CONVERSATION_MOBILE_URL = "https://taku.lat/conversation-mobile?from=app";
const SKIP_OPERATOR_LOGIN = true;

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.ConversationMobileScreen
>;

export default function ConversationMobileScreen({ navigation }: Props) {
  const webViewRef = useRef<WebView>(null);
  const openMenu = useOpenAppMenu();
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const source = useMemo(() => ({ uri: CONVERSATION_MOBILE_URL }), []);

  const closesByDate = useDailyCloseStore((state) => state.closesByDate);
  const setCloseOperator = useDailyCloseStore(
    (state) => state.setCloseOperator,
  );
  const todayDateString = dayjs(now).format("YYYY-MM-DD");
  const isAlreadyClosed = Object.keys(closesByDate).includes(todayDateString);
  const showCloseCash = isAfterDailyCloseHour(now) && !isAlreadyClosed;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000 * 30);
    return () => clearInterval(id);
  }, []);

  const onCloseCash = () => {
    if (SKIP_OPERATOR_LOGIN) {
      setCloseOperator({
        userId: APP_CONFIG.bootstrapTeamUser.userId,
        name: APP_CONFIG.bootstrapTeamUser.name,
        phone: APP_CONFIG.bootstrapTeamUser.phone,
        validatedAt: dayjs().toISOString(),
      });
      navigation.navigate(Screens.PortraitDailyCloseWizardScreen);
      return;
    }
    navigation.navigate(Screens.OperatorLoginScreen, {
      layout: "portrait",
      nextScreen: Screens.PortraitDailyCloseWizardScreen,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          paddingTop: 8,
          minHeight: 52,
          backgroundColor: "#0f172a",
        }}
      >
        {canGoBack ? (
          <Pressable
            onPress={() => webViewRef.current?.goBack()}
            style={{
              minHeight: 44,
              minWidth: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel="Atrás"
          >
            <Ionicons name="chevron-back" size={22} color="#e2e8f0" />
          </Pressable>
        ) : (
          <View style={{ minWidth: 44 }} />
        )}
        <Label style={{ color: "#e2e8f0", fontSize: 14 }}>TAKU chat</Label>
        <Pressable
          onPress={() => openMenu?.()}
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Menú"
        >
          <Ionicons name="menu" size={26} color="#e2e8f0" />
        </Pressable>
      </View>
      {showCloseCash ? (
        <Pressable
          onPress={onCloseCash}
          style={{
            width: "100%",
            minHeight: 64,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityLabel="Hacer cierre de caja"
        >
          <Label style={{ color: "#0f172a", fontSize: 20, fontWeight: "700" }}>
            Hacer cierre de caja
          </Label>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={source}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          allowsInlineMediaPlayback
          mixedContentMode="always"
          originWhitelist={["*"]}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
          }}
        />
        {isLoading ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f8fafc",
            }}
          >
            <ActivityIndicator color="#0f172a" />
          </View>
        ) : null}
      </View>
    </View>
  );
}
