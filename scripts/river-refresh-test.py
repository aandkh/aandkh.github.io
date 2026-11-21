import importlib.util,pathlib,unittest,datetime as dt
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('r',pathlib.Path(__file__).with_name('river-refresh.py'));r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class Tests(unittest.TestCase):
 def test_modern_success_never_waits_on_legacy(self):
  with patch.object(r,'modern',return_value=[]),patch.object(r,'fetch',side_effect=AssertionError('legacy requested')):
   self.assertEqual(r.batch(['05587060']),{'05587060':None})
 def test_fallback_only_failed_ids(self):
  with patch.object(r,'NOW',dt.datetime(2026,11,20,tzinfo=dt.timezone.utc)),patch.object(r,'modern',side_effect=[[],OSError('down')]),patch.object(r,'fetch',return_value={'value':{'timeSeries':[]}}) as f:
   self.assertEqual(r.batch(['05587060','07010000']),{'05587060':None});self.assertIn('sites=07010000',f.call_args.args[0]);self.assertNotIn('05587060',f.call_args.args[0])
 def test_legacy_retirement_gate_preserved(self):
  with patch.object(r,'NOW',dt.datetime(2027,1,1,tzinfo=dt.timezone.utc)),patch.object(r,'modern',side_effect=OSError()),patch.object(r,'fetch',side_effect=AssertionError()):self.assertEqual(r.batch(['07010000']),{})
 def test_recent_complete_same_gauge_days_required(self):
  start=r.START;rows=[((start+dt.timedelta(days=d,hours=h)).isoformat(),-2) for d in range(20) for h in range(24)]
  self.assertEqual(r.aggregate(rows)['days'],20);self.assertEqual(r.aggregate(rows)['meanFt'],-2)
  self.assertIsNone(r.aggregate(rows[:19*24]));self.assertIsNone(r.aggregate([('2024-12-09T19:30:00Z',9)]))
if __name__=='__main__':unittest.main()
