/**
 * AWS AI Assistant Content Script
 * 웹페이지 분석 및 컨텍스트 추출
 */

// 중복 로드 방지
if (window.awsAiAssistantLoaded) {
    console.log('⚠️ Content Script 이미 로드됨, 중복 로드 방지');
} else {
    window.awsAiAssistantLoaded = true;

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
 * 페이지 내용 추출 처리 (향상된 버전)
 */
async function handleExtractPageContent(sendResponse) {
    try {
        console.log('🔍 향상된 페이지 내용 추출 시작');
        
        // 향상된 텍스트 추출기 사용
        const extractor = new EnhancedTextExtractor();
        const extractedData = extractor.extractFullPageText();
        
        // 텍스트 청킹
        const chunks = extractor.chunkText(extractedData.fullText, 1000, 100);
        
        // 요약 생성 (전체 텍스트 기반)
        const summary = this.generateComprehensiveSummary(extractedData);
        
        console.log('✅ 향상된 페이지 내용 추출 완료:', {
            totalLength: extractedData.fullText.length,
            chunkCount: chunks.length,
            wordCount: extractedData.statistics.wordCount
        });
        
        sendResponse({
            success: true,
            content: summary,
            fullData: {
                metadata: extractedData.metadata,
                fullText: extractedData.fullText,
                chunks: chunks,
                statistics: extractedData.statistics,
                structuredContent: extractedData.content
            },
            metadata: {
                url: window.location.href,
                title: document.title,
                domain: window.location.hostname,
                timestamp: new Date().toISOString(),
                extractionMethod: 'enhanced'
            }
        });
        
    } catch (error) {
        console.error('❌ 향상된 페이지 내용 추출 실패:', error);
        
        // 폴백: 기본 방식 사용
        try {
            const basicText = document.body ? document.body.innerText.slice(0, 8000) : '';
            sendResponse({
                success: true,
                content: `페이지 제목: ${document.title}\nURL: ${window.location.href}\n\n내용:\n${basicText}`,
                fullData: {
                    fullText: basicText,
                    chunks: [{ id: 0, content: basicText, length: basicText.length }]
                },
                metadata: {
                    url: window.location.href,
                    title: document.title,
                    domain: window.location.hostname,
                    timestamp: new Date().toISOString(),
                    extractionMethod: 'fallback'
                }
            });
        } catch (fallbackError) {
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
}

/**
 * 포괄적인 요약 생성
 */
function generateComprehensiveSummary(extractedData) {
    const { metadata, content, fullText, statistics } = extractedData;
    
    let summary = '';
    
    // 기본 정보
    summary += `페이지 제목: ${metadata.title}\n`;
    summary += `URL: ${metadata.url}\n`;
    summary += `도메인: ${metadata.domain}\n`;
    
    if (metadata.description) {
        summary += `설명: ${metadata.description}\n`;
    }
    
    summary += `\n통계:\n`;
    summary += `- 총 글자 수: ${statistics.characterCount.toLocaleString()}자\n`;
    summary += `- 단어 수: ${statistics.wordCount.toLocaleString()}개\n`;
    summary += `- 문장 수: ${statistics.sentenceCount.toLocaleString()}개\n`;
    summary += `- 단락 수: ${statistics.paragraphCount.toLocaleString()}개\n\n`;
    
    // 구조 정보
    if (content.headings.length > 0) {
        summary += `페이지 구조 (${content.headings.length}개 제목):\n`;
        content.headings.forEach(h => {
            summary += `${'#'.repeat(h.level)} ${h.text}\n`;
        });
        summary += '\n';
    }
    
    // 전체 텍스트 내용 (처음 6000자)
    summary += '전체 페이지 내용:\n';
    summary += fullText.substring(0, 6000);
    
    if (fullText.length > 6000) {
        summary += `\n\n... (총 ${fullText.length.toLocaleString()}자 중 처음 6,000자 표시)\n`;
        summary += `전체 내용은 ${Math.ceil(fullText.length / 1000)}개 청크로 분할되어 저장됨`;
    }
    
    return summary;
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
        // 더 포괄적인 선택자 사용
        const paragraphElements = document.querySelectorAll(`
            p, div, section, article, main, aside,
            .content, .post, .article, .text, .description,
            .summary, .excerpt, .body, .main,
            [role="main"], [role="article"], [role="complementary"]
        `);
        
        paragraphElements.forEach((element, index) => {
            if (index < 200) { // 최대 200개로 증가
                const text = element.textContent.trim();
                if (text.length > 20) { // 의미있는 길이의 텍스트만
                    paragraphs.push({
                        text: text.substring(0, 2000), // 최대 2000자로 증가
                        length: text.length,
                        tagName: element.tagName.toLowerCase(),
                        className: element.className || ''
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
    getPageSummary(maxLength = 8000) { // 기본 길이를 8000자로 증가
        if (!this.lastAnalysis) {
            // 분석이 없으면 전체 텍스트 추출
            const bodyText = document.body ? document.body.innerText.slice(0, maxLength) : '';
            return `페이지 제목: ${document.title}\nURL: ${window.location.href}\n\n내용:\n${bodyText}`;
        }
        
        const { content, metadata } = this.lastAnalysis;
        let summary = '';
        
        // 페이지 기본 정보
        summary += `페이지 제목: ${document.title}\n`;
        summary += `URL: ${window.location.href}\n\n`;
        
        // 메타 설명 추가
        if (metadata.description) {
            summary += `설명: ${metadata.description}\n\n`;
        }
        
        // 모든 제목 추가 (제한 없음)
        if (content.headings.length > 0) {
            summary += '페이지 구조 (제목들):\n';
            content.headings.forEach(h => {
                summary += `${'#'.repeat(h.level)} ${h.text}\n`;
            });
            summary += '\n';
        }
        
        // 전체 텍스트 내용 추가
        summary += '전체 페이지 내용:\n';
        
        // 1. 구조화된 단락들
        if (content.paragraphs.length > 0) {
            content.paragraphs.forEach(p => {
                // 전체 텍스트 포함 (500자 제한 제거)
                summary += `${p.text}\n\n`;
            });
        }
        
        // 2. 목록 내용 추가
        if (content.lists.length > 0) {
            summary += '\n목록 내용:\n';
            content.lists.forEach(list => {
                summary += `${list.type === 'ul' ? '•' : '1.'} 목록:\n`;
                list.items.forEach(item => {
                    summary += `  - ${item}\n`;
                });
                summary += '\n';
            });
        }
        
        // 3. 링크 정보 추가
        if (content.links.length > 0) {
            summary += '\n주요 링크:\n';
            content.links.slice(0, 10).forEach(link => {
                summary += `- ${link.text}: ${link.url}\n`;
            });
            summary += '\n';
        }
        
        // 4. 추가 텍스트 추출 (기존 방식으로 놓친 내용들)
        const additionalText = this.extractAdditionalText();
        if (additionalText.length > 0) {
            summary += '\n추가 텍스트 내용:\n';
            summary += additionalText;
        }
        
        return summary.substring(0, maxLength);
    }

    /**
     * 추가 텍스트 추출 (기존 방식으로 놓친 내용들)
     */
    extractAdditionalText() {
        // 더 포괄적인 선택자로 텍스트 추출
        const textElements = document.querySelectorAll(`
            div, span, section, article, main, aside, 
            td, th, li, dt, dd, figcaption, blockquote,
            [role="main"], [role="article"], [role="complementary"],
            .content, .post, .article, .text, .description,
            .summary, .excerpt, .body, .main
        `);
        
        const extractedTexts = new Set(); // 중복 제거
        let additionalText = '';
        
        textElements.forEach(element => {
            // 스크립트, 스타일, 숨겨진 요소 제외
            if (element.tagName === 'SCRIPT' || 
                element.tagName === 'STYLE' || 
                element.style.display === 'none' ||
                element.style.visibility === 'hidden') {
                return;
            }
            
            // 직접적인 텍스트 노드만 추출 (중첩 방지)
            const directText = Array.from(element.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ')
                .trim();
            
            if (directText.length > 10 && !extractedTexts.has(directText)) {
                extractedTexts.add(directText);
                additionalText += directText + '\n';
            }
        });
        
        return additionalText;
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

} // 중복 로드 방지 블록 끝
