"""Derive permanent softer Vice colors: retain hue/lightness, reduce HSL saturation
and glow opacity by exactly 40% (8-bit rounding). Does not filter the map or text."""
from pathlib import Path
import colorsys,re
path=Path(__file__).resolve().parent.parent/'today-palette.css'
marker='/* Generated permanent soft mode'
source=path.read_text().split(marker)[0].rstrip()
def soften(m):
    value=m.group()[1:]
    if len(value)==3: value=''.join(c*2 for c in value)
    rgb=[int(value[i:i+2],16)/255 for i in (0,2,4)]
    h,l,s=colorsys.rgb_to_hls(*rgb)
    result='#'+''.join(f'{round(c*255):02x}' for c in colorsys.hls_to_rgb(h,l,s*.6))
    if len(value)==8: result+=f'{round(int(value[6:],16)*.6):02x}'
    return result
soft=re.sub(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b',soften,source)
soft=soft.replace('[data-today-palette="vice-sunset"]','[data-today-palette="vice-sunset"][data-vice-intensity="soft"]')
path.write_text(source+'\n\n'+marker+': saturation and glow opacity × 0.60. */\n'+soft+'\n')
