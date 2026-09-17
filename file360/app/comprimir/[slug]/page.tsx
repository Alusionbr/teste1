import type { Metadata } from "next";
import { ToolLanding } from "@/components/ToolLanding";
import { actionPages, findToolPage } from "@/src/config/tool-pages";

const pages = actionPages.comprimir;
export const dynamicParams = false;
export function generateStaticParams() { return pages.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const page = findToolPage(pages, (await params).slug); return page ? { title: page.title, description: page.description } : {}; }
export default async function CompressPage({ params }: { params: Promise<{ slug: string }> }) { return <ToolLanding page={findToolPage(pages, (await params).slug)} />; }

