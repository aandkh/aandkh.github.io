# Chill: read this first

Chill is a design mock of a family safety app: private by default, location
opens only in an emergency (both ways) or when someone chooses to share.
Live at https://www.andrewhanes.com/emergency/ (username and password both
`kai`). Everything is simulated on the phone viewing it; two phones do not
talk to each other.

- The spec: `2026-09-26-design.md`. The owner's decisions in it are final.
- The build plan it was built from: `2026-09-26-plan.md`.
- The look came from the layout canvas at
  https://claude.ai/artifact/R5zydLSij6iwnT2Qz6jDqL (top row, "Chill, dark").

## Run it locally

    python emergency/_tools/serve.py        # http://127.0.0.1:4401/emergency/

Use this server rather than `python -m http.server`: it turns caching off,
otherwise the browser keeps old copies of the modules and edits seem not to
work. Tests: http://127.0.0.1:4401/emergency/_tests/ (the page title ends
PASS or FAIL; `window.__results` has details). There is no build step.

Icons: `python emergency/_tools/icons.py` redraws `icons/`.

## Where things are

| File | What it does |
| --- | --- |
| `js/logic.js` | Every rule: who can see whom, sharing, emergencies (several people can be in trouble at once), check-ins, PIN, Peace of Mind cooldown and results, Private Mode texts. Pure, tested. |
| `js/store.js` | Saved state and the demo clock (starts 9:10 PM, runs only while open). |
| `js/sim.js` | The pretend family and phones: responses, driving over, Peace of Mind timing, demo triggers. The stand-in for a backend. |
| `js/map.js` | The drawn map. Swap this one file for a real map API. |
| `js/hold.js` | Press and hold (500 ms, iOS Haptic Touch default; 400 ms for the Android disguise) and haptics. |
| `js/app.js` | Start-up, the two tabs, alerts arriving, Private Mode switching, PIN flows. |
| `js/ui-*.js` | Screens: home, mapview (Map tab and emergencies), alert, sheets, settings, peace, pin, demo, start, disguise. |
| `css/app.css`, `css/disguise.css` | The dark theme; the two messaging look-alikes. |

`_docs`, `_tests` and `_tools` start with an underscore so GitHub Pages
(Jekyll) does not publish them. They are still visible in the public repo.

## Things that are true and easy to forget

- The gate is a speed bump, not security: the repo is public.
- A website cannot use GPS in the background, send reliable push alerts, or
  buzz an iPhone. The iPhone buzz here uses the iOS 18 `switch` checkbox
  trick and may not fire from a timer. The real product needs native iOS
  and Android apps plus a server; the owner has been told.
- Peace of Mind must never report stale or fake success ("NO LIES"). In the
  mock every result is labeled "Demo: simulated results".
- Private Mode texts go nowhere even though they say Delivered; settings
  says so. On an iPhone Home Screen install the iMessage look is forced dark,
  because the status bar text there is always white.
- Calling 911 never dials anything in the mock.
