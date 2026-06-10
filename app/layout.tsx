import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./styles.css";

export const metadata: Metadata = {
  title: "Talent Deviation ATS",
  description: "Local-first candidate signal cockpit"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const clerkPublishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  const document = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

  if (!clerkPublishableKey.startsWith("pk_")) {
    return document;
  }

  return <ClerkProvider>{document}</ClerkProvider>;
}
