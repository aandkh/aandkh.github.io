# Session palettes

The original forest/lime palette plus 20 curated alternatives. The underlying
map style and data colors do not change when a palette is chosen. Light and dark
map choices retain matching light and dark menu variants of the same palette.

## Lifecycle and integration

Load `/session-palettes.js` as a normal synchronous, same-origin script in the
head after the CSP meta and before the stylesheet. It is 6.1 kB (uncompressed),
has no dependencies or network calls, and selects once before the body paints.
Append `session-palettes.css` to `ui-styles.json` after existing menu styles and
rebuild using `node scripts/build-ui-styles.mjs`.

A new document selects uniformly from the curated choices, excluding the previous
palette stored in that tab's sessionStorage. This guarantees a visible change on
reload or the brand link's normal navigation to `/`. Storage-denied browsers still
randomize. There are no timers, observers, or pageshow handlers: layer changes,
feed refreshes, map movements, and returning from a backgrounded tab do not
reselect the palette. Re-executing the bootstrap is idempotent. Choosing Light or
Dark explicitly changes brightness within the same chosen color family.

## Palette families

The first nine alternatives adapt well-established editor/design palette families
for this interface. They are adaptations, not exact reproductions, endorsements,
or claims that aesthetic preference can be scientifically certified. The remaining
11 use classic complementary/analogous/neutral pairings with the same measured
contrast standards. Names below are internal identifiers, not extra UI.

| Palette | Family or pairing |
| --- | --- |
| Andymap | Existing forest and lime |
| Nord | Arctic blue, slate, ice |
| Solarized | Warm cream, deep petrol, ochre |
| Dracula | Violet, charcoal, lavender |
| Gruvbox | Warm charcoal and golden yellow |
| Rosé Pine | Dusky plum and muted rose |
| Tokyo Night | Indigo and soft cornflower blue |
| Catppuccin | Lavender, cool cream, soft mauve |
| Everforest | Moss, muted olive, cream |
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

`node scripts/session-palettes-test.mjs` exercises all 21 selections, all 42
light/dark variants, repeat execution, new-document selection, unavailable crypto,
and blocked storage. It checks foreground, secondary text, and link contrast on
all three menu surfaces, plus primary-button text at rest and hover: **462
text contrast checks, minimum 4.60:1**. Focus colors also pass 3:1 against every
menu surface. These are checks of the palette tokens; browser QA additionally
checks their actual use in the app cascade. Semantic data colors remain unchanged,
including traffic severity labels, AQI category colors, radar and wildlife
heatmaps, transit badges, and map pins.
