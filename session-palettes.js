/* Curated menu palettes. Runs before styles/paint, once per document.
 * The map and data colors deliberately do not participate. Each tuple is:
 * surface, raised, soft, ink, muted, line, accent, on-accent, link, focus.
 * Family references and contrast checks: SESSION-PALETTES.md. */
(() => {
 'use strict';
 const root = document.documentElement;
 if (!root || root.dataset.palette) return;
 const palettes = [
  ['andymap', ['#f5f6f1','#ffffff','#eaf0e8','#203d35','#55665d','#b1beb0','#275c46','#ffffff','#275c46','#895d20'], ['#172321','#293a33','#2b3e32','#f1f3e9','#bfcbc1','#71866f','#c2d9a5','#203323','#c2d9a5','#edbf77']],
  ['nord', ['#eceff4','#f8fafd','#dfe5ee','#2e3440','#465363','#a4b0c1','#315b77','#ffffff','#315b77','#714192'], ['#242b36','#2e3440','#3b4252','#eceff4','#c4cedc','#78889e','#88c0d0','#182a35','#88c0d0','#ebcb8b']],
  ['solarized', ['#fdf6e3','#fffbed','#eee8d5','#344b50','#536769','#a9aaa0','#875b00','#ffffff','#006b75','#a64c00'], ['#002b36','#073642','#0d414a','#f3eddb','#b9c9c4','#62858a','#e4bd63','#322400','#91c9bd','#ef9f6f']],
  ['dracula', ['#f6f1fc','#ffffff','#ede5f7','#392c4a','#685475','#bdb0cb','#7440a6','#ffffff','#7440a6','#a22665'], ['#24222f','#302d40','#3e354f','#f8f8f2','#cec4dc','#8a7d9c','#bd93f9','#291c40','#c8a5ff','#ffb86c']],
  ['gruvbox', ['#fbf1c7','#fff8de','#eee4bf','#3c3836','#655b47','#b3a680','#865a05','#ffffff','#74531a','#a33525'], ['#282828','#35312b','#443d30','#fbf1c7','#d5c4a1','#9c8c67','#fabd2f','#322608','#f2c765','#fe8019']],
  ['rose-pine', ['#faf4ed','#fffaf5','#f2e5df','#4c4258','#736078','#bdabae','#985360','#ffffff','#8c4568','#7054a2'], ['#191724','#242032','#30283e','#e0def4','#c2b8d3','#8a7898','#ebbcba','#35223d','#ebbcba','#f6c177']],
  ['tokyo-night', ['#edf0fa','#fafbff','#e2e7f5','#273450','#52617d','#a9b5ce','#3155ae','#ffffff','#3155ae','#8d3e8f'], ['#161a2b','#20263b','#29334d','#d5dff8','#b1bddc','#6b7d9f','#7aa2f7','#18243a','#a9bfff','#ffbc83']],
  ['catppuccin', ['#eff1f5','#fafbfe','#e6e9f3','#41455f','#62677e','#acb0c8','#773db5','#ffffff','#773db5','#ab3c60'], ['#1e1e2e','#2a2a40','#36364e','#cdd6f4','#b8c0df','#7d85a9','#cba6f7','#30233f','#cba6f7','#f9e2af']],
  ['everforest', ['#f4f5e9','#fcfcef','#e7ecdc','#354b3d','#586b56','#a7b59d','#41653e','#ffffff','#41653e','#886222'], ['#232f2b','#2e3d34','#3a4939','#e3e9cd','#c0cbb1','#7e9275','#a7c080','#253322','#c3d5a4','#dfb988']],
  ['kanagawa', ['#f4f0df','#fffbed','#e7e4d1','#393a50','#62616f','#b1afad','#525a91','#ffffff','#525a91','#9b483e'], ['#1f1f28','#2a2a37','#343445','#dcd7ba','#c1bea8','#85837f','#dca561','#342510','#dca561','#a3b6d9']],
  ['oceanic', ['#edf6f7','#fbffff','#deedef','#193d49','#4c6870','#9eb9be','#006c78','#ffffff','#006c78','#9f4d32'], ['#102c34','#1b3b43','#274a51','#edf6f6','#b7d0d2','#648f96','#71d2d4','#113537','#90dedb','#f1b69a']],
  ['oxblood', ['#fbf1f0','#fffaf9','#f2e3e2','#462b31','#73565e','#c3a6aa','#8d3047','#ffffff','#8d3047','#725592'], ['#2b1920','#3e242d','#4c2e37','#f8e7e7','#d8b9c0','#a17884','#efa1b0','#3f1b28','#f0b4c0','#dec58d']],
  ['terracotta', ['#faf0e8','#fffaf5','#f0e1d5','#4c3327','#765b4c','#c5aa98','#a44e2d','#ffffff','#9c472a','#3b7774'], ['#2a201c','#3b2b24','#4a342b','#f6e8db','#d9c0af','#9d8170','#eaa57f','#402418','#f3bd98','#a8d0c2']],
  ['copper-teal', ['#f3f7f1','#fcfffa','#e2ede3','#274b43','#526b5d','#a4baac','#826127','#ffffff','#72531c','#426aac'], ['#172d2a','#223d35','#2c4a3e','#f2ecd9','#c1cebc','#759484','#dfb576','#352a16','#e8c58e','#91d5d4']],
  ['cobalt-citron', ['#f4f5ec','#fefff7','#e9edd8','#2b3c52','#5a6673','#b1b99f','#2851a4','#ffffff','#2851a4','#8a6516'], ['#172a45','#213854','#2b4760','#edf3e4','#c3d2d6','#718c9a','#d9df7c','#313717','#e0e599','#8ec9ef']],
  ['violet-mint', ['#f4f0f7','#fcfaff','#e9e1f0','#46334e','#6f5878','#bca9c7','#704989','#ffffff','#704989','#3d7464'], ['#2a1c32','#3b2845','#49324e','#f4e9f7','#d5bedb','#9c7ea7','#a9dfcb','#24372f','#b6ead8','#e5b3e8']],
  ['graphite', ['#f4f4f5','#ffffff','#e8e8eb','#2a2a30','#5e5e67','#b0b0ba','#58566c','#ffffff','#58566c','#976124'], ['#1c1c21','#2b2b32','#393941','#f1f0f6','#c5c2d0','#81818f','#d5bedc','#322938','#e2cde8','#edbf83']],
  ['apricot', ['#fff4e9','#fffcf7','#f4e4d1','#453529','#76604a','#c6ae91','#93571e','#ffffff','#93571e','#536aa2'], ['#25221f','#36302b','#443c33','#f7ebd9','#d4c3ad','#968775','#ffbf87','#3d2818','#ffd0a7','#b8cbd6']],
  ['burgundy-lilac', ['#faf0f5','#fffafd','#efdeea','#492b40','#74536c','#c3a2b9','#873561','#ffffff','#873561','#5f62a2'], ['#311925','#442434','#542e41','#fae7f2','#dcb9ce','#a57490','#cdb6f1','#32213e','#dcc5fa','#edbd91']],
  ['marine', ['#edf5fc','#f9fcff','#dfebf8','#193b57','#4b667c','#9eb6cb','#00699a','#ffffff','#00699a','#9c542a'], ['#12263b','#1b354d','#24435b','#e5f3fc','#b8cddd','#6d8ca5','#76d2f0','#123143','#95dff6','#f8c176']],
  ['vermilion', ['#fbf3ee','#fffaf6','#eee2da','#3e302a','#6f5e53','#bcaba0','#a43e2b','#ffffff','#a43e2b','#3e6a85'], ['#231e1b','#342925','#44332d','#f6e9df','#d5bfb0','#a18071','#f49c85','#40231e','#ffb29e','#d4cb97']]
 ];
 const keys = ['surface','raised','soft','ink','muted','line','accent','on-accent','link','focus'];
 const storageKey = 'andymap:last-palette:v1';
 let previous = '';
 try { previous = sessionStorage.getItem(storageKey) || ''; } catch { /* Private/storage-restricted browser. */ }
 const choices = palettes.filter(p => p[0] !== previous);
 function randomIndex(length) {
  try {
   const values = new Uint32Array(1), limit = Math.floor(0x100000000 / length) * length;
   do { crypto.getRandomValues(values); } while (values[0] >= limit);
   return values[0] % length;
  } catch { return Math.floor(Math.random() * length); }
 }
 const selected = choices[randomIndex(choices.length)];
 for (const [offset, mode] of [[1,'light'],[2,'dark']]) {
  keys.forEach((key, index) => root.style.setProperty(`--palette-${mode}-${key}`,selected[offset][index]));
 }
 root.dataset.palette = selected[0];
 try { sessionStorage.setItem(storageKey,selected[0]); } catch { /* Selection still works without storage. */ }
})();
