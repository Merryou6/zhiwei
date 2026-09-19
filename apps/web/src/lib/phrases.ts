/**
 * 话术表与文案常量（PRD §6「语气：像耐心的学长，不像评判者」）
 *
 * 纪律：
 *   - 四场景文案**照抄 PRD §6 表格「说」列**，逐字不改（phrases.test.ts 锁定）。
 *   - 评判词黑名单（FORBIDDEN_WORDS）：任何面向学生的话术不得出现；
 *     服务端下发的 msg 是另一回事（前端只包装语气、不二次翻译，见 api/client.ts）。
 *   - 五类错误类型的中文名与一句解释：PRD 表格只给交互语气，错误类型中文名由本迭代裁决
 *     （契约 §6 只定义枚举英文值），用于归因页枚举卡片。
 */

/** 五类错误类型（契约 §6 五值全局枚举，前端只消费不发明）。 */
export const ERROR_TYPES = [
  'prerequisite_gap',
  'concept_confusion',
  'method_gap',
  'procedural_slip',
  'misreading',
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number];

/** 归因方向（契约 §6 attribution_direction；由服务端下发，前端只据此决定是否出现归因按钮）。 */
export type AttributionDirection = 'upstream' | 'self' | 'none';

/** 五类错误类型 → 中文名（归因页枚举卡片标题）。 */
export const ERROR_TYPE_LABEL: Record<ErrorType, string> = {
  prerequisite_gap: '前置知识缺口',
  concept_confusion: '概念混淆',
  method_gap: '方法缺失',
  procedural_slip: '操作失误',
  misreading: '审题失误',
};

/** 五类错误类型 → 一句学长式解释（不做价值判断，只描述「这类坑长什么样」）。 */
export const ERROR_TYPE_NOTE: Record<ErrorType, string> = {
  prerequisite_gap: '这一步要用到的上游知识还不稳，先回去把那块砖铺平。',
  concept_confusion: '两个很像的概念在这一步被搅在一起了，我们把它掰开比一比。',
  method_gap: '遇到这类题该走的那条路还没形成习惯，先把路线定下来。',
  procedural_slip: '思路没问题，是手上的操作滑了一下，练熟就好。',
  misreading: '题目里的某个条件被看漏或看偏了，先学会把它圈出来。',
};

/** 不进归因的两类（契约 §7 前置：前端不得对其调用 analyze）。 */
export const NO_ATTRIBUTION_TYPES: readonly ErrorType[] = ['procedural_slip', 'misreading'];

/** PRD §6 四场景话术（逐字照抄「说」列）。 */
export const PHRASES = {
  /** 知识点薄弱：不说「你掌握很差」。 */
  weakKnowledgePoint: '这一环还有点晃，我们再稳一下',
  /** 答错了：不说「回答错误」。 */
  wrongAnswer: '这个坑很常见，我们看看它是怎么来的',
  /** 归因成功：不说「检测到知识缺陷」。 */
  attributionFound: '找到啦——真正卡住你的是这里',
  /** 触发退出：不说「你答不上来」。 */
  exitChannel: '我们先往回看一眼 XX，那里可能是关键',
} as const;

/** 评判词黑名单（phrases.test.ts 断言四场景文案不含这些词）。 */
export const FORBIDDEN_WORDS: readonly string[] = [
  '错误',
  '很差',
  '差劲',
  '笨',
  '答不上来',
  '知识缺陷',
  '不合格',
];

/** 触发退出话术（把 PRD §6 的 XX 换成具体知识点名）。 */
export function exitChannelText(kpName: string): string {
  return `我们先往回看一眼「${kpName}」，那里可能是关键`;
}

/** 其余面向学生的话术（同一语气基调；集中于此便于统一审校）。 */
export const UI_TEXT = {
  /** 新用户冷启动：还没有自报数据时的引导。 */
  needSelfReport: '先花 30 秒告诉我你大概的起点，我才知道从哪儿帮你。',
  /** 测评收敛（结束屏）。 */
  assessmentDone: '这一轮先到这里，我们去看看你的地图',
  /** 冷启动立即收敛（INFO-1）时的结束屏引导。 */
  assessmentDoneTooFast: '这么快就收敛了，多半是起点还没填——先花 30 秒自报一下，我再看地图会更准。',
  /** 验证通过徽标。 */
  verifyPassed: '验证通过',
  /** 反驳已记录徽标。 */
  rejectRecorded: '已记录你的反驳',
  /** 候选耗尽的诚实兜底。 */
  verificationExhausted: '暂时没找到更深的根源，我们就从这一环开始稳',
  /** procedural_slip / misreading 的明示（不出现归因按钮）。 */
  slipNoAttribution: '这类小失误不用归因，下次稳一点就好',
  /** 试卷识别不清的行提示（与契约 §5 502/504 话术同源）。 */
  paperUnclearRow: '这题我没看清，麻烦你标一下',
  /** 试卷确认成功后的非阻断气泡。 */
  paperConfirmed: '已经记下来了，我更新了你的掌握度',
  /** 云盘 P1 占位（PRD §3 P1 原文案）。 */
  driveComingSoon: '自定义知识库即将开放',
  /** SSE 降级为普通 JSON 时的非阻断提示（契约 §9 禁白屏）。 */
  sseFallback: '刚才网络卡了一下，已转为普通回复',
  /** 网络错误（client.ts 统一话术）。 */
  networkError: '网络开小差了，稍后再试一次',
  /** 空间 409 冲突对话框默认按钮（契约 §2 明文）。 */
  switchToExisting: '切换过去',
  /** 复述错误（先复述再判定，PRD P0 #6）。 */
  restateFirst: '先把你写的那一步复述一遍，我们对着它看',
} as const;

/** 校验「某段文案不含评判词」（测试与运行期自检共用）。 */
export function hasJudgementWord(text: string): boolean {
  return FORBIDDEN_WORDS.some((word) => text.includes(word));
}
