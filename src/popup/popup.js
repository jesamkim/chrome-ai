/**
 * Claude AI Chrome Extension - Popup Script
 * 팝업 UI 로직 및 사용자 인터랙션 처리
 */

class PopupManager {
  constructor() {
    this.currentScreen = 'analysis';
    this.isConnected = false;
    this.currentModel = 'claude-3.7-sonnet';
    this.chatHistory = [];
    
    this.init();
  }

  async init() {
    console.log('🎯 팝업 매니저 초기화 시작');
    
    // DOM 요소 참조
    this.setupDOMReferences();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // 초기 상태 확인
    await this.checkInitialState();
    
    console.log('✅ 팝업 매니저 초기화 완료');
  }

  setupDOMReferences() {
    // 화면 요소들
    this.screens = {
      setup: document.getElementById('setupScreen'),
      analysis: document.getElementById('analysisScreen'),
      chat: document.getElementById('chatScreen'),
      loading: document.getElementById('loadingScreen')
    };

    // 상태 표시 요소들
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');
    
    // 페이지 정보 요소들
    this.pageTitle = document.getElementById('pageTitle');
    this.pageUrl = document.getElementById('pageUrl');
    
    // 분석 관련 요소들
    this.analysisContent = document.getElementById('analysisContent');
    
    // 채팅 관련 요소들
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.charCount = document.getElementById('charCount');
    
    // 버튼들
    this.buttons = {
      settings: document.getElementById('settingsBtn'),
      refresh: document.getElementById('refreshBtn'),
      openSettings: document.getElementById('openSettingsBtn'),
      analyze: document.getElementById('analyzeBtn'),
      summarize: document.getElementById('summarizeBtn'),
      keyPoints: document.getElementById('keyPointsBtn'),
      translate: document.getElementById('translateBtn'),
      chat: document.getElementById('chatBtn'),
      backToAnalysis: document.getElementById('backToAnalysisBtn'),
      clearChat: document.getElementById('clearChatBtn'),
      send: document.getElementById('sendBtn'),
      help: document.getElementById('helpBtn'),
      feedback: document.getElementById('feedbackBtn')
    };
  }

  setupEventListeners() {
    // 설정 관련
    this.buttons.settings?.addEventListener('click', () => this.openSettings());
    this.buttons.openSettings?.addEventListener('click', () => this.openSettings());
    this.buttons.refresh?.addEventListener('click', () => this.refreshConnection());

    // 분석 관련
    this.buttons.analyze?.addEventListener('click', () => this.analyzeCurrentPage());
    this.buttons.summarize?.addEventListener('click', () => this.performQuickAction('summarize'));
    this.buttons.keyPoints?.addEventListener('click', () => this.performQuickAction('keyPoints'));
    this.buttons.translate?.addEventListener('click', () => this.performQuickAction('translate'));

    // 채팅 관련
    this.buttons.chat?.addEventListener('click', () => this.showChatScreen());
    this.buttons.backToAnalysis?.addEventListener('click', () => this.showAnalysisScreen());
    this.buttons.clearChat?.addEventListener('click', () => this.clearChatHistory());
    this.buttons.send?.addEventListener('click', () => this.sendMessage());

    // 채팅 입력 관련
    this.chatInput?.addEventListener('input', () => this.updateCharCount());
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // 기타
    this.buttons.help?.addEventListener('click', () => this.showHelp());
    this.buttons.feedback?.addEventListener('click', () => this.showFeedback());

    // Chrome 메시지 리스너
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleRuntimeMessage(message, sender, sendResponse);
    });
  }

  async checkInitialState() {
    try {
      // API Key 설정 확인
      const hasApiKey = await this.checkApiKeySetup();
      
      if (!hasApiKey) {
        this.showSetupScreen();
        return;
      }

      // 연결 상태 확인
      await this.checkConnection();
      
      // 현재 페이지 정보 로드
      await this.loadCurrentPageInfo();
      
      // 분석 화면 표시
      this.showAnalysisScreen();
      
    } catch (error) {
      console.error('❌ 초기 상태 확인 실패:', error);
      this.updateConnectionStatus(false, '초기화 실패');
    }
  }

  async checkApiKeySetup() {
    try {
      const result = await chrome.storage.sync.get(['bedrockApiKey']);
      return !!(result.bedrockApiKey && result.bedrockApiKey.trim());
    } catch (error) {
      console.error('❌ API Key 확인 실패:', error);
      return false;
    }
  }

  async checkConnection() {
    try {
      this.updateConnectionStatus(null, '연결 확인 중...');
      
      // Background script에 연결 테스트 요청
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_CONNECTION'
      });

      if (response && response.success) {
        this.isConnected = true;
        this.currentModel = response.model || 'claude-3.7-sonnet';
        this.updateConnectionStatus(true, `${response.modelName || 'Claude 3.7 Sonnet'} 연결됨`);
      } else {
        this.isConnected = false;
        this.updateConnectionStatus(false, response?.error || '연결 실패');
      }
    } catch (error) {
      console.error('❌ 연결 확인 실패:', error);
      this.isConnected = false;
      this.updateConnectionStatus(false, '연결 오류');
    }
  }

  async loadCurrentPageInfo() {
    try {
      // 현재 활성 탭 정보 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab) {
        this.pageTitle.textContent = tab.title || '제목 없음';
        this.pageUrl.textContent = tab.url || '';
      }
    } catch (error) {
      console.error('❌ 페이지 정보 로드 실패:', error);
      this.pageTitle.textContent = '페이지 정보 로드 실패';
      this.pageUrl.textContent = '';
    }
  }

  updateConnectionStatus(connected, message) {
    if (connected === null) {
      this.statusIndicator.className = 'status-indicator';
    } else if (connected) {
      this.statusIndicator.className = 'status-indicator connected';
    } else {
      this.statusIndicator.className = 'status-indicator error';
    }
    
    this.statusText.textContent = message;
  }

  // 화면 전환 메서드들
  showScreen(screenName) {
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.style.display = 'none';
    });
    
    if (this.screens[screenName]) {
      this.screens[screenName].style.display = 'block';
    }
    
    this.currentScreen = screenName;
  }

  showSetupScreen() {
    this.showScreen('setup');
  }

  showAnalysisScreen() {
    this.showScreen('analysis');
  }

  showChatScreen() {
    this.showScreen('chat');
    // 채팅 입력에 포커스
    setTimeout(() => {
      this.chatInput?.focus();
    }, 100);
  }

  showLoadingScreen(message = '처리 중...') {
    const loadingText = document.getElementById('loadingText');
    if (loadingText) {
      loadingText.textContent = message;
    }
    this.showScreen('loading');
  }

  // 액션 메서드들
  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  async refreshConnection() {
    await this.checkConnection();
    if (this.isConnected) {
      await this.loadCurrentPageInfo();
    }
  }

  async analyzeCurrentPage() {
    if (!this.isConnected) {
      this.showSetupScreen();
      return;
    }

    try {
      this.showLoadingScreen('페이지 분석 중...');
      
      // 현재 활성 탭 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('현재 탭을 찾을 수 없습니다.');
      }

      // Content Script에서 페이지 내용 추출
      const pageContent = await this.extractPageContent(tab);

      // Background Script에 분석 요청
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE',
        data: {
          pageContent: pageContent,
          analysisType: 'general'
        }
      });

      if (response && response.success) {
        this.displayAnalysisResult(response.analysis);
        this.showAnalysisScreen();
      } else {
        throw new Error(response?.error || '분석 실패');
      }
    } catch (error) {
      console.error('❌ 페이지 분석 실패:', error);
      this.displayAnalysisResult(`분석 중 오류가 발생했습니다: ${error.message}`);
      this.showAnalysisScreen();
    }
  }

  async performQuickAction(action) {
    if (!this.isConnected) {
      this.showSetupScreen();
      return;
    }

    const actionMessages = {
      summarize: '페이지 요약 중...',
      keyPoints: '핵심 포인트 추출 중...',
      translate: '번역 중...'
    };

    const analysisTypes = {
      summarize: 'summary',
      keyPoints: 'key-points',
      translate: 'translate'
    };

    try {
      this.showLoadingScreen(actionMessages[action] || '처리 중...');
      
      // 현재 활성 탭 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('현재 탭을 찾을 수 없습니다.');
      }

      // Content Script에서 페이지 내용 추출
      const pageContent = await this.extractPageContent(tab);

      // Background Script에 분석 요청
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE',
        data: {
          pageContent: pageContent,
          analysisType: analysisTypes[action] || 'general'
        }
      });

      if (response && response.success) {
        this.displayAnalysisResult(response.analysis);
        this.showAnalysisScreen();
      } else {
        throw new Error(response?.error || '분석 실패');
      }
    } catch (error) {
      console.error(`❌ ${action} 실패:`, error);
      this.displayAnalysisResult(`처리 중 오류가 발생했습니다: ${error.message}`);
      this.showAnalysisScreen();
    }
  }

  displayAnalysisResult(result) {
    if (this.analysisContent) {
      this.analysisContent.innerHTML = `
        <div class="analysis-result">
          ${result.replace(/\n/g, '<br>')}
        </div>
      `;
    }
  }

  // 채팅 관련 메서드들
  async sendMessage() {
    const message = this.chatInput?.value?.trim();
    if (!message || !this.isConnected) return;

    try {
      // 사용자 메시지 표시
      this.addMessageToChat('user', message);
      this.chatInput.value = '';
      this.updateCharCount();
      this.updateSendButton();

      // 타이핑 인디케이터 표시
      this.showTypingIndicator();

      // Background script에 메시지 전송
      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_MESSAGE',
        data: {
          messages: [
            ...this.chatHistory,
            { role: 'user', content: message }
          ],
          sessionId: 'popup-session',
          options: {
            maxTokens: 2000
          }
        }
      });

      // 타이핑 인디케이터 제거
      this.hideTypingIndicator();

      if (response && response.success) {
        this.addMessageToChat('assistant', response.response);
      } else {
        this.addMessageToChat('assistant', `죄송합니다. 오류가 발생했습니다: ${response?.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      this.hideTypingIndicator();
      this.addMessageToChat('assistant', '죄송합니다. 메시지 전송 중 오류가 발생했습니다.');
    }
  }

  addMessageToChat(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
      <div class="message-content">
        ${content.replace(/\n/g, '<br>')}
      </div>
    `;

    this.chatMessages?.appendChild(messageDiv);
    this.chatMessages?.scrollTo(0, this.chatMessages.scrollHeight);

    // 채팅 히스토리에 추가
    this.chatHistory.push({ role, content });
  }

  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
      <span>AI가 입력 중...</span>
    `;

    this.chatMessages?.appendChild(typingDiv);
    this.chatMessages?.scrollTo(0, this.chatMessages.scrollHeight);
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  clearChatHistory() {
    if (confirm('채팅 기록을 모두 삭제하시겠습니까?')) {
      this.chatHistory = [];
      if (this.chatMessages) {
        this.chatMessages.innerHTML = `
          <div class="welcome-message">
            <div class="message assistant">
              <div class="message-content">
                안녕하세요! 현재 페이지에 대해 궁금한 것이 있으시면 언제든 물어보세요. 😊
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  updateCharCount() {
    const length = this.chatInput?.value?.length || 0;
    if (this.charCount) {
      this.charCount.textContent = `${length}/2000`;
    }
    this.updateSendButton();
  }

  updateSendButton() {
    const hasText = this.chatInput?.value?.trim().length > 0;
    if (this.sendBtn) {
      this.sendBtn.disabled = !hasText || !this.isConnected;
    }
  }

  // 공통 유틸리티 메서드들
  generateBasicPageInfo(tab) {
    const domain = new URL(tab.url).hostname;
    return `페이지 제목: ${tab.title || '제목 없음'}
URL: ${tab.url}
도메인: ${domain}
페이지 유형: ${this.getPageType(tab.url)}

참고: 이 페이지는 Content Script가 로드되지 않아 기본 정보만 제공됩니다.
더 자세한 분석을 위해서는 페이지를 새로고침하거나 다른 페이지에서 시도해보세요.`;
  }

  getPageType(url) {
    if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
      return '브라우저 내부 페이지';
    } else if (url.startsWith('file://')) {
      return '로컬 파일';
    } else if (url.includes('github.com')) {
      return 'GitHub 페이지';
    } else if (url.includes('stackoverflow.com')) {
      return 'Stack Overflow';
    } else if (url.includes('wikipedia.org')) {
      return 'Wikipedia';
    } else {
      return '웹 페이지';
    }
  }

  async extractPageContent(tab) {
    try {
      // Content Script 응답 대기 시간 제한 (5초)
      const contentResponse = await Promise.race([
        chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_PAGE_CONTENT'
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Content Script 응답 시간 초과')), 5000)
        )
      ]);
      
      if (contentResponse && contentResponse.success) {
        console.log('✅ Content Script에서 페이지 내용 추출 성공');
        return contentResponse.content;
      } else {
        throw new Error('페이지 내용을 추출할 수 없습니다.');
      }
    } catch (contentError) {
      console.warn('⚠️ Content Script 응답 없음, 기본 정보 사용:', contentError.message);
      return this.generateBasicPageInfo(tab);
    }
  }
  showHelp() {
    const helpUrl = chrome.runtime.getURL('src/options/help.html');
    chrome.tabs.create({ url: helpUrl });
  }

  showFeedback() {
    const feedbackUrl = 'https://github.com/your-repo/claude-ai-extension/issues';
    chrome.tabs.create({ url: feedbackUrl });
  }

  handleRuntimeMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'CONNECTION_STATUS_CHANGED':
        this.isConnected = message.connected;
        this.updateConnectionStatus(message.connected, message.status);
        break;
      
      case 'MODEL_CHANGED':
        this.currentModel = message.model;
        this.updateConnectionStatus(this.isConnected, `${message.modelName} 연결됨`);
        break;
      
      default:
        console.log('📨 알 수 없는 메시지:', message);
    }
  }
}

// 팝업이 로드되면 PopupManager 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 팝업 DOM 로드 완료, PopupManager 초기화');
  new PopupManager();
});

// 디버깅을 위한 전역 참조
window.popupManager = null;
document.addEventListener('DOMContentLoaded', () => {
  window.popupManager = new PopupManager();
});
