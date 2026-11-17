// Exact point-to-grid mappings verified from the official NWS /points responses.
// This caches stable routing only: forecasts still come from the live hourly API.
const checkedAt=Date.parse('2026-11-17T02:26:50Z');
const points=Object.freeze({
 '38.6300,-90.4000':'88,74',
 '38.4450,-90.4140':'88,66',
 '38.7524,-90.3734':'89,80',
 '38.6572,-90.6558':'79,75',
 '38.6127,-90.2608':'93,74'
});
export function knownNwsGrid(key,now=Date.now()){
 const grid=points[key];
 if(!grid||now<checkedAt-86400000||now-checkedAt>30*86400000)return null;
 return 'https://api.weather.gov/gridpoints/LSX/'+grid+'/forecast/hourly';
}
