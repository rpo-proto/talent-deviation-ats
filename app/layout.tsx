import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Talent Deviation ATS",
  description: "Local-first candidate signal cockpit"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
