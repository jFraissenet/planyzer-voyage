import type { ComponentType } from "react";
import { CarSharingTool } from "./CarSharingTool";
import { MoneyTool } from "./MoneyTool";
import { NotesTool } from "./NotesTool";
import type { ToolProps } from "./ToolShell";

export { ToolShell } from "./ToolShell";
export type { ToolProps } from "./ToolShell";
export { MoneyTool, NotesTool, CarSharingTool };

const TOOL_COMPONENTS: Record<string, ComponentType<ToolProps>> = {
  money: MoneyTool,
  notes: NotesTool,
  car_sharing: CarSharingTool,
};

export function getToolComponent(
  code: string,
): ComponentType<ToolProps> | null {
  return TOOL_COMPONENTS[code] ?? null;
}
