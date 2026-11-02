from PIL import Image, ImageDraw, ImageFont
import os

# 生成 macOS .icns 图标：与 app.ico 同源（紫底白字「发」），尺寸放大到 1024 以适配 Retina。
W = 1024
im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle([24, 24, W - 24, W - 24], radius=220, fill=(79, 70, 229, 255))

font = None
for fp in [r'C:\Windows\Fonts\msyhbd.ttc', r'C:\Windows\Fonts\msyh.ttc', r'C:\Windows\Fonts\simhei.ttf']:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 600, index=0)
            break
        except Exception:
            continue
if font is None:
    font = ImageFont.load_default()

ch = '发'
bbox = d.textbbox((0, 0), ch, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((W - tw) / 2 - bbox[0], (W - th) / 2 - bbox[1]), ch, font=font, fill=(255, 255, 255, 255))

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app.icns')
im.save(out, format='ICNS')
print('ICNS OK', out, im.size)
