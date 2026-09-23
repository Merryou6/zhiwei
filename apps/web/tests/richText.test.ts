// @vitest-environment jsdom
/**
 * 轻量 Markdown 子集渲染测试（lib/richText.tsx，前端优化批二）
 *
 * 覆盖：块级切分（段落/有序列表/无序列表/混排）、段内换行保留、
 *       行内标记（加粗/行内代码）、以及「模型输出不进入 HTML 解析路径」的安全前提。
 */

import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';

import { parseBlocks, renderInline } from '../src/lib/richText';

describe('parseBlocks · 块级切分', () => {
  it('连续有序列表项合并成同一个列表块', () => {
    const blocks = parseBlocks('先看这几步：\n1. 配方\n2. 定顶点\n3. 验对称轴');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({ type: 'p', text: '先看这几步：' });
    expect(blocks[1]).toEqual({ type: 'ol', items: ['配方', '定顶点', '验对称轴'] });
  });

  it('无序列表支持 - / * / · 三种记号', () => {
    const blocks = parseBlocks('- 开口方向\n* 顶点坐标\n· 最值');
    expect(blocks).toEqual([{ type: 'ul', items: ['开口方向', '顶点坐标', '最值'] }]);
  });

  it('中文顿号序号（1、）也识别为有序列表', () => {
    expect(parseBlocks('1、读题\n2、列式')).toEqual([{ type: 'ol', items: ['读题', '列式'] }]);
  });

  it('段内换行保留，空行不产生空段落', () => {
    const blocks = parseBlocks('第一句\n第二句\n\n\n第三句');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: 'p', text: '第一句\n第二句\n第三句' });
  });

  it('列表与段落混排时顺序不乱', () => {
    const blocks = parseBlocks('开头\n- 甲\n- 乙\n结尾');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul', 'p']);
  });

  it('空文本得到空块列表（不崩溃）', () => {
    expect(parseBlocks('')).toEqual([]);
    expect(parseBlocks('\n\n  \n')).toEqual([]);
  });
});

describe('renderInline · 行内标记', () => {
  it('加粗渲染为 strong，其余为纯文本', () => {
    const nodes = renderInline('这一步 **很关键** 别跳过', 'k');
    expect(nodes[0]).toBe('这一步 ');
    expect(isValidElement(nodes[1]) && nodes[1].type).toBe('strong');
    expect((nodes[1] as { props: { children: string } }).props.children).toBe('很关键');
    expect(nodes[2]).toBe(' 别跳过');
  });

  it('行内代码渲染为 code', () => {
    const nodes = renderInline('把 `x^2-4x` 配成完全平方', 'k');
    expect(isValidElement(nodes[1]) && nodes[1].type).toBe('code');
    expect((nodes[1] as { props: { children: string } }).props.children).toBe('x^2-4x');
  });

  it('未闭合的 ** 保持原样（流式过程中的中间态不闪烁成空）', () => {
    expect(renderInline('这一步 **还没', 'k')).toEqual(['这一步 **还没']);
  });

  it('HTML 标签只当普通文本（模型输出不走 innerHTML）', () => {
    const nodes = renderInline('<script>alert(1)</script>', 'k');
    expect(nodes).toEqual(['<script>alert(1)</script>']);
  });
});
