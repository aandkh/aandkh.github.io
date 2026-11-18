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
 if(/\bno2\b|nitrogen dioxide/i.test(text))return'NO₂';
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
 const estimated=p.airMonitorEstimate&&finite(p.estimatedAqi)?Math.round(p.estimatedAqi):null;
 const hasCategory=Number.isInteger(sourceCategory)&&sourceCategory>=1&&sourceCategory<=6;
 const category=reported!==null?categoryFor(reported):estimated!==null?categoryFor(estimated):hasCategory?sourceCategory:null;
 if(!category)return{grade:'Unknown',precision:'unknown',pollutant,text:'No usable air-quality reading here.',meaning:'Unshaded areas and missing readings are not a clean-air guarantee.',tip:'Check current official air information before using this score to decide about windows.',grades:[]};
 const conflict=reported!==null&&hasCategory&&sourceCategory!==category;
 // Neither conflicting field is enough to support window/activity advice.
 if(conflict)return{grade:'Unknown',precision:'unknown',pollutant,text:pollutant+' · inconsistent source fields',meaning:'The source’s AQI and category disagree. No grade is assigned until those values can be reconciled.',precisionNote:'The source’s AQI and category disagree; check the official reading.',tip:'This inconsistent record cannot support a window recommendation. Check current official air information.',grades:[]};
 const cat=category,info=CATEGORIES[cat],grades=AIR_GRADES.filter(t=>t.category===cat),exact=reported!==null?tierForAQI(reported):null;
 // Category midpoint is a display estimate, never an invented numeric observation.
 const representative=exact||(estimated!==null?tierForAQI(estimated):null)||tierForAQI(Number.isFinite(info.max)?Math.floor((info.min+info.max)/2):info.min);
 return{grade:representative.grade,precision:exact?'value':'band',aqi:exact?reported:null,category:cat,pollutant,official:info.name,band:bandLabel(info),grades,
  text:pollutant+' · AQI '+(exact?reported:estimated!==null?'about '+estimated+' (estimated)':bandLabel(info))+' · '+info.name+(reported>500?' · beyond the AQI scale':''),
  meaning:exact?exact.detail:info.meaning,tip:info.windows,activity:info.activity,example:info.example,sensitive:sensitivity(pollutant),
  precisionNote:p.airMonitorEstimate?'Estimated category from same-hour monitor interpolation. This is not a measurement at your location.':exact?'Andymap grade from the supplied numeric AQI.':cat===6?'Estimated from the reported Hazardous category; no numeric AQI was supplied.':'Estimated from the midpoint of the reported '+info.name+' range (AQI '+bandLabel(info)+'). No numeric AQI was supplied.'};
}
export function tierForAQI(aqi){return finite(aqi)&&aqi>=0?AIR_GRADES.find(t=>Math.round(aqi)>=t.min&&Math.round(aqi)<=t.max)||null:null;}
const node=(doc,tag,text,cls='')=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;n.className=cls;return n;};
function link(doc,text,url){const a=node(doc,'a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
const WINDOW_SUMMARIES={
 1:'This pollutant looks favorable for airing out. Check pollen, nearby smoke and outdoor comfort.',
 2:'Consider your sensitivity before opening. Check other pollutants and outdoor comfort.',
 3:'Limit airing out if sensitive to this pollutant; prefer cleaner indoor air.',
 4:'Keep windows closed if indoor air is cleaner and comfortably cool.',
 5:'Keep windows closed; use a cool, cleaner indoor space.',
 6:'Keep polluted air out and follow local alerts. Stay in a cool, cleaner space.'
};
export function appendAirAdvice(host,p={}){
 p=p||{};
 const doc=host.ownerDocument||document,a=airAdvice(p),box=node(doc,'section',undefined,'insight-card air-advice');
 const heading=node(doc,'div',undefined,'air-grade-heading');heading.dataset.precision=a.precision;
 const result=node(doc,'span',undefined,'air-grade-result');result.append(node(doc,'span',a.grade,'air-grade-value'));
 if(a.precision==='band')result.append(node(doc,'small','Estimated','air-grade-estimated'));
 heading.append(node(doc,'strong','Open The Windows Score'),result);box.append(heading,node(doc,'p',a.text,'air-grade-reading'));
 if(a.category){const official=node(doc,'span','EPA · '+a.official,'air-official-band');official.dataset.category=String(a.category);box.append(official);}
 box.append(node(doc,'p',WINDOW_SUMMARIES[a.category]||'A reliable reading is unavailable. Check current local air information.','air-window-tip'));
 const credit=node(doc,'p',undefined,'small provider-credit');credit.append(link(doc,'EPA AirNow','https://www.airnow.gov/'),doc.createTextNode(' & '),link(doc,'reporting agencies','https://www.airnow.gov/partners/'),doc.createTextNode(' · preliminary data'));
 const at=Date.parse(p.observedAt);if(Number.isFinite(at))credit.append(doc.createTextNode(' · '+new Date(at).toLocaleString('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' Central'));
 box.append(credit);host.append(box);
}
