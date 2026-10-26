"""Export the live canvas (index.html) to stills or an MP4.

    pip install playwright && playwright install chromium
    python render.py preview            # 4 stills, one per room -> out/
    python render.py video out/remake.mp4

The page exposes render(t). We call it for every frame, so the export is
deterministic. This re-renders the scene from code; the original video in
assets/trumpbot.mp4 is never touched.
"""
import base64
import subprocess
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
FPS, DUR, SIZE = 30, 48, 1080


def grab(page, mime="image/png"):
    data = page.evaluate(f"document.getElementById('c').toDataURL('{mime}', 0.95)")
    return base64.b64decode(data.split(",", 1)[1])


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "preview"
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / "out" / ("remake.mp4" if mode == "video" else "")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": SIZE, "height": SIZE})
        page.goto((ROOT / "index.html").as_uri() + "?render=1")
        page.wait_for_function("window.ready === true")
        if mode == "preview":
            out.mkdir(parents=True, exist_ok=True)
            for t in (2.0, 14.0, 26.0, 38.0):
                page.evaluate(f"render({t})")
                (out / f"frame_{t:02.0f}.png").write_bytes(grab(page))
            print(f"saved 4 stills to {out}")
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            ff = subprocess.Popen(
                ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS),
                 "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "18",
                 "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)],
                stdin=subprocess.PIPE,
            )
            for f in range(FPS * DUR):
                page.evaluate(f"render({f / FPS})")
                ff.stdin.write(grab(page, "image/jpeg"))
            ff.stdin.close()
            ff.wait()
            print(f"saved {out}")
        browser.close()


if __name__ == "__main__":
    main()
