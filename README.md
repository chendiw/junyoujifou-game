# 《君有疾否》生存游戏 - Hybrid Storage Version

这是一个基于HTML/JavaScript的文字冒险游戏，支持本地存储和Azure后端双重存储系统。

## 特性

- 🎮 完整的文字冒险游戏体验
- 💾 本地存储 + Azure后端混合存储
- ⏰ 每5分钟自动同步到Azure
- 🔄 离线优先，在线同步
- 📱 响应式设计，支持移动设备

## 文件结构

```
junyoujifou-game/
├── index.html              # 主游戏页面
├── game-logic.js           # 游戏逻辑
├── game-data.js            # 游戏数据（故事节点）
├── styles.css              # 游戏样式
├── storage-service.js      # 混合存储服务
├── config.js               # 配置文件
└── README.md               # 说明文档
```

## 快速开始

### 1. 本地运行（仅使用本地存储）

1. 直接打开 `index.html` 文件
2. 游戏将使用浏览器的localStorage进行数据存储
3. 无需任何服务器或后端设置

### 2. 启用Azure后端同步

1. 编辑 `config.js` 文件
2. 更新 `AZURE_BASE_URL` 为你的Azure Function App URL：

```javascript
const CONFIG = {
  AZURE_BASE_URL: 'https://your-azure-function-app.azurewebsites.net/api',
  // ... 其他配置
};
```

3. 确保Azure Function App包含以下端点：
   - `POST /api/users/create` - 创建用户
   - `POST /api/users/login` - 用户登录
   - `GET /api/game-state/{userId}` - 获取游戏状态
   - `POST /api/game-state/{userId}` - 更新游戏状态

## 存储系统说明

### 混合存储架构

游戏使用双层存储系统：

1. **本地存储（localStorage）**
   - 立即保存和加载
   - 离线可用
   - 快速响应

2. **Azure后端**
   - 每5分钟自动同步
   - 跨设备数据共享
   - 数据备份

### 同步机制

- **自动同步**：每5分钟检查并同步到Azure
- **手动同步**：退出登录时强制同步
- **错误处理**：Azure同步失败不影响本地游戏

### 数据流程

1. 用户操作 → 立即保存到localStorage
2. 标记为"待同步"
3. 5分钟后自动同步到Azure
4. 如果Azure不可用，继续使用本地数据

## 配置选项

在 `config.js` 中可以调整以下设置：

```javascript
const CONFIG = {
  // Azure Function App URL
  AZURE_BASE_URL: 'https://your-azure-function-app.azurewebsites.net/api',
  
  // 同步间隔（毫秒）
  SYNC_INTERVAL: 5 * 60 * 1000, // 5分钟
  
  // 游戏初始设置
  INITIAL_LIFE_POINTS: 5,
  INITIAL_TRANSPORT_CARDS: 3,
  STARTING_CHAPTER: "1",
  
  // 存储键名
  STORAGE_KEYS: {
    CURRENT_GAME: 'junYouJiFouGame',
    USERS: 'gameUsers',
    GAME_STATE_PREFIX: 'gameState_'
  }
};
```

## 开发说明

### 添加新的故事节点

编辑 `game-data.js` 文件，在 `storyNodes` 对象中添加新节点：

```javascript
const storyNodes = {
  "1": {
    "title": "节点标题",
    "text": "节点内容",
    "choices": [
      { "text": "选择1", "action": "action1", "nextNode": "2" },
      { "text": "选择2", "action": "action2", "nextNode": "3" }
    ]
  }
  // ... 更多节点
};
```

### 修改游戏逻辑

编辑 `game-logic.js` 文件中的相关函数：

- `handleChoice(choice)` - 处理玩家选择
- `handleBacktrack()` - 处理回溯功能
- `saveGame()` - 保存游戏状态

### 自定义样式

编辑 `styles.css` 文件来自定义游戏外观。

## 故障排除

### 常见问题

1. **Azure同步失败**
   - 检查网络连接
   - 验证Azure Function App URL
   - 查看浏览器控制台错误信息

2. **游戏数据丢失**
   - 检查localStorage是否被清除
   - 尝试从Azure恢复数据

3. **游戏无法加载**
   - 确保所有JavaScript文件正确加载
   - 检查浏览器控制台错误

### 调试模式

在浏览器控制台中可以使用以下命令：

```javascript
// 查看当前游戏状态
console.log(gameState);

// 查看存储服务状态
console.log(storageService);

// 强制同步到Azure
storageService.forceSync();

// 查看最后同步时间
console.log(storageService.getLastSyncTime());
```

## 部署

### 静态网站部署

可以将游戏部署到任何静态网站托管服务：

- GitHub Pages
- Netlify
- Vercel
- Azure Static Web Apps

### Azure Function App部署

参考 `junyoujifou-game-new/api/` 目录中的Azure Functions代码。

## 许可证

本项目仅供学习和演示使用。

## 贡献

欢迎提交Issue和Pull Request来改进游戏。