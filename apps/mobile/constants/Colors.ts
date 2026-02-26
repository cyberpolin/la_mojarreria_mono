/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

export const Theme = {
  Primary: "#f9703e",
  Gray: "#323F4B",
  GrayLight: "cbc2b9",
  GrayLighter: "#f5f7fa",
  Black: "#1f2933",
  Red: "#F29B9B",
  RedLighter: "#facdcd",
  YellowLighter: "#fcefc7",
  GreenLight: "#c1eac5",
  White: "#fff",
};

export const Colors = {
  light: {
    text: Theme.Black,
    background: Theme.White,
    tint: Theme.Primary,
    icon: Theme.Gray,
    tabIconDefault: Theme.Gray,
    tabIconSelected: Theme.Primary,
  },
  dark: {
    text: Theme.White,
    background: Theme.Black,
    tint: Theme.Primary,
    icon: Theme.GrayLight,
    tabIconDefault: Theme.GrayLight,
    tabIconSelected: Theme.Primary,
  },
};
