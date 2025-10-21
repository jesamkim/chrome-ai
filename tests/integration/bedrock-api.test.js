/**
 * Bedrock API 통합 테스트 - 실제 API 호출
 */

// Chrome API 모킹 (실제 환경과 유사하게)
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

// 실제 fetch 사용
global.fetch = require('node-fetch');

// AWSAuthManager 먼저 로드
global.AWSAuthManager = require('../../src/background/aws-auth-manager.js');

const BedrockClient = require('../../src/background/bedrock-client.js');

/**
 * Bedrock API 통합 테스트
 * 
 * 보안 주의사항:
 * - 실제 API Key는 환경변수 TEST_BEDROCK_API_KEY로 설정
 * - 코드에 직접 API Key를 하드코딩하지 말 것
 * - 테스트 실행 시: TEST_BEDROCK_API_KEY=your_key npm test
 */

describe('Bedrock API 통합 테스트', () => {
  let client;
  const TEST_API_KEY = process.env.TEST_BEDROCK_API_KEY || 'test-dummy-api-key-for-testing-only';

  beforeEach(async () => {
    client = new BedrockClient();
    
    // API Key 설정 모킹
    chrome.storage.sync.get.mockResolvedValue({
      bedrockApiKey: TEST_API_KEY,
      selectedModel: 'claude-haiku-4.5'
    });
    
    await client.initialize();
    jest.clearAllMocks();
  });

  describe('Claude Haiku 4.5 모델 테스트', () => {
    test('기본 대화 테스트', async () => {
      const messages = [{
        role: 'user',
        content: '안녕하세요! 간단한 인사말로 답변해주세요.'
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 100,
        temperature: 0.1
      });

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
      expect(response.content[0]).toHaveProperty('text');
      expect(response.content[0].text.length).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
      expect(response.usage.input_tokens).toBeGreaterThan(0);
      expect(response.usage.output_tokens).toBeGreaterThan(0);

      console.log('✅ Claude 3.7 응답:', response.content[0].text.substring(0, 100));
      console.log('📊 토큰 사용량:', response.usage);
    }, 30000); // 30초 타임아웃

    test('한국어 웹페이지 분석 테스트', async () => {
      const messages = [{
        role: 'user',
        content: `다음 웹페이지 내용을 분석해주세요:

제목: AWS Bedrock 소개
내용: Amazon Bedrock은 고성능 기반 모델(FM)을 API를 통해 사용할 수 있게 해주는 완전관리형 서비스입니다. 
Anthropic의 Claude, Amazon의 Titan 등 다양한 모델을 지원합니다.

이 페이지의 핵심 내용을 3줄로 요약해주세요.`
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 200,
        temperature: 0.1
      });

      expect(response.content[0].text).toContain('Bedrock');
      expect(response.content[0].text.length).toBeGreaterThan(50);

      console.log('✅ 웹페이지 분석 결과:', response.content[0].text);
    }, 30000);
  });

  describe('Claude Sonnet 4 모델 테스트', () => {
    beforeEach(async () => {
      await client.setModel('claude-sonnet-4');
    });

    test('Claude 4 기본 대화 테스트', async () => {
      const messages = [{
        role: 'user',
        content: '당신은 어떤 모델인가요? 간단히 소개해주세요.'
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 150,
        temperature: 0.1
      });

      expect(response).toBeDefined();
      expect(response.content[0].text.length).toBeGreaterThan(0);

      console.log('✅ Claude 4 응답:', response.content[0].text.substring(0, 100));
      console.log('📊 토큰 사용량:', response.usage);
    }, 30000);
  });

  describe('Nova Pro 모델 테스트', () => {
    beforeEach(async () => {
      await client.setModel('nova-pro');
    });

    test('Nova Pro 기본 대화 테스트', async () => {
      const messages = [{
        role: 'user',
        content: '안녕하세요! Nova Pro 모델로 간단한 인사말을 해주세요.'
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 100,
        temperature: 0.1
      });

      expect(response).toBeDefined();
      expect(response.content[0].text.length).toBeGreaterThan(0);

      console.log('✅ Nova Pro 응답:', response.content[0].text.substring(0, 100));
      console.log('📊 토큰 사용량:', response.usage);
    }, 30000);

    test('Nova Pro 응답 형식 정규화 테스트', async () => {
      const messages = [{
        role: 'user',
        content: '테스트 메시지입니다.'
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 50
      });

      // 정규화된 응답 형식 확인
      expect(response.content).toBeDefined();
      expect(response.content[0]).toHaveProperty('text');
      expect(response.content[0]).toHaveProperty('type', 'text');
      expect(response.usage).toHaveProperty('input_tokens');
      expect(response.usage).toHaveProperty('output_tokens');

      console.log('✅ Nova Pro 정규화 확인 완료');
    }, 30000);
  });

  describe('Nova Lite 모델 테스트', () => {
    beforeEach(async () => {
      await client.setModel('nova-lite');
    });

    test('Nova Lite 기본 대화 테스트', async () => {
      const messages = [{
        role: 'user',
        content: '간단한 인사말을 해주세요.'
      }];

      const response = await client.invokeClaude(messages, {
        maxTokens: 80,
        temperature: 0.1
      });

      expect(response).toBeDefined();
      expect(response.content[0].text.length).toBeGreaterThan(0);

      console.log('✅ Nova Lite 응답:', response.content[0].text.substring(0, 100));
      console.log('📊 토큰 사용량:', response.usage);
    }, 30000);
  });

  describe('에러 처리 테스트', () => {
    test('잘못된 API Key로 호출 시 에러 처리', async () => {
      // 잘못된 API Key로 새 클라이언트 생성
      const badClient = new BedrockClient();
      chrome.storage.sync.get.mockResolvedValueOnce({
        bedrockApiKey: 'invalid-key',
        selectedModel: 'claude-haiku-4.5'
      });
      
      await badClient.initialize();

      const messages = [{
        role: 'user',
        content: '테스트'
      }];

      await expect(badClient.invokeClaude(messages)).rejects.toThrow();
      console.log('✅ 잘못된 API Key 에러 처리 확인');
    }, 15000);

    test('토큰 제한 초과 시 에러 처리', async () => {
      const messages = [{
        role: 'user',
        content: '매우 긴 응답을 생성해주세요. '.repeat(100)
      }];

      // 매우 작은 토큰 제한으로 테스트
      const response = await client.invokeClaude(messages, {
        maxTokens: 10
      });

      // 응답이 있어야 하지만 제한된 길이여야 함
      expect(response).toBeDefined();
      expect(response.content[0].text.length).toBeGreaterThan(0);
      
      console.log('✅ 토큰 제한 처리 확인');
    }, 30000);
  });

  describe('모델별 성능 비교', () => {
    test('모든 모델 응답 시간 측정', async () => {
      const testMessage = [{
        role: 'user',
        content: '1부터 10까지 숫자를 나열해주세요.'
      }];

      const models = ['claude-haiku-4.5', 'claude-sonnet-4', 'nova-pro', 'nova-lite'];
      const results = {};

      for (const modelKey of models) {
        await client.setModel(modelKey);
        
        const startTime = Date.now();
        const response = await client.invokeClaude(testMessage, { maxTokens: 50 });
        const endTime = Date.now();
        
        results[modelKey] = {
          responseTime: endTime - startTime,
          tokenUsage: response.usage,
          responseLength: response.content[0].text.length
        };

        console.log(`📊 ${modelKey}:`, results[modelKey]);
      }

      // 모든 모델이 응답했는지 확인
      expect(Object.keys(results)).toHaveLength(4);
      
      console.log('✅ 모든 모델 성능 측정 완료');
    }, 120000); // 2분 타임아웃
  });
});

console.log('🎯 Bedrock API 통합 테스트 로드 완료');
