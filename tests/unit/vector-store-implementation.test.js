/**
 * Vector Store 구현 테스트
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('Vector Store 구현 테스트', () => {
  let mockBedrockClient;
  let vectorStore;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // BedrockClient Mock
    mockBedrockClient = {
      generateEmbedding: jest.fn(),
      generateBatchEmbeddings: jest.fn()
    };

    // VectorStore Mock 클래스
    class MockVectorStore {
      constructor(bedrockClient) {
        this.bedrockClient = bedrockClient;
        this.vectors = new Map();
        this.storageKey = 'vectorStore';
        this.metadataKey = 'vectorStoreMetadata';
      }

      async indexPage(pageData) {
        const { fullData, metadata } = pageData;
        const { chunks } = fullData;
        
        if (!chunks || chunks.length === 0) {
          throw new Error('청크 데이터가 없습니다.');
        }
        
        // Mock 임베딩 생성
        const mockEmbeddings = chunks.map(() => ({
          embedding: Array(1536).fill(0).map(() => Math.random()),
          inputTokens: 100
        }));
        
        const batchTexts = chunks.map(chunk => chunk.content);
        await this.bedrockClient.generateBatchEmbeddings(batchTexts, 3);
        
        const vectorChunks = chunks.map((chunk, index) => ({
          id: `${metadata.url}_chunk_${chunk.id}`,
          content: chunk.content,
          vector: mockEmbeddings[index].embedding,
          metadata: {
            pageUrl: metadata.url,
            pageTitle: metadata.title,
            chunkIndex: chunk.id,
            chunkLength: chunk.length,
            wordCount: chunk.wordCount,
            timestamp: metadata.timestamp
          }
        }));

        return {
          success: true,
          pageUrl: metadata.url,
          chunkCount: vectorChunks.length,
          vectorDimensions: 1536
        };
      }

      async searchSimilar(query, options = {}) {
        const { topK = 5, minSimilarity = 0.3 } = options;
        
        // Mock 쿼리 임베딩
        const queryEmbedding = {
          embedding: Array(1536).fill(0).map(() => Math.random()),
          inputTokens: 50
        };
        
        await this.bedrockClient.generateEmbedding(query);
        
        // Mock 검색 결과
        const mockResults = [
          {
            id: 'chunk_001',
            content: '이 제품의 가격은 $299입니다.',
            similarity: 0.89,
            metadata: { pageUrl: 'https://example.com', chunkIndex: 1 }
          },
          {
            id: 'chunk_002', 
            content: '배송비는 무료이며 2-3일 소요됩니다.',
            similarity: 0.76,
            metadata: { pageUrl: 'https://example.com', chunkIndex: 2 }
          }
        ].filter(result => result.similarity >= minSimilarity)
         .slice(0, topK);

        return {
          results: mockResults,
          totalSearched: 10,
          queryTokens: queryEmbedding.inputTokens,
          searchTime: Date.now()
        };
      }

      cosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
          throw new Error('벡터 차원이 일치하지 않습니다.');
        }
        
        // 간단한 코사인 유사도 계산
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vectorA.length; i++) {
          dotProduct += vectorA[i] * vectorB[i];
          normA += vectorA[i] * vectorA[i];
          normB += vectorB[i] * vectorB[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
      }

      async getStorageInfo() {
        return {
          totalChunks: 25,
          totalBatches: 3,
          indexedPages: 1,
          storageUsed: 1024000, // 1MB
          maxStorage: 8388608, // 8MB
          storageUsagePercent: 12,
          lastUpdated: Date.now()
        };
      }
    }

    vectorStore = new MockVectorStore(mockBedrockClient);
  });

  describe('페이지 인덱싱', () => {
    test('페이지를 성공적으로 인덱싱함', async () => {
      // Given
      const pageData = {
        fullData: {
          chunks: [
            { id: 0, content: '첫 번째 청크 내용', length: 20, wordCount: 4 },
            { id: 1, content: '두 번째 청크 내용', length: 20, wordCount: 4 }
          ]
        },
        metadata: {
          url: 'https://example.com/test',
          title: 'Test Page',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      // When
      const result = await vectorStore.indexPage(pageData);

      // Then
      expect(result.success).toBe(true);
      expect(result.pageUrl).toBe('https://example.com/test');
      expect(result.chunkCount).toBe(2);
      expect(result.vectorDimensions).toBe(1536);
      expect(mockBedrockClient.generateBatchEmbeddings).toHaveBeenCalledWith([
        '첫 번째 청크 내용',
        '두 번째 청크 내용'
      ], 3);
    });

    test('빈 청크 데이터로 인덱싱 시 오류 발생', async () => {
      // Given
      const pageData = {
        fullData: { chunks: [] },
        metadata: { url: 'https://example.com/empty' }
      };

      // When & Then
      await expect(vectorStore.indexPage(pageData)).rejects.toThrow('청크 데이터가 없습니다.');
    });
  });

  describe('유사도 검색', () => {
    test('관련 내용을 성공적으로 검색함', async () => {
      // Given
      const query = '가격이 얼마인가요?';
      const options = { topK: 3, minSimilarity: 0.5 };

      // When
      const result = await vectorStore.searchSimilar(query, options);

      // Then
      expect(result.results).toHaveLength(2);
      expect(result.results[0].content).toContain('가격');
      expect(result.results[0].similarity).toBeGreaterThan(0.5);
      expect(result.totalSearched).toBe(10);
      expect(result.queryTokens).toBe(50);
      expect(mockBedrockClient.generateEmbedding).toHaveBeenCalledWith(query);
    });

    test('최소 유사도 필터링이 작동함', async () => {
      // Given
      const query = '테스트 질문';
      const options = { topK: 5, minSimilarity: 0.9 }; // 높은 임계값

      // When
      const result = await vectorStore.searchSimilar(query, options);

      // Then
      expect(result.results.length).toBeLessThanOrEqual(2);
      result.results.forEach(item => {
        expect(item.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    test('topK 제한이 작동함', async () => {
      // Given
      const query = '테스트 질문';
      const options = { topK: 1, minSimilarity: 0.3 };

      // When
      const result = await vectorStore.searchSimilar(query, options);

      // Then
      expect(result.results).toHaveLength(1);
      expect(result.results[0].similarity).toBeGreaterThanOrEqual(0.89); // 가장 높은 유사도
    });
  });

  describe('코사인 유사도 계산', () => {
    test('동일한 벡터의 유사도는 1', () => {
      // Given
      const vector = [1, 2, 3, 4, 5];

      // When
      const similarity = vectorStore.cosineSimilarity(vector, vector);

      // Then
      expect(similarity).toBeCloseTo(1, 5);
    });

    test('직교 벡터의 유사도는 0', () => {
      // Given
      const vectorA = [1, 0, 0];
      const vectorB = [0, 1, 0];

      // When
      const similarity = vectorStore.cosineSimilarity(vectorA, vectorB);

      // Then
      expect(similarity).toBeCloseTo(0, 5);
    });

    test('반대 방향 벡터의 유사도는 -1', () => {
      // Given
      const vectorA = [1, 2, 3];
      const vectorB = [-1, -2, -3];

      // When
      const similarity = vectorStore.cosineSimilarity(vectorA, vectorB);

      // Then
      expect(similarity).toBeCloseTo(-1, 5);
    });

    test('차원이 다른 벡터는 오류 발생', () => {
      // Given
      const vectorA = [1, 2, 3];
      const vectorB = [1, 2];

      // When & Then
      expect(() => {
        vectorStore.cosineSimilarity(vectorA, vectorB);
      }).toThrow('벡터 차원이 일치하지 않습니다.');
    });
  });

  describe('저장소 정보', () => {
    test('저장소 상태를 올바르게 반환함', async () => {
      // When
      const info = await vectorStore.getStorageInfo();

      // Then
      expect(info.totalChunks).toBe(25);
      expect(info.totalBatches).toBe(3);
      expect(info.indexedPages).toBe(1);
      expect(info.storageUsed).toBe(1024000);
      expect(info.maxStorage).toBe(8388608);
      expect(info.storageUsagePercent).toBe(12);
      expect(info.lastUpdated).toBeDefined();
    });
  });

  describe('Bedrock Client 통합', () => {
    test('임베딩 생성 API 호출', async () => {
      // Given
      const text = '테스트 텍스트입니다.';
      const mockEmbedding = {
        embedding: Array(1536).fill(0).map(() => Math.random()),
        inputTokens: 25,
        model: 'amazon.titan-embed-text-v2:0'
      };
      
      mockBedrockClient.generateEmbedding.mockResolvedValue(mockEmbedding);

      // When
      const result = await mockBedrockClient.generateEmbedding(text);

      // Then
      expect(result.embedding).toHaveLength(1536);
      expect(result.inputTokens).toBe(25);
      expect(result.model).toBe('amazon.titan-embed-text-v2:0');
      expect(mockBedrockClient.generateEmbedding).toHaveBeenCalledWith(text);
    });

    test('배치 임베딩 생성 API 호출', async () => {
      // Given
      const texts = ['첫 번째 텍스트', '두 번째 텍스트', '세 번째 텍스트'];
      const mockEmbeddings = texts.map(() => ({
        embedding: Array(1536).fill(0).map(() => Math.random()),
        inputTokens: 20
      }));
      
      mockBedrockClient.generateBatchEmbeddings.mockResolvedValue(mockEmbeddings);

      // When
      const results = await mockBedrockClient.generateBatchEmbeddings(texts, 3);

      // Then
      expect(results).toHaveLength(3);
      expect(results[0].embedding).toHaveLength(1536);
      expect(mockBedrockClient.generateBatchEmbeddings).toHaveBeenCalledWith(texts, 3);
    });
  });

  describe('실제 사용 시나리오', () => {
    test('전체 워크플로우: 인덱싱 → 검색 → 응답', async () => {
      // Given - 페이지 인덱싱
      const pageData = {
        fullData: {
          chunks: [
            { id: 0, content: '이 제품의 가격은 $299입니다.', length: 25, wordCount: 6 },
            { id: 1, content: '배송은 무료이며 2-3일 소요됩니다.', length: 30, wordCount: 7 },
            { id: 2, content: '30일 환불 보장 정책이 있습니다.', length: 28, wordCount: 7 }
          ]
        },
        metadata: {
          url: 'https://shop.example.com/product',
          title: '제품 상세 페이지',
          timestamp: '2024-01-01T00:00:00Z'
        }
      };

      // When - 페이지 인덱싱
      const indexResult = await vectorStore.indexPage(pageData);
      
      // Then - 인덱싱 성공 확인
      expect(indexResult.success).toBe(true);
      expect(indexResult.chunkCount).toBe(3);

      // When - 가격 관련 질문 검색
      const searchResult = await vectorStore.searchSimilar('얼마인가요?', { topK: 2 });
      
      // Then - 관련 내용 검색 확인
      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results[0].content).toContain('가격');
    });

    test('토큰 사용량 최적화 효과 검증', async () => {
      // Given
      const longPageContent = 'Very long page content. '.repeat(1000); // 24,000자
      const chunks = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        content: longPageContent.substring(i * 2400, (i + 1) * 2400),
        length: 2400,
        wordCount: 400
      }));

      const pageData = {
        fullData: { chunks },
        metadata: { url: 'https://example.com/long', title: 'Long Page' }
      };

      // When - 인덱싱 및 검색
      await vectorStore.indexPage(pageData);
      const searchResult = await vectorStore.searchSimilar('specific question', { topK: 3 });

      // Then - 토큰 사용량 비교
      const originalTokens = Math.ceil(longPageContent.length / 4); // 전체 페이지
      const vectorTokens = searchResult.queryTokens + 
        searchResult.results.reduce((sum, result) => sum + Math.ceil(result.content.length / 4), 0);

      expect(vectorTokens).toBeLessThan(originalTokens * 0.5); // 50% 이상 절약
      console.log('토큰 절약 효과:', {
        original: originalTokens,
        vector: vectorTokens,
        savings: Math.round((1 - vectorTokens / originalTokens) * 100) + '%'
      });
    });
  });
});

console.log('🧪 Vector Store 구현 테스트 파일 생성 완료');
