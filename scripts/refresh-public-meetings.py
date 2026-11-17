#!/usr/bin/env python3
"""Refresh published City and County public meetings, independently of the API.

Official City calendar/iCal exports and County's public CivicWeb calendar are
bounded to the next 60 days. Virtual/unlocated meetings remain list records,
never guessed pins. Failed sources/individual exports retain verified records.
"""
import concurrent.futures
import datetime as dt
import hashlib
import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo
from bs4 import BeautifulSoup

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'search-sources/communityevents-meetings.json'
LOCATIONS = ROOT / 'public-meeting-locations.json'
CACHE = pathlib.Path('/tmp/andymap-meetings-http')
CITY = 'https://www.stlouis-mo.gov/events/all-public-meetings.cfm'
COUNTY = 'https://stlouisco.civicweb.net/Services/MeetingsService.svc/meetings'
ZONE = ZoneInfo('America/Chicago')
CANCELLED = re.compile(r'\bcancel(?:led|ed|lation)?\b|\bno\s+meeting\b', re.I)
VERIFICATION = {'checkedAt', 'sourceCheckedAt', 'lastSuccessAt', 'attemptedAt'}


def read_json(file, fallback):
    try:
        return json.loads(file.read_text())
    except (FileNotFoundError, ValueError):
        return fallback


def facts(value):
    if isinstance(value, dict):
        return {k: facts(v) for k, v in value.items() if k not in VERIFICATION}
    if isinstance(value, list):
        return [facts(v) for v in value]
    return value


def fetch(url):
    """Use upstream conditional responses where available; never stale-on-error."""
    CACHE.mkdir(exist_ok=True)
    file = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json')
    old = read_json(file, {})
    headers = {'User-Agent': 'Andymap public-calendar maintenance (andrewhanes.com)'}
    for header, key in [('If-None-Match', 'etag'), ('If-Modified-Since', 'modified')]:
        if old.get(key):
            headers[header] = old[key]
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as response:
            body = response.read(2_000_001)
            if len(body) > 2_000_000:
                raise ValueError('Calendar response exceeded 2 MB; retained previous records')
            text = body.decode('utf-8-sig')
            file.write_text(json.dumps({'body': text, 'etag': response.headers.get('ETag'), 'modified': response.headers.get('Last-Modified')}))
            return text
    except urllib.error.HTTPError as error:
        if error.code == 304 and 'body' in old:
            return old['body']
        raise


def local_start(value, fmt):
    wall = dt.datetime.strptime(value, fmt)
    # Reject nonexistent/repeated local times instead of making an arbitrary DST choice.
    possibilities = {wall.replace(tzinfo=ZONE, fold=fold).astimezone(dt.timezone.utc) for fold in (0, 1)}
    valid = [instant for instant in possibilities if instant.astimezone(ZONE).replace(tzinfo=None) == wall]
    if len(valid) != 1:
        raise ValueError('Ambiguous/nonexistent published local start')
    return valid[0].astimezone(ZONE)


def city_list(html, today, until):
    soup = BeautifulSoup(html, 'html.parser')
    rows = []
    for heading in soup.select('.event-date'):
        day = dt.datetime.strptime(heading.get_text(' ', strip=True), '%A, %b %d, %Y').date()
        if not today <= day <= until:
            continue
        block = heading.find_next_sibling()
        if not block:
            continue
        for anchor in block.select('a[href*="eventdetails.cfm?"]'):
            match = re.search(r'Event_ID=(\d+)', anchor['href'], re.I)
            if match:
                details = anchor.find_parent('li').select_one('.event-details')
                rows.append({'id': match[1], 'title': anchor.get_text(' ', strip=True), 'date': day.isoformat(), 'listingDetails': details.get_text(' ', strip=True) if details else ''})
    if not soup.select('.event-date'):
        raise ValueError('City calendar markup missing; retained prior meetings')
    return rows


def ical_record(raw):
    text = re.sub(r'\r?\n[ \t]', '', raw)
    event = re.search(r'BEGIN:VEVENT\s*(.*?)\s*END:VEVENT', text, re.S)
    if not event:
        raise ValueError('Missing VEVENT')
    values = {}
    for line in event.group(1).splitlines():
        if ':' not in line:
            continue
        key, value = line.split(':', 1)
        values[key.split(';')[0]] = re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value).strip()
    start = values.get('DTSTART', '')
    if start.endswith('Z'):
        date = dt.datetime.strptime(start, '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc).astimezone(ZONE)
    elif re.fullmatch(r'\d{8}T\d{6}', start):
        date = local_start(start, '%Y%m%dT%H%M%S')
    else:
        raise ValueError('Exact published start unavailable')
    return {'title': values.get('SUMMARY', ''), 'start': date.isoformat(), 'location': values.get('LOCATION', ''), 'modified': values.get('LAST-MODIFIED', ''), 'cancelled': values.get('STATUS') == 'CANCELLED' or bool(CANCELLED.search(values.get('SUMMARY', '')))}


def county_records(raw, today, until):
    rows = json.loads(raw)
    if not isinstance(rows, list) or any(not isinstance(row, dict) or 'Id' not in row for row in rows):
        raise ValueError('County calendar response shape changed')
    records, cancelled, warnings = [], set(), []
    for row in rows:
        if row.get('Published') is not True:
            continue
        identity = str(row['Id'])
        if not identity.isdigit():
            continue
        if CANCELLED.search(row.get('Name', '')):
            cancelled.add('county-meeting:' + identity)
            continue
        try:
            start = local_start(row['MeetingDateTime'], '%Y-%m-%d %H:%M')
            if start.date().isoformat() != row.get('MeetingDate'):
                raise ValueError('County date/time conflict')
            if not today <= start.date() <= until:
                continue
            records.append({'id': identity, 'title': row['Name'], 'start': start.isoformat(), 'location': row.get('MeetingLocation', ''), 'url': 'https://stlouisco.civicweb.net/Portal/MeetingInformation.aspx?Id=' + identity})
        except (ValueError, KeyError) as error:
            warnings.append(identity + ': ' + str(error))
    return records, cancelled, warnings


def location_address(location, source):
    location = ' '.join(location.replace('\\,', ',').split())
    # The County's own published police-board agenda identifies this chamber.
    if source == 'county' and re.search(r'county council (?:chamber|conference)', location, re.I):
        return '41 S Central Ave, Clayton, MO 63105'
    if source == 'city' and re.match(r'^1200 Market St(?:reet)?\b', location, re.I):
        return '1200 Market St, St Louis, MO 63103'
    if not re.match(r'^\d+\s+[A-Za-z]', location):
        return ''
    # Strip room/suite within an explicitly supplied street address, not a place name.
    address = re.sub(r',?\s+(?:Room|Suite|Ste\.?)\s*#?[\w/ -]+?(?=\s+St\.? Louis[, ]|\s+Clayton[, ])', '', location, flags=re.I)
    address = re.sub(r'\s+St\.? Louis,? MO\s+St\.? Louis,? MO\s+', ' St Louis, MO ', address, flags=re.I)
    return address


def resolve_location(location, source, locations, getter=fetch):
    address = location_address(location, source)
    if not address:
        return None
    key = address.lower()
    if key in locations:
        return locations[key]
    url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + urllib.parse.urlencode({'address': address, 'benchmark': 'Public_AR_Current', 'format': 'json'})
    matches = json.loads(getter(url)).get('result', {}).get('addressMatches', [])
    if len(matches) != 1:
        return None
    match = matches[0]
    lng, lat = match['coordinates']['x'], match['coordinates']['y']
    requested = re.match(r'\d+', address)[0]
    if not (-91.2 <= lng <= -89.4 and 38.1 <= lat <= 39.2) or not match.get('matchedAddress', '').startswith(requested + ' '):
        return None
    entry = {'address': address, 'coordinates': [lng, lat], 'matchedAddress': match['matchedAddress'], 'source': 'US Census Geocoder', 'sourceUrl': url, 'locationAccuracy': 'Approximate published street address · Census address interpolation'}
    locations[key] = entry
    return entry


def feature(record, source, checked, locations, warnings=None):
    location = record['location'].strip()
    try:
        point = resolve_location(location, source, locations)
    except Exception as error:
        point = None
        if warnings is not None:
            warnings.append(record['id'] + ' venue: ' + str(error))
    identity = source + '-meeting:' + record['id']
    virtual = not location or bool(re.search(r'^(?:virtual|microsoft teams|zoom|webex|n/a)\b', location, re.I))
    props = {'id': identity, 'layer': 'communityevents', 'title': record['title'], 'start': record['start'], 'expiresAt': record['start'], 'address': '' if virtual else location, 'venue': location or 'See official meeting notice', 'description': 'Public meeting · ' + (location or 'See the official notice for attendance details.'), 'url': record['url'], 'source': 'City of St. Louis public meetings' if source == 'city' else 'St. Louis County public calendar', 'sourceId': record['id'], 'sourceCheckedAt': checked, 'meetingSource': source, 'category': 'Public meetings', 'jurisdiction': 'St. Louis City' if source == 'city' else 'St. Louis County'}
    if record.get('modified'):
        props['sourceModified'] = record['modified']
    if point:
        props['locationAccuracy'] = point['locationAccuracy']
    else:
        props['locationAccuracy'] = 'Online/location details on the official notice; no map pin' if virtual else 'Published venue; map location not verified'
    return {'type': 'Feature', 'id': identity, 'geometry': {'type': 'Point', 'coordinates': point['coordinates']} if point else None, 'properties': props}


def preserve_records(old, current, cancelled, source, now):
    """Missing is not cancelled. Age records out only at their published start."""
    merged = {}
    for item in old:
        props = item.get('properties', {})
        if props.get('meetingSource') != source or item['id'] in cancelled:
            continue
        try:
            if dt.datetime.fromisoformat(props['start']) > now:
                merged[item['id']] = item
        except (ValueError, KeyError):
            continue
    for item in current:
        if dt.datetime.fromisoformat(item['properties']['start']) <= now:
            merged.pop(item['id'], None)
            continue
        previous = merged.get(item['id'])
        # Keep existing verification date when facts do not change; current checks
        # are recorded in the maintenance report rather than timestamp-only commits.
        merged[item['id']] = previous if previous and facts(previous) == facts(item) else item
    return sorted(merged.values(), key=lambda item: (item['properties']['start'], item['id']))


def main():
    now = dt.datetime.now(dt.timezone.utc)
    checked = now.isoformat()
    today = now.astimezone(ZONE).date()
    until = today + dt.timedelta(days=60)
    old = read_json(OUTPUT, {'features': [], 'sources': {}})
    locations = read_json(LOCATIONS, {})
    original_locations = json.dumps(locations, sort_keys=True)
    report, features, states = [], [], {}
    for source in ['city', 'county']:
        warnings, current, cancelled, listed_ids = [], [], set(), set()
        url = CITY if source == 'city' else COUNTY + '?' + urllib.parse.urlencode({'from': today.isoformat(), 'to': until.isoformat()})
        try:
            body = fetch(url)
            if source == 'city':
                rows = city_list(body, today, until)
                def city_record(row):
                    identity = 'city-meeting:' + row['id']
                    if CANCELLED.search(row['title']):
                        return identity, None, None
                    try:
                        entry = ical_record(fetch('https://www.stlouis-mo.gov/customcf/endpoints/events/iCalGen.cfm?eventID=' + row['id']))
                        if entry['cancelled']:
                            return identity, None, None
                        if entry['start'][:10] != row['date']:
                            raise ValueError('Calendar/iCal date disagreement')
                        # Never silently prefer a conflicting time in a separate export.
                        listing_time = re.match(r'(\d{1,2}:\d{2}\s*[AP]M)', row['listingDetails'])
                        if listing_time and dt.datetime.strptime(listing_time[1], '%I:%M %p').time() != dt.datetime.fromisoformat(entry['start']).time():
                            raise ValueError('Calendar/iCal start-time disagreement')
                        return identity, {**entry, 'id': row['id'], 'url': 'https://www.stlouis-mo.gov/events/eventdetails.cfm?Event_ID=' + row['id']}, None
                    except Exception as error:
                        return identity, None, str(error)
                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                    outcomes = list(pool.map(city_record, rows))
                records = []
                for identity, record, error in outcomes:
                    listed_ids.add(identity)
                    if error:
                        warnings.append(identity + ': ' + error)
                    elif record:
                        records.append(record)
                    else:
                        cancelled.add(identity)
            else:
                records, cancelled, warnings = county_records(body, today, until)
                listed_ids = {'county-meeting:' + record['id'] for record in records} | cancelled
            for record in records:
                current.append(feature(record, source, checked, locations, warnings))
            missing = [f['id'] for f in old['features'] if f['properties'].get('meetingSource') == source and f['id'] not in listed_ids and dt.datetime.fromisoformat(f['properties']['start']) > now]
            if missing:
                warnings.append(str(len(missing)) + ' prior upcoming meetings absent from current calendar; retained pending cancellation evidence')
            state = {'url': CITY if source == 'city' else COUNTY, 'status': 'partial' if warnings else 'ready', 'lastSuccessAt': checked, 'publishedRecords': len(records), 'warnings': warnings}
        except Exception as error:
            state = {**old.get('sources', {}).get(source, {}), 'url': CITY if source == 'city' else COUNTY, 'status': 'unavailable', 'warnings': [str(error)]}
        selected = preserve_records(old['features'], current, cancelled, source, now)
        features.extend(selected)
        states[source] = state
        report.append({'source': source, 'attemptedAt': checked, 'requestUrl': url, **state, 'retainedCount': sum(f['id'] not in {item['id'] for item in current} for f in selected), 'count': len(selected), 'mapped': sum(f.get('geometry') is not None for f in selected)})
    features.sort(key=lambda item: (item['properties']['start'], item['id']))
    result = {'type': 'FeatureCollection', 'id': 'communityevents', 'mode': 'meetings', 'status': 'partial', 'source': 'City of St. Louis and St. Louis County official public calendars', 'note': 'Published public meetings across the region. Online or unlocated meetings have no invented map pin; attendance details are on the official notice.', 'checkedAt': checked, 'sources': states, 'features': features}
    changed = facts(result) != facts(old)
    if changed:
        OUTPUT.parent.mkdir(exist_ok=True)
        OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    if json.dumps(locations, sort_keys=True) != original_locations:
        LOCATIONS.write_text(json.dumps(locations, ensure_ascii=False, indent=2, sort_keys=True) + '\n')
    details = {'attemptedAt': checked, 'changed': changed, 'count': len(features), 'sources': report}
    pathlib.Path('/tmp/andymap-public-meetings-report.json').write_text(json.dumps(details, indent=2) + '\n')
    print(json.dumps(details, indent=2))
    return 1 if any(state['status'] == 'unavailable' for state in states.values()) else 0


if __name__ == '__main__':
    raise SystemExit(main())
