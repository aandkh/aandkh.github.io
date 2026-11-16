#!/usr/bin/env python3
"""Explicit, one-off import of dated Missouri SHPO historic properties.

Not a daily maintenance job. Input snapshots are the public MoDNR regional
GeoJSON query responses. Missing/malformed historical periods are excluded;
National Register listing dates are never substituted for historical dates.
"""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from shapely.geometry import shape

FIELDS = {
    'AS_AGRI': ('agriculture', 'industry'),
    'AS_ARCHIT': ('architecture', 'culture'),
    'AS_ART': ('art', 'culture'),
    'AS_COMMRCE': ('commerce', 'industry'),
    'AS_COMMUN': ('communications', 'industry'),
    'AS_PLN_DEV': ('community planning and development', 'settlement'),
    'AS_CONSERV': ('conservation', 'science'),
    'AS_ECON': ('economics', 'industry'),
    'AS_EDUCATN': ('education', 'education'),
    'AS_ENGINER': ('engineering', 'engineering'),
    'AS_ENT_REC': ('entertainment and recreation', 'culture'),
    'AS_ETH_HER': ('ethnic heritage', 'culture'),
    'AS_EXP_SET': ('exploration and settlement', 'settlement'),
    'AS_HEALTH': ('health and medicine', 'science'),
    'AS_INDSTRY': ('industry', 'industry'),
    'AS_INVENT': ('invention', 'science'),
    'AS_LANDSCP': ('landscape architecture', 'culture'),
    'AS_LAW': ('law', 'government'),
    'AS_LITER': ('literature', 'culture'),
    'AS_MAR_HIS': ('maritime history', 'engineering'),
    'AS_MILTARY': ('military history', 'military'),
    'AS_PER_ART': ('performing arts', 'culture'),
    'AS_PHILO': ('philosophy', 'culture'),
    'AS_POL_GOV': ('politics and government', 'government'),
    'AS_RELIGON': ('religion', 'culture'),
    'AS_SCIENCE': ('science', 'science'),
    'AS_SOC_HIS': ('social history', 'culture'),
    'AS_TRANSPT': ('transportation', 'engineering'),
}


def periods(text):
    """Preserve the source's circa/decade wording; parse only unambiguous years."""
    text = str(text or '').strip()
    normalized = re.sub(r'\b(?:ca?|circa)\.?(?=\s*\d)', '', text, flags=re.I)
    normalized = normalized.replace('–', '-').replace('—', '-')
    spans = []
    for part in re.split(r'\s*(?:;|,|\band\b)\s*', normalized):
        m = re.fullmatch(r'\s*(\d{4})(s)?\s*(?:-\s*(\d{2}|\d{4})(s)?)?\s*', part)
        if not m:
            return None
        a = int(m[1]); b = int(m[3]) if m[3] else a
        if m[3] and len(m[3]) == 2:
            b += a // 100 * 100
        if m[4] or (m[2] and not m[3]):
            b += 9
        if not 1500 <= a <= b <= 2026:
            return None
        spans.append([a, b])
    return spans or None


def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()


def key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFKD', value).lower())


def build(inputs, checked, reconciliation=None):
    records = []; rejected = []; seen = set()
    # Boundary-increase amendments are merged into their parent district rather
    # than counted as additional historical places.
    groups = {}
    for kind, path in inputs:
        for feature in json.loads(Path(path).read_text())['features']:
            p = feature['properties']; name = clean(p.get('HST_NAME'))
            if not name:
                continue
            if re.search(r'boundary\s+(?:increase|decrease)', name, re.I):
                rejected.append({'name':name,'reason':'Boundary amendment is not another historical place'})
                continue
            name = name.replace('Cardonelet', 'Carondelet')
            group = groups.setdefault((key(name), clean(p.get('COUNTY'))), [])
            group.append((kind, feature, name))
    for (_, county), candidates in groups.items():
        usable = [(kind, f, name, periods(f['properties'].get('PERIOD_SIG'))) for kind, f, name in candidates]
        usable = [(kind, f, name, span) for kind, f, name, span in usable if span]
        if not usable:
            rejected.extend({'name': name, 'period': f['properties'].get('PERIOD_SIG'), 'reason': 'No unambiguous historical period'} for kind, f, name in candidates)
            continue
        # Prefer the original district where available. Do not silently widen
        # its documented period using an amendment's different scope.
        usable.sort(key=lambda item: (item[0]!='districts', item[1]['properties']['OBJECTID']))
        kind, f, name, spans = usable[0]; p = f['properties']
        if p.get('AS_ARCHLGY') == 'Y':
            rejected.append({'name': name, 'reason': 'Archaeological location requires individual public-access review'})
            continue
        geom = shape(f['geometry']); point = geom if geom.geom_type == 'Point' else geom.representative_point()
        lon, lat = point.x, point.y
        if not (-91.2 <= lon <= -89.4 and 38.1 <= lat <= 39.2):
            rejected.append({'name': name, 'reason': 'Outside regional bounds'})
            continue
        fields = [(label, topic) for field, (label, topic) in FIELDS.items() if p.get(field) == 'Y']
        topics = list(dict.fromkeys(topic for _, topic in fields)) or ['culture']
        # Lead with the specific historic function ahead of generic architecture.
        primary = next((t for t in ['military','education','science','engineering','industry','government','settlement'] if t in topics), 'culture')
        labels = [label for label, _ in fields]
        source_period = clean(p['PERIOD_SIG'])
        historic_date = str(min(a for a, b in spans)); end_date = str(max(b for a, b in spans))
        detail = 'Historic ' + ('district' if kind == 'districts' else 'property') + ' documented by the Missouri State Historic Preservation Office.'
        if labels:
            detail += ' Recognized subjects: ' + ', '.join(labels) + '.'
        detail += ' The nomination inventory records ' + source_period + ' as its period of historical significance.'
        architect = clean(p.get('ARCHITECT'))
        if architect and not re.search(r'unknown|n/?a|continuation|see |various', architect, re.I):
            detail += ' Architect/builder recorded: ' + architect.rstrip('.') + '.'
        oid = p['OBJECTID']; layer = 1 if kind == 'districts' else 0
        service = f'https://gis.dnr.mo.gov/host/rest/services/cultural/national_register_{kind}/MapServer/{layer}'
        url = service + '/query?where=OBJECTID%3D' + str(oid) + '&outFields=*&returnGeometry=true&outSR=4326&f=pjson'
        identity = clean(p.get('SHPO_NUMBE')) or hashlib.sha256((name + county).encode()).hexdigest()[:12]
        rid = 'history-moshpo-' + kind + '-' + re.sub('[^a-z0-9]+', '-', identity.lower()).strip('-')
        if rid in seen:
            rid += '-' + str(oid)
        seen.add(rid)
        accuracy = ('Representative point inside the official district boundary; the historical area extends beyond this pin.' if kind == 'districts' else 'Official Missouri SHPO inventory point for the historic property; not an entrance or claim of public access.')
        props = {
            'id': rid, 'sourceId': 'moshpo:' + kind + ':' + str(oid),
            'title': name, 'description': detail, 'placeName': clean(p.get('PLOCALNAME')),
            'historicalDate': historic_date, 'historicalDateLabel': 'Historic period · ' + source_period,
            'dateSort': historic_date + '-01-01', 'dateAccuracy': 'documented-historic-period',
            'historicalPeriods': spans, 'eventCategory': primary, 'eventCategories': topics,
            'recordKind': 'historic-place', 'locationAccuracy': accuracy,
            'source': 'Missouri State Historic Preservation Office', 'sourceUrl': url,
            'url': url, 'coordinateSourceUrl': url, 'sourceCheckedAt': checked,
            'jurisdiction': 'city' if county == 'St Louis City' else 'county' if county == 'St Louis' else county,
            'tags': labels + ['historic properties', clean(p.get('OTHR_NAME')), county],
        }
        if end_date != historic_date:
            props['historicalEndDate'] = end_date
        review = (reconciliation or {}).get(rid)
        if review and review.get('action') == 'replace-topics-and-subjects':
            if review.get('correctedTitle'):
                props['title'] = review['correctedTitle']
            # The national inventory resolves demonstrated errors in several
            # state topic flags (notably COMMUN on residential districts).
            props['eventCategory'] = review['eventCategory']
            props['eventCategories'] = review['eventCategories']
            subjects = review['subjects']
            props['description'] = re.sub(r' Recognized subjects: .*?\.', '', props['description'])
            if subjects:
                props['description'] += ' National Register subjects: ' + ', '.join(subjects) + '.'
            props['tags'] = subjects + ['historic properties', clean(p.get('OTHR_NAME')), county]
            props['nationalRegisterId'] = review['npsRef']
            props['historicalSources'] = [{'url':'https://www.nps.gov/subjects/nationalregister/data-downloads.htm','publisher':'National Park Service · National Register inventory'}]
            archive_url = review.get('npsArchiveUrl')
            if archive_url:
                props['historicalSources'].insert(0, {'url':archive_url,'publisher':'National Archives · nomination record'})
                props['url'] = archive_url
            props['subjectEvidence'] = 'National Register inventory dated May 22, 2026; reference ' + review['npsRef'] + '. Historical period and location from Missouri SHPO.'
        records.append({'type':'Feature','id':rid,'geometry':{'type':'Point','coordinates':[round(lon,7),round(lat,7)]},'properties':props})
    return records, rejected


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sites', required=True)
    parser.add_argument('--districts', required=True)
    parser.add_argument('--checked', required=True)
    parser.add_argument('--reconciliation', required=True, help='Reviewed National Register subject/identity reconciliation')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    records, rejected = build([('sites',args.sites),('districts',args.districts)], args.checked, json.loads(Path(args.reconciliation).read_text()))
    Path(args.output).write_text(json.dumps({'type':'FeatureCollection','features':records}, ensure_ascii=False, indent=2)+'\n')
    Path(args.output+'.review.json').write_text(json.dumps({'imported':len(records),'rejected':rejected}, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'imported':len(records),'topics':collections.Counter(t for f in records for t in f['properties']['eventCategories']),'rejected':len(rejected)}))
