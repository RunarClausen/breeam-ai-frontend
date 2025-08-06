// lib/api.ts - COMPLETE VERSION WITH ALL FIXES
/**
 * BREEAM-AI API Client Library
 * Handles all communication with the backend
 * Updated with PDF support and enhanced error handling
 * FIXED: Response object double-read issue, timeout issues, and debugging
 */

// Get API base URL from environment or use default
// For GitHub Codespaces: Points to Railway backend by default
// For local backend testing: Set NEXT_PUBLIC_API_URL=http://localhost:8001
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://web-production-ed3ca.up.railway.app';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// RIKTIG handleResponse - HELT UTEN timeout
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails = null;
    
    try {
      const text = await response.text();
      console.log('❌ Error response text:', text);
      
      if (!text || text.trim() === '') {
        errorMessage = 'Serveren returnerte en tom feilrespons.';
      } else {
        try {
          const errorData = JSON.parse(text);
          if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error.message || errorData.error;
          }
        } catch (parseError) {
          errorMessage = `Serverfeil: ${text.substring(0, 200)}`;
        }
      }
    } catch (e) {
      console.error('❌ Failed to read error response:', e);
    }
    
    throw new ApiError(errorMessage, response.status, errorDetails);
  }
  
  // FIKSET: Direkte JSON parsing UTEN timeout
  try {
    const data = await response.json() as T;
    console.log('✅ JSON parsed successfully');
    return data;
  } catch (e) {
    console.error('❌ JSON parse error:', e);
    throw new ApiError(
      `Kunne ikke lese respons: ${e instanceof Error ? e.message : 'Ukjent feil'}`,
      response.status
    );
  }
}

// Type definitions
export interface BreeamVersion {
  code: string;
  display_name: string;
  year: number;
  description: string;
  language: string;
  is_current: boolean;
  path: string;
}

export interface Criterion {
  id: number;
  title: string;
  requirements?: any[];
}

export interface CriteriaGroup {
  label: string;
  criteria_ids: (number | string)[];
  title: string;
  points: number;
  criteria: Array<{
    id: string;
    title: string;
    requirements: Array<{
      id?: string;
      requirement_text?: string;
      text?: string;
      sub_requirements?: string[];
      additional_info?: string;
    }>;
    assessment_guidance?: {
      look_for?: string[];
      accept_formats?: string[];
      reject_if?: string[];
      ai_prompt_hint?: string;
    };
  }>;
  phase_relevant?: boolean;
  description?: string; // For bakoverkompatibilitet
}

export interface CriteriaResponse {
  grupper: Record<string, CriteriaGroup>;
  metadata?: {
    topic_id: string;
    title: string;
    version: string;
    category: string;
    total_points: number;
    purpose: string;
  };
  version: string;
  phase: string;
  source: string;
  file_path?: string;
  total_groups?: number;
  total_criteria?: number;
}

// UPDATED AssessmentResponse interface with PDF support
export interface AssessmentResponse {
  success: boolean;
  message: string;
  assessment: string;  // Required for compatibility (truncated to 1KB by backend)
  assessment_summary?: string;  // Optional - same as assessment in backend
  assessment_id?: string;  // Added to match backend response
  word_file?: string | null;  // Kept for backwards compatibility
  report_file?: string | null;  // New: generic report file (can be PDF or Word)
  report_format?: 'pdf' | 'word' | 'docx';  // New: indicates format
  error?: {  // Added for error handling compatibility
    message: string;
    status?: number;
    type?: string;
  };
  metadata: Record<string, any>;
  files_processed: string[];
  criteria_evaluated: number[] | string[];  // Can be either
  processing_time: number;
  cache_used?: boolean;
  timestamp?: string;
  displayed_chunks?: any[];
  criterion_assessments?: any[];
  phase_validation?: any;
  summary?: {
    totalCriteria: number;
    fulfilled: number;
    partiallyFulfilled: number;
    notFulfilled: number;
  };
  points_summary?: {
    summary?: string;
    achieved_points?: number;
    achieved?: number;  // Backend uses both names
    possible?: number;  // Backend sends this
    total_points?: number;
    percentage?: number;
    text?: string;  // Backend sends this
  };
  criteria_results?: Array<{  // Added - backend sends this!
    id: string;
    title?: string;
    status: string;
    points: number;
    summary: string;
    page_references?: string[];
  }>;
}

export interface HealthResponse {
  status: string;
  version: string;
  engine: string;
  ai_enabled: boolean;
  models: {
    primary: string;
    fallback: string;
  };
  directories: Record<string, any>;
  cache_stats?: Record<string, any>;
}

// Report format type
export type ReportFormat = 'pdf' | 'word' | 'docx';

// Main API client
export const breeamApi = {
  /**
   * Health check
   */
  async healthCheck(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache'
      });
      return handleResponse<HealthResponse>(response);
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  /**
   * Get available BREEAM versions
   */
  async getVersions(): Promise<BreeamVersion[]> {
    try {
      console.log('📡 Fetching versions from:', `${API_BASE_URL}/api/versjoner`);
      const response = await fetch(`${API_BASE_URL}/api/versjoner`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        headers: {
          'Accept': 'application/json',
        }
      });
      const data = await handleResponse<BreeamVersion[]>(response);
      console.log('📦 Versions response:', data);
      
      // Ensure it's an array
      if (!Array.isArray(data)) {
        console.warn('⚠️ Unexpected versions response format:', data);
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Failed to fetch versions:', error);
      throw error;
    }
  },
  
  /**
   * Get categories for a specific version
   */
  async getCategories(version: string): Promise<string[]> {
    try {
      console.log('📡 Fetching categories for version:', version);
      
      const params = new URLSearchParams({ versjon: version });
      const response = await fetch(`${API_BASE_URL}/api/kategorier?${params}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        headers: {
          'Accept': 'application/json',
        }
      });
      const data = await handleResponse<any>(response);
      console.log('📦 Categories response:', data);
      
      // Handle both array and object responses
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object') {
        // If it's an object with categories property
        if (data.categories && Array.isArray(data.categories)) {
          return data.categories;
        }
        // Otherwise return object keys or empty array
        return Object.keys(data).length > 0 ? Object.keys(data) : [];
      }
      
      console.warn('⚠️ Unexpected categories response format:', data);
      return [];
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  },
  
  /**
   * Get topics for a specific version and category
   */
  async getTopics(version: string, category: string): Promise<string[]> {
    try {
      console.log('📡 Fetching topics for:', { version, category });
      
      const params = new URLSearchParams({ 
        versjon: version, 
        kategori: category 
      });
      const response = await fetch(`${API_BASE_URL}/api/emner?${params}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        headers: {
          'Accept': 'application/json',
        }
      });
      const data = await handleResponse<any>(response);
      console.log('📦 Topics response:', data);
      
      // Handle both array and object responses
      if (Array.isArray(data)) {
        return data;
      } else if (data && typeof data === 'object') {
        // If it's an object with topics property
        if (data.topics && Array.isArray(data.topics)) {
          return data.topics;
        }
        // Otherwise return object keys or empty array
        return Object.keys(data).length > 0 ? Object.keys(data) : [];
      }
      
      console.warn('⚠️ Unexpected topics response format:', data);
      return [];
    } catch (error) {
      console.error('Failed to fetch topics:', error);
      throw error;
    }
  },
  
  /**
 * Get criteria for a specific version, category, and topic
 */
async getCriteria(version: string, category: string, topic: string): Promise<CriteriaResponse> {
  try {
    console.log('📡 Fetching criteria for:', { version, category, topic });
    
    const params = new URLSearchParams({ 
      versjon: version, 
      kategori: category,
      emne: topic 
    });
    const response = await fetch(`${API_BASE_URL}/api/kriterier?${params}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'default',
      headers: {
        'Accept': 'application/json',
      }
    });
    const data = await handleResponse<CriteriaResponse>(response);
    console.log('📦 Criteria response:', data);
    
    // Valider strukturen
    if (!data || !data.grupper) {
      console.error('⚠️ Invalid criteria response structure:', data);
      throw new Error('Invalid criteria response structure');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch criteria:', error);
    throw error;
  }
},
  
  /**
   * Get guidance for a specific criterion
   */
  async getGuidance(topic: string, criterionId: string): Promise<any> {
    try {
      console.log('📡 Fetching guidance for:', { topic, criterionId });
      const response = await fetch(`${API_BASE_URL}/api/guidance/${topic}/${criterionId}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'default',
        headers: {
          'Accept': 'application/json',
        }
      });
      const data = await handleResponse<any>(response);
      console.log('📦 Guidance response:', data);
      return data;
    } catch (error) {
      console.error('Failed to fetch guidance:', error);
      throw error;
    }
  },
  
  /**
   * Create a new assessment - FIXED with enhanced error handling and report format support
   */
  async createAssessment(formData: FormData, reportFormat: ReportFormat = 'pdf'): Promise<AssessmentResponse> {
    // Add report format to form data if not already present
    if (!formData.has('report_format')) {
      formData.append('report_format', reportFormat);
    }
    
    // Log what we're sending for debugging
    console.log('📤 Sending assessment request to:', `${API_BASE_URL}/api/vurder`);
    console.log('📋 FormData contents:');
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        console.log(`  ${key}: File(${value.name}, ${value.size} bytes, ${value.type})`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }

    const startTime = Date.now();
    
    // Create manual AbortController for better control
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      console.log('🚀 Initiating fetch request...');
      
      timeoutId = setTimeout(() => {
        console.error('⏰ Manual timeout triggered after 10 minutes');
        controller.abort();
      }, 600000); // 10 minutes timeout
      
      const response = await fetch(`${API_BASE_URL}/api/vurder`, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
        mode: 'cors',
        // Remove credentials: 'include' to avoid CORS issues with wildcard origin
        // credentials: 'include',
        signal: controller.signal
      });
      
      // Clear timeout immediately after getting response
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      console.log('✅ Response received, timeout cleared');

      const elapsed = Date.now() - startTime;
      console.log(`⏱️ Response received after ${elapsed}ms`);

      // Check if we got JSON response
      const contentType = response.headers.get('content-type');
      console.log('📋 Response Content-Type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        // Try to read the response body for debugging
        try {
          // FIXED: Clone response before reading to avoid consuming the body
          const responseClone = response.clone();
          const text = await responseClone.text();
          console.error('❌ Non-JSON response body:', text.substring(0, 500));
          
          // Check for specific error patterns
          if (text.includes('column') && text.includes('does not exist')) {
            throw new ApiError(
              'Database schema feil. Systemet må oppdateres av administrator.',
              response.status
            );
          }
          
        } catch (e) {
          console.error('Could not read response body');
        }
        
        throw new ApiError(
          `Server returnerte feil format (${contentType}). Forventet JSON.`,
          response.status
        );
      }

      // Special handling for specific status codes before calling handleResponse
      if (response.status === 503) {
        try {
          // FIXED: Clone response before reading to avoid consuming the body
          const responseClone = response.clone();
          const errorData = await responseClone.json();
          const message = errorData.detail?.message || errorData.detail || 'AI-tjenesten er midlertidig utilgjengelig. Vennligst prøv igjen om noen minutter.';
          throw new ApiError(message, 503, errorData.detail);
        } catch (e) {
          if (e instanceof ApiError) throw e;
          throw new ApiError('AI-tjenesten er midlertidig utilgjengelig', 503);
        }
      }

      if (response.status === 413) {
        throw new ApiError('Filene er for store. Maksimum 50MB per fil.', 413);
      }

      if (response.status === 429) {
        throw new ApiError('For mange forespørsler. Vent 1 minutt før du prøver igjen.', 429);
      }

      console.log('🎯 Calling handleResponse...');
      
      // DIREKTE kall - INGEN Promise.race!
      const result = await handleResponse<AssessmentResponse>(response);
      
      console.log('✅ handleResponse returned successfully');
      console.log('📋 Result type:', typeof result);
      console.log('📋 Result keys:', result ? Object.keys(result).slice(0, 10) : 'null');
      console.log('📋 Has success property?', result && 'success' in result);
      console.log('📋 Success value:', result?.success);
      console.log('📋 Has assessment?', result && 'assessment' in result);
      console.log('📋 Assessment length:', result?.assessment?.length || 0);
      
      // Check if backend returned a failure response
      if (result.success === false) {
        throw new ApiError(
          result.message || 'Assessment failed',
          response.status,
          result
        );
      }
      
      // Handle null values and ensure backwards compatibility
      console.log('🔧 Creating normalizedResult...');
      const normalizedResult = {
        ...result,
        word_file: result.word_file || null,
        report_file: result.report_file || null,
        report_format: result.report_format || reportFormat,
        success: true, // Already checked for false above
        files_processed: result.files_processed || [],
        criteria_evaluated: result.criteria_evaluated || [],
        metadata: result.metadata || {}
      };
      console.log('✅ normalizedResult created');
      
      console.log('✅ Assessment response received successfully');
      console.log('📊 Response summary:', {
        success: normalizedResult.success,
        hasAssessment: !!normalizedResult.assessment,
        assessmentLength: normalizedResult.assessment?.length,
        reportFile: normalizedResult.report_file || normalizedResult.word_file,
        reportFormat: normalizedResult.report_format || 'word',
        filesProcessed: normalizedResult.files_processed?.length,
        processingTime: normalizedResult.processing_time
      });
      
      console.log('🎯 Returning normalized result to caller');
      return normalizedResult;
      
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      const elapsed = Date.now() - startTime;
      console.error(`❌ Assessment request failed after ${elapsed}ms:`, error);
      
      // Re-throw ApiErrors as-is
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Handle network and timeout errors
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new ApiError(
          'Kunne ikke koble til serveren. Sjekk internettforbindelsen og prøv igjen.',
          0,
          error
        );
      }
      
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout'))) {
        throw new ApiError(
          'Forespørselen tok for lang tid. Prøv med mindre filer eller sjekk internettforbindelsen.',
          408,
          error
        );
      }
      
      // Wrap other errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ApiError(
        `Uventet feil: ${errorMessage}`,
        0,
        error
      );
    }
  }
};

// Export convenience functions for React components
export const useApi = () => {
  return {
    ...breeamApi,
    apiUrl: API_BASE_URL,
    
    // Helper to build full URL for downloads - UPDATED to handle both file types
    getDownloadUrl: (path: string, format?: string) => {
      if (!path) return '';
      if (path.startsWith('http')) return path;
      
      // Ensure path starts with /
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      const fullUrl = `${API_BASE_URL}${cleanPath}`;
      
      console.log('📎 Download URL generated:', { path, fullUrl, format });
      return fullUrl;
    },
    
    // Helper to check if API is available
    isAvailable: async (): Promise<boolean> => {
      try {
        const health = await breeamApi.healthCheck();
        return health.status === 'healthy' && health.ai_enabled === true;
      } catch (e) {
        console.error('API not available:', e);
        return false;
      }
    },
    
    // Helper to check if AI is enabled
    checkAIStatus: async (): Promise<boolean> => {
      try {
        const health = await breeamApi.healthCheck();
        return health.ai_enabled === true;
      } catch (e) {
        return false;
      }
    }
  };
};

// Utility functions
export const utils = {
  /**
   * Format file size in human readable format
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },
  
  /**
   * Check if file type is allowed
   */
  isFileTypeAllowed(fileName: string): boolean {
    const allowedExtensions = ['.pdf', '.docx', '.xlsx'];
    const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
    return allowedExtensions.includes(extension);
  },
  
  /**
   * Validate file before upload
   */
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    
    if (!this.isFileTypeAllowed(file.name)) {
      return { valid: false, error: 'Kun PDF, Word (.docx) og Excel (.xlsx) filer er tillatt' };
    }
    
    if (file.size > maxSize) {
      return { valid: false, error: 'Filen er for stor (maksimum 50MB)' };
    }
    
    if (file.size === 0) {
      return { valid: false, error: 'Filen er tom' };
    }
    
    return { valid: true };
  },
  
  /**
   * Create form data for assessment - NOTE: Still removes 'v' prefix for compatibility
   */
  createAssessmentFormData(params: {
    version: string;
    category: string;
    topic: string;
    criteria: string[];
    files: File[];
    privacyConsent?: boolean;
    reportFormat?: ReportFormat;
    phase?: string;
    includeChunks?: boolean;
    assessmentType?: 'PCA' | 'PCR';
    previousAssessmentId?: string;
  }): FormData {
    const formData = new FormData();
    
    // Validate inputs
    if (!params.version || !params.category || !params.topic) {
      throw new Error('Versjon, kategori og emne må være valgt');
    }
    
    if (!params.criteria || params.criteria.length === 0) {
      throw new Error('Minst ett kriterium må være valgt');
    }
    
    if (!params.files || params.files.length === 0) {
      throw new Error('Minst én fil må være lastet opp');
    }
    
    // Validate files
    for (const file of params.files) {
      const validation = this.validateFile(file);
      if (!validation.valid) {
        throw new Error(`${file.name}: ${validation.error}`);
      }
    }
    
    // NOTE: For /api/vurder endpoint, we might still need to remove 'v' prefix
    // This depends on your backend implementation for this specific endpoint
    const cleanVersion = params.version.replace(/^v/, '');
    
    // Add all required fields
    formData.append('versjon', cleanVersion);
    formData.append('kategori', params.category);
    formData.append('emne', params.topic);
    formData.append('kriterier', params.criteria.join(','));
    formData.append('privacy_consent', String(params.privacyConsent ?? true));
    formData.append('report_format', params.reportFormat || 'pdf');  // Default to PDF
    
    // Add optional fields
    if (params.phase) {
      formData.append('phase', params.phase);
    }
    
    if (params.includeChunks !== undefined) {
      formData.append('include_chunks', String(params.includeChunks));
    }
    
    if (params.assessmentType) {
      formData.append('assessment_type', params.assessmentType);
    }
    
    if (params.previousAssessmentId) {
      formData.append('previous_assessment_id', params.previousAssessmentId);
    }
    
    // Add files
    params.files.forEach((file) => {
      formData.append('files', file);
    });
    
    return formData;
  },
  
  /**
   * Get file extension from report format
   */
  getFileExtension(format?: string): string {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return '.pdf';
      case 'word':
      case 'docx':
        return '.docx';
      default:
        return '.pdf';  // Default to PDF
    }
  },
  
  /**
   * Get MIME type for report format
   */
  getMimeType(format?: string): string {
    switch (format?.toLowerCase()) {
      case 'pdf':
        return 'application/pdf';
      case 'word':
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      default:
        return 'application/pdf';
    }
  },
  
  /**
   * Generate suggested filename for report download
   */
  generateReportFilename(assessmentId?: string, format?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const id = assessmentId ? assessmentId.slice(0, 8) : 'rapport';
    const extension = this.getFileExtension(format);
    return `BREEAM-vurdering_${id}_${timestamp}${extension}`;
  },
  
  /**
   * Debug helper - log current API status
   */
  debugAPIStatus: async () => {
    console.log('🔍 Debugging API Status...');
    console.log('API URL:', API_BASE_URL);
    
    try {
      const health = await breeamApi.healthCheck();
      console.log('✅ API is reachable');
      console.log('AI Enabled:', health.ai_enabled);
      console.log('Version:', health.version);
      console.log('Models:', health.models);
      
      if (!health.ai_enabled) {
        console.error('❌ AI is NOT enabled! Backend is missing OPENAI_API_KEY');
        console.error('Check Railway environment variables:');
        console.error('1. OPENAI_API_KEY should start with "sk-"');
        console.error('2. No quotes around the key');
        console.error('3. Restart Railway service after updating');
      }
      
      return health;
    } catch (error) {
      console.error('❌ Cannot reach API:', error);
      console.error('Possible issues:');
      console.error('1. Backend not running');
      console.error('2. Wrong API URL:', API_BASE_URL);
      console.error('3. CORS issues');
      console.error('4. Database migration needed');
      return null;
    }
  },
  
  /**
   * Retry helper for failed requests
   */
  async retryRequest<T>(
    requestFn: () => Promise<T>, 
    maxRetries: number = 3, 
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Don't retry on client errors (4xx)
        if (error instanceof ApiError && error.status && error.status >= 400 && error.status < 500) {
          throw error;
        }
        
        console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      }
    }
    
    throw new Error('Max retries exceeded');
  }
};

// Re-export everything for convenience
export default {
  api: breeamApi,
  useApi,
  utils,
  ApiError,
  API_BASE_URL
}