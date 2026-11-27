"""生成肥鱼的米饭自适应图标 + 主图标 + 启动图。"""
import colorsys
import math
import os
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icon-drafts")

# ---------- 小工具 ----------

def hex_rgba(hex6, alpha=255):
    """Pillow 不吃 8 位 hex，手转 RGBA 元组。"""
    h = hex6.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), alpha)


def render_icon(size, bg_hex, scale):
    """画背景 + 琥珀碗 + 白米堆（v2：明确碗形，去热气）。"""
    s = int(size * scale)
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))

    # 1. 背景圆角方块
    pad = int(s * 0.10)
    bg = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle([pad, pad, s - pad, s - pad], radius=int(s * 0.19),
                        fill=hex_rgba(bg_hex))
    img.alpha_composite(bg)

    cx = s / 2
    rim_y = s * 0.47          # 碗沿 y
    bowl_r = s * 0.26         # 碗半径
    amber = hex_rgba("F5A524")
    amber_dark = hex_rgba("D98A0F")
    rice = hex_rgba("FFF8EC")

    # 2. 米堆：碗沿上方 4 团白饭（先画，碗体压住下缘）
    rice_layer = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rice_layer)
    piles = [(-0.40, 0.36), (0.0, 0.48), (0.40, 0.36), (0.0, 0.22, 0.26)]
    for item in piles:
        dx, ry = item[0], item[1]
        rr = item[2] if len(item) > 2 else 0.30
        gx = cx + bowl_r * dx
        gy = rim_y - bowl_r * ry
        gr = bowl_r * rr
        rd.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=rice)
    img.alpha_composite(rice_layer)

    # 3. 碗体：下半圆（pieslice 0..180 是下半）
    bowl = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bowl)
    bd.pieslice([cx - bowl_r, rim_y - bowl_r, cx + bowl_r, rim_y + bowl_r],
                0, 180, fill=amber)
    # 碗沿横条
    rim_h = s * 0.045
    bd.rounded_rectangle([cx - bowl_r, rim_y - rim_h, cx + bowl_r, rim_y + rim_h],
                         radius=rim_h / 2, fill=amber)
    # 碗底座
    foot_w = bowl_r * 0.72
    foot_h = s * 0.035
    bd.rounded_rectangle([cx - foot_w / 2, rim_y + bowl_r - foot_h,
                          cx + foot_w / 2, rim_y + bowl_r + foot_h * 1.6],
                         radius=foot_h / 2, fill=amber_dark)
    # 碗身不再加高光弧线（v3：去划痕）。
    img.alpha_composite(bowl)

    return img.resize((size, size), Image.LANCZOS)

# ---------- 主入口 ----------

def render_foreground(size):
    """自适应图标前景：透明底，碗+米缩进安全区（108 格子中约 66 可见）。"""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    # 先画一版满幅，再整体缩小放到安全区
    full = render_icon(s * 2, "1C1C1E", 1)
    safe = int(s * 0.61)
    small = full.resize((safe, safe), Image.LANCZOS)
    off = (s - safe) // 2
    img.alpha_composite(small, (off, off))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)

    print("== adaptive icon (foreground, transparent bg) ==")
    # Android 自适应图标前景层：透明底 + 图形缩到安全区（66/108 ≈ 0.61）
    fg = render_icon(432, "000000", 1)
    # 把深底抠掉：前景只留碗和米（alpha 通道以非背景色判定太脆，直接画一版无底图形）
    fg = render_foreground(432)
    fg.save(os.path.join(OUT, "adaptive-icon.png"))

    print("== 主图标 ==")
    icon = render_icon(1024, "1C1C1E", 1)
    icon.save(os.path.join(OUT, "icon.png"))

    print("== 启动图 ==")
    splash = render_icon(1024, "121212", 1)
    splash.save(os.path.join(OUT, "splash-icon.png"))

    print("完成:", OUT)

if __name__ == "__main__":
    main()
