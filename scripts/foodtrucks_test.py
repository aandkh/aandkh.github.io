#!/usr/bin/env python3
import datetime as dt,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('trucks',Path(__file__).with_name('refresh-foodtrucks.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=dt.datetime(2026,11,15,12,tzinfo=dt.timezone.utc)
def row(venue='Public market',name='Local Truck',lat='38.6',lng='-90.3',stamp='1794776400'):
 return f'<div class="eve_row" id="post_123" st="{stamp}" lat="{lat}" lng="{lng}" tname="truck"><div class="eve_name">{name}</div><div class="eve_addy">{venue}</div><div class="eve_time">3pm-8pm</div><div class="eve_st1">123 Public St</div><div class="eve_st2">St Louis MO</div><div class="eve_cuis">Tacos</div></div>'
class ParserTests(unittest.TestCase):
 def test_exact_source_pin_and_end(self):
  f=m.parse_calendar(row(),NOW)[0];self.assertEqual(f['geometry']['coordinates'],[-90.3,38.6]);self.assertEqual(f['properties']['end'],'2026-11-16T02:00:00Z');self.assertEqual(f['properties']['url'],'https://stlfta.com/member/truck')
 def test_nonpublic_appointments_and_bad_pins_excluded(self):
  for value in [row('Private wedding'),row('[OCUS] Photoshoot for DoorDash USA'),row(lat='0'),row(stamp='not-a-date'),row(name='Cousins Maine Lobster MO')]:self.assertEqual(m.parse_calendar(value,NOW),[])
 def test_restricted_not_mislabeled_public(self):self.assertIn('restricted',m.parse_calendar(row('Elementary School'),NOW)[0]['properties']['accessNote'])
 def test_past_hidden(self):self.assertEqual(m.parse_calendar(row(),NOW+dt.timedelta(days=2)),[])
 def test_operator_not_given_a_live_location(self):
  raw='<div class="blog-thumbnail"><a class="truck_name_link" href="/member/local">Local Truck</a><span class="category-tag">Tacos</span></div>'
  f=m.parse_members(raw,NOW)[0];self.assertIsNone(f['geometry']);self.assertEqual(f['properties']['displayKind'],'operator')
if __name__=='__main__':unittest.main()
