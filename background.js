// Background service worker for handling OpenRouter API calls and model management

// Constants
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODELS_ENDPOINT = `${OPENROUTER_API_BASE}/models`;
const OPENROUTER_CHAT_ENDPOINT = `${OPENROUTER_API_BASE}/chat/completions`;
const DEFAULT_MODEL = 'google/gemini-flash-1.5-8b';
const RATE_LIMIT_WINDOW = 1000; // 1 second
const MAX_REQUESTS_PER_WINDOW = 5;

// Rate limiting
let requestTimestamps = [];

// Completion cache to reduce API calls
const completionCache = new Map();
const CACHE_MAX_SIZE = 100;
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Active request tracking for cancellation
const activeRequests = new Map();

/**
 * Initialize extension on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('AI Autocomplete Extension installed');

  // Set default model if not already set
  const { selectedModel } = await chrome.storage.sync.get('selectedModel');
  if (!selectedModel) {
    await chrome.storage.sync.set({ selectedModel: DEFAULT_MODEL });
  }

  // Fetch and cache models
  await fetchAndCacheModels();

  // Set up periodic model refresh (every 24 hours)
  chrome.alarms.create('refreshModels', { periodInMinutes: 1440 });
});

/**
 * Fetch available models from OpenRouter and cache them
 */
async function fetchAndCacheModels() {
  try {
    const { apiKey } = await chrome.storage.sync.get('apiKey');

    if (!apiKey) {
      console.log('No API key configured yet');
      return;
    }

    const response = await fetch(OPENROUTER_MODELS_ENDPOINT, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'chrome-extension://ai-autocomplete',
        'X-Title': 'AI Autocomplete Extension'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter for text completion models (exclude image, audio, etc.)
    const textModels = data.data.filter(model => {
      const id = model.id.toLowerCase();
      return !id.includes('image') &&
             !id.includes('audio') &&
             !id.includes('vision') &&
             !id.includes('whisper') &&
             !id.includes('dalle') &&
             !id.includes('tts');
    });

    // Cache the filtered models
    await chrome.storage.local.set({
      cachedModels: textModels,
      modelsCachedAt: Date.now()
    });

    console.log(`Cached ${textModels.length} text models`);
  } catch (error) {
    console.error('Error fetching models:', error);
  }
}

/**
 * Check if rate limit is exceeded
 */
function isRateLimited() {
  const now = Date.now();

  // Remove timestamps older than the rate limit window
  requestTimestamps = requestTimestamps.filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW
  );

  return requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW;
}

/**
 * Record a new request timestamp
 */
function recordRequest() {
  requestTimestamps.push(Date.now());
}

/**
 * Generate a cache key from context
 */
function getCacheKey(context, model) {
  return `${model}:${context.trim()}`;
}

/**
 * Get completion from cache if available and not expired
 */
function getCachedCompletion(context, model) {
  const key = getCacheKey(context, model);
  const cached = completionCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY) {
    return cached.completion;
  }

  if (cached) {
    completionCache.delete(key);
  }

  return null;
}

/**
 * Cache a completion
 */
function cacheCompletion(context, model, completion) {
  const key = getCacheKey(context, model);

  // Implement LRU-like cache eviction
  if (completionCache.size >= CACHE_MAX_SIZE) {
    const firstKey = completionCache.keys().next().value;
    completionCache.delete(firstKey);
  }

  completionCache.set(key, {
    completion,
    timestamp: Date.now()
  });
}

/**
 * Get completion from OpenRouter API
 */
async function getCompletion(context, requestId) {
  console.log('[Background] getCompletion called:', { context, requestId });

  try {
    // Get API key and selected model from storage
    const { apiKey, selectedModel } = await chrome.storage.sync.get(['apiKey', 'selectedModel']);

    console.log('[Background] Settings:', {
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none',
      model: selectedModel || DEFAULT_MODEL
    });

    if (!apiKey) {
      console.error('[Background] No API key configured');
      throw new Error('API key not configured');
    }

    const model = selectedModel || DEFAULT_MODEL;

    // Check cache first
    const cached = getCachedCompletion(context, model);
    if (cached) {
      console.log('[Background] Returning cached completion:', cached);
      return { success: true, completion: cached };
    }

    // Check rate limit
    if (isRateLimited()) {
      console.log('[Background] Rate limit exceeded, skipping request');
      return { success: false, error: 'Rate limit exceeded' };
    }

    recordRequest();
    console.log('[Background] Making API request to OpenRouter...');

    // Create abort controller for this request
    const controller = new AbortController();
    activeRequests.set(requestId, controller);

    // Make API request
    const response = await fetch(OPENROUTER_CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'chrome-extension://ai-autocomplete',
        'X-Title': 'AI Autocomplete Extension',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an autocomplete assistant. Complete the user\'s text with 2-3 relevant words. Return ONLY the completion text, no explanations or punctuation unless necessary.'
          },
          {
            role: 'user',
            content: context
          }
        ],
        max_tokens: 10,
        temperature: 0.3,
        stream: false
      }),
      signal: controller.signal
    });

    // Clean up active request
    activeRequests.delete(requestId);

    console.log('[Background] API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Background] API error response:', errorText);
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Background] API response data:', data);

    const completion = data.choices?.[0]?.message?.content?.trim() || '';
    console.log('[Background] Extracted completion:', completion);

    // Cache the completion
    if (completion) {
      cacheCompletion(context, model, completion);
      console.log('[Background] Cached completion');
    }

    return { success: true, completion };
  } catch (error) {
    // Clean up active request
    activeRequests.delete(requestId);

    if (error.name === 'AbortError') {
      console.log('[Background] Request cancelled');
      return { success: false, error: 'Request cancelled' };
    }

    console.error('[Background] Error getting completion:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel an active request
 */
function cancelRequest(requestId) {
  const controller = activeRequests.get(requestId);
  if (controller) {
    controller.abort();
    activeRequests.delete(requestId);
    console.log(`Cancelled request: ${requestId}`);
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCompletion') {
    // Handle async completion request
    getCompletion(request.context, request.requestId)
      .then(result => sendResponse(result))
      .catch(error => {
        console.error('Error in getCompletion:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === 'cancelRequest') {
    cancelRequest(request.requestId);
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'fetchModels') {
    // Fetch models and return them
    fetchAndCacheModels()
      .then(() => chrome.storage.local.get('cachedModels'))
      .then(result => sendResponse({ success: true, models: result.cachedModels || [] }))
      .catch(error => {
        console.error('Error fetching models:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'getCachedModels') {
    // Return cached models
    chrome.storage.local.get('cachedModels')
      .then(result => sendResponse({ success: true, models: result.cachedModels || [] }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Handle alarm events for periodic model refresh
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'refreshModels') {
    fetchAndCacheModels();
  }
});
