#!/usr/bin/env python3
import datetime as dt
import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('rain_refresh',pathlib.Path(__file__).with_name('rain-budget-refresh.py'))
rain=importlib.util.module_from_spec(spec)
spec.loader.exec_module(rain)

class RainRefreshTests(unittest.TestCase):
    def test_missing_trace_and_zero(self):
        for missing in [None,'','M','MM',float('nan'),-1,True]:
            self.assertEqual(rain.amount(missing,True),(None,False))
        self.assertEqual(rain.amount('T',True),(0,True))
        self.assertEqual(rain.amount(.0001,True),(0,True))
        self.assertEqual(rain.amount(0,True),(0,False))
        self.assertEqual(rain.amount('.03',True),(.03,False))

    def test_complete_report_selection(self):
        start=dt.date(2026,11,1);end=dt.date(2026,11,14)
        def row(day,product,precip):
            return {'station':'KSTL','valid':day,'product':product,'precip':precip,'precip_normal':.12}
        partial=row('2026-11-14','202611142200-KLSX-CDUS43-CLISTL',.01)
        full=row('2026-11-14','202611150830-KLSX-CDUS43-CLISTL',.05)
        revised=row('2026-11-14','202611151230-KLSX-CDUS43-CLISTL',.06)
        future=row('2026-11-15','202611160830-KLSX-CDUS43-CLISTL',4)
        self.assertEqual(rain.normalize([partial],start,end),[])
        clean=rain.normalize([full,partial,future,revised],start,end)
        self.assertEqual(len(clean),1);self.assertEqual(clean[0]['precipIn'],.06)

    def test_unknown_kept_as_unknown(self):
        row={'station':'KSTL','valid':'2026-11-14','product':'202611150830-KLSX-CDUS43-CLISTL','precip':'M','precip_normal':'M'}
        clean=rain.normalize([row],dt.date(2026,11,1),dt.date(2026,11,14))[0]
        self.assertIsNone(clean['precipIn']);self.assertIsNone(clean['normalIn'])

if __name__=='__main__':unittest.main()
