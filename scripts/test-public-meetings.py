#!/usr/bin/env python3
import datetime as dt
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('meetings', pathlib.Path(__file__).with_name('refresh-public-meetings.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class PublicMeetingsTests(unittest.TestCase):
    def test_city_published_dates_not_inferred_recurrence(self):
        html = '''<h3 class="event-date">Tuesday, Nov 17, 2026</h3><div><li><a href="/events/eventdetails.cfm?Event_ID=1">Council</a><div class="event-details">1:45 PM, Board, Meeting</div></li></div><h3 class="event-date">Friday, Jan 15, 2027</h3><div><li><a href="/events/eventdetails.cfm?Event_ID=2">Later</a></li></div>'''
        rows = m.city_list(html, dt.date(2026,11,17), dt.date(2026,12,17))
        self.assertEqual([row['id'] for row in rows], ['1'])
        self.assertEqual(rows[0]['listingDetails'], '1:45 PM, Board, Meeting')
        with self.assertRaises(ValueError): m.city_list('<h1>Error</h1>',dt.date.today(),dt.date.today())

    def test_ical_unfolding_timezone_and_cancellation(self):
        raw = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/Chicago:20261117T134500\r\nSUMMARY:Public meeting\r\nLOCATION:1200 Market Street\\,\r\n Room 325\r\nSTATUS:CANCELLED\r\nEND:VEVENT\r\nEND:VCALENDAR'
        row = m.ical_record(raw)
        self.assertEqual(row['start'], '2026-11-17T13:45:00-06:00')
        self.assertEqual(row['location'], '1200 Market Street,Room 325')
        self.assertTrue(row['cancelled'])
        with self.assertRaises(ValueError): m.local_start('2026-03-08 02:30', '%Y-%m-%d %H:%M')
        with self.assertRaises(ValueError): m.local_start('2026-11-01 01:30', '%Y-%m-%d %H:%M')
        self.assertEqual(m.local_start('2026-07-02 10:00','%Y-%m-%d %H:%M').utcoffset(),dt.timedelta(hours=-5))

    def test_county_published_only_and_conflicting_dates(self):
        import json
        base = {'Id':1,'Published':True,'MeetingDate':'2026-11-17','MeetingDateTime':'2026-11-17 18:30','Name':'County Council','MeetingLocation':'Council Chambers'}
        rows=[base,{**base,'Id':2,'Published':False},{**base,'Id':3,'Name':'CANCELED meeting'},{**base,'Id':4,'MeetingDate':'2026-11-18'}]
        records,cancelled,warnings=m.county_records(json.dumps(rows),dt.date(2026,11,17),dt.date(2026,12,17))
        self.assertEqual([x['id'] for x in records],['1'])
        self.assertEqual(cancelled,{'county-meeting:3'})
        self.assertEqual(len(warnings),1)
        self.assertEqual(records[0]['start'],'2026-11-17T18:30:00-06:00')

    def test_virtual_unlocated_or_failed_geocoder_never_invents_pin(self):
        record={'id':'1','title':'Meeting','start':'2026-11-18T10:00:00-06:00','location':'Virtual Meeting','url':m.CITY}
        with patch.object(m,'fetch',side_effect=AssertionError('unexpected network')):
            row=m.feature(record,'city','checked',{})
            self.assertIsNone(row['geometry'])
            self.assertEqual(row['properties']['address'],'', 'virtual events cannot offer directions to a made-up destination')
        with patch.object(m,'resolve_location',side_effect=OSError('geocoder unavailable')):
            warnings=[]
            row=m.feature({**record,'location':'1200 Market St, St Louis, MO'},'city','checked',{},warnings)
            self.assertIsNone(row['geometry'])
            self.assertIn('geocoder unavailable',warnings[0])
            self.assertEqual(row['properties']['start'],record['start'])

    def test_coordinates_require_single_regional_address_match(self):
        import json
        cache={};address='1200 Market St, St Louis, MO 63103'
        data={'result':{'addressMatches':[{'matchedAddress':'1200 MARKET ST, ST LOUIS, MO, 63103','coordinates':{'x':-90.199,'y':38.626}}]}}
        result=m.resolve_location(address,'city',cache,getter=lambda u:json.dumps(data))
        self.assertEqual(result['coordinates'],[-90.199,38.626])
        self.assertEqual(m.resolve_location(address,'city',cache,getter=lambda u:1/0),result)
        data['result']['addressMatches'][0]['coordinates']['x']=-80
        self.assertIsNone(m.resolve_location(address,'city',{},getter=lambda u:json.dumps(data)))

    def test_failure_preserves_verification_and_cancel_removes_only_confirmed(self):
        record={'id':'1','title':'Meeting','start':'2026-11-18T10:00:00-06:00','location':'Virtual Meeting','url':m.CITY}
        old=m.feature(record,'city','2026-11-16T12:00:00Z',{})
        now=dt.datetime(2026,11,17,tzinfo=dt.timezone.utc)
        self.assertEqual(m.preserve_records([old],[],set(),'city',now),[old])
        self.assertEqual(m.preserve_records([old],[],{'city-meeting:1'},'city',now),[])
        same=m.feature(record,'city','2026-11-17T12:00:00Z',{})
        self.assertEqual(m.preserve_records([old],[same],set(),'city',now)[0]['properties']['sourceCheckedAt'],old['properties']['sourceCheckedAt'])
        changed=m.feature({**record,'start':'2026-11-19T10:00:00-06:00'},'city','2026-11-17T12:00:00Z',{})
        self.assertEqual(m.preserve_records([old],[changed],set(),'city',now),[changed])
        self.assertEqual(m.preserve_records([old],[],set(),'county',now),[])
        self.assertEqual(m.preserve_records([old],[],set(),'city',dt.datetime(2026,11,18,16,tzinfo=dt.timezone.utc)),[])

if __name__ == '__main__': unittest.main()
