from PIL import Image, ImageDraw, ImageFont
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'android', 'app', 'src', 'main', 'res')

def get_font(size):
    for fp in [r'C:\Windows\Fonts\msyhbd.ttc', r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf']:
        if os.path.exists(fp):
            try:
                return ImageFont.truetype(fp, size, index=0)
            except Exception:
                continue
    return ImageFont.load_default()

def draw_glyph(size, pad_ratio, bg, fg):
    """画「发」字图标。pad_ratio=0 时铺满（传统图标），>0 时留白做自适应前景。"""
    im = Image.new('RGBA', (size, size), bg)
    d = ImageDraw.Draw(im)
    fs = int(size * (1 - pad_ratio))
    font = get_font(fs)
    ch = '发'
    bbox = d.textbbox((0, 0), ch, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((size - tw) / 2 - bbox[0], (size - th) / 2 - bbox[1]), ch, font=font, fill=fg)
    return im

# 传统启动图标：紫底白字（与 app.ico / app.icns 同源）
LEGACY = {'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192}
for d, s in LEGACY.items():
    out = os.path.join(ROOT, d)
    os.makedirs(out, exist_ok=True)
    draw_glyph(s, 0.16, (79, 70, 229, 255), (255, 255, 255, 255)).save(os.path.join(out, 'ic_launcher.png'))
    draw_glyph(s, 0.16, (79, 70, 229, 255), (255, 255, 255, 255)).save(os.path.join(out, 'ic_launcher_round.png'))

# 自适应图标前景（透明底白字，安全区 ~66%）
FG = {'mipmap-mdpi': 108, 'mipmap-hdpi': 162, 'mipmap-xhdpi': 216, 'mipmap-xxhdpi': 324, 'mipmap-xxxhdpi': 432}
for d, s in FG.items():
    out = os.path.join(ROOT, d)
    os.makedirs(out, exist_ok=True)
    draw_glyph(s, 0.38, (0, 0, 0, 0), (255, 255, 255, 255)).save(os.path.join(out, 'ic_launcher_foreground.png'))

for name in ['ic_launcher.xml', 'ic_launcher_round.xml']:
    xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    with open(os.path.join(ROOT, 'mipmap-anydpi-v26', name), 'w', encoding='utf-8') as f:
        f.write(xml)

# 背景色资源
colors_path = os.path.join(ROOT, 'values', 'colors.xml')
colors = open(colors_path, encoding='utf-8').read() if os.path.exists(colors_path) else '<resources></resources>'
if 'ic_launcher_background' not in colors:
    colors = colors.replace('</resources>', '    <color name="ic_launcher_background">#4F46E5</color>\n</resources>')
    with open(colors_path, 'w', encoding='utf-8') as f:
        f.write(colors)

print('ANDROID ICONS OK', ROOT)
