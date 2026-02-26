import { atom, selector } from "recoil";
import type { UserLicense } from "@/constants/types/UserLicense.d";

export const userState = atom({
  key: "userState",
  default: {
    isLogged: true,
    user: {},
    loading: false,
  },
});

export const userStateSelector = selector({
  key: "userStateSelector",
  get: ({ get }) => {
    return get(userState);
  },
});

export const QRLicenseState = atom({
  key: "QRLisenceState",
  default: {} as UserLicense,
});
