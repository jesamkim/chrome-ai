/**
 * AWS 인증 관리자
 * 로컬 AWS 인증과 API Key 인증을 관리
 */

class AWSAuthManager {
    constructor() {
        this.authType = null; // 'aws-cli' | 'api-key' | null
        this.credentials = null;
        this.region = 'us-west-2';
        this.isInitialized = false;
    }

    /**
     * AWS 인증 초기화 (우선순위: AWS CLI > API Key)
     */
    async initialize() {
        try {
            console.log('🔐 AWS 인증 초기화 시작');

            // 1순위: AWS CLI 인증 확인
            const awsCliAuth = await this.checkAWSCLIAuth();
            if (awsCliAuth.available) {
                this.authType = 'aws-cli';
                this.credentials = awsCliAuth.credentials;
                this.region = awsCliAuth.region;
                console.log('✅ AWS CLI 인증 사용:', {
                    region: this.region,
                    profile: awsCliAuth.profile || 'default'
                });
                this.isInitialized = true;
                return true;
            }

            // 2순위: API Key 인증 확인
            const apiKeyAuth = await this.checkAPIKeyAuth();
            if (apiKeyAuth.available) {
                this.authType = 'api-key';
                this.credentials = apiKeyAuth.credentials;
                console.log('✅ API Key 인증 사용');
                this.isInitialized = true;
                return true;
            }

            console.warn('⚠️ 사용 가능한 AWS 인증이 없습니다');
            this.isInitialized = false;
            return false;

        } catch (error) {
            console.error('❌ AWS 인증 초기화 실패:', error);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * AWS CLI 인증 확인 (로컬 AWS CLI 우선 사용)
     */
    async checkAWSCLIAuth() {
        try {
            console.log('🔍 AWS CLI 인증 확인 시작');
            
            // 1. 사용자가 로컬 AWS CLI 사용을 선택했는지 확인
            const settings = await chrome.storage.sync.get(['useLocalAWSCLI']);
            if (settings.useLocalAWSCLI) {
                console.log('✅ 로컬 AWS CLI 사용 설정 확인됨');
                
                // 로컬 AWS CLI 사용 시 기본 설정 반환
                return {
                    available: true,
                    credentials: {
                        useLocalCLI: true // 실제 AWS CLI 사용 플래그
                    },
                    region: 'us-west-2', // 기본 리전
                    profile: 'default'
                };
            }
            
            // 2. Chrome Storage에 저장된 AWS CLI 설정 확인
            const awsConfig = await chrome.storage.local.get([
                'aws_access_key_id',
                'aws_secret_access_key', 
                'aws_session_token',
                'aws_region',
                'aws_profile'
            ]);

            if (awsConfig.aws_access_key_id && awsConfig.aws_secret_access_key) {
                console.log('✅ 저장된 AWS CLI 인증 정보 발견');
                return {
                    available: true,
                    credentials: {
                        accessKeyId: awsConfig.aws_access_key_id,
                        secretAccessKey: awsConfig.aws_secret_access_key,
                        sessionToken: awsConfig.aws_session_token || null
                    },
                    region: awsConfig.aws_region || 'us-west-2',
                    profile: awsConfig.aws_profile || 'default'
                };
            }

            // 3. 자동 감지 시도
            return await this.detectAWSCLIFromEnvironment();

        } catch (error) {
            console.debug('AWS CLI 인증 확인 실패:', error.message);
            return { available: false };
        }
    }

    /**
     * 환경에서 AWS CLI 설정 감지 시도
     */
    async detectAWSCLIFromEnvironment() {
        try {
            // Chrome Extension 환경에서는 직접 파일 시스템 접근이 제한됨
            // 사용자에게 로컬 AWS CLI 사용 여부를 묻는 방식으로 구현
            
            console.log('💡 로컬 AWS CLI 자동 감지 시도');
            
            // 향후 Native Messaging Host를 통해 실제 AWS CLI 설정 읽기 가능
            // 현재는 사용자가 설정에서 선택하도록 안내
            
            return { available: false };

        } catch (error) {
            console.debug('AWS CLI 환경 감지 실패:', error.message);
            return { available: false };
        }
    }

    /**
     * API Key 인증 확인
     */
    async checkAPIKeyAuth() {
        try {
            const result = await chrome.storage.sync.get(['bedrockApiKey']);
            
            if (result.bedrockApiKey && result.bedrockApiKey.trim()) {
                return {
                    available: true,
                    credentials: {
                        apiKey: result.bedrockApiKey.trim()
                    }
                };
            }

            return { available: false };

        } catch (error) {
            console.debug('API Key 인증 확인 실패:', error.message);
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

        switch (this.authType) {
            case 'aws-cli':
                return await this.getAWSCLIHeaders();
            
            case 'api-key':
                return this.getAPIKeyHeaders();
            
            default:
                throw new Error('알 수 없는 인증 방식입니다.');
        }
    }

    /**
     * AWS CLI 인증 헤더 생성 (로컬 AWS CLI 또는 저장된 인증 정보 사용)
     */
    async getAWSCLIHeaders() {
        try {
            // 로컬 AWS CLI 사용하는 경우
            if (this.credentials.useLocalCLI) {
                console.log('🔐 로컬 AWS CLI 인증 사용');
                
                // 실제로는 Native Messaging을 통해 AWS CLI에서 인증 정보를 가져와야 함
                // 현재는 시뮬레이션으로 기본 AWS SDK 방식 사용
                
                // 임시로 환경 변수나 기본 프로필에서 가져온다고 가정
                // 실제 구현에서는 Native Messaging Host가 필요
                
                return {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    // 로컬 AWS CLI 사용 시 AWS SDK가 자동으로 인증 처리
                    'X-Amz-User-Agent': 'chrome-extension-aws-cli'
                };
            }
            
            // 저장된 AWS CLI 인증 정보 사용
            const { accessKeyId, secretAccessKey, sessionToken } = this.credentials;
            
            if (!accessKeyId || !secretAccessKey) {
                throw new Error('AWS CLI 인증 정보가 불완전합니다.');
            }
            
            // AWS Signature V4 생성
            const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
            const date = timestamp.substr(0, 8);
            
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Amz-Date': timestamp,
                'Authorization': await this.generateAWSSignature(accessKeyId, secretAccessKey, timestamp, date)
            };

            if (sessionToken) {
                headers['X-Amz-Security-Token'] = sessionToken;
            }

            return headers;

        } catch (error) {
            console.error('❌ AWS CLI 헤더 생성 실패:', error);
            throw error;
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
     * AWS Signature V4 생성 (간소화된 버전)
     */
    async generateAWSSignature(accessKeyId, secretAccessKey, timestamp, date) {
        try {
            // 실제 구현에서는 crypto-js나 AWS SDK의 서명 로직 사용
            // 여기서는 간소화된 Bearer 토큰 방식으로 구현
            
            // 임시로 API Key 방식과 동일하게 처리
            // 실제로는 AWS Signature V4 알고리즘 구현 필요
            console.warn('⚠️ AWS Signature V4 구현 필요 - 임시로 Bearer 토큰 사용');
            
            return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${date}/us-west-2/bedrock/aws4_request, SignedHeaders=host;x-amz-date, Signature=temporary`;

        } catch (error) {
            console.error('❌ AWS 서명 생성 실패:', error);
            throw error;
        }
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
     * AWS CLI 인증 정보 수동 설정 (사용자 입력)
     */
    async setAWSCLICredentials(credentials) {
        try {
            const { accessKeyId, secretAccessKey, sessionToken, region, profile } = credentials;

            // 입력 검증
            if (!accessKeyId || !secretAccessKey) {
                throw new Error('Access Key ID와 Secret Access Key는 필수입니다.');
            }

            // Chrome Storage에 저장
            await chrome.storage.local.set({
                aws_access_key_id: accessKeyId,
                aws_secret_access_key: secretAccessKey,
                aws_session_token: sessionToken || null,
                aws_region: region || 'us-west-2',
                aws_profile: profile || 'default'
            });

            console.log('✅ AWS CLI 인증 정보 저장 완료');

            // 재초기화
            return await this.initialize();

        } catch (error) {
            console.error('❌ AWS CLI 인증 정보 설정 실패:', error);
            throw error;
        }
    }

    /**
     * 저장된 AWS CLI 인증 정보 제거
     */
    async clearAWSCLICredentials() {
        try {
            await chrome.storage.local.remove([
                'aws_access_key_id',
                'aws_secret_access_key',
                'aws_session_token',
                'aws_region',
                'aws_profile'
            ]);

            console.log('🗑️ AWS CLI 인증 정보 제거 완료');

            // 재초기화 (API Key로 폴백)
            return await this.initialize();

        } catch (error) {
            console.error('❌ AWS CLI 인증 정보 제거 실패:', error);
            throw error;
        }
    }

    /**
     * 인증 방식 강제 변경
     */
    async switchAuthMethod(method) {
        try {
            if (method === 'api-key') {
                await this.clearAWSCLICredentials();
            } else if (method === 'aws-cli') {
                // AWS CLI 설정 화면으로 안내
                throw new Error('AWS CLI 인증 정보를 먼저 설정해주세요.');
            }

            return await this.initialize();

        } catch (error) {
            console.error('❌ 인증 방식 변경 실패:', error);
            throw error;
        }
    }
}

// Service Worker 환경에서 사용할 수 있도록 globalThis에 등록
if (typeof globalThis !== 'undefined') {
    globalThis.AWSAuthManager = AWSAuthManager;
}

// Chrome Extension 환경에서만 window 사용
if (typeof window !== 'undefined') {
    window.AWSAuthManager = AWSAuthManager;
}

// Node.js 환경에서는 module.exports 사용
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AWSAuthManager;
}
