<template>
  <div class="w-1/2 flex flex-col bg-white">
    <!-- Uploaded Files Section -->
    <div v-if="uploadedFiles.length > 0" class="border-b border-gray-100 p-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-sm font-medium text-gray-700">{{ t('chat.activeDocuments') }}</span>
        <button @click="$emit('clearAllDocuments')" class="text-xs text-gray-500 hover:text-red-600 transition-colors">
          {{ t('chat.clearAll') }}
        </button>
      </div>
      <div class="flex flex-wrap gap-2">
        <div v-for="file in uploadedFiles" :key="file.id" class="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-sm border border-blue-200">
          <FileText class="w-3 h-3" />
          <span class="truncate max-w-32">{{ file.name }}</span>
          <button @click="$emit('removeFile', file.id)" class="text-blue-500 hover:text-blue-700 ml-1">
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>

    <!-- Chat Messages -->
    <div class="flex-1 overflow-y-auto p-6 space-y-6" ref="messagesContainer">
      <div v-for="message in displayedMessages" :key="`${message.role}-${message.id || message.timestamp}`" class="flex flex-col">
        <div :class="['max-w-4xl rounded-2xl px-4 py-3', message.role === 'user' ? 'bg-blue-600 text-white ml-auto' : 'bg-gray-100 text-gray-900']">
          <div v-if="message.role === 'user'" class="whitespace-pre-wrap leading-relaxed">
            {{ message.content }}
          </div>
          <div v-else class="prose prose-sm max-w-none text-gray-900">
            <template v-if="hasThoughts(message.content) || hasQueries(message.content)">
              <div v-html="renderMessageWithoutThoughtsAndQueries(message.content)"></div>
              
              <!-- AI Thoughts Section -->
              <div v-if="hasThoughts(message.content)" class="thought-container mt-3">
                <div class="thought-header flex items-center p-2 cursor-pointer bg-gray-200 rounded-t-md" @click="toggleThought(message.id)">
                  <component :is="openThoughts[message.id] ? ChevronDownIcon : ChevronRight" class="w-4 h-4 mr-2 text-gray-500" />
                  <span class="text-xs font-medium text-gray-600 uppercase tracking-wide">AI Thought Process</span>
                </div>
                <div v-show="openThoughts[message.id]" class="thought-content p-3 bg-gray-50 text-gray-500 text-sm whitespace-pre-wrap rounded-b-md border-t border-gray-200">
                  <div v-html="extractThoughts(message.content)"></div>
                </div>
              </div>

              <!-- Query Section -->
              <div v-if="hasQueries(message.content)" class="query-container mt-3">
                <div class="query-header flex items-center p-2 cursor-pointer bg-blue-100 rounded-t-md" @click="toggleQuery(message.id)">
                  <component :is="openQueries[message.id] ? ChevronDownIcon : ChevronRight" class="w-4 h-4 mr-2 text-blue-600" />
                  <span class="text-xs font-medium text-blue-600 uppercase tracking-wide">Generated SQL Query</span>
                </div>
                <div v-show="openQueries[message.id]" class="query-content p-3 bg-blue-50 text-blue-800 text-sm font-mono rounded-b-md border-t border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors" @click="copyQueryToEditor(message.content)" title="Click to copy query to editor">
                  <div v-html="extractQueries(message.content)"></div>
                </div>
              </div>
            </template>
            <div v-else v-html="renderMarkdown(message.content)"></div>
          </div>
          
          <div v-if="message.references && message.references.length > 0" class="mt-4 pt-3 border-t border-gray-200">
            <div class="text-xs font-medium text-gray-600 mb-2">{{ t('chat.sources') }}:</div>
            <div class="flex flex-wrap gap-2">
              <button 
                v-for="ref in message.references" 
                :key="ref.id" 
                @click="$emit('viewPdfReference', ref.filename)" 
                class="inline-flex items-center space-x-1 text-xs bg-white bg-opacity-20 hover:bg-opacity-30 px-2 py-1 rounded-md transition-colors"
                :title="`View ${ref.filename}`"
              >
                <FileText class="w-3 h-3" />
                <span>{{ ref.filename.replace(/\.pdf$/i, '') }} p.{{ ref.pageNumber }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="isLoading" class="flex items-center space-x-3 text-gray-500">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        <span class="text-sm">{{ t('chat.loadingMessage') }}</span>
      </div>
    </div>

    <!-- Chat Input -->
    <div class="border-t border-gray-100 p-4" style="height: 16vh;">
      <div class="flex items-end space-x-3">
        <div class="flex-1">
          <textarea 
            :value="currentMessage"
            @input="$emit('update:currentMessage', $event.target.value)"
            @keydown="handleKeyDown"
            :placeholder="t('chat.inputPlaceholder')" 
            class="w-full px-4 py-3 border border-gray-200 rounded-xl shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all min-h-[3rem] max-h-32" 
            rows="2"
          ></textarea>
          <div class="text-xs text-gray-400 mt-1 px-1">Press Enter to send • Shift + Enter for new line</div>
        </div>
        <div class="flex space-x-2" style="padding: 10px; margin-bottom: 2%;">
          <!-- Chat Selector Dropdown -->
          <div class="relative">
            <button 
              @click="toggleChatDropdown" 
              class="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center" 
              :title="t('chat.chatListTitle')"
            >
              <MessageSquare class="w-5 h-5" />
              <ChevronDown class="w-3 h-3 ml-1" />
            </button>
            <!-- Dropdown Menu -->
            <div 
              v-if="isChatDropdownOpen" 
              class="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
            >
              <div class="p-2 max-h-80 overflow-y-auto">
                <p class="text-sm font-medium text-gray-600 px-3 py-2 border-b border-gray-100">
                  {{ t('chat.recentChats') }}
                </p>
                <template v-if="chatSessions.length > 0">
                  <button 
                    v-for="session in chatSessions" 
                    :key="`session-${session.id}`" 
                    @click="switchChat(session.id)" 
                    :class="['w-full text-left px-3 py-2 text-sm hover:bg-gray-100 flex items-center justify-between', 
                            currentSessionId === session.id ? 'bg-blue-50 text-blue-600' : '']"
                  >
                    <span class="truncate">{{ formatSessionName(session) }}</span>
                    <span v-if="currentSessionId === session.id" class="text-blue-600">
                      <Check class="w-4 h-4" />
                    </span>
                  </button>
                </template>
                <div v-else class="px-3 py-2 text-sm text-gray-500 italic">
                  {{ t('chat.noChatsFound') }}
                </div>
                <div class="border-t border-gray-100 mt-1 pt-1">
                  <button 
                    @click="createNewChat" 
                    class="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center"
                  >
                    <Plus class="w-4 h-4 mr-2" />
                    {{ t('chat.createNewChat') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <!-- Send Button -->
          <button @click="$emit('sendMessage')" :disabled="!currentMessage.trim() || isLoading" class="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <Send class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, watch, nextTick } from 'vue';
import { Send, FileText, X, MessageSquare, ChevronDown, Check, Plus, ChevronRight, ChevronDown as ChevronDownIcon } from 'lucide-vue-next';
import { useI18n } from '../composables/useI18n';
import { useChatStore } from '../stores/chat';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const props = defineProps({
  messages: Array,
  isLoading: Boolean,
  uploadedFiles: Array,
  currentMessage: String,
  currentSessionId: String,
  chatSessions: Array,
});

const emit = defineEmits([
  'update:currentMessage',
  'sendMessage',
  'fileSelect',
  'removeFile',
  'clearAllDocuments',
  'viewPdfReference',
  'switchChat',
  'createNewChat',
  'copyQueryToEditor',
]);

const { t } = useI18n();
const chatStore = useChatStore();
const isChatDropdownOpen = ref(false);
const messagesContainer = ref(null);
const openThoughts = ref({});
const openQueries = ref({});

const toggleChatDropdown = () => {
  isChatDropdownOpen.value = !isChatDropdownOpen.value;
};

const toggleThought = (messageId) => {
  const key = `${messageId}`;
  openThoughts.value[key] = !openThoughts.value[key];
};

const toggleQuery = (messageId) => {
  const key = `${messageId}`;
  openQueries.value[key] = !openQueries.value[key];
};

const hasThoughts = (content) => {
  return content && content.includes('<think>');
};

const hasQueries = (content) => {
  return content && content.includes('<query>');
};

const extractThoughts = (content) => {
  if (!content) return '';
  
  const match = content.match(/<think>([\s\S]*?)<\/think>/);
  if (match && match[1]) {
    return renderMarkdown(match[1]);
  }
  return '';
};

const extractQueries = (content) => {
  if (!content) return '';
  
  const match = content.match(/<query>([\s\S]*?)<\/query>/);
  if (match && match[1]) {
    // Return the raw query content without markdown processing for better formatting
    return DOMPurify.sanitize(match[1].trim().replace(/\n/g, '<br>'));
  }
  return '';
};

const renderMessageWithoutThoughtsAndQueries = (content) => {
  if (!content) return '';
  
  // Remove both <think> tags and <query> tags and their content
  const processedContent = content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<query>[\s\S]*?<\/query>/g, '');
  return renderMarkdown(processedContent);
};

const renderMarkdown = (content) => {
  if (!content) return '';
  
  marked.setOptions({ breaks: true });
  const rawHtml = marked.parse(content);
  return DOMPurify.sanitize(rawHtml);
};

const handleKeyDown = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    emit('sendMessage');
  }
};

const copyQueryToEditor = (content) => {
  if (!content) return;
  
  const match = content.match(/<query>([\s\S]*?)<\/query>/);
  if (match && match[1]) {
    const query = match[1].trim();
    emit('copyQueryToEditor', query);
  }
};

// Compute the displayed messages based on the current session
const displayedMessages = computed(() => {
  const currentSession = chatStore.currentSession;
  if (currentSession && currentSession.messages) {
    return currentSession.messages;
  }
  return props.messages || [];
});

// Scroll to bottom when messages change
watch(displayedMessages, () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}, { deep: true });

const switchChat = async (sessionId) => {
  try {
    await chatStore.switchToSession(sessionId);
    emit('switchChat', sessionId);
    isChatDropdownOpen.value = false;
    
    // Scroll to bottom after switching chat
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
      }
    });
  } catch (error) {
    console.error('Error switching chat session:', error);
  }
};

const createNewChat = () => {
  emit('createNewChat');
  isChatDropdownOpen.value = false;
};

// Format session name based on first message or date
const formatSessionName = (session) => {
  // If session has a name property, use it
  if (session.name) {
    return session.name;
  }
  
  // Try to use the first user message as the name
  if (session.messages && session.messages.length > 0) {
    const firstUserMessage = session.messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      // Truncate long messages
      const content = firstUserMessage.content;
      return content.length > 30 ? content.substring(0, 27) + '...' : content;
    }
  }
  
  // Fallback to timestamp
  if (session.timestamp) {
    const date = new Date(session.timestamp);
    return date.toLocaleString();
  }
  
  // Last resort, use part of the ID
  return `Chat ${session.id.slice(-6)}`;
};

// Close dropdown when clicking outside
const clickOutsideHandler = (event) => {
  const dropdownElement = document.querySelector('.relative');
  if (isChatDropdownOpen.value && dropdownElement && !dropdownElement.contains(event.target)) {
    isChatDropdownOpen.value = false;
  }
};

// Add event listener for clicks outside dropdown
document.addEventListener('click', clickOutsideHandler);

// Cleanup event listener when component is unmounted
onUnmounted(() => {
  document.removeEventListener('click', clickOutsideHandler);
});
</script>

<style scoped>
/* Ensure proper scrolling behavior */
.overflow-y-auto {
  max-height: 72vh;
  scroll-behavior: smooth;
}

.thought-container {
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  overflow: hidden;
}

.thought-header {
  transition: background-color 0.2s;
}

.thought-header:hover {
  background-color: #e5e7eb;
}

.thought-content {
  font-family: monospace;
}

.query-container {
  border: 1px solid #dbeafe;
  border-radius: 0.375rem;
  overflow: hidden;
}

.query-header {
  transition: background-color 0.2s;
}

.query-header:hover {
  background-color: #bfdbfe;
}

.query-content {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
}
</style>