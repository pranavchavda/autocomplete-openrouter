// Popup script for managing extension settings

// DOM elements
let apiKeyInput;
let modelSelect;
let saveButton;
let statusMessage;
let loadingIndicator;
let currentApiKeyDisplay;
let currentModelDisplay;
let statusIndicator;
let connectionText;
let settingsForm;

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  apiKeyInput = document.getElementById('apiKey');
  modelSelect = document.getElementById('modelSelect');
  saveButton = document.getElementById('saveButton');
  statusMessage = document.getElementById('statusMessage');
  loadingIndicator = document.getElementById('loadingIndicator');
  currentApiKeyDisplay = document.getElementById('currentApiKey');
  currentModelDisplay = document.getElementById('currentModel');
  statusIndicator = document.getElementById('statusIndicator');
  connectionText = document.getElementById('connectionText');
  settingsForm = document.getElementById('settingsForm');

  // Load current settings
  await loadSettings();

  // Load models
  await loadModels();

  // Setup event listeners
  settingsForm.addEventListener('submit', handleSave);
  apiKeyInput.addEventListener('input', handleApiKeyInput);
});

/**
 * Load current settings from storage
 */
async function loadSettings() {
  try {
    const { apiKey, selectedModel } = await chrome.storage.sync.get(['apiKey', 'selectedModel']);

    // Display masked API key
    if (apiKey) {
      currentApiKeyDisplay.textContent = maskApiKey(apiKey);
      apiKeyInput.placeholder = 'Enter new key to update';
      updateConnectionStatus(true);
    } else {
      currentApiKeyDisplay.textContent = 'Not configured';
      updateConnectionStatus(false);
    }

    // Display selected model
    if (selectedModel) {
      currentModelDisplay.textContent = formatModelName(selectedModel);
    } else {
      currentModelDisplay.textContent = 'Not configured';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

/**
 * Load available models from background script
 */
async function loadModels() {
  try {
    loadingIndicator.classList.add('active');
    modelSelect.disabled = true;

    // Try to get cached models first
    let response = await chrome.runtime.sendMessage({ action: 'getCachedModels' });

    // If no cached models, fetch them
    if (!response.success || !response.models || response.models.length === 0) {
      const { apiKey } = await chrome.storage.sync.get('apiKey');

      if (!apiKey) {
        modelSelect.innerHTML = '<option value="">Configure API key first</option>';
        loadingIndicator.classList.remove('active');
        return;
      }

      // Fetch models from API
      response = await chrome.runtime.sendMessage({ action: 'fetchModels' });
    }

    if (response.success && response.models && response.models.length > 0) {
      populateModelSelect(response.models);
    } else {
      modelSelect.innerHTML = '<option value="">Failed to load models</option>';
      showStatus('Failed to load models. Check your API key.', 'error');
    }
  } catch (error) {
    console.error('Error loading models:', error);
    modelSelect.innerHTML = '<option value="">Error loading models</option>';
    showStatus('Error loading models', 'error');
  } finally {
    loadingIndicator.classList.remove('active');
  }
}

/**
 * Populate model select dropdown
 */
async function populateModelSelect(models) {
  modelSelect.innerHTML = '';

  // Get currently selected model
  const { selectedModel } = await chrome.storage.sync.get('selectedModel');

  // Sort models by pricing (prefer cheaper models first)
  const sortedModels = models.sort((a, b) => {
    const priceA = parseFloat(a.pricing?.prompt || '999');
    const priceB = parseFloat(b.pricing?.prompt || '999');
    return priceA - priceB;
  });

  // Group models by provider
  const modelsByProvider = {};
  sortedModels.forEach(model => {
    const provider = model.id.split('/')[0];
    if (!modelsByProvider[provider]) {
      modelsByProvider[provider] = [];
    }
    modelsByProvider[provider].push(model);
  });

  // Add recommended models at the top
  const recommendedGroup = document.createElement('optgroup');
  recommendedGroup.label = 'Recommended (Fast & Affordable)';

  const recommendedIds = [
    'google/gemini-flash-1.5-8b',
    'google/gemini-flash-1.5',
    'anthropic/claude-3-haiku',
    'openai/gpt-3.5-turbo'
  ];

  recommendedIds.forEach(id => {
    const model = sortedModels.find(m => m.id === id);
    if (model) {
      const option = createModelOption(model, selectedModel);
      recommendedGroup.appendChild(option);
    }
  });

  if (recommendedGroup.children.length > 0) {
    modelSelect.appendChild(recommendedGroup);
  }

  // Add all other models grouped by provider
  Object.keys(modelsByProvider).sort().forEach(provider => {
    const group = document.createElement('optgroup');
    group.label = formatProviderName(provider);

    modelsByProvider[provider].forEach(model => {
      // Skip if already in recommended
      if (!recommendedIds.includes(model.id)) {
        const option = createModelOption(model, selectedModel);
        group.appendChild(option);
      }
    });

    if (group.children.length > 0) {
      modelSelect.appendChild(group);
    }
  });

  modelSelect.disabled = false;
}

/**
 * Create option element for a model
 */
function createModelOption(model, selectedModel) {
  const option = document.createElement('option');
  option.value = model.id;
  option.textContent = formatModelName(model.id);

  // Add pricing info if available
  if (model.pricing && model.pricing.prompt) {
    const pricePerMillion = (parseFloat(model.pricing.prompt) * 1000000).toFixed(2);
    option.textContent += ` ($${pricePerMillion}/M tokens)`;
  }

  if (model.id === selectedModel) {
    option.selected = true;
  }

  return option;
}

/**
 * Format model name for display
 */
function formatModelName(modelId) {
  if (!modelId) return 'Unknown';

  // Remove provider prefix and format name
  const parts = modelId.split('/');
  const name = parts[parts.length - 1];

  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format provider name for display
 */
function formatProviderName(provider) {
  return provider
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Mask API key for display
 */
function maskApiKey(key) {
  if (!key) return 'Not configured';
  if (key.length <= 8) return '****';

  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  if (connected) {
    statusIndicator.classList.add('connected');
    statusIndicator.classList.remove('disconnected');
    connectionText.textContent = 'Status: Connected';
  } else {
    statusIndicator.classList.remove('connected');
    statusIndicator.classList.add('disconnected');
    connectionText.textContent = 'Status: Not configured';
  }
}

/**
 * Handle API key input
 */
function handleApiKeyInput() {
  // If user starts typing a new key, enable model refresh
  if (apiKeyInput.value.trim()) {
    // Could add a "Refresh Models" button here
  }
}

/**
 * Handle form submission
 */
async function handleSave(event) {
  event.preventDefault();

  const apiKey = apiKeyInput.value.trim();
  const selectedModel = modelSelect.value;

  // Validation
  if (!apiKey && !selectedModel) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  try {
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const updates = {};

    // Save API key if provided
    if (apiKey) {
      // Basic validation for OpenRouter API key format
      if (!apiKey.startsWith('sk-or-')) {
        showStatus('Invalid API key format. Should start with "sk-or-"', 'error');
        saveButton.disabled = false;
        saveButton.textContent = 'Save Settings';
        return;
      }

      updates.apiKey = apiKey;
    }

    // Save selected model
    if (selectedModel) {
      updates.selectedModel = selectedModel;
    }

    // Save to storage
    await chrome.storage.sync.set(updates);

    // If API key was updated, refresh models
    if (apiKey) {
      await loadModels();
    }

    // Reload settings display
    await loadSettings();

    // Clear input
    apiKeyInput.value = '';

    showStatus('Settings saved successfully!', 'success');

    // Hide success message after 3 seconds
    setTimeout(() => {
      hideStatus();
    }, 3000);
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings: ' + error.message, 'error');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Settings';
  }
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
  statusMessage.textContent = message;
  statusMessage.className = 'status ' + type;
  statusMessage.style.display = 'block';
}

/**
 * Hide status message
 */
function hideStatus() {
  statusMessage.style.display = 'none';
  statusMessage.className = 'status';
}
