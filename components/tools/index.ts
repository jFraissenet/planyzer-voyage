import type { ComponentType } from "react";
import { CarSharingTool } from "./CarSharingTool";
import { MealsTool } from "./meals/MealsTool";
import { MoneyTool } from "./MoneyTool";
import { NotesTool } from "./NotesTool";
import { PlanningTool } from "./planning/PlanningTool";
import { ProposalsTool } from "./proposals/ProposalsTool";
import { TeamsTool } from "./teams/TeamsTool";
import type { ToolProps } from "./ToolShell";

export { ToolShell } from "./ToolShell";
export type { ToolProps } from "./ToolShell";
export { MoneyTool, NotesTool, CarSharingTool, ProposalsTool, MealsTool, PlanningTool, TeamsTool };

const TOOL_COMPONENTS: Record<string, ComponentType<ToolProps>> = {
  money: MoneyTool,
  notes: NotesTool,
  car_sharing: CarSharingTool,
  proposals: ProposalsTool,
  meals: MealsTool,
  planning: PlanningTool,
  teams: TeamsTool,
};

export function getToolComponent(
  code: string,
): ComponentType<ToolProps> | null {
  return TOOL_COMPONENTS[code] ?? null;
}
