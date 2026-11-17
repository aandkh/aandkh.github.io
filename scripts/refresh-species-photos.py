#!/usr/bin/env python3
"""Curate reusable exact-taxon photos for the checked-in wildlife sample.

Only photo-specific CC0/CC BY/CC BY-SA licenses are accepted. This is an
on-demand reference-asset refresh, not part of the daily changing-data job.
No observation coordinates, descriptions, or account profiles are persisted.
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
API = 'https://api.inaturalist.org/v1/'
ALLOWED = {'cc0', 'cc-by', 'cc-by-sa'}
HOSTS = {'inaturalist-open-data.s3.amazonaws.com', 'static.inaturalist.org'}
USER_AGENT = 'Andymap species reference photos (andrewhanes.com)'
_last_request = 0


def fetch_json(path, cache_dir):
    global _last_request
    cache_file = cache_dir / (hashlib.sha256(path.encode()).hexdigest() + '.json')
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    for attempt in range(3):
        time.sleep(max(0, 1.1 - (time.monotonic() - _last_request)))
        _last_request = time.monotonic()
        try:
            request = urllib.request.Request(API + path, headers={'User-Agent': USER_AGENT})
            with urllib.request.urlopen(request, timeout=35) as response:
                payload = json.load(response)
            cache_file.write_text(json.dumps(payload))
            return payload
        except (urllib.error.URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))


def image_url(value, size):
    if not isinstance(value, str):
        return None
    parsed = urllib.parse.urlparse(value)
    if parsed.scheme != 'https' or parsed.hostname not in HOSTS or parsed.username or parsed.password:
        return None
    if not re.fullmatch(r'/photos/\d+/(square|small|medium|large|original)\.(jpg|jpeg|png|webp)', parsed.path, re.I):
        return None
    return urllib.parse.urlunparse(parsed._replace(path=re.sub(r'/(square|small|medium|large|original)\.', '/' + size + '.', parsed.path), query='', fragment=''))


def curate(photo, taxon):
    if not isinstance(photo, dict) or photo.get('license_code') not in ALLOWED:
        return None
    if not photo.get('attribution') or photo.get('hidden') or photo.get('flags') or photo.get('moderator_actions'):
        return None
    if not isinstance(photo.get('id'), int):
        return None
    medium = image_url(photo.get('medium_url') or photo.get('url'), 'medium')
    if not medium:
        return None
    source_url = 'https://www.inaturalist.org/photos/' + str(photo['id'])
    # Link to the photo's actual license record, not a guessed license version
    # for older imported Wikimedia/Flickr photographs.
    return {
        'taxonId': taxon['id'], 'scientificName': taxon['name'],
        'name': taxon.get('preferred_common_name') or taxon['name'],
        'url': medium, 'thumbnailUrl': image_url(medium, 'small'),
        'credit': photo['attribution'], 'license': photo['license_code'],
        'licenseUrl': source_url, 'sourceUrl': source_url, 'photoId': photo['id'],
        'group': taxon.get('iconic_taxon_name') or '',
    }


def select_taxon_photo(taxon):
    # Taxon-curated alternates remain exact ID matches. Never replace a
    # species image with one belonging to its genus or a similar species.
    candidates = [x.get('photo') for x in (taxon.get('taxon_photos') or []) if x.get('taxon_id') == taxon['id']]
    candidates = [taxon.get('default_photo')] + candidates
    for photo in candidates:
        choice = curate(photo, taxon)
        if choice:
            return choice
    return None


def usable_reviewed_pick(picked, taxon):
    if not isinstance(picked, dict) or picked.get('taxonId') != taxon['id'] or picked.get('scientificName') != taxon['name']:
        return False
    if picked.get('license') not in ALLOWED or not picked.get('credit') or not isinstance(picked.get('photoId'), int):
        return False
    return (image_url(picked.get('url'), 'medium') == picked.get('url')
            and picked.get('sourceUrl') == 'https://www.inaturalist.org/photos/' + str(picked['photoId'])
            and picked.get('licenseUrl') == picked.get('sourceUrl'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', required=True, type=Path, help='Scratch directory for response cache; do not commit raw responses')
    parser.add_argument('--output', type=Path, default=ROOT / 'species-photos.json')
    parser.add_argument('--no-observation-fallback', action='store_true')
    args = parser.parse_args()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    snapshot = json.loads((ROOT / 'wildlife-snapshot.json').read_text())
    requested = {t['id']: {'id': t['id'], 'name': t['scientificName'], 'preferred_common_name': t['name']} for t in snapshot['analytics']['taxa']}
    for feature in snapshot['features']:
        p = feature['properties']
        requested.setdefault(p['taxonId'], {'id': p['taxonId'], 'name': p['scientificName'], 'preferred_common_name': p['title'], 'iconic_taxon_name': p.get('taxonGroup', '')})
    output = {'version': 1, 'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'source': API,
              'query': {'sourceSnapshot': 'wildlife-snapshot.json', 'd1': snapshot['query']['d1'], 'd2': snapshot['query']['d2'], 'scope': 'Every unique taxon in the default report sample and leading-species list'},
              'coverage': {}, 'taxa': {}, 'missing': []}
    taxa = output['taxa']
    pick_path = ROOT / 'scripts/species-photo-picks.json'
    picks = json.loads(pick_path.read_text()).get('taxa', {}) if pick_path.exists() else {}
    warnings = []

    def save():
        output['missing'] = [t for tid, t in requested.items() if str(tid) not in taxa]
        output['coverage'] = {'requested': len(requested), 'available': len(taxa), 'missing': len(output['missing'])}
        output['warnings'] = warnings
        args.output.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')

    ids = list(requested)
    for start in range(0, len(ids), 30):
        batch = ids[start:start + 30]
        try:
            data = fetch_json('taxa/' + ','.join(map(str, batch)) + '?locale=en', args.cache_dir)
            for taxon in data.get('results', []):
                if taxon['id'] not in requested or taxon['name'] != requested[taxon['id']]['name']:
                    continue
                requested[taxon['id']] = {k: taxon[k] for k in ('id', 'name', 'preferred_common_name', 'iconic_taxon_name') if k in taxon}
                picked = picks.get(str(taxon['id']))
                photo = picked if usable_reviewed_pick(picked, taxon) else select_taxon_photo(taxon)
                if photo:
                    taxa[str(taxon['id'])] = photo
        except Exception as exc:
            warnings.append('Taxon batch unavailable: ' + str(exc))
        save()
        print('Curated taxon photos:', start + len(batch), '/', len(ids), 'photos:', len(taxa), flush=True)

    if not args.no_observation_fallback:
        missing = [tid for tid in ids if str(tid) not in taxa]
        for index, tid in enumerate(missing):
            query = urllib.parse.urlencode({'taxon_id': tid, 'quality_grade': 'research', 'photo_license': ','.join(sorted(ALLOWED)), 'photos': 'true', 'per_page': 20, 'order_by': 'votes'})
            try:
                data = fetch_json('observations?' + query, args.cache_dir)
                found = False
                for observation in data.get('results', []):
                    taxon = observation.get('taxon') or {}
                    if taxon.get('id') != tid or taxon.get('name') != requested[tid]['name']:
                        continue
                    for photo in observation.get('photos', []):
                        choice = curate(photo, taxon)
                        if choice:
                            choice['observationUrl'] = 'https://www.inaturalist.org/observations/' + str(observation['id'])
                            taxa[str(tid)] = choice
                            found = True
                            break
                    if found:
                        break
            except Exception as exc:
                warnings.append('Photo search unavailable for taxon ' + str(tid) + ': ' + str(exc))
            save()
            print('Licensed observation fallback:', index + 1, '/', len(missing), 'photos:', len(taxa), flush=True)
    print(json.dumps(output['coverage']), flush=True)


if __name__ == '__main__':
    main()
