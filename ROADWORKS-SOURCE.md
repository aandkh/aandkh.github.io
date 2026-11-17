# Missouri construction coverage

The optional **Road closures and construction** layer loads MoDOT's actual
work-zone segments. MoDOT's traffic-impact layers 0/5/9 contain incidents and
other reported impacts; they are not the construction dataset. This difference
was the reason the Missouri side looked sparse beside IDOT construction.

`roadworks-source.js` queries these four layers of the official
[TravelerInformationMod service](https://mapsonline.modot.mo.gov/arcgis/rest/services/TravelerInformation/TravelerInformationMod/MapServer):

| Layer | Source category |
| --- | --- |
| 15 | Work Zone Closed Line |
| 20 | Work Zone Expect Delays Line |
| 23 | Work Zone Possible Delays Line |
| 37 | Work Zone No Delays Line |

The observed regional response contained 11/51/47/6 active records respectively
(115 total, 3,407 vertices) on November 16 Central / November 17 UTC, 2026.
Counts change with the source. Geometry is MoDOT's original affected segment;
the existing regional envelope remains `-91.2,38.1,-89.4,39.2`.

The official WZDx JSON responded successfully but did not supply browser CORS
headers. The implementation therefore reuses the existing isolated ArcGIS
JSONP bridge rather than adding a relay, backend dependency or arbitrary script
access. Only those four work-zone layer IDs are added. Per-incident line
queries still require their exact numeric `DATA_ID`. Work zones instead use
their documented `ID`, `STATUS = 'ACTIVE'`, and `OBJECTID ASC` ordering.
`ESRI_OID ASC` failed against this service despite appearing in its field list.

The bridge requests only public road-impact fields, strips unknown fields,
retains an opaque sandbox with the exact CSP script hash, and validates the
reply's source window, null origin and random token. Each category has at most
five pages of 200 records and 20,000 geometry vertices, within the existing
20-second source / 22-second parent deadline. Personal contact and agency
account fields are neither requested nor copied into the application.

Successful categories cache for three minutes. Concurrent consumers share the
same requests; canceling one consumer does not cancel the others. Failed
categories retry no faster than 30 seconds and can retain previously received
records for at most six minutes without renewing their check time. Partial
and unavailable states are explicit; failure never means roads are clear.

MoDOT supplies local calendar dates and recurring work hours as strings.
The feature preserves `reportedStartDate`, `reportedEndDate`,
`reportedWorkHours`, and `eventReportedDate`. It never turns a date-only source
record into an exact update time. `receivedAt`/`checkedAt` identify the source
query receipt, with `freshnessBasis: 'active-source-query'`; no fabricated
`sourceReportedAt`, `feedUpdatedAt` or exact `expiresAt` is added.
Ended/future work is excluded using the America/Chicago calendar day, while
display expiry independently checks source receipt age.

Validation:

```sh
node scripts/roadworks-source-test.mjs
node scripts/traffic-security-test.mjs
node scripts/traffic-bridge-details-test.mjs
node scripts/build-traffic-bridge.mjs --check
node --experimental-vm-modules scripts/check-modules.mjs
```

After any bridge edit, run `node scripts/build-traffic-bridge.mjs` and ship both
the reviewed JS and its generated HTML/CSP hash. Check construction toggled
alone, Traffic toggled alone, both together, source date details, and source
failure behavior in the live browser before publishing.
