// Game State Management
let gameState = {
  user: null,
  currentChapter: "1",
  lifePoints: 5,
  transportCards: 3,
  visitedNodes: ["1"],
  playerChoices: [],
  previousNode: null,
  gameOver: false
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const accountNameInput = document.getElementById('accountName');
const loginBtn = document.getElementById('loginBtn');
const createAccountBtn = document.getElementById('createAccountBtn');
const logoutBtn = document.getElementById('logoutBtn');
const storyTitle = document.getElementById('storyTitle');
const storyText = document.getElementById('storyText');
const choicesContainer = document.getElementById('choicesContainer');
const backtrackBtn = document.getElementById('backtrackBtn');
const lifePointsSpan = document.getElementById('lifePoints');
const transportCardsSpan = document.getElementById('transportCards');
const worldRulesBtn = document.getElementById('worldRulesBtn');
const storyMapBtn = document.getElementById('storyMapBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const toastContainer = document.getElementById('toastContainer');

// Initialize game
document.addEventListener('DOMContentLoaded', async function() {
  setupEventListeners();
  
  // Set Azure function URL from config
  storageService.setAzureBaseUrl(CONFIG.AZURE_BASE_URL);
  
  try {
    // Wait for story nodes to load before checking saved game
    await loadStoryNodes();
    checkSavedGame();
  } catch (error) {
    console.error('Failed to initialize game:', error);
    showToast('初始化失败', '无法加载故事数据，请刷新页面重试', 'error');
  }
});

function setupEventListeners() {
  // Login functionality
  loginBtn.addEventListener('click', handleLogin);
  createAccountBtn.addEventListener('click', handleCreateAccount);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Enter key for login
  accountNameInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });
  
  // Game controls
  backtrackBtn.addEventListener('click', handleBacktrack);
  worldRulesBtn.addEventListener('click', () => openModal('worldRulesModal'));
  storyMapBtn.addEventListener('click', () => openModal('storyMapModal'));
  
  // Welcome message world rules link
  const worldRulesLink = document.getElementById('worldRulesLink');
  if (worldRulesLink) {
    worldRulesLink.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('worldRulesModal');
    });
  }
  
  // Initialize world rules content
  document.getElementById('worldRulesContent').innerHTML = `<pre>${worldRulesText}</pre>`;
}

async function checkSavedGame() {
  try {
    // Try to load from localStorage first
    const savedGame = storageService.loadFromLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME);
    if (savedGame && savedGame.user) {
      gameState = savedGame;
      showGame();
      return;
    }
  } catch (e) {
    console.error('Error loading saved game:', e);
  }
  showLogin();
}

function showLogin() {
  loginScreen.classList.add('active');
  gameScreen.classList.remove('active');
}

async function showGame() {
  loginScreen.classList.remove('active');
  gameScreen.classList.add('active');
  updateGameDisplay();
  await loadCurrentStory();
}

function showLoading(show = true) {
  if (show) {
    loadingIndicator.classList.add('active');
  } else {
    loadingIndicator.classList.remove('active');
  }
}

function showToast(title, description, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-title">${title}</div>
    <div class="toast-description">${description}</div>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

async function handleLogin() {
  const accountName = accountNameInput.value.trim();
  if (!accountName) {
    showToast('错误', '请输入账户名', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    console.log('Logging in user:', accountName);
    const result = await storageService.loginUser(accountName);
    gameState = result.gameState;
    gameState.user = result.user;
    
    console.log('Game state loaded:', gameState);
    
    // Save to localStorage for immediate access
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);
    
    showToast('登录成功', `欢迎回来，${accountName}！`);
    await showGame();
  } catch (error) {
    console.error('Login error:', error);
    showToast('登录失败', error.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function handleCreateAccount() {
  const accountName = accountNameInput.value.trim();
  if (!accountName) {
    showToast('错误', '请输入账户名', 'error');
    return;
  }
  
  showLoading(true);
  
  try {
    const result = await storageService.createUser(accountName);
    gameState = result.gameState;
    gameState.user = result.user;
    
    // Save to localStorage for immediate access
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);
    
    showToast('账户创建成功', `欢迎，${accountName}！`);
    showGame();
  } catch (error) {
    // Check if it's a duplicate account error
    if (error.message && error.message.includes('already exists')) {
      showToast('账户创建失败', '账户名已存在，请选择其他名称！', 'error');
    } else {
      showToast('创建失败', error.message, 'error');
    }
  } finally {
    showLoading(false);
  }
}

function handleLogout() {
  // Force sync before logout
  storageService.forceSync().then(() => {
    gameState.user = null;
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, null);
    accountNameInput.value = '';
    showLogin();
    showToast('退出成功', '已成功退出登录');
  });
}

function saveGame() {
  // Save current game state using storage service
  storageService.saveGameState(gameState.user.id, gameState);
  
  // Also save to localStorage for immediate access
  storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);
}

function updateGameDisplay() {
  lifePointsSpan.textContent = gameState.lifePoints;
  transportCardsSpan.textContent = gameState.transportCards;
  
  // Update backtrack button state
  const canBacktrack = gameState.previousNode;
  const currentNode = storyNodes[gameState.currentChapter];
  const isContinueOnly = currentNode?.choices?.length === 1 && 
                        currentNode.choices[0].text === "继续";
  
  if (gameState.currentChapter === "1" || !canBacktrack) {
    backtrackBtn.disabled = true;
    backtrackBtn.textContent = '返回上一题';
  } else if (isContinueOnly) {
    // Continue-only nodes can always go back without consuming life points
    backtrackBtn.disabled = false;
    backtrackBtn.textContent = '返回上一题（免费）';
  } else {
    // Regular nodes need life points to go back
    if (gameState.lifePoints <= 0) {
      backtrackBtn.disabled = true;
      backtrackBtn.textContent = '生命值不足';
    } else {
      backtrackBtn.disabled = false;
      backtrackBtn.textContent = '返回上一题（消耗1生命值）';
    }
  }
}

async function loadCurrentStory() {
  // Ensure story nodes are loaded
  if (Object.keys(storyNodes).length === 0) {
    try {
      await loadStoryNodes();
    } catch (error) {
      console.error('Failed to load story nodes:', error);
      showToast('错误', '无法加载故事数据', 'error');
      return;
    }
  }
  
  const node = storyNodes[gameState.currentChapter];
  if (!node) {
    console.error('Story node not found:', gameState.currentChapter);
    console.log('Available nodes:', Object.keys(storyNodes));
    showToast('错误', '故事节点不存在', 'error');
    return;
  }
  
  storyTitle.textContent = node.title;
  storyText.innerHTML = node.text;
  
  // Clear previous choices
  choicesContainer.innerHTML = '';
  
  // Clear story actions (remove any existing restart buttons)
  const storyActions = document.querySelector('.story-actions');
  if (storyActions) {
    // Keep only the backtrack button, remove any restart buttons
    const backtrackBtn = storyActions.querySelector('#backtrackBtn');
    storyActions.innerHTML = '';
    if (backtrackBtn) {
      storyActions.appendChild(backtrackBtn);
    }
  }
  
  // Add choices
  if (node.choices) {
    node.choices.forEach((choice, index) => {
      const choiceBtn = document.createElement('button');
      choiceBtn.className = 'choice-btn';
      choiceBtn.textContent = choice.text;
      choiceBtn.addEventListener('click', () => handleChoice(choice));
      choicesContainer.appendChild(choiceBtn);
    });
  }
  
  // Add restart button for endings
  if (node.isEnding) {
    const storyActions = document.querySelector('.story-actions');
    if (storyActions) {
      const restartBtn = document.createElement('button');
      restartBtn.className = 'btn btn-backtrack';
      restartBtn.textContent = '重新开始';
      restartBtn.addEventListener('click', () => handleRestart());
      storyActions.appendChild(restartBtn);
    }
  }
  
  updateGameDisplay();
  updateStoryMap();
}

async function handleChoice(choice) {
  // Handle restart game action (legacy support)
  if (choice.action === "restart_game") {
    await handleRestart();
    return;
  }
  
  // Add to visited nodes
  if (!gameState.visitedNodes.includes(choice.nextNode)) {
    gameState.visitedNodes.push(choice.nextNode);
  }
  
  // Add to player choices
  gameState.playerChoices.push({
    chapter: gameState.currentChapter,
    action: choice.action,
    text: choice.text
  });
  
  // Update state
  gameState.previousNode = gameState.currentChapter;
  gameState.currentChapter = choice.nextNode;
  
  saveGame();
  await loadCurrentStory();
  
  // Show auto-save notification (only for errors)
  // No success notification as requested
}

async function handleBacktrack() {
  if (!gameState.previousNode) {
    showToast('无法回溯', '没有可回溯的节点', 'error');
    return;
  }
  
  const currentNode = storyNodes[gameState.currentChapter];
  const isContinueOnly = currentNode?.choices?.length === 1 && 
                        currentNode.choices[0].text === "继续";
  
  // Check if we need to consume life points
  if (!isContinueOnly && gameState.currentChapter !== "1") {
    if (gameState.lifePoints <= 0) {
      showToast('无法回溯', '生命值不足', 'error');
      return;
    }
    
    // Consume life point for non-continue nodes
    gameState.lifePoints -= 1;
  }
  
  // Go back to previous node
  const temp = gameState.currentChapter;
  gameState.currentChapter = gameState.previousNode;
  gameState.previousNode = null;
  
  // Remove last choice from history
  gameState.playerChoices.pop();
  
  saveGame();
  await loadCurrentStory();
  
  // No toast notification when going back to previous node
  // The game state change is sufficient feedback
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('active');
  
  if (modalId === 'storyMapModal') {
    updateStoryMap();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('active');
}

function updateStoryMap() {
  const mapNodes = document.getElementById('mapNodes');
  mapNodes.innerHTML = '';
  
  const chapterNames = getChapterNames();
  
  // Get all available nodes (excluding endings)
  const allNodes = Object.keys(storyNodes).filter(nodeId => !nodeId.startsWith('ending_'));
  
  // Create map nodes for all available chapters
  allNodes.forEach(nodeId => {
    const node = storyNodes[nodeId];
    if (!node) return;
    
    const mapNode = document.createElement('div');
    mapNode.className = 'map-node';
    
    // Determine node state
    if (nodeId === gameState.currentChapter) {
      mapNode.classList.add('current');
    } else if (gameState.visitedNodes.includes(nodeId)) {
      mapNode.classList.add('visited');
    } else {
      mapNode.classList.add('locked');
    }
    
    mapNode.innerHTML = `
      <div class="map-node-title">${chapterNames[nodeId] || `第${nodeId}章`}</div>
    `;
    
    // Add click handler for transport (only for visited nodes with multiple choices that aren't current)
    const nodeChoices = node.choices || [];
    const hasMultipleChoices = nodeChoices.length > 1 || 
                              (nodeChoices.length === 1 && nodeChoices[0].text !== "继续");
    
    if (gameState.visitedNodes.includes(nodeId) && 
        nodeId !== gameState.currentChapter) {
      if (!hasMultipleChoices) {
        // Show popup for nodes with only "继续" option
        mapNode.addEventListener('click', () => {
          showToast('传送失败', '该章节无选项，无法传送', 'error');
        });
      } else if (gameState.transportCards > 0) {
        mapNode.addEventListener('click', () => {
          openTransportModal(nodeId);
        });
      } else {
        // Show popup when no transport cards available
        mapNode.addEventListener('click', () => {
          showToast('传送失败', '传送卡不足，无法传送', 'error');
        });
      }
    }
    
    mapNodes.appendChild(mapNode);
  });
}

function openTransportModal(nodeId) {
  const node = storyNodes[nodeId];
  const chapterNames = getChapterNames();
  const chapterName = chapterNames[nodeId] || `第${nodeId}章`;
  
  document.getElementById('transportTarget').textContent = chapterName;
  
  const confirmBtn = document.getElementById('confirmTransportBtn');
  confirmBtn.onclick = () => {
    confirmTransport(nodeId);
  };
  
  openModal('transportModal');
}

async function confirmTransport(nodeId) {
  if (gameState.transportCards <= 0) {
    showToast('传送失败', '传送卡不足', 'error');
    return;
  }
  
  // Consume transport card
  gameState.transportCards -= 1;
  
  // Update state
  gameState.previousNode = gameState.currentChapter;
  gameState.currentChapter = nodeId;
  
  saveGame();
  closeModal('transportModal');
  closeModal('storyMapModal'); // Close the map after successful transport
  await loadCurrentStory();
  
  const chapterNames = getChapterNames();
  const chapterName = chapterNames[nodeId] || `第${nodeId}章`;
  showToast('传送成功', `已传送到${chapterName}，剩余传送卡：${gameState.transportCards}`);
}

async function handleRestart() {
  // Reset game state but keep visited nodes
  gameState.currentChapter = "1";
  gameState.playerChoices = [];
  gameState.previousNode = null;
  gameState.lifePoints = CONFIG.INITIAL_LIFE_POINTS;
  gameState.transportCards = CONFIG.INITIAL_TRANSPORT_CARDS;
  // Keep visitedNodes to preserve map progress
  
  saveGame();
  await loadCurrentStory();
  showToast('游戏重启', '游戏已重新开始，生命值和传送卡已恢复');
}

// Close modals when clicking outside
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    // Close any open modal
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});