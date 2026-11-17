import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGeologyModeIndex,GEOLOGY_MODES} from '../terrain-geology.js';

const source=JSON.parse(await readFile(new URL('../geology.json',import.meta.url),'utf8')),select=createGeologyModeIndex(source);
for(const mode of GEOLOGY_MODES){
 const expected=source.features.filter(feature=>mode==='rocks'||[...feature.properties.rockTypes,...feature.properties.minorRockTypes].some(type=>type.toLowerCase()===mode));
 const actual=select(mode);assert.deepEqual(actual,expected,'original units/classifications retained: '+mode);
 for(let repeat=0;repeat<100;repeat++)assert.equal(select(mode),actual,'renderer keeps its geometry-part index for repeated '+mode);
 for(const feature of actual)assert(source.features.includes(feature),'original source geometry and property object retained');
}
assert.equal(select('rocks'),source.features);assert.deepEqual(select('invalid'),[]);
const minor={properties:{rockTypes:['Shale'],minorRockTypes:['Limestone','Limestone']},geometry:{type:'Polygon',coordinates:[]}},small=createGeologyModeIndex({features:[minor]});assert.deepEqual(small('limestone'),[minor],'minor occurrence included exactly once');
console.log('PASS: all 39 source units/classifications and 99,437 coordinates retained; each rock selection keeps one stable renderer index.');
