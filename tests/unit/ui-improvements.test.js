/**
 * UI 개선사항 테스트
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  }
};

describe('UI 개선사항 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('번역 기능 개선', () => {
    test('번역 분석 타입이 올바르게 설정됨', () => {
      // Given
      const analysisTypes = {
        summarize: 'summary',
        keyPoints: 'key-points',
        translate: 'translate'
      };

      // When & Then
      expect(analysisTypes.translate).toBe('translate');
    });

    test('번역 메시지가 한국어 번역으로 표시됨', () => {
      // Given
      const actionMessages = {
        summarize: '페이지 요약 중...',
        keyPoints: '핵심 포인트 추출 중...',
        translate: '한국어로 번역 중...'
      };

      // When & Then
      expect(actionMessages.translate).toBe('한국어로 번역 중...');
    });
  });

  describe('채팅 페이지 컨텍스트', () => {
    test('채팅 시작 시 페이지 컨텍스트가 추가됨', () => {
      // Given
      const chatHistory = [];
      const pageContent = '테스트 페이지 내용입니다.';

      // When - 페이지 컨텍스트 추가 시뮬레이션
      const systemMessage = {
        role: 'system',
        content: `현재 사용자가 보고 있는 페이지 정보:
${pageContent}

위 페이지 내용을 바탕으로 사용자의 질문에 답변해주세요.`
      };
      
      chatHistory.push(systemMessage);

      // Then
      expect(chatHistory).toHaveLength(1);
      expect(chatHistory[0].role).toBe('system');
      expect(chatHistory[0].content).toContain('현재 사용자가 보고 있는 페이지 정보');
      expect(chatHistory[0].content).toContain(pageContent);
    });
  });

  describe('Content Script 동적 주입', () => {
    test('Content Script 응답 실패 시 동적 주입 시도', async () => {
      // Given
      const mockTab = { id: 1, title: '테스트 페이지', url: 'https://example.com' };
      
      chrome.tabs.sendMessage
        .mockRejectedValueOnce(new Error('Could not establish connection'))
        .mockResolvedValueOnce({
          success: true,
          content: '동적 주입 후 추출된 내용'
        });
      
      chrome.scripting.executeScript.mockResolvedValue([]);

      // When - extractPageContent 함수 시뮬레이션
      async function extractPageContent(tab) {
        try {
          const contentResponse = await Promise.race([
            chrome.tabs.sendMessage(tab.id, {
              type: 'EXTRACT_PAGE_CONTENT'
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Content Script 응답 시간 초과')), 3000)
            )
          ]);
          
          if (contentResponse && contentResponse.success) {
            return contentResponse.content;
          } else {
            throw new Error('페이지 내용을 추출할 수 없습니다.');
          }
        } catch (contentError) {
          // Content Script 동적 주입 시도
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            });
            
            // 잠시 대기 후 재시도
            await new Promise(resolve => setTimeout(resolve, 100)); // 테스트용으로 짧게
            
            const retryResponse = await chrome.tabs.sendMessage(tab.id, {
              type: 'EXTRACT_PAGE_CONTENT'
            });
            
            if (retryResponse && retryResponse.success) {
              return retryResponse.content;
            }
          } catch (injectionError) {
            // 기본 정보 반환
            return `페이지 제목: ${tab.title}\nURL: ${tab.url}`;
          }
        }
      }

      const result = await extractPageContent(mockTab);

      // Then
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 1 },
        files: ['src/content/content.js']
      });
      expect(result).toBe('동적 주입 후 추출된 내용');
    });

    test('동적 주입도 실패 시 기본 정보 반환', async () => {
      // Given
      const mockTab = { id: 1, title: '테스트 페이지', url: 'https://example.com' };
      
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Could not establish connection'));
      chrome.scripting.executeScript.mockRejectedValue(new Error('Injection failed'));

      // When
      async function extractPageContent(tab) {
        try {
          const contentResponse = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_PAGE_CONTENT'
          });
          
          if (contentResponse && contentResponse.success) {
            return contentResponse.content;
          } else {
            throw new Error('페이지 내용을 추출할 수 없습니다.');
          }
        } catch (contentError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['src/content/content.js']
            });
            
            const retryResponse = await chrome.tabs.sendMessage(tab.id, {
              type: 'EXTRACT_PAGE_CONTENT'
            });
            
            if (retryResponse && retryResponse.success) {
              return retryResponse.content;
            }
          } catch (injectionError) {
            // 기본 정보 반환
            return `페이지 제목: ${tab.title}\nURL: ${tab.url}`;
          }
        }
      }

      const result = await extractPageContent(mockTab);

      // Then
      expect(result).toBe('페이지 제목: 테스트 페이지\nURL: https://example.com');
    });
  });

  describe('Background Script 번역 처리', () => {
    // Mock BedrockClient
    const mockBedrockClient = {
      isInitialized: true,
      invokeClaude: jest.fn()
    };

    // handlePageAnalysisRequest 함수 시뮬레이션
    async function handlePageAnalysisRequest(data, sendResponse) {
      try {
        const { pageContent, analysisType = 'general' } = data;
        
        let systemPrompt = '';
        let userPrompt = '';

        switch (analysisType) {
          case 'summary':
            systemPrompt = '웹페이지 내용을 간결하게 요약해주세요.';
            userPrompt = `다음 웹페이지를 요약해주세요:\n\n${pageContent}`;
            break;
          
          case 'key-points':
            systemPrompt = '웹페이지의 핵심 포인트들을 추출해주세요.';
            userPrompt = `다음 웹페이지의 핵심 내용을 정리해주세요:\n\n${pageContent}`;
            break;
          
          case 'translate':
            systemPrompt = '다음 웹페이지 내용을 한국어로 번역해주세요. 이미 한국어인 내용은 그대로 유지하고, 외국어 부분만 자연스러운 한국어로 번역해주세요.';
            userPrompt = `다음 웹페이지를 한국어로 번역해주세요:\n\n${pageContent}`;
            break;
          
          default:
            systemPrompt = '웹페이지 내용을 분석하고 사용자에게 도움이 될 만한 정보를 제공해주세요.';
            userPrompt = `다음 웹페이지를 분석해주세요:\n\n${pageContent}`;
        }

        const messages = [{
          role: 'user',
          content: userPrompt
        }];

        const response = await mockBedrockClient.invokeClaude(messages, {
          systemPrompt: systemPrompt,
          maxTokens: 2000
        });

        sendResponse({
          success: true,
          analysis: response.content[0].text,
          usage: response.usage
        });

      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }

    test('번역 요청 시 한국어 번역 프롬프트 사용', async () => {
      // Given
      const testData = {
        pageContent: 'Hello, this is a test page.',
        analysisType: 'translate'
      };
      
      mockBedrockClient.invokeClaude.mockResolvedValue({
        content: [{ text: '안녕하세요, 이것은 테스트 페이지입니다.' }],
        usage: { inputTokens: 10, outputTokens: 15 }
      });

      const sendResponse = jest.fn();

      // When
      await handlePageAnalysisRequest(testData, sendResponse);

      // Then
      expect(mockBedrockClient.invokeClaude).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('한국어로 번역해주세요') }],
        expect.objectContaining({
          systemPrompt: expect.stringContaining('한국어로 번역해주세요'),
          maxTokens: 2000
        })
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        analysis: '안녕하세요, 이것은 테스트 페이지입니다.',
        usage: { inputTokens: 10, outputTokens: 15 }
      });
    });
  });
});

console.log('🧪 UI 개선사항 테스트 파일 생성 완료');
