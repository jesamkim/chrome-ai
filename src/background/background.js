/**
 * Chrome Extension Background Service Worker
 * Claude 3.7 Sonnet AI Assistant with Vector Store and AWS Auth Manager
 */

// AWS 인증 관리자, Bedrock 클라이언트 및 Vector Store import
importScripts('aws-auth-manager.js');
importScripts('bedrock-client.js');
importScripts('vector-store.js');

// 전역 변수
let bedrockClient = null;
let vectorStore = null;
let activeSessions = new Map();

/**
 * Extension 설치/업데이트 시 초기화
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('🚀 Claude AI Assistant 설치됨:', details.reason);
  
  // 기본 설정 초기화
  await initializeDefaultSettings();
  
  // 컨텍스트 메뉴 생성
  createContextMenus();
});

/**
 * Extension 시작 시 초기화 (API Key가 있는 경우에만)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Claude AI Assistant 시작됨');
  
  // API Key가 있는지 확인 후 초기화
  try {
    const result = await chrome.storage.sync.get(['bedrockApiKey']);
    if (result.bedrockApiKey) {
      console.log('🔑 API Key 발견, Bedrock 클라이언트 초기화 시도...');
      await initializeBedrockClient();
    } else {
      console.log('⚠️ API Key가 없음, 설정 페이지에서 API Key를 입력해주세요.');
    }
  } catch (error) {
    console.warn('⚠️ 시작 시 초기화 실패:', error.message);
  }
});

/**
 * 기본 설정 초기화
 */
async function initializeDefaultSettings() {
  const settings = await chrome.storage.sync.get([
    'bedrockApiKey',
    'maxTokens',
    'temperature',
    'autoAnalyze'
  ]);

  // 기본값 설정
  const defaultSettings = {
    maxTokens: settings.maxTokens || 4000,
    temperature: settings.temperature || 0.1,
    autoAnalyze: settings.autoAnalyze !== undefined ? settings.autoAnalyze : true
  };

  await chrome.storage.sync.set(defaultSettings);
  console.log('✅ 기본 설정 초기화 완료:', defaultSettings);
}

/**
 * Bedrock 클라이언트 초기화
 */
async function initializeBedrockClient() {
  try {
    bedrockClient = new BedrockClient();
    await bedrockClient.initialize();
    console.log('✅ Bedrock 클라이언트 초기화 성공');
    
    // Vector Store 초기화
    if (!vectorStore) {
      vectorStore = new VectorStore(bedrockClient);
      console.log('✅ Vector Store 초기화 완료');
      
      // 주기적 정리 작업 설정 (24시간마다)
      setInterval(() => {
        if (vectorStore) {
          vectorStore.cleanup();
        }
      }, 24 * 60 * 60 * 1000);
    }
    
    return true;
  } catch (error) {
    console.warn('⚠️ Bedrock 클라이언트 초기화 실패:', error.message);
    bedrockClient = null;
    vectorStore = null;
    return false;
  }
}

/**
 * 컨텍스트 메뉴 생성 (권한이 있는 경우에만)
 */
function createContextMenus() {
  if (chrome.contextMenus) {
    try {
      chrome.contextMenus.create({
        id: 'analyze-selection',
        title: 'Claude로 선택 텍스트 분석',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'analyze-page',
        title: 'Claude로 페이지 분석',
        contexts: ['page']
      });

      console.log('📋 컨텍스트 메뉴 생성 완료');
    } catch (error) {
      console.warn('⚠️ 컨텍스트 메뉴 생성 실패:', error.message);
    }
  } else {
    console.warn('⚠️ contextMenus API를 사용할 수 없습니다. manifest.json에 권한을 추가하세요.');
  }
}

/**
 * 컨텍스트 메뉴 클릭 처리 (권한이 있는 경우에만)
 */
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    switch (info.menuItemId) {
      case 'analyze-selection':
        await handleTextAnalysis(info.selectionText, tab);
        break;
      case 'analyze-page':
        await handlePageAnalysis(tab);
        break;
    }
  });
}

/**
 * 메시지 처리 (Popup, Content Script와 통신)
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 메시지 수신:', request.type);

  switch (request.type) {
    case 'INITIALIZE_BEDROCK':
      handleInitializeBedrock(sendResponse);
      break;
    
    case 'TEST_CONNECTION':
      handleTestConnection(sendResponse);
      break;
    
    case 'CHAT_MESSAGE':
      handleChatMessage(request.data, sendResponse);
      break;
    
    case 'ANALYZE_PAGE':
      handlePageAnalysisRequest(request.data, sendResponse);
      break;
    
    case 'INDEX_PAGE':
      handleIndexPageRequest(request.data, sendResponse);
      break;
    
    case 'SEARCH_SIMILAR':
      handleSearchSimilarRequest(request.data, sendResponse);
      break;
    
    case 'VECTOR_STORE_INFO':
      handleVectorStoreInfoRequest(sendResponse);
      break;
    
    case 'GET_AUTH_INFO':
      handleGetAuthInfoRequest(sendResponse);
      break;
    
    case 'SET_AWS_CLI_CREDENTIALS':
      handleSetAWSCLICredentialsRequest(request.data, sendResponse);
      break;
    
    case 'CLEAR_AWS_CLI_CREDENTIALS':
      handleClearAWSCLICredentialsRequest(sendResponse);
      break;
    
    case 'SWITCH_AUTH_METHOD':
      handleSwitchAuthMethodRequest(request.data, sendResponse);
      break;
    
    case 'GET_SESSION':
      handleGetSession(request.sessionId, sendResponse);
      break;
    
    case 'GET_SUPPORTED_MODELS':
      handleGetSupportedModels(sendResponse);
      break;
    
    case 'GET_CURRENT_MODEL':
      handleGetCurrentModel(sendResponse);
      break;
    
    case 'SET_MODEL':
      handleSetModel(request.modelKey, sendResponse);
      break;
    
    default:
      console.warn('⚠️ 알 수 없는 메시지 타입:', request.type);
      sendResponse({ success: false, error: '알 수 없는 요청 타입' });
  }

  // 비동기 응답을 위해 true 반환
  return true;
});

/**
 * Bedrock 클라이언트 초기화 처리
 */
async function handleInitializeBedrock(sendResponse) {
  try {
    const success = await initializeBedrockClient();
    sendResponse({ 
      success: success, 
      message: success ? 'Bedrock 클라이언트 초기화 성공' : 'API Key가 설정되지 않음'
    });
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * 연결 테스트 처리
 */
async function handleTestConnection(sendResponse) {
  try {
    // 항상 새로운 클라이언트로 테스트 (기존 초기화 상태와 무관)
    const testClient = new BedrockClient();
    await testClient.initialize();
    
    const result = await testClient.testConnection();
    
    // 테스트 성공 시 전역 클라이언트 업데이트
    bedrockClient = testClient;
    
    sendResponse(result);
  } catch (error) {
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

/**
 * 채팅 메시지 처리
 */
async function handleChatMessage(data, sendResponse) {
  try {
    // 데이터 유효성 검사
    if (!data) {
      throw new Error('메시지 데이터가 없습니다.');
    }

    // 초기화된 클라이언트가 필요한 기능
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트가 초기화되지 않았습니다. API Key를 설정해주세요.');
    }

    const { messages, systemPrompt, sessionId, options = {}, useVectorSearch = true } = data;
    
    if (!messages || !Array.isArray(messages)) {
      throw new Error('유효하지 않은 메시지 형식입니다.');
    }

    // 세션 관리
    if (sessionId && !activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, {
        id: sessionId,
        history: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    console.log('💬 채팅 메시지 처리 시작:', messages.length, '개 메시지');

    let finalSystemPrompt = systemPrompt;
    let contextInfo = null;

    // Vector Store 기반 검색 (활성화된 경우)
    if (useVectorSearch && vectorStore && messages.length > 0) {
      try {
        const lastUserMessage = messages[messages.length - 1];
        if (lastUserMessage.role === 'user') {
          console.log('🔍 Vector Store 검색 시작:', lastUserMessage.content.substring(0, 50));
          
          const searchResult = await vectorStore.searchSimilar(lastUserMessage.content, {
            topK: 3,
            minSimilarity: 0.3,
            includeMetadata: true
          });

          if (searchResult.results.length > 0) {
            // 관련 컨텍스트 구성
            const relevantContext = searchResult.results
              .map(result => `[유사도: ${result.similarity}] ${result.content}`)
              .join('\n\n');

            finalSystemPrompt = `다음은 현재 페이지에서 사용자 질문과 관련된 내용입니다:

${relevantContext}

위 내용을 바탕으로 사용자의 질문에 정확하고 도움이 되는 답변을 해주세요. 관련 내용이 없다면 일반적인 답변을 제공해주세요.`;

            contextInfo = {
              searchResults: searchResult.results.length,
              totalSearched: searchResult.totalSearched,
              topSimilarity: searchResult.results[0]?.similarity || 0,
              queryTokens: searchResult.queryTokens
            };

            console.log('✅ Vector Store 검색 완료:', contextInfo);
          } else {
            console.log('ℹ️ Vector Store에서 관련 내용을 찾지 못함, 기본 시스템 프롬프트 사용');
          }
        }
      } catch (vectorError) {
        console.warn('⚠️ Vector Store 검색 실패, 기본 방식으로 진행:', vectorError.message);
      }
    }

    // Claude 호출
    const claudeOptions = {
      ...options,
      systemPrompt: finalSystemPrompt
    };
    
    const response = await bedrockClient.invokeClaude(messages, claudeOptions);
    
    // 세션에 메시지 추가
    if (sessionId) {
      const session = activeSessions.get(sessionId);
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
      sessionId: sessionId,
      vectorSearch: contextInfo ? {
        used: true,
        ...contextInfo
      } : { used: false },
      timestamp: Date.now()
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

/**
 * 페이지 분석 요청 처리
 */
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

    const response = await bedrockClient.invokeClaude(messages, {
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

/**
 * 세션 정보 조회
 */
function handleGetSession(sessionId, sendResponse) {
  const session = activeSessions.get(sessionId);
  sendResponse({
    success: !!session,
    session: session || null
  });
}

/**
 * 지원 모델 목록 조회
 */
async function handleGetSupportedModels(sendResponse) {
  try {
    console.log('📋 지원 모델 조회 요청 받음');
    
    // BedrockClient 인스턴스가 없으면 생성 (API Key 없이도 가능)
    if (!bedrockClient) {
      console.log('🔄 Bedrock 클라이언트 인스턴스 생성...');
      bedrockClient = new BedrockClient();
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

/**
 * 현재 선택된 모델 조회
 */
async function handleGetCurrentModel(sendResponse) {
  try {
    console.log('🔍 현재 모델 조회 요청 받음');
    
    // BedrockClient 인스턴스가 없으면 생성
    if (!bedrockClient) {
      console.log('🔄 Bedrock 클라이언트 인스턴스 생성...');
      bedrockClient = new BedrockClient();
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

/**
 * 모델 변경
 */
async function handleSetModel(modelKey, sendResponse) {
  try {
    // BedrockClient 인스턴스가 없으면 생성
    if (!bedrockClient) {
      bedrockClient = new BedrockClient();
    }
    
    // 모델 유효성 검사
    const supportedModels = bedrockClient.getSupportedModels();
    const targetModel = supportedModels.find(model => model.key === modelKey);
    
    if (!targetModel) {
      throw new Error(`지원하지 않는 모델입니다: ${modelKey}`);
    }
    
    // Storage에 모델 저장
    await chrome.storage.sync.set({ selectedModel: modelKey });
    
    // 초기화된 클라이언트가 있으면 모델 변경
    if (bedrockClient.isInitialized) {
      await bedrockClient.setModel(modelKey);
    }
    
    sendResponse({
      success: true,
      message: `모델이 ${targetModel.name}으로 변경되었습니다.`,
      model: targetModel
    });

  } catch (error) {
    console.error('❌ 모델 변경 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 선택 텍스트 분석 처리
 */
async function handleTextAnalysis(selectedText, tab) {
  try {
    if (!bedrockClient) {
      await initializeBedrockClient();
    }

    if (!bedrockClient) {
      console.error('Bedrock 클라이언트를 초기화할 수 없습니다.');
      return;
    }

    const messages = [{
      role: 'user',
      content: `다음 텍스트를 분석해주세요:\n\n"${selectedText}"`
    }];

    const response = await bedrockClient.invokeClaude(messages, {
      systemPrompt: '선택된 텍스트를 분석하고 설명해주세요.',
      maxTokens: 1000
    });

    // 결과를 팝업이나 사이드바에 표시 (향후 구현)
    console.log('📝 텍스트 분석 결과:', response.content[0].text);

  } catch (error) {
    console.error('❌ 텍스트 분석 실패:', error);
  }
}

/**
 * 페이지 분석 처리
 */
async function handlePageAnalysis(tab) {
  try {
    // Content Script에 페이지 분석 요청
    const pageData = await chrome.tabs.sendMessage(tab.id, {
      type: 'EXTRACT_PAGE_CONTENT'
    });

    if (!pageData.success) {
      throw new Error('페이지 내용을 추출할 수 없습니다.');
    }

    // 페이지 분석 수행
    await handlePageAnalysisRequest({
      pageContent: pageData.content,
      analysisType: 'general'
    }, (result) => {
      console.log('📄 페이지 분석 결과:', result);
    });

  } catch (error) {
    console.error('❌ 페이지 분석 실패:', error);
  }
}

/**
 * 세션 정리 (메모리 관리)
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30분

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > maxAge) {
      activeSessions.delete(sessionId);
      console.log('🗑️ 비활성 세션 정리:', sessionId);
    }
  }
}, 5 * 60 * 1000); // 5분마다 실행

/**
 * 페이지 인덱싱 요청 처리
 */
async function handleIndexPageRequest(data, sendResponse) {
  try {
    console.log('📊 페이지 인덱싱 요청 받음');
    
    if (!vectorStore) {
      throw new Error('Vector Store가 초기화되지 않았습니다.');
    }
    
    if (!data || !data.fullData) {
      throw new Error('페이지 데이터가 없습니다.');
    }
    
    const result = await vectorStore.indexPage(data);
    
    sendResponse({
      success: true,
      result: result,
      message: '페이지 인덱싱이 완료되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ 페이지 인덱싱 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 유사도 검색 요청 처리
 */
async function handleSearchSimilarRequest(data, sendResponse) {
  try {
    console.log('🔍 유사도 검색 요청 받음:', data.query?.substring(0, 50));
    
    if (!vectorStore) {
      throw new Error('Vector Store가 초기화되지 않았습니다.');
    }
    
    if (!data || !data.query) {
      throw new Error('검색 쿼리가 없습니다.');
    }
    
    const searchResult = await vectorStore.searchSimilar(data.query, data.options);
    
    sendResponse({
      success: true,
      searchResult: searchResult,
      message: `${searchResult.results.length}개의 유사한 내용을 찾았습니다.`
    });
    
  } catch (error) {
    console.error('❌ 유사도 검색 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Vector Store 정보 요청 처리
 */
async function handleVectorStoreInfoRequest(sendResponse) {
  try {
    if (!vectorStore) {
      sendResponse({
        success: false,
        error: 'Vector Store가 초기화되지 않았습니다.'
      });
      return;
    }
    
    const storageInfo = await vectorStore.getStorageInfo();
    
    sendResponse({
      success: true,
      storageInfo: storageInfo,
      message: 'Vector Store 정보를 조회했습니다.'
    });
    
  } catch (error) {
    console.error('❌ Vector Store 정보 조회 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * AWS 인증 정보 요청 처리
 */
async function handleGetAuthInfoRequest(sendResponse) {
  try {
    if (!bedrockClient || !bedrockClient.authManager) {
      sendResponse({
        success: false,
        error: 'AWS 인증 관리자가 초기화되지 않았습니다.'
      });
      return;
    }
    
    const authInfo = bedrockClient.authManager.getAuthInfo();
    
    sendResponse({
      success: true,
      authInfo: authInfo,
      message: 'AWS 인증 정보를 조회했습니다.'
    });
    
  } catch (error) {
    console.error('❌ AWS 인증 정보 조회 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * AWS CLI 인증 정보 설정 요청 처리
 */
async function handleSetAWSCLICredentialsRequest(data, sendResponse) {
  try {
    if (!bedrockClient || !bedrockClient.authManager) {
      throw new Error('AWS 인증 관리자가 초기화되지 않았습니다.');
    }
    
    if (!data || !data.credentials) {
      throw new Error('AWS CLI 인증 정보가 없습니다.');
    }
    
    const success = await bedrockClient.authManager.setAWSCLICredentials(data.credentials);
    
    if (success) {
      // Bedrock 클라이언트 재초기화
      await bedrockClient.initialize();
      
      // Vector Store도 재초기화
      if (vectorStore) {
        vectorStore = new VectorStore(bedrockClient);
      }
    }
    
    sendResponse({
      success: success,
      message: 'AWS CLI 인증 정보가 설정되었습니다.'
    });
    
  } catch (error) {
    console.error('❌ AWS CLI 인증 정보 설정 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * AWS CLI 인증 정보 제거 요청 처리
 */
async function handleClearAWSCLICredentialsRequest(sendResponse) {
  try {
    if (!bedrockClient || !bedrockClient.authManager) {
      throw new Error('AWS 인증 관리자가 초기화되지 않았습니다.');
    }
    
    const success = await bedrockClient.authManager.clearAWSCLICredentials();
    
    if (success) {
      // Bedrock 클라이언트 재초기화
      await bedrockClient.initialize();
      
      // Vector Store도 재초기화
      if (vectorStore) {
        vectorStore = new VectorStore(bedrockClient);
      }
    }
    
    sendResponse({
      success: success,
      message: 'AWS CLI 인증 정보가 제거되었습니다. API Key 인증으로 전환됩니다.'
    });
    
  } catch (error) {
    console.error('❌ AWS CLI 인증 정보 제거 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * 인증 방식 전환 요청 처리
 */
async function handleSwitchAuthMethodRequest(data, sendResponse) {
  try {
    if (!bedrockClient || !bedrockClient.authManager) {
      throw new Error('AWS 인증 관리자가 초기화되지 않았습니다.');
    }
    
    if (!data || !data.method) {
      throw new Error('전환할 인증 방식이 지정되지 않았습니다.');
    }
    
    const success = await bedrockClient.authManager.switchAuthMethod(data.method);
    
    if (success) {
      // Bedrock 클라이언트 재초기화
      await bedrockClient.initialize();
      
      // Vector Store도 재초기화
      if (vectorStore) {
        vectorStore = new VectorStore(bedrockClient);
      }
    }
    
    sendResponse({
      success: success,
      message: `${data.method} 인증 방식으로 전환되었습니다.`
    });
    
  } catch (error) {
    console.error('❌ 인증 방식 전환 실패:', error);
    sendResponse({
      success: false,
      error: error.message
    });
  }
}

console.log('🎯 Background Service Worker 로드 완료');
