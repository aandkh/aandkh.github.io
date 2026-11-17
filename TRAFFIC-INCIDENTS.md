# Traffic incident display

`traffic-incidents.js` combines the three existing MoDOT active impact categories with optional official source loaders such as `loadIllinoisTraffic`. MoDOT remains the crash source. IDOT supplies Illinois closure and construction schedules; it does not supply live crashes or speeds. Road-color imagery is a separate controller and is never treated as proof of a crash or closure.

## Locations and readable labels

- Each visible record has a small category-colored anchor at its original reported coordinate. A segment-only source uses a representative point on its published road geometry. The location note distinguishes a supplied segment from a point report.
- A leader connects the anchor to its label. Labels avoid map controls, exact selected pins, warning badges, and one another. Leaders are clipped around labels and controls.
- Labels name the road and direction, then the action, reported lanes, and driving delay only when explicitly stated. A clearance time or incident duration is never converted into a driving delay.
- Icons and colors come from `traffic-ui.js`: crash car/impact mark, closure circle/minus, other diamond/exclamation mark. Planned work is explicitly marked planned and remains in Other.
- Nearby records can share a label at regional scales. The label identifies its crash/closure/other composition and roads, rather than saying only “incidents.” All original anchor dots remain. At street scale, records more than six screen pixels apart begin as separate labels; dense locations may still share a label when necessary to avoid collisions. Every member remains accessible.
- Selecting a report excludes its canonical ID from traffic anchors and grouping. The application owns the single gold selection pin and details. A grouped label passes `members`, `clusterCenter`, and `clusterBounds`; it never pretends the group center is an incident location.

## Controller contract

```js
const incidents = createTrafficIncidents(map, {
  onSelect(recordOrGroup) {},
  onStatus(message) {},
  onUpdate(state) {},
  getSelected: () => selectedCanonicalID,
  additionalSources: [{
    id: 'idot', source: 'IDOT',
    load: ({signal}) => loadIllinoisTraffic({signal})
  }]
});
incidents.setVisible(true);
incidents.setFilter('all'); // all | crashes | closures | other
```

The controller also exposes `getState()`, `lookup(selectionId)`, `refresh({force})`, `loadGeometry(record,{signal})`, `relayout()`, and `destroy()`. Multiple calls to `refresh()` while requests are in progress await the same operation, so saved-link hydration cannot mistake a pending cold load for a missing report.

`getState()` contains all normalized `records`, `filteredRecords`, `filter`, `counts`, `visibleCount`, `visible`, `checkedAt`, `latestCheckedAt`, `sources`, `status`, and source availability/failure/pending/retention counts. A closed crash belongs to both Crashes and Closures. `checkedAt` is the oldest usable source receipt; `latestCheckedAt` is the newest. Source rows retain nested IDOT source details. A partial Illinois response stays partial even if the other loaders succeed.

The custom Leaflet panes are `traffic-incident-anchors` (615) and `traffic-incident-badges` (620). The shared `traffic` badge reservation provider positions labels after exact pins and serious weather warnings.

## Source geometry and expiry

MoDOT point categories 0, 5, and 9 load progressively. Only selection can request line categories 13, 18, or 22, using one validated numeric DATA_ID. Parent and sandbox sanitizers both enforce the ID, geometry shape, and size bounds. A selected line never replaces the original point coordinate. A small, three-minute geometry cache avoids repeating a selection request; it is cleared on controller destruction. There is no inferred road segment when the source supplies none.

Successful categories are eligible to refresh every three minutes. Failed or partial categories retry after thirty seconds while visible. Receipt times are not renewed by failure or cached loader responses. Received records disappear at their published end/deactivation time or six minutes after their original source receipt, whichever comes first. Independent timers handle expiry without new requests. Hidden tabs pause requests and timers; resuming recomputes current status before retaining any reports. Cancellation prevents late responses from an obsolete request generation from replacing current results.

A source outage is shown as partial/unavailable coverage, not “no incidents.” Zero records only means no reports were returned by the available sources. IDOT individual incident update time remains unknown where the source supplies none.

## Focused verification

Run `node scripts/traffic-incidents-test.mjs` for source sanitization, road/lane labels, truthful delay handling, grouping and collision placement, filters, shared pending refresh, progressive loading, partial IDOT coverage, original receipt preservation, independent expiry, and cancellation. Existing traffic security, performance, shared badge layout, and cross-controller experience tests cover the integration boundaries.
