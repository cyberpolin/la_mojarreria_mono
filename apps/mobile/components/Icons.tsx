import { AntDesign } from "@expo/vector-icons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type IconProps = {
  name?: undefined;
  size?: number;
  color?: string;
};

export const IconLogin = (props: IconProps) => (
  <AntDesign name="login" size={24} color="black" {...props} />
);

export const IconProfile = (props: IconProps) => (
  <AntDesign name="profile" size={24} color="black" {...props} />
);

export const IconPassword = (props: IconProps) => (
  <AntDesign name="key" size={24} color="black" {...props} />
);

export const IconSingUp = (props: IconProps) => (
  <AntDesign name="adduser" size={24} color="black" {...props} />
);

export const IconSettings = (props: IconProps) => (
  <AntDesign name="setting" size={24} color="black" {...props} />
);

export const IconHome = (props: IconProps) => (
  <AntDesign name="home" size={24} color="black" {...props} />
);

export const IconUser = (props: IconProps) => (
  <AntDesign name="user" size={24} color="black" {...props} />
);

export const IconSearch = (props: IconProps) => (
  <AntDesign name="search1" size={24} color="black" {...props} />
);

export const IconLogout = (props: IconProps) => (
  <AntDesign name="logout" size={24} color="black" {...props} />
);

export const IconFlashOn = (props: IconProps) => (
  <MaterialIcons name="flashlight-on" size={24} color="black" {...props} />
);

export const IconFlashOff = (props: IconProps) => (
  <MaterialIcons name="flashlight-off" size={24} color="black" {...props} />
);

export const IconScanQr = (props: IconProps) => (
  <MaterialIcons name="qr-code-scanner" size={24} color="black" {...props} />
);

export const IconDown = (props: IconProps) => (
  <AntDesign name="down" size={24} color="black" {...props} />
);

export const IconDriverLicense = (props: IconProps) => (
  <FontAwesome name="drivers-license-o" size={24} color="black" {...props} />
);

export const IconCheck = (props: IconProps) => (
  <AntDesign name="checkcircleo" size={24} color="black" {...props} />
);

export const IconUnCheck = (props: IconProps) => (
  <AntDesign name="closecircleo" size={24} color="black" {...props} />
);
export const IconWarning = (props: IconProps) => (
  <AntDesign name="exclamationcircleo" size={24} color="black" {...props} />
);
