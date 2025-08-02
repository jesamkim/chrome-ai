# Claude AI Chrome Extension

AWS Bedrock 기반 웹페이지 분석 AI 어시스턴트 Chrome Extension

## 🚀 주요 기능

- **다중 AI 모델 지원**: Claude 3.7 Sonnet, Claude 4 Sonnet, Amazon Nova Pro, Nova Lite
- **지능형 웹페이지 분석**: 현재 페이지 내용을 자동으로 분석하여 핵심 정보 추출
- **실시간 AI 채팅**: 페이지 내용을 바탕으로 Claude와 자연스러운 대화
- **빠른 작업 도구**: 요약, 핵심 포인트 추출, 번역 등 원클릭 실행
- **다크 테마 UI**: 현대적이고 직관적인 사용자 인터페이스

## 📋 설치 방법

### 1. 저장소 클론
```bash
git clone https://github.com/jesamkim/chrome-ai.git
cd chrome-ai
```

### 2. 의존성 설치
```bash
npm install
```

### 3. Chrome Extension 로드
1. Chrome 브라우저에서 `chrome://extensions/` 이동
2. 우측 상단의 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. 클론한 프로젝트 폴더 선택

### 4. API Key 설정
1. Extension 아이콘 클릭
2. 설정 페이지에서 AWS Bedrock API Key 입력
3. 원하는 AI 모델 선택

## 🔧 개발 환경 설정

### 테스트 실행
```bash
# 전체 테스트
npm test

# 단위 테스트만
npm run test:unit

# 통합 테스트만
npm run test:integration

# 구조 검증 테스트
npm run test:e2e
```

### 개발 서버 (선택사항)
```bash
# 개발 서버 시작 (포트 8080)
python3 -m http.server 8080
```

## 📊 기술 스택

- **AI 모델**: AWS Bedrock (Claude 3.7 Sonnet, Claude 4 Sonnet, Amazon Nova Pro/Lite)
- **플랫폼**: Chrome Extension Manifest V3
- **인증**: Bearer Token (API Key 기반)
- **리전**: us-west-2 (Cross-Region Inference)
- **테스트**: Jest (단위/통합/E2E 테스트)

## 🎯 지원 모델

| 모델 | 제공자 | 특징 | 최대 토큰 |
|------|--------|------|-----------|
| Claude 3.7 Sonnet | Anthropic | 균형잡힌 성능과 속도 (기본) | 8,000 |
| Claude 4 Sonnet | Anthropic | 최신 고성능 모델 | 8,000 |
| Amazon Nova Pro | Amazon | 고성능 멀티모달 모델 | 5,000 |
| Amazon Nova Lite | Amazon | 빠르고 경제적인 모델 | 3,000 |

## 📁 프로젝트 구조

```
chrome-ai/
├── src/
│   ├── background/          # Service Worker
│   │   ├── background.js
│   │   └── bedrock-client.js
│   ├── popup/              # 팝업 UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/            # 설정 페이지
│   │   └── options.html
│   ├── content/            # Content Script
│   │   ├── content.js
│   │   └── content.css
│   └── assets/             # 아이콘 등 리소스
├── tests/                  # 테스트 파일들
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── manifest.json           # Extension 매니페스트
├── demo.html              # 기능 테스트용 데모 페이지
└── package.json
```

## 🔐 보안 고려사항

- **API Key 보안**: Chrome Storage API를 통한 안전한 저장
- **최소 권한 원칙**: 필요한 권한만 요청
- **CORS 설정**: 적절한 호스트 권한 설정
- **데이터 보호**: 클라이언트 사이드 노출 방지


## 📖 사용 예시

### 1. 웹페이지 분석
- 임의의 웹페이지에서 Extension 아이콘 클릭
- "분석하기" 버튼으로 페이지 내용 분석
- AI가 핵심 정보를 추출하여 표시

### 2. 빠른 작업
- **요약**: 페이지 내용을 간결하게 요약
- **핵심 포인트**: 주요 포인트들을 불릿 형태로 정리
- **번역**: 페이지 내용을 한국어로 번역

### 3. AI 채팅
- 채팅 버튼 클릭으로 대화 모드 진입
- 페이지 내용에 대한 질문 가능
- 실시간으로 Claude와 대화

## 🚀 데모 페이지

프로젝트에 포함된 `demo.html` 파일을 브라우저에서 열어 모든 기능을 테스트할 수 있습니다.


## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

**Made with ❤️ using AWS Bedrock and Claude AI**
