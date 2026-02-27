<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- Chat Panel -->
    <ChatPanel
      :messages="messages"
      :is-loading="isLoading"
      :uploaded-files="uploadedFiles"
      v-model:current-message="currentMessage"
      :current-session-id="currentSessionId"
      :chat-sessions="chatSessions"
      @send-message="sendMessage"
      @file-select="handleFileSelect"
      @remove-file="removeFile"
      @clear-all-documents="clearAllDocuments"
      @view-pdf-reference="handleViewPdfReference"
      @switch-chat="switchChat"
      @create-new-chat="createNewChat"
      @copy-query-to-editor="handleCopyQueryToEditor"
    />

    <!-- Data Visualization Panel -->
    <DataVizPanel
      ref="dataVizPanel"
      v-model:view-mode="viewMode"
      v-model:generated-query="generatedQuery"
      :query-results="queryResults"
      :map-container-ref-fn="(el) => mapContainer = el"
      @execute-query="handleExecuteQuery"
      @copy-query="copyQuery"
      @reset-map-view="resetMapView"
      :current-pdf-url="currentPdfUrl"
      :current-pdf-name="currentPdfName"
      v-model:current-pdf-page="currentPdfPage"
      :total-pdf-pages="totalPdfPages"
      @pdf-loaded="onPdfLoaded"
      @download-current-pdf="downloadCurrentPdf"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useChatStore } from '../stores/chat';
import { useI18n } from '../composables/useI18n';
import { useChat } from '../composables/useChat';
import { useMap } from '../composables/useMap';
import { downloadPdfFile } from '../services/n8nService';

import ChatPanel from '../components/ChatPanel.vue';
import DataVizPanel from '../components/DataVizPanel.vue';

// Initialize auth and chat store
const authStore = useAuthStore();
const chatStore = useChatStore();

// State for which view is active in the right panel
const viewMode = ref('map'); // 'map', 'table', 'pdf'

// PDF viewer state
const currentPdfUrl = ref('');
const currentPdfName = ref('');
const currentPdfPage = ref(1);
const totalPdfPages = ref(0);

// Chat sessions state
const chatSessions = ref([]);
const currentSessionId = ref(null);

// Initialize composables
const { t } = useI18n();
const { addQueryResultsToMap, mapContainer, resetMapView } = useMap(t);
const {
  messages,
  currentMessage,
  isLoading,
  uploadedFiles,
  generatedQuery,
  queryResults,
  sendMessage,
  handleFileSelect,
  removeFile,
  clearAllDocuments,
  copyQuery,
  executeQuery,
  setLoadPdfFunction
} = useChat(t, chatStore); // Pass chatStore to useChat

// Function to load a PDF from a chat reference
const loadPdfForViewing = async (filename) => {
  try {
    const pdfUrl = await downloadPdfFile(filename.replace(/\.pdf$/i, ''), false);
    if (pdfUrl) {
      currentPdfUrl.value = pdfUrl;
      currentPdfName.value = filename;
      currentPdfPage.value = 1;
      totalPdfPages.value = 0; // Reset while new PDF loads
    }
  } catch (error) {
    console.error('Error loading PDF:', error);
  }
};

// Initialize chat sessions
const initializeChatSessions = async () => {
  try {
    await chatStore.initializeAgent();
    chatSessions.value = chatStore.recentSessions;
    if (chatStore.currentSession) {
      currentSessionId.value = chatStore.currentSession.id;
      // Load messages from the current session if needed
    }
  } catch (error) {
    console.error('Error initializing chat sessions:', error);
    if (error.message.includes('authentication') || error.response?.status === 401) {
      // If there was an auth error, redirect to login
      authStore.logout();
    }
  }
};

// Switch to a different chat session
const switchChat = async (sessionId) => {
  try {
    await chatStore.switchToSession(sessionId);
    currentSessionId.value = sessionId;
  } catch (error) {
    console.error('Error switching chat session:', error);
  }
};

// Create a new chat session
const createNewChat = async () => {
  try {
    const newSession = await chatStore.createNewChat();
    currentSessionId.value = newSession.id;
    chatSessions.value = chatStore.recentSessions;
    // Reset the chat UI for the new session
    // This depends on how your chat implementation works
  } catch (error) {
    console.error('Error creating new chat session:', error);
  }
};

// Connect the PDF loading function to the chat composable
onMounted(async () => {
  // Set up PDF loading function
  setLoadPdfFunction(loadPdfForViewing);
  
  // Initialize chat sessions if authenticated
  if (authStore.isAuthenticated) {
    await initializeChatSessions();
  }
});

// Remove the setTimeout and update the watcher
watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated) => {
    if (isAuthenticated) {
      await initializeChatSessions();
    }
  }
);

// Handler for when a user clicks a PDF reference in the chat
const handleViewPdfReference = (filename) => {
  loadPdfForViewing(filename);
  viewMode.value = 'pdf'; // Switch to PDF view
};

// Handler for executing a query from the DataVizPanel
const handleExecuteQuery = async () => {
  try {
    const results = await executeQuery();
    if (results && Array.isArray(results)) {
      queryResults.value = results;
      addQueryResultsToMap(results);
      if (results.length > 0) {
        viewMode.value = 'table'; // Switch to table view on successful query
      }
    }
  } catch (error) {
    console.error('Error executing query:', error);
  }
};

// Handler for when the PDF document has finished loading in the viewer
const onPdfLoaded = (pdf) => {
  totalPdfPages.value = pdf.numPages;
};

// Handler to download the currently viewed PDF
const downloadCurrentPdf = async () => {
  if (currentPdfName.value) {
    await downloadPdfFile(currentPdfName.value.replace(/\.pdf$/i, ''), true);
  }
};

// Add ref for DataVizPanel
const dataVizPanel = ref(null);

// Handler for copying query from chat to editor
const handleCopyQueryToEditor = (query) => {
  if (dataVizPanel.value) {
    dataVizPanel.value.handleQueryFromChat(query);
  }
};
</script>
