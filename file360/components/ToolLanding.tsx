import { notFound } from "next/navigation";
import { File360App } from "@/components/File360App";
import type { ToolPage } from "@/src/config/tool-pages";

export function ToolLanding({ page }: { page: ToolPage | undefined }) {
  if (!page) notFound();
  return <File360App initialTool={page.tool} heading={page.heading} description={page.description} />;
}

