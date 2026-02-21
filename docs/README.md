# simple-ffmpegjs docs

Documentation site for [simple-ffmpegjs](https://github.com/Fats403/simple-ffmpegjs), built with [Nextra](https://nextra.site) and Next.js.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site locally.

## Structure

```
content/        # MDX pages (maps 1:1 to URL routes)
  _meta.js      # Sidebar order and labels
  api/
  guides/
  examples/
  advanced/
app/
  layout.tsx    # Root layout, global metadata, Nextra theme config
  globals.css   # Global style overrides
public/         # Static assets (favicons, images)
```

## Adding a page

1. Create a `.mdx` file in the appropriate `content/` subdirectory.
2. Add it to the corresponding `_meta.js` to control its sidebar label and position.

## Environment variables

| Variable               | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL` | Canonical base URL used for OG tags, sitemap, and robots.txt |

Set this in your deployment environment before building for production.
