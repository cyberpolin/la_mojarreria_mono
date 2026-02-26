import styled from "styled-components/native";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect, useState } from "react";
import QRCode from "react-native-qrcode-svg";
import { Pressable, ViewProps, Modal } from "react-native";
import { Theme } from "@/constants/Colors";
import { APP_CONFIG } from "@/constants/config";
import { CREATE_QR_STAFF } from "./queries.gql";
import { useMutation } from "@apollo/client";

const { Primary, GrayLighter, White } = Theme;

interface HContainerProps extends ViewProps {
  children: React.ReactNode;
  row?: boolean;
  longpressIsActive?: boolean;
}

export default function HContainer({
  children,
  row = false,
  longpressIsActive = false,
}: HContainerProps) {
  const [sideMenuIsOpen, setSideMenuIsOpen] = useState(false);
  const [timeClockModalVisible, setTimeClockModalVisible] = useState(false);
  const [token, setToken] = useState("");

  const [createQRStaff] = useMutation(CREATE_QR_STAFF);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        // Set to landscape orientation
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE,
        );
      } catch (error) {
        console.error("Failed to lock orientation:", error);
      }
    };
    lockOrientation();
  }, []);

  const openTimeClock = async () => {
    setSideMenuIsOpen(false);
    setTimeClockModalVisible(true);
    const { data } = await createQRStaff();
    console.log(data);
    setToken(data.createQRStaff?.token);
  };

  return (
    <Pressable
      style={{ flex: 1 }}
      onLongPress={() => {
        if (longpressIsActive) {
          setSideMenuIsOpen(true);
        }
      }}
      delayLongPress={3000}
    >
      <Container row={row}>{children}</Container>

      {/* Side Menu */}
      {sideMenuIsOpen && (
        <SideMenuContainer>
          <SideMenu>
            <SideMenuButton onPress={() => setSideMenuIsOpen(false)}>
              <MenuButtonText>Cerrar</MenuButtonText>
            </SideMenuButton>
            <SideMenuButton onPress={openTimeClock}>
              <MenuButtonText>Reloj checador</MenuButtonText>
            </SideMenuButton>
          </SideMenu>
        </SideMenuContainer>
      )}

      {/* Modal del Reloj Checador */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={timeClockModalVisible}
        onRequestClose={() => {
          setTimeClockModalVisible(false);
        }}
      >
        <ModalContainer>
          <ModalContent>
            <ModalHeader>
              <ModalText>Reloj Checador</ModalText>
              <CloseButton onPress={() => setTimeClockModalVisible(false)}>
                <CloseButtonText>X</CloseButtonText>
              </CloseButton>
            </ModalHeader>
            <ModalBody>
              <QRCode
                value={`${APP_CONFIG.qrUrl}/staff-login/${token}`}
                size={250}
              />
              <ModalText>Escaneame</ModalText>
            </ModalBody>
          </ModalContent>
        </ModalContainer>
      </Modal>
    </Pressable>
  );
}

interface ContainerProps {
  row?: boolean;
}

const Container = styled.View<ContainerProps>`
  flex: 1;
  background-color: ${GrayLighter};
  padding: 10px 20px;
  flex-direction: ${({ row }) => (row ? "row" : "column")};
`;

const SideMenuContainer = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.5);
  justify-content: flex-end;
`;

const SideMenu = styled.View`
  padding: 20px;
  background-color: white;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
`;

const SideMenuButton = styled.Pressable`
  padding: 16px;
  background-color: ${Primary};
  border-radius: 8px;
  margin-bottom: 16px;
`;

const MenuButtonText = styled.Text`
  font-size: 16px;
  text-align: center;
  color: ${White};
`;

const ModalContainer = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
`;

const ModalContent = styled.View`
  width: 90%;
  background-color: ${White};
  border-radius: 16px;
  padding: 20px;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.25;
  shadow-radius: 4px;
  elevation: 5;
`;

const ModalHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const ModalText = styled.Text`
  font-size: 20px;
  font-weight: bold;
  color: ${Primary};
`;
const ModalBody = styled.View`
  align-items: center;
  margin-bottom: 20px;
`;

const CloseButton = styled.Pressable``;

const CloseButtonText = styled.Text`
  font-size: 25px;
  font-weight: bold;
`;
