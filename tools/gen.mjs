/**
 * Generates the localized pages from content/ + tools/template.html.
 *
 *     node tools/gen.mjs
 *
 * This is a local authoring tool, NOT a deploy step. Its output (index.html, the
 * per-language directories, sitemap.xml and robots.txt) is committed, and GitHub Pages
 * serves that output verbatim. Never hand-edit a generated file: edit content/*.json or
 * tools/template.html and re-run.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const readJson = (p) => JSON.parse(read(p));

const site = readJson("content/site.json");
const template = read("tools/template.html");

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const lookup = (ctx, path) =>
  path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), ctx);

/** Truthy for template conditionals: empty string, empty array and 0 are all false. */
const truthy = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

/**
 * Minimal mustache-ish renderer. Blocks are resolved outermost-first and their bodies
 * rendered recursively, so an inner {{#each}} sees the outer item's scope:
 *   {{#each list}} ... {{/each}}     with `this`, `@index`, `@number`, `@first`, `@last`
 *   {{#if path}} ... {{else}} ... {{/if}}   and {{#unless path}}
 *   {{{path}}} raw, {{path}} HTML-escaped
 * Inside {{#each}} the enclosing scope stays reachable, since each item is spread over
 * a copy of the parent context.
 */
function render(tpl, ctx) {
  let out = "";
  let rest = tpl;

  for (;;) {
    const block = findFirstBlock(rest);
    if (!block) break;

    const { type, arg, body, start, end } = block;
    out += rest.slice(0, start);

    if (type === "each") {
      const list = lookup(ctx, arg);
      if (Array.isArray(list)) {
        out += list
          .map((item, i) =>
            render(body, {
              ...ctx,
              ...(item && typeof item === "object" && !Array.isArray(item) ? item : {}),
              this: item,
              "@index": i,
              "@number": i + 1,
              "@first": i === 0,
              "@last": i === list.length - 1,
            }),
          )
          .join("");
      }
    } else {
      const [ifBody, elseBody] = splitElse(body);
      const cond = truthy(lookup(ctx, arg));
      const taken = type === "if" ? (cond ? ifBody : elseBody) : cond ? elseBody : ifBody;
      out += render(taken, ctx);
    }

    rest = rest.slice(end);
  }
  out += rest;

  out = out.replace(/\{\{\{\s*([\w.@]+)\s*\}\}\}/g, (m, p) => {
    const v = lookup(ctx, p);
    return v == null ? "" : String(v);
  });

  return out.replace(/\{\{\s*([\w.@]+)\s*\}\}/g, (m, p) => {
    const v = lookup(ctx, p);
    if (v == null) throw new Error(`unknown template key: {{${p}}}`);
    return escapeHtml(v);
  });
}

const BLOCK_TOKEN = /\{\{#(each|if|unless)\s+([\w.@]+)\s*\}\}|\{\{\/(each|if|unless)\}\}/g;

/** Finds the first block, matching its close across any nested blocks of the same kind. */
function findFirstBlock(s) {
  BLOCK_TOKEN.lastIndex = 0;
  const open = BLOCK_TOKEN.exec(s);
  if (!open) return null;
  if (open[3]) throw new Error(`stray {{/${open[3]}}}`);

  const type = open[1];
  const arg = open[2];
  const bodyStart = open.index + open[0].length;

  let depth = 1;
  let token;
  while ((token = BLOCK_TOKEN.exec(s))) {
    if (token[1]) depth++;
    else if (--depth === 0) {
      if (token[3] !== type) throw new Error(`{{#${type} ${arg}}} closed by {{/${token[3]}}}`);
      return { type, arg, body: s.slice(bodyStart, token.index), start: open.index, end: BLOCK_TOKEN.lastIndex };
    }
  }
  throw new Error(`unclosed {{#${type} ${arg}}}`);
}

/** Splits an {{else}} at this block's own depth, ignoring any in nested blocks. */
function splitElse(body) {
  const scan = /\{\{#(?:each|if|unless)\s|\{\{\/(?:each|if|unless)\}\}|\{\{else\}\}/g;
  let depth = 0;
  let m;
  while ((m = scan.exec(body))) {
    if (m[0].startsWith("{{#")) depth++;
    else if (m[0].startsWith("{{/")) depth--;
    else if (depth === 0) return [body.slice(0, m.index), body.slice(m.index + m[0].length)];
  }
  return [body, ""];
}

// --- build the per-language context ------------------------------------------------

const langs = site.languages;
const isDefault = (l) => l.code === site.defaultLang;
/** Relative prefix back to the site root, so pages work under a repo subpath too. */
const baseFor = (l) => (isDefault(l) ? "" : "../");
const urlFor = (l) => site.origin + l.path;

const fmt = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

function buildContext(lang) {
  const t = readJson(`content/${lang.code}.json`);
  const base = baseFor(lang);
  const year = new Date().getFullYear();

  const links = site.links
    .filter((l) => l.url)
    .map((l) => ({
      ...l,
      label: t.links[l.id] ?? l.id,
      external: !/^(mailto|tel):/.test(l.url),
    }));

  const gallery = site.gallery.map((g, i) => ({
    ...g,
    caption: t.screenshots.captions[g.id] ?? "",
    number: i + 1,
  }));

  const features = site.features.map((f, i) => ({
    ...f,
    title: t.features[f.id].title,
    text: t.features[f.id].text,
    imageAlt: t.features[f.id].imageAlt,
    flip: i % 2 === 1,
  }));

  const world = site.world.map((w) => ({
    ...w,
    title: t.world[w.id].title,
    text: t.world[w.id].text,
    imageAlt: t.world[w.id].imageAlt,
  }));

  const roadmap = site.roadmap.map((g) => ({
    ...g,
    title: t.roadmap.groups[g.id],
    items: g.items.map((it) => ({
      ...it,
      label: t.roadmap.items[it.id],
      statusLabel: t.roadmap[it.status],
      done: it.status === "done",
    })),
  }));

  const videos = [
    ...(site.trailerId ? [{ id: site.trailerId, title: t.media.trailerTitle, featured: true }] : []),
    ...site.videos.map((v) => ({ ...v, title: v.titleKey ? lookup(t, v.titleKey) : v.title, featured: false })),
  ].map((v) => ({
    ...v,
    playLabel: fmt(t.media.playLabel, { title: v.title }),
    thumbAlt: fmt(t.media.thumbAlt, { title: v.title }),
  }));

  return {
    t,
    site,
    base,
    lang: lang.code,
    langName: lang.name,
    canonical: urlFor(lang),
    ogLocale: { en: "en_US", ru: "ru_RU", fi: "fi_FI", es: "es_ES", de: "de_DE", ja: "ja_JP" }[lang.code],
    year,
    rights: fmt(t.footer.rights, { year }),
    galleryCount: gallery.length,
    otherLangs: langs.map((l) => ({
      code: l.code,
      name: l.name,
      href: base + (isDefault(l) ? "" : `${l.code}/`),
      current: l.code === lang.code,
      switchLabel: fmt(t.langBanner.switch, { language: l.name }),
      bannerText: fmt(t.langBanner.text, { language: l.name }),
    })),
    hreflang: langs.map((l) => ({ code: l.code, url: urlFor(l) })),
    xDefault: site.origin + "/",
    links,
    gallery,
    features,
    world,
    roadmap,
    videos,
    hasSteam: Boolean(site.steamUrl),
    hasTrailer: Boolean(site.trailerId),
    hasVideos: videos.length > 0,
    hasLinks: links.length > 0,
    steamUrl: site.steamUrl,
  };
}

// --- write -------------------------------------------------------------------------

const written = [];
function write(relPath, contents) {
  const full = join(ROOT, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, contents);
  written.push(relPath);
}

for (const lang of langs) {
  const outPath = isDefault(lang) ? "index.html" : `${lang.code}/index.html`;
  write(outPath, render(template, buildContext(lang)));
}

write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${langs
  .map(
    (l) => `  <url>
    <loc>${urlFor(l)}</loc>
${langs.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.code}" href="${urlFor(a)}"/>`).join("\n")}
    <xhtml:link rel="alternate" hreflang="x-default" href="${site.origin}/"/>
  </url>`,
  )
  .join("\n")}
</urlset>
`,
);

write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`);

for (const p of written) console.log("wrote", p);
console.log(`\n${written.length} files`);
