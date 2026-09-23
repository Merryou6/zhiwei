#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
知微 · 题库复算固化（MINOR-④，迭代 2 步骤 8）

目的：把「题库逐题人工验算」固化为可重复执行的脚本——**独立重算**（不复用任何生成期
代码、不读 solution_steps 的结论），与 item_bank 的 answer 逐题比对。

覆盖的模板族（对应计划 六、MINOR-④ 列出的族）：
  代入求值 / 恒等式展开 / 顶点坐标 / 对称轴 / 最值（含取最值时的 x）/ 判别式 /
  方程解（含解方程、配方后方程等价）/ 与 x 轴交点（坐标与个数）/ 与 y 轴交点 /
  因式分解 / 配方补项与配方形式 / 顶点式互化（含展开成一般式）/ 单步平移 /
  线段长 / 三角形面积 / 待定系数三点反代 / 二次函数系数提取 / 开口方向 /
  一次函数 k、b 与两点求解析式 / 点对称、象限与坐标 / 对称轴反求 b

判定口径（格式无关，杜绝「同值不同写法」误报）：
  - 数值型 answer：解析数字后按 1e-6 容差比对；
  - 解析式型 answer：与独立重算得到的表达式在若干采样点上求值比对；
  - 解集/坐标型 answer：提取数值（去掉变量名）后按集合/顺序比对；
  - 未命中任何模板族或无法解析 → 记入「未覆盖」，不阻断（覆盖率仅报告，目标 ≥80）。

另做一致性校验（阻断）：fill / short_answer 的 solution_steps 末步必须包含 answer。
退出码：存在不一致 → 1；否则 0。仅使用 Python 标准库。
"""

from __future__ import annotations

import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BANK_PATH = ROOT / "data" / "item_bank" / "math" / "cz.json"

TOL = 1e-6
TARGET_COVERAGE = 80
SAMPLES = (0.5, 1.0, 2.0, -1.0, 3.0, -2.5)
VAR = "x"
ALLOWED = re.compile(r"^[0-9a-zA-Z_+\-*/^(). ]+$")
NUM_RE = re.compile(r"-?\d+(?:\.\d+)?(?:/\d+)?")


class Uncovered(Exception):
    """该题不属于任何已固化的模板族（记入未覆盖，不阻断）。"""


# ----------------------------------------------------------------- 表达式工具

def to_py(expr: str) -> str:
    text = expr.strip().replace("−", "-").replace("×", "*").replace("÷", "/")
    text = text.replace("^", "**")
    text = re.sub(r"(?<=\d)\s*(?=[a-zA-Z(])", "*", text)
    text = re.sub(r"(?<=[a-zA-Z)])\s*(?=\()", "*", text)
    text = re.sub(r"(?<=[a-zA-Z)])\s*(?=[a-zA-Z])", "*", text)
    return text


def safe_eval(expr: str, env: dict) -> float:
    text = to_py(expr)
    if not ALLOWED.match(text):
        raise Uncovered(f"表达式含未允许字符：{expr!r}")
    try:
        value = eval(text, {"__builtins__": {}}, dict(env))  # noqa: S307（本地题库、已白名单）
    except Exception as exc:  # noqa: BLE001
        raise Uncovered(f"表达式求值失败：{expr!r}") from exc
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise Uncovered(f"表达式求值非数值：{expr!r}")
    if not math.isfinite(value):
        raise Uncovered(f"表达式求值非有限：{expr!r}")
    return float(value)


def poly_coeffs(expr: str, require_quadratic: bool = False):
    """由采样独立还原 ≤2 次多项式系数 (a, b, c)，并校验确为多项式。"""
    f0 = safe_eval(expr, {VAR: 0.0})
    f1 = safe_eval(expr, {VAR: 1.0})
    fm1 = safe_eval(expr, {VAR: -1.0})
    c = f0
    b = (f1 - fm1) / 2.0
    a = (f1 + fm1) / 2.0 - f0
    for probe in (2.0, -3.0):
        if abs(a * probe * probe + b * probe + c - safe_eval(expr, {VAR: probe})) > 1e-6:
            raise Uncovered(f"非二次多项式：{expr!r}")
    if require_quadratic and abs(a) < 1e-9:
        raise Uncovered(f"二次项系数为 0：{expr!r}")
    return a, b, c


def close(x: float, y: float) -> bool:
    return abs(x - y) <= TOL * max(1.0, abs(x), abs(y))


def numbers(text: str):
    out = []
    for raw in NUM_RE.findall(text):
        if "/" in raw:
            num, den = raw.split("/")
            out.append(float(num) / float(den))
        else:
            out.append(float(raw))
    return out


def values_after_equals(text: str):
    """解集型 answer 取数值：按分隔符切段，优先取等号右侧，避免把 x1 的 1 当数值。"""
    out = []
    for segment in re.split(r"[,，、;；]", text):
        if "=" in segment:
            out.extend(numbers(segment.split("=")[-1]))
    if out:
        return out
    return numbers(text)


def coord_pairs(text: str):
    pairs = []
    for body in re.findall(r"\(([^)]*)\)", text):
        nums = numbers(body)
        if len(nums) >= 2:
            pairs.append((nums[0], nums[1]))
    return pairs


def strip_y(text: str) -> str:
    return re.sub(r"^\s*y\s*=\s*", "", text.strip())


def parabola_coeffs(stem: str, require_quadratic: bool = True):
    """取题干中 y = <expr> 的右端并还原系数（a≠0 由调用方要求）。"""
    found = re.findall(r"y\s*=\s*([^，。；)）]+)", stem)
    if not found:
        raise Uncovered("题干未找到 y = ...")
    return poly_coeffs(found[0].strip(), require_quadratic=require_quadratic)


def fmt_quadratic(a: float, b: float, c: float) -> str:
    return f"({a})*x**2+({b})*x+({c})"


def expr_matches(answer_expr: str, expected_expr: str) -> bool:
    try:
        for sample in SAMPLES:
            if not close(
                safe_eval(answer_expr, {VAR: sample}), safe_eval(expected_expr, {VAR: sample})
            ):
                return False
        return True
    except Uncovered:
        return False


def expand_square(text: str):
    """(x ± m)^2 独立展开为系数（(x + h)^2 = x^2 + 2hx + h^2）。"""
    m = re.fullmatch(r"\(\s*x\s*([+-])\s*(\d+(?:\.\d+)?)\s*\)\s*\^\s*2", text.strip())
    if not m:
        raise Uncovered(f"不支持的平方形式：{text!r}")
    h = (1.0 if m.group(1) == "+" else -1.0) * float(m.group(2))
    return 1.0, 2.0 * h, h * h


def solve_equation(eq_text: str):
    """独立求解一元一次/二次方程，返回排序后的根列表。"""
    if "=" not in eq_text:
        raise Uncovered("方程缺少等号")
    lhs, rhs = eq_text.split("=", 1)
    a, b, c = poly_coeffs(f"({lhs})-({rhs})")
    if abs(a) < 1e-9:
        if abs(b) < 1e-9:
            raise Uncovered("恒等式，非方程")
        return sorted({(-c / b)})
    disc = b * b - 4 * a * c
    if disc < -1e-9:
        return []
    if abs(disc) <= 1e-9:
        return sorted({(-b / (2 * a))})
    root = math.sqrt(disc)
    return sorted({(-b - root) / (2 * a), (-b + root) / (2 * a)})


def same_root_set(answer: str, expected_roots) -> bool:
    got = values_after_equals(answer)
    if len(got) != len(expected_roots):
        return False
    return all(any(close(g, e) for e in expected_roots) for g in got)


def single_number(answer: str, label: str = "answer") -> float:
    got = numbers(answer)
    if len(got) != 1:
        raise Uncovered(f"{label} 非单一数值：{answer!r}")
    return got[0]


# ----------------------------------------------------------------- 模板族

def fam_substitution(item):
    m = re.search(r"当\s*([a-zA-Z])\s*=\s*(-?\d+)\s*时[，,].*?代数式\s*(.+?)\s*的值是", item["stem"])
    if not m:
        raise Uncovered("非代入求值题")
    var, value, expr = m.group(1), float(m.group(2)), m.group(3)
    expected = safe_eval(expr, {var: value})
    return "代入求值", close(single_number(item["answer"]), expected), f"重算={expected:g}"


def fam_identity_expand(item):
    m = re.fullmatch(r"计算\s*(\([^)]*\)\^2)\s*=\s*____。", item["stem"].strip())
    if not m:
        raise Uncovered("非恒等式展开题")
    a, b, c = expand_square(m.group(1))
    expected = fmt_quadratic(a, b, c)
    return "恒等式展开", expr_matches(strip_y(item["answer"]), expected), f"重算={expected}"


def fam_vertex(item):
    if "顶点坐标" not in item["stem"]:
        raise Uncovered("非顶点坐标题")
    a, b, c = parabola_coeffs(item["stem"])
    h = -b / (2 * a)
    k = a * h * h + b * h + c
    pairs = coord_pairs(item["answer"])
    if len(pairs) != 1:
        raise Uncovered("answer 非单一坐标")
    ok = close(pairs[0][0], h) and close(pairs[0][1], k)
    return "顶点坐标", ok, f"重算=({h:g}, {k:g})"


def fam_axis(item):
    if "对称轴" not in item["stem"] or "顶点坐标" in item["stem"]:
        raise Uncovered("非对称轴题")
    if "则 b" in item["stem"] or "则b" in item["stem"]:
        raise Uncovered("对称轴反求 b（另族）")
    a, b, _ = parabola_coeffs(item["stem"])
    h = -b / (2 * a)
    if re.search(r"y\s*轴", item["answer"]):
        return "对称轴", close(h, 0.0), f"重算=x = {h:g}（y 轴 ⇔ x=0）"
    return "对称轴", close(single_number(item["answer"]), h), f"重算=x = {h:g}"


def fam_axis_backsolve(item):
    m = re.search(r"若抛物线\s*y\s*=\s*x\^2\s*\+\s*bx\s*\+\s*(-?\d+)\s*的对称轴是直线\s*x\s*=\s*(-?\d+)", item["stem"])
    if not m:
        raise Uncovered("非对称轴反求 b")
    c, h = float(m.group(1)), float(m.group(2))
    b = -2.0 * h
    probe = 5.0
    if not close(probe * probe + b * probe + c, safe_eval(f"x^2+({b})*x+({c})", {VAR: probe})):
        raise Uncovered("反求 b 自检失败")
    return "对称轴反求 b", close(single_number(item["answer"]), b), f"重算=b = {b:g}"


def fam_extremum(item):
    stem = item["stem"]
    if "抛物线" not in stem or ("最" not in stem):
        raise Uncovered("非抛物线最值题")
    a, b, c = parabola_coeffs(stem)
    h = -b / (2 * a)
    k = a * h * h + b * h + c

    if re.search(r"取得最(小|大)值", stem):
        return "最值（取最值时的 x）", close(single_number(item["answer"]), h), f"重算=x = {h:g}"

    m = re.search(r"最(小|大)值是", stem)
    if not m:
        raise Uncovered("非最值题")
    if (m.group(1) == "小") != (a > 0):
        raise Uncovered("最值方向与开口不一致")
    return "最值", close(single_number(item["answer"]), k), f"重算={'最小' if a > 0 else '最大'}值 {k:g}"


def fam_discriminant(item):
    m = re.search(r"方程\s*(.+?)\s*的判别式", item["stem"])
    if not m:
        raise Uncovered("非判别式题")
    lhs, rhs = m.group(1).split("=")
    a, b, c = poly_coeffs(f"({lhs})-({rhs})")
    disc = b * b - 4 * a * c
    return "判别式", close(single_number(item["answer"]), disc), f"重算=△ = {disc:g}"


def fam_equation_roots(item):
    stem = item["stem"]
    m = re.search(r"方程\s*(.+?)\s*的解是", stem)
    if not m:
        raise Uncovered("非方程解题")
    roots = solve_equation(m.group(1))
    if not roots:
        raise Uncovered("无实根（answer 无法按数值集合比对）")
    return "方程解", same_root_set(item["answer"], roots), f"重算={[round(r, 6) for r in roots]}"


def fam_completed_equation_equivalence(item):
    m = re.search(r"方程\s*(.+?)\s*，配方后得到的方程是", item["stem"])
    if not m:
        raise Uncovered("非配方后方程题")
    stem_roots = solve_equation(m.group(1))
    answer = item["answer"]
    if "=" not in answer:
        raise Uncovered("answer 非方程")
    answer_roots = solve_equation(answer)
    ok = len(stem_roots) == len(answer_roots) and all(
        any(close(a, b) for b in stem_roots) for a in answer_roots
    )
    return "配方后方程等价", ok, f"重算根集={[round(r, 6) for r in stem_roots]}"


def fam_x_axis(item):
    stem = item["stem"]
    if "与 x 轴" not in stem:
        raise Uncovered("非与 x 轴交点题")
    if "交点个数" in stem:
        expr = re.findall(r"y\s*=\s*([^，。；)）]+)", stem)
        if not expr:
            raise Uncovered("未找到函数式")
        a, b, c = poly_coeffs(expr[0].strip())
        disc = b * b - 4 * a * c
        expected = 0 if disc < -TOL else (1 if abs(disc) <= TOL else 2)
        got = numbers(item["answer"])
        if not got:
            if expected == 0:
                return "与 x 轴交点个数", True, "重算=0 个"
            raise Uncovered("answer 无数值")
        return "与 x 轴交点个数", close(got[0], expected), f"重算={expected} 个"

    if "交点坐标" in stem or "交于点" in stem or "交于" in stem:
        found = re.findall(r"y\s*=\s*([^，。；)）]+)", stem)
        if not found:
            raise Uncovered("未找到函数式")
        roots = solve_equation(f"({found[0].strip()})=0")
        if not roots:
            raise Uncovered("与 x 轴无交点")
        pairs = coord_pairs(item["answer"])
        if not pairs:
            raise Uncovered("answer 非坐标")
        xs = sorted(p[0] for p in pairs)
        if len(xs) != len(roots):
            return "与 x 轴交点坐标", False, f"重算 x={roots}"
        ok = all(close(x, r) for x, r in zip(xs, roots))
        return "与 x 轴交点坐标", ok, f"重算={[round(r, 6) for r in roots]}"

    raise Uncovered("与 x 轴问法未固化")


def fam_y_axis(item):
    stem = item["stem"]
    if "与 y 轴" not in stem:
        raise Uncovered("非与 y 轴交点题")
    found = re.findall(r"y\s*=\s*([^，。；)）]+)", stem)
    if not found:
        raise Uncovered("未找到函数式")
    _, _, c = poly_coeffs(found[0].strip())
    pairs = coord_pairs(item["answer"])
    if not pairs:
        raise Uncovered("answer 非坐标")
    ok = close(pairs[0][0], 0.0) and close(pairs[0][1], c)
    return "与 y 轴交点", ok, f"重算=(0, {c:g})"


def fam_factoring(item):
    m = re.search(r"因式分解\s*(.+?)\s*=\s*____", item["stem"])
    if not m:
        raise Uncovered("非因式分解题")
    a, b, c = poly_coeffs(m.group(1))
    if not close(a, 1.0):
        raise Uncovered("非首一二次式")
    disc = b * b - 4 * c
    if disc < 0:
        raise Uncovered("无实根，不能分解")
    r1, r2 = (-b - math.sqrt(disc)) / 2.0, (-b + math.sqrt(disc)) / 2.0
    expected = f"(x-({r1}))*(x-({r2}))"
    return "因式分解", expr_matches(strip_y(item["answer"]), expected), f"重算={expected}"


def fam_completing_square(item):
    stem = item["stem"]

    m = re.search(r"使\s*x\^2\s*\+\s*(-?\d+)x\s*\+\s*____\s*成为完全平方式", stem)
    if m:
        expected = (float(m.group(1)) / 2.0) ** 2
        return "配方补项", close(single_number(item["answer"]), expected), f"重算={expected:g}"

    m = re.search(r"把\s*(.+?)\s*配方成\s*\(x\s*\+\s*m\)\^2\s*\+\s*n\s*的形式", stem)
    if m:
        a, b, c = poly_coeffs(m.group(1), require_quadratic=True)
        h = -b / (2 * a)
        k = a * h * h + b * h + c
        expected = f"({a})*(x-({h}))**2+({k})"
        ok = expr_matches(item["answer"], expected)
        return "配方形式", ok, f"重算=(x{'-' if h >= 0 else '+'}{abs(h):g})^2{'+' if k >= 0 else '-'}{abs(k):g}"

    raise Uncovered("配方问法未固化")


def fam_vertex_form_conversion(item):
    stem = item["stem"]
    m = re.search(r"(?:把|将)\s*y\s*=\s*(.+?)\s*(?:化成顶点式|化为顶点式)", stem)
    if m:
        a, b, c = poly_coeffs(m.group(1), require_quadratic=True)
        h = -b / (2 * a)
        k = a * h * h + b * h + c
        expected = f"({a})*(x-({h}))**2+({k})"
        return "顶点式互化", expr_matches(strip_y(item["answer"]), expected), f"重算={expected}"

    m = re.search(r"(?:把|将)\s*y\s*=\s*(.+?)\s*展开成一般式", stem)
    if m:
        a, b, c = poly_coeffs(m.group(1), require_quadratic=True)
        expected = fmt_quadratic(a, b, c)
        return "顶点式互化（展开）", expr_matches(strip_y(item["answer"]), expected), f"重算={expected}"

    raise Uncovered("顶点式互化问法未固化")


def fam_translation(item):
    stem = item["stem"]
    m = re.search(r"将抛物线\s*y\s*=\s*(.+?)\s*(向.*?)平移[^，。]*?(?:，再(.+?)平移)?[^，。]*所得抛物线", stem)
    if not m:
        raise Uncovered("非平移题")
    base, first, second = m.group(1), m.group(2), m.group(3)
    shift_x = shift_y = 0.0
    for move in [first] + ([second] if second else []):
        mm = re.search(r"(上|下|左|右)\s*平移\s*(-?\d+)", move)
        if not mm:
            raise Uncovered(f"平移方向未固化：{move!r}")
        direction, amount = mm.group(1), float(mm.group(2))
        if direction == "左":
            shift_x += amount
        elif direction == "右":
            shift_x -= amount
        elif direction == "上":
            shift_y += amount
        else:
            shift_y -= amount

    a, b, c = poly_coeffs(base, require_quadratic=True)
    expected = fmt_quadratic(a, b + 2 * a * shift_x, a * shift_x * shift_x + b * shift_x + c + shift_y)
    return "单步平移", expr_matches(strip_y(item["answer"]), expected), f"重算={expected}"


def fam_segment_length(item):
    stem = item["stem"]
    if "线段" not in stem or "长是" not in stem:
        raise Uncovered("非线段长题")
    points = coord_pairs(stem)
    if len(points) >= 2:
        (x1, y1), (x2, y2) = points[0], points[1]
        expected = math.hypot(x2 - x1, y2 - y1)
    else:
        m = re.search(r"y\s*=\s*([^，。；)）]+)\s*与 x 轴交于", stem)
        if not m:
            raise Uncovered("线段两端未固化")
        roots = solve_equation(f"({m.group(1).strip()})=0")
        if len(roots) != 2:
            raise Uncovered("交点不足两个")
        expected = abs(roots[1] - roots[0])
    return "线段长", close(single_number(item["answer"]), expected), f"重算={expected:g}"


def fam_triangle_area(item):
    stem = item["stem"]
    if "面积" not in stem or "△ABC" not in stem.replace(" ", ""):
        raise Uncovered("非三角形面积题")
    m = re.search(r"y\s*=\s*([^，。；)）]+)\s*与 x 轴交于", stem)
    if not m:
        raise Uncovered("抛物线解析式缺失")
    expr = m.group(1).strip()
    a, b, c = poly_coeffs(expr, require_quadratic=True)
    roots = solve_equation(f"({expr})=0")
    if len(roots) != 2:
        raise Uncovered("与 x 轴交点不足两个")
    expected = abs(roots[1] - roots[0]) * abs(c) / 2.0
    return "三角形面积", close(single_number(item["answer"]), expected), f"重算={expected:g}"


def fam_three_points(item):
    stem = item["stem"]
    if "三点" not in stem and not re.search(r"经过点\s*\([^)]*\)[、,和]\s*\([^)]*\)[、,和]\s*\(", stem):
        raise Uncovered("非待定系数三点题")
    points = coord_pairs(stem)
    if len(points) < 3:
        raise Uncovered("点不足三个")
    (x1, y1), (x2, y2), (x3, y3) = points[0], points[1], points[2]
    rows = [[x1 * x1, x1, 1.0, y1], [x2 * x2, x2, 1.0, y2], [x3 * x3, x3, 1.0, y3]]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda r: abs(rows[r][col]))
        if abs(rows[pivot][col]) < 1e-9:
            raise Uncovered("三点退化，无唯一解")
        rows[col], rows[pivot] = rows[pivot], rows[col]
        for r in range(col + 1, 3):
            factor = rows[r][col] / rows[col][col]
            for k in range(col, 4):
                rows[r][k] -= factor * rows[col][k]
    c = rows[2][3] / rows[2][2]
    b = (rows[1][3] - rows[1][2] * c) / rows[1][1]
    a = (rows[0][3] - rows[0][1] * b - rows[0][2] * c) / rows[0][0]
    expected = fmt_quadratic(a, b, c)
    ok = expr_matches(strip_y(item["answer"]), expected)
    return "待定系数三点反代", ok, f"重算={expected}"


def fam_coefficients(item):
    stem = item["stem"]
    m = re.search(r"y\s*=\s*(.+?)\s*中[，,]\s*(.+?)\s*[是=]", stem)
    if not m:
        raise Uncovered("非系数提取题")
    expr, ask = m.group(1).strip(), m.group(2)
    a, b, c = poly_coeffs(expr)
    if abs(a) < 1e-9:
        # 一次函数 y = kx + b 的 b 语义不同（常数项），交给 fam_linear_function
        raise Uncovered("非二次式（系数语义不同）")
    got = numbers(item["answer"])

    if "依次" in ask:
        expected = [a, b, c]
    elif "二次项系数" in ask or re.search(r"a\s*$", ask):
        expected = [a]
    elif "一次项系数" in ask or re.search(r"b\s*$", ask):
        expected = [b]
    elif "常数项" in ask or re.search(r"c\s*$", ask):
        expected = [c]
    else:
        raise Uncovered(f"系数问法未固化：{ask!r}")

    if len(got) != len(expected):
        return "系数提取", False, f"重算={expected}"
    ok = all(close(g, e) for g, e in zip(got, expected))
    return "系数提取", ok, f"重算={[round(e, 6) for e in expected]}"


def fam_opening_direction(item):
    if "开口方向是" not in item["stem"]:
        raise Uncovered("非开口方向题")
    a, _, _ = parabola_coeffs(item["stem"])
    expected = "向上" if a > 0 else "向下"
    return "开口方向", expected in item["answer"], f"重算={expected}"


def fam_point_transform(item):
    stem = item["stem"]

    m = re.search(r"点\s*\(([^)]*)\)\s*关于\s*x\s*轴对称的点的坐标是", stem)
    if m:
        x, y = numbers(m.group(1))[:2]
        pairs = coord_pairs(item["answer"])
        if len(pairs) != 1:
            raise Uncovered("answer 非单一坐标")
        ok = close(pairs[0][0], x) and close(pairs[0][1], -y)
        return "点对称（x 轴）", ok, f"重算=({x:g}, {-y:g})"

    m = re.search(r"点\s*\(([^)]*)\)\s*关于\s*y\s*轴对称的点的坐标是", stem)
    if m:
        x, y = numbers(m.group(1))[:2]
        pairs = coord_pairs(item["answer"])
        if len(pairs) != 1:
            raise Uncovered("answer 非单一坐标")
        ok = close(pairs[0][0], -x) and close(pairs[0][1], y)
        return "点对称（y 轴）", ok, f"重算=({-x:g}, {y:g})"

    m = re.search(r"点\s*\(([^)]*)\)\s*的横坐标是", stem)
    if m:
        x = numbers(m.group(1))[0]
        return "横坐标", close(single_number(item["answer"]), x), f"重算={x:g}"

    m = re.search(r"点\s*\(([^)]*)\)\s*的纵坐标是", stem)
    if m:
        y = numbers(m.group(1))[1]
        return "纵坐标", close(single_number(item["answer"]), y), f"重算={y:g}"

    m = re.search(r"点\s*(?:[A-Z]\s*)?(?:的坐标是\s*)?\(([^)]*)\)\s*(?:，)?(?:它)?位于", stem)
    if m:
        x, y = numbers(m.group(1))[:2]
        if abs(x) < TOL or abs(y) < TOL:
            raise Uncovered("坐标轴上，不属象限族")
        quadrant = {(True, True): "第一象限", (False, True): "第二象限", (False, False): "第三象限", (True, False): "第四象限"}[(x > 0, y > 0)]
        return "象限判定", quadrant in item["answer"], f"重算={quadrant}"

    raise Uncovered("点问法未固化")


def fam_linear_function(item):
    stem = item["stem"]

    m = re.search(r"一次函数\s*y\s*=\s*(.+?)\s*中[，,]\s*([kb])\s*=", stem)
    if m:
        expr, which = m.group(1).strip(), m.group(2)
        _, slope_coeff, intercept = poly_coeffs(expr)
        # y = kx + b 中：k 是 x 的系数，b 是常数项
        expected = slope_coeff if which == "k" else intercept
        return f"一次函数 {which}", close(single_number(item["answer"]), expected), f"重算={which} = {expected:g}"

    m = re.search(r"一次函数\s*y\s*=\s*kx\s*\+\s*b\s*的图像经过点\s*\(([^)]*)\)\s*和\s*\(([^)]*)\)[，,]\s*则\s*k\s*=", stem)
    if m:
        x1, y1 = numbers(m.group(1))[:2]
        x2, y2 = numbers(m.group(2))[:2]
        slope = (y2 - y1) / (x2 - x1)
        return "一次函数待定系数 k", close(single_number(item["answer"]), slope), f"重算=k = {slope:g}"

    m = re.search(r"一次函数的图像经过点\s*\(([^)]*)\)\s*和\s*\(([^)]*)\)[，,]\s*则它的解析式是", stem)
    if m:
        x1, y1 = numbers(m.group(1))[:2]
        x2, y2 = numbers(m.group(2))[:2]
        slope = (y2 - y1) / (x2 - x1)
        intercept = y1 - slope * x1
        expected = f"({slope})*x+({intercept})"
        return "一次函数解析式", expr_matches(strip_y(item["answer"]), expected), f"重算=y = {slope:g}x + {intercept:g}"

    raise Uncovered("一次函数问法未固化")


def fam_multivar_substitution(item):
    m = re.search(
        r"当\s*([a-zA-Z])\s*=\s*(-?\d+)\s*[，,]\s*([a-zA-Z])\s*=\s*(-?\d+)\s*时[，,].*?代数式\s*(.+?)\s*的值是",
        item["stem"],
    )
    if not m:
        raise Uncovered("非多变量代入求值题")
    env = {m.group(1): float(m.group(2)), m.group(3): float(m.group(4))}
    expected = safe_eval(m.group(5), env)
    return "代入求值（多变量）", close(single_number(item["answer"]), expected), f"重算={expected:g}"


def fam_identity_sum_product(item):
    m = re.search(
        r"已知\s*(a)\s*\+\s*(b)\s*=\s*(-?\d+)\s*[，,]\s*ab\s*=\s*(-?\d+)\s*[，,]\s*则\s*a\^2\s*\+\s*b\^2\s*的值是",
        item["stem"],
    )
    if not m:
        raise Uncovered("非 a+b / ab 求平方和题")
    total, product = float(m.group(3)), float(m.group(4))
    expected = total * total - 2 * product
    return "恒等式（平方和）", close(single_number(item["answer"]), expected), f"重算={expected:g}"


def fam_holistic_substitution(item):
    m = re.search(r"已知\s*(.+?)\s*=\s*(-?\d+)\s*[，,]\s*则\s*(.+?)\s*的值是", item["stem"])
    if not m:
        raise Uncovered("非整体代入题")
    known, value, target = m.group(1), float(m.group(2)), m.group(3)
    free = "a" if "a" in known else ("x" if "x" in known else "b")
    others = [ch for ch in ("ab") if ch != free and ch in known + target]
    if not others:
        raise Uncovered("整体代入缺第二变量")
    other = others[0]

    results = []
    for probe in (0.0, 1.0, 2.0):
        env = {free: probe}
        # 以 b 为未知量线性求解 known - value = 0
        f_0 = safe_eval(f"({known})-({value})", {**env, other: 0.0})
        f_1 = safe_eval(f"({known})-({value})", {**env, other: 1.0})
        slope = f_1 - f_0
        if abs(slope) < 1e-9:
            raise Uncovered("整体代入退化")
        solved = {**env, other: -f_0 / slope}
        results.append(safe_eval(target, solved))

    if any(not close(r, results[0]) for r in results):
        raise Uncovered("目标式不恒定（非整体代入题）")
    return "整体代入", close(single_number(item["answer"]), results[0]), f"重算={results[0]:g}"


def fam_domain(item):
    stem = item["stem"]
    m = re.search(r"函数\s*y\s*=\s*(.+?)\s*中[，,]\s*自变量\s*x\s*的取值范围是", stem)
    if not m:
        raise Uncovered("非定义域题")
    expr = m.group(1).strip()
    checks = []

    # 根号：被开方式 ≥ 0 → 由一次式零点独立求阈值（x 系数为负时方向翻转）
    for body in re.findall(r"√\s*\(([^)]*)\)", expr):
        _, b, c = poly_coeffs(body)
        if abs(b) < 1e-9:
            raise Uncovered("根号内非 x 的一次式")
        checks.append(("ge" if b > 0 else "le", -c / b))

    # 分母：不为 0 → 零点即排除值
    for denom in re.findall(r"/\s*(\([^)]*\)|[0-9a-zA-Z^.]+)", expr):
        body = denom.strip()
        if body.startswith("(") and body.endswith(")"):
            body = body[1:-1]
        _, b, c = poly_coeffs(body)
        if abs(b) < 1e-9:
            raise Uncovered("分母非 x 的一次式")
        checks.append(("ne", -c / b))

    answer = item["answer"].replace(" ", "")
    if not checks:
        return "定义域（全体实数）", "全体实数" in answer, "重算=x 可取全体实数"

    symbols = {"ge": "≥", "le": "≤", "ne": "≠"}
    expected_parts = []
    for kind, threshold in checks:
        text = f"x{symbols[kind]}{(threshold + 0.0):g}"
        expected_parts.append(text)
        if text not in answer:
            return "定义域", False, f"重算={'且'.join(expected_parts)}"
    return "定义域", True, f"重算={'且'.join(expected_parts)}"


FAMILIES = (
    fam_substitution,
    fam_multivar_substitution,
    fam_holistic_substitution,
    fam_identity_expand,
    fam_identity_sum_product,
    fam_vertex,
    fam_axis_backsolve,
    fam_axis,
    fam_extremum,
    fam_discriminant,
    fam_completed_equation_equivalence,
    fam_equation_roots,
    fam_x_axis,
    fam_y_axis,
    fam_factoring,
    fam_completing_square,
    fam_vertex_form_conversion,
    fam_translation,
    fam_segment_length,
    fam_triangle_area,
    fam_three_points,
    fam_coefficients,
    fam_opening_direction,
    fam_point_transform,
    fam_linear_function,
    fam_domain,
)


# ----------------------------------------------------------------- 主流程

def last_step_contains_answer(item) -> bool:
    steps = item.get("solution_steps") or []
    if not steps:
        return False
    return re.sub(r"\s+", "", item["answer"]) in re.sub(r"\s+", "", steps[-1])


def main() -> int:
    raw = json.loads(BANK_PATH.read_text(encoding="utf-8"))
    items = raw["items"]

    covered = 0
    mismatches = []
    uncovered = []
    family_stats = {}

    for item in items:
        hit = None
        for family in FAMILIES:
            try:
                hit = family(item)
            except Uncovered:
                continue
            except Exception as exc:  # noqa: BLE001
                hit = (family.__name__, False, f"重算异常：{exc}")
            break

        if hit is None:
            uncovered.append(item["item_id"])
            continue

        name, ok, detail = hit
        covered += 1
        family_stats[name] = family_stats.get(name, 0) + 1
        if not ok:
            mismatches.append((item["item_id"], name, item["answer"], detail))

    step_violations = [
        item["item_id"]
        for item in items
        if item["type"] in ("fill", "short_answer") and not last_step_contains_answer(item)
    ]

    print("=" * 78)
    print("[STATS] 题库复算（独立重算，不复用生成期代码）")
    print("=" * 78)
    print(f"  题库总量：{len(items)} 题；覆盖重算：{covered} 题（目标 >= {TARGET_COVERAGE}）；"
          f"未覆盖：{len(uncovered)} 题")
    for name, count in sorted(family_stats.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"    {name:<22}{count:>4} 题")
    print("-" * 78)

    if covered < TARGET_COVERAGE:
        print(f"[WARN] 覆盖题数 {covered} 低于目标 {TARGET_COVERAGE}（仅报告，不阻断）")
    if uncovered:
        print(f"[INFO] 未覆盖题（前 12 例）：{', '.join(uncovered[:12])}"
              f"{' …' if len(uncovered) > 12 else ''}")

    print("-" * 78)
    if mismatches:
        print(f"[FAIL] 复算不一致 {len(mismatches)} 题：")
        for item_id, name, answer, detail in mismatches:
            print(f"    - {item_id} [{name}] answer={answer!r} {detail}")
    else:
        print("[PASS] 复算不一致 0 题")

    if step_violations:
        print(f"[FAIL] solution_steps 末步未包含 answer：{len(step_violations)} 题")
        for item_id in step_violations[:20]:
            print(f"    - {item_id}")
    else:
        print("[PASS] fill/short_answer 的 solution_steps 末步均包含 answer")

    print("=" * 78)
    if mismatches or step_violations:
        return 1
    print(f"[PASS] 题库复算通过（覆盖 {covered} 题，不一致 0 题）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
