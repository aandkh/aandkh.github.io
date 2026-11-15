const DAY=86400000,STANDARD_OFFSET=6*3600000;
const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const timestamp=value=>value instanceof Date?value.valueOf():typeof value==='string'?Date.parse(value):value;
const shiftDay=(day,count)=>new Date(Date.parse(day+'T12:00:00Z')+count*DAY).toISOString().slice(0,10);
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().startsWith(day);
const dayText=day=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(day+'T12:00:00Z'));
const inches=value=>value.toFixed(2)+' in';
export function rainClimateDay(now=Date.now()){
 const at=timestamp(now);return Number.isFinite(at)?new Date(at-STANDARD_OFFSET).toISOString().slice(0,10):null;
}
export function rainBudgetData(snapshot,{now=Date.now()}={}){
 const at=timestamp(now),today=rainClimateDay(at);if(!today||snapshot?.schema!==1)return null;
 const checked=Date.parse(snapshot.checkedAt),expires=Date.parse(snapshot.expiresAt),end=shiftDay(today,-1);
 const stale=!Number.isFinite(checked)||!Number.isFinite(expires)||checked>at+300000||at>=expires||at-checked>48*3600000;
 const byDay=new Map();
 for(const row of snapshot.records||[]){if(!validDay(row?.day)||row.day>end)continue;const prior=byDay.get(row.day);if(!prior||String(row.product||'')>=String(prior.product||''))byDay.set(row.day,{...row,precipIn:finite(row.precipIn)?row.precipIn:null,normalIn:finite(row.normalIn)?row.normalIn:null,trace:row.trace===true});}
 function period(days){
  const start=shiftDay(end,1-days),rows=Array.from({length:days},(_,i)=>byDay.get(shiftDay(start,i))||{day:shiftDay(start,i),precipIn:null,normalIn:null,trace:false});
  const measured=rows.filter(r=>r.precipIn!==null),normals=rows.filter(r=>r.normalIn!==null),complete=measured.length===days;
  const observedIn=measured.length?measured.reduce((n,r)=>n+r.precipIn,0):null;
  const normalIn=normals.length===days?normals.reduce((n,r)=>n+r.normalIn,0):null;
  return{days,start,end,rows,observedIn,normalIn,complete,missingDays:days-measured.length,traceDays:measured.filter(r=>r.trace).length,departureIn:complete&&normalIn!==null?observedIn-normalIn:null,percentOfNormal:complete&&normalIn>0?observedIn/normalIn*100:null};
 }
 let dryDays=0,exact=false,endedBy='history',lastWetDay=null;
 for(let index=0;index<400;index++){const key=shiftDay(end,-index),row=byDay.get(key);if(!row||row.precipIn===null){endedBy='missing';break;}if(row.precipIn>=.01){exact=true;endedBy='wet';lastWetDay=key;break;}dryDays++;}
 if(!byDay.has(end)||byDay.get(end).precipIn===null)dryDays=null;
 const seven=period(7),thirty=period(30),latestDay=[...byDay.values()].filter(r=>r.precipIn!==null).map(r=>r.day).sort().at(-1)||null;
 return{end,stale,seven,thirty,latestDay,drySpell:{days:dryDays,exact,endedBy,lastWetDay},station:snapshot.station,normalPeriod:snapshot.normalPeriod,source:snapshot.source,checkedAt:snapshot.checkedAt};
}
let cached=null,pending=null,loadedAt=0;
async function loadSnapshot(){
 if(cached&&Date.now()-loadedAt<15*60000)return cached;
 if(pending)return pending;
 pending=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8000);try{const response=await fetch(new URL('./rain-budget.json',import.meta.url),{cache:'no-cache',signal:controller.signal});if(!response.ok)throw new Error('Rain history unavailable');const data=await response.json();if(data.schema!==1)throw new Error('Unsupported rain history');cached=data;loadedAt=Date.now();return data;}finally{clearTimeout(timeout);}})();
 try{return await pending;}finally{pending=null;}
}
function distanceMiles(a,b,c,d){const rad=Math.PI/180,p=(c-a)*rad,q=(d-b)*rad,x=Math.sin(p/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(q/2)**2;return 3958.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
function render(card,snapshot,options){
 const model=rainBudgetData(snapshot,options),doc=card.ownerDocument,node=(tag,text='',cls='')=>{const el=doc.createElement(tag);el.className=cls;el.textContent=text;return el;};
 card.replaceChildren();card.append(node('h4','Rain budget'));
 if(!model){card.append(node('p','Rain history is unavailable right now.','rain-budget-note'));return;}
 const station=model.station||{},distance=Number.isFinite(options.lat)&&Number.isFinite(options.lng)&&Number.isFinite(station.lat)&&Number.isFinite(station.lng)?distanceMiles(options.lat,options.lng,station.lat,station.lng):null;
 card.append(node('p',`${station.name||'St. Louis regional gauge'} · regional gauge${distance!==null?' · '+Math.round(distance)+' mi from this map location':''}`,'rain-budget-note'));
 if(model.stale){card.append(node('p','Rain history is awaiting its daily refresh. Current totals are unavailable.','rain-budget-status'));if(model.latestDay)card.append(node('p','Last measured day: '+dayText(model.latestDay)+'.','rain-budget-note'));appendSources();return;}
 card.append(node('p','Through '+dayText(model.end)+' · completed climate days','rain-budget-through'));
 const metrics=node('div','','rain-budget-metrics');
 for(const period of [model.seven,model.thirty]){
  const metric=node('div','','rain-budget-metric');metric.append(node('span',period.days+' days','rain-budget-label'));
  metric.append(node('strong',period.observedIn===null?'Unavailable':inches(period.observedIn)+(period.complete?'':'*'),period.observedIn===null?'rain-budget-empty':''));
  let detail=period.missingDays?`${period.days-period.missingDays}/${period.days} days reported · partial total`:period.normalIn===null?'Normal unavailable':Math.abs(period.departureIn)<.005?'Matches normal':`${inches(Math.abs(period.departureIn))} ${period.departureIn<0?'below':'above'} normal`;
  metric.append(node('span',detail,'rain-budget-comparison'));if(period.traceDays)metric.append(node('span',`+ trace on ${period.traceDays} day${period.traceDays===1?'':'s'}`,'rain-budget-trace'));
  metrics.append(metric);
 }
 const dry=model.drySpell,spell=node('div','','rain-budget-metric');spell.append(node('span','Dry spell','rain-budget-label'),node('strong',dry.days===null?'Unavailable':(dry.exact?'':'≥ ')+dry.days+' day'+(dry.days===1?'':'s'),dry.days===null?'rain-budget-empty':''),node('span',dry.days===null?'Latest day not reported':dry.lastWetDay?'Last measurable: '+dayText(dry.lastWetDay):'Earlier history incomplete','rain-budget-comparison'));metrics.append(spell);card.append(metrics);
 const details=node('details','','rain-budget-details');details.append(node('summary','Daily rain & how this is calculated'));
 const chart=node('div','','rain-budget-chart');chart.setAttribute('role','img');chart.setAttribute('aria-label','Measured daily precipitation for the last 30 completed climate days. Exact values follow in the daily list.');const max=Math.max(.1,...model.thirty.rows.map(r=>r.precipIn||0));
 for(const row of model.thirty.rows){const bar=node('span','','rain-budget-bar');bar.dataset.state=row.precipIn===null?'missing':row.trace?'trace':row.precipIn===0?'zero':'rain';bar.style.setProperty('--rain-height',((row.precipIn||0)/max*100)+'%');bar.title=dayText(row.day)+': '+(row.precipIn===null?'Missing':row.trace?'Trace':inches(row.precipIn));chart.append(bar);}details.append(chart);
 const ticks=node('div','','rain-budget-axis');ticks.append(node('span',dayText(model.thirty.start)),node('span',dayText(model.end)));details.append(ticks,node('p','Blue bars: measured rain · yellow: trace · stripes: missing.'));
 const table=node('table','','rain-budget-table'),caption=node('caption','Daily precipitation · inches'),head=node('thead'),headRow=node('tr');for(const label of ['Day','Measured','Normal']){const th=node('th',label);th.scope='col';headRow.append(th);}head.append(headRow);table.append(caption,head);const body=node('tbody');for(const row of [...model.thirty.rows].reverse()){const tr=node('tr');tr.append(node('td',dayText(row.day)),node('td',row.precipIn===null?'Missing':row.trace?'Trace':row.precipIn.toFixed(2)),node('td',row.normalIn===null?'Unavailable':row.normalIn.toFixed(2)));body.append(tr);}table.append(body);const scroll=node('div','','rain-budget-table-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label','Daily precipitation values, newest first');scroll.append(table);details.append(scroll);
 details.append(node('p',`Measured liquid-equivalent precipitation, including melted snow. This is one airport gauge, not a modeled average of St. Louis City and County; a storm can bring different amounts elsewhere. Preliminary NWS reports can be revised.`),node('p',`Normal means the ${model.normalPeriod||'source-reported'} average for the same calendar dates at this station. A departure is shown only when every measured day and daily normal is present. It is not a drought or soil-moisture rating.`),node('p','Dry spell = consecutive completed days with less than 0.01 in of measurable precipitation. Traces count as dry for this threshold, but are identified separately. A gap stops the count; ≥ means the earlier endpoint is unknown.'),node('p','Climate days run midnight to midnight CST (UTC−06), or 1 AM to 1 AM CDT. Today’s unfinished day is excluded. Missing values are never treated as zero.'));card.append(details);appendSources();
 function appendSources(){const footer=node('p','','rain-budget-source');const anchor=node('a','NWS daily climate report ↗');anchor.href=typeof model.source?.latestReportUrl==='string'&&model.source.latestReportUrl.startsWith('https://mesonet.agron.iastate.edu/')?model.source.latestReportUrl:'https://www.weather.gov/wrh/climate?tab=cliplot&wfo=lsx';anchor.target='_blank';anchor.rel='noopener noreferrer';footer.append(anchor);const checked=Date.parse(model.checkedAt);if(Number.isFinite(checked))footer.append(node('span',' · checked '+new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(new Date(checked))));card.append(footer);}
}
/** Append a compact, nonblocking card; optional snapshot is for tests/offline use. */
export function appendRainBudget(host,{lat,lng,now=Date.now(),snapshot}={}){
 if(!host?.ownerDocument)return null;
 const card=host.ownerDocument.createElement('section');card.className='rain-budget';card.setAttribute('aria-label','Recent rain and seasonal normal');card.textContent='Loading rain history…';host.append(card);
 const options={lat,lng,now};if(snapshot){render(card,snapshot,options);return card;}
 loadSnapshot().then(data=>render(card,data,options)).catch(()=>{card.textContent='Rain history is temporarily unavailable.';});return card;
}
