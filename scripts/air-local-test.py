#!/usr/bin/env python3
import datetime as dt
import importlib.util
from pathlib import Path
import unittest
import sys
sys.dont_write_bytecode = True

spec=importlib.util.spec_from_file_location('refresh',Path(__file__).with_name('refresh-air-local.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
FIXTURE=Path(__file__).with_name('fixtures').joinpath('dnr-rider-trail-2026-11-18.txt').read_text()
NOW=dt.datetime(2026,11,18,16,30,tzinfo=dt.timezone.utc)

class ParserTests(unittest.TestCase):
    def station(self,text=FIXTURE,now=NOW): return m.parse_report(text,now)['stations'][0]
    def test_real_source(self):
        s=self.station();self.assertEqual(s['observedAt'],'2026-11-18T15:00:00Z')
        self.assertEqual({r['parameter']:r['value'] for r in s['readings']},{'SO2':2.1,'NO':32.4,'NO2':24.4,'NOx':56.8})
        self.assertEqual(s['wind']['speed'],5.1);self.assertEqual(s['wind']['directionFromDegrees'],163)
    def test_flags_never_coerced(self):
        for value in ['p','B','R','D','2.1P','NaN','inf','-999','']:
            text=FIXTURE.replace('         2.1      32.4','         '+value+'      32.4')
            s=self.station(text)
            reading=next(r for r in s['readings'] if r['parameter']=='SO2')
            self.assertEqual(reading['observedAt'],'2026-11-18T14:00:00Z')
    def test_zero_is_valid(self):
        s=self.station(FIXTURE.replace('         2.1      32.4','         0.0      32.4'))
        self.assertEqual(s['readings'][0]['value'],0)
    def test_stale_is_unavailable(self):
        s=self.station(now=NOW+dt.timedelta(hours=8));self.assertEqual(s['readings'],[]);self.assertIsNone(s['wind'])
    def test_schema_drift_fails(self):
        with self.assertRaises(ValueError): self.station(FIXTURE.replace('NO2_Direct','NH3_Direct'))
        with self.assertRaises(ValueError): self.station(FIXTURE.replace('Interval: 001h','Interval: 008h'))
        with self.assertRaises(ValueError): self.station(FIXTURE.replace('PPB','PPM'))
    def test_partial_hours_and_future_report(self):
        with self.assertRaises(ValueError): self.station(now=NOW-dt.timedelta(hours=1))
    def test_incomplete_hour_not_used(self):
        text=FIXTURE.replace('11/18/2026 10:11','11/18/2026 09:11')
        s=self.station(text,NOW-dt.timedelta(hours=1))
        self.assertEqual(s['observedAt'],'2026-11-18T14:00:00Z')
    def test_fixed_cst_in_summer(self):
        text=FIXTURE.replace('11/18/2026','7/18/2026')
        s=self.station(text,dt.datetime(2026,7,18,16,30,tzinfo=dt.timezone.utc))
        self.assertEqual(s['observedAt'],'2026-07-18T15:00:00Z')
    def test_calm_has_no_direction(self):
        s=self.station(FIXTURE.replace('163           5.1','163           0.0'))
        self.assertIsNone(s['wind']['directionFromDegrees'])
    def test_other_page_not_reused(self):
        s=self.station(FIXTURE+'\f'+FIXTURE.replace('WINDD','OTEMP_2M'))
        self.assertEqual(s['wind']['speed'],5.1)

if __name__=='__main__': unittest.main()
