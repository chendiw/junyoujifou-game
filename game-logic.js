// Game State Management
let gameState = {
  user: null,
  currentChapter: "1",
  lifePoints: 5,
  transportCards: 3,
  visitedNodes: ["1"],
  playerChoices: [],
  previousNode: null,
  gameOver: false,
  tools: [] // Add tools collection to game state
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
const toolsBtn = document.getElementById('toolsBtn');
const endingsBtn = document.getElementById('endingsBtn');
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
  toolsBtn.addEventListener('click', () => openModal('toolsModal'));
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



// Tools Collection Functions
function addTool(tool) {
  // Check if tool already exists
  const existingTool = gameState.tools.find(t => t.title === tool.title);
  if (!existingTool) {
    // Add count field to new tool
    tool.count = 1;
    gameState.tools.push(tool);
    saveGame();
    updateToolsButton();
    showToolUnlockAnimation(tool);
  } else {
    // Increment count for existing tool
    existingTool.count += 1;
    saveGame();
    updateToolsButton();
    showToast('道具获得', `获得 ${tool.title} x1，当前拥有 ${existingTool.count} 个`);
  }
}

// Function to extract tool names from bonus message
function extractToolNamesFromBonus(bonusMessage) {
  const toolNames = [];
  // Look for patterns like "道具\"楚明允的欣赏\"" or "道具\"苏世誉的欣赏\""
  const toolPattern = /道具["""]([^"""]+)["""]/g;
  let match;
  
  while ((match = toolPattern.exec(bonusMessage)) !== null) {
    toolNames.push(match[1]);
  }
  
  return toolNames;
}

// Function to automatically use tools to avoid life point deduction
function useToolsToAvoidLifeDeduction(bonusMessage) {
  const toolNames = extractToolNamesFromBonus(bonusMessage);
  console.log('Extracted tool names from bonus:', toolNames);
  
  let usedTool = null;
  
  // Check if any of the mentioned tools are available
  for (const toolName of toolNames) {
    const tool = gameState.tools.find(t => t.title === toolName && t.count > 0);
    if (tool) {
      // Use the first available tool
      tool.count -= 1;
      usedTool = tool;
      console.log(`Using tool: ${tool.title}, remaining count: ${tool.count}`);
      break;
    }
  }
  
  if (usedTool) {
    saveGame();
    updateToolsGrid();
    updateToolsButton();
    showToast('道具使用', `自动使用 ${usedTool.title} 避免生命值损失！`);
    return true; // Tool was used successfully
  }
  
  console.log('No available tools found to use');
  return false; // No tool was used
}

function showToolUnlockAnimation(tool) {
  // Create a temporary card element for the unlock animation
  const tempCard = document.createElement('div');
  tempCard.className = 'tarot-card unlocking';
  const toolCount = tool.count || 1;
  tempCard.innerHTML = `
    <div class="tarot-card-inner">
      <div class="tarot-card-front">
        <div class="tarot-card-title">🔮</div>
        <div class="tarot-card-content">${tool.title}</div>
        <div class="tool-count" data-count="${toolCount}">${toolCount}</div>
      </div>
      <div class="tarot-card-back">
        <div class="tarot-card-title">${tool.title}</div>
        <div class="tarot-card-content">${tool.content}</div>
        <div class="tool-count" data-count="${toolCount}">${toolCount}</div>
      </div>
    </div>
  `;
  
  // Position the card in the center of the screen
  tempCard.style.position = 'fixed';
  tempCard.style.top = '50%';
  tempCard.style.left = '50%';
  tempCard.style.transform = 'translate(-50%, -50%)';
  tempCard.style.width = '200px';
  tempCard.style.height = '280px';
  tempCard.style.zIndex = '9999';
  
  document.body.appendChild(tempCard);
  
  // Remove the card after animation
  setTimeout(() => {
    if (tempCard.parentNode) {
      tempCard.parentNode.removeChild(tempCard);
    }
    showToast('道具解锁', `获得新道具：${tool.title}！`, 'success');
  }, 1500);
}

function updateToolsGrid() {
  const toolsGrid = document.getElementById('toolsGrid');
  const noToolsMessage = document.getElementById('noToolsMessage');
  
  if (!toolsGrid || !noToolsMessage) return;
  
  if (gameState.tools.length === 0) {
    toolsGrid.style.display = 'none';
    noToolsMessage.style.display = 'block';
  } else {
    toolsGrid.style.display = 'grid';
    noToolsMessage.style.display = 'none';
    
          toolsGrid.innerHTML = '';
      
      gameState.tools.forEach(tool => {
        const toolCount = tool.count || 1;
        
        // Only show tools with count > 0
        if (toolCount > 0) {
          const toolCard = document.createElement('div');
          toolCard.className = 'tarot-card';
          toolCard.innerHTML = `
            <div class="tarot-card-inner">
              <div class="tarot-card-front">
                <div class="tarot-card-title">🔮</div>
                <div class="tarot-card-content">${tool.title}</div>
                <div class="tool-count" data-count="${toolCount}">${toolCount}</div>
              </div>
              <div class="tarot-card-back">
                <div class="tarot-card-title">${tool.title}</div>
                <div class="tarot-card-content">${tool.content}</div>
                <div class="tool-count" data-count="${toolCount}">${toolCount}</div>
              </div>
            </div>
          `;
          
          // Add click handler to show tool details
          toolCard.addEventListener('click', () => {
            // Add flip animation
            toolCard.classList.add('flipped');
            
            // Show tool details after a short delay
            setTimeout(() => {
              showToolDetail(tool);
              // Reset flip state after showing details
              setTimeout(() => {
                toolCard.classList.remove('flipped');
              }, 500);
            }, 400);
          });
          
          toolsGrid.appendChild(toolCard);
        }
      });
  }
}

function showToolDetail(tool) {
  const toolDetailTitle = document.getElementById('toolDetailTitle');
  const toolDetailContent = document.getElementById('toolDetailContent');
  
  if (toolDetailTitle && toolDetailContent) {
    const toolCount = tool.count || 1;
    toolDetailTitle.textContent = `${tool.title} (x${toolCount})`;
    toolDetailContent.textContent = tool.content;
    openModal('toolDetailModal');
  }
}

async function checkSavedGame() {
  try {
    // Try to load from localStorage first
    const savedGame = storageService.loadFromLocal(CONFIG.STORAGE_KEYS.CURRENT_GAME);
    if (savedGame && savedGame.user) {
      gameState = savedGame;
      // Ensure tools array exists for backward compatibility
      if (!Array.isArray(gameState.tools)) {
        gameState.tools = [];
      } else {
        // Ensure each tool has a count field for backward compatibility
        gameState.tools.forEach(tool => {
          if (typeof tool.count === 'undefined') {
            tool.count = 1;
          }
        });
      }
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
  updateToolsButton();
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

// Expose toast utility for other modules (e.g., storage-service)
if (typeof window !== 'undefined') {
  window.showToast = showToast;
  // Expose test functions for debugging
  window.testToolExtraction = function(bonusMessage) {
    console.log('Testing tool extraction with:', bonusMessage);
    const toolNames = extractToolNamesFromBonus(bonusMessage);
    console.log('Extracted tool names:', toolNames);
    return toolNames;
  };
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
    
    // Ensure tools array exists for backward compatibility
    if (!Array.isArray(gameState.tools)) {
      gameState.tools = [];
    } else {
      // Ensure each tool has a count field for backward compatibility
      gameState.tools.forEach(tool => {
        if (typeof tool.count === 'undefined') {
          tool.count = 1;
        }
      });
    }
    
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
    
    // Ensure tools array exists for new accounts
    if (!Array.isArray(gameState.tools)) {
      gameState.tools = [];
    } else {
      // Ensure each tool has a count field for backward compatibility
      gameState.tools.forEach(tool => {
        if (typeof tool.count === 'undefined') {
          tool.count = 1;
        }
      });
    }
    
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
  // Just clear the user and show login screen
  gameState.user = null;
  accountNameInput.value = '';
  showLogin();
  showToast('退出成功', '已成功退出登录');
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
  
  // Display title without chapter number for regular nodes, show ending number and title for endings
  if (node.isEnding) {
    // Get ending number based on the order of ending nodes
    const endingNumber = getEndingNumber(gameState.currentChapter);
    // Show both ending number and title
    storyTitle.textContent = `结局 ${endingNumber}：${node.title}`;
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
  
  // Check if choice has bonus information
  if (choice.bonus) {
    await showBonusPopup(choice);
    return;
  }
  
  // Proceed with normal choice handling
  await proceedWithChoice(choice);
}

async function showBonusPopup(choice) {
  const bonusMessage = document.getElementById('bonusMessage');
  const bonusIcon = document.querySelector('.bonus-icon');
  const confirmBtn = document.getElementById('confirmBonusBtn');
  
  // Set bonus message
  bonusMessage.textContent = choice.bonus;
  
  // Determine icon based on life point changes
  const hasLifeDeduction = choice.bonus.includes('减1点生命值');
  const hasLifeAddition = choice.bonus.includes('加1点生命值');
  
  if (hasLifeDeduction) {
    bonusIcon.textContent = '💣';
    bonusIcon.style.color = '#ff4444';
  } else if (hasLifeAddition) {
    bonusIcon.textContent = '🎁';
    bonusIcon.style.color = '#44ff44';
  } else {
    bonusIcon.textContent = '🎁';
    bonusIcon.style.color = '#ffaa44';
  }
  
  // Set up confirm button handler
  confirmBtn.onclick = async () => {
    closeModal('bonusModal');
    await proceedWithChoice(choice);
  };
  
  // Show the bonus modal
  openModal('bonusModal');
}

async function proceedWithChoice(choice) {
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
  
  // Handle life point changes if bonus exists
  if (choice.bonus) {
    if (choice.bonus.includes('加1点生命值')) {
      gameState.lifePoints += 1;
    } else if (choice.bonus.includes('减1点生命值')) {
      // Check if tools can be used to avoid life point deduction
      const toolUsed = useToolsToAvoidLifeDeduction(choice.bonus);
      if (!toolUsed) {
        // No tool was used, so deduct life point
        gameState.lifePoints -= 1;
      }
    }
  }
  
  // Handle tool collection if tool exists
  if (choice.tool) {
    addTool(choice.tool);
  }
  
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
  } else if (modalId === 'toolsModal') {
    updateToolsGrid();
  } else if (modalId === 'bonusModal') {
    // Bonus modal doesn't need additional setup
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
  
  // Define important life choice nodes
  const importantNodes = ['11', '22', '31', '62'];
  
  // Get all available nodes (excluding endings)
  const allNodes = Object.keys(storyNodes).filter(nodeId => !nodeId.startsWith('ending_'));
  
  // Create map nodes for all available chapters
  allNodes.forEach(nodeId => {
    const node = storyNodes[nodeId];
    if (!node) return;
    
    const mapNode = document.createElement('div');
    mapNode.className = 'map-node';
    
    // Add highlighted class for important nodes
    if (importantNodes.includes(nodeId)) {
      mapNode.classList.add('highlighted');
    }
    
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
  gameState.tools = []; // Clear tools collection

  saveGame();
  updateToolsButton();
  await loadCurrentStory();
  showToast('游戏重启', '游戏已重新开始，所有节点已重置，生命值和传送卡已恢复');
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

function updateToolsButton() {
  const toolsBtn = document.getElementById('toolsBtn');
  if (toolsBtn) {
    const availableTools = gameState.tools.filter(tool => (tool.count || 1) > 0);
    const uniqueAvailableTools = availableTools.length;
    
    let btnText = '道具收藏';
    if (uniqueAvailableTools > 0) {
      btnText = `道具收藏 (${uniqueAvailableTools})`;
    }
    
    toolsBtn.innerHTML = `<span class="btn-icon">🔮</span>${btnText}`;
  }
}