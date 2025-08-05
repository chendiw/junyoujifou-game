# 君有疾否 - 世界游戏守则

一个基于《君有疾否》小说的互动式文字冒险游戏，采用现代Web技术构建，支持多用户账户系统和云端进度保存。

## 🎮 游戏概述

《君有疾否》是一款基于同名小说的互动式文字冒险游戏。玩家将扮演小说世界中的角色，通过做出选择来影响故事发展，体验不同的剧情分支和结局。

### 核心特色
- **沉浸式剧情体验** - 忠实还原小说世界观和角色设定
- **多分支选择系统** - 每个选择都会影响故事走向
- **生命值系统** - 有限的生命值增加游戏挑战性
- **回溯卡机制** - 允许玩家回到之前的节点重新选择
- **故事地图** - 可视化展示已解锁和未解锁的故事节点
- **云端进度保存** - 支持多设备同步游戏进度

## 🏗️ 技术架构

### 前端技术栈
- **HTML5** - 语义化标记和现代Web标准
- **CSS3** - 响应式设计和动画效果
- **JavaScript (ES6+)** - 游戏逻辑和用户交互
- **Azure Static Website Hosting** - 静态网站托管

### 后端技术栈
- **Azure Functions (Python)** - 服务器端API
- **Azure Blob Storage** - 用户数据和游戏存档存储
- **Azure CDN** - 内容分发和性能优化

### 部署架构
```
用户浏览器 → Azure CDN → Azure Storage (静态文件)
                ↓
            Azure Functions (API)
                ↓
            Azure Blob Storage (数据存储)
```

## 🎯 游戏设计

### 核心机制

#### 1. 生命值系统
- 初始生命值：5点
- 使用回溯功能时消耗1点生命值
- 生命值耗尽时无法继续回溯
- 重新开始游戏时重置生命值

#### 2. 回溯卡系统
- 初始回溯卡：3张
- 用于在故事地图中跳转到已解锁的节点
- 每次跳转消耗1张回溯卡
- 提供更灵活的游戏体验

#### 3. 选择系统
- 每个故事节点提供多个选择选项
- 选择会影响后续剧情发展
- 支持"继续"类型的自动推进节点
- 记录玩家的选择历史

### 游戏流程

```
1. 用户登录/注册
   ↓
2. 加载游戏进度（如果有）
   ↓
3. 显示当前故事节点
   ↓
4. 玩家做出选择
   ↓
5. 自动保存进度
   ↓
6. 进入下一个节点
   ↓
7. 重复步骤3-6直到结局
```

### 故事节点类型

1. **普通节点** - 提供多个选择选项
2. **继续节点** - 只有一个"继续"选项，用于剧情推进
3. **结局节点** - 故事结束，显示结局内容
4. **分支节点** - 根据之前的选择显示不同内容

## 🔐 用户系统

### 账户管理
- **账户创建** - 用户提供唯一账户名
- **登录系统** - 基于账户名的身份验证
- **进度同步** - 云端保存和加载游戏进度
- **多设备支持** - 可在不同设备上继续游戏

### 数据安全
- **唯一用户ID** - 系统生成的UUID用于数据标识
- **账户名验证** - 确保账户名的唯一性
- **数据隔离** - 每个用户的数据独立存储
- **CORS保护** - 跨域请求安全控制

## 🎨 用户界面设计

### 设计理念
- **赛博朋克风格** - 黑色背景配合红色和蓝色霓虹效果
- **沉浸式体验** - 全屏设计，减少干扰元素
- **响应式布局** - 适配不同屏幕尺寸
- **直观操作** - 清晰的按钮和交互反馈

### 主要界面组件

#### 1. 登录页面
- 黑色背景配合红色霓虹边框
- 透明输入框和按钮设计
- 账户创建和登录功能切换

#### 2. 游戏主界面
- 顶部：游戏标题、用户信息、退出按钮
- 中部：故事内容、选择按钮
- 底部：游戏规则说明
- 右上角：故事地图按钮

#### 3. 故事地图
- 网格布局展示所有故事节点
- 已解锁节点高亮显示
- 支持点击跳转功能
- 节点状态可视化

#### 4. 确认对话框
- 跳转确认机制
- 清晰的选项说明
- 防止误操作的二次确认

### 视觉元素
- **主色调**：红色 (#e94560) 和橙色 (#f27121)
- **辅助色**：蓝色 (#4facfe) 用于回溯功能
- **背景**：深色渐变 (#0f0f23, #1a1a2e, #16213e)
- **文字**：白色和霓虹色搭配

## 🔧 后端API设计

### API端点

#### 1. 账户管理
```
POST /api/create-account
- 功能：创建新用户账户
- 参数：accountName (账户名)
- 返回：userId, accountName, gameState

POST /api/login
- 功能：用户登录
- 参数：accountName (账户名)
- 返回：userId, accountName, gameState
```

#### 2. 游戏进度
```
POST /api/save-game
- 功能：保存游戏进度
- 参数：完整的游戏状态对象
- 返回：保存成功确认

GET /api/load-game
- 功能：加载游戏进度
- 参数：userId (查询参数)
- 返回：完整的游戏状态对象
```

### 数据存储结构

#### 用户账户数据 (account-list.json)
```json
{
  "accounts": [
    {
      "userId": "uuid-string",
      "accountName": "用户账户名",
      "createdAt": "2025-08-05T08:00:00Z",
      "lastLogin": "2025-08-05T08:30:00Z"
    }
  ]
}
```

#### 游戏存档数据 (user-{userId}.json)
```json
{
  "userId": "uuid-string",
  "accountName": "用户账户名",
  "currentChapter": 1,
  "lifePoints": 5,
  "backtrackPoints": 3,
  "visitedNodes": ["1", "2", "3"],
  "playerChoices": [
    {
      "chapter": 1,
      "action": "choice1",
      "text": "选择内容"
    }
  ],
  "previousNode": null,
  "gameOver": false,
  "lastSaved": "2025-08-05T08:30:00Z",
  "version": "1.0"
}
```

## 🚀 部署和运维

### 部署流程
1. **代码提交** - 推送到GitHub仓库
2. **自动部署** - GitHub Actions触发部署流程
3. **静态文件部署** - 上传到Azure Storage
4. **函数部署** - 部署Azure Functions
5. **CDN更新** - 清除缓存，更新内容

### 环境配置
- **生产环境**：Azure云服务
- **域名**：www.junyoujifou-game.live
- **SSL证书**：通过Azure CDN自动配置
- **监控**：Azure Application Insights

### 性能优化
- **CDN加速** - 全球内容分发
- **静态资源缓存** - 浏览器和CDN缓存
- **API响应优化** - 异步处理和错误处理
- **图片优化** - 压缩和格式优化

## 🔄 开发工作流

### 本地开发
```bash
# 启动本地服务器
python3 -m http.server 8000

# 访问游戏
http://localhost:8000/survival_game.html
```

### 部署命令
```bash
# 部署Azure Functions
cd azure-functions
func azure functionapp publish junyoujifou-game-functions --python --build remote --force

# 部署静态文件
az storage blob upload-batch --source . --destination $web --account-name junyoujifou20250804
```

## 📊 游戏数据

### 故事结构
- **总节点数**：根据story_nodes.json配置
- **分支数量**：每个节点2-4个选择
- **结局数量**：多个不同结局
- **平均游戏时长**：30-60分钟

### 用户统计
- **并发用户支持**：1000-10000用户
- **数据存储**：每个用户约1KB存档数据
- **API响应时间**：<500ms
- **可用性**：99.9%

## 🔮 未来规划

### 功能扩展
- [ ] 成就系统
- [ ] 排行榜功能
- [ ] 社交分享
- [ ] 多语言支持
- [ ] 移动端优化

### 技术改进
- [ ] 实时多人功能
- [ ] 高级分析系统
- [ ] A/B测试框架
- [ ] 自动化测试
- [ ] 性能监控

## 📝 开发规范

### 代码风格
- **JavaScript**：ES6+标准，使用const/let
- **CSS**：BEM命名规范，模块化设计
- **Python**：PEP 8规范，类型注解
- **HTML**：语义化标签，无障碍访问

### 文件结构
```
junyoujifou-game/
├── survival_game.html      # 主游戏文件
├── login.html             # 登录页面
├── story_nodes.json       # 故事数据
├── save-load-integration.js # 存档系统
├── azure-functions/       # 后端API
│   ├── create_account/    # 账户创建
│   ├── login/            # 用户登录
│   ├── save_game/        # 保存游戏
│   └── load_game/        # 加载游戏
└── .github/workflows/    # CI/CD配置
```

## 🤝 贡献指南

### 如何贡献
1. Fork项目仓库
2. 创建功能分支
3. 提交代码更改
4. 创建Pull Request
5. 等待代码审查

### 开发环境设置
1. 克隆仓库
2. 安装依赖
3. 配置Azure环境变量
4. 运行本地开发服务器

## 📄 许可证

本项目采用MIT许可证 - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- **项目地址**：https://github.com/chendiw/junyoujifou-game
- **在线游戏**：https://www.junyoujifou-game.live
- **问题反馈**：通过GitHub Issues提交

---

*《君有疾否》是一款基于同名小说的互动式文字冒险游戏，旨在为读者提供沉浸式的故事体验。*