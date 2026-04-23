import type { Metadata } from "next";
import ClaimClient from "@/app/claim/ClaimClient";
import { buildClaimMetadata } from "@/lib/ogMeta";
import { prefetchClaim } from "@/lib/prefetchClaim";

type PageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(params.id);
}

export default async function TossClaimPage({ params }: PageProps) {
  const prefetched = await prefetchClaim(params.id);
  return (
    <ClaimClient
      senderName={prefetched?.senderName ?? null}
      prefetched={prefetched}
    />
  );
}
