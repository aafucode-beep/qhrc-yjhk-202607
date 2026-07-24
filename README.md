# QHRC日历系统

QHRC日历系统是一个专门为QHRC（青海研究中心）设计的企业级日历管理平台，支持多研究中心的活动管理、工作计划协调和文档共享。系统采用共享日历架构，所有用户查看相同的日历内容，通过分级权限管理确保数据安全。

## 🚀 核心功能

### 📅 多视图日历系统
- **年视图**：全年活动概览，支持快速导航
- **月视图**：月度活动详情，显示活动类型标识
- **周视图**：详细活动管理，支持添加、编辑、删除操作

### 👥 分级权限管理
- **超级管理员（qhrcadmin）**：完整系统管理权限，可管理用户、删除所有内容
- **管理员**：可添加日历事件、工作计划、附件和链接，查看操作记录
- **普通用户**：仅可查看日历内容，无法添加或修改任何内容

### 🏢 活动分类管理
- **研究中心活动**：SI（智能传感器）、DI（智能设计）、MH（智慧医疗）、QHRC（创新中心）
- **政府单位联络**：政府相关活动和会议
- **企业合作**：SI企业、DI企业、MH企业的拜访和合作活动

### 📎 文档与链接管理
- **文件附件**：支持多种格式文件上传，存储在腾讯云COS
- **图片预览**：自动生成缩略图，支持原始比例预览
- **Word文档预览**：在线预览Word文档内容
- **外部链接**：管理相关新闻和资源链接

### 📋 工作计划系统
- **周计划管理**：当前周工作计划
- **近期计划**：未来工作安排
- **权限控制**：管理员可添加，超级管理员可删除

### 🎉 节假日管理
- **中国节假日**：自动显示法定节假日和调休安排
- **香港节假日**：支持香港地区节假日
- **自定义节假日**：管理员可添加特殊节假日
- **颜色分类**：不同类型节假日使用不同颜色标识

### 📊 操作审计
- **操作记录**：记录所有用户操作，包括登录、添加、删除等
- **用户追踪**：详细的用户行为日志
- **管理员可见**：管理员和超级管理员可查看操作记录

## 🛠 技术架构

### 前端技术栈
- **Next.js 15**：React全栈框架，支持SSR和API路由
- **TypeScript**：类型安全的JavaScript超集
- **Tailwind CSS**：实用优先的CSS框架
- **React Icons & Heroicons**：丰富的图标库
- **date-fns**：现代化的日期处理库

### 后端与数据库
- **Supabase**：开源的Firebase替代方案
  - PostgreSQL数据库
  - 实时数据同步
  - 用户认证管理
  - 行级安全策略
- **腾讯云COS**：对象存储服务，用于文件管理

### 核心特性
- **响应式设计**：完美适配桌面端和移动端
- **实时同步**：多用户协作，数据实时更新
- **安全认证**：基于用户名/密码的安全登录
- **权限控制**：细粒度的功能权限管理

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API路由
│   │   ├── auth/          # 用户认证
│   │   ├── calendar/      # 日历管理
│   │   ├── attachments/   # 附件管理
│   │   ├── links/         # 链接管理
│   │   ├── work-plans/    # 工作计划
│   │   └── holidays/      # 节假日管理
│   ├── auth/              # 认证页面
│   ├── calendar/          # 日历主页面
│   ├── admin/             # 管理员页面
│   └── user-management/   # 用户管理
├── components/            # React组件
│   ├── Calendar.tsx       # 主日历组件
│   ├── *View.tsx         # 各种视图组件
│   ├── Attachment*.tsx   # 附件相关组件
│   ├── WorkPlan*.tsx     # 工作计划组件
│   └── CustomHoliday*.tsx # 节假日组件
├── lib/                   # 工具函数和配置
│   ├── auth.ts           # 认证工具
│   ├── permissions.ts    # 权限管理
│   ├── holidays.ts       # 节假日处理
│   ├── cos.ts           # 腾讯云COS配置
│   └── supabase*.ts     # Supabase客户端
└── types/                 # TypeScript类型定义
```

## 🚀 快速开始

### 环境要求
- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd qhrccalender
```

2. **安装依赖**
```bash
npm install
```

3. **环境配置**
创建 `.env.local` 文件并配置以下变量：
```env
# Supabase配置
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# 腾讯云COS配置
TENCENT_COS_SECRET_ID=your-secret-id
TENCENT_COS_SECRET_KEY=your-secret-key
TENCENT_COS_BUCKET=your-bucket-name
TENCENT_COS_REGION=your-region
```

4. **数据库初始化**
使用 `database/init.sql` 脚本初始化数据库表结构

5. **启动开发服务器**
```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用

## 📊 数据库架构

### 核心数据表

#### users - 用户表
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### calendar_events - 日历事件表（共享架构）
```sql
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL DEFAULT 'shared-calendar',
    events JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### work_plans - 工作计划表
```sql
CREATE TABLE work_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('weekly', 'upcoming')),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    due_date DATE,
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### attachments - 附件表
```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    cos_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### links - 链接表
```sql
CREATE TABLE links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### custom_holidays - 自定义节假日表
```sql
CREATE TABLE custom_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom',
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### operation_logs - 操作记录表
```sql
CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    user_email TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔐 权限系统

### 用户角色定义
- **super_admin**：系统超级管理员，拥有所有权限
- **admin**：管理员，可以添加内容但不能删除
- **user**：普通用户，只能查看内容

### 权限矩阵

| 功能 | 普通用户 | 管理员 | 超级管理员 |
|------|----------|--------|------------|
| 查看日历 | ✅ | ✅ | ✅ |
| 添加日历事件 | ❌ | ✅ | ✅ |
| 删除日历事件 | ❌ | ❌ | ✅ |
| 查看工作计划 | ❌ | ✅ | ✅ |
| 添加工作计划 | ❌ | ✅ | ✅ |
| 删除工作计划 | ❌ | ❌ | ✅ |
| 查看附件 | 有附件时 | ✅ | ✅ |
| 添加附件 | ❌ | ✅ | ✅ |
| 删除附件 | ❌ | ❌ | ✅ |
| 管理链接 | ❌ | ✅ | ✅ |
| 管理自定义节假日 | ❌ | ✅ | ✅ |
| 删除自定义节假日 | ❌ | ❌ | ✅ |
| 用户管理 | ❌ | ❌ | ✅ |
| 查看操作记录 | ❌ | ✅ | ✅ |

## 🎨 界面设计

### 主题配色
- **主色调**：红色 RGB(158,31,56) - QHRC品牌色
- **节假日颜色**：
  - 中国传统节假日：红色系
  - 香港西方节假日：蓝色系
  - 工作调休：绿色系
- **活动类型颜色**：每种活动类型都有独特的颜色标识

### 响应式布局
- **桌面端**：左右分栏布局，日历在左，工作计划在右
- **移动端**：垂直堆叠布局，优化触摸操作
- **自适应**：根据屏幕尺寸自动调整组件大小和布局

## 📱 使用指南

### 登录系统
- 使用用户名和密码登录
- 默认超级管理员：用户名 `qhrcadmin`，密码 `qhrc523`

### 日历操作
1. **切换视图**：点击顶部的年/月/周视图按钮
2. **添加活动**：在周视图中点击日期的"+"按钮（需要管理员权限）
3. **查看详情**：点击活动可查看详细信息和附件
4. **管理附件**：在活动详情中上传文件或添加链接（需要管理员权限）

### 工作计划
1. **查看计划**：在周视图右侧查看工作计划（需要管理员权限）
2. **添加计划**：点击"添加"按钮创建新的工作计划
3. **分类管理**：支持周计划和近期计划两种类型

### 节假日管理
1. **查看节假日**：所有用户都可以看到节假日标识
2. **添加自定义节假日**：管理员可以添加特殊节假日
3. **节假日图例**：鼠标悬停查看节假日类型说明

## 🔧 开发指南

### 本地开发
```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

### 环境变量说明
```env
# Supabase数据库配置
NEXT_PUBLIC_SUPABASE_URL=          # Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Supabase匿名密钥
SUPABASE_SERVICE_ROLE_KEY=         # Supabase服务角色密钥

# 腾讯云COS文件存储配置
TENCENT_COS_SECRET_ID=              # 腾讯云访问密钥ID
TENCENT_COS_SECRET_KEY=             # 腾讯云访问密钥
TENCENT_COS_BUCKET=                 # COS存储桶名称
TENCENT_COS_REGION=                 # COS存储区域
```

### API接口文档
- `POST /api/auth/login` - 用户登录
- `GET /api/calendar/events` - 获取日历事件
- `POST /api/calendar/events` - 创建日历事件
- `DELETE /api/calendar/events/[id]` - 删除日历事件
- `GET /api/work-plans` - 获取工作计划
- `POST /api/work-plans` - 创建工作计划
- `DELETE /api/work-plans/[id]` - 删除工作计划
- `POST /api/attachments` - 上传附件
- `DELETE /api/attachments/[id]` - 删除附件
- `GET /api/links` - 获取链接
- `POST /api/links` - 创建链接
- `DELETE /api/links/[id]` - 删除链接

## 📋 部署说明

### 生产环境部署
1. **构建项目**：`npm run build`
2. **配置环境变量**：设置生产环境的环境变量
3. **数据库迁移**：运行 `database/init.sql` 初始化数据库
4. **启动服务**：`npm start`

### 注意事项
- 确保Supabase项目已正确配置
- 腾讯云COS存储桶需要正确的CORS配置
- 生产环境请修改默认管理员密码
- 定期备份数据库数据

## 🤝 贡献指南

### 开发规范
- 使用TypeScript进行类型安全开发
- 遵循ESLint代码规范
- 组件采用函数式组件和Hooks
- API路由使用Next.js App Router

### 提交规范
- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 📞 技术支持

如有技术问题或功能建议，请联系开发团队或提交Issue。

## 📄 许可证

本项目为QHRC内部使用项目，版权归QHRC所有。
