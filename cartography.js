// Andymap's presentation of the verified OpenFreeMap styles. These overrides
// use observed layer IDs, types and source layers, never inferred geography.
// Source data, geometry filters, label fields, asset URLs and attribution remain
// upstream's. Requested city-name display filters change; Dark gains the light
// style's factual waterway label presentation. Pinned upstream JSON stays intact.
const PALETTES = {
 positron: {
  land:'#f3f2eb',urban:'#e9ebe4',park:'#d6e3cf',wood:'#c7d8bf',grass:'#dfe8d5',
  water:'#9cbfc0',waterLine:'#83aaae',waterText:'#244b54',waterHalo:'#c8dcdb',
  building:'#dde3d9',buildingEdge:'#c7d2c3',minor:'#fcfcf8',casing:'#d1d8ce',
  major:'#fffef9',majorCasing:'#c4cec2',motorway:'#e6ddbe',motorwayCasing:'#c4bfa3',
  path:'#dbe2d5',rail:'#a5b4a9',railDash:'#f3f2eb',boundary:'#9eafa1',
  city:'#254b3d',town:'#425f51',neighborhood:'#5c6e61',street:'#536c5d',
  halo:'#f4f3ec',poi:'#687969',airport:'#4c6b64',
 },
 dark: {
  land:'#111e20',urban:'#172729',park:'#203b33',wood:'#1e352f',grass:'#263e32',
  water:'#24484e',waterLine:'#35616a',waterText:'#aed1d1',waterHalo:'#214248',
  building:'#263a3c',buildingEdge:'#344a49',minor:'#263638',casing:'#182a2c',
  major:'#31484b',majorCasing:'#182a2c',motorway:'#68684f',motorwayCasing:'#293a39',
  path:'#30473e',rail:'#435a57',railDash:'#132527',boundary:'#42635e',
  city:'#edf0db',town:'#bdcfc3',neighborhood:'#93b0a6',street:'#abc1bb',
  halo:'#14262c',poi:'#9eb8a9',airport:'#aac7c5',
 },
 liberty: {
  land:'#eeeee1',urban:'#e3e7d9',park:'#cbdcbd',wood:'#b8cda8',grass:'#d6e2c8',
  water:'#8eb9bf',waterLine:'#6d9ca5',waterText:'#214650',waterHalo:'#c4dbd9',
  building:'#d4dbcc',buildingEdge:'#b6c5b1',minor:'#fcfaf2',casing:'#c1ccbb',
  major:'#f6efda',majorCasing:'#bbc3ad',motorway:'#e4cda0',motorwayCasing:'#aea888',
  path:'#d7dcca',rail:'#91a599',railDash:'#eeeee1',boundary:'#8da08f',
  city:'#234b39',town:'#405f4d',neighborhood:'#5b705f',street:'#536b59',
  halo:'#f3f2e7',poi:'#63765f',airport:'#466b61',
 },
};

const LIGHT_LABELS = {
 city:['label_city','label_city_capital'],town:['label_town'],village:['label_village'],
 neighborhood:['label_other'],region:['label_state','label_country_1','label_country_2','label_country_3'],
};
const DARK_LABELS = {
 city:['place_city','place_city_large'],town:['place_town'],village:['place_village'],
 neighborhood:['place_other','place_suburb'],region:['place_state','place_country_other','place_country_minor','place_country_major'],
};
// Exact requested city-name variants only. Lake Saint Louis and other nearby
// names remain visible; roads, rivers and other sources are untouched.
const CENTRAL_CITY_NAME_FILTER=['!',['any',...['name:en','name_en','name:latin','name'].map(field=>[
 'match',['downcase',['to-string',['coalesce',['get',field],'']]],['saint louis','st. louis','st louis','east saint louis','east st. louis','east st louis'],true,false,
])]];
// Exact factual label definition observed in the pinned Positron style. Dark
// has the identical vector source and waterway lines but omits this label layer.
const WATERWAY_LABEL={id:'waterway_line_label',type:'symbol',source:'openmaptiles','source-layer':'waterway',minzoom:10,
 filter:['match',['geometry-type'],['LineString','MultiLineString'],true,false],
 layout:{'symbol-placement':'line','symbol-spacing':350,'text-field':['case',['has','name:nonlatin'],['concat',['get','name:latin'],' ',['get','name:nonlatin']],['coalesce',['get','name_en'],['get','name']]],'text-font':['Noto Sans Italic'],'text-letter-spacing':.2,'text-max-width':5,'text-size':14},
};

/** Return a new MapLibre style without mutating its upstream source object. */
export function createCartography(style, theme) {
 if(!Object.hasOwn(PALETTES,theme))throw new RangeError('Unknown Andymap map style');
 if(!style||style.version!==8||!Array.isArray(style.layers)||!style.sources||typeof style.sources!=='object')throw new TypeError('Expected a MapLibre version 8 style');
 const result=structuredClone(style),p=PALETTES[theme],dark=theme==='dark',layers=new Map(result.layers.map(layer=>[layer.id,layer]));
 const waterway=layers.get('waterway');
 if(dark&&!layers.has(WATERWAY_LABEL.id)&&waterway?.type==='line'&&waterway.source==='openmaptiles'&&waterway['source-layer']==='waterway'&&result.sources.openmaptiles?.type==='vector'){
  const label=structuredClone(WATERWAY_LABEL),beforePlaces=result.layers.findIndex(layer=>layer.id==='place_other');
  result.layers.splice(beforePlaces<0?result.layers.length:beforePlaces,0,label);layers.set(label.id,label);
 }
 // Matching the source layer as well as the ID makes schema drift fail closed:
 // an unrelated future layer with a familiar name is not restyled accidentally.
 function edit(ids,type,sourceLayer,paint={},layout={}) {
  const found=[];
  for(const id of ids){const layer=layers.get(id);if(!layer||layer.type!==type||sourceLayer&&(layer.source!=='openmaptiles'||layer['source-layer']!==sourceLayer))continue;
   if(Object.keys(paint).length)layer.paint={...layer.paint,...structuredClone(paint)};
   if(Object.keys(layout).length)layer.layout={...layer.layout,...structuredClone(layout)};
   found.push(layer);
  }
  return found;
 }
 const fill=(ids,source,color,extra={})=>edit(ids,'fill',source,{'fill-color':color,...extra});
 const line=(ids,source,color,extra={})=>edit(ids,'line',source,{'line-color':color,...extra});
 const text=(ids,source,color,layout={},paint={})=>edit(ids,'symbol',source,{'text-color':color,'text-halo-color':p.halo,'text-halo-width':1.15,'text-halo-blur':.35,...paint},layout);
 const zoomSize=(z1,s1,z2,s2,z3,s3)=>['interpolate',['linear'],['zoom'],z1,s1,z2,s2,...(z3===undefined?[]:[z3,s3])];

 edit(['background'],'background',null,{'background-color':p.land});
 fill(['water'],'water',p.water,{'fill-antialias':true,'fill-opacity':1});
 fill(['landuse_residential'],'landuse',p.urban);
 fill(['park'],'park',p.park,{'fill-opacity':.85,'fill-outline-color':p.park});
 fill(['landuse_park'],'landuse',p.park);
 fill(['landcover_wood'],'landcover',p.wood,{'fill-opacity':dark?.85:.8});
 fill(['landcover_grass'],'landcover',p.grass,{'fill-opacity':.72});
 fill(['building'],'building',p.building,{'fill-outline-color':p.buildingEdge,'fill-opacity':.85});
 line(['park_outline'],'park',p.wood,{'line-opacity':.5,'line-width':.7});
 line(['waterway'],'waterway',p.waterLine,{'line-width':zoomSize(8,.55,12,1.1,17,2.4)});
 line(['waterway_river','waterway_other','waterway_tunnel'],'waterway',p.waterLine);
 const waterLayout={'text-size':zoomSize(8,12,12,14,17,16),'text-letter-spacing':.06,'text-padding':4,...(dark?{'text-font':['Noto Sans Italic'],'symbol-spacing':350}:{})},waterPaint={'text-halo-color':p.waterHalo,'text-halo-width':1.25};
 text(['water_name','water_name_point_label','water_name_line_label'],'water_name',p.waterText,waterLayout,waterPaint);
 text(['waterway_line_label'],'waterway',p.waterText,waterLayout,waterPaint);
 // All these IDs were observed in the upstream styles. Keep their road widths,
 // bridge/tunnel filters and dash semantics; color establishes the hierarchy.
 line(['highway_minor'],'transportation',p.minor,{'line-opacity':dark?.76:.86});
 line(['highway_path'],'transportation',p.path,{'line-opacity':.85});
 line(['highway_major_casing'],'transportation',p.majorCasing);
 line(['highway_major_inner'],'transportation',p.major,{'line-opacity':dark?.82:1});
 line(['highway_major_subtle'],'transportation',p.majorCasing,{'line-opacity':dark?.55:.75});
 line(['highway_motorway_casing','highway_motorway_bridge_casing','tunnel_motorway_casing'],'transportation',p.motorwayCasing);
 line(['highway_motorway_inner','highway_motorway_bridge_inner','tunnel_motorway_inner'],'transportation',p.motorway);
 line(['highway_motorway_subtle'],'transportation',p.motorway,{'line-opacity':.8});
 line(['railway','railway_service','railway_minor','railway_transit'],'transportation',p.rail,{'line-opacity':.65});
 line(['railway_dashline','railway_service_dashline','railway_minor_dashline','railway_transit_dashline'],'transportation',p.railDash,{'line-opacity':.8});
 fill(['road_area_pier'],'transportation',p.land);
 line(['road_pier'],'transportation',p.land);
 line(['aeroway-taxiway','aeroway-runway-casing','aeroway_taxiway'],'aeroway',p.casing);
 line(['aeroway-runway','aeroway_runway'],'aeroway',p.minor);
 fill(['aeroway-area','aeroway_fill'],'aeroway',p.minor);
 line(['boundary_2','boundary_3','boundary_disputed','boundary_state','boundary_country_z0-4','boundary_country_z5-'],'boundary',p.boundary,{'line-opacity':.5});

 const labels=dark?DARK_LABELS:LIGHT_LABELS;
 // OpenMapTiles can classify these settlements as town/other place labels at
 // different tile scales. Use every observed place-label ID, but keep the
 // exact full-name exclusion; no transportation or airport labels are affected.
 for(const layer of edit(Object.values(labels).flat(),'symbol','place')){
  const alreadyApplied=layer.filter?.[0]==='all'&&JSON.stringify(layer.filter.at(-1))===JSON.stringify(CENTRAL_CITY_NAME_FILTER);
  if(!alreadyApplied)layer.filter=layer.filter?['all',layer.filter,structuredClone(CENTRAL_CITY_NAME_FILTER)]:structuredClone(CENTRAL_CITY_NAME_FILTER);
 }
 text(labels.city,'place',p.city,{'text-size':zoomSize(7,14,11,18,15,22),'text-font':['Noto Sans Bold'],'text-letter-spacing':.015,'text-transform':'none','text-padding':5},{'text-halo-width':1.4});
 text(labels.town,'place',p.town,{'text-size':zoomSize(8,12,12,14,16,16),'text-font':['Noto Sans Regular'],'text-letter-spacing':.015,'text-transform':'none','text-padding':4});
 text(labels.village,'place',p.town,{'text-size':zoomSize(9,11,13,13,17,15),'text-transform':'none','text-padding':4});
 for(const layer of text(labels.neighborhood,'place',p.neighborhood,{'text-size':zoomSize(11,11,14,12,17,13),'text-font':['Noto Sans Regular'],'text-letter-spacing':.06,'text-transform':'none','text-padding':4}))layer.minzoom=Math.max(11,layer.minzoom||0);
 text(labels.region,'place',p.neighborhood);
 text(['highway-name-major'],'transportation_name',p.street,{'text-size':zoomSize(12,11,15,12,18,14),'text-letter-spacing':.01,'symbol-spacing':380});
 text(['highway-name-minor','highway-name-path'],'transportation_name',p.street,{'text-size':zoomSize(14,11,17,12,19,13),'text-letter-spacing':.01,'symbol-spacing':400});
 for(const layer of text(['highway_name_other'],'transportation_name',p.street,{'text-size':zoomSize(12,11,15,12,18,13),'text-transform':'none','text-letter-spacing':.015,'symbol-spacing':400}))layer.minzoom=Math.max(12,layer.minzoom||0);
 text(['highway_name_motorway'],'transportation_name',dark?'#dacba5':p.street,{'text-size':12,'symbol-spacing':420});
 edit(['highway-shield-non-us','highway-shield-us-interstate','road_shield_us'],'symbol','transportation_name',{}, {'symbol-spacing':380});
 text(['airport'],'aerodrome_label',p.airport,{'text-size':12,'text-padding':4});

 if(dark){
  // Observed missing upstream sprites: retain woodland and place text without
  // requesting wood-pattern or circle-11, instead of adding substitute art.
  const wood=layers.get('landcover_wood');if(wood?.type==='fill'&&wood.source==='openmaptiles'&&wood['source-layer']==='landcover'&&wood.paint?.['fill-pattern']==='wood-pattern')delete wood.paint['fill-pattern'];
  for(const layer of edit(['place_town','place_city','place_city_large'],'symbol','place'))if(JSON.stringify(layer.layout?.['icon-image']||'').includes('circle-11'))delete layer.layout['icon-image'];
 }
 if(theme==='liberty'){
  fill(['landuse_pitch'],'landuse','#c3d4b2');fill(['landuse_track'],'landuse','#dac8a5');
  fill(['landuse_cemetery'],'landuse','#cbd9c3');fill(['landuse_hospital'],'landuse','#e7d9d5');
  fill(['landuse_school'],'landuse','#e9e1c7');fill(['landcover_sand'],'landcover','#e9dfbd');
  fill(['landcover_wetland'],'landcover','#bdd4cb',{'fill-opacity':.55});
  for(const layer of fill(['road_area_pattern'],'transportation',p.path,{'fill-opacity':.6}))delete layer.paint['fill-pattern'];
  line(['road_minor_casing','road_service_track_casing','road_link_casing','tunnel_street_casing','tunnel_service_track_casing','tunnel_link_casing','bridge_street_casing','bridge_service_track_casing','bridge_link_casing','bridge_path_pedestrian_casing'],'transportation',p.casing);
  line(['road_minor','road_service_track','road_link','tunnel_minor','tunnel_service_track','tunnel_link','bridge_street','bridge_service_track','bridge_link'],'transportation',p.minor);
  line(['road_secondary_tertiary_casing','road_trunk_primary_casing','tunnel_secondary_tertiary_casing','tunnel_trunk_primary_casing','bridge_secondary_tertiary_casing','bridge_trunk_primary_casing'],'transportation',p.majorCasing);
  line(['road_secondary_tertiary','road_trunk_primary','tunnel_secondary_tertiary','tunnel_trunk_primary','bridge_secondary_tertiary','bridge_trunk_primary'],'transportation',p.major);
  line(['road_motorway_casing','road_motorway_link_casing','tunnel_motorway_casing','tunnel_motorway_link_casing','bridge_motorway_casing','bridge_motorway_link_casing'],'transportation',p.motorwayCasing);
  line(['road_motorway','road_motorway_link','tunnel_motorway','tunnel_motorway_link','bridge_motorway','bridge_motorway_link'],'transportation',p.motorway);
  line(['road_path_pedestrian','tunnel_path_pedestrian','bridge_path_pedestrian'],'transportation',p.path);
  line(['road_major_rail','road_major_rail_hatching','road_transit_rail','road_transit_rail_hatching','tunnel_major_rail','tunnel_major_rail_hatching','tunnel_transit_rail','tunnel_transit_rail_hatching','bridge_major_rail','bridge_major_rail_hatching','bridge_transit_rail','bridge_transit_rail_hatching'],'transportation',p.rail,{'line-opacity':.65});
  // Base POIs provide factual text context. Their upstream class-derived icon
  // names include absent sprites (office, recycling, bicycle_parking, gate).
  // Text-only presentation avoids both failed requests and invented icons;
  // Andymap's separate interactive category markers are unaffected.
  for(const[id,minzoom]of [['poi_r1',16],['poi_r7',17],['poi_r20',18],['poi_transit',14]])for(const layer of text([id],'poi',p.poi,{'text-size':12,'text-padding':5,'text-anchor':'center','text-offset':[0,0]})){
   layer.minzoom=Math.max(minzoom,layer.minzoom||0);delete layer.layout['icon-image'];
  }
  // The existing footprint source continues at close zoom; no extrusion,
  // invented height, new layer, or replacement footprint geometry is introduced.
  const flat=layers.get('building'),extruded=layers.get('building-3d');
  if(flat?.type==='fill'&&flat.source==='openmaptiles'&&flat['source-layer']==='building'&&extruded?.type==='fill-extrusion'&&extruded.source==='openmaptiles'&&extruded['source-layer']==='building'){
   delete flat.maxzoom;extruded.layout={...extruded.layout,visibility:'none'};
  }
 }
 return result;
}
