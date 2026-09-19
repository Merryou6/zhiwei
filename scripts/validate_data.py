#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""知微 · 静态数据校验闸门（DATA_SCHEMA §6，CI 必跑）

覆盖 DATA_SCHEMA §6 全部 6 项校验：
  1 图谱：id 唯一 / 引用存在 / prerequisites 与 successors 互逆 / DAG 无环
  2 typical_errors.error_type ∈ 五类枚举；每节点 ≥3 条
  3 题库：item_id 全局唯一（双池天然零重叠）/ kp 引用存在 / pool 合法
  4 每知识点 train ≥5、retest ≥6
  5 distractors.typical_error_code 存在于该 kp 的 typical_errors
  6 输出统计报告：节点数 / 错误条数 / 题数 / 各池配额

附加校验（计划 步骤 4 授权，超出 §6 但低成本）：
  a params.json 存在且含 §0 全部 17 键（阻断）
  b train 池难度覆盖 1–5（警告不阻断）
  c sample_items 引用存在（阻断）
  d 题型枚举 type ∈ {choice,fill,short_answer}；choice 必有 options，其余 options=null（阻断）
  e difficulty ∈ 1–5（阻断）

仅使用 Python 标准库（json/re/sys/os/argparse/pathlib），零 pip 依赖。
用法：python3 scripts/validate_data.py [--root <仓库根>] [--json <报告输出路径>]
退出码：0 全过；1 有阻断项失败（脚本会打印全部错误后再退出）
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- 常量规格

ERROR_TYPES = (
    "prerequisite_gap",
    "concept_confusion",
    "method_gap",
    "procedural_slip",
    "misreading",
)

POOLS = ("train", "retest")
ITEM_TYPES = ("choice", "fill", "short_answer")
SOURCE_TYPES = ("direct", "derived")

TRAIN_MIN = 5
RETEST_MIN = 6

ITEM_ID_RE = re.compile(r"^q_cz_[a-z0-9_]+_\d{3}$")

# ALGORITHM §0 参数总表（17 项）
PARAM_KEYS = {
    "P_S": float,
    "P_G": float,
    "P_T": float,
    "W_DIAGNOSE": float,
    "W_PAPER": float,
    "ALPHA_SILENT": float,
    "PRIOR_MAP": dict,
    "PRUNE_THRESHOLD": float,
    "EXIT_UPSTREAM_THRESHOLD": float,
    "SUSPECT_BASE": float,
    "MAX_DEPTH": int,
    "MAX_EXIT_HOPS": int,
    "CONF_ADOPT": float,
    "CONSEC_FALSE_EXIT": int,
    "MAX_ITEMS": int,
    "CONV_VAR": float,
    "CLAMP": list,
}

NODE_REQUIRED_FIELDS = (
    "id",
    "name",
    "subject",
    "stage",
    "grade",
    "chapter",
    "difficulty",
    "source",
    "prerequisites",
    "prerequisite_basis",
    "successors",
    "typical_errors",
    "sample_items",
)

META_REQUIRED_FIELDS = ("subject", "stage", "version", "primary_standard")


# ---------------------------------------------------------------- 报告器


class Report:
    """收集阻断错误与警告，统一输出 [PASS]/[FAIL]/[WARN]。"""

    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def section(self, index: str, title: str, collected: list[str]) -> None:
        if collected:
            print(f"[FAIL] 校验 {index} {title}：{len(collected)} 项问题")
            for m in collected:
                print(f"        - {m}")
        else:
            print(f"[PASS] 校验 {index} {title}")


# ---------------------------------------------------------------- 载入


def load_json(path: Path):
    """读取 JSON；文件缺失或语法错误直接抛出，由 main 统一处理。"""
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def find_knowledge_file(root: Path) -> Path:
    """经 data/knowledge/index.json 定位知识图谱文件（§2.1 路由约定）。"""
    index_path = root / "data" / "knowledge" / "index.json"
    index = load_json(index_path)
    subjects = index.get("subjects") or []
    for subject in subjects:
        for stage in subject.get("stages") or []:
            rel = stage.get("file")
            if rel:
                return root / rel
    raise ValueError("index.json 中未找到任何 stages[].file 指向的知识库文件")


# ---------------------------------------------------------------- 校验 1：图谱结构


def check_graph_structure(nodes: list, rep: Report) -> list[str]:
    errs: list[str] = []
    ids: list[str] = []
    seen: set[str] = set()

    for i, node in enumerate(nodes):
        where = f"nodes[{i}]"
        for field in NODE_REQUIRED_FIELDS:
            if field not in node:
                errs.append(f"{where} 缺字段 {field}")
        nid = node.get("id")
        if not isinstance(nid, str) or not nid:
            errs.append(f"{where} id 非法：{nid!r}")
            continue
        if nid in seen:
            errs.append(f"id 重复：{nid}")
        seen.add(nid)
        ids.append(nid)
        if not nid.startswith("math.cz."):
            errs.append(f"{nid} id 前缀不符合 math.cz.{{chapter}}.{{point}}")

    id_set = set(ids)

    # 引用存在 + 互逆
    prereq_map: dict[str, list[str]] = {}
    succ_map: dict[str, list[str]] = {}
    for node in nodes:
        nid = node.get("id")
        if not isinstance(nid, str):
            continue
        prereq = node.get("prerequisites")
        succ = node.get("successors")
        if not isinstance(prereq, list) or not isinstance(succ, list):
            errs.append(f"{nid} prerequisites/successors 必须为数组")
            continue
        prereq_map[nid] = prereq
        succ_map[nid] = succ
        for p in prereq:
            if p not in id_set:
                errs.append(f"{nid}.prerequisites 引用不存在：{p}")
        for s in succ:
            if s not in id_set:
                errs.append(f"{nid}.successors 引用不存在：{s}")
        # 自环
        if nid in prereq or nid in succ:
            errs.append(f"{nid} 存在自环（自身出现在先修/后继）")

    # 互逆校验：A.prerequisites 含 B ⇔ B.successors 含 A
    for nid, prereq in prereq_map.items():
        for p in prereq:
            if p in succ_map and nid not in succ_map[p]:
                errs.append(f"互逆失败：{nid} 的先修 {p} 的 successors 未包含 {nid}")
    for nid, succ in succ_map.items():
        for s in succ:
            if s in prereq_map and nid not in prereq_map[s]:
                errs.append(f"互逆失败：{nid} 的后继 {s} 的 prerequisites 未包含 {nid}")

    # DAG 无环（DFS 染色）
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {nid: WHITE for nid in prereq_map}
    cycle_report: list[str] = []

    def dfs(start: str) -> None:
        stack: list[tuple[str, int]] = [(start, 0)]
        path: list[str] = []
        while stack:
            nid, idx = stack.pop()
            if idx == 0:
                color[nid] = GRAY
                path.append(nid)
            children = prereq_map.get(nid, [])
            if idx < len(children):
                stack.append((nid, idx + 1))
                child = children[idx]
                if child not in color:
                    continue
                if color[child] == GRAY:
                    cycle_report.append(" -> ".join(path + [child]))
                elif color[child] == WHITE:
                    stack.append((child, 0))
            else:
                color[nid] = BLACK
                if path:
                    path.pop()

    for nid in prereq_map:
        if color[nid] == WHITE:
            dfs(nid)
    if cycle_report:
        errs.append(f"DAG 成环：{'；'.join(cycle_report[:5])}")

    node_index = {n.get("id"): n for n in nodes}
    return errs, node_index


def check_graph_meta(meta: dict) -> list[str]:
    return [f"图谱 meta 缺字段 {field}" for field in META_REQUIRED_FIELDS if field not in meta]


# ---------------------------------------------------------------- 校验 2：典型错误


def check_typical_errors(nodes: list, rep: Report) -> tuple[list[str], int]:
    errs: list[str] = []
    total = 0
    global_types: set[str] = set()
    for node in nodes:
        nid = node.get("id", "<unknown>")
        tes = node.get("typical_errors")
        if not isinstance(tes, list):
            errs.append(f"{nid} typical_errors 必须为数组")
            continue
        if len(tes) < 3:
            errs.append(f"{nid} typical_errors 仅 {len(tes)} 条，要求 ≥3（规格 3–5）")
        elif len(tes) > 5:
            rep.warn(f"{nid} typical_errors 有 {len(tes)} 条，规格建议 3–5 条")
        total += len(tes)
        codes: set[str] = set()
        types_here: set[str] = set()
        for te in tes:
            if not isinstance(te, dict):
                errs.append(f"{nid} typical_errors 元素必须为对象")
                continue
            code = te.get("code")
            etype = te.get("error_type")
            if not isinstance(code, str) or not code:
                errs.append(f"{nid} typical_errors[].code 缺失或非法")
            elif code in codes:
                errs.append(f"{nid} typical_errors code 节点内重复：{code}")
            else:
                codes.add(code)
            if not isinstance(code, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", code or ""):
                errs.append(f"{nid} code 非小写蛇形：{code!r}")
            if etype not in ERROR_TYPES:
                errs.append(f"{nid}.{code} error_type 非法：{etype!r}")
            else:
                types_here.add(etype)
                global_types.add(etype)
            for f in ("desc", "remedy"):
                v = te.get(f)
                if not isinstance(v, str) or not v.strip():
                    errs.append(f"{nid}.{code} {f} 缺失或为空")
        if len(types_here) < 2:
            errs.append(f"{nid} error_type 仅覆盖 {len(types_here)} 种，要求每节点 ≥2 种")
    missing = [t for t in ERROR_TYPES if t not in global_types]
    if missing:
        errs.append(f"全图谱未覆盖 error_type：{missing}")
    return errs, total


# ---------------------------------------------------------------- 校验 3：题库结构


def check_item_bank(items: list, node_index: dict, rep: Report) -> list[str]:
    errs: list[str] = []
    seen_ids: set[str] = set()
    for i, it in enumerate(items):
        where = f"items[{i}]"
        item_id = it.get("item_id")
        if not isinstance(item_id, str) or not item_id:
            errs.append(f"{where} item_id 缺失或非法")
        else:
            where = item_id
            if item_id in seen_ids:
                errs.append(f"item_id 全局重复（双池重叠）：{item_id}")
            seen_ids.add(item_id)
            if not ITEM_ID_RE.match(item_id):
                errs.append(f"{where} item_id 不符合 q_cz_{{kp短名}}_{{三位序号}}")

        kp = it.get("knowledge_point")
        if kp not in node_index:
            errs.append(f"{where} knowledge_point 引用不存在：{kp!r}")
        if it.get("pool") not in POOLS:
            errs.append(f"{where} pool 非法：{it.get('pool')!r}")
        itype = it.get("type")
        if itype not in ITEM_TYPES:
            errs.append(f"{where} type 非法：{itype!r}")
        difficulty = it.get("difficulty")
        if not isinstance(difficulty, int) or isinstance(difficulty, bool) or not 1 <= difficulty <= 5:
            errs.append(f"{where} difficulty 非法（要求 1–5 整数）：{difficulty!r}")

        stem = it.get("stem")
        if not isinstance(stem, str) or not stem.strip():
            errs.append(f"{where} stem 缺失或为空")
        answer = it.get("answer")
        if not isinstance(answer, str) or not answer.strip():
            errs.append(f"{where} answer 缺失或为空（R1：answer 必填非空）")

        steps = it.get("solution_steps")
        if not isinstance(steps, list) or not steps:
            errs.append(f"{where} solution_steps 缺失或为空（R1：必填非空）")
        else:
            for k, s in enumerate(steps):
                if not isinstance(s, str) or not s.strip():
                    errs.append(f"{where} solution_steps[{k}] 非法或为空")

        options = it.get("options")
        if itype == "choice":
            if not isinstance(options, list) or len(options) < 2:
                errs.append(f"{where} choice 题必须给出 ≥2 个 options")
            elif len(options) != 4:
                rep.warn(f"{where} choice 题 options 为 {len(options)} 个（规格建议 4 个）")
            else:
                if any(not isinstance(o, str) or not o.strip() for o in options):
                    errs.append(f"{where} options 含空项")
            if isinstance(answer, str) and isinstance(options, list) and answer not in options:
                errs.append(f"{where} answer 不在 options 中（选择题答案须为选项之一）")
        else:
            if options is not None:
                errs.append(f"{where} 非 choice 题 options 必须为 null，实际：{options!r}")

        distractors = it.get("distractors")
        if distractors is not None and not isinstance(distractors, list):
            errs.append(f"{where} distractors 必须为数组或 null")
        if isinstance(distractors, list):
            for d in distractors:
                if not isinstance(d, dict):
                    errs.append(f"{where} distractors 元素必须为对象")
                    continue
                for f in ("answer", "typical_error_code", "explanation"):
                    v = d.get(f)
                    if not isinstance(v, str) or not v.strip():
                        errs.append(f"{where} distractor.{f} 缺失或为空")
                if isinstance(answer, str) and d.get("answer") == answer:
                    errs.append(f"{where} distractor 答案与标准答案相同：{d.get('answer')!r}")
    return errs


# ---------------------------------------------------------------- 校验 4：配额


def check_quota(items: list, nodes: list, rep: Report) -> list[str]:
    errs: list[str] = []
    stat = pool_stats(items, nodes)
    for node in nodes:
        nid = node.get("id")
        if nid not in stat:
            errs.append(f"{nid} 题库无任何题目")
            continue
        train = stat[nid]["train"]
        retest = stat[nid]["retest"]
        if train < TRAIN_MIN:
            errs.append(f"{nid} train 题量 {train} < {TRAIN_MIN}")
        if retest < RETEST_MIN:
            errs.append(f"{nid} retest 题量 {retest} < {RETEST_MIN}")
    total = len(items)
    if total < 220:
        errs.append(f"题库总量 {total} < 220（PRD 红线）")
    return errs


# ---------------------------------------------------------------- 校验 5：干扰项绑定


def check_distractors(items: list, nodes: list, rep: Report) -> list[str]:
    errs: list[str] = []
    code_map = {
        n.get("id"): {te.get("code") for te in (n.get("typical_errors") or []) if isinstance(te, dict)}
        for n in nodes
    }
    for it in items:
        item_id = it.get("item_id", "<no-id>")
        kp = it.get("knowledge_point")
        valid = code_map.get(kp, set())
        for d in it.get("distractors") or []:
            if not isinstance(d, dict):
                continue
            code = d.get("typical_error_code")
            if code not in valid:
                errs.append(
                    f"{item_id} distractor 绑定 {code!r} 不存在于 {kp} 的 typical_errors"
                )
    return errs


# ---------------------------------------------------------------- 附加校验


def check_params(root: Path, rep: Report) -> list[str]:
    errs: list[str] = []
    path = root / "config" / "params.json"
    if not path.exists():
        return [f"config/params.json 不存在：{path}"]
    try:
        data = load_json(path)
    except Exception as exc:  # noqa: BLE001
        return [f"config/params.json 解析失败：{exc}"]
    if not isinstance(data, dict):
        return ["config/params.json 顶层必须为对象"]
    missing = sorted(set(PARAM_KEYS) - set(data))
    extra = sorted(set(data) - set(PARAM_KEYS))
    if missing:
        errs.append(f"params.json 缺少 ALGORITHM §0 键：{missing}")
    if extra:
        errs.append(f"params.json 存在 §0 之外的键（禁止硬编码副参数）：{extra}")
    for key, expected in PARAM_KEYS.items():
        if key not in data:
            continue
        value = data[key]
        if expected is float and (not isinstance(value, (int, float)) or isinstance(value, bool)):
            errs.append(f"params.{key} 应为数值，实际 {type(value).__name__}")
        elif expected is int and (not isinstance(value, int) or isinstance(value, bool)):
            errs.append(f"params.{key} 应为整数，实际 {type(value).__name__}")
        elif expected is dict and not isinstance(value, dict):
            errs.append(f"params.{key} 应为对象，实际 {type(value).__name__}")
        elif expected is list and not isinstance(value, list):
            errs.append(f"params.{key} 应为数组，实际 {type(value).__name__}")
    prior = data.get("PRIOR_MAP")
    if isinstance(prior, dict):
        if sorted(prior) != ["1", "2", "3", "4", "5"]:
            errs.append(f"params.PRIOR_MAP 键应为字符串 '1'–'5'，实际 {sorted(prior)}")
    clamp = data.get("CLAMP")
    if isinstance(clamp, list) and (len(clamp) != 2 or clamp[0] >= clamp[1]):
        errs.append(f"params.CLAMP 应为 [下界, 上界] 且下界<上界，实际 {clamp}")
    return errs


def check_sample_items(nodes: list, item_ids: set[str], rep: Report) -> list[str]:
    errs: list[str] = []
    for node in nodes:
        nid = node.get("id")
        for ref in node.get("sample_items") or []:
            if ref not in item_ids:
                errs.append(f"{nid}.sample_items 引用不存在：{ref}")
    return errs


def check_bank_consistency(nodes: list, items: list, rep: Report) -> None:
    """警告级：train 池难度覆盖 1–5。"""
    stat = pool_stats(items, nodes)
    for node in nodes:
        nid = node.get("id")
        diffs = stat.get(nid, {}).get("train_difficulties", set())
        missing = sorted(set(range(1, 6)) - set(diffs))
        if missing:
            rep.warn(f"{nid} train 池缺难度档 {missing}（§6 未列为阻断项）")


def check_node_style(nodes: list) -> list[str]:
    """节点分类字段与课标来源的一致性检查（阻断）。"""
    errs: list[str] = []
    for node in nodes:
        nid = node.get("id")
        src = node.get("source")
        if not isinstance(src, dict):
            errs.append(f"{nid} source 必须为对象")
            continue
        for f in ("standard", "item", "type"):
            v = src.get(f)
            if not isinstance(v, str) or not v.strip():
                errs.append(f"{nid} source.{f} 缺失或为空")
        if src.get("type") not in SOURCE_TYPES:
            errs.append(f"{nid} source.type 非法：{src.get('type')!r}")
        if src.get("standard") != "义务教育数学课程标准（2022年版）":
            errs.append(f"{nid} source.standard 应固定为『义务教育数学课程标准（2022年版）』")
        if node.get("prerequisite_basis") != "教材章节顺序 + 学科逻辑推导，非课标直接规定":
            errs.append(f"{nid} prerequisite_basis 文案与规格不一致")
        d = node.get("difficulty")
        if not isinstance(d, int) or isinstance(d, bool) or not 1 <= d <= 5:
            errs.append(f"{nid} difficulty 非法：{d!r}")
    return errs


# ---------------------------------------------------------------- 统计


def pool_stats(items: list, nodes: list) -> dict:
    stat: dict[str, dict] = {
        n.get("id"): {"train": 0, "retest": 0, "train_difficulties": set(), "retest_difficulties": set()}
        for n in nodes
    }
    for it in items:
        nid = it.get("knowledge_point")
        if nid not in stat:
            continue
        pool = it.get("pool")
        if pool in POOLS:
            stat[nid][pool] += 1
            d = it.get("difficulty")
            if isinstance(d, int):
                stat[nid][f"{pool}_difficulties"].add(d)
    return stat


def report_stats(nodes: list, items: list, error_total: int) -> None:
    stat = pool_stats(items, nodes)
    train_total = sum(v["train"] for v in stat.values())
    retest_total = sum(v["retest"] for v in stat.values())

    print("")
    print("=" * 78)
    print("[STATS] 校验 6 · 静态数据统计报告")
    print("=" * 78)
    print(f"  知识图谱：节点数 = {len(nodes)}；typical_errors 总条数 = {error_total}")
    print(f"  题库总量：{len(items)} 题（train {train_total} + retest {retest_total}）")
    print(f"  配额下限：每 kp train >= {TRAIN_MIN}、retest >= {RETEST_MIN}；总量 >= 220")
    print("-" * 78)
    print(f"  {'知识点 id':<44}{'train':>7}{'retest':>8}   合计")
    print("-" * 78)
    for node in nodes:
        nid = node.get("id", "<unknown>")
        v = stat.get(nid, {"train": 0, "retest": 0})
        print(f"  {nid:<44}{v['train']:>7}{v['retest']:>8}   {v['train'] + v['retest']:>4}")
    print("-" * 78)
    print(f"  {'合计':<44}{train_total:>7}{retest_total:>8}   {len(items):>4}")
    print("=" * 78)


# ---------------------------------------------------------------- main


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="知微静态数据校验（DATA_SCHEMA §6）")
    parser.add_argument(
        "--root",
        default=str(Path(__file__).resolve().parent.parent),
        help="仓库根目录（默认取本脚本上级目录）",
    )
    parser.add_argument("--json", dest="json_out", default=None, help="可选：统计报告另存为 JSON")
    args = parser.parse_args(argv)

    root = Path(args.root).resolve()
    rep = Report()

    # ---- 附加 a：params.json（阻断）
    param_errs = check_params(root, rep)
    rep.section("附加a", "params.json 参数表（ALGORITHM §0 全部 17 键）", param_errs)

    # ---- 载入数据（缺文件即阻断退出）
    try:
        knowledge_path = find_knowledge_file(root)
    except Exception as exc:  # noqa: BLE001
        print(f"[FAIL] 载入知识库索引失败：{exc}")
        return 1
    if not knowledge_path.exists():
        print(f"[FAIL] 知识图谱文件不存在：{knowledge_path}")
        return 1
    graph = load_json(knowledge_path)

    nodes = graph.get("nodes")
    if not isinstance(nodes, list) or not nodes:
        print(f"[FAIL] {knowledge_path} 的 nodes 缺失或为空")
        return 1

    bank_path = root / "data" / "item_bank" / "math" / "cz.json"
    items: list = []
    if bank_path.exists():
        bank = load_json(bank_path)
        items = bank.get("items") or []
        if not isinstance(items, list):
            print(f"[FAIL] {bank_path} 的 items 必须为数组")
            return 1
    else:
        print(f"[FAIL] 题库文件不存在：{bank_path}")
        return 1

    # ---- 校验 1：图谱结构（阻断）
    graph_errs, node_index = check_graph_structure(nodes, rep)
    graph_errs += check_graph_meta(graph.get("meta") or {})
    graph_errs += check_node_style(nodes)
    rep.section("1", "图谱结构（id 唯一 / 引用存在 / prereq-succ 互逆 / DAG 无环；阻断）", graph_errs)

    # ---- 校验 2：典型错误（阻断）
    te_errs, error_total = check_typical_errors(nodes, rep)
    rep.section("2", "typical_errors（五类枚举 / 每节点 ≥3 条；阻断）", te_errs)

    # ---- 校验 3：题库结构（阻断）
    bank_errs = check_item_bank(items, node_index, rep)
    rep.section("3", "题库（item_id 全局唯一 / kp 引用 / pool 合法 / 字段完整；阻断）", bank_errs)

    # ---- 校验 4：配额（阻断）
    quota_errs = check_quota(items, nodes, rep)
    rep.section("4", "配额（每 kp train ≥5、retest ≥6、总量 ≥220；阻断）", quota_errs)

    # ---- 校验 5：干扰项绑定（阻断）
    dis_errs = check_distractors(items, nodes, rep)
    rep.section("5", "distractors 绑定（typical_error_code 存在于该 kp；阻断）", dis_errs)

    # ---- 附加 c：sample_items 引用（阻断）
    sample_errs = check_sample_items(nodes, {it.get("item_id") for it in items}, rep)
    rep.section("附加c", "sample_items 引用存在性（阻断）", sample_errs)

    # ---- 附加 b/d/e：警告级
    check_bank_consistency(nodes, items, rep)

    blocking = param_errs + graph_errs + te_errs + bank_errs + quota_errs + dis_errs + sample_errs

    # ---- 校验 6：统计报告
    report_stats(nodes, items, error_total)

    if rep.warnings:
        print(f"[WARN] 共 {len(rep.warnings)} 条非阻断提醒：")
        for w in rep.warnings:
            print(f"        - {w}")

    if args.json_out:
        stat = pool_stats(items, nodes)
        out = {
            "knowledge_file": str(knowledge_path),
            "bank_file": str(bank_path),
            "node_count": len(nodes),
            "typical_error_count": error_total,
            "item_count": len(items),
            "pool_counts": {
                nid: {"train": v["train"], "retest": v["retest"]} for nid, v in stat.items()
            },
            "errors": blocking,
            "warnings": rep.warnings,
        }
        Path(args.json_out).write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"[INFO] 统计报告已写入 {args.json_out}")

    if blocking:
        print(f"\n[FAIL] 阻断项 {len(blocking)} 条，校验未通过。")
        return 1
    print("\n[PASS] 全部阻断项通过（DATA_SCHEMA §6 校验 1–6 通过）。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
