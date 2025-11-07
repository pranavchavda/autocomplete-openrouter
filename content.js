// Content script for monitoring text inputs and displaying completions

// Configuration
const DEBOUNCE_DELAY = 300; // ms
const MIN_CONTEXT_LENGTH = 10; // minimum characters before triggering completion
const MAX_CONTEXT_LENGTH = 100; // characters to send as context
const COMPLETION_WORD_LIMIT = 3; // max words in completion

// State management
let currentElement = null;
let completionOverlay = null;
let debounceTimer = null;
let currentRequestId = null;
let lastCompletion = '';
let isAcceptingCompletion = false;

// Sensitive field detection
const SENSITIVE_INPUT_TYPES = ['password', 'email', 'tel', 'number', 'credit-card'];
const SENSITIVE_FIELD_NAMES = ['password', 'pwd', 'pass', 'pin', 'ssn', 'creditcard', 'ccv', 'cvv'];

/**
 * Initialize the content script
 */
function init() {
  console.log('AI Autocomplete content script loaded');

  // Monitor all text inputs and contenteditable elements
  document.addEventListener('input', handleInput, true);
  document.addEventListener('keydown', handleKeydown, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('focus', handleFocus, true);
  document.addEventListener('blur', handleBlur, true);

  // Clean up on page unload
  window.addEventListener('beforeunload', cleanup);
}

/**
 * Check if an element is a sensitive field
 */
function isSensitiveField(element) {
  if (!element) return true;

  // Check input type
  if (element.tagName === 'INPUT') {
    const type = element.type?.toLowerCase();
    if (SENSITIVE_INPUT_TYPES.includes(type)) {
      return true;
    }

    // Check name and id attributes
    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const placeholder = (element.placeholder || '').toLowerCase();

    for (const keyword of SENSITIVE_FIELD_NAMES) {
      if (name.includes(keyword) || id.includes(keyword) || placeholder.includes(keyword)) {
        return true;
      }
    }
  }

  // Check for autocomplete="off" or sensitive aria labels
  const autocomplete = element.getAttribute('autocomplete');
  if (autocomplete === 'off' || autocomplete === 'new-password') {
    return true;
  }

  return false;
}

/**
 * Check if element is a valid target for autocompletion
 */
function isValidTarget(element) {
  if (!element) return false;

  // Check if it's a text input, textarea, or contenteditable
  const isInput = element.tagName === 'INPUT' && element.type === 'text';
  const isTextarea = element.tagName === 'TEXTAREA';
  const isContentEditable = element.contentEditable === 'true';

  if (!isInput && !isTextarea && !isContentEditable) {
    return false;
  }

  // Check if it's not disabled or readonly
  if (element.disabled || element.readOnly) {
    return false;
  }

  // Check if it's not a sensitive field
  if (isSensitiveField(element)) {
    return false;
  }

  return true;
}

/**
 * Get text content and cursor position from element
 */
function getElementContext(element) {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const text = element.value;
    const cursorPos = element.selectionStart;
    return { text, cursorPos };
  }

  if (element.contentEditable === 'true') {
    const text = element.innerText || element.textContent || '';
    const selection = window.getSelection();
    let cursorPos = 0;

    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const preCaretRange = range.cloneRange();
      preCaretRange.selectNodeContents(element);
      preCaretRange.setEnd(range.endContainer, range.endOffset);
      cursorPos = preCaretRange.toString().length;
    }

    return { text, cursorPos };
  }

  return { text: '', cursorPos: 0 };
}

/**
 * Extract relevant context for API request
 */
function extractContext(text, cursorPos) {
  // Get text before cursor
  const textBeforeCursor = text.substring(0, cursorPos);

  // Take last MAX_CONTEXT_LENGTH characters
  const context = textBeforeCursor.slice(-MAX_CONTEXT_LENGTH);

  return context;
}

/**
 * Get cursor coordinates for positioning overlay
 */
function getCursorCoordinates(element) {
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    return getCursorCoordinatesForInput(element);
  }

  if (element.contentEditable === 'true') {
    return getCursorCoordinatesForContentEditable(element);
  }

  return null;
}

/**
 * Get cursor coordinates for input/textarea elements
 */
function getCursorCoordinatesForInput(element) {
  const { text, cursorPos } = getElementContext(element);

  // Create a mirror div to calculate position
  const mirror = document.createElement('div');
  const computed = window.getComputedStyle(element);

  // Copy styles to mirror
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.fontFamily = computed.fontFamily;
  mirror.style.fontSize = computed.fontSize;
  mirror.style.fontWeight = computed.fontWeight;
  mirror.style.letterSpacing = computed.letterSpacing;
  mirror.style.lineHeight = computed.lineHeight;
  mirror.style.padding = computed.padding;
  mirror.style.width = computed.width;
  mirror.style.border = computed.border;

  document.body.appendChild(mirror);

  // Add text before cursor
  const textBeforeCursor = text.substring(0, cursorPos);
  mirror.textContent = textBeforeCursor;

  // Add a marker span at cursor position
  const marker = document.createElement('span');
  marker.textContent = '|';
  mirror.appendChild(marker);

  // Get marker position
  const markerRect = marker.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  document.body.removeChild(mirror);

  return {
    left: markerRect.left,
    top: markerRect.top,
    elementRect: elementRect
  };
}

/**
 * Get cursor coordinates for contenteditable elements
 */
function getCursorCoordinatesForContentEditable(element) {
  const selection = window.getSelection();

  if (selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  return {
    left: rect.left,
    top: rect.top,
    elementRect: elementRect
  };
}

/**
 * Create or update completion overlay
 */
function showCompletion(element, completion) {
  if (!completion) {
    hideCompletion();
    return;
  }

  lastCompletion = completion;

  // Get cursor position
  const coords = getCursorCoordinates(element);
  if (!coords) {
    return;
  }

  // Create overlay if it doesn't exist
  if (!completionOverlay) {
    completionOverlay = document.createElement('span');
    completionOverlay.className = 'ai-autocomplete-overlay';
    document.body.appendChild(completionOverlay);
  }

  // Set completion text
  completionOverlay.textContent = completion;

  // Copy font styles from element
  const computed = window.getComputedStyle(element);
  completionOverlay.style.fontFamily = computed.fontFamily;
  completionOverlay.style.fontSize = computed.fontSize;
  completionOverlay.style.fontWeight = computed.fontWeight;
  completionOverlay.style.lineHeight = computed.lineHeight;
  completionOverlay.style.letterSpacing = computed.letterSpacing;

  // Position overlay
  completionOverlay.style.left = `${coords.left}px`;
  completionOverlay.style.top = `${coords.top}px`;
  completionOverlay.style.display = 'inline';
}

/**
 * Hide completion overlay
 */
function hideCompletion() {
  if (completionOverlay) {
    completionOverlay.style.display = 'none';
  }
  lastCompletion = '';
}

/**
 * Accept completion and insert into element
 */
function acceptCompletion(element) {
  if (!lastCompletion || !element) {
    return;
  }

  isAcceptingCompletion = true;

  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
    const cursorPos = element.selectionStart;
    const textBefore = element.value.substring(0, cursorPos);
    const textAfter = element.value.substring(cursorPos);

    // Add space before completion if needed
    const needsSpace = textBefore.length > 0 && !textBefore.endsWith(' ');
    const completionText = needsSpace ? ' ' + lastCompletion : lastCompletion;

    element.value = textBefore + completionText + textAfter;
    element.selectionStart = element.selectionEnd = cursorPos + completionText.length;

    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (element.contentEditable === 'true') {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(' ' + lastCompletion);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);

      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  hideCompletion();

  setTimeout(() => {
    isAcceptingCompletion = false;
  }, 100);
}

/**
 * Request completion from background script
 */
async function requestCompletion(context) {
  // Cancel any pending request
  if (currentRequestId) {
    chrome.runtime.sendMessage({
      action: 'cancelRequest',
      requestId: currentRequestId
    });
  }

  // Generate new request ID
  currentRequestId = `req_${Date.now()}_${Math.random()}`;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getCompletion',
      context: context,
      requestId: currentRequestId
    });

    if (response.success && response.completion) {
      // Limit completion to COMPLETION_WORD_LIMIT words
      const words = response.completion.trim().split(/\s+/);
      const limitedCompletion = words.slice(0, COMPLETION_WORD_LIMIT).join(' ');

      return limitedCompletion;
    }
  } catch (error) {
    console.error('Error requesting completion:', error);
  }

  return null;
}

/**
 * Handle input events
 */
function handleInput(event) {
  if (isAcceptingCompletion) {
    return;
  }

  const element = event.target;

  if (!isValidTarget(element)) {
    hideCompletion();
    return;
  }

  currentElement = element;

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Hide current completion while typing
  hideCompletion();

  // Debounce the completion request
  debounceTimer = setTimeout(() => {
    triggerCompletion(element);
  }, DEBOUNCE_DELAY);
}

/**
 * Trigger completion request
 */
async function triggerCompletion(element) {
  const { text, cursorPos } = getElementContext(element);

  // Check if cursor is at the end of text
  if (cursorPos !== text.length) {
    return;
  }

  // Check minimum context length
  if (text.length < MIN_CONTEXT_LENGTH) {
    return;
  }

  // Extract context
  const context = extractContext(text, cursorPos);

  // Request completion
  const completion = await requestCompletion(context);

  // Show completion if element is still focused
  if (completion && element === document.activeElement && element === currentElement) {
    showCompletion(element, completion);
  }
}

/**
 * Handle keydown events
 */
function handleKeydown(event) {
  // Tab key - accept completion
  if (event.key === 'Tab' && lastCompletion && currentElement) {
    event.preventDefault();
    acceptCompletion(currentElement);
    return;
  }

  // Escape key - dismiss completion
  if (event.key === 'Escape' && lastCompletion) {
    event.preventDefault();
    hideCompletion();
    return;
  }

  // Arrow keys or other navigation - hide completion
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    hideCompletion();
  }
}

/**
 * Handle click events
 */
function handleClick(event) {
  hideCompletion();
}

/**
 * Handle focus events
 */
function handleFocus(event) {
  const element = event.target;

  if (isValidTarget(element)) {
    currentElement = element;
  }
}

/**
 * Handle blur events
 */
function handleBlur(event) {
  hideCompletion();
  currentElement = null;
}

/**
 * Cleanup resources
 */
function cleanup() {
  hideCompletion();
  if (completionOverlay && completionOverlay.parentNode) {
    completionOverlay.parentNode.removeChild(completionOverlay);
  }
  completionOverlay = null;
  currentElement = null;
}

// Initialize the script
init();
