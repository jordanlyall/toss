import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";
import { buildClaimMetadata } from "@/lib/ogMeta";

type PageProps = {
  searchParams: { id?: string };
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  return buildClaimMetadata(searchParams.id);
}

export default function ClaimPage() {
  return <ClaimClient />;
}
