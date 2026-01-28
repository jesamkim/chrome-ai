/**
 * Chrome AI Assistant - Side Panel Script
 * Side Panel UI 로직, 채팅 히스토리 영구 저장, IME 처리
 */

class SidePanelManager {
  constructor() {
    this.currentScreen = 'analysis';
    this.isConnected = false;
    this.currentModel = 'claude-haiku-4.5';
    this.chatHistory = [];
    this.isSending = false;
    this.isComposing = false; // IME 조합 중 플래그
    this.sessionId = null; // 현재 세션 ID
    this.currentUrl = '';
    this.currentTitle = '';

    // 성능 최적화 설정
    this.VIRTUAL_SCROLL_THRESHOLD = 50; // 이 개수 이상일 때 가상 스크롤 활성화
    this.RENDER_BATCH_SIZE = 30; // 한 번에 렌더링할 메시지 수
    this.renderedMessageRange = { start: 0, end: 0 }; // 현재 렌더링된 메시지 범위
    this.isScrolling = false;
    this.scrollTimeout = null;

    this.init();
  }

  async init() {
    console.log('🎯 Side Panel 매니저 초기화 시작');
    
    // DOM 요소 참조
    this.setupDOMReferences();
    
    // 이벤트 리스너 설정
    this.setupEventListeners();
    
    // 초기 상태 확인
    await this.checkInitialState();

    // 채팅 히스토리 로드
    await this.loadChatHistory();

    console.log('✅ Side Panel 매니저 초기화 완료');
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

    // 세션 관련 요소들
    this.sessionsSidebar = document.getElementById('sessionsSidebar');
    this.sessionsList = document.getElementById('sessionsList');
    this.sessionsSearch = document.getElementById('sessionsSearch');

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
      feedback: document.getElementById('feedbackBtn'),
      sessions: document.getElementById('sessionsBtn'),
      closeSessions: document.getElementById('closeSessionsBtn')
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

    // 세션 관련
    this.buttons.sessions?.addEventListener('click', () => this.toggleSessionsSidebar());
    this.buttons.closeSessions?.addEventListener('click', () => this.hideSessionsSidebar());
    this.sessionsSearch?.addEventListener('input', (e) => this.filterSessions(e.target.value));

    // 채팅 입력 관련 - IME 처리 포함
    this.chatInput?.addEventListener('input', () => this.updateCharCount());

    // IME composition 이벤트 (한글 입력 문제 해결)
    this.chatInput?.addEventListener('compositionstart', () => {
      this.isComposing = true;
      console.log('🎯 IME 조합 시작');
    });

    this.chatInput?.addEventListener('compositionend', () => {
      this.isComposing = false;
      console.log('✅ IME 조합 완료');
    });

    this.chatInput?.addEventListener('keydown', (e) => {
      // IME 입력 중이 아닐 때만 Enter 처리
      if (e.key === 'Enter' && !e.shiftKey && !this.isComposing) {
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
        this.currentModel = response.model || 'claude-haiku-4.5';
        this.updateConnectionStatus(true, `${response.modelName || 'Claude Haiku 4.5'} 연결됨`);
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

  async showChatScreen() {
    this.showScreen('chat');

    // 페이지 컨텍스트 항상 로드 (페이지가 변경될 수 있으므로)
    try {
      // 현재 활성 탭 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        console.log('📄 현재 페이지 컨텍스트 로드 중...');

        // 페이지 내용 추출
        const pageContent = await this.extractPageContent(tab);

        // TextContextManager로 페이지 컨텍스트 처리 (백그라운드에서 실행)
        this.indexCurrentPage(tab, pageContent);

        // 기본 페이지 컨텍스트 설정 (TextContextManager 처리 실패 시 폴백용)
        this.pageContext = `현재 사용자가 보고 있는 페이지 정보:
${pageContent}

위 페이지 내용을 바탕으로 사용자의 질문에 답변해주세요.`;

        console.log('✅ 채팅에 페이지 컨텍스트 추가됨');
        console.log(`📊 페이지 컨텍스트 길이: ${pageContent.length}자`);
      }
    } catch (error) {
      console.error('❌ 페이지 컨텍스트 추가 실패:', error);
      // 에러가 나도 채팅은 계속 가능하도록
      this.pageContext = '페이지 내용을 가져올 수 없습니다. 일반적인 질문에 답변해드리겠습니다.';
    }

    // 채팅 입력에 포커스
    setTimeout(() => {
      this.chatInput?.focus();
    }, 100);
  }

  /**
   * 현재 페이지를 TextContextManager로 처리
   */
  async indexCurrentPage(tab, pageContent) {
    try {
      console.log('📊 페이지 TextContextManager 처리 시작...');
      
      // 향상된 텍스트 추출 결과가 있는지 확인
      const fullPageData = await this.getFullPageData(tab);
      
      if (!fullPageData || !fullPageData.fullData) {
        console.warn('⚠️ 전체 페이지 데이터가 없어 인덱싱 건너뜀');
        return;
      }

      // Background Script에 인덱싱 요청
      const response = await chrome.runtime.sendMessage({
        type: 'INDEX_PAGE',
        data: fullPageData
      });

      if (response && response.success) {
        console.log('✅ 페이지 인덱싱 완료:', response.result);
        
        // 사용자에게 알림 (선택적)
        this.showIndexingComplete(response.result);
      } else {
        console.warn('⚠️ 페이지 인덱싱 실패:', response?.error);
      }

    } catch (error) {
      console.warn('⚠️ 페이지 인덱싱 중 오류:', error.message);
    }
  }

  /**
   * 전체 페이지 데이터 가져오기
   */
  async getFullPageData(tab) {
    try {
      // Content Script에서 향상된 텍스트 추출 결과 가져오기
      const contentResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_PAGE_CONTENT'
      });

      if (contentResponse && contentResponse.success && contentResponse.fullData) {
        return {
          fullData: contentResponse.fullData,
          metadata: contentResponse.metadata
        };
      }

      return null;
    } catch (error) {
      console.warn('⚠️ 전체 페이지 데이터 가져오기 실패:', error);
      return null;
    }
  }

  /**
   * 인덱싱 완료 알림 표시
   */
  showIndexingComplete(result) {
    // 채팅 영역에 시스템 메시지 추가
    const systemMessage = `📊 페이지 분석 완료: ${result.chunkCount}개 섹션으로 분할되어 의미 검색이 가능합니다.`;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
      <div class="message-content system-info">
        ${systemMessage}
      </div>
    `;

    this.chatMessages?.appendChild(messageDiv);
    this.chatMessages?.scrollTo(0, this.chatMessages.scrollHeight);
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
      translate: '한국어로 번역 중...'
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
          ${this.renderMarkdown(result)}
        </div>
      `;
    }
  }

  // 채팅 관련 메서드들
  async sendMessage() {
    const message = this.chatInput?.value?.trim();
    if (!message || !this.isConnected) return;

    // 중복 호출 방지
    if (this.isSending) {
      console.log('⚠️ 메시지 전송 중, 중복 호출 방지');
      return;
    }

    try {
      this.isSending = true; // 전송 중 플래그 설정
      
      // 사용자 메시지 표시
      this.addMessageToChat('user', message);
      this.chatInput.value = '';
      this.updateCharCount();
      this.updateSendButton();

      // 타이핑 인디케이터 표시
      this.showTypingIndicator();

      // Background script에 메시지 전송
      // API 전송용 메시지 (timestamp 제거)
      const apiMessages = this.chatHistory.map(({ role, content }) => ({ role, content }));
      apiMessages.push({ role: 'user', content: message });

      // 페이지 컨텍스트 확인
      const systemPrompt = this.pageContext || '현재 페이지에 대한 질문에 답변해주세요.';
      console.log('📤 메시지 전송 - 페이지 컨텍스트:', this.pageContext ? `${this.pageContext.length}자` : '없음');

      const response = await chrome.runtime.sendMessage({
        type: 'CHAT_MESSAGE',
        data: {
          messages: apiMessages,
          systemPrompt: systemPrompt,
          useVectorSearch: true, // 페이지 컨텍스트 활성화
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
        
        // TextContextManager 사용 정보 표시 (디버그용)
        if (response.vectorSearch && response.vectorSearch.used) {
          console.log('🔍 TextContextManager 컨텍스트 사용됨:', {
            contextLength: response.vectorSearch.contextLength,
            originalLength: response.vectorSearch.originalLength,
            compressionRatio: response.vectorSearch.compressionRatio,
            estimatedTokens: response.vectorSearch.estimatedTokens
          });
        }
      } else {
        this.addMessageToChat('assistant', `죄송합니다. 오류가 발생했습니다: ${response?.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('❌ 메시지 전송 실패:', error);
      this.hideTypingIndicator();
      this.addMessageToChat('assistant', '죄송합니다. 메시지 전송 중 오류가 발생했습니다.');
    } finally {
      this.isSending = false; // 전송 완료 후 플래그 해제
    }
  }

  addMessageToChat(role, content, shouldSave = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    // renderMarkdown는 이미 XSS 방지 처리를 하고 있으므로 사용 가능
    contentDiv.innerHTML = this.renderMarkdown(content);

    messageDiv.appendChild(contentDiv);

    this.chatMessages?.appendChild(messageDiv);
    this.chatMessages?.scrollTo(0, this.chatMessages.scrollHeight);

    // 채팅 히스토리에 추가 및 저장
    if (shouldSave) {
      this.chatHistory.push({ role, content, timestamp: Date.now() });
      // 비동기로 저장 (블로킹 방지)
      this.saveChatHistory().catch(err => {
        console.error('❌ 메시지 저장 실패:', err);
      });
    }
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

  async clearChatHistory() {
    if (confirm('채팅 기록을 모두 삭제하시겠습니까?')) {
      this.chatHistory = [];
      this.pageContext = null;

      // Storage에서도 삭제
      if (this.sessionId) {
        try {
          await chrome.storage.local.remove(`chatSession_${this.sessionId}`);
          console.log('✅ Storage에서 채팅 히스토리 삭제 완료');
        } catch (error) {
          console.error('❌ Storage 삭제 실패:', error);
        }
      }

      // UI 초기화
      this.renderChatHistory();

      // 페이지 컨텍스트 다시 로드
      this.showChatScreen();
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

  /**
   * 마크다운 텍스트를 HTML로 변환
   * @param {string} text - 마크다운 형식의 텍스트
   * @returns {string} HTML 형식의 텍스트
   */
  renderMarkdown(text) {
    if (!text) return '';

    // HTML 이스케이프 (XSS 방지)
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 코드 블록 (```) - 먼저 처리하여 내부 마크다운 처리 방지
    const codeBlocks = [];
    html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
      const index = codeBlocks.length;
      codeBlocks.push(code.trim());
      return `___CODE_BLOCK_${index}___`;
    });

    // 인라인 코드 (`)
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const index = inlineCodes.length;
      inlineCodes.push(code);
      return `___INLINE_CODE_${index}___`;
    });

    // 굵은 글씨 (**text** or __text__)
    html = html.replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

    // 기울임 (*text* or _text_)
    html = html.replace(/\*([^\*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // 링크 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // 헤딩 (# ## ###)
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 순서 없는 리스트 (- or * or +)
    html = html.replace(/^[\-\*\+] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 순서 있는 리스트 (1. 2. 3.)
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // 인용구 (>)
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // 수평선 (--- or ***)
    html = html.replace(/^(\-\-\-|\*\*\*)$/gm, '<hr>');

    // 개행 처리
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // 단락으로 감싸기
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    // 코드 블록 복원
    codeBlocks.forEach((code, index) => {
      html = html.replace(
        `___CODE_BLOCK_${index}___`,
        `<pre><code>${code}</code></pre>`
      );
    });

    // 인라인 코드 복원
    inlineCodes.forEach((code, index) => {
      html = html.replace(
        `___INLINE_CODE_${index}___`,
        `<code>${code}</code>`
      );
    });

    return html;
  }

  // 공통 유틸리티 메서드들
  generateBasicPageInfo(tab) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname;
      const pageType = this.getPageType(tab.url);
      
      let additionalInfo = '';
      
      // URL 파라미터 분석
      if (url.search) {
        const params = new URLSearchParams(url.search);
        const paramCount = Array.from(params.keys()).length;
        additionalInfo += `\nURL 파라미터: ${paramCount}개`;
      }
      
      // 경로 분석
      if (url.pathname && url.pathname !== '/') {
        const pathSegments = url.pathname.split('/').filter(segment => segment);
        additionalInfo += `\n경로 깊이: ${pathSegments.length}단계`;
      }
      
      return `페이지 제목: ${tab.title || '제목 없음'}
URL: ${tab.url}
도메인: ${domain}
페이지 유형: ${pageType}${additionalInfo}

분석 제한사항:
- Content Script가 로드되지 않아 기본 정보만 제공됩니다
- 페이지의 실제 텍스트 내용을 분석할 수 없습니다
- 동적 콘텐츠나 JavaScript로 생성된 내용은 포함되지 않습니다

권장사항:
- 페이지를 새로고침한 후 다시 시도해보세요
- 다른 웹페이지에서 Extension을 테스트해보세요
- ${pageType === '브라우저 내부 페이지' ? 'Chrome 내부 페이지는 보안상 분석이 제한됩니다' : '일반 웹페이지에서는 정상적으로 작동해야 합니다'}`;
      
    } catch (error) {
      console.error('❌ 기본 페이지 정보 생성 실패:', error);
      return `페이지 정보 생성 중 오류가 발생했습니다.
제목: ${tab.title || '알 수 없음'}
URL: ${tab.url || '알 수 없음'}

오류: ${error.message}`;
    }
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
    // 특수 페이지 체크 (Content Script가 작동하지 않는 페이지들)
    if (this.isRestrictedPage(tab.url)) {
      console.log('🚫 제한된 페이지, 기본 정보 사용:', tab.url);
      return this.generateBasicPageInfo(tab);
    }

    try {
      // 1단계: Content Script 생존 확인
      console.log('🔍 Content Script 생존 확인...');
      const pingResponse = await Promise.race([
        chrome.tabs.sendMessage(tab.id, { type: 'PING' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PING 응답 시간 초과')), 2000)
        )
      ]);

      if (pingResponse && pingResponse.success) {
        console.log('✅ Content Script 생존 확인됨');
        
        // 2단계: 페이지 내용 추출
        const contentResponse = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('내용 추출 시간 초과')), 5000)
          )
        ]);
        
        if (contentResponse && contentResponse.success) {
          console.log('✅ Content Script에서 페이지 내용 추출 성공');
          return contentResponse.content;
        }
      }
      
      throw new Error('Content Script 응답 없음');
      
    } catch (contentError) {
      console.debug('🔍 Content Script 1차 시도 실패 (정상 동작):', contentError.message);
      
      // 3단계: Content Script 동적 주입 시도
      try {
        console.log('🔄 Content Script 동적 주입 시도...');
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/content.js']
        });
        
        console.log('✅ Content Script 동적 주입 완료');
        
        // 주입 후 초기화 대기
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4단계: 동적 주입 후 재시도
        const retryResponse = await Promise.race([
          chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('재시도 시간 초과')), 5000)
          )
        ]);
        
        if (retryResponse && retryResponse.success) {
          console.log('✅ 동적 주입 후 페이지 내용 추출 성공');
          return retryResponse.content;
        }
        
        throw new Error('동적 주입 후에도 응답 없음');
        
      } catch (injectionError) {
        console.warn('⚠️ Content Script 동적 주입 실패:', injectionError.message);
        
        // 5단계: 최후의 수단 - 기본 DOM 접근
        try {
          console.log('🔄 기본 DOM 접근 시도...');
          
          const basicContent = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // 페이지에서 직접 텍스트 추출
              const title = document.title;
              const bodyText = document.body ? document.body.innerText.slice(0, 5000) : '';
              const metaDescription = document.querySelector('meta[name="description"]')?.content || '';
              
              return {
                title: title,
                content: bodyText,
                description: metaDescription,
                url: window.location.href
              };
            }
          });
          
          if (basicContent && basicContent[0] && basicContent[0].result) {
            const result = basicContent[0].result;
            console.log('✅ 기본 DOM 접근으로 내용 추출 성공');
            
            return `페이지 제목: ${result.title}
URL: ${result.url}
설명: ${result.description}

페이지 내용:
${result.content}

참고: Content Script를 통한 고급 분석이 불가능하여 기본 내용만 추출되었습니다.`;
          }
          
        } catch (domError) {
          console.warn('⚠️ 기본 DOM 접근도 실패:', domError.message);
        }
      }
    }
    
    // 모든 시도 실패 시 기본 정보 반환
    console.warn('⚠️ 모든 Content Script 시도 실패, 기본 정보 사용');
    return this.generateBasicPageInfo(tab);
  }

  /**
   * 제한된 페이지인지 확인
   */
  isRestrictedPage(url) {
    const restrictedPatterns = [
      /^chrome:\/\//,
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^edge:\/\//,
      /^about:/,
      /^file:\/\//,
      /^data:/,
      /^javascript:/
    ];
    
    return restrictedPatterns.some(pattern => pattern.test(url));
  }
  showHelp() {
    const helpUrl = chrome.runtime.getURL('src/options/help.html');
    chrome.tabs.create({ url: helpUrl });
  }

  showFeedback() {
    const feedbackUrl = 'https://github.com/your-repo/claude-ai-extension/issues';
    chrome.tabs.create({ url: feedbackUrl });
  }

  /**
   * 채팅 히스토리 저장 (Chrome Storage API)
   */
  async saveChatHistory() {
    try {
      if (!this.sessionId) {
        console.warn('⚠️ 세션 ID가 없어 저장 건너뜀');
        return;
      }

      const sessionData = {
        id: this.sessionId,
        url: this.currentUrl,
        title: this.currentTitle,
        messages: this.chatHistory,
        lastActivity: Date.now(),
        createdAt: this.sessionCreatedAt || Date.now()
      };

      await chrome.storage.local.set({
        [`chatSession_${this.sessionId}`]: sessionData,
        currentSessionId: this.sessionId
      });

      console.log('✅ 채팅 히스토리 저장 완료:', this.sessionId);
    } catch (error) {
      console.error('❌ 채팅 히스토리 저장 실패:', error);
    }
  }

  /**
   * 채팅 히스토리 로드 (Chrome Storage API)
   */
  async loadChatHistory() {
    try {
      // 현재 활성 탭 정보로 세션 ID 생성
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        this.currentUrl = tab.url;
        this.currentTitle = tab.title || '제목 없음';
        this.sessionId = this.generateSessionId(tab.url);

        // 저장된 세션 데이터 로드
        const result = await chrome.storage.local.get(`chatSession_${this.sessionId}`);
        const sessionData = result[`chatSession_${this.sessionId}`];

        if (sessionData && sessionData.messages) {
          this.chatHistory = sessionData.messages;
          this.sessionCreatedAt = sessionData.createdAt;

          // 채팅 화면에 메시지 렌더링
          if (this.currentScreen === 'chat') {
            this.renderChatHistory();
          }

          console.log(`✅ 채팅 히스토리 로드 완료: ${this.chatHistory.length}개 메시지`);
        } else {
          console.log('ℹ️ 저장된 채팅 히스토리 없음, 새 세션 시작');
          this.sessionCreatedAt = Date.now();
        }
      }
    } catch (error) {
      console.error('❌ 채팅 히스토리 로드 실패:', error);
    }
  }

  /**
   * URL 기반 세션 ID 생성
   */
  generateSessionId(url) {
    try {
      const urlObj = new URL(url);
      // 도메인 + 경로를 기반으로 세션 ID 생성 (쿼리 파라미터 제외)
      return `${urlObj.hostname}${urlObj.pathname}`.replace(/[^a-zA-Z0-9]/g, '_');
    } catch (error) {
      return 'default_session';
    }
  }

  /**
   * 채팅 히스토리 렌더링 (가상 스크롤 지원)
   */
  renderChatHistory() {
    if (!this.chatMessages) return;

    // 기존 메시지 초기화
    while (this.chatMessages.firstChild) {
      this.chatMessages.removeChild(this.chatMessages.firstChild);
    }

    if (this.chatHistory.length === 0) {
      // 환영 메시지 표시
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'welcome-message';

      const messageDiv = document.createElement('div');
      messageDiv.className = 'message assistant';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = '안녕하세요! 현재 페이지에 대해 궁금한 것이 있으시면 언제든 물어보세요.';

      messageDiv.appendChild(contentDiv);
      welcomeDiv.appendChild(messageDiv);
      this.chatMessages.appendChild(welcomeDiv);
    } else {
      // 메시지 렌더링 (성능 최적화)
      if (this.chatHistory.length > this.VIRTUAL_SCROLL_THRESHOLD) {
        console.log(`🚀 가상 스크롤 모드 활성화 (${this.chatHistory.length}개 메시지)`);
        this.renderMessagesVirtual();
        this.setupVirtualScrollListener();
      } else {
        // 일반 렌더링
        this.chatHistory.forEach(msg => {
          this.addMessageToChat(msg.role, msg.content, false);
        });
      }
    }

    // 스크롤을 최하단으로
    this.chatMessages?.scrollTo(0, this.chatMessages.scrollHeight);
  }

  /**
   * 가상 스크롤로 메시지 렌더링
   */
  renderMessagesVirtual() {
    // 최근 메시지들만 렌더링
    const start = Math.max(0, this.chatHistory.length - this.RENDER_BATCH_SIZE);
    const end = this.chatHistory.length;

    this.renderedMessageRange = { start, end };

    for (let i = start; i < end; i++) {
      const msg = this.chatHistory[i];
      this.addMessageToChat(msg.role, msg.content, false);
    }

    console.log(`✅ ${end - start}개 메시지 렌더링 완료 (총 ${this.chatHistory.length}개 중)`);
  }

  /**
   * 가상 스크롤 이벤트 리스너 설정
   */
  setupVirtualScrollListener() {
    if (!this.chatMessages) return;

    // 기존 리스너 제거
    if (this.scrollListenerAttached) return;

    this.chatMessages.addEventListener('scroll', () => {
      this.isScrolling = true;

      // 디바운싱
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
        this.handleVirtualScroll();
      }, 100);
    });

    this.scrollListenerAttached = true;
    console.log('✅ 가상 스크롤 리스너 설정 완료');
  }

  /**
   * 가상 스크롤 처리
   */
  handleVirtualScroll() {
    if (!this.chatMessages) return;

    const scrollTop = this.chatMessages.scrollTop;
    const scrollThreshold = 200; // 상단에서 200px 이내

    // 상단 근처로 스크롤 시 이전 메시지 로드
    if (scrollTop < scrollThreshold && this.renderedMessageRange.start > 0) {
      console.log('📜 이전 메시지 로드...');
      this.loadPreviousMessages();
    }
  }

  /**
   * 이전 메시지 로드 (스크롤 위쪽)
   */
  loadPreviousMessages() {
    const currentScrollHeight = this.chatMessages.scrollHeight;
    const currentScrollTop = this.chatMessages.scrollTop;

    // 이전 배치 로드
    const batchSize = 20;
    const newStart = Math.max(0, this.renderedMessageRange.start - batchSize);
    const oldStart = this.renderedMessageRange.start;

    // 새 메시지들을 앞에 추가
    const fragment = document.createDocumentFragment();
    for (let i = newStart; i < oldStart; i++) {
      const msg = this.chatHistory[i];
      const messageDiv = this.createMessageElement(msg.role, msg.content);
      fragment.appendChild(messageDiv);
    }

    // DOM에 삽입
    this.chatMessages.insertBefore(fragment, this.chatMessages.firstChild);

    this.renderedMessageRange.start = newStart;

    // 스크롤 위치 유지
    const newScrollHeight = this.chatMessages.scrollHeight;
    this.chatMessages.scrollTop = currentScrollTop + (newScrollHeight - currentScrollHeight);

    console.log(`✅ ${oldStart - newStart}개 이전 메시지 로드 완료`);
  }

  /**
   * 메시지 DOM 요소 생성 (재사용 가능)
   */
  createMessageElement(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = this.renderMarkdown(content);

    messageDiv.appendChild(contentDiv);
    return messageDiv;
  }

  /**
   * 세션 사이드바 토글
   */
  async toggleSessionsSidebar() {
    if (this.sessionsSidebar.style.display === 'none') {
      await this.showSessionsSidebar();
    } else {
      this.hideSessionsSidebar();
    }
  }

  /**
   * 세션 사이드바 표시
   */
  async showSessionsSidebar() {
    this.sessionsSidebar.style.display = 'flex';
    await this.loadAllSessions();
  }

  /**
   * 세션 사이드바 숨기기
   */
  hideSessionsSidebar() {
    this.sessionsSidebar.style.display = 'none';
  }

  /**
   * 모든 세션 로드
   */
  async loadAllSessions() {
    try {
      const result = await chrome.storage.local.get(null);
      const sessions = [];

      // chatSession_ 으로 시작하는 모든 키 찾기
      for (const [key, value] of Object.entries(result)) {
        if (key.startsWith('chatSession_') && value.messages) {
          sessions.push({
            id: value.id,
            title: value.title,
            url: value.url,
            messageCount: value.messages.length,
            lastActivity: value.lastActivity,
            createdAt: value.createdAt
          });
        }
      }

      // 최근 활동 순으로 정렬
      sessions.sort((a, b) => b.lastActivity - a.lastActivity);

      this.renderSessions(sessions);
      console.log(`✅ ${sessions.length}개 세션 로드 완료`);
    } catch (error) {
      console.error('❌ 세션 로드 실패:', error);
    }
  }

  /**
   * 세션 목록 렌더링
   */
  renderSessions(sessions) {
    if (!this.sessionsList) return;

    // 기존 목록 초기화
    while (this.sessionsList.firstChild) {
      this.sessionsList.removeChild(this.sessionsList.firstChild);
    }

    if (sessions.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'sessions-empty';
      emptyDiv.textContent = '저장된 세션이 없습니다';
      this.sessionsList.appendChild(emptyDiv);
      return;
    }

    // 세션 아이템 생성
    sessions.forEach(session => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'session-item';
      if (session.id === this.sessionId) {
        itemDiv.classList.add('active');
      }

      const titleDiv = document.createElement('div');
      titleDiv.className = 'session-title';
      titleDiv.textContent = session.title || '제목 없음';

      const metaDiv = document.createElement('div');
      metaDiv.className = 'session-meta';

      const urlSpan = document.createElement('span');
      urlSpan.className = 'session-url';
      try {
        const urlObj = new URL(session.url);
        urlSpan.textContent = urlObj.hostname;
      } catch {
        urlSpan.textContent = session.url;
      }

      const countSpan = document.createElement('span');
      countSpan.className = 'session-count';
      countSpan.textContent = `${session.messageCount}개`;

      metaDiv.appendChild(urlSpan);
      metaDiv.appendChild(countSpan);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'session-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.deleteSession(session.id);
      };

      itemDiv.appendChild(titleDiv);
      itemDiv.appendChild(metaDiv);
      itemDiv.appendChild(deleteBtn);

      // 세션 클릭 시 전환
      itemDiv.onclick = () => this.switchSession(session.id);

      this.sessionsList.appendChild(itemDiv);
    });
  }

  /**
   * 세션 전환
   */
  async switchSession(sessionId) {
    try {
      console.log(`🔄 세션 전환: ${sessionId}`);

      // 현재 세션 저장
      await this.saveChatHistory();

      // 새 세션 로드
      const result = await chrome.storage.local.get(`chatSession_${sessionId}`);
      const sessionData = result[`chatSession_${sessionId}`];

      if (sessionData) {
        this.sessionId = sessionData.id;
        this.currentUrl = sessionData.url;
        this.currentTitle = sessionData.title;
        this.chatHistory = sessionData.messages || [];
        this.sessionCreatedAt = sessionData.createdAt;

        // UI 업데이트
        this.renderChatHistory();
        this.hideSessionsSidebar();

        // 페이지 정보 업데이트
        if (this.pageTitle) this.pageTitle.textContent = this.currentTitle;
        if (this.pageUrl) this.pageUrl.textContent = this.currentUrl;

        console.log(`✅ 세션 전환 완료: ${this.chatHistory.length}개 메시지`);
      }
    } catch (error) {
      console.error('❌ 세션 전환 실패:', error);
    }
  }

  /**
   * 세션 삭제
   */
  async deleteSession(sessionId) {
    if (!confirm('이 세션을 삭제하시겠습니까?')) return;

    try {
      await chrome.storage.local.remove(`chatSession_${sessionId}`);
      console.log(`✅ 세션 삭제 완료: ${sessionId}`);

      // 현재 세션이 삭제된 경우 새 세션 시작
      if (sessionId === this.sessionId) {
        this.chatHistory = [];
        this.renderChatHistory();
      }

      // 세션 목록 새로고침
      await this.loadAllSessions();
    } catch (error) {
      console.error('❌ 세션 삭제 실패:', error);
    }
  }

  /**
   * 세션 검색/필터링
   */
  filterSessions(searchTerm) {
    const items = this.sessionsList.querySelectorAll('.session-item');
    const term = searchTerm.toLowerCase();

    items.forEach(item => {
      const title = item.querySelector('.session-title').textContent.toLowerCase();
      const url = item.querySelector('.session-url').textContent.toLowerCase();

      if (title.includes(term) || url.includes(term)) {
        item.style.display = '';
      } else {
        item.style.display = 'none';
      }
    });
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

// Side Panel이 로드되면 SidePanelManager 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Side Panel DOM 로드 완료, SidePanelManager 초기화');
  window.sidePanelManager = new SidePanelManager();
});
