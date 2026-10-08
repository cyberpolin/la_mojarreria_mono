import { createStackNavigator } from "@react-navigation/stack";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import * as ScreenOrientation from "expo-screen-orientation";
// import available screens
import LandingScreen from "./LandingScreen";
import PortraitLandingScreen from "./PortraitLandingScreen";
import PortraitDailyCloseWizard from "./PortraitDailyCloseWizard";
import OperatorLoginScreen from "./OperatorLogin";
import { useLockedOrientation } from "./useLockedOrientation";
import CheckInOutScreen from "./CheckInOutScreen";
import DailySalesScreen from "./DailySales";
import DailySalesConfirmScreen from "./DailySalesConfirm";
import IncomeReportScreen from "./IncomeReport";
import OutcomeReportScreen from "./OutcomeReport";
import IncomeOutputResumeScreen from "./IncomeOutputResume";
import AllReportsScreen from "./AllReports";
import ActivePromosScreen from "./ActivePromosScreen";
import WhatsAppInboxScreen from "./WhatsAppInboxScreen";
import ConversationMobileScreen from "./ConversationMobileScreen";
import WeeklyReportScreen from "./WeeklyReportScreen";
import EmployeeAssistantStep1 from "./EmployeeAssistantStep1";
import EmployeeAssistantStep2 from "./EmployeeAssistantStep2";
import EmployeeAssistantStep3 from "./EmployeeAssistantStep3";
import { wizzardSteps, Screens } from "./Types";
import { BackHandler, View } from "react-native";
import SyncStatusBar from "./SyncStatusBar";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import TopActionDrawer from "./TopActionDrawer";

const noBackNavigationOptions = {
  headerShown: false,
  gestureEnabled: false,
};

export type RootStackParamList = {
  [Screens.PortraitLandingScreen]?: {};
  [Screens.PortraitDailyCloseWizardScreen]?: {};
  [Screens.LandingScreen]?: {};
  [Screens.CheckInOutScreen]?: {};
  [Screens.OperatorLoginScreen]?: {
    layout?: "portrait" | "landscape";
    nextScreen?:
      | Screens.DailySalesScreen
      | Screens.PortraitDailyCloseWizardScreen;
  };
  [Screens.DailySalesScreen]?: {};
  [Screens.DailySalesConfirmScreen]?: {};
  [Screens.IncomeReportScreen]?: {};
  [Screens.OutcomeReportScreen]?: {};
  [Screens.IncomeOutputResumeScreen]?: {};
  [Screens.AllReportsScreen]?: {};
  [Screens.ActivePromosScreen]?: {};
  [Screens.WhatsAppInboxScreen]?: {};
  [Screens.ConversationMobileScreen]?: {};
  [Screens.WeeklyReportScreen]?: {};
  [Screens.EmployeeAssistantStep1Screen]?: {};
  [Screens.EmployeeAssistantStep2Screen]?: {};
  [Screens.EmployeeAssistantStep3Screen]?: {};
};

const { Navigator, Screen } = createStackNavigator<RootStackParamList>();

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

const ScreenFrame = ({
  children,
  orientation = "landscape",
}: {
  children: ReactNode;
  orientation?: "landscape" | "portrait";
}) => {
  useLockedOrientation(
    orientation === "portrait"
      ? ScreenOrientation.OrientationLock.PORTRAIT_UP
      : ScreenOrientation.OrientationLock.LANDSCAPE,
  );
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

export default (_props: { initialPosition?: number | null }) => (
  <Navigator
    initialRouteName={Screens.PortraitLandingScreen}
    screenOptions={noBackNavigationOptions}
  >
    <Screen name={Screens.PortraitLandingScreen}>
      {(props) => (
        <ScreenFrame orientation="portrait">
          <PortraitLandingScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.PortraitDailyCloseWizardScreen}>
      {(props) => (
        <ScreenFrame orientation="portrait">
          <PortraitDailyCloseWizard {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.LandingScreen}>
      {(props) => (
        <ScreenFrame>
          <LandingScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.OperatorLoginScreen}>
      {(props) => (
        <ScreenFrame
          orientation={
            props.route.params?.layout === "portrait" ? "portrait" : "landscape"
          }
        >
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
    <Screen name={Screens.ActivePromosScreen}>
      {() => (
        <ScreenFrame>
          <ActivePromosScreen />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.WhatsAppInboxScreen}>
      {() => (
        <ScreenFrame>
          <WhatsAppInboxScreen />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.ConversationMobileScreen}>
      {(props) => (
        <ScreenFrame orientation="portrait">
          <ConversationMobileScreen {...props} />
        </ScreenFrame>
      )}
    </Screen>
    <Screen name={Screens.WeeklyReportScreen}>
      {() => (
        <ScreenFrame>
          <WeeklyReportScreen />
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
