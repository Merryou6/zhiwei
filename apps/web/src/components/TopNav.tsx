/**
 * 图签条右区操作簇（style-10 蓝图迁移 P5；由移动端适配轮的「顶栏」退役拆解而来）
 *
 * 【它现在是什么】原型 `.mast-right`：四项图签右侧那一组操作 ——
 * 回老师端（教师角色）/ 空间胶囊（切空间 + 原地新建 + 管理）/ 图纸底色（主题）/
 * 「全部图纸」抽屉入口。它不再是一整条顶栏：品牌位与四项图签归 Masthead，
 * 导航归 Rail 与底部 tabbar。
 *
 * 【为什么这个文件名还在】`apps/web/tests/mobileNav.test.ts`（**冻结，不改**）
 * 会读 `components/TopNav.tsx` 的源文件文本，断言它与 MobileNav.tsx 都
 * 「不硬编码跨组件 id 字面量、且都从 lib/ids.ts 取共享常量」。
 * 删文件会让那条断言无法通过，而「改测试」是红线。所以按计划的授权
 * 「本文件此批删除**或改为薄封装**，以实现为准留痕」——这里取薄封装：
 * 文件保留为右区操作簇，跨组件 id 的**持有方**从「汉堡键」变成「全部图纸入口」，
 * 语义（点它打开抽屉、关闭时焦点回到它）完全不变。
 *
 * 【空间下拉的既有逻辑一行未改】懒加载空间列表（#3 space/list）→ 失败静默；
 * 容器外 pointerdown 关闭；Esc 关闭并归还焦点；Esc 落在新建表单里时只收表单
 * （输入内容在表单卸载即丢，不能连弹层一起关）；任何关闭路径统一重置 createOpen。
 *
 * 【窄档收掉什么】≤900 空间胶囊与主题钮收进「全部图纸」抽屉（D7：抽屉承载空间切换），
 * 图签条只留身份芯片与几个开关 —— 375px 上塞不下更多。（清尾轮 L11 的
 * 「内容列与图签条右区共用同一条右基线」由 Masthead 读同一个 --panel-dock-offset 保证。）
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { listSpaces } from '../api/endpoints';
import { cn } from '../lib/cn';
import { MOBILE_NAV_DRAWER_ID, MOBILE_NAV_TOGGLE_ID } from '../lib/ids';
import { SPACES_PATH, TEACHER_HOME } from '../router';
import { useAuthStore } from '../stores/auth';
import { useMobileNavStore } from '../stores/mobileNav';
import { useSpaceStore } from '../stores/space';
import { bpButtonClass } from './blueprint/Masthead';
import { Icon } from './blueprint/icons';
import SpaceCreateForm from './SpaceCreateForm';
import ThemeToggle from './ThemeToggle';

export default function TopNav() {
  /** 空间下拉容器（含胶囊与弹层）：外点关闭的判定边界。 */
  const spaceMenuRef = useRef<HTMLDivElement | null>(null);
  /** 空间胶囊按钮：Escape 关闭后焦点归还给它。 */
  const spaceToggleRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  /** 弹层内的新建表单是否展开（原地展开，不跳页）。 */
  const [createOpen, setCreateOpen] = useState(false);

  const token = useAuthStore((state) => state.token);
  // 老师账号没有学习空间，误入学生端时需要一个显式出口
  const role = useAuthStore((state) => state.role);
  const spaces = useSpaceStore((state) => state.spaces);
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId);
  const setSpaces = useSpaceStore((state) => state.setSpaces);
  const setActive = useSpaceStore((state) => state.setActive);
  /** 「全部图纸」抽屉（P5 起由本簇持有的入口）。 */
  const navOpen = useMobileNavStore((state) => state.open);
  const toggleNav = useMobileNavStore((state) => state.toggle);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent): void {
      const root = spaceMenuRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setOpen(false);
        setCreateOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      const form = spaceMenuRef.current?.querySelector('[data-create-form]');
      if (form && event.target instanceof Node && form.contains(event.target)) {
        setCreateOpen(false);
        requestAnimationFrame(() => document.getElementById('sheet-create-toggle')?.focus());
        return;
      }
      setOpen(false);
      setCreateOpen(false);
      spaceToggleRef.current?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!token || spaces.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await listSpaces();
        if (!cancelled) setSpaces(data.spaces);
      } catch {
        /* 静默：空间页负责给出可读提示 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, spaces.length, setSpaces]);

  const active = spaces.find((space) => space.space_id === activeSpaceId) ?? null;

  return (
    <>
      {/* 教师端回程入口：学生端不渲染。窄档收进抽屉（教师端有自己的壳）。 */}
      {role === 'teacher' ? (
        <Link to={TEACHER_HOME} className={cn(bpButtonClass('secondary'), 'hidden sheet:inline-flex')}>
          <Icon name="swap" className="h-4 w-4" />
          回老师端
        </Link>
      ) : null}

      {/* 空间胶囊：≤900 收进「全部图纸」抽屉（D7）。 */}
      <div ref={spaceMenuRef} className="relative hidden flex-none items-center gap-2.5 sheet:flex">
        <button
          ref={spaceToggleRef}
          type="button"
          onClick={() => {
            setOpen((value) => {
              if (value) setCreateOpen(false);
              return !value;
            });
          }}
          aria-expanded={open}
          className={cn(bpButtonClass('secondary'), 'gap-2 px-3')}
        >
          <Icon name="layers" className="h-4 w-4" />
          空间·{active ? active.name : '未选择'}
          <Icon name="chevron" className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        </button>

        {open ? (
          <div className="bp-panel absolute right-0 top-full z-overlay mt-2 w-60 p-2 shadow-overlay">
            <p className="px-2 py-1 font-mono text-mono-xs uppercase tracking-widest text-ink-soft">
              切到另一个空间
            </p>
            <ul>
              {spaces.map((space) => (
                <li key={space.space_id}>
                  <button
                    type="button"
                    onClick={() => {
                      setActive(space.space_id);
                      setOpen(false);
                      setCreateOpen(false);
                    }}
                    className={cn(
                      'flex min-h-9 w-full items-center rounded-none px-2 py-1.5 text-left text-sm',
                      space.space_id === activeSpaceId
                        ? 'bg-accent-veil text-accent-ink'
                        : 'text-ink hover:bg-raised',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{space.name}</span>
                    {space.is_default ? (
                      <span className="ml-1 flex-none font-mono text-mono-xs text-ink-soft">
                        默认
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
              {spaces.length === 0 ? (
                <li className="min-h-9 px-2 py-2 text-ui-sm text-ink-soft">还没有空间</li>
              ) : null}
            </ul>
            {createOpen ? (
              <div data-create-form className="mt-1 border-t border-line pt-2">
                <SpaceCreateForm
                  compact
                  onCreated={() => {
                    setCreateOpen(false);
                    setOpen(false);
                  }}
                />
              </div>
            ) : (
              <button
                id="sheet-create-toggle"
                type="button"
                onClick={() => setCreateOpen(true)}
                className="mt-1 block w-full rounded-none px-2 py-1.5 text-left text-sm text-accent-ink hover:bg-raised"
              >
                + 新建空间
              </button>
            )}
            <Link
              to={SPACES_PATH}
              onClick={() => {
                setCreateOpen(false);
                setOpen(false);
              }}
              className="mt-1 block rounded-none px-2 py-1.5 text-sm text-ink-soft hover:bg-raised"
            >
              管理空间
            </Link>
          </div>
        ) : null}
      </div>

      {/* 图纸底色（主题）：≤900 收进抽屉（抽屉里另有一份）。 */}
      <span className="hidden sheet:flex">
        <ThemeToggle />
      </span>

      {/* 「全部图纸」抽屉入口（规范 5.15）：任意档都在 —— 它同时是空间管理的唯一入口。
          跨组件 id 走 lib/ids.ts 的共享常量（mobileNav.test.ts 冻结断言 + 焦点归还依赖它）。 */}
      <button
        id={MOBILE_NAV_TOGGLE_ID}
        type="button"
        onClick={toggleNav}
        aria-expanded={navOpen}
        aria-controls={MOBILE_NAV_DRAWER_ID}
        aria-haspopup="dialog"
        aria-label={navOpen ? '关闭全部图纸' : '打开全部图纸'}
        className={cn(bpButtonClass('secondary'), 'px-2.5')}
      >
        <Icon name="grid" className="h-4 w-4" />
        <span className="hidden sheet:inline">全部图纸</span>
      </button>
    </>
  );
}
