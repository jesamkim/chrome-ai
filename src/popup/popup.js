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

  async showChatScreen() {
    this.showScreen('chat');
    
    // 페이지 컨텍스트가 없으면 추가 및 인덱싱
    if (this.chatHistory.length === 0) {
      try {
        // 현재 활성 탭 가져오기
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
          // 페이지 내용 추출
          const pageContent = await this.extractPageContent(tab);
          
          // TextContextManager로 페이지 컨텍스트 처리 (백그라운드에서 실행)
          this.indexCurrentPage(tab, pageContent);
          
          // 기본 페이지 컨텍스트 설정 (TextContextManager 처리 실패 시 폴백용)
          this.pageContext = `현재 사용자가 보고 있는 페이지 정보:
${pageContent}

위 페이지 내용을 바탕으로 사용자의 질문에 답변해주세요.`;
          
          console.log('✅ 채팅에 페이지 컨텍스트 추가됨');
        }
      } catch (error) {
        console.warn('⚠️ 페이지 컨텍스트 추가 실패:', error);
      }
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
          systemPrompt: this.pageContext || '현재 페이지에 대한 질문에 답변해주세요.',
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
      this.pageContext = null; // 페이지 컨텍스트도 초기화
      
      if (this.chatMessages) {
        this.chatMessages.innerHTML = `
          <div class="welcome-message">
            <div class="message assistant">
              <div class="message-content">
                안녕하세요! 현재 페이지에 대해 궁금한 것이 있으시면 언제든 물어보세요. 😊<br><br>
                예시 질문:<br>
                • 이 페이지의 주요 내용은 무엇인가요?<br>
                • 핵심 포인트를 정리해주세요<br>
                • 이 내용을 쉽게 설명해주세요
              </div>
            </div>
          </div>
        `;
      }
      
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
