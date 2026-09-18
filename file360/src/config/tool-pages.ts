import { TOOL_ACTIONS, type ToolAction } from "@/src/config/tool-actions";
import type { FileCategory } from "@/src/types";

export type ToolPage = {
  slug: string;
  title: string;
  heading: string;
  description: string;
  tool: Exclude<FileCategory, "unknown">;
  actionId: string;
  format?: string;
  operation?: string;
};

function pageFromAction(action: ToolAction): ToolPage | null {
  if (!action.route) return null;
  return {
    slug: action.route.slug,
    title: action.route.title,
    heading: action.route.heading,
    description: action.route.description,
    tool: action.category,
    actionId: action.id,
    format: action.initialConfig.format,
    operation: action.initialConfig.operation,
  };
}

const routedPages = TOOL_ACTIONS.map(pageFromAction).filter((page): page is ToolPage => page !== null);

function pagesFor(group: NonNullable<ToolAction["route"]>["group"]): ToolPage[] {
  return routedPages.filter((page) => TOOL_ACTIONS.find((action) => action.id === page.actionId)?.route?.group === group);
}

export const converterPages = pagesFor("converter");

export const actionPages: Record<string, ToolPage[]> = {
  comprimir: pagesFor("comprimir"),
  cortar: pagesFor("cortar"),
};

export function findToolPage(pages: ToolPage[], slug: string) {
  return pages.find((page) => page.slug === slug);
}

