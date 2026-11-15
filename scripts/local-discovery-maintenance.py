#!/usr/bin/env python3
"""Check reviewed venue evidence without treating a successful HTTP fetch as a fact update.

Default is read-only. --refresh-unchanged renews only an exact previously reviewed
text fingerprint with all required identity tokens. --approve-reviewed ID records a
human/agent review after that operator's source has actually been inspected.
Opening dates and hours are never inferred, advanced or auto-rewritten.
"""
import argparse, concurrent.futures, datetime as dt, hashlib, html, json, re, unicodedata, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def normalize(value):
    value=re.sub(r'<!--.*?-->|<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>',' ',value,flags=re.I|re.S)
    value=html.unescape(re.sub(r'<[^>]+>',' ',value))
    return re.sub(r'\s+',' ',unicodedata.normalize('NFKC',value).casefold()).strip()

def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'Andymap/1.0 source review (https://www.andrewhanes.com)','Accept':'text/html'})
    try:
        with urllib.request.urlopen(request,timeout=20) as response:
            value=normalize(response.read(3_000_000).decode('utf-8',errors='replace'))
        if len(value)<100:return {'error':'No readable source text'}
        return {'text':value,'sha256':hashlib.sha256(value.encode()).hexdigest()}
    except Exception as e:return {'error':str(e)}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file',default=str(ROOT/'local-discovery.json'))
    parser.add_argument('--report',default='/tmp/andymap-local-source-report.json')
    parser.add_argument('--refresh-unchanged',action='store_true')
    parser.add_argument('--approve-reviewed',action='append',default=[],metavar='FEATURE_ID')
    args=parser.parse_args();path=Path(args.file);data=json.loads(path.read_text())
    fs=[f for layer in data['layers'].values() for f in layer['features']]
    if args.approve_reviewed and not args.refresh_unchanged:
        fs=[f for f in fs if f['id'] in args.approve_reviewed]
    urls={check['url'] for f in fs for check in f['properties'].get('evidenceChecks',[])}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:pages=dict(zip(urls,pool.map(fetch,urls)))
    now=dt.datetime.now(dt.timezone.utc);checked=now.isoformat().replace('+00:00','Z');report=[];changed=False
    for f in fs:
        p=f['properties'];checks=p.get('evidenceChecks',[]);approved=f['id'] in args.approve_reviewed
        outcomes=[]
        for c in checks:
            page=pages[c['url']];missing=[s for s in c['allOf'] if normalize(s) not in page.get('text','')]
            status='fetch-failed' if page.get('error') else 'identity-changed' if missing else 'unchanged' if c.get('sha256')==page['sha256'] else 'review-required'
            outcomes.append({'url':c['url'],'status':status,'missing':missing,'error':page.get('error')})
        ready=bool(checks) and all(x['status']=='unchanged' for x in outcomes)
        may_approve=bool(checks) and all(x['status'] in ('unchanged','review-required') for x in outcomes)
        renewed=(args.refresh_unchanged and ready) or (approved and may_approve)
        if renewed:
            for c in checks:c['sha256']=pages[c['url']]['sha256']
            p['sourceCheckedAt']=p['checkedAt']=checked
            p['expiresAt']=(now+dt.timedelta(days=7 if p['layer']=='businesses' else 30)).isoformat().replace('+00:00','Z')
            # Hours retain their independent expiry: identity verification is not an hours review.
            changed=True
        report.append({'id':f['id'],'title':p['title'],'renewed':renewed,'checks':outcomes,'manualReviewRequired':not renewed and (not checks or any(x['status']!='unchanged' for x in outcomes))})
    if changed:
        data['checkedAt']=checked
        path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
    result={'checkedAt':checked,'features':report,'unreviewedOpeningCandidatesSource':'https://www.stlmag.com/dining/st-louis-restaurant-openings-closings-coming-soon/','policy':'A retrieved page is not proof of unchanged facts. Review changed source text and dated opening evidence before approval. No future opening is promoted automatically.'}
    Path(args.report).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'reviewedEntries':len(report),'renewed':sum(x['renewed'] for x in report),'needsReview':sum(x['manualReviewRequired'] for x in report),'report':args.report}))
if __name__=='__main__':main()
