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
const slotScreen = document.getElementById('slotScreen');
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
const endingsBtn = document.getElementById('endingsBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const toastContainer = document.getElementById('toastContainer');

// Initialize game
document.addEventListener('DOMContentLoaded', async function () {
  setupEventListeners();

  // Initialize spinner after a short delay to ensure DOM is ready
  setTimeout(() => {
    initializeSpinner();
  }, 100);

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

  // Test spinner button
  const testSpinnerBtn = document.getElementById('testSpinnerBtn');
  if (testSpinnerBtn) {
    testSpinnerBtn.addEventListener('click', () => {
      console.log('Test spinner button clicked');
      // Create mock game state for testing
      gameState = {
        user: { id: 'test-user', accountName: 'Test User' },
        currentChapter: "1",
        lifePoints: 5,
        transportCards: 3,
        visitedNodes: ["1"],
        playerChoices: [],
        previousNode: null,
        gameOver: false,
        unlockedEndings: []
      };
      showSpinnerForNewGame();
    });
  }

  // Force spinner button
  const forceSpinnerBtn = document.getElementById('forceSpinnerBtn');
  if (forceSpinnerBtn) {
    forceSpinnerBtn.addEventListener('click', () => {
      console.log('Force spinner button clicked');
      forceShowSpinner();
    });
  }

  // Enter key for login
  accountNameInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      handleLogin();
    }
  });

  // Game controls
  backtrackBtn.addEventListener('click', handleBacktrack);
  worldRulesBtn.addEventListener('click', () => openModal('worldRulesModal'));
  storyMapBtn.addEventListener('click', () => openModal('storyMapModal'));
  if (endingsBtn) {
    endingsBtn.addEventListener('click', () => openModal('endingsModal'));
  }

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
  console.log('showGame called');
  console.log('gameState:', gameState);

  loginScreen.classList.remove('active');

  // Check if this is a new game (no visited nodes or only starting node)
  const isNewGame = gameState.visitedNodes.length <= 1 &&
    (gameState.currentChapter === "1" || gameState.playerChoices.length === 0);

  console.log('isNewGame:', isNewGame);
  console.log('visitedNodes.length:', gameState.visitedNodes.length);
  console.log('currentChapter:', gameState.currentChapter);
  console.log('playerChoices.length:', gameState.playerChoices.length);

  if (isNewGame) {
    console.log('New game detected, showing slot machine');
    showSlotMachineForNewGame();
  } else {
    console.log('Existing game, loading story');
    gameScreen.classList.add('active');
    updateGameDisplay();
    await loadCurrentStory();
  }
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

// Expose toast utility for other modules (e.g., storage-service)
if (typeof window !== 'undefined') {
  window.showToast = showToast;
}

async function handleLogin() {
  const accountName = accountNameInput.value.trim();
  if (!accountName) {
    showToast('错误', '请输入账户名', 'error');
    return;
  }

  showLoading(true);

  try {
    console.log('Attempting login for:', accountName);

    // Try to load existing user from localStorage first
    const users = storageService.loadFromLocal(CONFIG.STORAGE_KEYS.USERS) || {};
    let user = users[accountName];
    let existingGameState = null;

    if (user) {
      // User exists locally, load their game state
      existingGameState = storageService.loadFromLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${user.id}`);
      console.log('Found existing user locally:', user);
    }

    if (user && existingGameState) {
      // Use existing user and game state
      gameState = {
        user: user,
        ...existingGameState
      };
      console.log('Loaded existing game state:', gameState);
    } else {
      // Create new user in local mode
      console.log('Creating new user in local mode:', accountName);

      const mockUser = {
        id: 'local-' + Date.now(),
        accountName: accountName,
        createdAt: new Date().toISOString()
      };

      gameState = {
        user: mockUser,
        currentChapter: "1",
        lifePoints: 5,
        transportCards: 3,
        visitedNodes: ["1"],
        playerChoices: [],
        previousNode: null,
        gameOver: false,
        unlockedEndings: []
      };

      // Save new user to localStorage
      users[accountName] = mockUser;
      storageService.saveToLocal(CONFIG.STORAGE_KEYS.USERS, users);
      storageService.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${mockUser.id}`, {
        currentChapter: gameState.currentChapter,
        lifePoints: gameState.lifePoints,
        transportCards: gameState.transportCards,
        visitedNodes: gameState.visitedNodes,
        playerChoices: gameState.playerChoices,
        previousNode: gameState.previousNode,
        gameOver: gameState.gameOver,
        unlockedEndings: gameState.unlockedEndings
      });

      console.log('Created new user and game state:', gameState);
    }

    // Save current game state
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);

    showToast('登录成功', `欢迎，${accountName}！`);
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
    console.log('Creating account in local mode:', accountName);

    // Check if account already exists locally
    const users = storageService.loadFromLocal(CONFIG.STORAGE_KEYS.USERS) || {};
    const accountNameLower = accountName.toLowerCase();

    // Check for exact match first
    if (users[accountName]) {
      throw new Error('账户名已存在，请选择其他名称');
    }

    // Check for case-insensitive match
    for (const existingName in users) {
      if (existingName.toLowerCase() === accountNameLower) {
        throw new Error('账户名已存在，请选择其他名称');
      }
    }

    console.log('No duplicate found, creating new account:', accountName);

    // Create new user
    const newUser = {
      id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      accountName: accountName,
      createdAt: new Date().toISOString()
    };

    // Create initial game state
    const initialGameState = {
      currentChapter: "1",
      lifePoints: 5,
      transportCards: 3,
      visitedNodes: ["1"],
      playerChoices: [],
      previousNode: null,
      gameOver: false,
      unlockedEndings: []
    };

    // Save new user to localStorage
    users[accountName] = newUser;
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.USERS, users);
    storageService.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${newUser.id}`, initialGameState);

    // Set up current game state
    gameState = {
      user: newUser,
      ...initialGameState
    };

    // Save current game state
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);

    console.log('Account created successfully:', newUser);
    showToast('账户创建成功', `欢迎，${accountName}！`);
    await showGame();
  } catch (error) {
    console.error('Create account error:', error);
    showToast('创建失败', error.message, 'error');
  } finally {
    showLoading(false);
  }
}

function handleLogout() {
  // Just clear the user and show login screen
  gameState.user = null;
  accountNameInput.value = '';
  showLogin();
  showToast('退出成功', '已成功退出登录');
}

function saveGame() {
  try {
    console.log('Saving game locally:', gameState.currentChapter);

    // Always save to localStorage for immediate access
    storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);

    // Also save the game state separately for the user
    if (gameState.user && gameState.user.id) {
      const gameStateToSave = {
        currentChapter: gameState.currentChapter,
        lifePoints: gameState.lifePoints,
        transportCards: gameState.transportCards,
        visitedNodes: gameState.visitedNodes,
        playerChoices: gameState.playerChoices,
        previousNode: gameState.previousNode,
        gameOver: gameState.gameOver,
        unlockedEndings: gameState.unlockedEndings || []
      };

      storageService.saveToLocal(`${CONFIG.STORAGE_KEYS.GAME_STATE_PREFIX}${gameState.user.id}`, gameStateToSave);
    }
  } catch (error) {
    console.error('Error saving game:', error);
    // Fallback to basic localStorage save
    try {
      storageService.saveToLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME, gameState);
    } catch (fallbackError) {
      console.error('Fallback save also failed:', fallbackError);
    }
  }
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

  // Display title without chapter number for regular nodes, add incremental number for endings
  if (node.isEnding) {
    // Get ending number based on the order of ending nodes
    const endingNumber = getEndingNumber(gameState.currentChapter);
    storyTitle.textContent = `结局 ${endingNumber}`;
    // Track unlocked endings
    if (!Array.isArray(gameState.unlockedEndings)) {
      gameState.unlockedEndings = [];
    }
    const endingId = gameState.currentChapter;
    if (!gameState.unlockedEndings.includes(endingId)) {
      gameState.unlockedEndings.push(endingId);
      saveGame();
    }
  } else {
    // Remove "第x章" prefix and just show the title
    storyTitle.textContent = node.title;
  }
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
  updateEndingsGrid();
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

  // Find the previous node in the choice history
  const lastChoice = gameState.playerChoices[gameState.playerChoices.length - 1];
  if (!lastChoice) {
    showToast('无法回溯', '没有可回溯的节点', 'error');
    return;
  }

  // Go back to previous node
  gameState.currentChapter = lastChoice.chapter;

  // Find the previous previous node
  const previousChoice = gameState.playerChoices[gameState.playerChoices.length - 2];
  gameState.previousNode = previousChoice ? previousChoice.chapter : null;

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
  } else if (modalId === 'endingsModal') {
    updateEndingsGrid();
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

    // Remove "第x章" prefix from map display
    const displayName = node.title || `第${nodeId}章`;
    mapNode.innerHTML = `
      <div class="map-node-title">${displayName}</div>
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
  const nodeName = node ? node.title : `第${nodeId}章`;

  document.getElementById('transportTarget').textContent = nodeName;

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

  // Use node title instead of chapter name for transport notification
  const node = storyNodes[nodeId];
  const nodeName = node ? node.title : `第${nodeId}章`;
  showToast('传送成功', `已传送到${nodeName}，剩余传送卡：${gameState.transportCards}`);
}

async function handleRestart() {
  // Always force a fresh start when user selects restart
  gameState.currentChapter = "1";
  gameState.playerChoices = [];
  gameState.previousNode = null;
  gameState.lifePoints = CONFIG.INITIAL_LIFE_POINTS;
  gameState.transportCards = CONFIG.INITIAL_TRANSPORT_CARDS;
  gameState.visitedNodes = ["1"]; // Clear unlocked nodes
  gameState.unlockedEndings = []; // Clear unlocked endings

  saveGame();
  await loadCurrentStory();
  showToast('游戏重启', '游戏已重新开始，所有节点已重置，生命值和传送卡已恢复');
}

// Close modals when clicking outside
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    // Close any open modal
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }
});

// Helper function to get ending number
function getEndingNumber(endingNodeId) {
  // Get all ending nodes and sort them to maintain consistent numbering
  const endingNodes = Object.keys(storyNodes).filter(nodeId =>
    nodeId.startsWith('ending_') && storyNodes[nodeId]?.isEnding
  ).sort();

  // Find the index of the current ending node
  const endingIndex = endingNodes.indexOf(endingNodeId);

  // Return 1-based index (or 1 if not found)
  return endingIndex >= 0 ? endingIndex + 1 : 1;
}

// Render endings grid similar to the map
function updateEndingsGrid() {
  const container = document.getElementById('endingNodes');
  if (!container) return;
  container.innerHTML = '';

  // Prepare ordered endings list
  const endingIds = Object.keys(storyNodes)
    .filter(id => id.startsWith('ending_') && storyNodes[id]?.isEnding)
    .sort();

  const unlocked = new Set(Array.isArray(gameState.unlockedEndings) ? gameState.unlockedEndings : []);

  endingIds.forEach(id => {
    const node = storyNodes[id];
    const n = getEndingNumber(id);
    const card = document.createElement('div');
    card.className = 'map-node';
    if (unlocked.has(id)) {
      card.classList.add('visited');
    } else {
      card.classList.add('locked');
    }
    // Always show title per request
    const title = node?.title ? `结局 ${n}：${node.title}` : `结局 ${n}`;
    card.innerHTML = `<div class="map-node-title">${title}</div>`;
    container.appendChild(card);
  });
}

// SPINNER SYSTEM
// Define the 17 possible combinations with their corresponding story nodes
// Each location appears only once in the inner spinner
const SPINNER_COMBINATIONS = [
  // Group 1: The Traveler (Default)
  {
    location: "陈老故乡",
    identity: "游客",
    startingNode: "1",
    locationIndex: 0
  },
  // Group 2: The Reborn Entertainer/Concubine
  {
    location: "太尉府",
    identity: "伶人/琴师",
    startingNode: "12",
    locationIndex: 1
  },
  {
    location: "皇宫",
    identity: "昭仪",
    startingNode: "13",
    locationIndex: 2
  },
  // Group 3: The Official
  {
    location: "朝堂",
    identity: "中央官员",
    startingNode: "60",
    locationIndex: 3
  },
  {
    location: "州郡",
    identity: "地方官",
    startingNode: "23",
    locationIndex: 4
  },
  // Group 4: The Soldier
  {
    location: "皇宫卫队",
    identity: "羽林军",
    startingNode: "33",
    locationIndex: 5
  },
  {
    location: "皇城",
    identity: "禁军",
    startingNode: "34",
    locationIndex: 6
  },
  {
    location: "京城",
    identity: "直属戍卒",
    startingNode: "38",
    locationIndex: 7
  },
  {
    location: "淮南王府",
    identity: "淮南王麾下军士",
    startingNode: "45",
    locationIndex: 8
  },
  {
    location: "南境军营",
    identity: "南境军营军士",
    startingNode: "54",
    locationIndex: 9
  },
  {
    location: "寿春城",
    identity: "寿春城防军",
    startingNode: "55",
    locationIndex: 10
  },
  // Group 5: The Merchant & Artisan
  {
    location: "襄阳/江上",
    identity: "行商",
    startingNode: "63",
    locationIndex: 11
  },
  {
    location: "长安",
    identity: "酒楼老板",
    startingNode: "84",
    locationIndex: 12
  },
  // Additional combinations for remaining identities
  {
    location: "皇宫",
    identity: "舞姬",
    startingNode: "14",
    locationIndex: 2 // Same location as 昭仪
  },
  {
    location: "长安",
    identity: "点心铺老板",
    startingNode: "83",
    locationIndex: 12 // Same location as 酒楼老板
  },
  {
    location: "长安",
    identity: "面馆老板",
    startingNode: "140",
    locationIndex: 12 // Same location as 酒楼老板
  },
  {
    location: "长安",
    identity: "天灯手艺人",
    startingNode: "142",
    locationIndex: 12 // Same location as 酒楼老板
  }
];

// Define unique locations for inner spinner (13 unique locations)
const SPINNER_LOCATIONS = [
  "陈老故乡", "太尉府", "皇宫", "朝堂", "州郡",
  "皇宫卫队", "皇城", "京城", "淮南王府", "南境军营",
  "寿春城", "襄阳/江上", "长安"
];

// Define unique identities for outer spinner (17 unique identities)
const SPINNER_IDENTITIES = [
  "游客", "伶人/琴师", "昭仪", "舞姬", "中央官员", "地方官",
  "羽林军", "禁军", "直属戍卒", "淮南王麾下军士", "南境军营军士",
  "寿春城防军", "行商", "酒楼老板", "点心铺老板", "面馆老板", "天灯手艺人"
];

// Spinner state
let spinnerState = {
  isSpinning: false,
  isPressed: false,
  pressStartTime: 0,
  butterflyInterval: null,
  spinInterval: null,
  outerRotation: 0,
  innerRotation: 0,
  outerSpeed: 0,
  innerSpeed: 0,
  animationId: null
};

// DOM elements for spinner
let spinnerScreen, spinnerOuter, spinnerInner, enterWorldBtn, spinnerResult, resultLocation, resultIdentity, butterflyContainer, startGameBtn;

// Initialize spinner DOM elements
function initializeSpinnerElements() {
  spinnerScreen = document.getElementById('spinnerScreen');
  spinnerOuter = document.querySelector('.spinner-outer');
  spinnerInner = document.querySelector('.spinner-inner');
  enterWorldBtn = document.getElementById('enterWorldBtn');
  spinnerResult = document.getElementById('spinnerResult');
  resultLocation = document.getElementById('resultLocation');
  resultIdentity = document.getElementById('resultIdentity');
  butterflyContainer = document.getElementById('butterflyContainer');
  startGameBtn = document.getElementById('startGameBtn');

  console.log('Spinner elements found:', {
    spinnerScreen: !!spinnerScreen,
    spinnerOuter: !!spinnerOuter,
    spinnerInner: !!spinnerInner,
    enterWorldBtn: !!enterWorldBtn,
    startGameBtn: !!startGameBtn
  });

  // Generate spinner segments
  generateSpinnerSegments();

  // Add start game button event listener
  if (startGameBtn) {
    startGameBtn.addEventListener('click', handleStartGame);
  }
}

// Generate spinner segments with text
function generateSpinnerSegments() {
  const outerSegments = document.getElementById('outerSegments');
  const innerSegments = document.getElementById('innerSegments');

  console.log('Generating segments...', { outerSegments: !!outerSegments, innerSegments: !!innerSegments });

  if (!outerSegments || !innerSegments) {
    console.warn('Spinner segment containers not found');
    console.log('Available elements:', {
      spinnerScreen: !!document.getElementById('spinnerScreen'),
      spinnerOuter: !!document.querySelector('.spinner-outer'),
      spinnerInner: !!document.querySelector('.spinner-inner')
    });
    return;
  }

  // Clear existing segments
  outerSegments.innerHTML = '';
  innerSegments.innerHTML = '';

  // Generate outer segments (identities)
  SPINNER_IDENTITIES.forEach((identity, index) => {
    const segment = document.createElement('div');
    segment.className = 'spinner-segment';
    segment.textContent = identity;

    const angle = (360 / SPINNER_IDENTITIES.length) * index;
    segment.style.transform = `rotate(${angle}deg)`;

    outerSegments.appendChild(segment);
  });

  // Generate inner segments (locations)
  SPINNER_LOCATIONS.forEach((location, index) => {
    const segment = document.createElement('div');
    segment.className = 'spinner-segment';
    segment.textContent = location;

    const angle = (360 / SPINNER_LOCATIONS.length) * index;
    segment.style.transform = `rotate(${angle}deg)`;

    innerSegments.appendChild(segment);
  });

  console.log(`Generated ${SPINNER_IDENTITIES.length} identity segments and ${SPINNER_LOCATIONS.length} location segments`);
}

// Initialize spinner functionality
function initializeSpinner() {
  // Wait for DOM to be ready
  setTimeout(() => {
    initializeSpinnerElements();

    if (!enterWorldBtn) {
      console.warn('Spinner elements not found, retrying...');
      setTimeout(initializeSpinner, 500);
      return;
    }

    // Mouse events for desktop
    enterWorldBtn.addEventListener('mousedown', startSpinner);
    enterWorldBtn.addEventListener('mouseup', stopSpinner);
    enterWorldBtn.addEventListener('mouseleave', stopSpinner);

    // Touch events for mobile
    enterWorldBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startSpinner(e);
    });
    enterWorldBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      stopSpinner(e);
    });
    enterWorldBtn.addEventListener('touchcancel', (e) => {
      e.preventDefault();
      stopSpinner(e);
    });

    // Prevent context menu on long press
    enterWorldBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    console.log('Spinner initialized successfully');
  }, 100);
}

// Start spinner animation
function startSpinner(e) {
  e.preventDefault();
  if (spinnerState.isSpinning) return;

  spinnerState.isPressed = true;
  spinnerState.pressStartTime = Date.now();
  spinnerState.isSpinning = true;

  // Set initial speeds
  spinnerState.outerSpeed = 15; // degrees per frame
  spinnerState.innerSpeed = 12; // degrees per frame

  // Start spinning animation
  startSpinningAnimation();

  // Start butterfly effect
  startButterflyEffect();

  // Hide result if it was showing
  spinnerResult.classList.remove('show');
}

// Stop spinner animation
function stopSpinner(e) {
  e.preventDefault();
  if (!spinnerState.isPressed) return;

  spinnerState.isPressed = false;

  // Start deceleration
  startDeceleration();

  // Stop butterfly effect
  stopButterflyEffect();
}

// Start butterfly effect
function startButterflyEffect() {
  spinnerState.butterflyInterval = setInterval(() => {
    createButterfly();
  }, 300);
}

// Stop butterfly effect
function stopButterflyEffect() {
  if (spinnerState.butterflyInterval) {
    clearInterval(spinnerState.butterflyInterval);
    spinnerState.butterflyInterval = null;
  }
}

// Start spinning animation
function startSpinningAnimation() {
  function animate() {
    if (!spinnerState.isSpinning) return;

    // Update rotations
    spinnerState.outerRotation += spinnerState.outerSpeed;
    spinnerState.innerRotation += spinnerState.innerSpeed;

    // Apply rotations to the spinner rings
    if (spinnerOuter) {
      spinnerOuter.style.transform = `rotate(${spinnerState.outerRotation}deg)`;
    }
    if (spinnerInner) {
      spinnerInner.style.transform = `rotate(${spinnerState.innerRotation}deg)`;
    }

    // Continue animation
    spinnerState.animationId = requestAnimationFrame(animate);
  }

  animate();
}

// Start deceleration
function startDeceleration() {
  const decelerationRate = 0.98; // Slow down factor
  const minSpeed = 0.1; // Minimum speed before stopping

  function decelerate() {
    // Decelerate both spinners
    spinnerState.outerSpeed *= decelerationRate;
    spinnerState.innerSpeed *= decelerationRate;

    // Update rotations
    spinnerState.outerRotation += spinnerState.outerSpeed;
    spinnerState.innerRotation += spinnerState.innerSpeed;

    // Apply rotations
    if (spinnerOuter) {
      spinnerOuter.style.transform = `rotate(${spinnerState.outerRotation}deg)`;
    }
    if (spinnerInner) {
      spinnerInner.style.transform = `rotate(${spinnerState.innerRotation}deg)`;
    }

    // Check if both spinners have stopped
    if (spinnerState.outerSpeed > minSpeed || spinnerState.innerSpeed > minSpeed) {
      requestAnimationFrame(decelerate);
    } else {
      // Spinners have stopped
      spinnerState.isSpinning = false;
      if (spinnerState.animationId) {
        cancelAnimationFrame(spinnerState.animationId);
        spinnerState.animationId = null;
      }

      // Remove spinning class from button
      if (enterWorldBtn) {
        enterWorldBtn.classList.remove('spinning');
      }

      // Show result
      showSpinnerResult();
    }
  }

  decelerate();
}

// Create butterfly effect
function createButterfly() {
  if (!butterflyContainer) return;

  const butterfly = document.createElement('div');
  butterfly.className = 'butterfly';

  // Random starting position around the spinner
  const angle = Math.random() * 360;
  const radius = 200 + Math.random() * 100;
  const startX = Math.cos(angle * Math.PI / 180) * radius;
  const startY = Math.sin(angle * Math.PI / 180) * radius;

  // Random end position
  const endX = (Math.random() - 0.5) * 400;
  const endY = (Math.random() - 0.5) * 400;

  butterfly.style.left = `calc(50% + ${startX}px)`;
  butterfly.style.top = `calc(50% + ${startY}px)`;
  butterfly.style.setProperty('--end-x', `${endX}px`);
  butterfly.style.setProperty('--end-y', `${endY}px`);

  butterflyContainer.appendChild(butterfly);

  // Remove butterfly after animation
  setTimeout(() => {
    if (butterfly.parentNode) {
      butterfly.parentNode.removeChild(butterfly);
    }
  }, 2000);
}

// Show spinner result
function showSpinnerResult() {
  // Calculate which segments the pointer is pointing to
  const selectedCombination = calculateSelectedCombination();

  // Display result
  if (resultLocation && resultIdentity) {
    resultLocation.textContent = selectedCombination.location;
    resultIdentity.textContent = selectedCombination.identity;
  }

  // Store selected combination for game start
  spinnerState.selectedCombination = selectedCombination;

  // Show result with animation
  if (spinnerResult) {
    spinnerResult.classList.add('show');
  }
}

// Calculate selected combination based on spinner positions
function calculateSelectedCombination() {
  // Normalize rotations to 0-360 degrees
  const normalizedOuter = ((spinnerState.outerRotation % 360) + 360) % 360;
  const normalizedInner = ((spinnerState.innerRotation % 360) + 360) % 360;

  // Calculate which segment the pointer (top) is pointing to
  // The pointer is at the top (0 degrees), so we need to find which segment is at that position
  const outerSegmentAngle = 360 / SPINNER_IDENTITIES.length;
  const innerSegmentAngle = 360 / SPINNER_LOCATIONS.length;

  // Calculate selected indices (accounting for rotation direction)
  const selectedIdentityIndex = Math.floor(normalizedOuter / outerSegmentAngle) % SPINNER_IDENTITIES.length;
  const selectedLocationIndex = Math.floor(normalizedInner / innerSegmentAngle) % SPINNER_LOCATIONS.length;

  const selectedLocation = SPINNER_LOCATIONS[selectedLocationIndex];
  const selectedIdentity = SPINNER_IDENTITIES[selectedIdentityIndex];

  // Find the corresponding combination and starting node
  const combination = SPINNER_COMBINATIONS.find(combo =>
    combo.location === selectedLocation && combo.identity === selectedIdentity
  );

  // If exact combination not found, use the first combination with matching location
  const fallbackCombination = SPINNER_COMBINATIONS.find(combo =>
    combo.location === selectedLocation
  ) || SPINNER_COMBINATIONS[0]; // Ultimate fallback

  return combination || fallbackCombination;
}

// Handle start game button click
function handleStartGame() {
  if (!spinnerState.selectedCombination) {
    console.error('No combination selected');
    return;
  }

  // Update game state with selected starting node
  gameState.currentChapter = spinnerState.selectedCombination.startingNode;
  gameState.visitedNodes = [spinnerState.selectedCombination.startingNode];
  gameState.playerChoices = [];
  gameState.previousNode = null;

  // Save game state
  saveGame();

  // Fade out spinner screen and show game
  if (spinnerScreen) {
    spinnerScreen.classList.add('fade-out');
    setTimeout(() => {
      spinnerScreen.classList.remove('active', 'fade-out');
      gameScreen.classList.add('active');
      loadCurrentStory();
    }, 1000);
  }
}

// Show spinner for new game
function showSpinnerForNewGame() {
  console.log('Showing spinner for new game');

  // Hide other screens
  loginScreen.classList.remove('active');
  gameScreen.classList.remove('active');

  // Show spinner screen
  if (spinnerScreen) {
    spinnerScreen.classList.add('active');
  }

  // Reset spinner state
  spinnerState = {
    isSpinning: false,
    isPressed: false,
    pressStartTime: 0,
    butterflyInterval: null,
    spinInterval: null,
    outerRotation: 0,
    innerRotation: 0,
    outerSpeed: 0,
    innerSpeed: 0,
    animationId: null,
    selectedCombination: null
  };

  // Reset spinner visual state
  if (spinnerOuter) {
    spinnerOuter.style.transform = 'rotate(0deg)';
  }
  if (spinnerInner) {
    spinnerInner.style.transform = 'rotate(0deg)';
  }
  if (spinnerResult) {
    spinnerResult.classList.remove('show');
  }
  if (butterflyContainer) {
    butterflyContainer.innerHTML = '';
  }
}

// Force show spinner (for testing)
function forceShowSpinner() {
  console.log('Force showing spinner');
  showSpinnerForNewGame();
} peed > minSpeed) {
  spinnerState.animationId = requestAnimationFrame(decelerate);
} else {
  // Spinners have stopped, determine result
  spinnerState.isSpinning = false;
  const result = determineSpinnerResult();
  showSpinnerResult(result);

  // Wait a moment then transition to game
  setTimeout(() => {
    transitionToGame(result);
  }, 2000);
}
  }

decelerate();
}

// Create a single butterfly
function createButterfly() {
  const butterfly = document.createElement('div');
  butterfly.className = 'butterfly';

  // Random position around the spinner
  const angle = Math.random() * Math.PI * 2;
  const distance = 150 + Math.random() * 100;
  const x = Math.cos(angle) * distance + 200;
  const y = Math.sin(angle) * distance + 200;

  butterfly.style.left = `${x}px`;
  butterfly.style.top = `${y}px`;

  butterflyContainer.appendChild(butterfly);

  // Remove butterfly after animation
  setTimeout(() => {
    if (butterfly.parentNode) {
      butterfly.parentNode.removeChild(butterfly);
    }
  }, 3000);
}

// Determine spinner result based on final positions
function determineSpinnerResult() {
  // Get current rotation angles (normalize to 0-360)
  const outerRotation = ((spinnerState.outerRotation % 360) + 360) % 360;
  const innerRotation = ((spinnerState.innerRotation % 360) + 360) % 360;

  // Calculate which segments are pointing to the top (12 o'clock position)
  // The pointer is at the top, so we need to find which segment is under it
  const normalizedOuterRotation = (360 - outerRotation) % 360;
  const normalizedInnerRotation = (360 - innerRotation) % 360;

  // Calculate segment indices
  const outerSegment = Math.floor(normalizedOuterRotation / (360 / SPINNER_IDENTITIES.length)) % SPINNER_IDENTITIES.length;
  const innerSegment = Math.floor(normalizedInnerRotation / (360 / SPINNER_LOCATIONS.length)) % SPINNER_LOCATIONS.length;

  // Get the selected location and identity
  const selectedLocation = SPINNER_LOCATIONS[innerSegment];
  const selectedIdentity = SPINNER_IDENTITIES[outerSegment];

  // Find the matching combination from our predefined list
  let matchingCombination = SPINNER_COMBINATIONS.find(combo =>
    combo.location === selectedLocation && combo.identity === selectedIdentity
  );

  // If no exact match found, find any combination with the selected location
  if (!matchingCombination) {
    matchingCombination = SPINNER_COMBINATIONS.find(combo =>
      combo.location === selectedLocation
    );
  }

  // If still no match, use default
  if (!matchingCombination) {
    matchingCombination = SPINNER_COMBINATIONS[0];
  }

  console.log(`Spinner result: ${matchingCombination.location} + ${matchingCombination.identity} -> Node ${matchingCombination.startingNode}`);

  return matchingCombination;
}



// Show spinner result
function showSpinnerResult(result) {
  resultLocation.textContent = result.location;
  resultIdentity.textContent = result.identity;
  spinnerResult.classList.add('show');
}

// Transition to game with selected starting point
function transitionToGame(result) {
  console.log('Transitioning to game with result:', result);

  // Update game state with new starting point
  gameState.currentChapter = result.startingNode;
  gameState.visitedNodes = [result.startingNode];
  gameState.playerChoices = [];
  gameState.previousNode = null;

  // Save the new game state
  saveGame();

  // Fade out spinner screen
  spinnerScreen.classList.add('fade-out');

  // After fade out, show game screen
  setTimeout(() => {
    spinnerScreen.classList.remove('active', 'fade-out');

    // Clear any remaining butterflies
    if (butterflyContainer) {
      butterflyContainer.innerHTML = '';
    }

    // Show game screen and load story
    gameScreen.classList.add('active');
    updateGameDisplay();
    loadCurrentStory();

    console.log('Game started with chapter:', gameState.currentChapter);
  }, 1000);
}

// Show spinner screen for new game
function showSpinnerForNewGame() {
  console.log('showSpinnerForNewGame called');

  // Hide login screen first
  loginScreen.classList.remove('active');
  gameScreen.classList.remove('active');

  // Ensure spinner elements are initialized
  if (!spinnerScreen) {
    console.log('Initializing spinner elements...');
    initializeSpinnerElements();
  }

  // Show spinner screen
  spinnerScreen.classList.add('active');

  // Force visibility with inline styles for debugging
  if (spinnerScreen) {
    spinnerScreen.style.display = 'flex';
    spinnerScreen.style.position = 'fixed';
    spinnerScreen.style.top = '0';
    spinnerScreen.style.left = '0';
    spinnerScreen.style.width = '100%';
    spinnerScreen.style.height = '100%';
    spinnerScreen.style.backgroundColor = '#2c3e50';
    spinnerScreen.style.zIndex = '9999';
    console.log('Forced spinner screen visibility');
  }

  if (spinnerResult) {
    spinnerResult.classList.remove('show');
  }

  // Make sure segments are generated after a short delay
  setTimeout(() => {
    if (!document.getElementById('outerSegments') || !document.getElementById('innerSegments')) {
      console.log('Segment containers not found, reinitializing...');
      initializeSpinnerElements();
    }
    generateSpinnerSegments();
    console.log('Segments generated after delay');
  }, 100);

  // Reset spinner state
  spinnerState.isSpinning = false;
  spinnerState.isPressed = false;
  spinnerState.pressStartTime = 0;
  spinnerState.outerRotation = 0;
  spinnerState.innerRotation = 0;
  spinnerState.outerSpeed = 0;
  spinnerState.innerSpeed = 0;

  // Reset spinner positions
  if (spinnerOuter) spinnerOuter.style.transform = 'rotate(0deg)';
  if (spinnerInner) spinnerInner.style.transform = 'rotate(0deg)';

  // Cancel any ongoing animation
  if (spinnerState.animationId) {
    cancelAnimationFrame(spinnerState.animationId);
    spinnerState.animationId = null;
  }

  console.log('Spinner screen setup complete');
}

// Force show spinner for debugging
function forceShowSpinner() {
  console.log('Force showing spinner...');

  // Get spinner screen element
  const spinnerScreen = document.getElementById('spinnerScreen');
  const loginScreen = document.getElementById('loginScreen');
  const gameScreen = document.getElementById('gameScreen');

  console.log('Elements found:', {
    spinnerScreen: !!spinnerScreen,
    loginScreen: !!loginScreen,
    gameScreen: !!gameScreen
  });

  // Hide other screens
  if (loginScreen) {
    loginScreen.classList.remove('active');
    loginScreen.style.display = 'none';
  }
  if (gameScreen) {
    gameScreen.classList.remove('active');
    gameScreen.style.display = 'none';
  }

  // Force show spinner screen
  if (spinnerScreen) {
    spinnerScreen.classList.add('debug');
    spinnerScreen.classList.add('active');

    console.log('Spinner screen classes:', spinnerScreen.className);
    console.log('Spinner screen computed style:', window.getComputedStyle(spinnerScreen).display);

    // Add some
    // Add some test content
    spinnerScreen.innerHTML = `
      <div style="color: white; font-size: 2rem; text-align: center;">
        <h1>转盘测试</h1>
        <p>如果你看到这个，说明转盘屏幕可以显示</p>
        <div style="width: 200px; height: 200px; background: blue; border-radius: 50%; margin: 20px auto;"></div>
      </div>
    `;
  } else {
    console.error('Spinner screen element not found!');
  }
}


// SLOT MACHINE SYSTEM FOR NEW GAME
// Include the slot machine data and logic
const SPINNER_COMBINATIONS = [
  { location: "陈老故乡", identity: "游客", startingNode: "1" },
  { location: "太尉府", identity: "伶人/琴师", startingNode: "12" },
  { location: "皇宫", identity: "昭仪", startingNode: "13" },
  { location: "朝堂", identity: "中央官员", startingNode: "60" },
  { location: "州郡", identity: "地方官", startingNode: "23" },
  { location: "皇宫卫队", identity: "羽林军", startingNode: "33" },
  { location: "皇城", identity: "禁军", startingNode: "34" },
  { location: "京城", identity: "直属戍卒", startingNode: "38" },
  { location: "淮南王府", identity: "淮南王麾下军士", startingNode: "45" },
  { location: "南境军营", identity: "南境军营军士", startingNode: "54" },
  { location: "寿春城", identity: "寿春城防军", startingNode: "55" },
  { location: "襄阳/江上", identity: "行商", startingNode: "63" },
  { location: "长安", identity: "酒楼老板", startingNode: "84" },
  { location: "皇宫", identity: "舞姬", startingNode: "14" },
  { location: "长安", identity: "点心铺老板", startingNode: "83" },
  { location: "长安", identity: "面馆老板", startingNode: "140" },
  { location: "长安", identity: "天灯手艺人", startingNode: "142" }
];

const SPINNER_IDENTITIES = [
  "游客", "伶人/琴师", "昭仪", "舞姬", "中央官员", "地方官",
  "羽林军", "禁军", "直属戍卒", "淮南王麾下军士", "南境军营军士",
  "寿春城防军", "行商", "酒楼老板", "点心铺老板", "面馆老板", "天灯手艺人"
];

// Slot machine state
let slotMachineState = {
  isSpinning: false,
  isPressed: false,
  identityReel: {
    position: 0,
    speed: 0,
    items: [],
    targetIndex: 0
  },
  selectedCombination: null,
  animationId: null
};

// Slot machine DOM elements
let identityContent, spinButton, slotResult, resultLocation, resultIdentity, startGameBtn;

// Show slot machine for new game
function showSlotMachineForNewGame() {
  console.log('Showing slot machine for new game');

  // Hide other screens
  loginScreen.classList.remove('active');
  gameScreen.classList.remove('active');

  // Show slot machine screen
  if (slotScreen) {
    slotScreen.classList.add('active');
  }

  // Initialize slot machine
  initializeSlotMachine();
}

// Initialize slot machine
function initializeSlotMachine() {
  // Get DOM elements
  identityContent = document.getElementById('identityContent');
  spinButton = document.getElementById('spinButton');
  slotResult = document.getElementById('slotResult');
  resultLocation = document.getElementById('resultLocation');
  resultIdentity = document.getElementById('resultIdentity');
  startGameBtn = document.getElementById('startGameBtn');

  if (!identityContent || !spinButton) {
    console.warn('Slot machine elements not found');
    return;
  }

  // Generate reel content
  generateSlotReelContent();

  // Add event listeners
  spinButton.addEventListener('mousedown', startSlotSpinning);
  spinButton.addEventListener('mouseup', stopSlotSpinning);
  spinButton.addEventListener('mouseleave', stopSlotSpinning);

  // Touch events for mobile
  spinButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startSlotSpinning(e);
  });
  spinButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopSlotSpinning(e);
  });
  spinButton.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    stopSlotSpinning(e);
  });

  // Prevent context menu
  spinButton.addEventListener('contextmenu', (e) => e.preventDefault());

  // Start game button
  if (startGameBtn) {
    startGameBtn.addEventListener('click', handleSlotStartGame);
  }

  console.log('Slot machine initialized');
}

// Generate slot reel content
function generateSlotReelContent() {
  if (!identityContent) return;

  const itemHeight = 80;

  // Generate identity reel with many repetitions
  identityContent.innerHTML = '';
  slotMachineState.identityReel.items = [];

  for (let repeat = 0; repeat < 50; repeat++) {
    SPINNER_IDENTITIES.forEach((identity, originalIndex) => {
      const item = document.createElement('div');
      item.className = 'reel-item';
      item.textContent = identity;
      item.dataset.value = identity;
      item.dataset.originalIndex = originalIndex;
      identityContent.appendChild(item);
      slotMachineState.identityReel.items.push(item);
    });
  }

  // Initialize reel properties
  slotMachineState.identityReel.itemHeight = itemHeight;
  slotMachineState.identityReel.cycleLength = SPINNER_IDENTITIES.length * itemHeight;

  // Start at middle position
  slotMachineState.identityReel.position = -25 * SPINNER_IDENTITIES.length * itemHeight;

  updateSlotReelPosition();
}

// Start slot spinning
function startSlotSpinning(e) {
  e.preventDefault();
  if (slotMachineState.isPressed || slotMachineState.isSpinning) return;

  slotMachineState.isPressed = true;
  slotMachineState.isSpinning = true;

  // Add visual feedback
  if (spinButton) {
    spinButton.classList.add('spinning');
  }

  // Set fast spinning speed
  slotMachineState.identityReel.speed = 30 + Math.random() * 20;

  // Start animation
  startSlotSpinAnimation();

  // Hide result
  if (slotResult) {
    slotResult.classList.remove('show');
  }

  // Clear highlights
  clearSlotHighlights();
}

// Stop slot spinning
function stopSlotSpinning(e) {
  e.preventDefault();
  if (!slotMachineState.isPressed) return;

  slotMachineState.isPressed = false;

  // Remove visual feedback
  if (spinButton) {
    spinButton.classList.remove('spinning');
  }

  // Start deceleration
  startSlotDeceleration();
}

// Start slot spin animation
function startSlotSpinAnimation() {
  function animate() {
    if (!slotMachineState.isSpinning) return;

    // Update position
    slotMachineState.identityReel.position += slotMachineState.identityReel.speed;

    // Wrap around
    if (slotMachineState.identityReel.position > -10 * slotMachineState.identityReel.cycleLength) {
      slotMachineState.identityReel.position -= slotMachineState.identityReel.cycleLength;
    }

    updateSlotReelPosition();

    slotMachineState.animationId = requestAnimationFrame(animate);
  }

  animate();
}

// Start slot deceleration
function startSlotDeceleration() {
  // Choose random combination
  const randomCombination = SPINNER_COMBINATIONS[Math.floor(Math.random() * SPINNER_COMBINATIONS.length)];
  const identityIndex = SPINNER_IDENTITIES.indexOf(randomCombination.identity);

  slotMachineState.identityReel.targetIndex = identityIndex;
  slotMachineState.selectedCombination = randomCombination;

  console.log('Selected combination:', randomCombination);

  const decelerationRate = 0.95;
  const minSpeed = 0.5;

  // Calculate target position for perfect centering
  const itemHeight = 80;
  const windowCenter = 200; // Center of 400px window
  const identityTargetPos = -(identityIndex * itemHeight) - (itemHeight / 2) + windowCenter;

  // Find closest equivalent position
  let bestIdentityPos = identityTargetPos;
  const identityCycle = slotMachineState.identityReel.cycleLength;

  let minIdentityDist = Math.abs(bestIdentityPos - slotMachineState.identityReel.position);
  for (let offset = -5; offset <= 5; offset++) {
    const testPos = identityTargetPos + (offset * identityCycle);
    const dist = Math.abs(testPos - slotMachineState.identityReel.position);
    if (dist < minIdentityDist) {
      minIdentityDist = dist;
      bestIdentityPos = testPos;
    }
  }

  function decelerate() {
    // Decelerate
    slotMachineState.identityReel.speed *= decelerationRate;

    // Steer towards target
    const steerStrength = Math.max(0, 1 - (slotMachineState.identityReel.speed / 20));
    const identityDiff = bestIdentityPos - slotMachineState.identityReel.position;

    // Apply movement with steering
    slotMachineState.identityReel.position += slotMachineState.identityReel.speed + (identityDiff * steerStrength * 0.05);

    // Wrap around
    if (slotMachineState.identityReel.position > -10 * slotMachineState.identityReel.cycleLength) {
      slotMachineState.identityReel.position -= slotMachineState.identityReel.cycleLength;
      bestIdentityPos -= slotMachineState.identityReel.cycleLength;
    }

    updateSlotReelPosition();

    if (slotMachineState.identityReel.speed > minSpeed) {
      requestAnimationFrame(decelerate);
    } else {
      // Final positioning
      const finalDiff = Math.abs(bestIdentityPos - slotMachineState.identityReel.position);
      if (finalDiff > 2) {
        slotMachineState.identityReel.position = bestIdentityPos;
        updateSlotReelPosition();
      }

      // Finish
      slotMachineState.isSpinning = false;
      if (slotMachineState.animationId) {
        cancelAnimationFrame(slotMachineState.animationId);
        slotMachineState.animationId = null;
      }
      showSlotResult();
    }
  }

  decelerate();
}

// Update slot reel position
function updateSlotReelPosition() {
  if (identityContent) {
    identityContent.style.transform = `translateY(${slotMachineState.identityReel.position}px)`;
  }
}

// Show slot result
function showSlotResult() {
  const selectedLocation = slotMachineState.selectedCombination.location;
  const selectedIdentity = slotMachineState.selectedCombination.identity;

  // Highlight selected item
  highlightSlotCenterItem();

  // Display result
  if (resultLocation && resultIdentity) {
    resultLocation.textContent = selectedLocation;
    resultIdentity.textContent = selectedIdentity;
  }

  // Show result
  if (slotResult) {
    setTimeout(() => {
      slotResult.classList.add('show');
    }, 500);
  }

  console.log('Slot result:', slotMachineState.selectedCombination);
  showToast('命运已定', `身份：${selectedIdentity}`);
}

// Highlight center item
function highlightSlotCenterItem() {
  clearSlotHighlights();

  slotMachineState.identityReel.items.forEach(item => {
    if (parseInt(item.dataset.originalIndex) === slotMachineState.identityReel.targetIndex) {
      item.classList.add('highlight');
    }
  });
}

// Clear highlights
function clearSlotHighlights() {
  slotMachineState.identityReel.items.forEach(item => {
    item.classList.remove('highlight');
  });
}

// Handle start game from slot machine
function handleSlotStartGame() {
  if (!slotMachineState.selectedCombination) {
    console.error('No combination selected');
    return;
  }

  console.log('Starting game with combination:', slotMachineState.selectedCombination);

  // Update game state with selected starting node
  gameState.currentChapter = slotMachineState.selectedCombination.startingNode;
  gameState.visitedNodes = [slotMachineState.selectedCombination.startingNode];
  gameState.playerChoices = [];
  gameState.previousNode = null;

  // Save game state
  saveGame();

  // Transition to game screen
  if (slotScreen) {
    slotScreen.classList.add('fade-out');
    setTimeout(() => {
      slotScreen.classList.remove('active', 'fade-out');
      gameScreen.classList.add('active');
      loadCurrentStory();
    }, 1000);
  }

  showToast('游戏开始', `以${slotMachineState.selectedCombination.identity}的身份开始冒险！`);
}