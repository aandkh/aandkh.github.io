/* Curated menu palettes. Runs before styles/paint, once per document.
 * Dark basemaps use the dark family; Light/Streets use the light family.
 * Selections stay fixed within each family for this document. Each tuple is:
 * surface, raised, soft, ink, muted, line, accent, on-accent, link, focus,
 * then the three coordinated colors for gradients and light spill.
 * Family references and contrast checks: SESSION-PALETTES.md. */
(() => {
 'use strict';
 const root = document.documentElement;
 if (!root || root.dataset.palette) return;
 const palettes = [
  ["andymap",["#172321","#293a33","#2b3e32","#f1f3e9","#bfcbc1","#3b4a3e","#c2d9a5","#203323","#c2d9a5","#edbf77","#0b9165","#21d386","#f3ea43"],"dark"],
  ["nord",["#eceff4","#f8fafd","#dfe5ee","#2e3440","#465363","#a4b0c1","#315b77","#ffffff","#315b77","#714192","#2566ce","#1fc3ce","#7a88e4"],"light"],
  ["solarized",["#fdf6e3","#fffbed","#eee8d5","#344b50","#536769","#a9aaa0","#875b00","#ffffff","#006b75","#a64c00","#088b94","#dbaa0c","#f37323"],"light"],
  ["dracula",["#f6f1fc","#ffffff","#ede5f7","#392c4a","#685475","#bdb0cb","#7440a6","#ffffff","#7440a6","#a22665","#6e30d9","#e634b1","#f8788e"],"light"],
  ["gruvbox",["#fbf1c7","#fff8de","#eee4bf","#3c3836","#655b47","#b3a680","#865a05","#ffffff","#74531a","#a33525","#bd4b0c","#eb9a0c","#adad2f"],"light"],
  ["rose-pine",["#faf4ed","#fffaf5","#f2e5df","#4c4258","#736078","#bdabae","#985360","#ffffff","#8c4568","#7054a2","#6946c5","#d85988","#f7a76a"],"light"],
  ["tokyo-night",["#edf0fa","#fafbff","#e2e7f5","#273450","#52617d","#a9b5ce","#3155ae","#ffffff","#3155ae","#8d3e8f","#1d4bd3","#6646df","#f25cbc"],"light"],
  ["catppuccin",["#eff1f5","#fafbfe","#e6e9f3","#41455f","#62677e","#acb0c8","#773db5","#ffffff","#773db5","#ab3c60","#3c5cdd","#c14ad8","#ee758b"],"light"],
  ["everforest",["#f4f5e9","#fcfcef","#e7ecdc","#354b3d","#586b56","#a7b59d","#41653e","#ffffff","#41653e","#886222","#199482","#66b632","#e2b522"],"light"],
  ["kanagawa",["#f4f0df","#fffbed","#e7e4d1","#393a50","#62616f","#b1afad","#525a91","#ffffff","#525a91","#9b483e","#2551a4","#6454b9","#d97038"],"light"],
  ["oceanic",["#edf6f7","#fbffff","#deedef","#193d49","#4c6870","#9eb9be","#006c78","#ffffff","#006c78","#9f4d32","#095aaf","#0998a3","#4fce9c"],"light"],
  ["oxblood",["#fbf1f0","#fffaf9","#f2e3e2","#462b31","#73565e","#c3a6aa","#8d3047","#ffffff","#8d3047","#725592","#8e1753","#d52733","#ee824a"],"light"],
  ["terracotta",["#faf0e8","#fffaf5","#f0e1d5","#4c3327","#765b4c","#c5aa98","#a44e2d","#ffffff","#9c472a","#3b7774","#d54919","#f59b42","#4ab6a2"],"light"],
  ["copper-teal",["#f3f7f1","#fcfffa","#e2ede3","#274b43","#526b5d","#a4baac","#826127","#ffffff","#72531c","#426aac","#099890","#7daf56","#f0802b"],"light"],
  ["cobalt-citron",["#f4f5ec","#fefff7","#e9edd8","#2b3c52","#5a6673","#b1b99f","#2851a4","#ffffff","#2851a4","#8a6516","#0d4eda","#219fb8","#e4c523"],"light"],
  ["violet-mint",["#f4f0f7","#fcfaff","#e9e1f0","#46334e","#6f5878","#bca9c7","#704989","#ffffff","#704989","#3d7464","#7531c6","#9e64bd","#30c3a5"],"light"],
  ["graphite",["#f4f4f5","#ffffff","#e8e8eb","#2a2a30","#5e5e67","#b0b0ba","#58566c","#ffffff","#58566c","#976124","#4c5b7b","#817fa2","#c5965a"],"light"],
  ["apricot",["#fff4e9","#fffcf7","#f4e4d1","#453529","#76604a","#c6ae91","#93571e","#ffffff","#93571e","#536aa2","#f16c1b","#f3a648","#6e80d4"],"light"],
  ["burgundy-lilac",["#faf0f5","#fffafd","#efdeea","#492b40","#74536c","#c3a2b9","#873561","#ffffff","#873561","#5f62a2","#b30f5f","#d260b2","#796ed5"],"light"],
  ["marine",["#edf5fc","#f9fcff","#dfebf8","#193b57","#4b667c","#9eb6cb","#00699a","#ffffff","#00699a","#9c542a","#0960b1","#0c9de0","#41ceb6"],"light"],
  ["vermilion",["#fbf3ee","#fffaf6","#eee2da","#3e302a","#6f5e53","#bcaba0","#a43e2b","#ffffff","#a43e2b","#3e6a85","#ba1e19","#f4712e","#4aa0c6"],"light"],
  ["midnight-brass",["#101723","#1b2635","#283442","#f3efe2","#c5c7cc","#708298","#d9b86c","#2b2415","#e7cb8d","#c6a6ea","#1952a5","#4570c7","#f5ba49"],"dark"],
  ["pine-coral",["#101f1b","#1a3029","#264033","#f3f4e8","#becfc3","#728c7a","#f2a58f","#3b231c","#fac1a8","#cce5a0","#0f9064","#36cf93","#f79566"],"dark"],
  ["aubergine-gold",["#221525","#34233a","#452e48","#f7edf4","#d6c0d5","#9a7e9d","#e6c578","#362a17","#eed7a0","#b9d8e5","#7f289b","#bb4d8a","#f5bb3c"],"dark"],
  ["ink-cerulean",["#0e1b29","#192d40","#253c50","#edf5fc","#bacddd","#738ea5","#7fc9ef","#142f43","#a4ddfa","#f3c29c","#08499f","#0e9ce1","#57ecde"],"dark"],
  ["espresso-cream",["#211b17","#332921","#45372d","#fcf0dd","#d7c6b1","#998775","#e7cc9f","#362817","#f0dbb7","#b6d3d5","#833f24","#cb8342","#e9bf80"],"dark"],
  ["blackberry",["#1d1625","#2c223a","#3c2d4c","#f3eaf8","#d2bfdc","#9a7cae","#d6abef","#35213e","#e7c6fb","#c2deac","#6022a3","#a643d9","#ed7a9b"],"dark"],
  ["slate-rose",["#191e27","#29313f","#374252","#f4eff3","#cbd0dc","#8592a8","#f0b2c1","#3a242e","#f6ccdb","#c9dca6","#2f5799","#aa5fa5","#f78fa6"],"dark"],
  ["moss-gold",["#1b2116","#2b3522","#3c462f","#f3f1df","#ced1b8","#8d9777","#dbd38b","#303016","#ece4a8","#e4b5c3","#2e7f44","#9ab736","#f6ce4b"],"dark"],
  ["deep-sea",["#0d2426","#15393a","#214b49","#edf7f0","#bfdbcf","#709e92","#90ddca","#17372e","#b4eddc","#e8cc9b","#096bb1","#09b4b0","#61dfaa"],"dark"],
  ["charcoal-coral",["#211d21","#322b31","#433842","#f8edf2","#d4c5cf","#988390","#ffae9e","#40221e","#ffcbbb","#c7d7ef","#6b437e","#d35074","#f7956c"],"dark"],
  ["navy-orange",["#101c30","#1b2c45","#283d57","#edf2fc","#c0cde1","#748ca9","#f9b77b","#392717","#ffd4a5","#bbcfed","#174fb4","#5661c6","#f69850"],"dark"],
  ["plum-sage",["#241b28","#35293b","#46374c","#f6edf5","#d6c7da","#a08aa6","#d0dab0","#303822","#e1e9c8","#e6bad3","#8f3ca4","#9d77a9","#aadb7a"],"dark"],
  ["obsidian-silver",["#151719","#25292d","#353b40","#f4f5f6","#c8d0d7","#8a969f","#d5dfeb","#26313d","#e3e9f2","#e8c592","#43658c","#7e9ab6","#d1b98b"],"dark"],
  ["umber-lilac",["#221b18","#352923","#463a30","#f8eddf","#d8c5b5","#a08b76","#d4bbf3","#342340","#e7d4fb","#b5d8c4","#9e5732","#c67783","#c88df0"],"dark"],
  ["jade-moon",["#10251f","#1b3930","#284b3d","#f0f5e6","#c3d8c8","#7c9e86","#eddfac","#333018","#f8edc6","#c3d9f3","#0fa48d","#4fc26d","#f8d372"],"dark"],
  ["wine-peach",["#28151d","#3d222d","#502e3b","#fcecf1","#e1c1cf","#ac8094","#ffc2a2","#42251d","#ffdbc3","#d8c4ef","#9e2561","#dd4161","#f8a677"],"dark"],
  ["storm-blue",["#151d26","#242f3c","#354151","#f0f4fa","#c5d0e0","#8496ae","#adcaeb","#233449","#d1e3f7","#e8c9a5","#2256a3","#4f92d0","#93cbd1"],"dark"],
  ["cypress-gold",["#191f1c","#2b352f","#3d473f","#f4f1e6","#ccd1c5","#8c9b8b","#dec184","#342b18","#eed6a8","#bfd4ea","#248a73","#95b04a","#f1c24f"],"dark"],
  ["amethyst-ice",["#1f182e","#302441","#413452","#f4edf9","#d0c3e0","#9b85b3","#9edce5","#20353b","#c0edf2","#efc3a9","#7135c3","#7762d6","#5cd3e7"],"dark"],
  ["petrol-rose",["#102226","#1c343b","#2a4650","#edf4f7","#bfd4dc","#799ba8","#e9b7d2","#3b2436","#f4d0e4","#ead9a3","#0b93a4","#6080c5","#e787b9"],"dark"]
 ];
 const keys = ['surface','raised','soft','ink','muted','line','accent','on-accent','link','focus','gradient-start','gradient-middle','gradient-end'];
 const storagePrefix = 'andymap:last-palette:v2:';
 const selectedByTone = new Map();
 function readPrevious(tone) {
  try { return sessionStorage.getItem(storagePrefix + tone) || sessionStorage.getItem('andymap:last-palette:v1') || ''; }
  catch { return ''; }
 }
 function randomIndex(length) {
  try {
   const values = new Uint32Array(1), limit = Math.floor(0x100000000 / length) * length;
   do { crypto.getRandomValues(values); } while (values[0] >= limit);
   return values[0] % length;
  } catch { return Math.floor(Math.random() * length); }
 }
 const toneForStyle = style => ['positron','liberty'].includes(style) ? 'light' : 'dark';
 let initialStyle = 'dark';
 try { initialStyle = localStorage.getItem('andymap.style') || initialStyle; } catch { /* Storage is optional. */ }
 function applyTone(tone) {
  if (root.dataset.paletteTone === tone && selectedByTone.has(tone)) return;
  let selected = selectedByTone.get(tone);
  if (!selected) {
   const previous = readPrevious(tone);
   const choices = palettes.filter(p => p[2] === tone && p[0] !== previous);
   selected = choices[randomIndex(choices.length)];
   selectedByTone.set(tone,selected);
   try { sessionStorage.setItem(storagePrefix + tone,selected[0]); } catch { /* The document still keeps its choice. */ }
  }
  keys.forEach((key, index) => root.style.setProperty(`--palette-${key}`,selected[1][index]));
  root.dataset.palette = selected[0];
  root.dataset.paletteTone = selected[2];
 }
 applyTone(toneForStyle(document.body?.dataset.mapStyle || initialStyle));
 function followMapStyle() {
  const body = document.body;
  if (!body) return;
  const sync = () => applyTone(toneForStyle(body.dataset.mapStyle || initialStyle));
  sync();
  // No subtree, child-list, class, timer or feed observer. Only a deliberate
  // basemap-style change can switch families, and each family keeps its choice.
  new MutationObserver(sync).observe(body,{attributes:true,attributeFilter:['data-map-style']});
 }
 if (document.body) followMapStyle();
 else document.addEventListener('DOMContentLoaded',followMapStyle,{once:true});
})();
