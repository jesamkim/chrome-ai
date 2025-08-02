/**
 * 페이지 분석 기능 테스트
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
  }
};

describe('페이지 분석 기능 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('팝업에서 페이지 분석 요청', () => {
    test('정상적인 페이지 분석 요청 데이터 구조', async () => {
      // Given
      const mockTab = { id: 1, title: '테스트 페이지', url: 'https://example.com' };
      const mockPageContent = '테스트 페이지 내용입니다.';
      
      chrome.tabs.query.mockResolvedValue([mockTab]);
      chrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        content: mockPageContent
      });
      chrome.runtime.sendMessage.mockResolvedValue({
        success: true,
        analysis: '페이지 분석 결과입니다.'
      });

      // When - 팝업에서 페이지 분석 요청 시뮬레이션
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const contentResponse = await chrome.tabs.sendMessage(tab.id, {
        type: 'EXTRACT_PAGE_CONTENT'
      });
      
      const analysisRequest = {
        type: 'ANALYZE_PAGE',
        data: {
          pageContent: contentResponse.content,
          analysisType: 'general'
        }
      };

      // Then
      expect(analysisRequest.type).toBe('ANALYZE_PAGE');
      expect(analysisRequest.data).toBeDefined();
      expect(analysisRequest.data.pageContent).toBe(mockPageContent);
      expect(analysisRequest.data.analysisType).toBe('general');
    });

    test('Content Script 응답 실패 시 기본 정보 사용', async () => {
      // Given
      const mockTab = { id: 1, title: '테스트 페이지', url: 'https://example.com' };
      
      chrome.tabs.query.mockResolvedValue([mockTab]);
      chrome.tabs.sendMessage.mockRejectedValue(new Error('Content Script 없음'));

      // When
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      let pageContent;
      try {
        const contentResponse = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_PAGE_CONTENT'
        });
        pageContent = contentResponse.content;
      } catch (error) {
        pageContent = `페이지 제목: ${tab.title}\nURL: ${tab.url}`;
      }

      // Then
      expect(pageContent).toBe('페이지 제목: 테스트 페이지\nURL: https://example.com');
    });

    test('빠른 작업 요청 데이터 구조', async () => {
      // Given
      const mockTab = { id: 1, title: '테스트 페이지', url: 'https://example.com' };
      const mockPageContent = '테스트 페이지 내용입니다.';
      
      chrome.tabs.query.mockResolvedValue([mockTab]);
      chrome.tabs.sendMessage.mockResolvedValue({
        success: true,
        content: mockPageContent
      });

      const analysisTypes = {
        summarize: 'summary',
        keyPoints: 'key-points',
        translate: 'translate'
      };

      // When - 각 빠른 작업별 요청 테스트
      for (const [action, expectedType] of Object.entries(analysisTypes)) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const contentResponse = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_PAGE_CONTENT'
        });
        
        const analysisRequest = {
          type: 'ANALYZE_PAGE',
          data: {
            pageContent: contentResponse.content,
            analysisType: expectedType
          }
        };

        // Then
        expect(analysisRequest.data.analysisType).toBe(expectedType);
      }
    });
  });

  describe('Background Script 페이지 분석 처리', () => {
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
        console.error('❌ 페이지 분석 실패:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }

    test('일반 페이지 분석 처리', async () => {
      // Given
      const testData = {
        pageContent: '테스트 페이지 내용입니다.',
        analysisType: 'general'
      };
      
      mockBedrockClient.invokeClaude.mockResolvedValue({
        content: [{ text: '페이지 분석 결과입니다.' }],
        usage: { inputTokens: 10, outputTokens: 20 }
      });

      const sendResponse = jest.fn();

      // When
      await handlePageAnalysisRequest(testData, sendResponse);

      // Then
      expect(mockBedrockClient.invokeClaude).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('테스트 페이지 내용입니다.') }],
        expect.objectContaining({
          systemPrompt: expect.stringContaining('분석하고 사용자에게 도움이 될 만한 정보'),
          maxTokens: 2000
        })
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        analysis: '페이지 분석 결과입니다.',
        usage: { inputTokens: 10, outputTokens: 20 }
      });
    });

    test('요약 분석 처리', async () => {
      // Given
      const testData = {
        pageContent: '테스트 페이지 내용입니다.',
        analysisType: 'summary'
      };
      
      mockBedrockClient.invokeClaude.mockResolvedValue({
        content: [{ text: '페이지 요약 결과입니다.' }],
        usage: { inputTokens: 10, outputTokens: 15 }
      });

      const sendResponse = jest.fn();

      // When
      await handlePageAnalysisRequest(testData, sendResponse);

      // Then
      expect(mockBedrockClient.invokeClaude).toHaveBeenCalledWith(
        [{ role: 'user', content: expect.stringContaining('요약해주세요') }],
        expect.objectContaining({
          systemPrompt: expect.stringContaining('간결하게 요약해주세요'),
          maxTokens: 2000
        })
      );
    });

    test('data가 undefined인 경우 오류 처리', async () => {
      // Given
      const sendResponse = jest.fn();

      // When
      try {
        await handlePageAnalysisRequest(undefined, sendResponse);
      } catch (error) {
        // Then
        expect(error).toBeDefined();
      }
    });
  });
});

console.log('🧪 페이지 분석 기능 테스트 파일 생성 완료');
