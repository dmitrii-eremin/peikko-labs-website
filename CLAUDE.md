# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static website for Peikko Labs, served by GitHub Pages from the repository root of the
default branch. [CNAME](CNAME) points it at the custom domain `peikkolabs.com`.

The root of the site is the **Castlefolk** landing page — a six-language marketing page
whose primary conversion is a Steam wishlist. Peikko Labs is the studio credit in the
footer, not a separate landing page.

Deployment is `git push` to `main`; GitHub Pages publishes the tree verbatim. There is no
CI build, no package manager and no test suite. Preview locally with any static server:

```
python -m http.server 8000
```

## Generated pages — do not hand-edit

`index.html` and `{ru,fi,es,de,ja}/index.html` are **generated**, along with `sitemap.xml`
and `robots.txt`. Editing them directly is always wrong; the next generator run discards
the change. Instead edit the source and re-run:

```
node tools/gen.mjs        # zero dependencies, ~1s
```

Then commit the regenerated output. This is a local authoring tool, not a deploy step —
GitHub Pages still serves committed HTML verbatim, so the site stays buildless.

| Edit this | To change |
|---|---|
| [content/site.json](content/site.json) | External URLs, trailer/video IDs, which screenshots appear, roadmap structure, the language list |
| `content/<lang>.json` | All user-facing copy, including alt text and ARIA labels |
| [tools/template.html](tools/template.html) | Page structure and markup |
| [static/site.css](static/site.css), [static/site.js](static/site.js) | Styling and behaviour (referenced directly, never generated) |

All six `content/<lang>.json` files must carry an identical key structure — the generator
throws on a missing key rather than silently emitting English. `en` is the reference.

The template language is a small mustache subset implemented in `tools/gen.mjs`:
`{{path}}`, `{{{raw}}}`, `{{#if}}/{{else}}/{{/if}}`, `{{#unless}}`, `{{#each}}`. There is
no `{{../parent}}` syntax; inside `{{#each}}` the enclosing scope is already in scope.

### Empty config hides things on purpose

Any link in `site.json` with an empty `url` is omitted, and sections left with nothing to
show (Media, Links, the Steam CTA, the hero's Steam and trailer buttons) disappear
entirely. This is deliberate: the site never ships a dead link or an empty section shell.
Several URLs are still unset placeholders awaiting real values.

## Assets

`static/img/**` holds the optimized WebP/PNG derivatives the pages actually reference.
They are generated from large originals that are **gitignored** and live only locally:

```
python tools/optimize-images.py   # screenshots, wordmark, favicons, cursor -> static/img/
python tools/subset-font.py       # PatrickHand TTF -> static/fonts/patrick-hand.woff2
```

Both need `pip install Pillow fonttools brotli`. Re-run after changing any original, and
commit the derivatives. Screenshot sources are ASCII-slugged (`overview.png`,
`world-map.png`, …); keep new ones ASCII — the originals arrived with mojibake names and
were renamed.

## Fonts and scripts — a real constraint

Of the three bundled TTFs, **only Patrick Hand has usable coverage**. `Medieval Scroll of
Wisdom.ttf` and `scribish.ttf` are ASCII-only: no `ä`/`ö`, no Cyrillic, no CJK, and they
silently drop apostrophes and colons. They are not used anywhere, and should not be
without checking coverage first.

Patrick Hand covers Latin + Latin-1 + Latin Extended-A, so it serves en/fi/es/de. Russian
and Japanese headings fall back to system stacks via `:lang(ru)` / `:lang(ja)` rules in
`site.css`. Any new display font must be checked against all six languages.

## Conventions

Pages are self-contained: doctype, correct `lang`, charset + viewport meta, a `<title>` of
the form `Page | Peikko Labs`, content wrapped in `<main>`. Keep the site buildless — no
framework or bundler unless the user asks.

**Links between pages are relative** (`ru/`, `../static/site.css`), never root-absolute, so
the site works both at `peikkolabs.com` and under a `username.github.io/repo/` path. Only
canonical URLs, `hreflang` and Open Graph tags use the absolute origin, which comes from
`site.json`.

`castlefolk/index.html` is a redirect stub kept so older links to the former product page
still resolve to the root.

## Before committing a change to the page

Re-run `node tools/gen.mjs`, then check in a browser at 320 / 768 / 1440 that no
horizontal scroll appears (`document.documentElement.scrollWidth > innerWidth`), in at
least English plus German or Finnish — long compound words are what actually overflow the
grids.
