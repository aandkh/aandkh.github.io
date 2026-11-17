# Species reference photographs

`species-photos.json` is an on-demand reference cache for every unique taxon in
`wildlife-snapshot.json`'s default report sample and leading-species list. Its
`coverage` and `missing` fields report the actual result; they do not claim that
all organisms in the world or all historical regional records are preloaded.
Additional species resolve photographs when requested in the wildlife UI.

Sources:

- Official iNaturalist taxon API: `https://api.inaturalist.org/v1/taxa/{ids}`.
  The taxon gallery's exact taxon ID and scientific name must match the record.
- Official iNaturalist observation API: `https://api.inaturalist.org/v1/observations`.
  Missing gallery coverage uses research-grade observations with
  `photo_license=cc0,cc-by,cc-by-sa`, then checks each returned photograph's own
  license and each observation's exact taxon ID/name. A query filter alone is
  not sufficient evidence of permission.
- Licensing explanation: https://help.inaturalist.org/en/support/solutions/articles/151000169918-can-i-use-the-photos-and-sounds-that-are-posted-on-inaturalist-
- Official search syntax: https://www.inaturalist.org/pages/search+urls
- Official open-image documentation: https://github.com/inaturalist/inaturalist-open-data

Only CC0, CC BY and CC BY-SA photographs with provider-supplied attribution are
used. Noncommercial, no-derivatives, unknown, and all-rights-reserved photos are
excluded. Hidden, flagged, or moderated photographs are excluded. Attribution,
license code, exact photo source page, and optional observation provenance stay
with each image. License links lead to the actual photo's license record,
avoiding an invented license version for an older imported photograph.

Images stay at their original HTTPS iNaturalist photo hosts and are displayed
unaltered; only existing provider thumbnail/medium resolutions are requested.
Do not remove watermarks. Visually unsuitable assets should be replaced with a
different properly licensed image. The photo cache deliberately contains no
observation coordinates, private descriptions, or account profiles.

Refresh manually after a reference-coverage change, not as a daily job:

```sh
python scripts/refresh-species-photos.py --cache-dir /tmp/andymap-species-photo-responses
python scripts/species-photos-test.py
```

The scratch response cache allows interrupted work to resume and must not be
committed. API requests are serial, spaced at least 1.1 seconds apart, with
bounded retries. Group/taxon data are batched thirty IDs per call. Provider
assets load lazily in the UI; this file is metadata, not hundreds of bundled
image files. Reference photographs illustrate an organism, not a claim that
the pictured individual was seen at the local map location.

## November 16, 2026 validation

The cache has **374 photographs for 374 requested taxa, zero missing**: 232 CC BY,
91 CC BY-SA, and 51 CC0. Coverage includes 125 plants, 102 insects, 71 birds,
16 ray-finned fish,15 fungi, 14 arachnids, 12 mammals, 12 reptiles, 4 amphibians,
and3 other records. The complete metadata file is about 197 KB; images are not
bundled into the initial page download.

All 374 original medium-image URLs were retrieved and decoded successfully.
All 374 originals were reviewed in contact sheets. Additional candidate sheets
were reviewed to replace 37 poor selections, including visible photographer
logos, incorrect subjects in source observation photos, distant specimens, and
less useful isolated parts. These checks are contact-sheet visual review, not
an assertion that every image was examined individually at native resolution.

`scripts/species-photo-picks.json` retains the 37 exact reviewed alternatives,
with the same provenance/attribution schema as the public cache. Refresh checks
these picks against the exact taxon ID/name and allowed photo URL/license
boundaries and preserves them. An offline refresh using captured API responses
reproduced the complete final inventory and all 37 overrides without new API
calls. `scripts/species-photos-test.py` verifies photo-specific license rejection,
allowed image hosts, exact taxonomy, source links and complete inventory counts.

Do not automatically substitute the first photograph of an observation and
assume it shows the taxon. Some source observations contain different subjects
or screenshots. Newly discovered runtime taxa use curated taxon-gallery
candidates; their images have not undergone this snapshot's visual review.
