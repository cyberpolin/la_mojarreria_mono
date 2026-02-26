import { createStackNavigator } from "@react-navigation/stack";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
// import available screens
import LandingScreen from "./LandingScreen";
import OperatorLoginScreen from "./OperatorLogin";
import CheckInOutScreen from "./CheckInOutScreen";
import DailySalesScreen from "./DailySales";
import DailySalesConfirmScreen from "./DailySalesConfirm";
import IncomeReportScreen from "./IncomeReport";
import OutcomeReportScreen from "./OutcomeReport";
import IncomeOutputResumeScreen from "./IncomeOutputResume";
import AllReportsScreen from "./AllReports";
import EmployeeAssistantStep1 from "./EmployeeAssistantStep1";
import EmployeeAssistantStep2 from "./EmployeeAssistantStep2";
import EmployeeAssistantStep3 from "./EmployeeAssistantStep3";
import { wizzardSteps, Screens } from "./Types";
import { BackHandler, View } from "react-native";
import SyncStatusBar from "./SyncStatusBar";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import TopActionDrawer from "./TopActionDrawer";

const { Navigator, Screen } = createStackNavigator();
const noBackNavigationOptions = {
  headerShown: false,
  gestureEnabled: false,
};

export type RootStackParamList = {
  [Screens.LandingScreen]?: {};
  [Screens.CheckInOutScreen]?: {};
  [Screens.OperatorLoginScreen]?: {};
  [Screens.DailySalesScreen]?: {};
  [Screens.DailySalesConfirmScreen]?: {};
  [Screens.IncomeReportScreen]?: {};
  [Screens.OutcomeReportScreen]?: {};
  [Screens.IncomeOutputResumeScreen]?: {};
  [Screens.AllReportsScreen]?: {};
  [Screens.EmployeeAssistantStep1Screen]?: {};
  [Screens.EmployeeAssistantStep2Screen]?: {};
  [Screens.EmployeeAssistantStep3Screen]?: {};
};

const useBlockBackNavigation = () => {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const hardwareBack = BackHandler.addEventListener(
        "hardwareBackPress",
        () => true,
      );

      const unsubscribeBeforeRemove = navigation.addListener(
        "beforeRemove",
        (event) => {
          const actionType = event.data.action?.type;
          if (
            actionType === "GO_BACK" ||
            actionType === "POP" ||
            actionType === "POP_TO_TOP"
          ) {
            event.preventDefault();
          }
        },
      );

      return () => {
        hardwareBack.remove();
        unsubscribeBeforeRemove();
      };
    }, [navigation]),
  );
};

const ScreenFrame = ({ children }: { children: ReactNode }) => {
  useBlockBackNavigation();
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <SyncStatusBar onSwipeDown={() => setIsDrawerVisible(true)} />
      <View style={{ flex: 1 }}>{children}</View>
      <TopActionDrawer
        visible={isDrawerVisible}
        onClose={() => setIsDrawerVisible(false)}
      />
    </View>
  );
};

export default ({ initialPosition }: { initialPosition?: number | null }) => (
  <Navigator
    initialRouteName={
      initialPosition ? wizzardSteps[initialPosition] : Screens.LandingScreen
    }
    screenOptions={noBackNavigationOptions}
  >
    <Screen name={Screens.LandingScreen}>
      {(props) => (
        <ScreenFrame>
          <LandingScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.OperatorLoginScreen}>
      {(props) => (
        <ScreenFrame>
          <OperatorLoginScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.CheckInOutScreen}>
      {(props) => (
        <ScreenFrame>
          <CheckInOutScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.DailySalesScreen}>
      {(props) => (
        <ScreenFrame>
          <DailySalesScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.DailySalesConfirmScreen}>
      {(props) => (
        <ScreenFrame>
          <DailySalesConfirmScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.IncomeReportScreen}>
      {(props) => (
        <ScreenFrame>
          <IncomeReportScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.OutcomeReportScreen}>
      {(props) => (
        <ScreenFrame>
          <OutcomeReportScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.IncomeOutputResumeScreen}>
      {(props) => (
        <ScreenFrame>
          <IncomeOutputResumeScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.AllReportsScreen}>
      {(props) => (
        <ScreenFrame>
          <AllReportsScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.EmployeeAssistantStep1Screen}>
      {(props) => (
        <ScreenFrame>
          <EmployeeAssistantStep1 {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.EmployeeAssistantStep2Screen}>
      {(props) => (
        <ScreenFrame>
          <EmployeeAssistantStep2 {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.EmployeeAssistantStep3Screen}>
      {(props) => (
        <ScreenFrame>
          <EmployeeAssistantStep3 {...props} />
        </ScreenFrame>
      )}
    </Screen>
  </Navigator>
);
