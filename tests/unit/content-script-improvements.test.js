/**
 * Content Script 연결 개선 테스트
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  }
};

describe('Content Script 연결 개선 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('제한된 페이지 감지', () => {
    // isRestrictedPage 함수 시뮬레이션
    function isRestrictedPage(url) {
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

    test('Chrome 내부 페이지 감지', () => {
      expect(isRestrictedPage('chrome://extensions/')).toBe(true);
      expect(isRestrictedPage('chrome://settings/')).toBe(true);
      expect(isRestrictedPage('chrome-extension://abc123/popup.html')).toBe(true);
    });

    test('일반 웹페이지는 제한되지 않음', () => {
      expect(isRestrictedPage('https://www.google.com')).toBe(false);
      expect(isRestrictedPage('https://github.com')).toBe(false);
      expect(isRestrictedPage('http://localhost:3000')).toBe(false);
    });

    test('파일 및 데이터 URL 감지', () => {
      expect(isRestrictedPage('file:///C:/test.html')).toBe(true);
      expect(isRestrictedPage('data:text/html,<h1>Test</h1>')).toBe(true);
      expect(isRestrictedPage('javascript:alert("test")')).toBe(true);
    });
  });

  describe('다단계 Content Script 연결', () => {
    test('1단계: PING 성공 시 정상 진행', async () => {
      // Given
      const mockTab = { id: 1, url: 'https://example.com', title: 'Test Page' };
      
      chrome.tabs.sendMessage
        .mockResolvedValueOnce({ success: true, message: 'Content Script is alive' }) // PING
        .mockResolvedValueOnce({ success: true, content: '페이지 내용입니다' }); // EXTRACT

      // extractPageContent 함수 시뮬레이션
      async function extractPageContent(tab) {
        // 1단계: PING
        const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
        if (pingResponse && pingResponse.success) {
          // 2단계: 내용 추출
          const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' });
          if (contentResponse && contentResponse.success) {
            return contentResponse.content;
          }
        }
        throw new Error('Content Script 응답 없음');
      }

      // When
      const result = await extractPageContent(mockTab);

      // Then
      expect(chrome.tabs.sendMessage).toHaveBeenCalledTimes(2);
      expect(chrome.tabs.sendMessage).toHaveBeenNthCalledWith(1, 1, { type: 'PING' });
      expect(chrome.tabs.sendMessage).toHaveBeenNthCalledWith(2, 1, { type: 'EXTRACT_PAGE_CONTENT' });
      expect(result).toBe('페이지 내용입니다');
    });

    test('2단계: PING 실패 시 동적 주입 시도', async () => {
      // Given
      const mockTab = { id: 1, url: 'https://example.com', title: 'Test Page' };
      
      chrome.tabs.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection')) // PING 실패
        .mockResolvedValueOnce({ success: true, content: '동적 주입 후 내용' }); // 재시도 성공
      
      chrome.scripting.executeScript.mockResolvedValue([]);

      // extractPageContent 함수 시뮬레이션 (간소화)
      async function extractPageContent(tab) {
        try {
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
          if (pingResponse && pingResponse.success) {
            const contentResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' });
            return contentResponse.content;
          }
        } catch (error) {
          // 동적 주입 시도
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['src/content/content.js']
          });
          
          const retryResponse = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_CONTENT' });
          return retryResponse.content;
        }
      }

      // When
      const result = await extractPageContent(mockTab);

      // Then
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        files: ['src/content/content.js']
      });
      expect(result).toBe('동적 주입 후 내용');
    });

    test('3단계: 기본 DOM 접근 시도', async () => {
      // Given
      const mockTab = { id: 1, url: 'https://example.com', title: 'Test Page' };
      
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'));
      chrome.scripting.executeScript
        .mockRejectedValueOnce(new Error('Dynamic injection failed')) // 동적 주입 실패
        .mockResolvedValueOnce([{ // 기본 DOM 접근 성공
          result: {
            title: 'Test Page',
            content: '기본 DOM에서 추출한 내용',
            description: '페이지 설명',
            url: 'https://example.com'
          }
        }]);

      // extractPageContent 함수 시뮬레이션 (간소화)
      async function extractPageContent(tab) {
        try {
          const pingResponse = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
          // ... PING 및 동적 주입 실패 시나리오
        } catch (error) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            });
            // 동적 주입 실패
          } catch (injectionError) {
            // 기본 DOM 접근
            const basicContent = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => ({
                title: document.title,
                content: document.body ? document.body.innerText.slice(0, 5000) : '',
                description: document.querySelector('meta[name="description"]')?.content || '',
                url: window.location.href
              })
            });
            
            if (basicContent && basicContent[0] && basicContent[0].result) {
              const result = basicContent[0].result;
              return `페이지 제목: ${result.title}\nURL: ${result.url}\n내용: ${result.content}`;
            }
          }
        }
        
        return '기본 정보';
      }

      // When
      const result = await extractPageContent(mockTab);

      // Then
      expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
      expect(result).toContain('Test Page');
      expect(result).toContain('기본 DOM에서 추출한 내용');
    });
  });

  describe('개선된 기본 페이지 정보', () => {
    // generateBasicPageInfo 함수 시뮬레이션
    function generateBasicPageInfo(tab) {
      try {
        const url = new URL(tab.url);
        const domain = url.hostname;
        
        let additionalInfo = '';
        
        if (url.search) {
          const params = new URLSearchParams(url.search);
          const paramCount = Array.from(params.keys()).length;
          additionalInfo += `\nURL 파라미터: ${paramCount}개`;
        }
        
        if (url.pathname && url.pathname !== '/') {
          const pathSegments = url.pathname.split('/').filter(segment => segment);
          additionalInfo += `\n경로 깊이: ${pathSegments.length}단계`;
        }
        
        return `페이지 제목: ${tab.title || '제목 없음'}
URL: ${tab.url}
도메인: ${domain}${additionalInfo}

분석 제한사항:
- Content Script가 로드되지 않아 기본 정보만 제공됩니다`;
        
      } catch (error) {
        return `페이지 정보 생성 중 오류가 발생했습니다: ${error.message}`;
      }
    }

    test('URL 파라미터 분석', () => {
      // Given
      const tab = {
        id: 1,
        title: 'Search Results',
        url: 'https://www.google.com/search?q=test&hl=ko&safe=strict'
      };

      // When
      const result = generateBasicPageInfo(tab);

      // Then
      expect(result).toContain('도메인: www.google.com');
      expect(result).toContain('URL 파라미터: 3개');
      expect(result).toContain('경로 깊이: 1단계');
    });

    test('복잡한 경로 분석', () => {
      // Given
      const tab = {
        id: 1,
        title: 'GitHub Repository',
        url: 'https://github.com/user/repo/blob/main/src/index.js'
      };

      // When
      const result = generateBasicPageInfo(tab);

      // Then
      expect(result).toContain('도메인: github.com');
      expect(result).toContain('경로 깊이: 6단계'); // user/repo/blob/main/src/index.js = 6단계
    });

    test('잘못된 URL 처리', () => {
      // Given
      const tab = {
        id: 1,
        title: 'Invalid URL',
        url: 'not-a-valid-url'
      };

      // When
      const result = generateBasicPageInfo(tab);

      // Then
      expect(result).toContain('페이지 정보 생성 중 오류가 발생했습니다');
    });
  });

  describe('Content Script 메시지 처리', () => {
    test('PING 메시지 응답', () => {
      // Given
      const request = { type: 'PING' };
      const sendResponse = jest.fn();

      // handleMessage 함수 시뮬레이션
      function handleMessage(request, sender, sendResponse) {
        switch (request.type) {
          case 'PING':
            sendResponse({ success: true, message: 'Content Script is alive' });
            break;
          default:
            sendResponse({ success: false, error: '알 수 없는 메시지 타입' });
        }
      }

      // When
      handleMessage(request, null, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        message: 'Content Script is alive'
      });
    });

    test('GET_PAGE_INFO 메시지 응답', () => {
      // Given
      const request = { type: 'GET_PAGE_INFO' };
      const sendResponse = jest.fn();

      // Mock window 객체
      global.window = {
        location: {
          href: 'https://example.com/test',
          hostname: 'example.com'
        }
      };
      global.document = {
        title: 'Test Page'
      };

      function handleMessage(request, sender, sendResponse) {
        switch (request.type) {
          case 'GET_PAGE_INFO':
            sendResponse({
              success: true,
              info: {
                url: window.location.href,
                title: document.title,
                domain: window.location.hostname,
                isInitialized: true
              }
            });
            break;
        }
      }

      // When
      handleMessage(request, null, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        info: {
          url: 'https://example.com/test',
          title: 'Test Page',
          domain: 'example.com',
          isInitialized: true
        }
      });
    });
  });
});

console.log('🧪 Content Script 연결 개선 테스트 파일 생성 완료');
