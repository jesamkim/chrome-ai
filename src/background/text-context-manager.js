/**
 * 텍스트 컨텍스트 관리자
 * Vector Store를 대체하는 경량화된 텍스트 기반 컨텍스트 시스템
 */

class TextContextManager {
    constructor() {
        this.maxTokens = 6000; // Claude 모델 토큰 제한의 75% 사용
        this.approximateTokenRatio = 4; // 1 토큰 ≈ 4 글자 (한국어/영어 혼합)
        this.maxContextLength = this.maxTokens * this.approximateTokenRatio;
        
        // 우선순위 기반 텍스트 섹션
        this.prioritySections = [
            'title',
            'headings',
            'mainContent',
            'lists',
            'tables',
            'metadata'
        ];
    }

    /**
     * 페이지 텍스트를 컨텍스트로 압축
     */
    compressPageToContext(pageData) {
        console.log('📝 페이지 텍스트 압축 시작');
        
        try {
            const { metadata, content, fullText, statistics } = pageData;
            
            // 1. 구조화된 컨텍스트 생성
            const structuredContext = this.createStructuredContext(metadata, content);
            
            // 2. 토큰 제한에 맞춰 압축
            const compressedContext = this.fitToTokenLimit(structuredContext, fullText);
            
            // 3. 최종 컨텍스트 포맷팅
            const finalContext = this.formatContext(compressedContext, metadata);
            
            console.log('✅ 텍스트 압축 완료:', {
                originalLength: fullText.length,
                compressedLength: finalContext.length,
                compressionRatio: fullText.length > 0 ? 
                    `${Math.round((1 - finalContext.length / fullText.length) * 100)}%` : 
                    '0%',
                estimatedTokens: Math.ceil(finalContext.length / this.approximateTokenRatio)
            });
            
            return {
                context: finalContext,
                metadata: {
                    url: metadata.url,
                    title: metadata.title,
                    originalLength: fullText.length,
                    compressedLength: finalContext.length,
                    estimatedTokens: Math.ceil(finalContext.length / this.approximateTokenRatio),
                    compressionRatio: fullText.length > 0 ? 
                        Math.round((1 - finalContext.length / fullText.length) * 100) : 0
                }
            };
            
        } catch (error) {
            console.error('❌ 텍스트 압축 실패:', error);
            throw error;
        }
    }

    /**
     * 구조화된 컨텍스트 생성
     */
    createStructuredContext(metadata, content) {
        const sections = {};
        
        // 제목 (최고 우선순위)
        sections.title = `제목: ${metadata.title}`;
        
        // 헤딩 추출
        sections.headings = this.extractHeadings(content.headings);
        
        // 메인 콘텐츠 추출
        sections.mainContent = this.extractMainContent(content.paragraphs);
        
        // 리스트 추출
        sections.lists = this.extractLists(content.lists);
        
        // 테이블 추출
        sections.tables = this.extractTables(content.tables);
        
        // 메타데이터
        sections.metadata = this.extractMetadataText(metadata);
        
        return sections;
    }

    /**
     * 헤딩 추출 및 정리
     */
    extractHeadings(headings) {
        if (!headings || headings.length === 0) return '';
        
        const headingText = headings
            .slice(0, 10) // 최대 10개 헤딩
            .map(h => `${h.level}. ${h.text}`)
            .join('\n');
            
        return headingText ? `\n주요 섹션:\n${headingText}` : '';
    }

    /**
     * 메인 콘텐츠 추출
     */
    extractMainContent(paragraphs) {
        if (!paragraphs || paragraphs.length === 0) return '';
        
        // 문단을 길이순으로 정렬하여 중요한 내용 우선 선택
        const sortedParagraphs = paragraphs
            .filter(p => p && p.length > 50) // 너무 짧은 문단 제외
            .sort((a, b) => b.length - a.length)
            .slice(0, 20); // 최대 20개 문단
            
        const contentText = sortedParagraphs.join('\n\n');
        return contentText ? `\n주요 내용:\n${contentText}` : '';
    }

    /**
     * 리스트 추출
     */
    extractLists(lists) {
        if (!lists || lists.length === 0) return '';
        
        const listText = lists
            .slice(0, 5) // 최대 5개 리스트
            .map(list => list.items.slice(0, 10).join('\n- ')) // 각 리스트당 최대 10개 항목
            .join('\n\n');
            
        return listText ? `\n목록:\n- ${listText}` : '';
    }

    /**
     * 테이블 추출
     */
    extractTables(tables) {
        if (!tables || tables.length === 0) return '';
        
        const tableText = tables
            .slice(0, 3) // 최대 3개 테이블
            .map(table => {
                const headers = table.headers ? table.headers.join(' | ') : '';
                const rows = table.rows ? table.rows.slice(0, 5).map(row => row.join(' | ')).join('\n') : '';
                return headers ? `${headers}\n${rows}` : rows;
            })
            .join('\n\n');
            
        return tableText ? `\n표 데이터:\n${tableText}` : '';
    }

    /**
     * 메타데이터 텍스트 추출
     */
    extractMetadataText(metadata) {
        const metaParts = [];
        
        if (metadata.description) {
            metaParts.push(`설명: ${metadata.description}`);
        }
        
        if (metadata.keywords) {
            metaParts.push(`키워드: ${metadata.keywords}`);
        }
        
        metaParts.push(`URL: ${metadata.url}`);
        
        return metaParts.length > 0 ? `\n페이지 정보:\n${metaParts.join('\n')}` : '';
    }

    /**
     * 토큰 제한에 맞춰 컨텍스트 압축
     */
    fitToTokenLimit(sections, fallbackText) {
        let totalLength = 0;
        const result = {};
        
        // 우선순위 순서대로 섹션 추가
        for (const sectionName of this.prioritySections) {
            const sectionText = sections[sectionName] || '';
            
            if (totalLength + sectionText.length <= this.maxContextLength) {
                result[sectionName] = sectionText;
                totalLength += sectionText.length;
            } else {
                // 남은 공간에 맞춰 섹션 일부만 포함
                const remainingSpace = this.maxContextLength - totalLength;
                if (remainingSpace > 100) { // 최소 100자는 있어야 의미있음
                    result[sectionName] = sectionText.substring(0, remainingSpace - 10) + '...';
                    totalLength += remainingSpace - 10 + 3; // '...' 길이 포함
                }
                break;
            }
        }
        
        // 구조화된 섹션으로 충분하지 않으면 원본 텍스트 사용
        if (totalLength < this.maxContextLength * 0.5 && fallbackText) {
            const remainingSpace = this.maxContextLength - totalLength;
            if (remainingSpace > 100) {
                result.additionalContent = fallbackText.substring(0, remainingSpace - 10);
                totalLength += remainingSpace - 10;
            }
        }
        
        return result;
    }

    /**
     * 최종 컨텍스트 포맷팅
     */
    formatContext(sections, metadata) {
        const contextParts = [];
        
        // 페이지 기본 정보
        contextParts.push(`=== 웹페이지 분석 ===`);
        contextParts.push(`페이지: ${metadata.title}`);
        contextParts.push(`URL: ${metadata.url}`);
        contextParts.push(`언어: ${metadata.language || '알 수 없음'}`);
        contextParts.push('');
        
        // 각 섹션 추가
        for (const [sectionName, content] of Object.entries(sections)) {
            if (content && content.trim()) {
                contextParts.push(content.trim());
                contextParts.push('');
            }
        }
        
        contextParts.push('=== 분석 완료 ===');
        
        let finalContext = contextParts.join('\n');
        
        // 최대 길이 초과 시 강제 자르기
        if (finalContext.length > this.maxContextLength) {
            finalContext = finalContext.substring(0, this.maxContextLength - 10) + '...[생략]';
        }
        
        return finalContext;
    }

    /**
     * 컨텍스트 통계 정보
     */
    getContextStats(context) {
        return {
            length: context.length,
            estimatedTokens: Math.ceil(context.length / this.approximateTokenRatio),
            lines: context.split('\n').length,
            words: context.split(/\s+/).length
        };
    }
}

// Service Worker 환경에서 사용할 수 있도록 globalThis에 등록
if (typeof globalThis !== 'undefined') {
    globalThis.TextContextManager = TextContextManager;
}

// Chrome Extension 환경에서만 window 사용
if (typeof window !== 'undefined') {
    window.TextContextManager = TextContextManager;
}

// Node.js 환경에서는 module.exports 사용
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TextContextManager;
}
