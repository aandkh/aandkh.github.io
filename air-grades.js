// Andymap's optional finer ladder. EPA's six AQI categories remain authoritative.
// Boundaries inside an EPA category are display subdivisions, not new health thresholds.
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const CATEGORIES=[null,
 {name:'Good',min:0,max:50,meaning:'The selected pollutant is in EPA’s Good range. Lower numbers indicate less of that pollutant; even the best grade does not mean pollutant-free air.',windows:'This pollutant alone favors airing out. First check other pollutants, weather, pollen and nearby smoke, and whether outdoor air is cleaner than indoors.',activity:'For this pollutant, AirNow’s Good guidance supports usual outdoor activity; other pollutants and conditions can change that decision.',example:'A walk, bike ride or park workout fits this pollutant’s category guidance, subject to other conditions.'},
 {name:'Moderate',min:51,max:100,meaning:'Air quality is acceptable for most people, while unusually sensitive people may be affected. All five Andymap grades in this band share that official guidance.',windows:'Consider your sensitivity and other conditions before opening. This reading does not establish whether outdoor air is cleaner than the air indoors.',activity:'Most people can continue usual activities. If unusually sensitive, shorten strenuous sessions and pay attention to how you feel.',example:'A short errand and a long, hard run involve different time and breathing effort; this grade does not calculate either person’s dose.'},
 {name:'Unhealthy for Sensitive Groups',min:101,max:150,meaning:'Sensitive groups face greater concern. The general public is less likely to be affected, but this is no longer EPA’s Good or Moderate range.',windows:'Favor a cooler, cleaner indoor space over prolonged airing-out while outdoor pollution is elevated.',activity:'Sensitive people should choose shorter, gentler outdoor activity and more breaks. For ozone, everyone else should also consider reducing duration and intensity.',example:'Swap a long, hard workout for a shorter, easier outing, or move it to a time with better air.'},
 {name:'Unhealthy',min:151,max:200,meaning:'Health effects can occur in the general population, with more serious concern for sensitive groups. A D and a D− have the same official Unhealthy guidance.',windows:'Keep polluted outdoor air out when you can remain comfortably cool inside. An overheated closed room is not a safe substitute.',activity:'Everyone should reduce prolonged or intense outdoor activity. Sensitive groups should avoid it and consider moving indoors or rescheduling.',example:'Move a hard run or extended outdoor practice to a cleaner indoor setting or a better-air time.'},
 {name:'Very Unhealthy',min:201,max:300,meaning:'EPA’s health-alert category: pollution poses increased risk across the population. F and F− are subdivisions of that same category.',windows:'Use a cooler, cleaner indoor space. For particles, appropriate indoor filtration can help; an ordinary particle filter does not remove ozone gas.',activity:'Sensitive groups should avoid outdoor physical activity. Everyone else should avoid long or strenuous outdoor activity.',example:'An indoor activity is preferable to an outdoor training session while this category persists.'},
 {name:'Hazardous',min:301,max:Infinity,meaning:'HELL is Andymap’s informal label for EPA’s Hazardous category, beginning at AQI 301. It is not a prediction of death or a newly invented emergency threshold.',windows:'Seek a cooler space with cleaner indoor air, limit polluted outdoor air entering, and follow official local instructions.',activity:'Everyone should avoid outdoor physical activity. People at greater risk should remain indoors with low activity levels and cleaner air.',example:'Postpone recreational outdoor exercise. Follow official public-health and emergency guidance rather than treating this as a fitness challenge.'}
];

// Worst → best, as presented in the full guide. Every integer AQI belongs to one tier.
export const AIR_GRADES=Object.freeze([
 {grade:'HELL',min:301,max:Infinity,category:6,title:'Hazardous conditions',detail:'This is the only grade used for the entire Hazardous band. Its dramatic name does not add a separate scientific claim: the official category and official instructions are what matter.'},
 {grade:'F-',min:251,max:300,category:5,title:'Upper Very Unhealthy band',detail:'The upper half of the Very Unhealthy interval. A number near 300 is close to the Hazardous boundary; the risk does not suddenly switch on at a single point.'},
 {grade:'F',min:201,max:250,category:5,title:'Very Unhealthy',detail:'The lower half of Very Unhealthy is already a health-alert category. Being a better letter than F− does not make it an acceptable outdoor-workout target.'},
 {grade:'D-',min:176,max:200,category:4,title:'Upper Unhealthy band',detail:'Higher within the Unhealthy interval. It is useful for comparing readings within that band, while the official activity guidance remains the same as D.'},
 {grade:'D',min:151,max:175,category:4,title:'Unhealthy',detail:'The first Andymap grade within the official Unhealthy interval. This boundary is about broader public-health concern, not whether someone can smell or see the pollution.'},
 {grade:'D+',min:131,max:150,category:3,title:'Upper sensitive-group band',detail:'The upper part of Unhealthy for Sensitive Groups. Treat the plus sign as a position in this ladder, not permission to ignore symptoms or a personal action plan.'},
 {grade:'C-',min:116,max:130,category:3,title:'Middle sensitive-group band',detail:'The middle part of Unhealthy for Sensitive Groups. This finer label adds comparison detail only; it does not identify which individual will have symptoms.'},
 {grade:'C',min:101,max:115,category:3,title:'Sensitive-group caution begins',detail:'The first part of Unhealthy for Sensitive Groups. The change from C+ to C crosses an official category boundary, unlike the smaller steps within a category.'},
 {grade:'C+',min:91,max:100,category:2,title:'Upper Moderate band',detail:'Still Moderate, at the upper end of that interval. Compare the latest reading before a long outing; the grade itself cannot predict the next hour.'},
 {grade:'B-',min:81,max:90,category:2,title:'Higher Moderate reading',detail:'A higher reading within Moderate. It is less favorable on this pollutant scale than B, but there is no separate EPA health category at the B/B− boundary.'},
 {grade:'B',min:71,max:80,category:2,title:'Middle Moderate reading',detail:'The middle of the Moderate band. This is a comparison label, not a passing health grade or an assurance that every person will feel comfortable.'},
 {grade:'B+',min:61,max:70,category:2,title:'Lower Moderate reading',detail:'Toward the lower part of Moderate. It compares favorably with higher numbers for this same pollutant, yet remains outside the official Good band.'},
 {grade:'A-',min:51,max:60,category:2,title:'Just above Good',detail:'The lowest part of Moderate. The attractive letter does not change the yellow-category advice for people unusually sensitive to the selected pollutant.'},
 {grade:'A',min:31,max:50,category:1,title:'Good air-quality band',detail:'The upper portion of EPA’s Good interval. An A is already Good; there is no official requirement to wait for an S before ordinary outdoor activity.'},
 {grade:'A+',min:16,max:30,category:1,title:'Lower Good reading',detail:'A lower reported AQI within Good. Compare only like-for-like pollutants and time frames; a lower PM2.5 number does not establish that ozone or pollen is also low.'},
 {grade:'S',min:6,max:15,category:1,title:'Very low reported AQI',detail:'Near the low end of the index for the selected pollutant. This is an Andymap distinction inside Good, not a separate EPA category or a measure of how “fresh” air feels.'},
 {grade:'S+',min:0,max:5,category:1,title:'Lowest slice of this scale',detail:'The best tier in this ladder requires a reported AQI of 0–5. It means a very low index for the selected pollutant, not the best possible air everywhere, zero pollution or zero health risk.'}
].map(tier=>Object.freeze(tier)));

export function airPollutant(p={}){
 p=p||{};
 const text=[p.pollutant,p.parameter].filter(Boolean).join(' ')||[p.title,p.id].filter(Boolean).join(' ');
 if(/pm\s*2\.?5/i.test(text))return'PM2.5';
 if(/\bozone\b|\bo3\b/i.test(text))return'Ozone';
 if(/pm\s*10/i.test(text))return'PM10';
 return'Selected pollutant';
}
const bandLabel=({min,max})=>max===Infinity?min+'+':min+'–'+max;
const categoryFor=aqi=>CATEGORIES.findIndex(c=>c&&aqi>=c.min&&aqi<=c.max);
function sensitivity(pollutant){
 if(pollutant==='Ozone')return'Ozone-sensitive groups include people with asthma or other lung disease, older adults, children and teenagers, and people active outdoors. Particle filters do not remove ozone.';
 if(pollutant==='PM2.5'||pollutant==='PM10')return'Particle-sensitive groups include people with heart or lung disease, older adults, children and teenagers, pregnant people, and people with substantial outdoor exposure. A personal care plan may call for extra caution.';
 return'Sensitivity depends on the pollutant. Check its official guidance and any personal care plan; this score does not know your health history.';
}
export function airAdvice(p={}){
 p=p||{};
 const pollutant=airPollutant(p),reported=finite(p.aqi)&&p.aqi>=0?Math.round(p.aqi):null,sourceCategory=typeof p.category==='number'?p.category:typeof p.category==='string'&&/^[1-6]$/.test(p.category.trim())?Number(p.category.trim()):NaN;
 const hasCategory=Number.isInteger(sourceCategory)&&sourceCategory>=1&&sourceCategory<=6;
 const category=reported!==null?categoryFor(reported):hasCategory?sourceCategory:null;
 if(!category)return{grade:'Unknown',precision:'unknown',pollutant,text:'No usable air-quality reading here.',meaning:'Unshaded areas and missing readings are not a clean-air guarantee.',tip:'Check current official air information before using this score to decide about windows.',grades:[]};
 const conflict=reported!==null&&hasCategory&&sourceCategory!==category;
 // Neither conflicting field is enough to support window/activity advice.
 if(conflict)return{grade:'Unknown',precision:'unknown',pollutant,text:pollutant+' · inconsistent source fields',meaning:'The source’s AQI and category disagree. No grade is assigned until those values can be reconciled.',precisionNote:'The source’s AQI and category disagree; check the official reading.',tip:'This inconsistent record cannot support a window recommendation. Check current official air information.',grades:[]};
 const cat=category,info=CATEGORIES[cat],grades=AIR_GRADES.filter(t=>t.category===cat),exact=reported!==null?tierForAQI(reported):null;
 return{grade:exact?.grade||(grades.length===1?grades[0].grade:grades[0].grade+'–'+grades.at(-1).grade),precision:exact?'value':'band',aqi:exact?reported:null,category:cat,pollutant,official:info.name,band:bandLabel(info),grades,
  text:pollutant+' · AQI '+(exact?reported:bandLabel(info))+' · '+info.name+(reported>500?' · beyond the AQI scale':''),
  meaning:exact?exact.detail:info.meaning,tip:info.windows,activity:info.activity,example:info.example,sensitive:sensitivity(pollutant),
  precisionNote:exact?'Andymap subgrade from the supplied numeric AQI; it does not add measurement precision.':grades.length===1?'The reported Hazardous band maps to one Andymap grade; no exact AQI is supplied.':'The regional feed supplies a category, not an exact AQI. Any of these grades could apply; no midpoint is guessed.'};
}
export function tierForAQI(aqi){return finite(aqi)&&aqi>=0?AIR_GRADES.find(t=>Math.round(aqi)>=t.min&&Math.round(aqi)<=t.max)||null:null;}
const safeUrl=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};

// Optional future source contract. Never reverse-calculate concentration from
// an AQI contour/NowCast. A sourced, measured 24-hour mean must be supplied.
export function pm25Comparison(p={},now=Date.now()){
 p=p||{};
 const m=p.pm25DailyMean,start=Date.parse(m?.periodStart),end=Date.parse(m?.periodEnd),sourceUrl=safeUrl(m?.sourceUrl);
 if(!finite(now)||airPollutant(p)!=='PM2.5'||!m||m.measurementType!=='measured'||!['µg/m³','ug/m3'].includes(m.unit)||!finite(m.value)||m.value<0||!sourceUrl||!Number.isFinite(start)||!Number.isFinite(end)||end-start!==86400000||end>now+300000||now-end>48*3600000)return null;
 return{concentration:m.value,equivalent:m.value/22,periodStart:m.periodStart,periodEnd:m.periodEnd,sourceUrl};
}

const node=(doc,tag,text,cls='')=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
const comparisonNumber=value=>value>0&&value<.1?'<0.1':value.toFixed(1);
function link(doc,text,url){const a=node(doc,'a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function paragraph(doc,label,text){const p=node(doc,'p');p.append(node(doc,'strong',label+' '),doc.createTextNode(text));return p;}
function disclosure(doc,title){const d=node(doc,'details',undefined,'air-grade-disclosure');d.append(node(doc,'summary',title));return d;}
export function appendAirAdvice(host,p={}){
 p=p||{};
 const doc=host.ownerDocument||document,a=airAdvice(p),box=node(doc,'section',undefined,'insight-card air-advice');
 const heading=node(doc,'div',undefined,'air-grade-heading');heading.append(node(doc,'strong','Open The Windows Score'),node(doc,'span',a.grade,'air-grade-value'));box.append(heading,node(doc,'p',a.text,'air-grade-reading'));
 if(a.category){const official=node(doc,'span','EPA · '+a.official,'air-official-band');official.dataset.category=String(a.category);box.append(official);}
 box.append(node(doc,'p',a.precisionNote||a.meaning,'air-grade-precision'),paragraph(doc,'Windows:',a.tip));
 if(a.category){
  const personal=disclosure(doc,'What this means for you');personal.append(node(doc,'p',a.meaning),paragraph(doc,'Outdoor plans:',a.activity),paragraph(doc,'For example:',a.example),paragraph(doc,'Who needs extra care:',a.sensitive));box.append(personal);
 }
 const guide=disclosure(doc,'All 17 grades · worst to best');guide.append(node(doc,'p','These are Andymap’s comparison tiers. Only the six named EPA categories have official health meanings; subdivisions within one category share the same guidance. A change within a category is not a new medical threshold.'));
 let guideBuilt=false;guide.ontoggle=()=>{if(!guide.open||guideBuilt)return;guideBuilt=true;for(const t of AIR_GRADES){
  const item=disclosure(doc,t.grade+' · AQI '+bandLabel(t)+' · '+t.title);item.classList.add('air-tier');item.dataset.grade=t.grade;
  if(a.precision==='value'?a.grade===t.grade:a.grades.some(g=>g.grade===t.grade)){item.classList.add('air-tier-current');item.append(node(doc,'p',a.precision==='value'?'Matches the supplied AQI.':'Within the currently reported category.','air-tier-match'));}
  const info=CATEGORIES[t.category];item.append(node(doc,'p','Official category: '+info.name+'. '+t.detail),paragraph(doc,'Windows:',info.windows),paragraph(doc,'Activity:',info.activity),paragraph(doc,'Everyday example:',info.example));guide.append(item);
 }};
 box.append(guide);
 const comparisons=disclosure(doc,'Cigarettes, Burning Man & everyday exposure'),comparison=pm25Comparison(p);
 comparisons.append(node(doc,'p','Cigarettes: Berkeley Earth’s 2015 rough comparison puts a full day at a PM2.5 concentration of 22 µg/m³ at about one cigarette-equivalent of population-level health impact. It is a communication benchmark from population mortality estimates, not the same chemicals, inhaled dose, or a prediction of one person’s harm from one day.'));
 if(comparison){const period=new Date(comparison.periodEnd).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});comparisons.append(node(doc,'p',`Supplied measured 24-hour PM2.5 mean: ${comparisonNumber(comparison.concentration)} µg/m³, ending ${period} Central. Dividing by 22 gives approximately ${comparisonNumber(comparison.equivalent)} cigarette-equivalents on that rough scale, assuming full-day exposure at that concentration. This is not your personal exposure.`),link(doc,'24-hour measurement source ↗',comparison.sourceUrl));}
 else comparisons.append(node(doc,'p','No local cigarette-equivalent is calculated: this record does not supply a verified measured 24-hour PM2.5 mean. An AQI band, a current NowCast, and ozone cannot stand in for that exposure.'));
 comparisons.append(link(doc,'Berkeley Earth’s method and limitations ↗','https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/'),node(doc,'p','Burning Man is not a fixed pollution level. Its organizers describe variable alkaline playa dust; a dusty festival, a wildfire and traffic pollution are different exposures. Without matching pollutant measurements and duration, “like a day at Burning Man” would be an invented equivalence.'),link(doc,'Burning Man’s playa-weather guidance ↗','https://burningman.org/black-rock-city/preparation/playa-living/weather/'),node(doc,'p','Everyday activities: time and breathing effort matter. Waiting outside briefly and exercising hard for hours are not interchangeable exposures. This map does not track your breathing, indoor air, route or time outside, so it does not calculate a personal dose.'));box.append(comparisons);
 const method=disclosure(doc,'Sources, scope & window guidance');method.append(node(doc,'p','This is a pollution-only score for the selected pollutant, not a complete ventilation recommendation. A low PM2.5 grade does not establish low ozone, and vice versa. Regional contours estimate conditions between monitors; they are not measurements at your window.'),node(doc,'p','Indoor air, pollen, nearby exhaust or smoke, outdoor temperature and humidity are not included. Ventilation can remove indoor pollutants when outdoor air is suitable. During high outdoor pollution, prefer a cooler, cleaner indoor space; never let a closed room become dangerously hot.'),node(doc,'p','Source observations and official alerts take precedence over these custom labels. The map retains official AQI category colors. Guidance reviewed November 15, 2026.'),link(doc,'EPA / AirNow AQI categories ↗','https://www.airnow.gov/aqi/aqi-basics/'),link(doc,'Particle-pollution activity guide ↗','https://document.airnow.gov/air-quality-guide-for-particle-pollution.pdf'),link(doc,'Ozone activity guide ↗','https://document.airnow.gov/air-quality-guide-for-ozone.pdf'),link(doc,'EPA ventilation guidance ↗','https://www.epa.gov/indoor-air-quality-iaq/improving-indoor-air-quality'),link(doc,'EPA smoke and heat guidance ↗','https://www.epa.gov/wildfires/frequent-questions-about-wildland-fire-smoke-individuals'));box.append(method);
 const credit=node(doc,'p',undefined,'small provider-credit');credit.append(link(doc,'EPA AirNow','https://www.airnow.gov/'),doc.createTextNode(' & '),link(doc,'reporting agencies','https://www.airnow.gov/partners/'),doc.createTextNode(' · preliminary data'));
 const at=Date.parse(p.observedAt);if(Number.isFinite(at))credit.append(doc.createTextNode(' · '+new Date(at).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' Central'));
 box.append(credit);host.append(box);
}
