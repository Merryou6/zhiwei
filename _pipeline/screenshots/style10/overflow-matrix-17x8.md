知微 · style-10 全站走查汇总：17 路由 × 8 组合 overflowPx / h1 矩阵
================================================================
生成：2026-10-11T12:22:44.273Z（node /tmp/p12-overflow-matrix.cjs，本文件为派生汇总，不改业务代码）
口径：audit 行取 tools/responsive-audit.cjs 的单页采样；探针行取 6.5 探针 JSON 中
      该组合全部状态的最大 overflowPx 与最大 h1 计数（含 R12 注入态，注入标记见原 JSON 的 injected 字段）。
      两口径均为「硬判据」：overflowPx 必须 = 0；页面级 h1 必须 = 1（无双 h1，D24）。

组合 1440-light：audit 采样 11 页；来源 audit-style10-1440.json + practice-1440-light.json + start-1440-light.json + landing-1440-light.json + teacher-t-1440-light.json + teacher-student-1440-light.json + teacher-recommendations-1440-light.json
组合 1440-dark：audit 采样 11 页；来源 audit-style10-1440-dark.json + practice-1440-dark.json + start-1440-dark.json + landing-1440-dark.json + teacher-t-1440-dark.json + teacher-student-1440-dark.json + teacher-recommendations-1440-dark.json
组合 1024-light：audit 采样 11 页；来源 audit-style10-1024.json + practice-1024-light.json + start-1024-light.json + landing-1024-light.json + teacher-t-1024-light.json + teacher-student-1024-light.json + teacher-recommendations-1024-light.json
组合 1024-dark：audit 采样 11 页；来源 audit-style10-1024-dark.json + practice-1024-dark.json + start-1024-dark.json + landing-1024-dark.json + teacher-t-1024-dark.json + teacher-student-1024-dark.json + teacher-recommendations-1024-dark.json
组合 768-light：audit 采样 11 页；来源 audit-style10-768.json + practice-768-light.json + start-768-light.json + landing-768-light.json + teacher-t-768-light.json + teacher-student-768-light.json + teacher-recommendations-768-light.json
组合 768-dark：audit 采样 11 页；来源 audit-style10-768-dark.json + practice-768-dark.json + start-768-dark.json + landing-768-dark.json + teacher-t-768-dark.json + teacher-student-768-dark.json + teacher-recommendations-768-dark.json
组合 375-light：audit 采样 11 页；来源 audit-style10-375.json + practice-375-light.json + start-375-light.json + landing-375-light.json + teacher-t-375-light.json + teacher-student-375-light.json + teacher-recommendations-375-light.json
组合 375-dark：audit 采样 11 页；来源 audit-style10-375-dark.json + practice-375-dark.json + start-375-dark.json + landing-375-dark.json + teacher-t-375-dark.json + teacher-student-375-dark.json + teacher-recommendations-375-dark.json

一、overflowPx 矩阵（单位 px；期望全 0）
| 路由 | 页号 | 1440L | 1440D | 1024L | 1024D | 768L | 768D | 375L | 375D |
|---|---|---|---|---|---|---|---|---|---|
| /login | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /self-report | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /spaces | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /assessment | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /paper | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /chat | 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /practice | 14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /attribution | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /graph | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /report | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /drive | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /me | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /start | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| / | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /t | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /t/student/:studentId | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| /t/recommendations | - | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

overflowPx 非 0 / 缺失单元数：0（期望 0）

二、页面级 h1 计数矩阵（期望全 1；D24 无双 h1）
来源：探针行 = 该组合全部状态的最大 h1 计数；audit 行 = h1check-<档>-<主题>.json
      （/login /self-report /spaces /assessment /paper /chat /practice /attribution
       /graph /report /drive /me /start / 共 14 条，4 档 × 双主题 = 8 份，
       由 tools/probe-h1-sweep.cjs 生成）；教师三页由 teacher-* 探针的 32 状态承担。
| 路由 | 页号 | 1440L | 1440D | 1024L | 1024D | 768L | 768D | 375L | 375D |
|---|---|---|---|---|---|---|---|---|---|
| /login | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /self-report | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /spaces | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /assessment | 4 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /paper | 5 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /chat | 6 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /practice | 14 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /attribution | 7 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /graph | 8 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /report | 9 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /drive | 10 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /me | 12 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /start | 13 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| / | - | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /t | - | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /t/student/:studentId | - | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| /t/recommendations | - | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 |

h1 计数 ≠ 1 单元数：0（期望 0）；取值缺失单元数：0（期望 0）

三、探针行状态清单（每组合覆盖到的状态名，含注入态）
· /practice
    1440-light: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T12:08:42.428Z
    1440-dark: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:46:05.442Z
    1024-light: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:46:19.085Z
    1024-dark: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:46:33.092Z
    768-light: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:46:46.502Z
    768-dark: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:47:01.405Z
    375-light: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:47:17.476Z
    375-dark: 5 态 [normal/concept/drill/hint-l1/hint-l2] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:47:30.958Z
· /start
    1440-light: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:40:56.802Z
    1440-dark: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:04.345Z
    1024-light: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:12.679Z
    1024-dark: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:19.859Z
    768-light: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:30.296Z
    768-dark: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:42.180Z
    375-light: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:50.803Z
    375-dark: 1 态 [normal] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:42:01.048Z
· /
    1440-light: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:40:58.647Z
    1440-dark: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:07.503Z
    1024-light: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:16.453Z
    1024-dark: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:26.283Z
    768-light: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:36.560Z
    768-dark: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:45.287Z
    375-light: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:41:54.311Z
    375-dark: 2 态 [normal/reduced] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T11:42:04.846Z
· /t
    1440-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:11.431Z
    1440-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:13.565Z
    1024-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:36.135Z
    1024-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:12.371Z
    768-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:37.090Z
    768-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:35.372Z
    375-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:58.886Z
    375-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:39:58.517Z
· /t/student/:studentId
    1440-light: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:33.541Z
    1440-dark: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:31.628Z
    1024-light: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:58.020Z
    1024-dark: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:57.552Z
    768-light: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:49:22.236Z
    768-dark: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:59.035Z
    375-light: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:49:23.331Z
    375-dark: 4 态 [normal/error/missing/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:49:21.652Z
· /t/recommendations
    1440-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:47:40.329Z
    1440-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:47:12.929Z
    1024-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:47:42.183Z
    1024-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:47:41.338Z
    768-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:06.630Z
    768-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:05.929Z
    375-light: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:32.367Z
    375-dark: 4 态 [normal/empty/error/denied] maxOverflow=0 maxH1=1 capturedAt=2026-10-11T10:48:07.889Z

四、口径自检：全部 JSON 的 width / theme 字段与文件名一致，无告警。

