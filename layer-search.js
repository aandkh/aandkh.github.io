// Exact, deliberate query aliases. These aid discovery; they do not imply
// that a layer is configured or that its source supplies every named condition.
const ALIASES=Object.freeze({
 haunted:['haunted'],haunting:['haunted'],ghost:['haunted'],ghosts:['haunted'],paranormal:['haunted'],folklore:['haunted'],spooky:['haunted'],
 wildlife:['wildlife'],animals:['wildlife'],plants:['wildlife'],species:['wildlife'],fungi:['wildlife'],butterflies:['wildlife'],birds:['birding','wildlife'],birdwatching:['birding'],battles:['history'],historical:['history'],history:['history'],
 joyride:['joyrides'],joyrides:['joyrides'],driving:['joyrides','traffic'],drive:['joyrides'],scenic:['joyrides'],
 gym:['gyms'],gyms:['gyms'],fitness:['gyms'],workout:['gyms'],weightlifting:['gyms'],pilates:['gyms'],yoga:['gyms'],
 plane:['aircraft'],planes:['aircraft'],airplane:['aircraft'],airplanes:['aircraft'],flight:['aircraft'],flights:['aircraft'],
 bus:['transit'],buses:['transit'],train:['transit'],trains:['transit'],
 bathroom:['restrooms'],bathrooms:['restrooms'],toilet:['restrooms'],toilets:['restrooms'],
 bike:['cycling'],bikes:['cycling'],bicycle:['cycling'],bicycles:['cycling'],
 weather:['radar','weather'],rain:['radar','weather'],snow:['radar','weather'],sleet:['radar','weather'],
 movies:['movies'],
 bar:['bars','nightlife','localfood'],bars:['bars','nightlife','localfood'],pub:['bars','nightlife','localfood'],pubs:['bars','nightlife','localfood'],
 restaurant:['restaurants','localfood'],restaurants:['restaurants','localfood'],food:['restaurants','localfood','foodtrucks','markets'],eating:['restaurants','localfood'],dinner:['restaurants','localfood'],
 cafe:['restaurants','localfood'],cafes:['restaurants','localfood'],coffee:['restaurants','localfood']
});
const normalized=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function layerMatchesSearch(layer,query){
 const q=normalized(query),name=normalized(layer?.name);
 if(!q)return true;
 if(Object.hasOwn(ALIASES,q))return name===q||ALIASES[q].includes(layer?.id);
 return name.includes(q)||(Array.isArray(layer?.searchTerms)&&layer.searchTerms.some(term=>normalized(term).includes(q)));
}
