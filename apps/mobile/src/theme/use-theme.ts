import { useColorScheme } from "react-native";

import { darkTheme, lightTheme, type Theme } from "./index";

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? darkTheme : lightTheme;
}
