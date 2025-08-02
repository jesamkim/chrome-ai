/**
 * Vector Store 클래스
 * 텍스트 청크를 벡터로 변환하여 저장하고 의미적 유사성 검색 제공
 */

class VectorStore {
    constructor(bedrockClient) {
        this.bedrockClient = bedrockClient;
        this.vectors = new Map(); // 메모리 캐시
        this.storageKey = 'vectorStore';
        this.metadataKey = 'vectorStoreMetadata';
        this.maxStorageSize = 8 * 1024 * 1024; // 8MB 제한
    }

    /**
     * 페이지 텍스트를 벡터화하여 저장
     */
    async indexPage(pageData) {
        try {
            console.log('🔍 페이지 벡터화 시작:', pageData.metadata.url);
            
            const { fullData, metadata } = pageData;
            const { chunks } = fullData;
            
            if (!chunks || chunks.length === 0) {
                throw new Error('청크 데이터가 없습니다.');
            }

            // 기존 페이지 데이터 제거
            await this.removePage(metadata.url);

            // 청크별 임베딩 생성
            const vectorChunks = [];
            const batchSize = 3; // 작은 배치로 처리
            
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                console.log(`📊 임베딩 생성 진행: ${i + 1}-${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
                
                const batchTexts = batch.map(chunk => chunk.content);
                const embeddings = await this.bedrockClient.generateBatchEmbeddings(batchTexts, batchSize);
                
                // 벡터 청크 생성
                for (let j = 0; j < batch.length; j++) {
                    const chunk = batch[j];
                    const embedding = embeddings[j];
                    
                    const vectorChunk = {
                        id: `${this.generatePageId(metadata.url)}_chunk_${chunk.id}`,
                        content: chunk.content,
                        vector: embedding.embedding,
                        metadata: {
                            pageUrl: metadata.url,
                            pageTitle: metadata.title,
                            chunkIndex: chunk.id,
                            chunkLength: chunk.length,
                            wordCount: chunk.wordCount,
                            timestamp: metadata.timestamp
                        }
                    };
                    
                    vectorChunks.push(vectorChunk);
                }
            }

            // 저장소에 저장
            await this.saveVectorChunks(vectorChunks);
            
            // 페이지 메타데이터 저장
            await this.savePageMetadata({
                pageUrl: metadata.url,
                pageTitle: metadata.title,
                chunkCount: vectorChunks.length,
                totalTokens: vectorChunks.reduce((sum, chunk) => sum + chunk.content.length / 4, 0),
                indexedAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString()
            });

            console.log('✅ 페이지 벡터화 완료:', {
                url: metadata.url,
                chunkCount: vectorChunks.length,
                totalVectors: vectorChunks.length
            });

            return {
                success: true,
                pageUrl: metadata.url,
                chunkCount: vectorChunks.length,
                vectorDimensions: vectorChunks[0]?.vector.length || 0
            };

        } catch (error) {
            console.error('❌ 페이지 벡터화 실패:', error);
            throw error;
        }
    }

    /**
     * 질문과 유사한 청크들 검색
     */
    async searchSimilar(query, options = {}) {
        try {
            const {
                topK = 5,
                minSimilarity = 0.3,
                pageUrl = null,
                includeMetadata = true
            } = options;

            console.log('🔍 유사도 검색 시작:', query.substring(0, 100));

            // 질문을 벡터로 변환
            const queryEmbedding = await this.bedrockClient.generateEmbedding(query);
            const queryVector = queryEmbedding.embedding;

            // 저장된 벡터들 로드
            const vectorChunks = await this.loadVectorChunks(pageUrl);
            
            if (vectorChunks.length === 0) {
                return {
                    results: [],
                    totalSearched: 0,
                    queryTokens: queryEmbedding.inputTokens
                };
            }

            // 유사도 계산
            const similarities = vectorChunks.map(chunk => ({
                ...chunk,
                similarity: this.cosineSimilarity(queryVector, chunk.vector)
            }));

            // 유사도 기준으로 정렬 및 필터링
            const results = similarities
                .filter(item => item.similarity >= minSimilarity)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, topK)
                .map(item => ({
                    id: item.id,
                    content: item.content,
                    similarity: Math.round(item.similarity * 1000) / 1000, // 소수점 3자리
                    metadata: includeMetadata ? item.metadata : undefined
                }));

            console.log('✅ 유사도 검색 완료:', {
                query: query.substring(0, 50) + '...',
                totalSearched: vectorChunks.length,
                resultsFound: results.length,
                topSimilarity: results[0]?.similarity || 0
            });

            return {
                results: results,
                totalSearched: vectorChunks.length,
                queryTokens: queryEmbedding.inputTokens,
                searchTime: Date.now()
            };

        } catch (error) {
            console.error('❌ 유사도 검색 실패:', error);
            throw error;
        }
    }

    /**
     * 코사인 유사도 계산
     */
    cosineSimilarity(vectorA, vectorB) {
        if (vectorA.length !== vectorB.length) {
            throw new Error('벡터 차원이 일치하지 않습니다.');
        }

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

        if (normA === 0 || normB === 0) {
            return 0;
        }

        return dotProduct / (normA * normB);
    }

    /**
     * 벡터 청크들을 Chrome Storage에 저장
     */
    async saveVectorChunks(vectorChunks) {
        try {
            // 청크를 작은 배치로 나누어 저장 (Chrome Storage 제한 고려)
            const batchSize = 10;
            const batches = [];
            
            for (let i = 0; i < vectorChunks.length; i += batchSize) {
                batches.push(vectorChunks.slice(i, i + batchSize));
            }

            for (let i = 0; i < batches.length; i++) {
                const batch = batches[i];
                const batchKey = `${this.storageKey}_batch_${i}`;
                
                await chrome.storage.local.set({
                    [batchKey]: {
                        chunks: batch,
                        batchIndex: i,
                        totalBatches: batches.length,
                        timestamp: Date.now()
                    }
                });
            }

            // 배치 인덱스 저장
            await chrome.storage.local.set({
                [`${this.storageKey}_index`]: {
                    totalBatches: batches.length,
                    totalChunks: vectorChunks.length,
                    lastUpdated: Date.now()
                }
            });

            // 메모리 캐시 업데이트
            vectorChunks.forEach(chunk => {
                this.vectors.set(chunk.id, chunk);
            });

        } catch (error) {
            console.error('❌ 벡터 저장 실패:', error);
            throw error;
        }
    }

    /**
     * Chrome Storage에서 벡터 청크들 로드
     */
    async loadVectorChunks(pageUrl = null) {
        try {
            // 인덱스 정보 로드
            const indexResult = await chrome.storage.local.get([`${this.storageKey}_index`]);
            const indexData = indexResult[`${this.storageKey}_index`];
            
            if (!indexData) {
                return [];
            }

            const allChunks = [];
            
            // 모든 배치 로드
            for (let i = 0; i < indexData.totalBatches; i++) {
                const batchKey = `${this.storageKey}_batch_${i}`;
                const batchResult = await chrome.storage.local.get([batchKey]);
                const batchData = batchResult[batchKey];
                
                if (batchData && batchData.chunks) {
                    allChunks.push(...batchData.chunks);
                }
            }

            // 특정 페이지 필터링
            if (pageUrl) {
                return allChunks.filter(chunk => 
                    chunk.metadata.pageUrl === pageUrl
                );
            }

            return allChunks;

        } catch (error) {
            console.error('❌ 벡터 로드 실패:', error);
            return [];
        }
    }

    /**
     * 페이지 메타데이터 저장
     */
    async savePageMetadata(metadata) {
        try {
            const existingResult = await chrome.storage.local.get([this.metadataKey]);
            const existingMetadata = existingResult[this.metadataKey] || {};
            
            const pageId = this.generatePageId(metadata.pageUrl);
            existingMetadata[pageId] = metadata;
            
            await chrome.storage.local.set({
                [this.metadataKey]: existingMetadata
            });
            
        } catch (error) {
            console.error('❌ 메타데이터 저장 실패:', error);
        }
    }

    /**
     * 페이지 제거
     */
    async removePage(pageUrl) {
        try {
            const pageId = this.generatePageId(pageUrl);
            
            // 벡터 청크들 제거
            const chunks = await this.loadVectorChunks(pageUrl);
            const chunkIds = chunks.map(chunk => chunk.id);
            
            // 메모리 캐시에서 제거
            chunkIds.forEach(id => {
                this.vectors.delete(id);
            });
            
            // 메타데이터에서 제거
            const metadataResult = await chrome.storage.local.get([this.metadataKey]);
            const metadata = metadataResult[this.metadataKey] || {};
            delete metadata[pageId];
            
            await chrome.storage.local.set({
                [this.metadataKey]: metadata
            });
            
            console.log('🗑️ 페이지 벡터 데이터 제거 완료:', pageUrl);
            
        } catch (error) {
            console.error('❌ 페이지 제거 실패:', error);
        }
    }

    /**
     * 저장소 상태 조회
     */
    async getStorageInfo() {
        try {
            const indexResult = await chrome.storage.local.get([`${this.storageKey}_index`]);
            const metadataResult = await chrome.storage.local.get([this.metadataKey]);
            
            const indexData = indexResult[`${this.storageKey}_index`];
            const metadata = metadataResult[this.metadataKey] || {};
            
            const storageUsed = await this.calculateStorageUsage();
            
            return {
                totalChunks: indexData?.totalChunks || 0,
                totalBatches: indexData?.totalBatches || 0,
                indexedPages: Object.keys(metadata).length,
                storageUsed: storageUsed,
                maxStorage: this.maxStorageSize,
                storageUsagePercent: Math.round((storageUsed / this.maxStorageSize) * 100),
                lastUpdated: indexData?.lastUpdated || null
            };
            
        } catch (error) {
            console.error('❌ 저장소 정보 조회 실패:', error);
            return null;
        }
    }

    /**
     * 저장소 사용량 계산
     */
    async calculateStorageUsage() {
        try {
            const result = await chrome.storage.local.get(null);
            const jsonString = JSON.stringify(result);
            return new Blob([jsonString]).size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * 페이지 ID 생성
     */
    generatePageId(url) {
        return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
    }

    /**
     * 저장소 정리 (오래된 데이터 제거)
     */
    async cleanup(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7일
        try {
            const metadataResult = await chrome.storage.local.get([this.metadataKey]);
            const metadata = metadataResult[this.metadataKey] || {};
            
            const now = Date.now();
            const pagesToRemove = [];
            
            for (const [pageId, pageData] of Object.entries(metadata)) {
                const lastAccessed = new Date(pageData.lastAccessed).getTime();
                if (now - lastAccessed > maxAge) {
                    pagesToRemove.push(pageData.pageUrl);
                }
            }
            
            for (const pageUrl of pagesToRemove) {
                await this.removePage(pageUrl);
            }
            
            console.log('🧹 저장소 정리 완료:', {
                removedPages: pagesToRemove.length,
                remainingPages: Object.keys(metadata).length - pagesToRemove.length
            });
            
        } catch (error) {
            console.error('❌ 저장소 정리 실패:', error);
        }
    }
}

// Service Worker 환경에서 사용할 수 있도록 globalThis에 등록
if (typeof globalThis !== 'undefined') {
    globalThis.VectorStore = VectorStore;
}

// Chrome Extension 환경에서만 window 사용
if (typeof window !== 'undefined') {
    window.VectorStore = VectorStore;
}

// Node.js 환경에서는 module.exports 사용
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VectorStore;
}
