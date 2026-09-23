"""生成 OG 分享卡片（1200x630）——知微 · 学习伴侣。

用途：index.html 的 og:image / twitter:image。风格对齐前端设计令牌：
底色 canvas #F5F8F9、主色 primary #4E8FB0、正文 ink #22303A、次级 ink-soft #5B6B76。
图形沿用 favicon 的「三点连线」知识图谱母题，不引入额外素材。
"""

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
CANVAS = "#F5F8F9"
PRIMARY = "#4E8FB0"
PRIMARY_SOFT = "#EAF2F6"
INK = "#22303A"
INK_SOFT = "#5B6B76"
CARD = "#FFFFFF"
LINE = "#DCE4E9"

FONT_CANDIDATES = [
    (r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc"),
    (r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyh.ttc"),
    (r"C:\Windows\Fonts\simhei.ttf", r"C:\Windows\Fonts\simhei.ttf"),
]


def load_fonts():
    for bold_path, regular_path in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(bold_path, 62), ImageFont.truetype(regular_path, 30), ImageFont.truetype(regular_path, 24)
        except OSError:
            continue
    raise SystemExit("未找到可用中文字体")


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def main():
    font_title, font_sub, font_caption = load_fonts()
    img = Image.new("RGB", (W, H), CANVAS)
    draw = ImageDraw.Draw(img)

    # 右上角淡色装饰圆（不抢主体，仅补层次）
    draw.ellipse((W - 300, -180, W + 120, 240), fill=PRIMARY_SOFT)

    # 主卡片
    rounded(draw, (60, 60, W - 60, H - 60), 28, CARD, outline=LINE, width=2)

    # 品牌标记：三点连线（与 favicon 同母题）
    cx, cy = 168, 196
    rounded(draw, (cx - 52, cy - 52, cx + 52, cy + 52), 22, PRIMARY)
    nodes = [(cx, cy - 26), (cx - 26, cy + 22), (cx + 26, cy + 20)]
    for a, b in ((0, 1), (0, 2), (1, 2)):
        draw.line((nodes[a], nodes[b]), fill="#FFFFFF", width=4)
    for x, y in nodes:
        r = 9 if (x, y) == (cx, cy - 26) else 7
        draw.ellipse((x - r, y - r, x + r, y + r), fill="#FFFFFF")

    draw.text((268, 152), "知微 · 学习伴侣", font=font_title, fill=INK)
    draw.text((268, 236), "先弄清你卡在哪个知识点，再陪你把它补上", font=font_sub, fill=INK_SOFT)

    # 三条能力要点
    bullets = [
        "自适应测评 · 按掌握度收敛出题",
        "知识图谱归因 · 沿先修链找真正的根因",
        "学长式对话辅导 · 引导优先，不直接抛答案",
    ]
    y = 330
    for text in bullets:
        draw.ellipse((122, y + 10, 134, y + 22), fill=PRIMARY)
        draw.text((152, y), text, font=font_caption, fill=INK)
        y += 54

    # 底部说明（不宣称未实现能力）；与最后一条要点留出呼吸位
    draw.text((122, H - 104), "初中数学 · 二次函数主线 20 个知识点", font=font_caption, fill=INK_SOFT)

    img.save(r"C:\Users\29401\WorkBuddy\2026-09-21-18-05-40\zhiwei-run\apps\web\public\og-cover.png", "PNG")
    print("OG_SAVED")


if __name__ == "__main__":
    main()
