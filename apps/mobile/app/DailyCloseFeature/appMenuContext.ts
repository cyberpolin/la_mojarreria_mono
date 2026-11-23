import { createContext, useContext } from "react";

export const OpenAppMenuContext = createContext<(() => void) | null>(null);

export function useOpenAppMenu() {
  return useContext(OpenAppMenuContext);
}
