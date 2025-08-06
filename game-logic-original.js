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
document.addEventListener('DOMContentLoaded', function() {
  setupEventListeners();
  checkSavedGame();
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
  
  // Initialize world rules content
  document.getElementById('worldRulesContent').innerHTML = `<pre>${worldRulesText}</pre>`;
}

function checkSavedGame() {
  const savedGame = localStorage.getItem('junYouJiFouGame');
  if (savedGame) {
    try {
      const saved = JSON.parse(savedGame);
      if (saved.user) {
        gameState = saved;
        showGame();
        return;
      }
    } catch (e) {
      console.error('Error loading saved game:', e);
    }
  }
  showLogin();
}

function showLogin() {
  loginScreen.classList.add('active');
  gameScreen.classList.remove('active');
}

function showGame() {
  loginScreen.classList.remove('active');
  gameScreen.classList.add('active');
  updateGameDisplay();
  loadCurrentStory();
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

function handleLogin() {
  const accountName = accountNameInput.value.trim();
  if (!accountName) {
    showToast('错误', '请输入账户名', 'error');
    return;
  }
  
  showLoading(true);
  
  // Simulate API call delay
  setTimeout(() => {
    const savedUsers = JSON.parse(localStorage.getItem('gameUsers') || '{}');
    const savedGame = savedUsers[accountName];
    
    if (savedGame) {
      gameState = savedGame;
      gameState.user = { accountName };
      saveGame();
      showToast('登录成功', `欢迎回来，${accountName}！`);
      showGame();
    } else {
      showToast('登录失败', '账户不存在，请先创建账户', 'error');
    }
    
    showLoading(false);
  }, 500);
}

function handleCreateAccount() {
  const accountName = accountNameInput.value.trim();
  if (!accountName) {
    showToast('错误', '请输入账户名', 'error');
    return;
  }
  
  showLoading(true);
  
  // Simulate API call delay
  setTimeout(() => {
    const savedUsers = JSON.parse(localStorage.getItem('gameUsers') || '{}');
    
    if (savedUsers[accountName]) {
      showToast('创建失败', '账户名已存在', 'error');
      showLoading(false);
      return;
    }
    
    // Create new game state
    gameState = {
      user: { accountName },
      currentChapter: "1",
      lifePoints: 5,
      transportCards: 3,
      visitedNodes: ["1"],
      playerChoices: [],
      previousNode: null,
      gameOver: false
    };
    
    saveGame();
    showToast('账户创建成功', `欢迎，${accountName}！`);
    showGame();
    showLoading(false);
  }, 500);
}

function handleLogout() {
  gameState.user = null;
  localStorage.removeItem('junYouJiFouGame');
  accountNameInput.value = '';
  showLogin();
  showToast('退出成功', '已成功退出登录');
}

function saveGame() {
  // Save current game state
  localStorage.setItem('junYouJiFouGame', JSON.stringify(gameState));
  
  // Save to users database
  const savedUsers = JSON.parse(localStorage.getItem('gameUsers') || '{}');
  savedUsers[gameState.user.accountName] = gameState;
  localStorage.setItem('gameUsers', JSON.stringify(savedUsers));
}

function updateGameDisplay() {
  lifePointsSpan.textContent = gameState.lifePoints;
  transportCardsSpan.textContent = gameState.transportCards;
  
  // Update backtrack button state
  const canBacktrack = gameState.previousNode && gameState.lifePoints > 0;
  const currentNode = storyNodes[gameState.currentChapter];
  const isContinueOnly = currentNode?.choices?.length === 1 && 
                        currentNode.choices[0].text === "继续";
  
  if (gameState.currentChapter === "1" || isContinueOnly || !canBacktrack) {
    backtrackBtn.disabled = true;
    backtrackBtn.textContent = gameState.lifePoints <= 0 ? '生命值不足' : '返回上一题';
  } else {
    backtrackBtn.disabled = false;
    backtrackBtn.textContent = '返回上一题';
  }
}

function loadCurrentStory() {
  const node = storyNodes[gameState.currentChapter];
  if (!node) {
    showToast('错误', '故事节点不存在', 'error');
    return;
  }
  
  storyTitle.textContent = node.title;
  storyText.innerHTML = node.text;
  
  // Clear previous choices
  choicesContainer.innerHTML = '';
  
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
  
  updateGameDisplay();
  updateStoryMap();
}

function handleChoice(choice) {
  // Handle restart game action
  if (choice.action === "restart_game") {
    gameState.currentChapter = "1";
    gameState.playerChoices = [];
    gameState.previousNode = null;
    gameState.lifePoints = 5;
    gameState.transportCards = 3;
    // Keep visitedNodes to preserve map progress
    saveGame();
    loadCurrentStory();
    showToast('游戏重启', '游戏已重新开始');
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
  loadCurrentStory();
  
  // Show auto-save notification (only for errors)
  // No success notification as requested
}

function handleBacktrack() {
  if (!gameState.previousNode || gameState.lifePoints <= 0) {
    return;
  }
  
  const currentNode = storyNodes[gameState.currentChapter];
  const isContinueOnly = currentNode?.choices?.length === 1 && 
                        currentNode.choices[0].text === "继续";
  
  if (gameState.currentChapter === "1" || isContinueOnly) {
    return;
  }
  
  // Consume life point
  gameState.lifePoints -= 1;
  
  // Go back to previous node
  const temp = gameState.currentChapter;
  gameState.currentChapter = gameState.previousNode;
  gameState.previousNode = null;
  
  // Remove last choice from history
  gameState.playerChoices.pop();
  
  saveGame();
  loadCurrentStory();
  
  showToast('回溯成功', `已返回上一题，剩余生命值：${gameState.lifePoints}`);
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
  
  // Create map nodes for visited chapters
  gameState.visitedNodes.forEach(nodeId => {
    const node = storyNodes[nodeId];
    if (!node) return;
    
    const mapNode = document.createElement('div');
    mapNode.className = 'map-node';
    
    if (nodeId === gameState.currentChapter) {
      mapNode.classList.add('current');
    } else {
      mapNode.classList.add('visited');
    }
    
    mapNode.innerHTML = `
      <div class="map-node-title">${chapterNames[nodeId] || `第${nodeId}章`}</div>
      <div class="map-node-text">${node.title}</div>
    `;
    
    // Add click handler for transport
    if (nodeId !== gameState.currentChapter && gameState.transportCards > 0) {
      mapNode.addEventListener('click', () => {
        openTransportModal(nodeId);
      });
    } else if (gameState.transportCards <= 0) {
      mapNode.classList.add('locked');
    }
    
    mapNodes.appendChild(mapNode);
  });
}

function openTransportModal(nodeId) {
  const node = storyNodes[nodeId];
  const chapterName = chapterNames[nodeId] || `第${nodeId}章`;
  
  document.getElementById('transportTarget').textContent = chapterName;
  
  const confirmBtn = document.getElementById('confirmTransportBtn');
  confirmBtn.onclick = () => {
    confirmTransport(nodeId);
  };
  
  openModal('transportModal');
}

function confirmTransport(nodeId) {
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
  loadCurrentStory();
  
  const chapterName = chapterNames[nodeId] || `第${nodeId}章`;
  showToast('传送成功', `已传送到${chapterName}，剩余传送卡：${gameState.transportCards}`);
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