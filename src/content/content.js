/**
 * AWS AI Assistant Content Script
 * 웹페이지 분석 및 컨텍스트 추출
 */

// 전역 변수
let pageAnalyzer = null;
let isInitialized = false;
let messageListener = null;

/**
 * Content Script 초기화
 */
async function initializeContentScript() {
    if (isInitialized) return;
    
    try {
        console.log('🚀 Content Script 초기화 시작:', window.location.href);
        
        // 페이지 분석기 초기화
        pageAnalyzer = new PageAnalyzer();
        
        // 메시지 리스너 설정
        setupMessageListener();
        
        // 자동 분석 설정 확인
        try {
            const settings = await chrome.storage.sync.get(['autoAnalyze']);
            if (settings.autoAnalyze !== false) {
                await performAutoAnalysis();
            }
        } catch (storageError) {
            console.warn('⚠️ Storage 접근 실패, 자동 분석 건너뜀:', storageError);
        }
        
        isInitialized = true;
        console.log('✅ Content Script 초기화 완료');
        
        // 초기화 완료 신호 전송
        try {
            chrome.runtime.sendMessage({
                type: 'CONTENT_SCRIPT_READY',
                url: window.location.href,
                title: document.title
            });
        } catch (runtimeError) {
            console.warn('⚠️ Runtime 메시지 전송 실패:', runtimeError);
        }
        
    } catch (error) {
        console.error('❌ Content Script 초기화 실패:', error);
        isInitialized = false;
    }
}

/**
 * 메시지 리스너 설정
 */
function setupMessageListener() {
    // 기존 리스너 제거
    if (messageListener) {
        chrome.runtime.onMessage.removeListener(messageListener);
    }
    
    // 새 리스너 설정
    messageListener = (request, sender, sendResponse) => {
        console.log('📨 Content Script 메시지 수신:', request.type);
        
        // 비동기 응답을 위해 true 반환
        handleMessage(request, sender, sendResponse);
        return true;
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
}

/**
 * 메시지 처리
 */
async function handleMessage(request, sender, sendResponse) {
    try {
        switch (request.type) {
            case 'EXTRACT_PAGE_CONTENT':
                await handleExtractPageContent(sendResponse);
                break;
                
            case 'PING':
                sendResponse({ success: true, message: 'Content Script is alive' });
                break;
                
            case 'GET_PAGE_INFO':
                sendResponse({
                    success: true,
                    info: {
                        url: window.location.href,
                        title: document.title,
                        domain: window.location.hostname,
                        isInitialized: isInitialized
                    }
                });
                break;
                
            case 'ANALYZE_PAGE':
                await handleAnalyzePage(sendResponse);
                break;
                
            case 'GET_PAGE_SUMMARY':
                handleGetPageSummary(request.maxLength, sendResponse);
                break;
                
            default:
                console.warn('⚠️ 알 수 없는 메시지 타입:', request.type);
                sendResponse({ success: false, error: '알 수 없는 메시지 타입' });
        }
    } catch (error) {
        console.error('❌ 메시지 처리 실패:', error);
        sendResponse({ success: false, error: error.message });
    }
}

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
            metadata: {
                url: window.location.href,
                title: document.title,
                domain: window.location.hostname,
                timestamp: new Date().toISOString()
            }
        });
        
        console.log('✅ 페이지 내용 추출 완료');
        
    } catch (error) {
        console.error('❌ 페이지 내용 추출 실패:', error);
        sendResponse({
            success: false,
            error: error.message,
            fallback: {
                title: document.title,
                url: window.location.href,
                domain: window.location.hostname
            }
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
            links: this.extractLinks()
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
     * 메타데이터 추출
     */
    extractMetadata() {
        const metadata = {
            description: '',
            keywords: '',
            author: '',
            ogTitle: '',
            ogDescription: ''
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
     * 캐시 키 생성
     */
    generateCacheKey(url, title) {
        return `${url}_${title}_${Date.now()}`.substring(0, 100);
    }

    /**
     * 페이지 내용을 텍스트로 요약
     */
    getPageSummary(maxLength = 2000) {
        if (!this.lastAnalysis) {
            // 분석이 없으면 기본 텍스트 추출
            const bodyText = document.body ? document.body.innerText.slice(0, maxLength) : '';
            return `페이지 제목: ${document.title}\nURL: ${window.location.href}\n\n내용:\n${bodyText}`;
        }
        
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
        
        console.log('✅ 자동 페이지 분석 완료');
        
    } catch (error) {
        console.error('❌ 자동 페이지 분석 실패:', error);
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
