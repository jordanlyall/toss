import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";
import { buildClaimMetadata, resolveSenderDisplayName } from "@/lib/ogMeta";

type PageProps = {
  searchParams: { id?: string };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(searchParams.id);
}

export default async function ClaimPage({ searchParams }: PageProps) {
  const senderName = await resolveSenderDisplayName(searchParams.id);
  return <ClaimClient senderName={senderName} />;
}
