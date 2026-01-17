/**
 * Lawless AI Chat - Frontend Application
 *
 * Handles:
 * - Message sending and receiving via SSE
 * - Markdown rendering with code highlighting
 * - Session management
 * - UI interactions
 */

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = '/api';

// Configure marked for markdown rendering
marked.setOptions({
  breaks: true,
  gfm: true,
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

// ============================================================================
// State
// ============================================================================

let sessionId = null;
let isStreaming = false;
let currentAssistantMessage = null;

// ============================================================================
// DOM Elements
// ============================================================================

const messagesContainer = document.getElementById('messages');
const welcomeMessage = document.getElementById('welcome');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const statusDot = document.getElementById('status-dot');

// ============================================================================
// Initialization
// ============================================================================

async function init() {
  await createSession();
  setupEventListeners();
  checkServerStatus();
}

async function createSession() {
  try {
    const response = await fetch(`${API_BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    sessionId = data.sessionId;
    console.log('Session created:', sessionId);
  } catch (error) {
    console.error('Failed to create session:', error);
    showError('Failed to connect to server. Make sure the server is running.');
  }
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.ok) {
      statusDot.classList.remove('error');
    } else {
      statusDot.classList.add('error');
    }
  } catch {
    statusDot.classList.add('error');
  }
}

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  // Form submission
  chatForm.addEventListener('submit', handleSubmit);

  // Textarea auto-resize and enter handling
  messageInput.addEventListener('input', handleInputChange);
  messageInput.addEventListener('keydown', handleKeyDown);

  // Button clicks
  clearBtn.addEventListener('click', clearConversation);
  newChatBtn.addEventListener('click', startNewChat);

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const message = chip.dataset.message;
      messageInput.value = message;
      handleInputChange();
      handleSubmit(new Event('submit'));
    });
  });
}

function handleInputChange() {
  // Auto-resize textarea
  messageInput.style.height = 'auto';
  messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';

  // Enable/disable send button
  sendBtn.disabled = !messageInput.value.trim() || isStreaming;
}

function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (messageInput.value.trim() && !isStreaming) {
      handleSubmit(new Event('submit'));
    }
  }
}

// ============================================================================
// Message Handling
// ============================================================================

async function handleSubmit(e) {
  e.preventDefault();

  const message = messageInput.value.trim();
  if (!message || isStreaming) return;

  // Hide welcome message
  welcomeMessage.classList.add('hidden');

  // Add user message
  addMessage('user', message);

  // Clear input
  messageInput.value = '';
  handleInputChange();

  // Send to API
  await sendMessage(message);
}

async function sendMessage(message) {
  isStreaming = true;
  sendBtn.disabled = true;

  // Create assistant message placeholder
  const assistantMessageEl = addMessage('assistant', '', true);
  currentAssistantMessage = assistantMessageEl.querySelector('.message-bubble');

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId })
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    // Read SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'chunk') {
              fullContent += data.content;
              renderAssistantMessage(fullContent);
            } else if (data.type === 'done') {
              renderAssistantMessage(fullContent, true);
            } else if (data.type === 'error') {
              showError(data.content);
              currentAssistantMessage.innerHTML = `<span class="error-text">Error: ${escapeHtml(data.content)}</span>`;
            }
          } catch (parseError) {
            // Ignore parse errors for incomplete JSON
          }
        }
      }
    }
  } catch (error) {
    console.error('Send message error:', error);
    showError('Failed to send message. Please try again.');
    if (currentAssistantMessage) {
      currentAssistantMessage.innerHTML = '<span class="error-text">Failed to get response</span>';
    }
  } finally {
    isStreaming = false;
    sendBtn.disabled = !messageInput.value.trim();
    currentAssistantMessage = null;
    scrollToBottom();
  }
}

function addMessage(role, content, isPlaceholder = false) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;

  const avatar = role === 'assistant' ? '⚡' : '👤';
  const time = formatTime(new Date());

  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      <div class="message-bubble">
        ${isPlaceholder ? '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>' : (role === 'user' ? escapeHtml(content) : renderMarkdown(content))}
      </div>
      <div class="message-time">${time}</div>
    </div>
  `;

  messagesContainer.appendChild(messageEl);
  scrollToBottom();

  return messageEl;
}

function renderAssistantMessage(content, isFinal = false) {
  if (!currentAssistantMessage) return;

  // Render markdown content
  currentAssistantMessage.innerHTML = renderMarkdown(content);

  // Highlight code blocks
  if (isFinal) {
    currentAssistantMessage.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  scrollToBottom();
}

function renderMarkdown(content) {
  // Use marked to parse markdown
  return marked.parse(content);
}

// ============================================================================
// Conversation Management
// ============================================================================

async function clearConversation() {
  if (sessionId) {
    try {
      await fetch(`${API_BASE}/session/${sessionId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  }

  // Clear UI
  messagesContainer.innerHTML = '';
  messagesContainer.appendChild(welcomeMessage);
  welcomeMessage.classList.remove('hidden');

  // Create new session
  await createSession();
}

async function startNewChat() {
  await clearConversation();
}

// ============================================================================
// Utility Functions
// ============================================================================

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  console.error(message);
  // Could add toast notification here
}

// ============================================================================
// Start Application
// ============================================================================

init();
