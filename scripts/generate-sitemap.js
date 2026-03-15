import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Base site URL used when building sitemap entries.
const SITE = "https://makinaelektrike.com";
const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/dealers/", changefreq: "weekly", priority: "0.8" },
  { loc: "/models/", changefreq: "weekly", priority: "0.8" },
  { loc: "/albania-charging-stations/", changefreq: "weekly", priority: "0.8" },
  { loc: "/blog/", changefreq: "weekly", priority: "0.7" },
  { loc: "/about/", changefreq: "monthly", priority: "0.6" },
  { loc: "/contact/", changefreq: "monthly", priority: "0.6" },
  { loc: "/privacy-policy/", changefreq: "monthly", priority: "0.4" },
  { loc: "/terms/", changefreq: "monthly", priority: "0.4" },
  { loc: "/cookie-policy/", changefreq: "monthly", priority: "0.4" },
  { loc: "/register/", changefreq: "monthly", priority: "0.5" },
  { loc: "/register-dealer/", changefreq: "monthly", priority: "0.5" },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
  .map(
    u => `  <url>\n    <loc>${SITE}${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n")}\n</urlset>\n`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const out = path.join(__dirname, "..", "public", "sitemap.xml");

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, xml, "utf8");
console.log("Wrote", out);
