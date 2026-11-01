from PIL import Image, ImageDraw, ImageFont
import os

W = 512
im = Image.new('RGBA', (W, W), (0, 0, 0, 0))
d = ImageDraw.Draw(im)
d.rounded_rectangle([12, 12, W - 12, W - 12], radius=110, fill=(79, 70, 229, 255))

font = None
for fp, idx in [(r'C:\Windows\Fonts\msyhbd.ttc', 0), (r'C:\Windows\Fonts\msyh.ttc', 0), (r'C:\Windows\Fonts\simhei.ttf', 0)]:
    if os.path.exists(fp):
        try:
            font = ImageFont.truetype(fp, 300, index=idx)
            break
        except Exception:
            continue
if font is None:
    font = ImageFont.load_default()

ch = '发'
bbox = d.textbbox((0, 0), ch, font=font)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((W - tw) / 2 - bbox[0], (W - th) / 2 - bbox[1]), ch, font=font, fill=(255, 255, 255, 255))

out = r'D:\探索\freeflow\app.ico'
im.save(out, format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (128, 128), (256, 256), (512, 512)])
print('ICON OK', out)
