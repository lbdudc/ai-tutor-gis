// src/composables/useChat.js
import { ref, nextTick } from 'vue';
import { callN8nWorkflow, runQuery } from '../services/n8nService';

export function useChat(t, chatStore) { // Accept chatStore parameter
  const messages = ref([
    {
      id: 1,
      role: 'assistant',
      content: t('chat.initialMessage'),
      references: []
    }
  ]);
  const currentMessage = ref('');
  const isLoading = ref(false);
  const uploadedFiles = ref([]);
  const generatedQuery = ref('');
  const queryResults = ref([]);
  
  const addMessage = (role, content, references = []) => {
    // Use chat store to add message if available
    if (chatStore && chatStore.currentSession) {
      chatStore.addMessageToCurrentSession(role, content, references);
    } else {
      // Fallback to local messages array
      messages.value.push({ 
        id: `${role}-${Date.now()}`, 
        role, 
        content, 
        references,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  const sendMessage = async () => {
    const userPrompt = currentMessage.value.trim();
    if (!userPrompt || isLoading.value) return;

    addMessage('user', userPrompt);
    currentMessage.value = '';
    isLoading.value = true;
    
    try {
      // Use chat store values for chatId and sessionId      
      const response = await callN8nWorkflow(userPrompt, uploadedFiles.value, chatStore?.agentId, chatStore?.currentSession?.id)

      if (response.type === 'info') {
        addMessage('assistant', response.content.answer, response.content.sources || []);
      } else if (response.type === 'query') {
        console.log('Query received:', response.content);
        
        // Ensure we're setting a string value
        if (typeof response.content.query === 'string') {
          generatedQuery.value = response.content.query;
        } else {
          // Fallback
          generatedQuery.value = String(response.content || '');
        }
        
        queryResults.value = []; // Clear previous results
        addMessage('assistant', response.content.reasoning || t('chat.queryGenerated'));
        
        // Use nextTick to ensure Vue reactivity system processes the change
        nextTick(() => {
          console.log('After nextTick - generatedQuery:', generatedQuery.value);
        });
      }

    } catch (error) {
      addMessage('assistant', `An error occurred: ${error.message}`);
    } finally {
      isLoading.value = false;
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    files.forEach(file => {
      uploadedFiles.value.push({ id: Date.now() + Math.random(), name: file.name, file });
    });

    const fileNames = files.map(f => f.name).join(', ');
    const message = t('chat.docsAdded', { count: files.length, fileNames });
    addMessage('assistant', message);

    event.target.value = ''; // Clear input for re-upload
  };

  const removeFile = (fileId) => {
    uploadedFiles.value = uploadedFiles.value.filter(file => file.id !== fileId);
  };

  const clearAllDocuments = () => {
    uploadedFiles.value = [];
    addMessage('assistant', t('chat.docsCleared'));
  };

  const copyQuery = () => {
    if (generatedQuery.value) {
      navigator.clipboard.writeText(generatedQuery.value);
    }
  };

  const executeQuery = async () => {
    if (!generatedQuery.value.trim()) return [];
    
    console.log('Executing PostGIS query:', generatedQuery.value);
    isLoading.value = true;
    
    try {
      const results = await runQuery(generatedQuery.value);
      
      // Update queryResults state
      if (Array.isArray(results)) {
        queryResults.value = results;
        return results;
      } else {
        console.warn('Unexpected response format from runQuery:', results);
        queryResults.value = [];
        return [];
      }
    } catch (error) {
      console.error('Error executing query:', error);
      addMessage('assistant', `Error executing query: ${error.message}`);
      queryResults.value = [];
      return [];
    } finally {
      isLoading.value = false;
    }
  };
  
  // We need to create a function for opening PDF references
  let loadPdfFunction = null;
  
  // Function to set the PDF loader from App.vue
  const setLoadPdfFunction = (fn) => {
    loadPdfFunction = fn;
  };

  const highlightReference = (reference) => {
    console.log('Highlighting reference:', reference);
    
    // If it's a PDF reference and we have the loadPdf function
    if (reference && reference.filename && loadPdfFunction) {
      // Check if the file is a PDF (either by extension or assuming it is)
      const isPdf = !reference.filename.includes('.') || reference.filename.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // Call the loadPdfForViewing function to display the PDF
        loadPdfFunction(reference.filename);
      } else {
        console.log('Reference is not a PDF document:', reference.filename);
      }
    } else {
      console.log('Cannot load PDF: either reference is invalid or loader function not set');
    }
  };

  return {
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
    highlightReference,
    setLoadPdfFunction
  };
}