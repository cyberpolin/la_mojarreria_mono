import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Label } from "@/components/Typography";
import { SecondaryButton } from "@/components/ui/Buttons";
import { RootStackParamList } from "./NavigationStack";
import { Screens } from "./Types";

const CONVERSATION_MOBILE_URL = "https://taku.lat/conversation-mobile?from=app";

type Props = NativeStackScreenProps<
  RootStackParamList,
  Screens.ConversationMobileScreen
>;

export default function ConversationMobileScreen({ navigation }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const source = useMemo(() => ({ uri: CONVERSATION_MOBILE_URL }), []);

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
        <SecondaryButton
          style={{ margin: 0 }}
          textStyle={{ fontSize: 12, color: "#e2e8f0" }}
          onPress={() => {
            if (canGoBack) {
              webViewRef.current?.goBack();
              return;
            }
            navigation.navigate(Screens.PortraitLandingScreen);
          }}
        >
          {canGoBack ? "Atrás" : "Cerrar"}
        </SecondaryButton>
        <Label style={{ color: "#e2e8f0", fontSize: 14 }}>TAKU chat</Label>
        <SecondaryButton
          style={{ margin: 0 }}
          textStyle={{ fontSize: 12, color: "#e2e8f0" }}
          onPress={() => webViewRef.current?.reload()}
        >
          Recargar
        </SecondaryButton>
      </View>
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
