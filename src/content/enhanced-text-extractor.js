/**
 * 향상된 텍스트 추출기
 * 웹페이지의 모든 텍스트를 구조화하여 추출
 */

class EnhancedTextExtractor {
    constructor() {
        this.excludeSelectors = [
            'script', 'style', 'noscript', 'iframe',
            '.advertisement', '.ads', '.sidebar',
            'nav', 'header', 'footer', '.menu',
            '[style*="display: none"]', '[style*="visibility: hidden"]'
        ];
    }

    /**
     * 페이지의 모든 텍스트를 구조화하여 추출
     */
    extractFullPageText() {
        console.log('🔍 전체 페이지 텍스트 추출 시작');
        
        const result = {
            metadata: this.extractMetadata(),
            content: this.extractStructuredContent(),
            fullText: this.extractPlainText(),
            statistics: {}
        };
        
        result.statistics = this.calculateStatistics(result.fullText);
        
        console.log('✅ 텍스트 추출 완료:', {
            totalLength: result.fullText.length,
            wordCount: result.statistics.wordCount,
            chunkCount: Math.ceil(result.fullText.length / 1000)
        });
        
        return result;
    }

    /**
     * 메타데이터 추출
     */
    extractMetadata() {
        return {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            language: document.documentElement.lang || 'unknown',
            timestamp: new Date().toISOString(),
            description: this.getMetaContent('description'),
            keywords: this.getMetaContent('keywords'),
            author: this.getMetaContent('author')
        };
    }

    /**
     * Meta 태그 내용 추출
     */
    getMetaContent(name) {
        const meta = document.querySelector(`meta[name="${name}"], meta[property="og:${name}"]`);
        return meta ? meta.getAttribute('content') : '';
    }

    /**
     * 구조화된 콘텐츠 추출
     */
    extractStructuredContent() {
        return {
            headings: this.extractAllHeadings(),
            paragraphs: this.extractAllParagraphs(),
            lists: this.extractAllLists(),
            tables: this.extractAllTables(),
            links: this.extractAllLinks(),
            codeBlocks: this.extractAllCodeBlocks()
        };
    }

    /**
     * 모든 제목 추출 (제한 없음)
     */
    extractAllHeadings() {
        const headings = [];
        const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headingElements.forEach((element, index) => {
            const text = element.textContent.trim();
            if (text.length > 0) {
                headings.push({
                    level: parseInt(element.tagName.charAt(1)),
                    text: text,
                    id: element.id || `heading-${index}`,
                    position: index
                });
            }
        });
        
        return headings;
    }

    /**
     * 모든 단락 추출 (제한 없음)
     */
    extractAllParagraphs() {
        const paragraphs = [];
        
        // 더 포괄적인 텍스트 요소 선택
        const textElements = document.querySelectorAll(`
            p, div, section, article, main, aside,
            .content, .post, .article, .text, .description,
            .summary, .excerpt, .body, .main, .paragraph,
            [role="main"], [role="article"], [role="complementary"],
            td, th, li, dt, dd, figcaption, blockquote
        `);
        
        textElements.forEach((element, index) => {
            // 제외할 요소 체크
            if (this.shouldExcludeElement(element)) {
                return;
            }
            
            const text = this.getDirectTextContent(element);
            if (text.length > 10) { // 최소 길이 조건
                paragraphs.push({
                    text: text,
                    length: text.length,
                    tagName: element.tagName.toLowerCase(),
                    className: element.className || '',
                    position: index
                });
            }
        });
        
        return paragraphs;
    }

    /**
     * 요소의 직접적인 텍스트 내용만 추출 (중첩 방지)
     */
    getDirectTextContent(element) {
        let text = '';
        
        // 자식 노드들을 순회하면서 텍스트 노드만 추출
        for (const node of element.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent.trim() + ' ';
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // 인라인 요소의 텍스트는 포함
                if (this.isInlineElement(node)) {
                    text += node.textContent.trim() + ' ';
                }
            }
        }
        
        return text.trim();
    }

    /**
     * 인라인 요소 확인
     */
    isInlineElement(element) {
        const inlineElements = [
            'span', 'a', 'strong', 'b', 'em', 'i', 'u', 'small',
            'mark', 'del', 'ins', 'sub', 'sup', 'code', 'kbd', 'samp'
        ];
        return inlineElements.includes(element.tagName.toLowerCase());
    }

    /**
     * 제외할 요소인지 확인
     */
    shouldExcludeElement(element) {
        // 제외 선택자 체크
        for (const selector of this.excludeSelectors) {
            if (element.matches && element.matches(selector)) {
                return true;
            }
        }
        
        // 숨겨진 요소 체크
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return true;
        }
        
        // 매우 작은 요소 제외 (광고 등)
        if (element.offsetWidth < 10 || element.offsetHeight < 10) {
            return true;
        }
        
        return false;
    }

    /**
     * 모든 목록 추출
     */
    extractAllLists() {
        const lists = [];
        const listElements = document.querySelectorAll('ul, ol, dl');
        
        listElements.forEach((element, index) => {
            if (this.shouldExcludeElement(element)) return;
            
            const items = [];
            
            if (element.tagName === 'DL') {
                // Definition list
                const dts = element.querySelectorAll('dt');
                const dds = element.querySelectorAll('dd');
                
                dts.forEach((dt, i) => {
                    const dd = dds[i];
                    items.push(`${dt.textContent.trim()}: ${dd ? dd.textContent.trim() : ''}`);
                });
            } else {
                // Unordered/Ordered list
                const listItems = element.querySelectorAll('li');
                listItems.forEach(li => {
                    const text = li.textContent.trim();
                    if (text.length > 0) {
                        items.push(text);
                    }
                });
            }
            
            if (items.length > 0) {
                lists.push({
                    type: element.tagName.toLowerCase(),
                    items: items,
                    position: index
                });
            }
        });
        
        return lists;
    }

    /**
     * 모든 테이블 추출
     */
    extractAllTables() {
        const tables = [];
        const tableElements = document.querySelectorAll('table');
        
        tableElements.forEach((table, index) => {
            if (this.shouldExcludeElement(table)) return;
            
            const headers = [];
            const rows = [];
            
            // 헤더 추출
            const headerCells = table.querySelectorAll('th');
            headerCells.forEach(th => {
                headers.push(th.textContent.trim());
            });
            
            // 데이터 행 추출
            const dataRows = table.querySelectorAll('tr');
            dataRows.forEach(tr => {
                const cells = tr.querySelectorAll('td');
                if (cells.length > 0) {
                    const rowData = [];
                    cells.forEach(td => {
                        rowData.push(td.textContent.trim());
                    });
                    rows.push(rowData);
                }
            });
            
            if (headers.length > 0 || rows.length > 0) {
                tables.push({
                    headers: headers,
                    rows: rows,
                    position: index
                });
            }
        });
        
        return tables;
    }

    /**
     * 모든 링크 추출
     */
    extractAllLinks() {
        const links = [];
        const linkElements = document.querySelectorAll('a[href]');
        
        linkElements.forEach((link, index) => {
            const href = link.href;
            const text = link.textContent.trim();
            
            if (text.length > 0 && href.startsWith('http')) {
                links.push({
                    url: href,
                    text: text,
                    isExternal: !href.includes(window.location.hostname),
                    position: index
                });
            }
        });
        
        return links;
    }

    /**
     * 모든 코드 블록 추출
     */
    extractAllCodeBlocks() {
        const codeBlocks = [];
        const codeElements = document.querySelectorAll('pre, code, .highlight, .code');
        
        codeElements.forEach((element, index) => {
            const code = element.textContent.trim();
            if (code.length > 5) {
                codeBlocks.push({
                    code: code,
                    language: this.detectCodeLanguage(element),
                    length: code.length,
                    position: index
                });
            }
        });
        
        return codeBlocks;
    }

    /**
     * 코드 언어 감지
     */
    detectCodeLanguage(element) {
        const className = element.className;
        const langMatch = className.match(/language-(\w+)|lang-(\w+)|(\w+)-code/);
        return langMatch ? (langMatch[1] || langMatch[2] || langMatch[3]) : 'unknown';
    }

    /**
     * 전체 플레인 텍스트 추출
     */
    extractPlainText() {
        // body의 모든 텍스트를 추출하되, 제외 요소는 제거
        const bodyClone = document.body.cloneNode(true);
        
        // 제외할 요소들 제거
        this.excludeSelectors.forEach(selector => {
            const elements = bodyClone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        });
        
        // 텍스트 추출 및 정리
        let text = bodyClone.innerText || bodyClone.textContent || '';
        
        // 텍스트 정리
        text = text
            .replace(/\s+/g, ' ')           // 연속된 공백을 하나로
            .replace(/\n\s*\n/g, '\n')      // 연속된 줄바꿈을 하나로
            .trim();
        
        return text;
    }

    /**
     * 텍스트 통계 계산
     */
    calculateStatistics(text) {
        const words = text.split(/\s+/).filter(word => word.length > 0);
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        
        return {
            characterCount: text.length,
            wordCount: words.length,
            sentenceCount: sentences.length,
            paragraphCount: paragraphs.length,
            averageWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
            averageCharactersPerWord: words.length > 0 ? Math.round(text.length / words.length) : 0
        };
    }

    /**
     * 텍스트를 청크로 분할
     */
    chunkText(text, chunkSize = 1000, overlap = 100) {
        const chunks = [];
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        let currentChunk = '';
        let chunkIndex = 0;
        
        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (trimmedSentence.length === 0) continue;
            
            // 현재 청크에 문장을 추가했을 때의 길이 확인
            const potentialLength = currentChunk.length + trimmedSentence.length + 1;
            
            if (potentialLength > chunkSize && currentChunk.length > 0) {
                // 현재 청크를 저장하고 새 청크 시작
                chunks.push({
                    id: chunkIndex++,
                    content: currentChunk.trim(),
                    length: currentChunk.length,
                    wordCount: currentChunk.split(/\s+/).length
                });
                
                // 오버랩을 위해 마지막 부분 유지
                const words = currentChunk.split(/\s+/);
                const overlapWords = words.slice(-Math.floor(overlap / 10)); // 대략적인 오버랩
                currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
            } else {
                currentChunk += (currentChunk.length > 0 ? ' ' : '') + trimmedSentence;
            }
        }
        
        // 마지막 청크 추가
        if (currentChunk.trim().length > 0) {
            chunks.push({
                id: chunkIndex,
                content: currentChunk.trim(),
                length: currentChunk.length,
                wordCount: currentChunk.split(/\s+/).length
            });
        }
        
        return chunks;
    }
}

// 전역으로 사용할 수 있도록 export
window.EnhancedTextExtractor = EnhancedTextExtractor;
