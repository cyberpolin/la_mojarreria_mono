import { useEffect, useState } from "react";
import styled from "styled-components/native";
import { useLazyQuery } from "@apollo/client";
import { PIN_LOGIN } from "./queries.gql";
import { Pressable } from "react-native";
import HContanier from "@/components/ui/HContanier";
import BTN from "@/components/ui/BTN";
import Logo from "@/components/ui/Logo";
import { Theme } from "@/constants/Colors";
import { APP_CONFIG } from "@/constants/config";
import useToast from "@/hooks/useToast";

const { Black, Gray } = Theme;

export default function PinScreen({ login }: { login: () => void }) {
  const [pin, setPin] = useState("");

  const [matchEmail, { loading, error: matchError }] = useLazyQuery(PIN_LOGIN);

  const { showError } = useToast();
  const isPinValid = pin.length === 4;

  const loginError = () => {
    showError("Error", "No se pudo verificar el PIN");
    setTimeout(() => {
      setPin("");
    }, 500);

    // TODO: add reporting to Sentry or similar
  };

  const autoSubmit = () => {
    if (isPinValid && !loading) {
      setTimeout(() => {
        handleSubmit();
      }, 300);
    }
  };

  const handlePress = (value: string) => {
    if (value === "Del") {
      setPin(pin.slice(0, -1));
    } else if (!isPinValid) {
      setPin((prev) => prev + value);
    }
  };

  const handleSubmit = async () => {
    if (!isPinValid) return;

    try {
      const email = APP_CONFIG.pinEmail;
      console.log("Verifying PIN for email:", email);
      const { data } = await matchEmail({
        variables: { email },
        fetchPolicy: "network-only",
      });
      if (data.auths[0].id) {
        console.log("PIN verified successfully");
        login();
      } else {
        loginError();
      }
    } catch (err) {
      loginError();
    }
  };
  useEffect(() => {
    if (matchError) {
      loginError();
    }
  }, [matchError]);

  useEffect(() => {
    autoSubmit();
  }, [pin]);

  return (
    <HContanier>
      <LogoContainer>
        <Logo />
      </LogoContainer>

      <SignUpContainer>
        <InsideContainer>
          <PinContainer>
            {[0, 1, 2, 3].map((i) => (
              <PinBox key={i}>
                <PinText>{pin[i] || ""}</PinText>
              </PinBox>
            ))}
          </PinContainer>
          <BTN
            text="Continuar"
            disabled={!isPinValid || loading}
            onPress={handleSubmit}
            loading={loading}
          />
        </InsideContainer>

        <InsideContainer>
          <Keypad>
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Del"].map(
              (val, index) => (
                <Key key={index} index={index} onPress={() => handlePress(val)}>
                  <KeyText>{val}</KeyText>
                </Key>
              ),
            )}
          </Keypad>
        </InsideContainer>
      </SignUpContainer>
    </HContanier>
  );
}

interface keyProps {
  index: number;
}

const SignUpContainer = styled.View`
  flex-direction: row;
  height: 100%;
`;

const InsideContainer = styled.View`
  width: 50%;
  justify-content: center;
  align-items: center;
  height: 100%;
`;

const LogoContainer = styled.View`
  justify-content: center;
  align-items: center;
`;

const PinContainer = styled.View`
  flex-direction: row;
  justify-content: center;
`;

const PinBox = styled.View`
  width: 70px;
  height: 70px;
  margin: 0 8px;
  border-width: 1px;
  border-color: ${Gray};
  border-radius: 8px;
  justify-content: center;
  align-items: center;
  background-color: #f3f3f3;
`;

const PinText = styled.Text`
  font-size: 24px;
  font-weight: bold;
`;

const Keypad = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  width: 280px;
`;

const Key = styled(Pressable)<keyProps>`
  width: ${({ index }) => (index === 10 ? "120px" : "80px")};
  height: 80px;
  margin: 5px;
  background-color: #f3f3f3;
  border-radius: 10px;
  justify-content: center;
  align-items: center;
  border-width: 1px;
  border-color: ${Gray};
`;

const KeyText = styled.Text`
  font-size: 22px;
  color: ${Black};
  font-weight: bold;
`;
