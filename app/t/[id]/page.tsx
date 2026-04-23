import type { Metadata } from "next";
import ClaimClient from "@/app/claim/ClaimClient";
import { buildClaimMetadata } from "@/lib/ogMeta";

type PageProps = {
  params: { id: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(params.id);
}

export default function TossClaimPage() {
  return <ClaimClient />;
}
