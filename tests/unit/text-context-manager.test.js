/**
 * 텍스트 컨텍스트 관리자 단위 테스트
 */

// Chrome API 모킹
global.chrome = {
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  }
};

// TextContextManager 로드
const TextContextManager = require('../../src/background/text-context-manager.js');

describe('TextContextManager', () => {
  let contextManager;
  
  beforeEach(() => {
    contextManager = new TextContextManager();
    jest.clearAllMocks();
  });

  describe('생성자', () => {
    test('기본 설정이 올바르게 초기화되어야 함', () => {
      expect(contextManager.maxTokens).toBe(6000);
      expect(contextManager.approximateTokenRatio).toBe(4);
      expect(contextManager.maxContextLength).toBe(24000);
      expect(contextManager.prioritySections).toContain('title');
      expect(contextManager.prioritySections).toContain('headings');
    });
  });

  describe('compressPageToContext', () => {
    test('페이지 데이터를 성공적으로 압축해야 함', () => {
      // Given
      const mockPageData = {
        metadata: {
          url: 'https://example.com',
          title: '테스트 페이지',
          language: 'ko',
          description: '테스트 페이지 설명'
        },
        content: {
          headings: [
            { level: 1, text: '메인 제목' },
            { level: 2, text: '부제목' }
          ],
          paragraphs: [
            '이것은 첫 번째 문단입니다. 충분히 긴 내용을 포함하고 있어야 합니다.',
            '이것은 두 번째 문단입니다. 역시 충분한 길이를 가지고 있습니다.'
          ],
          lists: [
            { items: ['항목 1', '항목 2', '항목 3'] }
          ],
          tables: []
        },
        fullText: '전체 텍스트 내용입니다. 이것은 원본 텍스트의 전체 내용을 나타냅니다.',
        statistics: { wordCount: 20, charCount: 100 }
      };

      // When
      const result = contextManager.compressPageToContext(mockPageData);

      // Then
      expect(result).toHaveProperty('context');
      expect(result).toHaveProperty('metadata');
      expect(result.context).toContain('테스트 페이지');
      expect(result.context).toContain('메인 제목');
      expect(result.metadata.url).toBe('https://example.com');
      // 압축 비율은 음수일 수 있음 (메타데이터 추가로 인해)
      expect(typeof result.metadata.compressionRatio).toBe('number');
    });

    test('빈 데이터에 대해서도 처리해야 함', () => {
      // Given
      const emptyPageData = {
        metadata: {
          url: 'https://empty.com',
          title: '빈 페이지',
          language: 'ko'
        },
        content: {
          headings: [],
          paragraphs: [],
          lists: [],
          tables: []
        },
        fullText: '',
        statistics: { wordCount: 0, charCount: 0 }
      };

      // When
      const result = contextManager.compressPageToContext(emptyPageData);

      // Then
      expect(result.context).toContain('빈 페이지');
      expect(result.metadata.originalLength).toBe(0);
    });
  });

  describe('createStructuredContext', () => {
    test('구조화된 컨텍스트를 올바르게 생성해야 함', () => {
      // Given
      const metadata = {
        title: '테스트 제목',
        url: 'https://test.com',
        description: '테스트 설명'
      };
      
      const content = {
        headings: [{ level: 1, text: '헤딩 1' }],
        paragraphs: ['문단 내용입니다. 이것은 충분히 긴 문단으로 50자를 넘어야 합니다. 더 길게 만들어야 합니다.'],
        lists: [{ items: ['리스트 항목'] }],
        tables: []
      };

      // When
      const result = contextManager.createStructuredContext(metadata, content);

      // Then
      expect(result.title).toContain('테스트 제목');
      expect(result.headings).toContain('헤딩 1');
      expect(result.mainContent).toContain('문단 내용입니다');
      expect(result.lists).toContain('리스트 항목');
    });
  });

  describe('extractHeadings', () => {
    test('헤딩을 올바르게 추출해야 함', () => {
      // Given
      const headings = [
        { level: 1, text: '메인 헤딩' },
        { level: 2, text: '서브 헤딩' },
        { level: 3, text: '세부 헤딩' }
      ];

      // When
      const result = contextManager.extractHeadings(headings);

      // Then
      expect(result).toContain('메인 헤딩');
      expect(result).toContain('서브 헤딩');
      expect(result).toContain('세부 헤딩');
      expect(result).toContain('1.');
      expect(result).toContain('2.');
    });

    test('빈 헤딩 배열에 대해 빈 문자열을 반환해야 함', () => {
      // Given
      const headings = [];

      // When
      const result = contextManager.extractHeadings(headings);

      // Then
      expect(result).toBe('');
    });
  });

  describe('extractMainContent', () => {
    test('메인 콘텐츠를 길이순으로 정렬하여 추출해야 함', () => {
      // Given
      const paragraphs = [
        '짧은 문단', // 50자 미만이므로 제외됨
        '이것은 훨씬 더 긴 문단입니다. 충분한 내용을 포함하고 있어서 우선순위가 높을 것입니다. 50자를 넘어야 합니다. 더 길게 만들어야 합니다.',
        '중간 길이의 문단입니다. 적당한 내용을 포함합니다. 50자를 넘어야 합니다. 더 길게 만들어야 합니다.'
      ];

      // When
      const result = contextManager.extractMainContent(paragraphs);

      // Then
      expect(result).toContain('훨씬 더 긴 문단');
      expect(result).toContain('중간 길이의 문단');
      expect(result).not.toContain('짧은 문단'); // 50자 미만이므로 제외
    });
  });

  describe('fitToTokenLimit', () => {
    test('토큰 제한에 맞춰 섹션을 압축해야 함', () => {
      // Given
      const sections = {
        title: '제목: 테스트',
        headings: '헤딩 내용',
        mainContent: 'A'.repeat(20000), // 매우 긴 내용
        lists: '리스트 내용',
        tables: '테이블 내용'
      };
      const fallbackText = '폴백 텍스트';

      // When
      const result = contextManager.fitToTokenLimit(sections, fallbackText);

      // Then
      const totalLength = Object.values(result).join('').length;
      expect(totalLength).toBeLessThanOrEqual(contextManager.maxContextLength);
      expect(result.title).toBe('제목: 테스트'); // 우선순위가 높아서 포함
      expect(result.headings).toBe('헤딩 내용');
    });
  });

  describe('formatContext', () => {
    test('최종 컨텍스트를 올바른 형식으로 포맷팅해야 함', () => {
      // Given
      const sections = {
        title: '제목: 테스트 페이지',
        headings: '주요 섹션:\n1. 헤딩 1',
        mainContent: '주요 내용:\n문단 내용'
      };
      const metadata = {
        title: '테스트 페이지',
        url: 'https://test.com',
        language: 'ko'
      };

      // When
      const result = contextManager.formatContext(sections, metadata);

      // Then
      expect(result).toContain('=== 웹페이지 분석 ===');
      expect(result).toContain('페이지: 테스트 페이지');
      expect(result).toContain('URL: https://test.com');
      expect(result).toContain('언어: ko');
      expect(result).toContain('제목: 테스트 페이지');
      expect(result).toContain('=== 분석 완료 ===');
    });
  });

  describe('getContextStats', () => {
    test('컨텍스트 통계를 올바르게 계산해야 함', () => {
      // Given
      const context = '테스트 컨텍스트입니다.\n두 번째 줄입니다.';

      // When
      const stats = contextManager.getContextStats(context);

      // Then
      expect(stats.length).toBe(context.length);
      expect(stats.estimatedTokens).toBe(Math.ceil(context.length / 4));
      expect(stats.lines).toBe(2);
      expect(stats.words).toBeGreaterThan(0);
    });
  });

  describe('성능 테스트', () => {
    test('대용량 텍스트 처리 성능', () => {
      // Given
      const largePageData = {
        metadata: {
          url: 'https://large.com',
          title: '대용량 페이지',
          language: 'ko'
        },
        content: {
          headings: Array.from({ length: 50 }, (_, i) => ({ level: 1, text: `헤딩 ${i}` })),
          paragraphs: Array.from({ length: 100 }, (_, i) => `문단 ${i}의 내용입니다. `.repeat(20)),
          lists: Array.from({ length: 20 }, (_, i) => ({ items: [`항목 ${i}-1`, `항목 ${i}-2`] })),
          tables: []
        },
        fullText: 'A'.repeat(50000),
        statistics: { wordCount: 10000, charCount: 50000 }
      };

      // When
      const startTime = Date.now();
      const result = contextManager.compressPageToContext(largePageData);
      const endTime = Date.now();

      // Then
      expect(endTime - startTime).toBeLessThan(1000); // 1초 이내 처리
      expect(result.context.length).toBeLessThanOrEqual(contextManager.maxContextLength);
      expect(result.metadata.compressionRatio).toBeGreaterThan(50); // 50% 이상 압축
    });
  });

  describe('토큰 제한 테스트', () => {
    test('Claude 모델 토큰 제한을 준수해야 함', () => {
      // Given
      const maxTokenPageData = {
        metadata: {
          url: 'https://maxtoken.com',
          title: '최대 토큰 테스트',
          language: 'ko'
        },
        content: {
          headings: [],
          paragraphs: [Array(1000).fill('토큰 테스트 문단입니다. ').join('')],
          lists: [],
          tables: []
        },
        fullText: Array(10000).fill('토큰 ').join(''),
        statistics: { wordCount: 10000, charCount: 70000 }
      };

      // When
      const result = contextManager.compressPageToContext(maxTokenPageData);

      // Then
      expect(result.metadata.estimatedTokens).toBeLessThanOrEqual(contextManager.maxTokens);
      expect(result.context.length).toBeLessThanOrEqual(contextManager.maxContextLength);
    });
  });
});

console.log('🧪 텍스트 컨텍스트 관리자 테스트 파일 생성 완료');
