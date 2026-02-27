import { defineStore } from 'pinia';
import { getAgentId, getSessionsForAgent, getFullSession, createNewSession } from '../services/chatService';
import { useAuthStore } from './auth';

export const useChatStore = defineStore('chat', {
  state: () => ({
    agentId: null,
    sessions: [],
    currentSession: null,
    isLoadingSessions: false,
    error: null,
  }),
  
  getters: {
    recentSessions: (state) => {
      // Return the 10 most recent sessions
      return state.sessions.slice(0, 10);
    },
    hasActiveSessions: (state) => state.sessions.length > 0,
  },
  
  actions: {
    // Transform backend message format to frontend format
    transformMessage(backendMessage) {
      const references = [];
      
      // Parse docs if they exist
      if (backendMessage.docs && Array.isArray(backendMessage.docs)) {
        backendMessage.docs.forEach(docStr => {
          try {
            const doc = JSON.parse(docStr);
            references.push({
              id: `${doc.filename}-${doc.pageNumber}`,
              filename: doc.filename,
              pageNumber: doc.pageNumber
            });
          } catch (error) {
            console.error('Error parsing doc reference:', error);
          }
        });
      }
      
      return {
        id: `${backendMessage.sender}-${backendMessage.id}`,
        role: backendMessage.sender,
        content: backendMessage.message,
        references: references,
        timestamp: backendMessage.timestamp,
        is_theory: backendMessage.is_theory
      };
    },

    // Transform backend session format to frontend format
    transformSession(backendSession) {
      
      return {
        id: backendSession.id,
        timestamp: backendSession.timestamp,
        created_at: backendSession.timestamp,
      };
    },

    transformFullSession(backendSession) {
      const messages = (backendSession.messages || []).map(msg => this.transformMessage(msg));

      return {
        id: backendSession.id,
        timestamp: backendSession.timestamp,
        created_at: backendSession.timestamp,
        messages: messages
      };
    },

    async initializeAgent() {
      try {
        // First check if user is authenticated
        const authStore = useAuthStore();
        if (!authStore.isAuthenticated) {
          this.error = 'User not authenticated';
          throw new Error('User not authenticated');
        }
        
        // Reset state
        this.error = null;
        
        // Get the agent ID
        this.agentId = await getAgentId();
        
        if (!this.agentId) {
          this.error = 'Failed to retrieve agent ID';
          throw new Error('Failed to retrieve agent ID');
        }
        
        await this.fetchSessions();
        
        // If there are no sessions, create a new one
        if (this.sessions.length === 0) {
          await this.createNewChat();
          return this.currentSession;
        } else {
          const backendSession = await getFullSession(this.agentId, this.sessions[0].id);
          const fullSession = this.transformFullSession(backendSession);
          this.currentSession = fullSession;
          return fullSession;
        }
        
      } catch (error) {
        if (error.response && error.response.status === 401) {
          const authStore = useAuthStore();
          authStore.logout(); // Force logout on authentication failure
          this.error = 'Authentication failed. Please log in again.';
        } else {
          this.error = error.message || 'Failed to initialize agent';
        }
        throw error;
      }
    },
    
    async fetchSessions() {
      if (!this.agentId) return;
      
      this.isLoadingSessions = true;
      try {
        const backendSessions = await getSessionsForAgent(this.agentId);
        this.sessions = backendSessions.map(session => this.transformSession(session));
      } catch (error) {
        if (error.response && error.response.status === 401) {
          const authStore = useAuthStore();
          authStore.logout(); // Force logout on authentication failure
          this.error = 'Authentication failed. Please log in again.';
        } else {
          this.error = error.message || 'Failed to fetch chat sessions';
        }
        throw error;
      } finally {
        this.isLoadingSessions = false;
      }
    },
    
    async createNewChat() {
      if (!this.agentId) return;
      const authStore = useAuthStore();
      
      try {
        const username = authStore.user?.username;
        const backendSession = await createNewSession(this.agentId, username);
        const newSession = this.transformSession(backendSession.data);
        this.sessions.unshift(newSession); // Add to the beginning of the array
        this.currentSession = newSession;
        return newSession;
      } catch (error) {
        if (error.response && error.response.status === 401) {
          authStore.logout(); // Force logout on authentication failure
          this.error = 'Authentication failed. Please log in again.';
        } else {
          this.error = error.message || 'Failed to create new chat';
        }
        throw error;
      }
    },
    
    async switchToSession(sessionId) {
      // If current session is already the requested session, do nothing
      if (this.currentSession && this.currentSession.id === sessionId) {
        return this.currentSession;
      }
      
      const session = this.sessions.find(s => s.id === sessionId);
      if (session) {
        try {
          const backendSession = await getFullSession(this.agentId, sessionId);
          const fullSession = this.transformFullSession(backendSession);
          this.currentSession = fullSession;
          return fullSession;
        } catch (error) {
          if (error.response && error.response.status === 401) {
            const authStore = useAuthStore();
            authStore.logout(); // Force logout on authentication failure
            this.error = 'Authentication failed. Please log in again.';
          } else {
            this.error = error.message || 'Failed to load chat session';
          }
          throw error;
        }
      }
    },

    // Add a message to the current session
    addMessageToCurrentSession(role, content, references = []) {
      if (this.currentSession) {
        const newMessage = {
          id: `${role}-${Date.now()}`,
          role: role,
          content: content,
          references: references,
          timestamp: new Date().toISOString(),
          is_theory: false
        };
        
        if (!this.currentSession.messages) {
          this.currentSession.messages = [];
        }
        this.currentSession.messages.push(newMessage);
      }
    },
    
    clearError() {
      this.error = null;
    }
  }
});
