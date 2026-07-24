# QHRC 日历系统 — 代码与数据库分析报告

> 本文档为一次针对 QHRC 日历系统的架构、数据库、安全与代码质量审查总结。
> ⚠️ 内含安全漏洞细节与默认口令等敏感信息，请勿公开传播。

## 一、项目概况

基于 **Next.js 15 (App Router) + TypeScript + Supabase(PostgreSQL) + 腾讯云 COS** 的企业级共享日历系统。核心特征是"共享日历架构"——所有用户查看同一份日历，通过 `super_admin / admin / user` 三级角色控制读写。功能包括多视图日历、工作计划、附件/链接、节假日与操作审计。

代码组织清晰（`lib` 工具层、`api` 路由层、`components` 视图层分离），但在**数据库一致性、安全性和并发正确性**上存在若干需要重视的问题。

## 二、数据库部分

### 🔴 严重：`init.sql` 与实际运行 Schema 严重脱节

| 项 | `init.sql` 定义 | 代码/README 实际需要 |
|---|---|---|
| `users.username` | **不存在此列** | 登录、类型、所有 API 都依赖 `username` |
| `users.role` CHECK | 仅 `('admin','user')` | 需要 `super_admin`（靠 work_plans 迁移补） |
| `calendar_events.user_id` | `UUID NOT NULL REFERENCES users(id)` | 代码写入 `'shared-calendar'` 文本值，UUID+外键根本存不进去 |

**关键缺口**：没有任何迁移脚本给 `users` 表 `ADD COLUMN username`。仅按 `database/` 里的脚本执行，系统无法运行——说明生产库已被手工修改，与仓库脚本失去同步。

### 🔴 严重：`setup_super_admin.sql` 本身会执行失败

- 向 `operation_logs` 插入了不存在的 `user_username` 列（表里是 `user_email`）；
- `operation_type` 用了 `'CREATE_USER'`（大写），违反 `CHECK (operation_type IN ('create_user',...))`（小写）约束；
- 开头无条件 `DELETE FROM users` / `DELETE FROM operation_logs`，风险极高。

### 🟠 文档与迁移脚本字段名不一致

| 表 | README 写的 | 迁移脚本实际 |
|---|---|---|
| attachments | `original_filename`, `cos_key`, `file_size BIGINT` | `original_name`, `cos_url`, `file_size INTEGER` |
| links | 表名 `links` | 表名 `activity_links` |
| custom_holidays | `date ... UNIQUE` | 复合唯一 `(date, name)` |

### 🟠 未启用 RLS（行级安全）

`work_plans_shared_fix.sql` 显式 `DISABLE ROW LEVEL SECURITY`。系统安全**完全依赖应用层角色判断**，数据库层零防护。Supabase 的 anon key 是公开的，一旦有一处绕过 API 直连数据库，数据即完全暴露。建议启用 RLS 并配置策略作为纵深防御。

### 🟡 设计层面：整个日历存成单行 JSONB

`calendar_events` 用一行 `events JSONB` 存放全部日期的活动，带来：并发丢失更新、无法高效查询/统计、无法对单条活动做外键与索引。建议长期演进为规范化的 `activities` 表（`id, date, type, description, created_by, created_at`）。

## 三、安全问题

### 🔴 严重：批量保存日历接口缺少角色校验（越权）

`POST /api/calendar` 只判断 `if (!user)`，**没有任何角色检查**，直接用请求体覆盖整个共享日历 `events`。对比细粒度的 `POST /api/calendar/activities` 有 `admin/super_admin` 校验。任何普通 `user` 登录后即可覆盖甚至清空全部日历，完全绕过权限矩阵。**需立即修复**：加上 `hasManagementAccess(user.role)` 判断，或废弃该整体覆盖接口。

### 🔴 默认超管口令硬编码

README 和 SQL 中明文写着默认超管账号口令。必须从仓库文档移除，并强制首次登录改密。

### 🟠 附件为公开 URL

`cos.ts` 存的是公开直链。若桶为公共读，则所有附件对全网公开。已有签名 URL 方法（`getFileUrl`）但未在存储记录中使用。建议私有桶 + 下载时签发临时 URL。

### 🟠 附件上传信任客户端 `userId`

`POST /api/attachments` 用表单里传来的 `userId` 存 `user_id`，而非服务端会话的 `user.id`。应以服务端会话为准。

### 🟡 用户枚举与安全响应头

- 登录接口对不存在用户名返回"用户名不存在"，对密码错误返回"登录失败"，可被枚举有效用户名，应统一提示。
- `next.config.ts` 为空，建议补 `Strict-Transport-Security`、`X-Content-Type-Options`、`X-Frame-Options`、CSP 等。

## 四、代码质量与正确性

1. **重复的用户管理 API**：`/api/users` 与 `/api/admin/users`（及各自 `[id]`）是两套并行实现，签名不一致，维护混乱，应合并。
2. **内存缓存在 Serverless 下不可靠且有丢更新风险**：`cache.ts` 是进程内 `Map`，多实例不共享导致脏读；`activities` 路由"读→改 JSON→整块 upsert"是典型读-改-写竞态，并发添加会互相覆盖丢活动。
3. **操作日志可能丢失**：`operations.ts` 用 `setTimeout(…, 0)`，在 Serverless 里响应返回后运行时可能立即回收，回调来不及执行。应 `await`（或用 `waitUntil`）。
4. **审计字段语义混乱**：`logOperation` 第二参有时传 `username`、有时传 `email`，而列名是 `user_email`，数据不一致。
5. **生产环境泄露调试信息**：`work-plans` GET 把含用户邮箱的 `debug` 对象直接返回给前端。应移除。
6. **`weekStart` 过滤逻辑存疑**：工作计划按 `created_at` 是否落在本周过滤，而非计划所属周，跨周创建的计划归属会错乱。

## 五、优先级建议

**立即（安全）**
1. 给 `POST /api/calendar` 加角色校验或废弃该接口。
2. 从仓库移除默认口令并强制改密；附件改私有桶 + 签名 URL；上传用服务端 `user.id`。

**尽快（数据库一致性）**
3. 重写一份权威、可从零执行的 `init.sql`（含 `username`、`super_admin`、文本型 `user_id`、正确的 `operation_logs` 结构），并修正 `setup_super_admin.sql`。
4. 让 README 表结构与迁移脚本对齐。
5. 启用 RLS 并为共享表配置策略。

**中期（健壮性）**
6. 用 `waitUntil` 修复审计日志丢失；移除 debug 输出。
7. 合并两套用户管理 API。
8. 用外部缓存（Supabase/Redis）替代内存缓存；将日历规范化为 `activities` 表以根治并发丢更新。

**长期**
9. 补安全响应头/CSP；节假日数据外置以减少每年手工维护。
