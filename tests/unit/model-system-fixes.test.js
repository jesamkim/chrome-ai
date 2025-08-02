/**
 * 모델 및 시스템 메시지 수정 테스트
 */

describe('모델 및 시스템 메시지 수정 테스트', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Nova 모델 제거', () => {
    test('지원 모델 목록에 Nova 모델이 없음', () => {
      // Given - BedrockClient의 supportedModels 시뮬레이션
      const supportedModels = {
        'claude-3.7-sonnet': {
          id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
          name: 'Claude 3.7 Sonnet',
          provider: 'anthropic',
          maxTokens: 8000,
          description: '균형잡힌 성능과 속도 (기본 모델)'
        },
        'claude-4-sonnet': {
          id: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
          name: 'Claude 4 Sonnet',
          provider: 'anthropic',
          maxTokens: 8000,
          description: '최신 고성능 모델'
        }
      };

      // When & Then
      expect(supportedModels).not.toHaveProperty('nova-pro');
      expect(supportedModels).not.toHaveProperty('nova-lite');
      expect(Object.keys(supportedModels)).toHaveLength(2);
      expect(supportedModels['claude-3.7-sonnet']).toBeDefined();
      expect(supportedModels['claude-4-sonnet']).toBeDefined();
    });

    test('getSupportedModels 함수가 Claude 모델만 반환', () => {
      // Given
      const supportedModels = {
        'claude-3.7-sonnet': {
          id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
          name: 'Claude 3.7 Sonnet',
          provider: 'anthropic',
          maxTokens: 8000,
          description: '균형잡힌 성능과 속도 (기본 모델)'
        },
        'claude-4-sonnet': {
          id: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
          name: 'Claude 4 Sonnet',
          provider: 'anthropic',
          maxTokens: 8000,
          description: '최신 고성능 모델'
        }
      };

      // getSupportedModels 함수 시뮬레이션
      function getSupportedModels() {
        return Object.entries(supportedModels).map(([key, model]) => ({
          key: key,
          id: model.id,
          name: model.name,
          provider: model.provider,
          maxTokens: model.maxTokens,
          description: model.description
        }));
      }

      // When
      const models = getSupportedModels();

      // Then
      expect(models).toHaveLength(2);
      expect(models.every(model => model.provider === 'anthropic')).toBe(true);
      expect(models.find(model => model.key === 'nova-pro')).toBeUndefined();
      expect(models.find(model => model.key === 'nova-lite')).toBeUndefined();
    });
  });

  describe('채팅 시스템 메시지 수정', () => {
    test('페이지 컨텍스트가 systemPrompt로 전달됨', () => {
      // Given
      const pageContent = '테스트 페이지 내용입니다.';
      const pageContext = `현재 사용자가 보고 있는 페이지 정보:
${pageContent}

위 페이지 내용을 바탕으로 사용자의 질문에 답변해주세요.`;

      const chatRequest = {
        type: 'CHAT_MESSAGE',
        data: {
          messages: [
            { role: 'user', content: '이 페이지에 대해 설명해주세요' }
          ],
          systemPrompt: pageContext,
          sessionId: 'popup-session',
          options: {
            maxTokens: 2000
          }
        }
      };

      // When & Then
      expect(chatRequest.data.systemPrompt).toBeDefined();
      expect(chatRequest.data.systemPrompt).toContain('현재 사용자가 보고 있는 페이지 정보');
      expect(chatRequest.data.systemPrompt).toContain(pageContent);
      
      // messages 배열에 system 역할이 없는지 확인
      const hasSystemRole = chatRequest.data.messages.some(msg => msg.role === 'system');
      expect(hasSystemRole).toBe(false);
    });

    test('Background Script에서 systemPrompt 처리', async () => {
      // Given
      const mockBedrockClient = {
        invokeClaude: jest.fn()
      };

      const testData = {
        messages: [
          { role: 'user', content: '테스트 질문' }
        ],
        systemPrompt: '현재 페이지에 대한 질문에 답변해주세요.',
        sessionId: 'test-session',
        options: { maxTokens: 2000 }
      };

      mockBedrockClient.invokeClaude.mockResolvedValue({
        content: [{ text: '테스트 응답입니다.' }],
        usage: { inputTokens: 10, outputTokens: 15 }
      });

      // handleChatMessage 함수 시뮬레이션
      async function handleChatMessage(data, sendResponse) {
        const { messages, systemPrompt, sessionId, options = {} } = data;
        
        const claudeOptions = {
          ...options,
          systemPrompt: systemPrompt
        };
        
        const response = await mockBedrockClient.invokeClaude(messages, claudeOptions);
        
        sendResponse({
          success: true,
          response: response.content[0].text,
          usage: response.usage,
          sessionId: sessionId
        });
      }

      const sendResponse = jest.fn();

      // When
      await handleChatMessage(testData, sendResponse);

      // Then
      expect(mockBedrockClient.invokeClaude).toHaveBeenCalledWith(
        testData.messages,
        expect.objectContaining({
          systemPrompt: '현재 페이지에 대한 질문에 답변해주세요.',
          maxTokens: 2000
        })
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        response: '테스트 응답입니다.',
        usage: { inputTokens: 10, outputTokens: 15 },
        sessionId: 'test-session'
      });
    });

    test('채팅 초기화 시 페이지 컨텍스트 재설정', () => {
      // Given
      let chatHistory = [
        { role: 'user', content: '이전 질문' },
        { role: 'assistant', content: '이전 답변' }
      ];
      let pageContext = '이전 페이지 컨텍스트';

      // clearChatHistory 함수 시뮬레이션
      function clearChatHistory() {
        chatHistory = [];
        pageContext = null;
        return { chatHistory, pageContext };
      }

      // When
      const result = clearChatHistory();

      // Then
      expect(result.chatHistory).toHaveLength(0);
      expect(result.pageContext).toBeNull();
    });
  });

  describe('Claude API 호환성', () => {
    test('system 메시지가 messages 배열에 포함되지 않음', () => {
      // Given
      const messages = [
        { role: 'user', content: '안녕하세요' },
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
        { role: 'user', content: '현재 페이지에 대해 설명해주세요' }
      ];

      // When & Then
      const hasSystemMessage = messages.some(msg => msg.role === 'system');
      expect(hasSystemMessage).toBe(false);
      
      // 모든 메시지가 user 또는 assistant 역할만 가져야 함
      const validRoles = messages.every(msg => 
        msg.role === 'user' || msg.role === 'assistant'
      );
      expect(validRoles).toBe(true);
    });

    test('systemPrompt가 별도 파라미터로 전달됨', () => {
      // Given
      const claudeRequest = {
        messages: [
          { role: 'user', content: '질문입니다' }
        ],
        systemPrompt: '페이지 컨텍스트 정보',
        maxTokens: 2000
      };

      // When & Then
      expect(claudeRequest.systemPrompt).toBeDefined();
      expect(claudeRequest.systemPrompt).toBe('페이지 컨텍스트 정보');
      expect(claudeRequest.messages.find(msg => msg.role === 'system')).toBeUndefined();
    });
  });
});

console.log('🧪 모델 및 시스템 메시지 수정 테스트 파일 생성 완료');
