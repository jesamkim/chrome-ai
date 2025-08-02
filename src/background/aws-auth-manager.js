/**
 * AWS 인증 관리자
 * API Key 인증을 관리
 */

class AWSAuthManager {
    constructor() {
        this.authType = 'api-key';
        this.credentials = null;
        this.region = 'us-west-2';
        this.isInitialized = false;
    }

    /**
     * AWS 인증 초기화 (API Key 전용)
     */
    async initialize() {
        try {
            console.log('🔐 AWS 인증 초기화 시작 (API Key 전용)');

            // API Key 인증 확인
            console.log('🔍 API Key 인증 확인 중...');
            const apiKeyAuth = await this.checkAPIKeyAuth();
            console.log('API Key 인증 결과:', apiKeyAuth);
            
            if (apiKeyAuth.available) {
                this.authType = 'api-key';
                this.credentials = { apiKey: apiKeyAuth.apiKey };
                console.log('✅ API Key 인증 사용');
                this.isInitialized = true;
                return { success: true, authType: 'api-key' };
            }

            console.log('❌ 사용 가능한 인증 방식이 없습니다');
            this.isInitialized = false;
            return { success: false, error: 'API Key가 설정되지 않았습니다' };

        } catch (error) {
            console.error('❌ AWS 인증 초기화 실패:', error);
            this.isInitialized = false;
            return { success: false, error: error.message };
        }
    }

    /**
     * API Key 인증 확인
     */
    async checkAPIKeyAuth() {
        try {
            const result = await chrome.storage.sync.get(['bedrockApiKey']);
            
            if (result.bedrockApiKey) {
                console.log('✅ API Key 발견');
                return {
                    available: true,
                    apiKey: result.bedrockApiKey
                };
            }
            
            console.log('ℹ️ API Key 없음');
            return { available: false };
            
        } catch (error) {
            console.debug('API Key 확인 실패:', error.message);
            return { available: false };
        }
    }

    /**
     * 현재 인증 방식으로 AWS 요청 헤더 생성
     */
    async getAuthHeaders() {
        if (!this.isInitialized) {
            throw new Error('AWS 인증이 초기화되지 않았습니다.');
        }

        if (this.authType === 'api-key') {
            return this.getAPIKeyHeaders();
        } else {
            throw new Error('API Key 인증만 지원됩니다.');
        }
    }

    /**
     * API Key 인증 헤더 생성
     */
    getAPIKeyHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.credentials.apiKey}`,
            'Accept': 'application/json'
        };
    }

    /**
     * 인증 상태 정보 반환
     */
    getAuthInfo() {
        return {
            isInitialized: this.isInitialized,
            authType: this.authType,
            region: this.region,
            hasCredentials: !!this.credentials
        };
    }

    /**
     * 인증 재초기화
     */
    async reinitialize() {
        this.isInitialized = false;
        this.credentials = null;
        return await this.initialize();
    }
}

// Service Worker 환경에서 조건부 export
if (typeof globalThis !== 'undefined' && globalThis.chrome?.runtime) {
    globalThis.AWSAuthManager = AWSAuthManager;
}
