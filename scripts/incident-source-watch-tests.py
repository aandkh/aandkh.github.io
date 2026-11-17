#!/usr/bin/env python3
import copy
import datetime as dt
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('watch', pathlib.Path(__file__).with_name('incident-source-watch.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
NOW = dt.datetime(2026, 11, 17, 15, tzinfo=dt.timezone.utc)
URL = 'https://www.firstalert4.com/2026/11/16/test-shooting/'


def feed(text='Police reported one injured.'):
    return ('<rss xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><item><title>Shooting reported</title><link>' + URL + '</link><pubDate>Mon, 16 Nov 2026 12:00:00 -0600</pubDate><description>Police investigation</description><content:encoded><![CDATA[<p>' + text + '</p>]]></content:encoded></item></channel></rss>').encode()


class WatchTests(unittest.TestCase):
    def test_publication_is_not_occurrence_and_no_article_body_is_retained(self):
        row = m.parse_feed(feed())[0]
        self.assertEqual(row['publishedAt'], '2026-11-16T18:00:00+00:00')
        self.assertNotIn('incidentAt', row)
        self.assertNotIn('geometry', row)
        self.assertNotIn('injuries', row)
        self.assertNotIn('Police reported one injured.', str(row))

    def test_same_title_and_date_correction_reopens_review(self):
        state = {'sources': {}, 'articles': {}}
        m.merge_feed(state, 'firstalert-county', m.parse_feed(feed()), {}, NOW)
        row = state['articles'][URL]
        row['review'] = {'revision': row['revision'], 'disposition': 'mapped'}
        self.assertEqual(m.pending(state), [])
        m.merge_feed(state, 'firstalert-county', m.parse_feed(feed('Police corrected the injury count.')), {}, NOW)
        self.assertEqual(len(m.pending(state)), 1)

    def test_unchanged_facts_are_noop_even_with_new_http_headers(self):
        state = {'sources': {}, 'articles': {}}
        rows = m.parse_feed(feed())
        m.merge_feed(state, 'firstalert-county', rows, {'etag': 'one'}, NOW)
        before = copy.deepcopy(state)
        m.merge_feed(state, 'firstalert-county', rows, {'etag': 'two'}, NOW + dt.timedelta(days=1))
        self.assertEqual(state, before)
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'state.json'
            self.assertTrue(m.write_if_changed(path, state))
            self.assertFalse(m.write_if_changed(path, state))

    def test_leaving_feed_never_deletes_a_candidate_and_window_gaps_warn(self):
        state = {'sources': {}, 'articles': {}}
        m.merge_feed(state, 'firstalert-county', m.parse_feed(feed()), {}, NOW)
        rows = m.parse_feed(feed().replace(b'test-shooting', b'other-shooting'))
        warnings = m.merge_feed(state, 'firstalert-county', rows, {}, NOW)
        self.assertIn(URL, state['articles'])
        self.assertEqual(len(m.pending(state)), 2)
        self.assertTrue(warnings)

    def test_multiple_feeds_do_not_duplicate_cases_and_untrusted_urls_rejected(self):
        state = {'sources': {}, 'articles': {}}
        for source in m.SOURCES:
            m.merge_feed(state, source, m.parse_feed(feed()), {}, NOW)
        self.assertEqual(len(m.pending(state)), 1)
        self.assertEqual(len(state['articles'][URL]['sources']), 2)
        with self.assertRaises(ValueError):
            m.parse_feed(feed().replace(b'https://www.firstalert4.com', b'http://127.0.0.1'))
        with self.assertRaises(ValueError):
            m.parse_feed(b'<html>Temporarily unavailable</html>')
        with self.assertRaises(ValueError):
            m.parse_feed(b'<rss><channel/></rss>')

    def test_conditional_request_and_304_require_existing_records(self):
        error = urllib.error.HTTPError(URL, 304, 'Not modified', {}, None)
        with patch.object(m.urllib.request, 'urlopen', side_effect=error) as request:
            self.assertEqual(m.fetch_feed(URL, {'etag': 'abc', 'articleUrls': [URL]}), (None, {}))
            self.assertEqual(request.call_args.args[0].get_header('If-none-match'), 'abc')
            with self.assertRaises(ValueError):
                m.fetch_feed(URL, {})


if __name__ == '__main__':
    unittest.main()
