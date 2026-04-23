import { useWindowDimensions } from "react-native";

export const MOBILE_BREAKPOINT = 640;

export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}
