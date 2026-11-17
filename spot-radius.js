// Keep one exact feet-to-miles conversion across the flag UI, lookup and links.
export const DEFAULT_SPOT_RADIUS_MILES=100/5280;
export const SPOT_RADII=[DEFAULT_SPOT_RADIUS_MILES,300/5280,.15,.5,1,3];
export const normalizeSpotRadius=value=>SPOT_RADII.includes(value)?value:DEFAULT_SPOT_RADIUS_MILES;
export function spotRadiusLabel(miles){return miles===DEFAULT_SPOT_RADIUS_MILES?'100 ft':miles===300/5280?'300 ft':miles===.15?'800 ft':miles+' mi';}
