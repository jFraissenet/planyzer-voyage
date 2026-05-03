import { useWindowDimensions } from "react-native";

export const MOBILE_BREAKPOINT = 640;

// Maximum content width on large screens — keeps the app readable on
// desktop browsers instead of stretching across the whole viewport.
export const MAX_CONTENT_WIDTH = 800;

export function useIsMobile(): boolean {
  const { width } = useWindowDimensions();
  return width < MOBILE_BREAKPOINT;
}
