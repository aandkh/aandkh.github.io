# Session palettes

The original dark forest/lime palette, the existing 20 light palettes, and 20
additional dark palettes (41 total).
Menu brightness no longer follows the basemap: Light, Dark and Streets change
only the map. The chosen menu palette keeps its own light or dark tone and stays
steady throughout the document.
The original surface, raised surface, soft surface, text, border and accent colors
are explicitly retained and checked by the regression test.

## Lifecycle and integration

Load `/session-palettes.js` as a normal synchronous, same-origin script in the
head after the CSP meta and before the stylesheet. It is a small dependency-free script,
has no dependencies or network calls, and selects once before the body paints.
Append `session-palettes.css` to `ui-styles.json` after existing menu styles and
rebuild using `node scripts/build-ui-styles.mjs`.

A new document selects uniformly from the curated choices, excluding the previous
palette stored in that tab's sessionStorage. This guarantees a visible change on
reload or the brand link's normal navigation to `/`. Storage-denied browsers still
randomize. There are no timers, observers, or pageshow handlers: layer changes,
feed refreshes, map movements, and returning from a backgrounded tab do not
reselect the palette. Re-executing the bootstrap is idempotent. Choosing Light or
Dark never recolors the menus.

## Palette families

The first nine alternatives adapt well-established editor/design palette families
for this interface. They are adaptations, not exact reproductions, endorsements,
or claims that aesthetic preference can be scientifically certified. The remaining
31 use classic complementary/analogous/neutral pairings with the same measured
contrast standards. Names below are internal identifiers, not extra UI.

| Palette | Family or pairing |
| --- | --- |
| Andymap | Existing forest and lime |
| Nord | Arctic blue, slate, ice |
| Solarized | Deep petrol and ochre |
| Dracula | Violet, charcoal, lavender |
| Gruvbox | Warm charcoal and golden yellow |
| Rosé Pine | Dusky plum and muted rose |
| Tokyo Night | Indigo and soft cornflower blue |
| Catppuccin | Dark lavender and soft mauve |
| Everforest | Deep moss and muted olive |
| Kanagawa | Ink blue and aged gold |
| Oceanic | Petrol and sea-glass cyan |
| Oxblood | Deep red-brown and dusty pink |
| Terracotta | Clay and sandstone |
| Copper Teal | Deep teal and copper-gold |
| Cobalt Citron | Cobalt blue and citron yellow |
| Violet Mint | Aubergine and pale mint |
| Graphite | Neutral graphite and orchid |
| Apricot | Warm charcoal and apricot |
| Burgundy Lilac | Burgundy and lilac |
| Marine | Deep navy and ice cyan |
| Vermilion | Warm ink and coral-red |

The 20 additional dark combinations are Midnight Brass, Pine Coral, Aubergine
Gold, Ink Cerulean, Espresso Cream, Blackberry, Slate Rose, Moss Gold, Deep Sea,
Charcoal Coral, Navy Orange, Plum Sage, Obsidian Silver, Umber Lilac, Jade Moon,
Wine Peach, Storm Blue, Cypress Gold, Amethyst Ice and Petrol Rose. These are
hand-selected combinations, with no random RGB generation.

Primary family references:
- Nord: https://www.nordtheme.com/docs/colors-and-palettes/
- Solarized: https://ethanschoonover.com/solarized/
- Dracula: https://draculatheme.com/spec
- Gruvbox: https://github.com/morhetz/gruvbox
- Rosé Pine: https://rosepinetheme.com/palette/ingredients/
- Tokyo Night: https://github.com/folke/tokyonight.nvim
- Catppuccin: https://catppuccin.com/palette/
- Everforest: https://github.com/sainnhe/everforest
- Kanagawa: https://github.com/rebelot/kanagawa.nvim

## Verification

`node scripts/session-palettes-test.mjs` exercises all 41 selections, repeat
execution, new-document selection, unavailable crypto and blocked storage. It
checks that the 20 previous light palettes retain their tone, all 20 new palettes
are dark, the original green values remain unchanged, and no basemap selector
can change the menu palette.
Foreground, secondary text, links, primary buttons and hover states pass **451
text contrast checks, minimum 4.60:1**. Focus colors pass 3:1. Browser QA also
checks the applied theme with light and dark map choices. Semantic map colors
remain unchanged, including traffic severity, AQI, radar and wildlife heatmaps.
