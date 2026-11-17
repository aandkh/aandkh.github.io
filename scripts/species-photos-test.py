#!/usr/bin/env python3
"""Check licensing boundaries and reference-photo inventory integrity."""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('photos', root / 'scripts/refresh-species-photos.py')
photos = importlib.util.module_from_spec(spec)
spec.loader.exec_module(photos)
taxon = {'id': 7089, 'name': 'Branta canadensis'}
photo = {'id': 12, 'license_code': 'cc-by', 'attribution': 'Photographer · CC BY', 'medium_url': 'https://inaturalist-open-data.s3.amazonaws.com/photos/12/medium.jpg'}
assert photos.curate(photo, taxon)['taxonId'] == 7089
for license_code in ('cc-by-nc', 'cc-by-nd', 'cc-by-nc-sa', None, 'unknown'):
    assert photos.curate({**photo, 'license_code': license_code}, taxon) is None
for patch in ({'hidden': True}, {'attribution': ''}, {'flags': [{'flag': 'copyright'}]}, {'medium_url': 'https://inaturalist-open-data.s3.amazonaws.com.evil.test/photos/12/medium.jpg'}, {'medium_url': 'javascript:alert(1)'}):
    assert photos.curate({**photo, **patch}, taxon) is None
assert photos.select_taxon_photo({**taxon, 'taxon_photos': [{'taxon_id': 999, 'photo': photo}]}) is None
assert photos.select_taxon_photo({**taxon, 'taxon_photos': [{'taxon_id': 7089, 'photo': photo}]})['photoId'] == 12

inventory = json.loads((root / 'species-photos.json').read_text())
snapshot = json.loads((root / 'wildlife-snapshot.json').read_text())
requested = {row['id']: row['scientificName'] for row in snapshot['analytics']['taxa']}
requested.update({row['properties']['taxonId']: row['properties']['scientificName'] for row in snapshot['features']})
assert inventory['coverage']['requested'] == len(requested)
assert inventory['coverage']['available'] == len(inventory['taxa'])
assert inventory['coverage']['missing'] == len(inventory['missing'])
assert len(inventory['taxa']) + len(inventory['missing']) == len(requested)
for tid, entry in inventory['taxa'].items():
    assert int(tid) == entry['taxonId']
    assert entry['scientificName'] == requested[int(tid)]
    assert entry['license'] in photos.ALLOWED and entry['credit']
    assert photos.image_url(entry['url'], 'medium') == entry['url']
    assert entry['sourceUrl'] == 'https://www.inaturalist.org/photos/' + str(entry['photoId'])
    assert entry['licenseUrl'] == entry['sourceUrl']
print('Species photo licensing, exact taxonomy, URL boundaries and inventory checks passed:', inventory['coverage'])
