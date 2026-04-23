import type { Metadata } from "next";
import ClaimClient from "@/app/claim/ClaimClient";
import { buildClaimMetadata, resolveSenderDisplayName } from "@/lib/ogMeta";

type PageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(params.id);
}

export default async function TossClaimPage({ params }: PageProps) {
  const senderName = await resolveSenderDisplayName(params.id);
  return <ClaimClient senderName={senderName} />;
}
