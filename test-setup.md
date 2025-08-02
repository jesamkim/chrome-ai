# 테스트 설정 및 전략

## 테스트 프레임워크
- **단위 테스트**: Jest + Chrome Extension Testing Library
- **통합 테스트**: Puppeteer (Chrome Extension 환경)
- **API 테스트**: Mock 서버 + 실제 Bedrock API 테스트

## 테스트 구조
```
tests/
├── unit/                    # 단위 테스트
│   ├── bedrock-client.test.js
│   ├── page-analyzer.test.js
│   ├── session-manager.test.js
│   └── korean-utils.test.js
├── integration/             # 통합 테스트
│   ├── extension-loading.test.js
│   ├── api-integration.test.js
│   └── ui-interaction.test.js
├── e2e/                     # End-to-End 테스트
│   ├── full-workflow.test.js
│   └── user-scenarios.test.js
├── mocks/                   # Mock 데이터
│   ├── bedrock-responses.js
│   ├── page-content.js
│   └── api-keys.js
└── fixtures/                # 테스트 데이터
    ├── sample-pages/
    └── expected-responses/
```

## 테스트 체크리스트 템플릿

### 기능별 테스트 항목
- [ ] 정상 케이스 테스트
- [ ] 에러 케이스 테스트
- [ ] 경계값 테스트
- [ ] 성능 테스트 (필요시)
- [ ] 보안 테스트 (API Key 관련)

### 각 단계별 완료 조건
1. **모든 단위 테스트 통과**
2. **코드 커버리지 80% 이상**
3. **에러 핸들링 검증**
4. **로그 기록 확인**
5. **다음 단계 진행 승인**
