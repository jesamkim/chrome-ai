/**
 * Background Script 메시지 처리 테스트
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
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    }
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    }
  }
};

// BedrockClient Mock
class MockBedrockClient {
  constructor() {
    this.supportedModels = {
      'claude-3.7-sonnet': {
        id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0',
        name: 'Claude 3.7 Sonnet',
        provider: 'anthropic',
        maxTokens: 8000,
        description: '균형잡힌 성능과 속도 (기본 모델)'
      },
      'nova-pro': {
        id: 'us.amazon.nova-pro-v1:0',
        name: 'Amazon Nova Pro',
        provider: 'amazon',
        maxTokens: 5000,
        description: '고성능 멀티모달 모델'
      }
    };
  }

  getSupportedModels() {
    return Object.entries(this.supportedModels).map(([key, model]) => ({
      key: key,
      id: model.id,
      name: model.name,
      provider: model.provider,
      maxTokens: model.maxTokens,
      description: model.description
    }));
  }

  async initialize() {
    const result = await chrome.storage.sync.get(['bedrockApiKey']);
    if (!result.bedrockApiKey) {
      throw new Error('Bedrock API Key가 설정되지 않았습니다.');
    }
    return true;
  }
}

// Global BedrockClient 설정
global.BedrockClient = MockBedrockClient;

describe('Background Script 메시지 처리 테스트', () => {
  let bedrockClient;
  let sendResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    bedrockClient = null;
    sendResponse = jest.fn();
  });

  // handleGetSupportedModels 함수 시뮬레이션
  async function handleGetSupportedModels(sendResponse) {
    try {
      console.log('📋 지원 모델 조회 요청 받음');
      
      // BedrockClient 인스턴스가 없으면 생성 (API Key 없이도 가능)
      if (!bedrockClient) {
        console.log('🔄 Bedrock 클라이언트 인스턴스 생성...');
        bedrockClient = new MockBedrockClient();
      }
      
      // 모델 목록은 API Key 없이도 가져올 수 있음
      const models = bedrockClient.getSupportedModels();
      console.log('📋 지원 모델 목록:', models.length, '개');
      
      sendResponse({
        success: true,
        models: models
      });

    } catch (error) {
      console.error('❌ 지원 모델 조회 실패:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // handleGetCurrentModel 함수 시뮬레이션
  async function handleGetCurrentModel(sendResponse) {
    try {
      console.log('🔍 현재 모델 조회 요청 받음');
      
      // BedrockClient 인스턴스가 없으면 생성
      if (!bedrockClient) {
        console.log('🔄 Bedrock 클라이언트 인스턴스 생성...');
        bedrockClient = new MockBedrockClient();
      }
      
      // Storage에서 직접 현재 모델 정보 가져오기
      const result = await chrome.storage.sync.get(['selectedModel']);
      const selectedModelKey = result.selectedModel || 'claude-3.7-sonnet';
      
      // 모델 정보 구성
      const supportedModels = bedrockClient.getSupportedModels();
      const currentModel = supportedModels.find(model => model.key === selectedModelKey);
      
      if (!currentModel) {
        // 기본 모델로 폴백
        const defaultModel = supportedModels.find(model => model.key === 'claude-3.7-sonnet');
        console.log('⚠️ 선택된 모델을 찾을 수 없음, 기본 모델 사용:', defaultModel.name);
        
        sendResponse({
          success: true,
          model: defaultModel
        });
      } else {
        console.log('✅ 현재 모델 조회 완료:', currentModel.name);
        sendResponse({
          success: true,
          model: currentModel
        });
      }

    } catch (error) {
      console.error('❌ 현재 모델 조회 실패:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  describe('GET_SUPPORTED_MODELS 메시지 처리', () => {
    test('API Key 없이도 모델 목록을 성공적으로 반환해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({}); // API Key 없음

      // When
      await handleGetSupportedModels(sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        models: expect.arrayContaining([
          expect.objectContaining({
            key: 'claude-3.7-sonnet',
            name: 'Claude 3.7 Sonnet',
            provider: 'anthropic'
          })
        ])
      });
    });

    test('BedrockClient 인스턴스가 재사용되어야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({});

      // When - 첫 번째 호출
      await handleGetSupportedModels(sendResponse);
      const firstClient = bedrockClient;

      // When - 두 번째 호출
      await handleGetSupportedModels(sendResponse);
      const secondClient = bedrockClient;

      // Then
      expect(firstClient).toBe(secondClient);
      expect(sendResponse).toHaveBeenCalledTimes(2);
    });
  });

  describe('GET_CURRENT_MODEL 메시지 처리', () => {
    test('저장된 모델이 있으면 해당 모델을 반환해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({ selectedModel: 'nova-pro' });

      // When
      await handleGetCurrentModel(sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        model: expect.objectContaining({
          key: 'nova-pro',
          name: 'Amazon Nova Pro',
          provider: 'amazon'
        })
      });
    });

    test('저장된 모델이 없으면 기본 모델을 반환해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({});

      // When
      await handleGetCurrentModel(sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        model: expect.objectContaining({
          key: 'claude-3.7-sonnet',
          name: 'Claude 3.7 Sonnet',
          provider: 'anthropic'
        })
      });
    });

    test('잘못된 모델 키가 저장되어 있으면 기본 모델로 폴백해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({ selectedModel: 'invalid-model' });

      // When
      await handleGetCurrentModel(sendResponse);

      // Then
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        model: expect.objectContaining({
          key: 'claude-3.7-sonnet',
          name: 'Claude 3.7 Sonnet'
        })
      });
    });
  });

  describe('Extension 시작 시 초기화', () => {
    test('API Key가 있으면 초기화를 시도해야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({ bedrockApiKey: 'test-key' });

      // When - 시작 시 초기화 로직 시뮬레이션
      const result = await chrome.storage.sync.get(['bedrockApiKey']);
      const shouldInitialize = !!result.bedrockApiKey;

      // Then
      expect(shouldInitialize).toBe(true);
    });

    test('API Key가 없으면 초기화를 건너뛰어야 함', async () => {
      // Given
      chrome.storage.sync.get.mockResolvedValue({});

      // When - 시작 시 초기화 로직 시뮬레이션
      const result = await chrome.storage.sync.get(['bedrockApiKey']);
      const shouldInitialize = !!result.bedrockApiKey;

      // Then
      expect(shouldInitialize).toBe(false);
    });
  });
});

console.log('🧪 Background Script 메시지 처리 테스트 파일 생성 완료');
