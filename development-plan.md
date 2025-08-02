# Claude 3.7 Sonnet Chrome Extension 개발 계획 (수정판)

## 📋 프로젝트 개요

**목표**: AWS Bedrock Claude 3.7 Sonnet 기반 Chrome 브라우저 익스텐션 개발
- **모델**: us.anthropic.claude-3-7-sonnet-20250219-v1:0
- **인증**: Bedrock API Key (Bearer Token 방식)
- **리전**: us-west-2 (Cross-Region Inference 활용)
- **핵심 기능**: 현재 웹페이지 기반 AI 챗봇
- **향후 확장**: MCP 툴 연결

## 🏗️ 수정된 아키텍처 (API Key 기반)

```
┌─────────────────────────────────────────────────────────────┐
│                Chrome Extension Layer                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Content Script │   Popup/Sidebar │   Background Service    │
│   (웹페이지 분석)  │   (챗봇 UI)      │   (Bedrock API 호출)    │
└─────────────────┴─────────────────┴─────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────────┐
│                 Bedrock API Layer                           │
├─────────────────┬─────────────────┬─────────────────────────┤
│   API Key Auth  │  Claude 3.7     │   Cross-Region          │
│   (Bearer Token)│  Sonnet Model   │   Inference             │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 📅 개발 단계별 계획

### Phase 1: 기본 구조 및 API 연동 (1-2주)

#### 1.1 프로젝트 구조 생성
```
chrome-ai-claude37/
├── manifest.json                    # Extension 설정 (Manifest V3)
├── src/
│   ├── background/                  # Background Service Worker
│   │   ├── background.js
│   │   ├── bedrock-client.js        # Bedrock API 클라이언트
│   │   └── api-manager.js           # API 호출 관리
│   ├── content/                     # Content Scripts
│   │   ├── content.js
│   │   ├── page-analyzer.js         # 페이지 분석
│   │   └── content.css
│   ├── popup/                       # 팝업 UI
│   │   ├── popup.html
│   │   ├── popup.js
│   │   └── popup.css
│   ├── sidebar/                     # 사이드바 UI
│   │   ├── sidebar.html
│   │   ├── sidebar.js
│   │   └── sidebar.css
│   ├── options/                     # 설정 페이지
│   │   ├── options.html
│   │   ├── options.js               # API Key 설정
│   │   └── options.css
│   ├── utils/                       # 유틸리티
│   │   ├── storage.js               # Chrome Storage 관리
│   │   ├── logger.js                # 로깅 시스템
│   │   └── korean-utils.js          # 한국어 처리
│   └── assets/
│       ├── icons/
│       └── styles/
├── docs/
├── tests/
└── build/
```

#### 1.2 Bedrock API 클라이언트 구현

**핵심 구현 사항:**
```javascript
// src/background/bedrock-client.js
class BedrockClient {
  constructor() {
    this.region = 'us-west-2';
    this.modelId = 'us.anthropic.claude-3-7-sonnet-20250219-v1:0';
    this.baseUrl = `https://bedrock-runtime.${this.region}.amazonaws.com`;
    this.apiKey = null;
  }

  async initialize() {
    // Chrome Storage에서 API Key 로드
    const result = await chrome.storage.sync.get(['bedrockApiKey']);
    if (!result.bedrockApiKey) {
      throw new Error('Bedrock API Key가 설정되지 않았습니다.');
    }
    this.apiKey = result.bedrockApiKey;
  }

  async invokeClaude(messages, options = {}) {
    const requestBody = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: options.maxTokens || 4000,
      temperature: options.temperature || 0.1,
      messages: messages,
      system: options.systemPrompt || this.getDefaultSystemPrompt()
    };

    const response = await fetch(`${this.baseUrl}/model/${this.modelId}/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'X-Amzn-Bedrock-Accept': 'application/json',
        'X-Amzn-Bedrock-Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Bedrock API 오류: ${response.status}`);
    }

    return await response.json();
  }

  // 스트리밍 응답 지원
  async invokeClaudeStream(messages, options = {}) {
    // 스트리밍 구현
  }
}
```

#### 1.3 Chrome Extension 기본 설정

**manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Claude 3.7 AI Assistant",
  "version": "1.0.0",
  "description": "AWS Bedrock Claude 3.7 Sonnet 기반 웹페이지 분석 AI 어시스턴트",
  
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  
  "host_permissions": [
    "https://bedrock-runtime.us-west-2.amazonaws.com/*"
  ],
  
  "background": {
    "service_worker": "src/background/background.js"
  },
  
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/content.js"],
    "css": ["src/content/content.css"]
  }],
  
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Claude AI Assistant"
  },
  
  "options_page": "src/options/options.html",
  
  "icons": {
    "16": "src/assets/icons/icon16.png",
    "48": "src/assets/icons/icon48.png",
    "128": "src/assets/icons/icon128.png"
  }
}
```

### Phase 2: 웹페이지 분석 및 컨텍스트 관리 (2-3주)

#### 2.1 페이지 분석 시스템
```javascript
// src/content/page-analyzer.js
class PageAnalyzer {
  async analyzeCurrentPage() {
    return {
      url: window.location.href,
      title: document.title,
      content: this.extractStructuredContent(),
      metadata: this.extractMetadata(),
      language: this.detectLanguage(),
      readability: this.calculateReadability(),
      timestamp: Date.now()
    };
  }

  extractStructuredContent() {
    return {
      headings: this.extractHeadings(),
      paragraphs: this.extractParagraphs(),
      lists: this.extractLists(),
      tables: this.extractTables(),
      links: this.extractLinks(),
      images: this.extractImages()
    };
  }
}
```

#### 2.2 세션 관리 시스템
```javascript
// src/background/session-manager.js
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.maxHistoryLength = 50; // Claude 3.7의 긴 컨텍스트 활용
  }

  async createSession(pageUrl) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      pageUrl: pageUrl,
      history: [],
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    
    this.sessions.set(sessionId, session);
    return sessionId;
  }

  async addMessage(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.history.push({
      role: role,
      content: content,
      timestamp: Date.now()
    });

    // 히스토리 길이 관리
    if (session.history.length > this.maxHistoryLength) {
      session.history = session.history.slice(-this.maxHistoryLength);
    }

    session.lastActivity = Date.now();
    return true;
  }
}
```

### Phase 3: 챗봇 UI/UX 개발 (2-3주)

#### 3.1 사이드바 인터페이스
- 반응형 디자인 (400px 너비)
- 다크 테마 기본 적용
- 실시간 스트리밍 응답 지원
- 한국어 UI

#### 3.2 주요 기능
- 페이지 컨텍스트 자동 분석
- 대화 히스토리 유지
- 마크다운 렌더링
- 코드 하이라이팅
- 복사/공유 기능

### Phase 4: MCP 통합 준비 (3-4주)

#### 4.1 MCP 클라이언트 구현
```javascript
// src/mcp/mcp-client.js
class MCPClient {
  constructor() {
    this.servers = new Map();
    this.tools = new Map();
  }

  async connectServer(serverConfig) {
    // MCP 서버 연결 로직
  }

  async listTools() {
    // 사용 가능한 툴 목록 반환
  }

  async invokeTool(toolName, parameters) {
    // 툴 실행 및 결과 반환
  }
}
```

### Phase 5: 보안 및 최적화 (1-2주)

#### 5.1 보안 강화
- API Key 암호화 저장
- CSP 설정
- 권한 최소화

#### 5.2 성능 최적화
- 응답 캐싱
- 토큰 사용량 최적화
- 메모리 관리

## 🚀 개발 시작

현재 `/Workshop/chrome-ai` 디렉토리에서 개발을 시작하겠습니다. 

**첫 번째 단계**: 기본 프로젝트 구조를 생성하고 manifest.json을 작성하겠습니다.

개발을 시작할까요?
