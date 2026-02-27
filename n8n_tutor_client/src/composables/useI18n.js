import { ref } from 'vue';

// Default English messages
const defaultMessages = {
  header: {
    title: 'N8N Tutor'
  },
  chat: {
    activeDocuments: 'Active Documents',
    clearAll: 'Clear All',
    sources: 'Sources',
    loadingMessage: 'Loading response...',
    inputPlaceholder: 'Ask a question...',
    uploadTitle: 'Upload Document',
    chatListTitle: 'Chat Sessions',
    recentChats: 'Recent Chats',
    createNewChat: 'Create New Chat',
    noChatsFound: 'No chat sessions found',
    initialMessage: 'How can I help you today?'
  },
  map: {
    title: 'Map',
    resetViewTitle: 'Reset Map View',
    toggleLayersTitle: 'Toggle Layers'
  },
  table: {
    title: 'Table'
  },
  pdf: {
    title: 'PDF',
    viewer: 'PDF Viewer',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fitToWidth: 'Fit to Width',
    download: 'Download',
    noDocumentLoaded: 'No PDF document loaded',
    loadInstructions: 'Click on a document reference to view it'
  },
  query: {
    title: 'SQL Query',
    copy: 'Copy',
    execute: 'Execute',
    placeholder: 'No SQL query generated yet. Ask a question about the data to generate a query.'
  }
};

// A simple key-path getter. e.g., get(obj, 'a.b') -> obj.a.b
const get = (obj, path) => path.split('.').reduce((acc, part) => acc && acc[part], obj);

export function useI18n() {
  // In a real app, you might have logic here to select the language
  const locale = ref('en'); 
  const translations = ref(defaultMessages);

  const t = (key, params = {}) => {
    let translation = get(translations.value, key);
    if (!translation) {
      console.warn(`[i18n] Translation for key '${key}' not found.`);
      return key;
    }
    // Replace placeholders like {count}
    Object.keys(params).forEach(paramKey => {
      translation = translation.replace(`{${paramKey}}`, params[paramKey]);
    });
    return translation;
  };

  return { t, locale };
}