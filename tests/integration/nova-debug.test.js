/**
 * Nova 모델 응답 구조 디버깅 테스트
 */

// Chrome API 모킹
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue()
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  }
};

global.fetch = require('node-fetch');

// AWSAuthManager 먼저 로드
global.AWSAuthManager = require('../../src/background/aws-auth-manager.js');

const BedrockClient = require('../../src/background/bedrock-client.js');

describe('Nova 응답 구조 디버깅', () => {
  let client;
  const TEST_API_KEY = 'ABSKamVzYW0yKzEtYXQtNjU4NDkyNTcwODMxOjArSzVZZTB4bU44S3J1akViUzVDUmVFYmJzQXVEbWRnd3lMT2M3NjNPWEltOGVORGxjMW55NXo4MFhnPQ==';

  beforeEach(async () => {
    client = new BedrockClient();
    
    chrome.storage.sync.get.mockResolvedValue({
      bedrockApiKey: TEST_API_KEY,
      selectedModel: 'nova-pro'
    });
    
    await client.initialize();
  });

  test('Nova Pro 원시 응답 구조 확인', async () => {
    const messages = [{
      role: 'user',
      content: '안녕하세요!'
    }];

    // 원시 응답을 확인하기 위해 normalizeResponse 전에 로깅
    const originalNormalize = client.normalizeResponse;
    client.normalizeResponse = function(data, provider) {
      console.log('🔍 원시 응답 데이터:', JSON.stringify(data, null, 2));
      console.log('🔍 Provider:', provider);
      
      // 응답 구조 분석
      if (data.output) {
        console.log('📄 output 구조:', JSON.stringify(data.output, null, 2));
      }
      if (data.message) {
        console.log('📄 message 구조:', JSON.stringify(data.message, null, 2));
      }
      if (data.content) {
        console.log('📄 content 구조:', JSON.stringify(data.content, null, 2));
      }
      
      return originalNormalize.call(this, data, provider);
    };

    try {
      const response = await client.invokeClaude(messages, {
        maxTokens: 50,
        temperature: 0.1
      });

      console.log('✅ 정규화된 응답:', JSON.stringify(response, null, 2));
      
    } catch (error) {
      console.error('❌ 테스트 실패:', error.message);
      throw error;
    }
  }, 30000);
});

console.log('🎯 Nova 디버깅 테스트 로드 완료');
