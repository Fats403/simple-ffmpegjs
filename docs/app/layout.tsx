import type { Metadata } from "next";
import { Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./globals.css";
import Image from "next/image";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://simple-ffmpegjs.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    template: "%s | simple-ffmpeg",
    default: "simple-ffmpeg — Programmatic video composition for Node.js",
  },
  description:
    "A lightweight Node.js library for programmatic video composition using FFmpeg. Define your timeline as a plain array of clips — simple-ffmpeg builds the filter graph for you.",
  keywords: [
    "ffmpeg",
    "node.js",
    "video composition",
    "video editing",
    "typescript",
    "simple-ffmpegjs",
    "video pipeline",
    "ffmpeg wrapper",
    "nodejs video library",
    "filter graph",
  ],
  openGraph: {
    type: "website",
    siteName: "simple-ffmpeg",
    title: "simple-ffmpeg — Programmatic video composition for Node.js",
    description:
      "A lightweight Node.js library for programmatic video composition using FFmpeg. Define your timeline as a plain array of clips — simple-ffmpeg builds the filter graph for you.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "simple-ffmpeg — Programmatic video composition for Node.js",
    description:
      "A lightweight Node.js library for programmatic video composition using FFmpeg. Define your timeline as a plain array of clips — simple-ffmpeg builds the filter graph for you.",
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: {
      url: "/apple-touch-icon.png",
      sizes: "180x180",
      type: "image/png",
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={
                <>
                  <Image
                    src="/favicon-32x32.png"
                    alt="simple-ffmpegjs"
                    width={24}
                    height={24}
                    style={{ marginRight: "8px" }}
                  />
                  <span style={{ fontWeight: "bold" }}>simple-ffmpegjs</span>
                </>
              }
            />
          }
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/Fats403/simple-ffmpegjs/tree/main/docs"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          editLink="Edit this page"
          feedback={{ content: "Question? Give feedback" }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
