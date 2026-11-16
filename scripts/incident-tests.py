#!/usr/bin/env python3
import sys
sys.dont_write_bytecode = True
import importlib.util,pathlib,unittest,tempfile,datetime,json
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('refresh',pathlib.Path(__file__).with_name('incident-refresh.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class IncidentTests(unittest.TestCase):
 def test_coverage_never_silently_loses_county(self):
  now=datetime.datetime(2026,11,15,18,tzinfo=datetime.timezone.utc)
  sources=[{'id':i,'latestIncidentDate':'2026-11-08','status':'ok'} for i in ['city-crimemapping','county-nibrs','county-crashes','county-florissant']]
  audit=m.coverage_audit([],sources,now);self.assertEqual(audit['byJurisdiction']['county']['pastWeek'],0)
  self.assertIn('empty-region-week',[w['code'] for w in audit['warnings']]);self.assertIn('weekly-lag',[w['code'] for w in audit['warnings']])
  self.assertIn('missing-source',[w['code'] for w in m.coverage_audit([],sources[:1],now)['warnings']])
 def test_fatality_index_does_not_infer_victims_or_include_crashes(self):
  rows=[{'properties':{'id':'h','incidentKind':'homicide','incidentAt':'2026-08-20'}},{'properties':{'id':'c','incidentKind':'crash','deaths':1,'incidentAt':'2026-11-10'}}]
  result=m.fatality_records(rows);self.assertEqual(len(result),1);self.assertNotIn('deaths',result[0]['properties'])
 def crime(self,**extra):
  return dict(Report_Number='26-100',reportingJuris='TEST MUNICIPALITY',forJuris='TEST',address='449 TEST RD',longitude=-90.350456,latitude=38.650456,occurred='2026-11-08',OffenseName='Assault, Simple/Other',**extra)
 def test_highway_numbers_are_not_house_numbers(self):
  self.assertEqual(m.masked_address('70'),'Highway 70');self.assertEqual(m.masked_address('270'),'Highway 270');self.assertNotIn('block of',m.masked_address('104123 IS270E TO LILAC AVE'))
 def test_case_dedup_and_multi_offense(self):
  a=self.crime();b={**a,'OffenseName':'Weapon Law Violations'};f,n=m.crime_features([a,a,b],'2026-11-15');self.assertEqual(len(f),1);self.assertEqual(f[0]['properties']['incidentTypes'],['assault','weapons']);self.assertNotIn('deaths',f[0]['properties']);self.assertEqual(f[0]['geometry']['coordinates'],[-90.35,38.65]);self.assertIn('400 block of',f[0]['properties']['address'])
 def test_same_number_different_agency(self):
  a=self.crime();b={**a,'reportingJuris':'ANOTHER'};self.assertEqual(len(m.crime_features([a,b],'now')[0]),2)
 def test_sensitive_and_invalid_geometry_omitted(self):
  self.assertEqual(m.crime_features([{**self.crime(),'OffenseName':'Forcible Sex Offenses'},{**self.crime(),'longitude':0}],'now')[0],[])
 def test_crash_dst_time_and_explicit_zero(self):
  row=dict(Accident_ID=10,Accident_Date=1794117600000,Accident_Time=130,Number_Injured=1,Number_Killed=0,latdd=38.6,londd=-90.3,On_Road='449 TEST RD')
  f=m.crash_features([row],'now')[0][0];self.assertEqual(f['properties']['incidentAt'],'2026-11-08T01:30:00-06:00');self.assertEqual(f['properties']['deaths'],0);self.assertNotIn('449',f['properties']['title'])
  self.assertEqual(m.crash_features([{**row,'Number_Injured':0}],'now')[0],[])
 def test_update_preserves_id_and_first_seen(self):
  a=m.crime_features([self.crime()],'first')[0];b=m.crime_features([self.crime()],'second')[0];r=m.merge_features(a,b);self.assertEqual(len(r),1);self.assertEqual(r[0]['properties']['firstSeenAt'],'first')
 def test_repeated_refresh_preserves_original_discovery_and_inputs(self):
  a=m.crime_features([self.crime()],'2026-11-15')[0];a[0]['properties']['firstSeenAt']='2026-11-10'
  b=m.crime_features([self.crime()],'2026-11-16')[0]
  for rows in [a,a+a]:
   r=m.merge_features(rows,b);self.assertEqual(r[0]['properties']['firstSeenAt'],'2026-11-10');self.assertEqual(r[0]['properties']['sourceCheckedAt'],'2026-11-16')
  self.assertNotIn('firstSeenAt',b[0]['properties']);self.assertEqual(a[0]['properties']['firstSeenAt'],'2026-11-10')
  self.assertEqual(m.merge_features(a,[])[0]['properties']['firstSeenAt'],'2026-11-10')
 def test_archive_does_not_expire_and_snapshot_is_small(self):
  old=m.crime_features([{**self.crime(),'occurred':'2026-08-20'}],'now')[0];new=m.crime_features([{**self.crime(),'Report_Number':'26-200','occurred':'2026-11-10'}],'now')[0]
  with tempfile.TemporaryDirectory() as folder:
   root=pathlib.Path(folder);m.publish_archive(old+new,{},datetime.datetime(2026,11,15,tzinfo=datetime.timezone.utc),root);d=json.loads((root/'recent-incidents.json').read_text());self.assertEqual(len(d['features']),1);self.assertEqual(d['archiveCount'],2);self.assertTrue((root/'incident-archive/2026-08.json').exists())
 def test_pagination_cannot_silently_truncate(self):
  with patch.object(m,'request_json',side_effect=[{'features':[{'attributes':{'a':1}}],'exceededTransferLimit':True},{'features':[{'attributes':{'a':2}}]}]) as mock:
   self.assertEqual(len(m.fetch_source('county-nibrs','2026-11-01')),2);self.assertIn('resultOffset=1',mock.call_args.args[0])
  with patch.object(m,'request_json',return_value={'features':[],'exceededTransferLimit':True}):self.assertRaises(RuntimeError,m.fetch_source,'county-nibrs','2026-11-01')
class CityIncidentTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  spec=importlib.util.spec_from_file_location('city_refresh',pathlib.Path(__file__).with_name('incident-city-refresh.py'));cls.city=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.city)
 def test_city_dates_dedup_missing_outcomes_and_rounded_geometry(self):
  row={'report':'26000123','date':'20261108123000','offense':'BURGLARY','address':'4500 TEST ST','type':'burglary','longitude':-90.23456,'latitude':38.65432}
  features,omitted=self.city.convert([row,{**row,'offense':'THEFT','type':'theft'},{**row,'date':'bad'},{**row,'latitude':None}],'now')
  self.assertEqual(len(features),1);self.assertEqual(omitted,2);p=features[0]['properties'];self.assertEqual(p['incidentTypes'],['burglary','theft']);self.assertEqual(p['incidentAt'],'2026-11-08T12:30:00-06:00');self.assertNotIn('deaths',p);self.assertEqual(features[0]['geometry']['coordinates'],[-90.235,38.654])
 def test_repeated_dst_hour_preserves_clock_without_invented_offset(self):
  row={'report':'x','date':'20261101013000','offense':'THEFT','address':'100 TEST ST','type':'theft','longitude':-90.2,'latitude':38.6}
  p=self.city.convert([row],'now')[0][0]['properties'];self.assertEqual(p['incidentAt'],'2026-11-01');self.assertEqual(p['incidentLocalTime'],'01:30')
 def test_multi_offense_primary_is_independent_of_feed_order(self):
  row={'report':'123','date':'20261026212101','offense':'ASSAULT','address':'8200 BLOCK N LINDBERGH BLVD','type':'assault','longitude':-90.35,'latitude':38.8}
  other={**row,'offense':'BURGLARY','type':'burglary'}
  a=self.city.convert([row,other],'now',self.city.FLORISSANT)[0]
  b=self.city.convert([other,row],'now',self.city.FLORISSANT)[0]
  self.assertEqual(a,b);self.assertEqual(a[0]['properties']['incidentKind'],'assault')
 def test_city_source_category_exclusions(self):
  filters,_=self.city.filters_for(datetime.date(2026,11,1),datetime.date(2026,11,8));self.assertEqual(filters['AgencyFilter'],[726]);self.assertNotIn(11,filters['SelectedCategories']);self.assertNotIn(17,filters['SelectedCategories']);self.assertNotIn(18,filters['SelectedCategories'])
 def test_florissant_is_county_and_not_same_id_as_city(self):
  source=self.city.FLORISSANT;filters,_=self.city.filters_for(datetime.date(2026,11,1),datetime.date(2026,11,8),source);self.assertEqual(filters['AgencyFilter'],[639])
  row={'report':'123','date':'20261110103000','offense':'THEFT','address':'100 TEST ST','type':'theft','longitude':-90.35,'latitude':38.8}
  p=self.city.convert([row],'now',source)[0][0]['properties'];self.assertEqual(p['jurisdiction'],'county');self.assertEqual(p['id'],'incident:florissant-case:123');self.assertEqual(p['sourceId'],'county-florissant')
 def test_city_never_accepts_truncated_results(self):
  with patch.object(self.city,'post',return_value={'result':{'st':1}}):self.assertRaises(RuntimeError,self.city.fetch_window,datetime.date(2026,11,1),datetime.date(2026,11,1))
 def test_city_map_and_report_join_and_mercator(self):
  import math
  x=6378137*math.radians(-90.2);y=6378137*math.log(math.tan(math.pi/4+math.radians(38.6)/2))
  pins={'result':{'st':0,'nr':1,'rs':[{'x':x,'y':y,'l':0,'i':['0_test']}]}}
  report={'CrimeNumberRecords':1,'CrimeIncidents':[{'Agency':'St Louis Police','Type':'/Identify/3.svg','MapIt':"CrimeMap.ReportMapIt('0_test')",'IncidentNum':'123','Date':20261108103000,'Description':'BURGLARY','Location':'4500 TEST'}]}
  with patch.object(self.city,'post',side_effect=[pins,report]):rows=self.city.fetch_window(datetime.date(2026,11,8),datetime.date(2026,11,8));self.assertAlmostEqual(rows[0]['longitude'],-90.2);self.assertAlmostEqual(rows[0]['latitude'],38.6)
  with patch.object(self.city,'post',side_effect=[pins,{'CrimeNumberRecords':2,'CrimeIncidents':[]}]):self.assertRaises(RuntimeError,self.city.fetch_window,datetime.date(2026,11,8),datetime.date(2026,11,8))
 def test_known_press_release_case_alias_preserves_original_link_and_outcomes(self):
  structured={'properties':{'id':'incident:city-case:123','incidentAt':'2026-11-08','incidentKind':'homicide','incidentTypes':['homicide'],'sourceId':'city-crimemapping','offenses':['Murder'],'sourceCheckedAt':'now','reportNumber':'123'}}
  release={'properties':{'id':'incident:original-shortlink','alternateIds':['incident:city-case:123'],'incidentAt':'2026-11-08','incidentKind':'shooting','incidentTypes':['shooting'],'sourceId':'city-releases','deaths':1,'sourceCheckedAt':'now'}}
  result=m.merge_features([structured],[release]);self.assertEqual(len(result),1);self.assertEqual(result[0]['properties']['id'],'incident:original-shortlink');self.assertEqual(result[0]['properties']['deaths'],1);self.assertEqual(result[0]['properties']['reportNumber'],'123');self.assertEqual(result[0]['properties']['incidentTypes'],['homicide','shooting'])
if __name__=='__main__':unittest.main()
