# AWS AI Assistant Chrome Extension

Amazon Bedrock 기반 웹페이지 분석 AI 어시스턴트 Chrome Extension

## 📸 스크린샷

![Chrome Extension 채팅 화면](./img/chrome-ext-sc.png)

*실제 사용 화면: 웹페이지 내용을 바탕으로 AI와 자연스러운 대화*

## 🚀 주요 기능

- **다중 AI 모델 지원**: Claude Haiku 4.5 (기본), Claude 4 Sonnet, Claude 3.7 Sonnet
- **지능형 웹페이지 분석**: 현재 페이지 내용을 자동으로 분석하여 핵심 정보 추출
- **실시간 AI 채팅**: 페이지 내용을 바탕으로 AI와 자연스러운 대화
- **빠른 작업 도구**: 요약, 핵심 포인트 추출, 번역 등 원클릭 실행


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
2. 설정 페이지에서 [AWS Bedrock API Key](https://docs.aws.amazon.com/ko_kr/bedrock/latest/userguide/api-keys-generate.html) 입력
3. 원하는 AI 모델 선택

## 🎯 사용 예시

### 1. 웹페이지 분석 및 질문
위 스크린샷에서 보듯이, 사용자가 **"전공에 대한 내용이 있어?"**라고 질문하면 AI가 현재 페이지 내용을 분석하여 다음과 같이 체계적으로 답변합니다:

- **전공 탐색 방법**: 자기 평가를 통한 기술, 관심사, 가치 파악
- **전공 선언/변경**: 90학점 도달 전 선언 및 변경 절차 안내  
- **선별 입학 프로그램**: 공학, 컴퓨터 과학, 특수교육 등 전공별 정보

### 2. 빠른 원클릭 도구
- **요약**: 페이지 내용을 간결하게 요약
- **핵심 포인트**: 주요 포인트들을 불릿 형태로 정리
- **번역**: 페이지 내용을 한국어로 번역

### 3. 실시간 대화
- 채팅 인터페이스를 통해 페이지 내용에 대한 추가 질문 가능
- 문맥을 이해하는 지능형 응답
- 2000자 입력 제한으로 효율적인 대화

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

- **AI 모델**: AWS Bedrock (Claude Haiku 4.5, Claude 4 Sonnet, Claude 3.7 Sonnet)
- **플랫폼**: Chrome Extension Manifest V3
- **인증**: Bearer Token (API Key 기반)
- **리전**: us-west-2 (Cross-Region Inference)
- **테스트**: Jest (단위/통합/E2E 테스트)

## 🎯 지원 모델

| 모델 | 제공자 | 특징 | 최대 토큰 |
|------|--------|------|-----------|
| **Claude Haiku 4.5** | Anthropic | 빠르고 효율적인 모델 **(기본)** <br>• 빠른 응답 속도<br>• 일상적인 질문과 간단한 분석에 최적화<br>• 간결하면서도 정확한 정보 전달 | 8,000 |
| Claude 4 Sonnet | Anthropic | 최신 고성능 모델<br>• 향상된 추론 능력<br>• 복잡한 분석과 상세한 설명 가능<br>• 고급 작업에 적합 | 8,000 |
| Claude 3.7 Sonnet | Anthropic | 균형잡힌 성능과 속도<br>• 안정적인 성능<br>• 대부분의 작업에 적합 | 8,000 |

**💡 모델 선택 가이드:**
- **일반적인 사용**: Claude Haiku 4.5 (기본) - 빠른 응답과 효율성
- **복잡한 분석**: Claude 4 Sonnet - 깊이 있는 분석과 상세한 설명
- **안정적인 성능**: Claude 3.7 Sonnet - 검증된 성능

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



## 🚀 데모 페이지

프로젝트에 포함된 `demo.html` 파일을 브라우저에서 열어 모든 기능을 테스트할 수 있습니다.


## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

---

**Made with ❤️ using Amazon Q Developer**
