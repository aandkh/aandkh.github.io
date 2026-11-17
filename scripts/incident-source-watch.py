#!/usr/bin/env python3
"""Discover changed local incident reporting for the existing daily human review.

RSS publication dates are NOT incident dates. This job never creates map points,
outcome counts or inferred incidents. Only the reviewed archive can do that.
"""
import argparse
import datetime as dt
import email.utils
import hashlib
import html
import json
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCES = {
    'firstalert-county': 'https://www.firstalert4.com/arc/outboundfeeds/rss/category/news/st-louis-county/?outputType=xml',
    'firstalert-crime': 'https://www.firstalert4.com/arc/outboundfeeds/rss/category/news/crime/?outputType=xml',
}
TERMS = re.compile(r'\b(police|shoot\w*|shot|crash\w*|collision|hit.and.run|kill\w*|homicid\w*|murder\w*|assault\w*|rob\w*|burglar\w*|arson|stabb\w*|threat\w*|missing|dead|death\w*|injur\w*|stol\w*|theft|charg\w*|arrest\w*)\b', re.I)
DISPOSITIONS = ('mapped', 'already-mapped', 'outside-region', 'not-incident', 'insufficient-location', 'excluded-sensitive', 'historical-followup')


def canonical_url(value):
    p = urllib.parse.urlsplit(value or '')
    if p.scheme != 'https' or p.hostname != 'www.firstalert4.com' or not re.match(r'^/\d{4}/\d{2}/\d{2}/[^/]+/?$', p.path):
        raise ValueError('Unrecognized article URL')
    return urllib.parse.urlunsplit((p.scheme, p.netloc, p.path.rstrip('/') + '/', '', ''))


def plain(value):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', value or ''))).strip()


def parse_feed(body):
    if len(body) > 4_000_000:
        raise ValueError('Feed exceeded bounded size')
    root = ET.fromstring(body)
    if root.tag != 'rss':
        raise ValueError('Not an RSS response')
    rows = []
    for item in root.findall('./channel/item'):
        url = canonical_url(item.findtext('link'))
        stamp = email.utils.parsedate_to_datetime(item.findtext('pubDate') or '')
        if not stamp or not stamp.tzinfo:
            raise ValueError('Missing zoned publication timestamp')
        title = plain(item.findtext('title'))
        description = plain(item.findtext('description'))
        # Hash article text to detect corrections even when its title/date stay
        # unchanged. Do not republish article bodies or images in the repository.
        body_text = plain(item.findtext('{http://purl.org/rss/1.0/modules/content/}encoded'))
        revision = hashlib.sha256(json.dumps([title, description, body_text], ensure_ascii=False).encode()).hexdigest()
        rows.append({'url': url, 'title': title, 'publishedAt': stamp.astimezone(dt.timezone.utc).isoformat(), 'revision': revision, 'candidate': bool(TERMS.search(title + ' ' + description))})
    if not rows:
        raise ValueError('Empty feed; prior discoveries retained')
    return rows


def fetch_feed(url, previous):
    headers = {'User-Agent': 'AndymapMaintenance/1.0 (+https://www.andrewhanes.com)', 'Accept': 'application/rss+xml, application/xml'}
    for key, header in [('etag', 'If-None-Match'), ('lastModified', 'If-Modified-Since')]:
        if previous.get(key):
            headers[header] = previous[key]
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=25) as response:
            return parse_feed(response.read(4_000_001)), {'etag': response.headers.get('ETag'), 'lastModified': response.headers.get('Last-Modified')}
    except urllib.error.HTTPError as error:
        if error.code == 304:
            if not previous.get('articleUrls'):
                raise ValueError('304 without previous feed records')
            return None, {}
        raise


def merge_feed(state, source, rows, headers, now):
    previous = state['sources'].get(source, {})
    urls = [row['url'] for row in rows]
    warnings = []
    if previous.get('articleUrls') and not set(urls).intersection(previous['articleUrls']):
        warnings.append('Feed window no longer overlaps the previous snapshot; review the section archive for missed reports.')
    latest = max(row['publishedAt'] for row in rows)
    oldest = min(row['publishedAt'] for row in rows)
    if dt.datetime.fromisoformat(latest) < now - dt.timedelta(days=3):
        warnings.append('Newest article is over three days old; inspect publisher freshness.')
    cutoff = (now - dt.timedelta(days=14)).isoformat()
    for row in rows:
        url = row['url']
        old = state['articles'].get(url)
        # First run looks back fourteen publication days. Existing candidates
        # are retained permanently, including when they leave the short RSS feed.
        if not old and (not row['candidate'] or row['publishedAt'] < cutoff):
            continue
        if old and old['revision'] == row['revision']:
            old['sources'] = sorted(set(old['sources'] + [source]))
            continue
        result = {k: v for k, v in row.items() if k != 'candidate'}
        result.update({'sources': sorted(set((old or {}).get('sources', []) + [source])), 'discoveredAt': (old or {}).get('discoveredAt', now.isoformat()), 'changedAt': now.isoformat()})
        if old and old.get('review'):
            result['review'] = old['review']  # revision mismatch reopens review
        state['articles'][url] = result
    next_source = {'url': SOURCES[source], 'articleUrls': urls, 'latestPublishedAt': latest, 'oldestPublishedAt': oldest}
    comparable = {k: previous.get(k) for k in next_source}
    # Conditional headers may rotate without changed facts. Do not create a
    # daily commit solely to move HTTP validators or verification timestamps.
    if comparable != next_source:
        next_source.update(headers)
        next_source['contentChangedAt'] = now.isoformat()
        state['sources'][source] = next_source
    return warnings


def pending(state):
    return sorted((row for row in state['articles'].values() if row.get('review', {}).get('revision') != row['revision']), key=lambda row: row['publishedAt'], reverse=True)


def write_if_changed(path, value):
    text = json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n'
    if path.exists() and path.read_text() == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(text)
    temp.replace(path)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--state', type=pathlib.Path, default=ROOT / 'incident-source-watch.json')
    parser.add_argument('--report', type=pathlib.Path, default=pathlib.Path('/tmp/andymap-incident-source-report.json'))
    parser.add_argument('--resolve', nargs='+', metavar='URL', help='Mark the exact current article revisions as actually reviewed; no network calls')
    parser.add_argument('--disposition', choices=DISPOSITIONS)
    parser.add_argument('--note', default='')
    args = parser.parse_args()
    now = dt.datetime.now(dt.timezone.utc)
    state = json.loads(args.state.read_text()) if args.state.exists() else {'version': 1, 'sources': {}, 'articles': {}}
    if args.resolve:
        if not args.disposition or not args.note.strip():
            parser.error('--resolve requires --disposition and a factual --note')
        for value in args.resolve:
            url = canonical_url(value)
            if url not in state['articles']:
                parser.error('Article is not in the review queue: ' + url)
            row = state['articles'][url]
            row['review'] = {'revision': row['revision'], 'checkedAt': now.isoformat(), 'disposition': args.disposition, 'note': args.note.strip()}
        write_if_changed(args.state, state)
        print(str(len(args.resolve)) + ' actual article reviews recorded.')
        return 0
    checks = []
    for source, url in SOURCES.items():
        try:
            rows, headers = fetch_feed(url, state['sources'].get(source, {}))
            warnings = merge_feed(state, source, rows, headers, now) if rows is not None else []
            if rows is None and dt.datetime.fromisoformat(state['sources'][source]['latestPublishedAt']) < now - dt.timedelta(days=3):
                warnings.append('Newest article is over three days old; inspect publisher freshness.')
            checks.append({'source': source, 'url': url, 'status': 'unchanged' if rows is None else 'ok', 'checkedAt': now.isoformat(), 'rows': len(rows) if rows is not None else len(state['sources'][source]['articleUrls']), 'warnings': warnings})
        except Exception as error:
            # No successful source timestamp or old article record is replaced.
            checks.append({'source': source, 'url': url, 'status': 'error', 'attemptedAt': now.isoformat(), 'error': str(error)[:250]})
    changed = write_if_changed(args.state, state)
    waiting = pending(state)
    report = {'attemptedAt': now.isoformat(), 'stateChanged': changed, 'sources': checks, 'pendingReviews': waiting, 'note': 'Publication dates are not incident dates. Review the actual changed articles, verify occurrence, jurisdiction, outcomes and public location; add only verified incidents to incident-reviewed.json, then repack. These bounded feeds supplement official sources; they do not establish complete coverage.'}
    write_if_changed(args.report, report)
    for check in checks:
        print(check['source'] + ': ' + check['status'] + ('; ' + check['error'] if check.get('error') else ''))
        for warning in check.get('warnings', []):
            print('REVIEW: ' + warning)
    print(str(len(waiting)) + ' new/changed articles need review. Report: ' + str(args.report))
    return 1 if any(c['status'] == 'error' for c in checks) else 2 if waiting or any(c.get('warnings') for c in checks) else 0


if __name__ == '__main__':
    sys.exit(main())
