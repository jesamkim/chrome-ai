# 로컬 RAG 시스템 설계

## 개요
Chrome Extension에서 웹페이지를 완전히 파싱하고 로컬 RAG 방식으로 채팅하는 시스템

## 아키텍처

### 1. 텍스트 추출 단계
```
웹페이지 → Content Script → 전체 텍스트 추출 → Background Script
```

### 2. 텍스트 처리 단계
```
원본 텍스트 → 청킹 (1000자 단위) → 메타데이터 추가 → 로컬 저장
```

### 3. 임베딩 생성 단계
```
텍스트 청크 → AWS Bedrock Titan Embeddings → 벡터 저장
```

### 4. 검색 및 응답 단계
```
사용자 질문 → 질문 임베딩 → 유사도 검색 → 상위 N개 청크 → Claude API
```

## 기술 스택

### Frontend (Content Script)
- **텍스트 추출**: `document.body.innerText` + 구조화된 파싱
- **청킹**: 1000자 단위로 분할, 문장 경계 고려
- **메타데이터**: URL, 제목, 타임스탬프, 청크 인덱스

### Backend (Background Script)
- **임베딩 모델**: Amazon Titan Embeddings V2
- **벡터 저장**: Chrome Storage API (로컬)
- **유사도 검색**: 코사인 유사도
- **LLM**: Claude 3.7 Sonnet

### 저장소
- **Chrome Storage Local**: 대용량 텍스트 및 벡터 저장
- **Chrome Storage Sync**: 설정 및 메타데이터

## 구현 단계

### Phase 1: 텍스트 추출 개선
1. 전체 페이지 텍스트 추출
2. 구조화된 청킹 시스템
3. 메타데이터 생성

### Phase 2: 임베딩 시스템
1. Titan Embeddings API 연동
2. 벡터 생성 및 저장
3. 유사도 검색 구현

### Phase 3: RAG 채팅
1. 질문 임베딩 생성
2. 관련 청크 검색
3. 컨텍스트 구성 및 Claude 호출

### Phase 4: 최적화
1. 캐싱 시스템
2. 점진적 로딩
3. 성능 최적화

## 데이터 구조

### 텍스트 청크
```javascript
{
  id: "page_url_chunk_001",
  pageUrl: "https://example.com",
  pageTitle: "Example Page",
  content: "텍스트 내용...",
  metadata: {
    chunkIndex: 1,
    totalChunks: 10,
    timestamp: "2024-01-01T00:00:00Z",
    wordCount: 250,
    headings: ["제목1", "제목2"]
  },
  embedding: [0.1, 0.2, 0.3, ...] // 1536차원 벡터
}
```

### 페이지 인덱스
```javascript
{
  pageUrl: "https://example.com",
  pageTitle: "Example Page",
  totalChunks: 10,
  lastUpdated: "2024-01-01T00:00:00Z",
  wordCount: 2500,
  chunkIds: ["page_url_chunk_001", "page_url_chunk_002", ...]
}
```

## API 사용량 최적화

### 현재 방식
- 채팅 1회당: 전체 페이지 내용 (8K 토큰) + 질문 → Claude API

### RAG 방식
- 페이지 분석 1회: 전체 텍스트 → Titan Embeddings (1회만)
- 채팅 1회당: 관련 청크 (2K 토큰) + 질문 → Claude API

### 비용 절감 효과
- **토큰 사용량**: 75% 감소 (8K → 2K)
- **응답 정확도**: 관련 컨텍스트만 전송으로 향상
- **응답 속도**: 로컬 검색으로 빠른 컨텍스트 구성

## 기술적 고려사항

### 1. Chrome Extension 제약사항
- **Storage 한계**: Local Storage 10MB 제한
- **메모리 제약**: Background Script 메모리 관리
- **권한 요구**: 추가 권한 불필요 (기존 권한으로 충분)

### 2. 성능 최적화
- **지연 로딩**: 필요한 청크만 로드
- **캐싱**: 자주 사용되는 임베딩 캐시
- **배치 처리**: 여러 청크 동시 처리

### 3. 사용자 경험
- **진행 표시**: 텍스트 처리 진행률 표시
- **오프라인 지원**: 로컬 저장으로 오프라인 검색 가능
- **빠른 응답**: 로컬 검색으로 즉시 관련 내용 표시

## 구현 우선순위

### High Priority
1. 전체 텍스트 추출 시스템
2. 청킹 및 메타데이터 생성
3. Titan Embeddings 연동

### Medium Priority
1. 유사도 검색 알고리즘
2. 컨텍스트 구성 최적화
3. 캐싱 시스템

### Low Priority
1. 고급 검색 필터
2. 다중 페이지 검색
3. 검색 결과 하이라이팅

## 예상 효과

### 정확도 향상
- 특정 텍스트 검색 가능
- 의미적 유사성 기반 검색
- 관련 컨텍스트만 전송으로 노이즈 감소

### 성능 향상
- API 호출 토큰 75% 감소
- 로컬 검색으로 빠른 응답
- 오프라인 검색 지원

### 사용자 경험 향상
- 더 정확한 답변
- 빠른 응답 시간
- 페이지 내 특정 내용 검색 가능
