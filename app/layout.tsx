import "../src/styles.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Stockscalendar.xyz",
  description: "Discover and trade Robinhood Chain stocks, powered by the Hermes research agent.",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }]
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const cookies = headersList.get("cookie");

  return (
    <html lang="en">
      <body>
        <Providers cookies={cookies}>{children}</Providers>
      </body>
    </html>
  );
}
