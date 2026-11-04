import type { Metadata } from "next";
import { ProjectDetailView } from "@/components/views/ProjectDetailView";

export const metadata: Metadata = { title: "Project" };
export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ProjectDetailView id={id} />; }
