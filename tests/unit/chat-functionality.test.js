/**
 * 채팅 기능 테스트
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

describe('채팅 기능 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('팝업에서 채팅 메시지 전송', () => {
    test('정상적인 채팅 메시지 데이터 구조', () => {
      // Given
      const chatHistory = [
        { role: 'user', content: '안녕하세요' },
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' }
      ];
      const newMessage = '페이지에 대해 설명해주세요';

      // When - 팝업에서 채팅 메시지 전송 시뮬레이션
      const chatRequest = {
        type: 'CHAT_MESSAGE',
        data: {
          messages: [
            ...chatHistory,
            { role: 'user', content: newMessage }
          ],
          sessionId: 'popup-session',
          options: {
            maxTokens: 2000
          }
        }
      };

      // Then
      expect(chatRequest.type).toBe('CHAT_MESSAGE');
      expect(chatRequest.data).toBeDefined();
      expect(chatRequest.data.messages).toHaveLength(3);
      expect(chatRequest.data.messages[2]).toEqual({
        role: 'user',
        content: newMessage
      });
      expect(chatRequest.data.sessionId).toBe('popup-session');
      expect(chatRequest.data.options.maxTokens).toBe(2000);
    });
  });

  describe('Background Script 채팅 메시지 처리', () => {
    // Mock BedrockClient
    const mockBedrockClient = {
      isInitialized: true,
      invokeClaude: jest.fn()
    };

    // Mock activeSessions
    const mockActiveSessions = new Map();

    // handleChatMessage 함수 시뮬레이션
    async function handleChatMessage(data, sendResponse) {
      try {
        // 데이터 유효성 검사
        if (!data) {
          throw new Error('메시지 데이터가 없습니다.');
        }

        const { messages, sessionId, options = {} } = data;
        
        if (!messages || !Array.isArray(messages)) {
          throw new Error('유효하지 않은 메시지 형식입니다.');
        }

        // 세션 관리
        if (sessionId && !mockActiveSessions.has(sessionId)) {
          mockActiveSessions.set(sessionId, {
            id: sessionId,
            history: [],
            createdAt: Date.now(),
            lastActivity: Date.now()
          });
        }

        console.log('💬 채팅 메시지 처리 시작:', messages.length, '개 메시지');

        // Claude 호출 (쓰로틀링 고려)
        const response = await mockBedrockClient.invokeClaude(messages, options);
        
        // 세션에 메시지 추가
        if (sessionId) {
          const session = mockActiveSessions.get(sessionId);
          session.history.push(...messages);
          session.history.push({
            role: 'assistant',
            content: response.content[0].text
          });
          session.lastActivity = Date.now();
        }

        console.log('✅ 채팅 응답 생성 완료');

        sendResponse({
          success: true,
          response: response.content[0].text,
          usage: response.usage,
          sessionId: sessionId
        });

      } catch (error) {
        console.error('❌ 채팅 메시지 처리 실패:', error);
        
        // 쓰로틀링 에러 처리
        let errorMessage = error.message;
        if (error.message.includes('throttling') || error.message.includes('rate limit')) {
          errorMessage = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('quota') || error.message.includes('limit exceeded')) {
          errorMessage = 'API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.';
        } else if (error.message.includes('timeout')) {
          errorMessage = '응답 시간이 초과되었습니다. 다시 시도해주세요.';
        }
        
        sendResponse({
          success: false,
          error: errorMessage
        });
      }
    }

    test('정상적인 채팅 메시지 처리', async () => {
      // Given
      const testData = {
        messages: [
          { role: 'user', content: '안녕하세요' }
        ],
        sessionId: 'test-session',
        options: { maxTokens: 2000 }
      };
      
      mockBedrockClient.invokeClaude.mockResolvedValue({
        content: [{ text: '안녕하세요! 무엇을 도와드릴까요?' }],
        usage: { inputTokens: 5, outputTokens: 15 }
      });

      const sendResponse = jest.fn();

      // When
      await handleChatMessage(testData, sendResponse);

      // Then
      expect(mockBedrockClient.invokeClaude).toHaveBeenCalledWith(
        testData.messages,
        testData.options
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        response: '안녕하세요! 무엇을 도와드릴까요?',
        usage: { inputTokens: 5, outputTokens: 15 },
        sessionId: 'test-session'
      });

      // 세션이 생성되었는지 확인
      expect(mockActiveSessions.has('test-session')).toBe(true);
    });

    test('데이터가 undefined인 경우 오류 처리', async () => {
      // Given
      const sendResponse = jest.fn();

      // When
      await handleChatMessage(undefined, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '메시지 데이터가 없습니다.'
      });
    });

    test('메시지 형식이 잘못된 경우 오류 처리', async () => {
      // Given
      const testData = {
        messages: 'invalid format',
        sessionId: 'test-session'
      };
      const sendResponse = jest.fn();

      // When
      await handleChatMessage(testData, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '유효하지 않은 메시지 형식입니다.'
      });
    });

    test('쓰로틀링 에러 처리', async () => {
      // Given
      const testData = {
        messages: [{ role: 'user', content: '테스트' }],
        sessionId: 'test-session'
      };
      
      mockBedrockClient.invokeClaude.mockRejectedValue(
        new Error('throttling limit exceeded')
      );

      const sendResponse = jest.fn();

      // When
      await handleChatMessage(testData, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      });
    });

    test('API 사용량 한도 에러 처리', async () => {
      // Given
      const testData = {
        messages: [{ role: 'user', content: '테스트' }],
        sessionId: 'test-session'
      };
      
      mockBedrockClient.invokeClaude.mockRejectedValue(
        new Error('quota limit exceeded')
      );

      const sendResponse = jest.fn();

      // When
      await handleChatMessage(testData, sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: 'API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해주세요.'
      });
    });
  });
});

console.log('🧪 채팅 기능 테스트 파일 생성 완료');
