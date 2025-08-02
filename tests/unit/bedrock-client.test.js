/**
 * Bedrock 클라이언트 단위 테스트
 */

// Chrome API 모킹
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Fetch API 모킹
global.fetch = jest.fn();

// BedrockClient 클래스 로드
const BedrockClient = require('../../src/background/bedrock-client.js');

describe('BedrockClient', () => {
  let client;

  beforeEach(() => {
    client = new BedrockClient();
    jest.clearAllMocks();
  });

  describe('생성자', () => {
    test('기본 설정이 올바르게 초기화되어야 함', () => {
      expect(client.region).toBe('us-west-2');
      expect(client.currentModel).toBe('claude-3.7-sonnet');
      expect(client.isInitialized).toBe(false);
      expect(client.baseUrl).toBe('https://bedrock-runtime.us-west-2.amazonaws.com');
    });

    test('지원 모델이 올바르게 정의되어야 함', () => {
      const models = client.getSupportedModels();
      expect(models).toHaveLength(4);
      
      const modelKeys = models.map(m => m.key);
      expect(modelKeys).toContain('claude-3.7-sonnet');
      expect(modelKeys).toContain('claude-4-sonnet');
      expect(modelKeys).toContain('nova-pro');
      expect(modelKeys).toContain('nova-lite');
    });
  });

  describe('getSupportedModels', () => {
    test('지원 모델 목록을 올바른 형식으로 반환해야 함', () => {
      const models = client.getSupportedModels();
      
      models.forEach(model => {
        expect(model).toHaveProperty('key');
        expect(model).toHaveProperty('id');
        expect(model).toHaveProperty('name');
        expect(model).toHaveProperty('provider');
        expect(model).toHaveProperty('maxTokens');
        expect(model).toHaveProperty('description');
      });
    });

    test('Claude 3.7 Sonnet이 기본 모델로 포함되어야 함', () => {
      const models = client.getSupportedModels();
      const claude37 = models.find(m => m.key === 'claude-3.7-sonnet');
      
      expect(claude37).toBeDefined();
      expect(claude37.name).toBe('Claude 3.7 Sonnet');
      expect(claude37.provider).toBe('anthropic');
      expect(claude37.id).toBe('us.anthropic.claude-3-7-sonnet-20250219-v1:0');
    });
  });

  describe('getCurrentModel', () => {
    test('현재 선택된 모델 정보를 반환해야 함', () => {
      const currentModel = client.getCurrentModel();
      
      expect(currentModel.key).toBe('claude-3.7-sonnet');
      expect(currentModel.name).toBe('Claude 3.7 Sonnet');
      expect(currentModel.provider).toBe('anthropic');
    });
  });

  describe('setModel', () => {
    test('유효한 모델로 변경할 수 있어야 함', async () => {
      chrome.storage.sync.set.mockResolvedValue();
      
      await client.setModel('claude-4-sonnet');
      
      expect(client.currentModel).toBe('claude-4-sonnet');
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        selectedModel: 'claude-4-sonnet'
      });
    });

    test('지원하지 않는 모델로 변경 시 에러를 발생시켜야 함', async () => {
      await expect(client.setModel('invalid-model')).rejects.toThrow(
        '지원하지 않는 모델입니다: invalid-model'
      );
    });
  });

  describe('initialize', () => {
    test('API Key가 있을 때 성공적으로 초기화되어야 함', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key',
        selectedModel: 'claude-3.7-sonnet'
      });

      const result = await client.initialize();

      expect(result).toBe(true);
      expect(client.isInitialized).toBe(true);
      expect(client.apiKey).toBe('test-api-key');
      expect(client.currentModel).toBe('claude-3.7-sonnet');
    });

    test('API Key가 없을 때 에러를 발생시켜야 함', async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      await expect(client.initialize()).rejects.toThrow(
        'Bedrock API Key가 설정되지 않았습니다'
      );
    });

    test('지원하지 않는 모델이 설정되어 있을 때 기본 모델로 변경해야 함', async () => {
      chrome.storage.sync.get.mockResolvedValue({
        bedrockApiKey: 'test-api-key',
        selectedModel: 'invalid-model'
      });
      chrome.storage.sync.set.mockResolvedValue();

      await client.initialize();

      expect(client.currentModel).toBe('claude-3.7-sonnet');
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        selectedModel: 'claude-3.7-sonnet'
      });
    });
  });

  describe('checkInitialization', () => {
    test('초기화되지 않은 상태에서 에러를 발생시켜야 함', () => {
      expect(() => client.checkInitialization()).toThrow(
        'Bedrock 클라이언트가 초기화되지 않았습니다'
      );
    });

    test('초기화된 상태에서는 에러를 발생시키지 않아야 함', () => {
      client.isInitialized = true;
      client.apiKey = 'test-key';

      expect(() => client.checkInitialization()).not.toThrow();
    });
  });

  describe('normalizeResponse', () => {
    test('Anthropic 응답은 그대로 반환해야 함', () => {
      const anthropicResponse = {
        content: [{ text: 'test response', type: 'text' }],
        usage: { input_tokens: 10, output_tokens: 20 }
      };

      const result = client.normalizeResponse(anthropicResponse, 'anthropic');
      expect(result).toEqual(anthropicResponse);
    });

    test('Amazon 응답을 Claude 형식으로 변환해야 함', () => {
      const amazonResponse = {
        output: {
          message: {
            content: [{ text: 'nova response' }]
          }
        },
        usage: {
          inputTokens: 15,
          outputTokens: 25
        },
        stopReason: 'end_turn'
      };

      const result = client.normalizeResponse(amazonResponse, 'amazon');
      
      expect(result).toEqual({
        content: [{ text: 'nova response', type: 'text' }],
        usage: { input_tokens: 15, output_tokens: 25 },
        stop_reason: 'end_turn'
      });
    });
  });

  describe('getDefaultSystemPrompt', () => {
    test('기본 시스템 프롬프트를 반환해야 함', () => {
      const prompt = client.getDefaultSystemPrompt();
      
      expect(prompt).toContain('웹페이지 분석 전문 AI 어시스턴트');
      expect(prompt).toContain('한국어로 자연스럽고 도움이 되는 응답');
    });

    test('Claude 4 모델일 때 특화 지침이 포함되어야 함', async () => {
      await client.setModel('claude-4-sonnet');
      const prompt = client.getDefaultSystemPrompt();
      
      expect(prompt).toContain('Claude 4 Sonnet');
      expect(prompt).toContain('최신 기능과 향상된 추론 능력');
    });

    test('Nova 모델일 때 특화 지침이 포함되어야 함', async () => {
      await client.setModel('nova-pro');
      const prompt = client.getDefaultSystemPrompt();
      
      expect(prompt).toContain('Amazon Nova Pro');
      expect(prompt).toContain('간결하고 효율적인 응답');
    });
  });
});

console.log('🎯 Bedrock 클라이언트 테스트 로드 완료');
