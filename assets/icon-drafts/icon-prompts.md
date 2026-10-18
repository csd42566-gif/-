# 神罚 App 图标 · 生成指令（远景版 v2）

> 结论先行：**远景当图标是逆着图标的物理规律走的**——1:1 里塞全身 + 宫殿，缩到 108px
> 只剩一团黑。所以下面的远景 prompt 按"分层明度"写：人物靠金边从宫殿里"抠"出来，
> 宫殿整体压暗只留檐口亮线。这样远景也有得看。真要 512px 商店图级别的锐，仍建议最后重画矢量。

---

## 0. 硬参数

| 项 | 值 | 原因 |
|---|---|---|
| 比例 | **1:1 正方形** | 横构图裁图标必切人 |
| 尺寸 | **2048×2048 出图，再下采样到 1024** | 要点：高分辨率生成再缩，比原生 1024 锐一档 |
| 主体占比 | 人物高 ≈ 画面 55–65% | 远景也不能真远，否则没主体 |
| 宫殿位置 | 只占上方 1/3，且**压暗成剪影** | 宫殿细节再多，缩小后也是噪点；给檐口一条金线就够 |
| 背景 | 黑天 + 一条地平线金光 | 不要满天云，云是"糊"的主要来源 |
| 配色 | 墨黑 / 熔金 `#C9A227`~`#E8C25A` / 骨白 | 超三色必花 |
| 图生图保真度 | **0.35–0.45** | 要保住衣服形制和宫殿结构，又不能把原图的糊一起搬过来 |

---

## 1. 主推：远景全身 + 宫殿（你要的那版）

```
Square 1:1 app icon, 2048x2048. WIDE FULL-BODY SHOT, camera pulled back. A lone figure in an
ornate black-and-gold Chinese battle robe stands on a stone platform in the lower-center of
the frame, holding a long spear vertically, head slightly lowered.
Behind him, filling only the upper third, a vast golden Chinese palace with tiered roofs,
sharp upturned eaves and layered dougong brackets, backlit so its mass stays dark and only
the eave lines catch gold light.

THE ROBE MUST BE LEGIBLE AT THIS DISTANCE: visible woven silk grain, individual gold-thread
embroidery stitches, lamellar armor plates with crisp cut edges, a wide dark sash with a
metal clasp, sharp fold creases.
THE PALACE MUST BE LEGIBLE TOO: individually readable roof tiles, sharp ridge lines,
distinct bracket sets under each eave, hard clean edges, no melted shapes.

Lighting: one hard gold rim light from behind the palace, one cold low fill from the front so
no costume detail is lost in shadow. NO haze over the subject, NO fog between camera and
figure, NO depth-of-field blur, NO atmospheric scattering on the costume.
Ultra-sharp, tack-sharp focus edge to edge, high micro-detail, 8k, clean extreme contrast,
crushed blacks, hot gold highlights, hard graphic edges.

Background otherwise minimal: black sky, one thin band of gold horizon glow, a single low mist
line at the base only, no clouds above, no floating embers, no chains, no extra scenery.
Centered, even margin all around. No text, no watermark, no border.
```

---

## 2. 变体 A：远景但更空（最稳，缩小后仍能认）

```
Square 1:1 app icon, 2048x2048. Wide shot, a single black-robed figure with a vertical spear
standing dead center on a thin stone step, occupying 60% of frame height. Behind him the
golden palace is reduced to a DARK SILHOUETTE MASS with only the top eave ridge outlined in
molten gold - no interiors, no windows, no ornaments. Black sky, one gold horizon line.
Costume detail remains sharp: gold embroidery threads, plate edges, fold creases.
Hard clean edges, extreme contrast, tack-sharp, no haze, no blur, no depth of field.
Centered, huge negative space, minimal and authoritarian. No text, no watermark, no border.
```

---

## 3. 变体 B：侧背身、枪斜置（构图最有张力）

```
Square 1:1 app icon, 2048x2048. Wide three-quarter back view: the black-robed figure stands
with his back partly to camera, spear planted diagonally, robe hem and long hair pulled to
one side by wind. Palace behind in the upper third, dark mass with gold-lit eave edges.
Costume legible: silk weave, gold thread, armor plate edges, sash clasp.
Extreme contrast, tack-sharp, no fog, no blur, no bokeh. Black sky, gold horizon line only.
Centered, even margin. No text, no watermark, no border.
```

---

## 4. 近景方案（保留，但明确不推荐做图标）

上一版金瞳特写留着当启动页 / 商店宣传图用。图标用它，128px 以下只能看到一只眼睛。

---

## 5. 治"糊"专项：衣服和宫殿为什么糊

原图糊不是模型手抖，是四个东西在拖后腿，prompt 里要**主动排除**：

| 病根 | 症状 | 对策 |
|---|---|---|
| `fog / mist / atmospheric haze` | 全身蒙一层灰，衣服纹路化开 | 只在画面最底部留一条，并写 `NO haze over the subject` |
| `depth of field / bokeh / cinematic` | 宫殿虚化 | 负向直接禁 `depth of field, bokeh, blur`，写 `edge to edge sharp` |
| 逆光 + 大面积金色发光 | 金辉溢出吃掉衣服轮廓 | 补一道 `cold low fill from the front`，把暗部细节托出来 |
| 生成分辨率不足 | 纹样变成一坨色块 | 2048 出图再缩；纹样要用名词列举（`stitches / plates / clasp`），别只说 `ornate` |

---

## 6. 负向提示词（配上面任意一条）

```
blurry, soft focus, shallow depth of field, bokeh, motion blur, jpeg artifacts, low
resolution, oversmoothed, plastic texture, melted shapes, mushy details, illegible pattern,
haze, mist over subject, fog on costume, washed out, low contrast, muddy colors,
text, letters, chinese characters, logo, watermark, signature, border, frame, rounded square,
drop shadow, clouds overhead, floating embers, sparks, chains, extra scenery, multiple
figures, extra limbs, deformed hands, teal, blue tones, purple tones
```

---

## 7. 各工具的加词

- **Midjourney**：`--ar 1:1 --style raw --stylize 50 --quality 2`（stylize 越低越清晰，别用默认 100）
- **即梦 / 可图 / 混元**：末尾追加 `超高清，8K，细节锐利，无虚化，无雾`
- **SD / Flux**：步数 ≥ 30，CFG 4–6，采样器 DPM++ 2M；高分辨率修复开 1.5×，denoise 0.35

---

## 8. 挑图与落地

- 一次出 4 张，**先在 64px 缩略图看**：人形认不出就减元素，别加。
- 小尺寸检查：48 / 72 / 108 / 192 / 512 px 各存一张。
- Android adaptive icon 要拆两层：前景层放人物（在 66% 安全区内），背景层放黑底 + 金檐线，
  否则系统裁切时会把宫殿檐角切掉。
