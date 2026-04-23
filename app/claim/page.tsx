import type { Metadata } from "next";
import ClaimClient from "./ClaimClient";

type PageProps = {
  searchParams: { id?: string };
};

const TITLE = "You got a Toss";
const DESCRIPTION = "Open to keep it. Free. Takes seconds.";

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const idParam = searchParams.id;
  const ogUrl = idParam ? `/api/og?id=${encodeURIComponent(idParam)}` : "/api/og";

  return {
    title: TITLE,
    description: DESCRIPTION,
    openGraph: {
      title: TITLE,
      description: DESCRIPTION,
      images: [
        {
          url: ogUrl,
          width: 1200,
          height: 630,
          alt: TITLE,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
      images: [ogUrl],
    },
  };
}

export default function ClaimPage() {
  return <ClaimClient />;
}
