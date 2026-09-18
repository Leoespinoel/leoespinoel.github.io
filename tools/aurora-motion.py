# Does the aurora clip actually move, where, and does its brightness hold? Run after: node tools/aurora.mjs frames
# Reads ./temporary screenshots/aurora-frame-*.jpg. A generated clip can look right in any single frame and still be
# a frozen picture, so this measures instead of eyeballing. Two traps met on 18 Sep 2026, both handled here:
#   - take two was a still held for 8s (same first and last frame given to Seedance): raw change 0.35-0.45 / 255
#   - take three scored 2.2-2.7 raw and "moved", but most of that was animated film grain, and the real movement sat
#     only in the middle of the frame, which the hero's portrait covers. So: blur before differencing (grain is
#     pixel-sized and averages out, soft bands moving do not), and report left / centre / right separately.
import glob, os, sys
from PIL import Image, ImageChops, ImageStat, ImageFilter

prefix = sys.argv[1] if len(sys.argv) > 1 else 'aurora-frame-'  # 'aurora-page-' = as drawn on the page
here = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'temporary screenshots')
files = sorted(glob.glob(os.path.join(here, prefix + '*.jpg')), key=lambda f: float(os.path.basename(f)[len(prefix):-4]))
if len(files) < 3: sys.exit('no frames: run node tools/aurora.mjs frames first')
ims = [Image.open(f).convert('L') for f in files]
ims = [im.crop((0, 0, im.width, int(im.height * .55))).filter(ImageFilter.GaussianBlur(8)) for im in ims]  # the aurora band, grain removed
# a layer fading up and down changes every pixel without anything travelling (met on the page: the veil's opacity pulse scored
# 8-15 while the shapes moved 1-2), so every frame is brought to the same mean brightness before frames are compared
bright = [ImageStat.Stat(im).mean[0] for im in ims]
target = sum(bright) / len(bright)
ims = [im.point(lambda v, k=target / max(b, 1e-6): min(255, v * k)) for im, b in zip(ims, bright)]
W = ims[0].width
thirds = {'left': (0, W // 3), 'centre': (W // 3, 2 * W // 3), 'right': (2 * W // 3, W)}
mean = lambda im: ImageStat.Stat(im).mean[0]
worst = {k: 1e9 for k in thirds}
for f, a, b in zip(files[1:], ims, ims[1:]):
    d = ImageChops.difference(a, b)
    parts = {k: mean(d.crop((x0, 0, x1, d.height))) for k, (x0, x1) in thirds.items()}
    if f != files[1]:  # frame 0 is a keyframe and differs a little even in a frozen clip
        for k in parts: worst[k] = min(worst[k], parts[k])
    print(os.path.basename(f), 'brightness', round(bright[files.index(f)], 1), '| change from previous:', ' '.join(f'{k} {v:.2f}' for k, v in parts.items()))
print('first vs last frame (loop seam):', round(mean(ImageChops.difference(ims[0], ims[-1])), 2))
print('brightness range:', round(min(bright), 1), '-', round(max(bright), 1))
# reference points, measured: frozen clip ~0.2 everywhere; take three 1-2 in the centre, under 1 at the sides (read as almost still)
for k, v in worst.items(): print(f'{k}: slowest step {v:.2f} ->', 'moves' if v > 3 else 'weak' if v > 1 else 'still')
print('The sides are what shows on the page: the portrait doorway covers the centre.')
