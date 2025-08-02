/**
 * Claude AI Assistant Content Script
 * 웹페이지 분석 및 컨텍스트 추출
 */

// 전역 변수
let pageAnalyzer = null;
let isInitialized = false;

/**
 * Content Script 초기화
 */
async function initializeContentScript() {
    if (isInitialized) return;
    
    try {
        console.log('🚀 Content Script 초기화 시작:', window.location.href);
        
        // 페이지 분석기 초기화
        pageAnalyzer = new PageAnalyzer();
        
        // 자동 분석 설정 확인
        const settings = await chrome.storage.sync.get(['autoAnalyze']);
        if (settings.autoAnalyze !== false) {
            await performAutoAnalysis();
        }
        
        isInitialized = true;
        console.log('✅ Content Script 초기화 완료');
        
    } catch (error) {
        console.error('❌ Content Script 초기화 실패:', error);
    }
}

/**
 * 페이지 분석기 클래스
 */
class PageAnalyzer {
    constructor() {
        this.lastAnalysis = null;
        this.analysisCache = new Map();
    }

    /**
     * 현재 페이지 분석
     */
    async analyzeCurrentPage() {
        const url = window.location.href;
        const cacheKey = this.generateCacheKey(url, document.title);
        
        // 캐시 확인
        if (this.analysisCache.has(cacheKey)) {
            console.log('📋 캐시된 분석 결과 사용');
            return this.analysisCache.get(cacheKey);
        }
        
        try {
            console.log('🔍 페이지 분석 시작:', url);
            
            const analysis = {
                url: url,
                title: document.title,
                content: this.extractStructuredContent(),
                metadata: this.extractMetadata(),
                language: this.detectLanguage(),
                readability: this.calculateReadability(),
                timestamp: Date.now()
            };
            
            // 캐시 저장 (최대 10개)
            if (this.analysisCache.size >= 10) {
                const firstKey = this.analysisCache.keys().next().value;
                this.analysisCache.delete(firstKey);
            }
            this.analysisCache.set(cacheKey, analysis);
            
            this.lastAnalysis = analysis;
            console.log('✅ 페이지 분석 완료');
            
            return analysis;
            
        } catch (error) {
            console.error('❌ 페이지 분석 실패:', error);
            throw error;
        }
    }

    /**
     * 구조화된 콘텐츠 추출
     */
    extractStructuredContent() {
        return {
            headings: this.extractHeadings(),
            paragraphs: this.extractParagraphs(),
            lists: this.extractLists(),
            tables: this.extractTables(),
            links: this.extractLinks(),
            images: this.extractImages(),
            codeBlocks: this.extractCodeBlocks()
        };
    }

    /**
     * 제목 추출 (H1-H6)
     */
    extractHeadings() {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach((element, index) => {
            if (index < 20) { // 최대 20개
                headings.push({
                    level: parseInt(element.tagName.charAt(1)),
                    text: element.textContent.trim(),
                    id: element.id || null
                });
            }
        });
        
        return headings;
    }

    /**
     * 단락 추출
     */
    extractParagraphs() {
        const paragraphs = [];
        const paragraphElements = document.querySelectorAll('p, div.content, article p');
        
        paragraphElements.forEach((element, index) => {
            if (index < 50) { // 최대 50개
                const text = element.textContent.trim();
                if (text.length > 20) { // 의미있는 길이의 텍스트만
                    paragraphs.push({
                        text: text.substring(0, 500), // 최대 500자
                        length: text.length
                    });
                }
            }
        });
        
        return paragraphs;
    }

    /**
     * 목록 추출
     */
    extractLists() {
        const lists = [];
        const listElements = document.querySelectorAll('ul, ol');
        
        listElements.forEach((element, index) => {
            if (index < 10) { // 최대 10개
                const items = Array.from(element.querySelectorAll('li')).map(li => 
                    li.textContent.trim().substring(0, 200)
                );
                
                if (items.length > 0) {
                    lists.push({
                        type: element.tagName.toLowerCase(),
                        items: items.slice(0, 10) // 최대 10개 항목
                    });
                }
            }
        });
        
        return lists;
    }

    /**
     * 테이블 추출
     */
    extractTables() {
        const tables = [];
        const tableElements = document.querySelectorAll('table');
        
        tableElements.forEach((element, index) => {
            if (index < 5) { // 최대 5개
                const headers = Array.from(element.querySelectorAll('th')).map(th => 
                    th.textContent.trim()
                );
                
                const rows = Array.from(element.querySelectorAll('tr')).slice(0, 10).map(tr => 
                    Array.from(tr.querySelectorAll('td')).map(td => 
                        td.textContent.trim().substring(0, 100)
                    )
                ).filter(row => row.length > 0);
                
                if (headers.length > 0 || rows.length > 0) {
                    tables.push({ headers, rows });
                }
            }
        });
        
        return tables;
    }

    /**
     * 링크 추출
     */
    extractLinks() {
        const links = [];
        const linkElements = document.querySelectorAll('a[href]');
        
        linkElements.forEach((element, index) => {
            if (index < 20) { // 최대 20개
                const href = element.href;
                const text = element.textContent.trim();
                
                if (text.length > 0 && href.startsWith('http')) {
                    links.push({
                        url: href,
                        text: text.substring(0, 100),
                        isExternal: !href.includes(window.location.hostname)
                    });
                }
            }
        });
        
        return links;
    }

    /**
     * 이미지 추출
     */
    extractImages() {
        const images = [];
        const imageElements = document.querySelectorAll('img[src]');
        
        imageElements.forEach((element, index) => {
            if (index < 10) { // 최대 10개
                images.push({
                    src: element.src,
                    alt: element.alt || '',
                    title: element.title || '',
                    width: element.naturalWidth || element.width,
                    height: element.naturalHeight || element.height
                });
            }
        });
        
        return images;
    }

    /**
     * 코드 블록 추출
     */
    extractCodeBlocks() {
        const codeBlocks = [];
        const codeElements = document.querySelectorAll('pre code, code, .highlight');
        
        codeElements.forEach((element, index) => {
            if (index < 10) { // 최대 10개
                const code = element.textContent.trim();
                if (code.length > 10) {
                    codeBlocks.push({
                        code: code.substring(0, 1000), // 최대 1000자
                        language: this.detectCodeLanguage(element),
                        length: code.length
                    });
                }
            }
        });
        
        return codeBlocks;
    }

    /**
     * 메타데이터 추출
     */
    extractMetadata() {
        const metadata = {
            description: '',
            keywords: '',
            author: '',
            publishDate: '',
            modifiedDate: '',
            ogTitle: '',
            ogDescription: '',
            ogImage: ''
        };

        // Meta 태그에서 정보 추출
        const metaTags = document.querySelectorAll('meta');
        metaTags.forEach(meta => {
            const name = meta.getAttribute('name') || meta.getAttribute('property');
            const content = meta.getAttribute('content');
            
            if (name && content) {
                switch (name.toLowerCase()) {
                    case 'description':
                        metadata.description = content;
                        break;
                    case 'keywords':
                        metadata.keywords = content;
                        break;
                    case 'author':
                        metadata.author = content;
                        break;
                    case 'og:title':
                        metadata.ogTitle = content;
                        break;
                    case 'og:description':
                        metadata.ogDescription = content;
                        break;
                    case 'og:image':
                        metadata.ogImage = content;
                        break;
                }
            }
        });

        return metadata;
    }

    /**
     * 언어 감지
     */
    detectLanguage() {
        // HTML lang 속성 확인
        const htmlLang = document.documentElement.lang;
        if (htmlLang) return htmlLang;

        // 텍스트 기반 언어 감지 (간단한 휴리스틱)
        const text = document.body.textContent.substring(0, 1000);
        const koreanPattern = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
        const englishPattern = /[a-zA-Z]/;
        
        if (koreanPattern.test(text)) return 'ko';
        if (englishPattern.test(text)) return 'en';
        
        return 'unknown';
    }

    /**
     * 가독성 점수 계산
     */
    calculateReadability() {
        const text = document.body.textContent;
        const sentences = text.split(/[.!?]+/).length;
        const words = text.split(/\s+/).length;
        const characters = text.length;
        
        return {
            sentences: sentences,
            words: words,
            characters: characters,
            avgWordsPerSentence: sentences > 0 ? Math.round(words / sentences) : 0,
            avgCharsPerWord: words > 0 ? Math.round(characters / words) : 0
        };
    }

    /**
     * 코드 언어 감지
     */
    detectCodeLanguage(element) {
        // 클래스명에서 언어 추출
        const className = element.className;
        const langMatch = className.match(/language-(\w+)|lang-(\w+)|(\w+)-code/);
        if (langMatch) {
            return langMatch[1] || langMatch[2] || langMatch[3];
        }
        
        // 부모 요소 확인
        const parent = element.parentElement;
        if (parent && parent.className) {
            const parentLangMatch = parent.className.match(/language-(\w+)|lang-(\w+)/);
            if (parentLangMatch) {
                return parentLangMatch[1] || parentLangMatch[2];
            }
        }
        
        return 'unknown';
    }

    /**
     * 캐시 키 생성
     */
    generateCacheKey(url, title) {
        return `${url}_${title}_${Date.now()}`.substring(0, 100);
    }

    /**
     * 페이지 내용을 텍스트로 요약
     */
    getPageSummary(maxLength = 2000) {
        if (!this.lastAnalysis) return '';
        
        const { content, metadata } = this.lastAnalysis;
        let summary = '';
        
        // 제목 추가
        if (content.headings.length > 0) {
            summary += '주요 제목:\n';
            content.headings.slice(0, 5).forEach(h => {
                summary += `${'#'.repeat(h.level)} ${h.text}\n`;
            });
            summary += '\n';
        }
        
        // 설명 추가
        if (metadata.description) {
            summary += `설명: ${metadata.description}\n\n`;
        }
        
        // 주요 내용 추가
        if (content.paragraphs.length > 0) {
            summary += '주요 내용:\n';
            content.paragraphs.slice(0, 3).forEach(p => {
                summary += `${p.text}\n\n`;
            });
        }
        
        return summary.substring(0, maxLength);
    }
}

/**
 * 자동 분석 수행
 */
async function performAutoAnalysis() {
    try {
        console.log('🔄 자동 페이지 분석 시작');
        
        const analysis = await pageAnalyzer.analyzeCurrentPage();
        
        // 통계 업데이트
        await updateStatistics('analyzedPages');
        
        console.log('✅ 자동 페이지 분석 완료');
        
    } catch (error) {
        console.error('❌ 자동 페이지 분석 실패:', error);
    }
}

/**
 * 통계 업데이트
 */
async function updateStatistics(type, value = 1) {
    try {
        const stats = await chrome.storage.local.get([type, 'lastUsed']);
        const currentValue = stats[type] || 0;
        
        await chrome.storage.local.set({
            [type]: currentValue + value,
            lastUsed: Date.now()
        });
        
    } catch (error) {
        console.error('통계 업데이트 실패:', error);
    }
}

/**
 * 메시지 처리
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Content Script 메시지 수신:', request.type);
    
    switch (request.type) {
        case 'EXTRACT_PAGE_CONTENT':
            handleExtractPageContent(sendResponse);
            break;
        
        case 'ANALYZE_PAGE':
            handleAnalyzePage(sendResponse);
            break;
        
        case 'GET_PAGE_SUMMARY':
            handleGetPageSummary(request.maxLength, sendResponse);
            break;
        
        default:
            console.warn('⚠️ 알 수 없는 메시지 타입:', request.type);
            sendResponse({ success: false, error: '알 수 없는 요청 타입' });
    }
    
    return true; // 비동기 응답
});

/**
 * 페이지 내용 추출 처리
 */
async function handleExtractPageContent(sendResponse) {
    try {
        if (!pageAnalyzer) {
            pageAnalyzer = new PageAnalyzer();
        }
        
        const analysis = await pageAnalyzer.analyzeCurrentPage();
        const summary = pageAnalyzer.getPageSummary();
        
        sendResponse({
            success: true,
            content: summary,
            fullAnalysis: analysis
        });
        
    } catch (error) {
        console.error('페이지 내용 추출 실패:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * 페이지 분석 처리
 */
async function handleAnalyzePage(sendResponse) {
    try {
        if (!pageAnalyzer) {
            pageAnalyzer = new PageAnalyzer();
        }
        
        const analysis = await pageAnalyzer.analyzeCurrentPage();
        
        sendResponse({
            success: true,
            analysis: analysis
        });
        
    } catch (error) {
        console.error('페이지 분석 실패:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

/**
 * 페이지 요약 처리
 */
function handleGetPageSummary(maxLength, sendResponse) {
    try {
        if (!pageAnalyzer || !pageAnalyzer.lastAnalysis) {
            sendResponse({
                success: false,
                error: '페이지가 아직 분석되지 않았습니다.'
            });
            return;
        }
        
        const summary = pageAnalyzer.getPageSummary(maxLength);
        
        sendResponse({
            success: true,
            summary: summary
        });
        
    } catch (error) {
        console.error('페이지 요약 실패:', error);
        sendResponse({
            success: false,
            error: error.message
        });
    }
}

// DOM 로드 완료 시 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

// 페이지 변경 감지 (SPA 대응)
let lastUrl = window.location.href;
new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        console.log('🔄 페이지 변경 감지:', currentUrl);
        
        // 잠시 후 재분석
        setTimeout(() => {
            if (pageAnalyzer) {
                performAutoAnalysis();
            }
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });

console.log('🎯 Content Script 로드 완료');
