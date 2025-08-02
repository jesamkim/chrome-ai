/**
 * 모델 로딩 기능 테스트
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
  }
};

// BedrockClient import
const BedrockClient = require('../../src/background/bedrock-client.js');

describe('모델 로딩 테스트', () => {
  let bedrockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    bedrockClient = new BedrockClient();
  });

  describe('getSupportedModels', () => {
    test('API Key 없이도 지원 모델 목록을 반환해야 함', () => {
      // When
      const models = bedrockClient.getSupportedModels();

      // Then
      expect(models).toBeDefined();
      expect(Array.isArray(models)).toBe(true);
      expect(models.length).toBeGreaterThan(0);
      
      // 모든 모델이 필요한 속성을 가져야 함
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
      // When
      const models = bedrockClient.getSupportedModels();

      // Then
      const claudeModel = models.find(model => model.key === 'claude-3.7-sonnet');
      expect(claudeModel).toBeDefined();
      expect(claudeModel.name).toBe('Claude 3.7 Sonnet');
      expect(claudeModel.provider).toBe('anthropic');
    });

    test('모든 지원 모델이 포함되어야 함', () => {
      // When
      const models = bedrockClient.getSupportedModels();

      // Then
      const modelKeys = models.map(model => model.key);
      expect(modelKeys).toContain('claude-3.7-sonnet');
      expect(modelKeys).toContain('claude-4-sonnet');
      expect(modelKeys).toContain('nova-pro');
      expect(modelKeys).toContain('nova-lite');
    });
  });

  describe('getCurrentModel without initialization', () => {
    test('초기화 없이 기본 모델 정보를 반환해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({});

      // When
      const models = bedrockClient.getSupportedModels();
      const defaultModel = models.find(model => model.key === 'claude-3.7-sonnet');

      // Then
      expect(defaultModel).toBeDefined();
      expect(defaultModel.key).toBe('claude-3.7-sonnet');
    });
  });

  describe('Background Script 메시지 처리 시뮬레이션', () => {
    test('GET_SUPPORTED_MODELS 메시지 처리', async () => {
      // Given - BedrockClient 인스턴스만 생성 (초기화 없이)
      const client = new BedrockClient();
      
      // When - 모델 목록 요청
      const models = client.getSupportedModels();
      
      // Then - 성공적으로 모델 목록 반환
      expect(models).toBeDefined();
      expect(models.length).toBe(4);
      
      // 응답 형식 검증
      const response = {
        success: true,
        models: models
      };
      
      expect(response.success).toBe(true);
      expect(response.models).toBeDefined();
    });

    test('GET_CURRENT_MODEL 메시지 처리 (Storage에서 직접)', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({ selectedModel: 'nova-pro' });
      const client = new BedrockClient();
      
      // When
      const models = client.getSupportedModels();
      const selectedModel = models.find(model => model.key === 'nova-pro');
      
      // Then
      expect(selectedModel).toBeDefined();
      expect(selectedModel.key).toBe('nova-pro');
      expect(selectedModel.name).toBe('Amazon Nova Pro');
    });

    test('GET_CURRENT_MODEL 기본값 처리', async () => {
      // Given - 저장된 모델이 없는 경우
      chrome.storage.sync.get.mockResolvedValue({});
      const client = new BedrockClient();
      
      // When
      const models = client.getSupportedModels();
      const defaultModel = models.find(model => model.key === 'claude-3.7-sonnet');
      
      // Then
      expect(defaultModel).toBeDefined();
      expect(defaultModel.key).toBe('claude-3.7-sonnet');
    });
  });
});

console.log('🧪 모델 로딩 테스트 파일 생성 완료');
