/**
 * Chrome Extension Background Service Worker
 * Claude 3.7 Sonnet AI Assistant
 */

// Bedrock 클라이언트 import
importScripts('bedrock-client.js');

// 전역 변수
let bedrockClient = null;
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
 * Extension 시작 시 초기화
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('🔄 Claude AI Assistant 시작됨');
  await initializeBedrockClient();
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
    return true;
  } catch (error) {
    console.warn('⚠️ Bedrock 클라이언트 초기화 실패:', error.message);
    bedrockClient = null;
    return false;
  }
}

/**
 * 컨텍스트 메뉴 생성
 */
function createContextMenus() {
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
}

/**
 * 컨텍스트 메뉴 클릭 처리
 */
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
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트를 초기화할 수 없습니다.');
    }

    const result = await bedrockClient.testConnection();
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
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트가 초기화되지 않았습니다.');
    }

    const { messages, sessionId, options = {} } = data;
    
    // 세션 관리
    if (sessionId && !activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, {
        id: sessionId,
        history: [],
        createdAt: Date.now(),
        lastActivity: Date.now()
      });
    }

    // Claude 호출
    const response = await bedrockClient.invokeClaude(messages, options);
    
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

    sendResponse({
      success: true,
      response: response.content[0].text,
      usage: response.usage,
      sessionId: sessionId
    });

  } catch (error) {
    console.error('❌ 채팅 메시지 처리 실패:', error);
    sendResponse({
      success: false,
      error: error.message
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
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트를 초기화할 수 없습니다.');
    }

    const models = bedrockClient.getSupportedModels();
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
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트를 초기화할 수 없습니다.');
    }

    const currentModel = bedrockClient.getCurrentModel();
    sendResponse({
      success: true,
      model: currentModel
    });

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
    if (!bedrockClient) {
      await initializeBedrockClient();
    }
    
    if (!bedrockClient) {
      throw new Error('Bedrock 클라이언트를 초기화할 수 없습니다.');
    }

    await bedrockClient.setModel(modelKey);
    const newModel = bedrockClient.getCurrentModel();
    
    sendResponse({
      success: true,
      message: `모델이 ${newModel.name}으로 변경되었습니다.`,
      model: newModel
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

console.log('🎯 Background Service Worker 로드 완료');
