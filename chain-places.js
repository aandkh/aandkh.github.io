// Owner policy: known chains/franchises are excluded from destination layers.
// This is a maintained exclusion index, not a claim that every retained business
// has verified independent ownership. Repeated names alone are not evidence.
// Keep this shared by API normalization, browser rendering and saved selections.
// Brand IDs checked against the primary Name Suggestion Index on 2026-11-15:
// https://github.com/osmlab/name-suggestion-index/blob/main/data/brands/amenity/fast_food.json
// Canonical branches/aliases also appear in these official location directories:
// https://www.mcdonalds.com/us/en-us/restaurant-directory.html
// https://www.panerabread.com/en-us/cafe/locations/mo/st-louis/5696-telegraph-road
// Regional franchise evidence: https://www.chuckshotchicken.com/franchising
// https://www.picklemansfranchising.com/requirements/
const DESTINATION_LAYERS=new Set(['restaurants','bars','nightlife','movies','family','recreation','culture','localfood','markets','foodtrucks','businesses']);
const normalize=value=>typeof value==='string'?value.normalize('NFKD').replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g,'').toLowerCase().replace(/[’'`]/g,'').replace(/&|\+/g,' and ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' '):'';
const compact=value=>normalize(value).replaceAll(' ','');
const NAMES=`
McDonald's|McDonalds|McCafe|Burger King|Wendy's|Hardee's|Carl's Jr|Jack in the Box|White Castle|Sonic|Sonic Drive In|A&W|A&W Restaurants
Arby's|Arbys|Arby's Roast Beef|Roy Rogers|Fuddruckers|Habit Burger|The Habit Burger Grill|BurgerFi|Burger 21|Freddy's Frozen Custard|Portillo's|Portillo's Hot Dogs
Taco Bell|Taco Bell Cantina|Del Taco|Taco John's|Taco Bueno|Qdoba|Qdoba Mexican Eats|Qdoba Mexican Grill|Chipotle|Chipotle Mexican Grill|Moe's Southwest Grill|Fuzzy's Taco Shop
KFC|Kentucky Fried Chicken|Popeyes|Popeyes Louisiana Kitchen|Popeyes Chicken and Biscuits|Church's Chicken|Church's Texas Chicken|Raising Cane's|Raising Cane's Chicken Fingers|Chick-fil-A|Zaxby's|Slim Chickens|Lee's Famous Recipe Chicken|Wingstop|Buffalo Wild Wings
Subway|Subway Sandwiches|Jimmy John's|Jersey Mike's|Jersey Mike's Subs|Firehouse Subs|Penn Station|Penn Station East Coast Subs|Potbelly|Potbelly Sandwich Shop|Quiznos|Schlotzsky's|McAlister's Deli|Jason's Deli|Which Wich
Domino's|Domino's Pizza|Pizza Hut|Papa John's|Papa Johns Pizza|Little Caesars|Little Caesars Pizza|Papa Murphy's|Papa Murphy's Take N Bake Pizza|Marco's Pizza|Jet's Pizza|MOD Pizza|Blaze Pizza|Sbarro|Cicis|Cici's Pizza|Mellow Mushroom|Imo's|Imo's Pizza|Cecil Whittaker's Pizzeria|Cecil Whittaker's Pizza|Dewey's Pizza|Chuck E Cheese|Chuck E Cheese's
Panera|Panera Bread|St Louis Bread Co|St Louis Bread Company|Saint Louis Bread Co|Saint Louis Bread Company|Au Bon Pain|Corner Bakery|Corner Bakery Cafe|Einstein Bros Bagels|Einstein Brothers Bagels|Bruegger's Bagels|Noah's New York Bagels
Starbucks|Starbucks Coffee|Dunkin|Dunkin Donuts|Tim Hortons|Caribou Coffee|Peet's Coffee|Scooter's Coffee|7 Brew|7 Brew Coffee|Dutch Bros|Dutch Bros Coffee|The Coffee Bean and Tea Leaf|BIGGBY Coffee
Dairy Queen|Dairy Queen Grill and Chill|DQ|DQ Grill and Chill|DQ Orange Julius|Baskin Robbins|Cold Stone Creamery|Marble Slab Creamery|Menchie's|Menchie's Frozen Yogurt|Orange Leaf|SweetFrog|Pinkberry|Yogurtland|Andy’s Frozen Custard|Rita's Italian Ice|Dippin Dots
Krispy Kreme|Auntie Anne's|Cinnabon|Wetzel's Pretzels|Crumbl|Crumbl Cookies|Insomnia Cookies|Nothing Bundt Cakes|Great American Cookies|Edible Arrangements|Great Harvest Bread Co|Great Harvest Bread Company
Smoothie King|Tropical Smoothie Cafe|Jamba|Jamba Juice|Planet Smoothie|Robeks|Clean Juice|Nekter Juice Bar|Juice It Up|Kung Fu Tea|Gong Cha|Sharetea
Applebee's|Applebee's Grill and Bar|Chili's|Chili's Grill and Bar|TGI Fridays|T.G.I. Friday's|Ruby Tuesday|Red Robin|Red Robin Gourmet Burgers|Red Lobster|Olive Garden|Olive Garden Italian Restaurant|LongHorn Steakhouse|Outback Steakhouse|Texas Roadhouse|Logan's Roadhouse|Saltgrass Steak House|Ruth's Chris Steak House|The Capital Grille|Fleming's Prime Steakhouse and Wine Bar|Morton's The Steakhouse
Cracker Barrel|Cracker Barrel Old Country Store|Bob Evans|Denny's|IHOP|International House of Pancakes|Waffle House|First Watch|First Watch The Daytime Cafe|Perkins|Perkins Restaurant and Bakery|Golden Corral|Golden Corral Buffet and Grill|Huddle House|Village Inn
Culver's|Culvers|Freddy's|Freddy's Frozen Custard and Steakburgers|Steak 'n Shake|Steak and Shake|Five Guys|Five Guys Burgers and Fries|Shake Shack|Smashburger|Whataburger|In N Out Burger|Cook Out|Rally's|Rally's Hamburgers|Checkers|Checkers Drive In|Lion's Choice
Panda Express|P.F. Chang's|PF Chang's China Bistro|Pei Wei|Noodles and Company|Noodles and Co|Fazoli's|Fazolis|Captain D's|Captain D's Seafood|Long John Silver's|Bojangles|El Pollo Loco|Boston Market|Pollo Tropical|Hooters|Twin Peaks|Dave and Buster's|Miller's Ale House|Yard House|BJ's Restaurant and Brewhouse|The Cheesecake Factory|California Pizza Kitchen|Maggiano's Little Italy|Buca di Beppo|The Old Spaghetti Factory|Carrabba's Italian Grill|Bonefish Grill|Bahama Breeze|Joe's Crab Shack
54th Street|54th Street Grill and Bar|54th Street Restaurant and Drafthouse|Cheddar's Scratch Kitchen|Cheddar's|Bandana's Bar B Q|Bandana's BBQ|Hotshots Sports Bar and Grill|Honey Baked Ham|The Honey Baked Ham Company|Charleys Philly Steaks|Charleys Cheesesteaks|Teriyaki Madness|Genghis Grill|HuHot Mongolian Grill|bd's Mongolian Grill|Fogo de Chao|Texas de Brazil|Rodizio Grill
Chicken Salad Chick|Sarku Japan|Everbowl|Snarf's Sandwiches|Snarf's|Brio|Brio Italian Grille|Bravo Italian Kitchen|Bravo Cucina Italiana|Rush Bowls|Pickleman's|Pickleman's Gourmet Cafe|Pretzelmaker|Chuck's Hot Chicken|The Pasta House Co|The Pasta House Company|Pasta House|Houlihan's|Houlihans|Mimi's Cafe|Mimi's|Houlihan's Restaurant and Bar
Hawaiian Bros|Hawaiian Bros Island Grill|L&L Hawaiian Barbecue|Pokeworks|Poke Bros|Teriyaki Experience|Wahlburgers|Super Chix|Dave's Hot Chicken|Hangry Joe's Hot Chicken|Bonchon|bb.q Chicken|bbq Chicken|Taziki's Mediterranean Cafe|CAVA|Sweetgreen|Just Salad|Chopt|Salad and Go|Playa Bowls|Vitality Bowls|Aloha Poke|Clean Eatz|Nautical Bowls
Torchy's Tacos|Chuy's|Baja Fresh|Rubio's Coastal Grill|Chronic Tacos|Costa Vida|Cafe Rio|Donatos Pizza|Hungry Howie's|Godfather's Pizza|Giordano's|Lou Malnati's|Rosati's Pizza|Toppers Pizza|Taco Cabana|Taco Del Mar|Pret A Manger|Paris Baguette|Tous Les Jours|85C Bakery Cafe|Shipley Do-Nuts
AMC|AMC Theatres|AMC Theaters|AMC Classic|AMC Dine In|Regal|Regal Cinemas|Regal Theatres|Cinemark|Marcus Theatres|Marcus Theaters|B&B Theatres|B&B Theaters|Alamo Drafthouse|Alamo Drafthouse Cinema|Landmark Theatres
Topgolf|Golf Galaxy|X Golf|Five Iron Golf|Bowlero|AMF Bowling|Main Event|Main Event Entertainment|Round1|Round 1|Urban Air|Urban Air Adventure Park|Sky Zone|Sky Zone Trampoline Park|Altitude Trampoline Park|Rockin Jump|Launch Trampoline Park
Planet Fitness|Anytime Fitness|LA Fitness|Esporta Fitness|Orangetheory|Orangetheory Fitness|Club Pilates|Pure Barre|F45 Training|Crunch Fitness|Gold's Gym|Life Time Fitness|Lifetime Fitness|Burn Boot Camp|The Little Gym|My Gym|KidStrong
Walmart|Walmart Supercenter|Target|Costco|Sam's Club|Lowe's|Lowes|The Home Depot|Home Depot|IKEA|Bass Pro Shops|Cabela's|Dick's Sporting Goods|REI|Michaels|Hobby Lobby|Joann|Jo Ann Fabrics|Dollar General|Dollar Tree|Family Dollar|Five Below|Walgreens|CVS|CVS Pharmacy|QuikTrip|Circle K|7 Eleven|7-Eleven|Wawa|Sheetz
`.trim().split(/[|\n]/).map(value=>value.trim()).filter(Boolean);
const ALIASES=new Set(NAMES.map(compact));
// Explicit venue-location naming conventions. General words such as China King
// or a surname are not classified merely because several records share them.
const LOCATION_PREFIXES=['mcdonalds','starbucks','taco bell','panera bread','st louis bread','saint louis bread','qdoba','white castle','amc','regal cinemas','regal theatres','cinemark','marcus theatres','marcus cinema','marcus','b and b','alamo drafthouse','wehrenberg','wherenberg','wherenburg','planet fitness','anytime fitness','orangetheory fitness','topgolf','bowlero','sky zone','urban air'];
const BRAND_IDS=new Set(['Q38076','Q177054','Q752941','Q111972226']);
const DOMAINS=new Set(`mcdonalds.com burgerking.com bk.com wendys.com hardees.com carlsjr.com jackinthebox.com whitecastle.com sonicdrivein.com tacobell.com qdoba.com chipotle.com kfc.com popeyes.com churchs.com raisingcanes.com chick-fil-a.com wingstop.com buffalowildwings.com subway.com jimmyjohns.com jerseymikes.com firehousesubs.com penn-station.com potbelly.com mcalistersdeli.com dominos.com pizzahut.com papajohns.com littlecaesars.com papamurphys.com jetspizza.com modpizza.com imospizza.com panerabread.com starbucks.com dunkindonuts.com dunkin.com scooterscoffee.com dutchbros.com dairyqueen.com baskinrobbins.com coldstonecreamery.com crumblcookies.com insomniacookies.com nothingbundtcakes.com smoothieking.com tropicalsmoothiecafe.com applebees.com chilis.com redrobin.com redlobster.com olivegarden.com longhornsteakhouse.com outback.com texasroadhouse.com crackerbarrel.com bobevans.com dennys.com ihop.com wafflehouse.com firstwatch.com culvers.com freddys.com steaknshake.com fiveguys.com shakeshack.com rallys.com lionschoice.com pandaexpress.com noodles.com fazolis.com captainds.com ljsilvers.com hooters.com twinpeaksrestaurant.com daveandbusters.com cheesecakefactory.com amctheatres.com regmovies.com cinemark.com marcustheatres.com bbtheatres.com drafthouse.com topgolf.com golfgalaxy.com bowlero.com mainevent.com skyzone.com urbanair.com planetfitness.com anytimefitness.com lafitness.com orangetheory.com clubpilates.com purebarre.com walmart.com target.com costco.com samsclub.com lowes.com homedepot.com ikea.com basspro.com cabelas.com dickssportinggoods.com`.split(/\s+/));
function matchesName(value){
 if(typeof value!=='string'||!value.trim())return false;
 const normalized=normalize(value),withoutUnit=normalized.replace(/\s+(?:(?:store|location|unit|no)\s+)?\d{2,}.*$/,'').replace(/\s+(?:llc|inc|incorporated|corp|corporation)$/,'');
 if(ALIASES.has(normalized.replaceAll(' ',''))||ALIASES.has(withoutUnit.replaceAll(' ','')))return true;
 if(LOCATION_PREFIXES.some(prefix=>normalized.startsWith(prefix+' ')))return true;
 return value.split(/\s+[–—-]\s+|[;/|]|\s+at\s+|\s*&\s*/i).some(part=>ALIASES.has(compact(part.replace(/\s*#\s*\d.*$/,''))));
}
function matchesDomain(value){
 if(typeof value!=='string'||!/^https?:\/\//i.test(value))return false;
 try{let host=new URL(value).hostname.toLowerCase();while(host){if(DOMAINS.has(host))return true;const dot=host.indexOf('.');if(dot<0)break;host=host.slice(dot+1);}return false;}catch{return false;}
}
export function isExcludedChainPlace(layer,value){
 if(layer&&!DESTINATION_LAYERS.has(layer))return false;
 if(!value||typeof value!=='object')return false;
 const p=value.properties&&typeof value.properties==='object'?value.properties:value,tags=p.tags&&typeof p.tags==='object'?p.tags:{};
 for(const source of [p,tags]){
  if(source.excludedChain===true||[source.chain,source.franchise].some(flag=>flag===true||typeof flag==='string'&&/^(yes|true|1)$/i.test(flag.trim())))return true;
  if(['title','name','name:en','brand','brand:en','operator','operator:en','alt_name','short_name','official_name','chain','franchise'].some(key=>matchesName(source[key])))return true;
  if(['brand:wikidata','brandWikidata','operator:wikidata','operatorWikidata'].some(key=>typeof source[key]==='string'&&source[key].split(';').some(id=>BRAND_IDS.has(id.trim()))))return true;
  if(['url','website','canonicalWebsite','contact:website'].some(key=>matchesDomain(source[key])))return true;
 }
 return false;
}
export function filterPlaceFeatures(layer,features){
 if(!DESTINATION_LAYERS.has(layer))return features;
 let filtered=null;
 for(let i=0;i<features.length;i++){if(isExcludedChainPlace(layer,features[i])){filtered??=features.slice(0,i);}else filtered?.push(features[i]);}
 return filtered||features;
}
