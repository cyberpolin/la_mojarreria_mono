import { ActivityIndicator, View } from "react-native";

export default function Loader() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "darkgray",
      }}
    >
      <ActivityIndicator size="large" color="white" />
    </View>
  );
}
