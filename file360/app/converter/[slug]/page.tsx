import type { Metadata } from "next";
import { ToolLanding } from "@/components/ToolLanding";
import { converterPages, findToolPage } from "@/src/config/tool-pages";

export const dynamicParams = false;
export function generateStaticParams() { return converterPages.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const page = findToolPage(converterPages, (await params).slug);
  return page ? { title: page.title, description: page.description } : {};
}
export default async function ConverterPage({ params }: { params: Promise<{ slug: string }> }) {
  return <ToolLanding page={findToolPage(converterPages, (await params).slug)} />;
}

