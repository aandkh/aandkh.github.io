// Search intent selects relevant existing feeds; it does not claim a citywide geocoder.
export function searchLayers(query){
 const q=query.trim().toLowerCase();
 const rules=[[/\b(wildlife|animals|plants|species|fungi|butterflies)\b/,['wildlife']],[/\b(birding|birdwatching|birds)\b/,['birding']],[/\b(history|historical|battles)\b/,['history']],[/\b(joyride|joyrides|scenic|driving)\b/,['joyrides']],[/\b(gym|gyms|fitness|workout|weightlifting|pilates|yoga|memento)\b/,['gyms']],[/\b(coffee|cafe|café|espresso|latte)\b/,['restaurants']],[/\b(restaurant|food|pizza|burger|taco|sushi|dinner|lunch|breakfast)\b/,['restaurants']],[/\b(bar|pub|beer|brewery|cocktail)\b/,['bars']],[/\b(park|trail|hike|hiking)\b/,['parks']],[/\b(museum|art|exhibit|exhibition)\b/,['culture','exhibitions']],[/\b(concert|music|show)\b/,['concerts']]];
 return [...new Set(rules.filter(([pattern])=>pattern.test(q)).flatMap(([,ids])=>ids))];
}
