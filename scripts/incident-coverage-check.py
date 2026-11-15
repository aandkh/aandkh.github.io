#!/usr/bin/env python3
"""Check BOTH City and County sources without treating missing reports as zero crime."""
import datetime as dt,importlib.util,json,pathlib,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('incident_refresh',pathlib.Path(__file__).with_name('incident-refresh.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def main():
 metadata=json.loads((m.ROOT/'recent-incidents.json').read_text());features=[]
 for path in (m.ROOT/'incident-archive').glob('????-??.json'):features+=json.loads(path.read_text())['features']
 report=m.coverage_audit(m.merge_features([],features),metadata.get('sources',[]),dt.datetime.now(dt.timezone.utc))
 for region,counts in report['byJurisdiction'].items():print(region+': '+str(counts['pastWeek'])+' past-week reports; '+str(counts['past30Days'])+' past-30-day reports; '+str(counts['archive'])+' archived')
 for warning in report['warnings']:print(warning['code']+': '+warning['message'])
 errors=[w for w in report['warnings'] if w['code'] in ['missing-source','source-failed','source-lag']]
 if any(not row['archive'] for row in report['byJurisdiction'].values()):errors.append({'code':'missing-region'})
 if errors:raise SystemExit(1)
 print('Combined source presence checked; reporting-lag warnings above still require daily review.')
if __name__=='__main__':main()
