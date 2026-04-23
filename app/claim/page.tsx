import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";
import { buildClaimMetadata } from "@/lib/ogMeta";
import { prefetchClaim } from "@/lib/prefetchClaim";

type PageProps = {
  searchParams: { id?: string };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(searchParams.id);
}

export default async function ClaimPage({ searchParams }: PageProps) {
  const prefetched = await prefetchClaim(searchParams.id);
  return (
    <ClaimClient
      senderName={prefetched?.senderName ?? null}
      prefetched={prefetched}
    />
  );
}
