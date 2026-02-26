import { H1, Subtitle } from "@/components/Typography";
import { View } from "react-native";

export const Header = ({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) => {
  return (
    <View
      style={[
        {
          flex: 0,
          marginTop: compact ? 20 : 25,
          marginBottom: compact ? 15 : 30,
          display: "flex",
          justifyContent: "center",
          flexDirection: "column",
        },
      ]}
    >
      <H1 style={{ fontSize: compact ? 25 : 30 }}>{title}</H1>
      {subtitle && (
        <Subtitle style={{ fontSize: compact ? 8 : 15 }}>{subtitle}</Subtitle>
      )}
    </View>
  );
};
export const Footer = ({ children }: { children: React.ReactNode }) => {
  return children ? (
    <View
      style={{
        flex: 0,
        display: "flex",
        justifyContent: "center",
        flexDirection: "row",
      }}
    >
      {children}
    </View>
  ) : null;
};
