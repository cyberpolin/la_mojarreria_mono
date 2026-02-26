import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { RecoilRoot } from "recoil";

const GlobalProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <RecoilRoot>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          {children}
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </RecoilRoot>
  );
};

export default GlobalProvider;
