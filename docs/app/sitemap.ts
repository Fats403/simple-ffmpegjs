import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://simple-ffmpegjs.vercel.app";

const lastModified = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" as const },
    { path: "/quick-start", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/installation", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/features", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/example-output", priority: 0.7, changeFrequency: "monthly" as const },
    // API Reference
    { path: "/api", priority: 0.9, changeFrequency: "weekly" as const },
    { path: "/api/project-constructor", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/api/methods", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/api/export-options", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/api/static-helpers", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/api/auto-sequencing", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/api/clip-types", priority: 0.8, changeFrequency: "monthly" as const },
    // Guides
    { path: "/guides/validation", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/schema-export", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/presets", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/watermarks", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/progress", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/guides/error-handling", priority: 0.7, changeFrequency: "monthly" as const },
    // Examples
    { path: "/examples", priority: 0.8, changeFrequency: "monthly" as const },
    { path: "/examples/clips-and-transitions", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/examples/text-and-animations", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/examples/karaoke-and-subtitles", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/examples/export-settings", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/examples/real-world-pipelines", priority: 0.7, changeFrequency: "monthly" as const },
    // Advanced
    { path: "/advanced/timeline-behavior", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/advanced/auto-batching", priority: 0.6, changeFrequency: "monthly" as const },
    // Misc
    { path: "/testing", priority: 0.6, changeFrequency: "monthly" as const },
    { path: "/contributing", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/license", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return pages.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    lastModified,
    priority,
    changeFrequency,
  }));
}
