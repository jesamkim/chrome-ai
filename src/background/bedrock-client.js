/**
 * AWS Bedrock Multi-Model API 클라이언트
 * AWS CLI 인증 우선, API Key 폴백 지원
 * 지원 모델: Claude 3.7 Sonnet (기본), Claude 4 Sonnet
 */

// AWSAuthManager import (Chrome Extension 환경에서는 전역으로 로드됨)
if (typeof AWSAuthManager === 'undefined' && typeof require !== 'undefined') {
  // Node.js 테스트 환경에서만 require 사용
  const AWSAuthManager = require('./aws-auth-manager.js');
}

class BedrockClient {
  constructor() {
    this.region = 'us-west-2'; // 기본 리전
    this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`;
    this.authManager = new AWSAuthManager();
    this.isInitialized = false;
    
    // 지원 모델 정의
    this.supportedModels = {
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
    
    // 기본 모델 설정
    this.currentModel = 'claude-3.7-sonnet';
  }

  /**
   * 클라이언트 초기화 - AWS 인증 우선순위에 따라 초기화
   */
  async initialize() {
    try {
      console.log('🔧 Bedrock 클라이언트 초기화 시작');
      
      // AWS 인증 관리자 초기화
      const authSuccess = await this.authManager.initialize();
      
      if (!authSuccess) {
        throw new Error('AWS 인증이 설정되지 않았습니다. AWS CLI 설정 또는 API Key를 입력해주세요.');
      }

      // 인증 정보 확인 및 리전 설정
      const authInfo = this.authManager.getAuthInfo();
      
      // 저장된 리전 설정이 있으면 사용, 없으면 기본값 유지
      if (authInfo.region) {
        this.region = authInfo.region;
        this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`;
      }
      
      console.log('✅ AWS 인증 완료:', {
        type: authInfo.authType,
        region: this.region
      });

      // 선택된 모델 로드
      const result = await chrome.storage.sync.get(['selectedModel']);
      this.currentModel = result.selectedModel || 'claude-3.7-sonnet';
      
      // 모델 유효성 검사
      if (!this.supportedModels[this.currentModel]) {
        console.warn(`⚠️ 지원하지 않는 모델: ${this.currentModel}, 기본 모델로 변경`);
        this.currentModel = 'claude-3.7-sonnet';
        await chrome.storage.sync.set({ selectedModel: this.currentModel });
      }

      this.isInitialized = true;
      
      console.log('✅ Bedrock 클라이언트 초기화 완료:', {
        authType: authInfo.authType,
        model: this.supportedModels[this.currentModel].name,
        modelId: this.supportedModels[this.currentModel].id
      });
      
      return true;
      
    } catch (error) {
      console.error('❌ Bedrock 클라이언트 초기화 실패:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Titan Embeddings를 사용하여 텍스트를 벡터로 변환
   */
  async generateEmbedding(text) {
    if (!this.isInitialized) {
      throw new Error('BedrockClient가 초기화되지 않았습니다.');
    }

    try {
      console.log('🔢 임베딩 생성 시작:', text.substring(0, 100) + '...');
      
      const requestBody = {
        inputText: text.substring(0, 8000) // Titan Embeddings 최대 입력 길이
      };

      // AWS 인증 헤더 가져오기
      const authHeaders = await this.authManager.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/model/amazon.titan-embed-text-v2:0/invoke`, {
        method: 'POST',
        headers: {
          ...authHeaders
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Titan Embeddings API 오류 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('임베딩 응답 형식이 올바르지 않습니다.');
      }

      console.log('✅ 임베딩 생성 완료:', {
        inputLength: text.length,
        embeddingDimensions: data.embedding.length
      });

      return {
        embedding: data.embedding, // 1536차원 벡터
        inputTokens: Math.ceil(text.length / 4), // 대략적인 토큰 수
        model: 'amazon.titan-embed-text-v2:0'
      };

    } catch (error) {
      console.error('❌ 임베딩 생성 실패:', error);
      throw error;
    }
  }

  /**
   * 배치로 여러 텍스트의 임베딩 생성
   */
  async generateBatchEmbeddings(texts, batchSize = 5) {
    const results = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      console.log(`🔢 배치 임베딩 생성: ${i + 1}-${Math.min(i + batchSize, texts.length)}/${texts.length}`);
      
      const batchPromises = batch.map(text => this.generateEmbedding(text));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // API 레이트 리밋 방지를 위한 지연
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        console.error(`❌ 배치 ${i}-${i + batchSize} 임베딩 실패:`, error);
        throw error;
      }
    }
    
    return results;
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

  /**
   * 현재 선택된 모델 정보 반환
   */
  getCurrentModel() {
    return {
      key: this.currentModel,
      ...this.supportedModels[this.currentModel]
    };
  }

  /**
   * 모델 변경
   */
  async setModel(modelKey) {
    if (!this.supportedModels[modelKey]) {
      throw new Error(`지원하지 않는 모델입니다: ${modelKey}`);
    }
    
    this.currentModel = modelKey;
    await chrome.storage.sync.set({ selectedModel: modelKey });
    
    console.log('✅ 모델 변경됨:', this.supportedModels[modelKey].name);
    return true;
  }
  checkInitialization() {
    if (!this.isInitialized) {
      throw new Error('Bedrock 클라이언트가 초기화되지 않았습니다. initialize()를 먼저 호출해주세요.');
    }
    
    if (!this.authManager || !this.authManager.isInitialized) {
      throw new Error('AWS 인증이 설정되지 않았습니다. AWS CLI 설정 또는 API Key를 입력해주세요.');
    }
  }

  /**
   * 선택된 모델 호출 (Claude 또는 Nova)
   * @param {Array} messages - 대화 메시지 배열
   * @param {Object} options - 호출 옵션
   * @returns {Promise<Object>} API 응답
   */
  async invokeClaude(messages, options = {}) {
    this.checkInitialization();

    const currentModelInfo = this.supportedModels[this.currentModel];
    const maxTokens = Math.min(options.maxTokens || 4000, currentModelInfo.maxTokens);

    let requestBody;
    let endpoint;
    
    // 모델 제공자에 따라 요청 형식 구분
    if (currentModelInfo.provider === 'anthropic') {
      // Claude 모델용 요청 형식 (기존 방식)
      requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: maxTokens,
        temperature: options.temperature || 0.1,
        messages: messages,
        system: options.systemPrompt || this.getDefaultSystemPrompt()
      };
      endpoint = `${this.baseUrl}/model/${currentModelInfo.id}/invoke`;
    } else if (currentModelInfo.provider === 'amazon') {
      // Nova 모델용 Converse API 요청 형식
      // 메시지를 올바른 ContentBlock 구조로 변환
      const converseMessages = messages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
      }));

      requestBody = {
        messages: converseMessages,
        inferenceConfig: {
          maxTokens: maxTokens,
          temperature: options.temperature || 0.1
        },
        system: [{
          text: options.systemPrompt || this.getDefaultSystemPrompt()
        }]
      };
      endpoint = `${this.baseUrl}/model/${currentModelInfo.id}/converse`;
    }

    try {
      console.log('🚀 Bedrock API 호출 시작:', {
        model: currentModelInfo.name,
        modelId: currentModelInfo.id,
        messageCount: messages.length,
        maxTokens: maxTokens,
        endpoint: endpoint.split('/').pop()
      });

      // AWS 인증 헤더 가져오기
      const authHeaders = await this.authManager.getAuthHeaders();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'X-Amzn-Bedrock-Accept': 'application/json',
          'X-Amzn-Bedrock-Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bedrock API 오류 (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      // 응답 형식 정규화 (Claude와 Nova 응답 형식 통일)
      const normalizedResponse = this.normalizeResponse(data, currentModelInfo.provider);
      
      console.log('✅ Bedrock API 호출 성공:', {
        model: currentModelInfo.name,
        responseLength: normalizedResponse.content?.[0]?.text?.length || 0,
        usage: normalizedResponse.usage
      });

      return normalizedResponse;
    } catch (error) {
      console.error('❌ Bedrock API 호출 실패:', error);
      throw this.handleBedrockError(error);
    }
  }

  /**
   * 응답 형식 정규화 (Claude와 Nova 응답 형식 통일)
   */
  normalizeResponse(data, provider) {
    if (provider === 'anthropic') {
      // Claude 응답은 이미 표준 형식
      return data;
    } else if (provider === 'amazon') {
      // Nova Converse API 응답을 Claude 형식으로 변환
      return {
        content: [{
          text: data.output?.message?.content?.[0]?.text || '',
          type: 'text'
        }],
        usage: {
          input_tokens: data.usage?.inputTokens || 0,
          output_tokens: data.usage?.outputTokens || 0
        },
        stop_reason: data.stopReason || 'end_turn'
      };
    }
    
    // 기본 형식
    return {
      content: [{ text: '', type: 'text' }],
      usage: { input_tokens: 0, output_tokens: 0 }
    };
  }
  async invokeClaudeStream(messages, options = {}) {
    // TODO: 스트리밍 구현
    throw new Error('스트리밍 기능은 아직 구현되지 않았습니다.');
  }

  /**
   * 기본 시스템 프롬프트 (모델별 최적화)
   */
  getDefaultSystemPrompt() {
    const currentModelInfo = this.supportedModels[this.currentModel];
    
    let basePrompt = `당신은 웹페이지 분석 전문 AI 어시스턴트입니다.

주요 역할:
1. 현재 웹페이지의 내용을 정확히 이해하고 분석
2. 사용자의 질문에 대해 페이지 컨텍스트를 바탕으로 정확한 답변 제공
3. 한국어로 자연스럽고 도움이 되는 응답 생성
4. 필요시 페이지의 특정 부분을 인용하여 설명

응답 원칙:
- 페이지 내용을 기반으로 한 정확한 정보 제공
- 한국어 사용자에게 친숙한 표현 사용
- 구체적이고 실용적인 답변 제공
- 불확실한 정보는 명확히 표시`;

    // 모델별 특화 지침 추가
    if (currentModelInfo.provider === 'amazon') {
      basePrompt += `\n\n현재 사용 중인 모델: ${currentModelInfo.name}
- 간결하고 효율적인 응답을 제공합니다
- 핵심 정보를 우선적으로 전달합니다`;
    } else if (this.currentModel === 'claude-4-sonnet') {
      basePrompt += `\n\n현재 사용 중인 모델: ${currentModelInfo.name}
- 최신 기능과 향상된 추론 능력을 활용합니다
- 복잡한 분석과 상세한 설명이 가능합니다`;
    }

    return basePrompt;
  }

  /**
   * Bedrock API 에러 처리
   */
  handleBedrockError(error) {
    if (error.message.includes('401')) {
      return new Error('API Key가 유효하지 않습니다. 설정을 확인해주세요.');
    } else if (error.message.includes('403')) {
      return new Error('API 접근 권한이 없습니다. IAM 권한을 확인해주세요.');
    } else if (error.message.includes('429')) {
      return new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    } else if (error.message.includes('500')) {
      return new Error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    return error;
  }

  /**
   * API Key 유효성 테스트
   */
  async testConnection() {
    this.checkInitialization();

    const testMessages = [{
      role: 'user',
      content: '안녕하세요. 연결 테스트입니다.'
    }];

    try {
      const response = await this.invokeClaude(testMessages, { maxTokens: 100 });
      return {
        success: true,
        message: '연결 테스트 성공',
        response: response.content?.[0]?.text || 'No response content'
      };
    } catch (error) {
      return {
        success: false,
        message: '연결 테스트 실패',
        error: error.message
      };
    }
  }
}

// Chrome Extension 환경에서 사용할 수 있도록 전역 객체로 등록
if (typeof globalThis !== 'undefined') {
  globalThis.BedrockClient = BedrockClient;
}

// Node.js 환경 (테스트용)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BedrockClient;
}
