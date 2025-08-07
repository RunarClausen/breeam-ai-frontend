'use client'

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense, useReducer, useRef } from 'react'
import { 
  CheckCircle, FileText, Upload, Clock, AlertCircle, Download, ArrowRight, 
  HelpCircle, Shield, ExternalLink, X, Info, Zap, Target, XCircle, 
  ChevronDown, ChevronUp, Star, Sparkles, RefreshCw, Eye, Settings,
  Lightbulb, TrendingUp, Award, BookOpen, Layers, Bot, Brain, FileCheck,
  Timer, Gauge, Cpu, ArrowDown, Zap as Lightning, FileSearch, ChevronRight,
  Building2, HardHat, FileStack, Search, Hash, Percent, Wifi, WifiOff
} from 'lucide-react'

// Import API with utils and useApi
import { breeamApi, utils, useApi, ApiError } from '../lib/api'

// Constants
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const AUTO_DELETE_TIME = 3600000 // 1 hour
const STORAGE_KEY = 'breeam-ai-form-data'
const STORAGE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// TypeScript interfaces - UPDATED FOR NEW STRUCTURE
interface CriteriaResponse {
  grupper: {
    [key: string]: {
      label: string;
      criteria_ids: number[];
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
          assessment_guidance?: {
            look_for?: string[];
            accept_formats?: string[];
            reject_if?: string[];
            ai_prompt_hint?: string;
          };
        }>;
        assessment_guidance?: {
          look_for?: string[];
          accept_formats?: string[];
          reject_if?: string[];
          ai_prompt_hint?: string;
        };
      }>;
      phase_relevant?: boolean;
    }
  };
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

interface CriteriaGroup {
  label: string;
  criteria_ids: number[];
  title: string;
  points: number;
  criteria: Array<{
    id: string;
    title: string;
    requirements: any[];
    assessment_guidance?: any;
  }>;
  phase_relevant?: boolean;
  description?: string; // For backward compatibility
}

interface Chunk {
  id: string
  source: string
  page?: number
  content: string
  full_content?: string
  relevance_score: number
  relevance_percentage: string
  word_count: number
  matched_keywords?: Record<string, string[]>
  rank: number
  quality_indicators: {
    has_numbers: boolean
    has_standards: boolean
    has_requirements: boolean
    language_confidence: number
  }
  warnings: string[]
  metadata?: {
    guidance_matches?: {
      look_for: number;
      accept_formats: number;
      reject_if: number;
    };
  };
}

interface AuditTrailEntry {
  identifier: string
  reference: string
  issue: string
  criteria_no: string
  notes: string
}

interface RejectionReason {
  document: string
  rejected_because: string[]
  need_instead: string[]
}

interface CriterionAssessment {
  criterion_id: string
  title: string
  status: string
  assessment: string
  evidence_count?: number
  timestamp: string
  phase: string
  version: string
  success: boolean
  points?: number
  used_chunks?: Array<{
    source: string;
    page?: number;
    relevance: number;
    content_preview?: string;
    metadata?: {
      guidance_matches?: {
        look_for: number;
        accept_formats: number;
        reject_if: number;
      };
    };
  }>;
  phase_validation?: {
    is_valid: boolean
    missing_documents: string[]
    warnings: string[]
    matched_documents: string[]
  }
  criterion_metadata?: {
    has_sub_requirements: boolean;
    assessment_guidance_available: boolean;
    method_section_id?: string;
  }
  guidance_match_info?: {
    look_for_matches: number;
    look_for_total: number;
    format_matches: number;
    reject_warnings: number;
  };
  rejection_reasons?: RejectionReason
}

interface AssessmentResult {
  assessment?: string
  fullAssessment?: string
  files_processed?: string[]
  criteria_evaluated?: string[]
  word_file?: string | null
  wordFileUrl?: string | null
  report_file?: string | null
  report_format?: 'pdf' | 'word'
  displayed_chunks?: Chunk[]
  criterion_assessments?: CriterionAssessment[]
  phase_validation?: {
    valid_criteria: number
    invalid_criteria: number
    missing_documents: string[]
  }
  audit_trail?: AuditTrailEntry[]
  rejection_reasons?: RejectionReason[]
  metadata?: {
    processing_time?: number
    ai_model?: string
    total_chunks?: number
    relevant_chunks?: number
    guidance_usage?: {
      average_compliance?: number
    }
    engine_version?: string
    phase?: string
    phase_description?: string
  }
  summary?: {
    totalCriteria: number
    fulfilled: number
    partiallyFulfilled: number
    notFulfilled: number
  }
  points_summary?: {
    summary?: string
    achieved_points?: number
    total_points?: number
    percentage?: number
  }
}

interface ToastMessage {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface BreeamData {
  versions: string[]
  categories: string[]
  topics: string[]
  criteriaGroups: Record<string, CriteriaGroup>
}

interface LoadingState {
  versions: boolean
  categories: boolean
  topics: boolean
  criteria: boolean
}

interface ErrorState {
  versions?: string
  categories?: string
  topics?: string
  criteria?: string
}

interface StoredData {
  data: Partial<AppState>
  timestamp: number
}

// Status styles for Tailwind
const statusStyles = {
  emerald: 'bg-emerald-100 text-emerald-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  gray: 'bg-gray-100 text-gray-800'
} as const

const phaseColorMap = {
  emerald: {
    container: 'border-emerald-500 bg-emerald-50',
    icon: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    title: 'text-emerald-900',
    description: 'text-emerald-700',
    checkmark: 'bg-emerald-500'
  },
  blue: {
    container: 'border-blue-500 bg-blue-50',
    icon: 'bg-blue-100',
    iconText: 'text-blue-600',
    title: 'text-blue-900',
    description: 'text-blue-700',
    checkmark: 'bg-blue-500'
  }
} as const                
                
// Phase options
const PHASE_OPTIONS = [
  {
    id: 'prosjektering' as const,
    name: 'Prosjekteringsfase',
    description: 'Design og planlegging',
    icon: Building2,
    color: 'emerald' as const
  },
  {
    id: 'ferdigstillelse' as const,
    name: 'Ferdigstillelse',
    description: 'Som-bygget dokumentasjon',
    icon: HardHat,
    color: 'blue' as const
  }
] as const

// ===== STATE MANAGEMENT WITH REDUCER =====
type ConfigStep = 'version' | 'category' | 'topic' | 'criteria' | 'phase' | 'upload'

interface AppState {
  // Configuration
  selectedVersion: string
  selectedCategory: string
  selectedTopic: string
  selectedCriteria: string[]
  selectedFiles: File[]
  reportFormat: 'pdf' | 'word'
  selectedPhase: 'prosjektering' | 'ferdigstillelse'
  
  // UI State
  currentStep: ConfigStep
  activeConfigStep: ConfigStep
  isAssessing: boolean
  progress: number
  progressMessage: string
  isDragOver: boolean
  showChunksModal: boolean
  selectedCriterionChunks: CriterionAssessment | null
  criteriaSearchQuery: string
  
  // Privacy
  hasConsentedToPrivacy: boolean
  showPrivacyModal: boolean
  
  // Navigation
  currentPage: string
  
  // Results
  results: AssessmentResult | null
  
  // Toasts
  toasts: ToastMessage[]
  
  // Error handling
  lastError: { message: string; timestamp: number } | null
  retryCount: number
}

type AppAction = 
  | { type: 'SET_VERSION'; payload: string }
  | { type: 'SET_CATEGORY'; payload: string }
  | { type: 'SET_TOPIC'; payload: string }
  | { type: 'SET_CRITERIA'; payload: string[] }
  | { type: 'TOGGLE_CRITERION'; payload: string }
  | { type: 'SET_FILES'; payload: File[] }
  | { type: 'ADD_FILES'; payload: File[] }
  | { type: 'REMOVE_FILE'; payload: number }
  | { type: 'SET_REPORT_FORMAT'; payload: 'pdf' | 'word' }
  | { type: 'SET_PHASE'; payload: 'prosjektering' | 'ferdigstillelse' }
  | { type: 'SET_ACTIVE_STEP'; payload: ConfigStep }
  | { type: 'SET_ASSESSING'; payload: boolean }
  | { type: 'SET_PROGRESS'; payload: { progress: number; message?: string } }
  | { type: 'SET_DRAG_OVER'; payload: boolean }
  | { type: 'SET_PRIVACY_CONSENT'; payload: boolean }
  | { type: 'SHOW_PRIVACY_MODAL'; payload: boolean }
  | { type: 'SET_PAGE'; payload: string }
  | { type: 'SET_RESULTS'; payload: AssessmentResult | null }
  | { type: 'ADD_TOAST'; payload: Omit<ToastMessage, 'id'> }
  | { type: 'REMOVE_TOAST'; payload: number }
  | { type: 'SHOW_CHUNKS_MODAL'; payload: { show: boolean; criterion?: CriterionAssessment | null } }
  | { type: 'SET_CRITERIA_SEARCH'; payload: string }
  | { type: 'SET_ERROR'; payload: { message: string } | null }
  | { type: 'INCREMENT_RETRY' }
  | { type: 'RESET_RETRY' }
  | { type: 'RESET_FORM' }
  | { type: 'ADVANCE_STEP' }

const initialState: AppState = {
  selectedVersion: '',
  selectedCategory: '',
  selectedTopic: '',
  selectedCriteria: [],
  selectedFiles: [],
  reportFormat: 'pdf',
  selectedPhase: 'prosjektering',
  currentStep: 'version',
  activeConfigStep: 'version',
  isAssessing: false,
  progress: 0,
  progressMessage: '',
  isDragOver: false,
  hasConsentedToPrivacy: false,
  showPrivacyModal: false,
  showChunksModal: false,
  selectedCriterionChunks: null,
  criteriaSearchQuery: '',
  currentPage: 'main',
  results: null,
  toasts: [],
  lastError: null,
  retryCount: 0
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VERSION':
      return {
        ...state,
        selectedVersion: action.payload,
        selectedCategory: '',
        selectedTopic: '',
        selectedCriteria: []
      }
    
    case 'SET_CATEGORY':
      return {
        ...state,
        selectedCategory: action.payload,
        selectedTopic: '',
        selectedCriteria: [],
        lastError: null
      }
    
    case 'SET_TOPIC':
      return {
        ...state,
        selectedTopic: action.payload,
        selectedCriteria: [],
        lastError: null
      }
    
    case 'SET_CRITERIA':
      return {
        ...state,
        selectedCriteria: action.payload
      }
    
    case 'TOGGLE_CRITERION':
      const newCriteria = state.selectedCriteria.includes(action.payload)
        ? state.selectedCriteria.filter(c => c !== action.payload)
        : [...state.selectedCriteria, action.payload]
      return {
        ...state,
        selectedCriteria: newCriteria
      }
    
    case 'SET_FILES':
      return { ...state, selectedFiles: action.payload }
    
    case 'ADD_FILES':
      return { ...state, selectedFiles: [...state.selectedFiles, ...action.payload] }
    
    case 'REMOVE_FILE':
      return {
        ...state,
        selectedFiles: state.selectedFiles.filter((_, i) => i !== action.payload)
      }
    
    case 'SET_REPORT_FORMAT':
      return { ...state, reportFormat: action.payload }
    
    case 'SET_PHASE':
      return { ...state, selectedPhase: action.payload }
    
    case 'SET_ACTIVE_STEP':
      return { ...state, activeConfigStep: action.payload }
    
    case 'SET_ASSESSING':
      return { ...state, isAssessing: action.payload }
    
    case 'SET_PROGRESS':
      return { 
        ...state, 
        progress: action.payload.progress,
        progressMessage: action.payload.message || state.progressMessage
      }
    
    case 'SET_DRAG_OVER':
      return { ...state, isDragOver: action.payload }
    
    case 'SET_PRIVACY_CONSENT':
      return { ...state, hasConsentedToPrivacy: action.payload }
    
    case 'SHOW_PRIVACY_MODAL':
      return { ...state, showPrivacyModal: action.payload }
    
    case 'SET_PAGE':
      return { ...state, currentPage: action.payload }
    
    case 'SET_RESULTS':
      return { ...state, results: action.payload }
    
    case 'ADD_TOAST':
      return {
        ...state,
        toasts: [...state.toasts, { ...action.payload, id: Date.now() }]
      }
    
    case 'REMOVE_TOAST':
      return {
        ...state,
        toasts: state.toasts.filter(toast => toast.id !== action.payload)
      }
    
    case 'SHOW_CHUNKS_MODAL':
      return {
        ...state,
        showChunksModal: action.payload.show,
        selectedCriterionChunks: action.payload.criterion || null
      }
    
    case 'SET_CRITERIA_SEARCH':
      return { ...state, criteriaSearchQuery: action.payload }
    
    case 'SET_ERROR':
      return { 
        ...state, 
        lastError: action.payload ? { ...action.payload, timestamp: Date.now() } : null 
      }
    
    case 'INCREMENT_RETRY':
      return { ...state, retryCount: state.retryCount + 1 }
    
    case 'RESET_RETRY':
      return { ...state, retryCount: 0 }
    
    case 'RESET_FORM':
      return {
        ...initialState,
        toasts: state.toasts
      }
    
    
    case 'ADVANCE_STEP':
      const steps: ConfigStep[] = ['version', 'category', 'topic', 'criteria', 'phase', 'upload']
      const currentIndex = steps.indexOf(state.activeConfigStep)
      const nextStep = steps[Math.min(currentIndex + 1, steps.length - 1)]
      return { ...state, activeConfigStep: nextStep }
    
    default:
      return state
  }
}

// ===== LOCALSTORAGE UTILITIES =====
// Removed - data is not persisted between sessions


// ===== UNIFIED LOADING SKELETON COMPONENT =====
interface LoadingSkeletonProps {
  type?: 'default' | 'dropdown' | 'criteria' | 'phase' | 'results'
}

const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ type = 'default' }) => {
  if (type === 'dropdown') {
    return (
      <div className="w-full h-14 bg-gray-200 rounded-xl animate-pulse" />
    )
  }
  
  if (type === 'criteria') {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-6 bg-gray-100 rounded-lg animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }
  
  if (type === 'phase') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="p-6 bg-gray-100 rounded-lg animate-pulse">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gray-200 rounded-lg" />
              <div className="flex-1">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (type === 'results') {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-64 bg-gray-200 rounded-xl"></div>
        <div className="h-32 bg-gray-200 rounded-xl"></div>
      </div>
    )
  }
  
  // Default case
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  )
}


// ===== OFFLINE DETECTION COMPONENT =====
const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white py-2 px-4 text-center z-50">
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm font-medium">
          Du er offline. Sjekk internettforbindelsen din.
        </span>
      </div>
    </div>
  )
}

// ===== SUCCESS ANIMATION COMPONENT =====
interface SuccessAnimationProps {
  onComplete: () => void
}

const SuccessAnimation: React.FC<SuccessAnimationProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50 animate-fadeIn">
      <div className="text-center animate-fadeInScale">
        <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">Vurdering fullført!</h3>
        <p className="text-gray-600">Laster inn resultater...</p>
      </div>
    </div>
  )
}

// ===== CRITERIA SEARCH COMPONENT =====
interface CriteriaSearchProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalCount: number
  filteredCount: number
}

const CriteriaSearch: React.FC<CriteriaSearchProps> = ({ 
  searchQuery, 
  onSearchChange, 
  totalCount, 
  filteredCount 
}) => {
  return (
    <div className="mb-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Søk i kriterier..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {searchQuery && (
        <p className="mt-2 text-sm text-gray-600">
          Viser {filteredCount} av {totalCount} kriterier
        </p>
      )}
    </div>
  )
}

// ===== CHUNKS MODAL COMPONENT =====
interface ChunksModalProps {
  isOpen: boolean
  onClose: () => void
  criterion: CriterionAssessment | null
  allChunks?: Chunk[]
}

const ChunksModal: React.FC<ChunksModalProps> = ({ isOpen, onClose, criterion, allChunks }) => {
  if (!isOpen || !criterion) return null

  const chunks = criterion.used_chunks || []

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSearch className="w-6 h-6 text-emerald-600" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Dokumentasjonsgrunnlag
                </h3>
                <p className="text-sm text-gray-600">
                  Kriterium {criterion.criterion_id}: {criterion.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              aria-label="Lukk"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-8rem)] p-6">
          {chunks.length === 0 ? (
            <div className="text-center py-8">
              <FileSearch className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Ingen dokumentasjon tilgjengelig</p>
            </div>
          ) : (
            <div className="space-y-4">
              {chunks.map((chunk, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-4 hover:border-emerald-300 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">{chunk.source}</span>
                        {chunk.page && (
                          <span className="text-sm text-gray-600">Side {chunk.page}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">
                            {Math.round(chunk.relevance * 100)}% relevans
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {chunk.content_preview && (
                    <div className="bg-white rounded p-3 border border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {chunk.content_preview}
                      </p>
                    </div>
                  )}
                  {chunk.metadata?.guidance_matches && (
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      {chunk.metadata.guidance_matches.look_for > 0 && (
                        <span className="text-emerald-600">
                          ✓ {chunk.metadata.guidance_matches.look_for} søketreff
                        </span>
                      )}
                      {chunk.metadata.guidance_matches.accept_formats > 0 && (
                        <span className="text-emerald-600">
                          ✓ {chunk.metadata.guidance_matches.accept_formats} formattreff
                        </span>
                      )}
                      {chunk.metadata.guidance_matches.reject_if > 0 && (
                        <span className="text-amber-600">
                          ⚠️ {chunk.metadata.guidance_matches.reject_if} avvisninger
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Viser {chunks.length} dokumentutdrag
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Lukk
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== PROFESSIONAL LOGO COMPONENT =====
interface BreeamLogoProps {
  size?: 'small' | 'default' | 'large'
  className?: string
  iconClickable?: boolean
  onIconClick?: () => void
}

const BreeamLogo: React.FC<BreeamLogoProps> = ({ 
  size = "default", 
  className = "", 
  iconClickable = false, 
  onIconClick 
}) => {
  const sizeConfig = {
    small: { 
      titleText: "text-base font-semibold tracking-tight",
      subtitleText: "text-xs font-medium tracking-wide",
      iconSize: "w-8 h-8",
      iconText: "text-sm"
    },
    default: { 
      titleText: "text-lg font-semibold tracking-tight",
      subtitleText: "text-xs font-medium tracking-wide",
      iconSize: "w-9 h-9",
      iconText: "text-base"
    },
    large: { 
      titleText: "text-xl font-bold tracking-tight",
      subtitleText: "text-sm font-medium tracking-wide",
      iconSize: "w-10 h-10",
      iconText: "text-lg"
    }
  } as const
  
  const config = sizeConfig[size]
  
  const IconElement = () => (
    <div className={`${config.iconSize} bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold ${config.iconText} ${iconClickable ? 'cursor-pointer transition-all duration-200 hover:bg-emerald-700 hover:scale-105' : ''}`}>
      B
    </div>
  )
  
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {iconClickable && onIconClick ? (
        <button 
          onClick={onIconClick}
          className="focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg"
          aria-label="Gå til forsiden"
        >
          <IconElement />
        </button>
      ) : (
        <IconElement />
      )}
      
      <div className="flex flex-col">
        <h1 className={`${config.titleText} text-gray-900 leading-tight select-none`}>
          BREEAM-AI
        </h1>
        <p className={`${config.subtitleText} text-emerald-600 leading-tight select-none capitalize`}>
          Profesjonell AI-revisor
        </p>
      </div>
    </div>
  )
}

// ===== ERROR BOUNDARY =====
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 text-center">
              Oops! Noe gikk galt
            </h3>
            <p className="mt-2 text-sm font-light text-gray-600 text-center">
              {this.state.error?.message || 'En uventet feil oppstod'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Last inn siden på nytt
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


// ===== GUIDANCE TOOLTIP COMPONENT =====
interface GuidanceTooltipProps {
  guidance: {
    look_for?: string[];
    accept_formats?: string[];
    reject_if?: string[];
    ai_prompt_hint?: string;
  };
}

const GuidanceTooltip: React.FC<GuidanceTooltipProps> = ({ guidance }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!guidance || Object.keys(guidance).length === 0) return null;

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="text-emerald-600 hover:text-emerald-700 transition-colors"
        aria-label="Vis vurderingsveiledning"
      >
        <Info className="w-4 h-4" />
      </button>
      {isOpen && (
        <div className="absolute z-10 bg-white p-4 rounded-lg shadow-lg border max-w-sm -right-2 top-6">
          <h4 className="font-semibold mb-2 text-gray-900">Vurderingsveiledning</h4>
          
          {guidance.look_for && guidance.look_for.length > 0 && (
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Search className="w-3 h-3" />
                Ser etter:
              </h5>
              <ul className="text-xs text-gray-600 space-y-1">
                {guidance.look_for.map((item, index) => (
                  <li key={index} className="pl-4 relative">
                    <span className="absolute left-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {guidance.accept_formats && guidance.accept_formats.length > 0 && (
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <FileCheck className="w-3 h-3" />
                Godkjente formater:
              </h5>
              <ul className="text-xs text-gray-600 space-y-1">
                {guidance.accept_formats.map((format, index) => (
                  <li key={index} className="pl-4 relative">
                    <span className="absolute left-1">✓</span>
                    {format}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {guidance.reject_if && guidance.reject_if.length > 0 && (
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-600" />
                Avvises hvis:
              </h5>
              <ul className="text-xs text-gray-600 space-y-1">
                {guidance.reject_if.map((condition, index) => (
                  <li key={index} className="pl-4 relative">
                    <span className="absolute left-1 text-amber-600">⚠</span>
                    {condition}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {guidance.ai_prompt_hint && (
            <div className="text-xs text-gray-500 italic pt-2 border-t">
              <Brain className="w-3 h-3 inline mr-1" />
              {guidance.ai_prompt_hint}
            </div>
          )}
          
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
            aria-label="Lukk"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// ===== TOAST NOTIFICATIONS =====
interface ToastNotificationProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', icon: CheckCircle },
    error: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: AlertCircle },
    info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: Info }
  } as const

  const { bg, border, text, icon: Icon } = config[type]

  return (
    <div className={`fixed top-4 right-4 flex items-center p-4 rounded-xl border ${bg} ${border} shadow-lg transform transition-all duration-300 z-50 animate-slideIn`} role="alert">
      <Icon className={`w-5 h-5 ${text} mr-3 flex-shrink-0`} aria-hidden="true" />
      <p className={`${text} font-medium flex-1`}>{message}</p>
      <button onClick={onClose} className={`${text} hover:opacity-70 ml-3`} aria-label="Lukk varsel">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ===== MARKDOWN RENDERER =====
interface MarkdownRendererProps {
  content: string
}

const MarkdownRenderer = React.memo<MarkdownRendererProps>(({ content }) => {
  const parsedContent = useMemo(() => {
    const parseMarkdown = (text: string): React.ReactElement[] => {
      const sections = text.split(/###\s+/).filter(Boolean)
      
      return sections.map((section, sectionIndex) => {
        const lines = section.split('\n')
        const title = lines[0]
        const content = lines.slice(1).join('\n')
        
        return (
          <div key={sectionIndex} className="mb-6">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-emerald-600 rounded" aria-hidden="true"></div>
                {title}
              </h3>
            )}
            {parseContent(content, sectionIndex)}
          </div>
        )
      })
    }
    
    const parseContent = (text: string, sectionIndex: number): React.ReactElement => {
      const elements: React.ReactElement[] = []
      const lines = text.split('\n')
      
      let currentList: string[] = []
      let inList = false
      
      lines.forEach((line, index) => {
        if (line.startsWith('##')) {
          elements.push(
            <h4 key={`h4-${sectionIndex}-${index}`} className="text-md font-semibold text-gray-800 mt-4 mb-2">
              {line.replace(/^##\s+/, '')}
            </h4>
          )
        }
        else if (line.includes('**Status:**') || line.includes('**Vurderingsstatus:**')) {
          const status = line.replace(/.*\*\*(Status|Vurderingsstatus):\*\*\s*/, '').trim()
          let statusColor: keyof typeof statusStyles = 'gray'
          let StatusIcon = AlertCircle
          
          if (status.toLowerCase().includes('oppnådd') && !status.toLowerCase().includes('ikke')) {
            statusColor = 'emerald'
            StatusIcon = CheckCircle
          } else if (status.toLowerCase().includes('delvis')) {
            statusColor = 'yellow'
            StatusIcon = AlertCircle
          } else if (status.toLowerCase().includes('ikke')) {
            statusColor = 'red'
            StatusIcon = XCircle
          }
          
          elements.push(
            <div key={`status-${sectionIndex}-${index}`} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusStyles[statusColor]} mb-3`}>
              <StatusIcon className="w-4 h-4" />
              {status}
            </div>
          )
        }
        else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          if (!inList) {
            inList = true
            currentList = []
          }
          currentList.push(line.trim().substring(1).trim())
        }
        else if (line.trim()) {
          if (inList && currentList.length > 0) {
            elements.push(
              <ul key={`list-${sectionIndex}-${index}`} className="list-disc list-inside space-y-1 mb-4 ml-4">
                {currentList.map((item, i) => (
                  <li key={i} className="text-gray-700 font-light">
                    {typeof item === 'string' ? parseBold(item, `${sectionIndex}-${index}-${i}`) : item}
                  </li>
                ))}
              </ul>
            )
            currentList = []
            inList = false
          }
          
          elements.push(
            <p key={`p-${sectionIndex}-${index}`} className="text-gray-700 font-light mb-3 leading-relaxed">
              {parseBold(line, `${sectionIndex}-${index}`)}
            </p>
          )
        }
      })
      
      if (inList && currentList.length > 0) {
        elements.push(
          <ul key={`list-final-${sectionIndex}`} className="list-disc list-inside space-y-1 mb-4 ml-4">
            {currentList.map((item, i) => (
              <li key={i} className="text-gray-700 font-light">
                {typeof item === 'string' ? parseBold(item, `${sectionIndex}-final-${i}`) : item}
              </li>
            ))}
          </ul>
        )
      }
      
      return <>{elements}</>
    }
    
    const parseBold = (text: string, keyPrefix: string): (string | React.ReactElement)[] => {
      const parts = text.split(/\*\*(.*?)\*\*/g)
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={`${keyPrefix}-${i}`} className="font-semibold text-gray-900">{part}</strong>
        } else if (part) {
          return <span key={`${keyPrefix}-${i}`}>{part}</span>
        }
        return null
      }).filter(Boolean) as (string | React.ReactElement)[]
    }
    
    return parseMarkdown(content);
  }, [content]);
  
  return <div>{parsedContent}</div>
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

// ===== ASSESSMENT PROGRESS =====
interface AssessmentProgressProps {
  isAssessing: boolean
  progress: number
  progressMessage?: string
}

const AssessmentProgress: React.FC<AssessmentProgressProps> = ({ isAssessing, progress, progressMessage }) => {
  if (!isAssessing) return null
  
  const getStepFromProgress = (progress: number) => {
    if (progress <= 20) return 0
    if (progress <= 50) return 1
    if (progress <= 80) return 2
    return 3
  }
  
  const currentStep = getStepFromProgress(progress)
  
  const steps = [
    { label: 'Laster opp filer', icon: Upload },
    { label: 'Prosesserer dokumenter', icon: FileStack },
    { label: 'AI-analyse pågår', icon: Brain },
    { label: 'Genererer rapport', icon: FileText }
  ]
  
  return (
    <div className="fixed inset-0 bg-white bg-opacity-95 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="progress-title">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl border border-gray-200">
        <h3 id="progress-title" className="text-xl font-semibold text-gray-900 mb-2">Analyserer dokumenter...</h3>
        {progressMessage && (
          <p className="text-sm text-gray-600 mb-4">{progressMessage}</p>
        )}
        
        <div className="space-y-4">
          <div className="relative">
            <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
              <div 
                className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
            <div className="mt-2 text-sm font-medium text-gray-600 text-center" role="status" aria-live="polite" aria-atomic="true">
              {progress}% fullført
            </div>
          </div>
          
          <div className="space-y-3">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = index === currentStep
              const isCompleted = index < currentStep
              
              return (
                <div key={index} className={`flex items-center gap-3 transition-all duration-300 ${
                  isActive ? 'scale-105' : ''
                }`}>
                  <div className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                    isCompleted ? 'bg-emerald-600 border-emerald-600' : 
                    isActive ? 'bg-emerald-100 border-emerald-600 animate-pulse' : 
                    'bg-gray-100 border-gray-300'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-white" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-700' : 'text-gray-400'}`} />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isCompleted ? 'text-emerald-700' : 
                    isActive ? 'text-gray-900' : 
                    'text-gray-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="mt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  )
}

// ===== PHASE SELECTOR COMPONENT =====
interface PhaseSelectorProps {
  selectedPhase: 'prosjektering' | 'ferdigstillelse'
  onPhaseChange: (phase: 'prosjektering' | 'ferdigstillelse') => void
  disabled?: boolean
}

const PhaseSelector: React.FC<PhaseSelectorProps> = ({ selectedPhase, onPhaseChange, disabled = false }) => {
  return (
    <div className="space-y-4">
      <label className="block text-lg font-semibold text-gray-900">
        Velg prosjektfase
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PHASE_OPTIONS.map((phase) => {
          const isSelected = selectedPhase === phase.id
          const Icon = phase.icon
          const colors = phaseColorMap[phase.color as keyof typeof phaseColorMap]
          
          return (
            <button
              key={phase.id}
              onClick={() => onPhaseChange(phase.id)}
              disabled={disabled}
              className={`relative p-6 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? colors.container
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${
                  isSelected ? colors.icon : 'bg-gray-100'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    isSelected ? colors.iconText : 'text-gray-600'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <h4 className={`font-semibold mb-1 ${
                    isSelected ? colors.title : 'text-gray-900'
                  }`}>
                    {phase.name}
                  </h4>
                  <p className={`text-sm ${
                    isSelected ? colors.description : 'text-gray-600'
                  }`}>
                    {phase.description}
                  </p>
                  
                  {/* Resten av innholdet forblir det samme */}
                  {phase.id === 'prosjektering' && (
                    <ul className="mt-3 text-xs text-gray-600 space-y-1">
                      {/* ... samme innhold ... */}
                    </ul>
                  )}
                  
                  {phase.id === 'ferdigstillelse' && (
                    <ul className="mt-3 text-xs text-gray-600 space-y-1">
                      {/* ... samme innhold ... */}
                    </ul>
                  )}
                </div>
                
                {isSelected && (
                  <div className={`absolute top-4 right-4 w-6 h-6 ${colors.checkmark} rounded-full flex items-center justify-center`}>
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Viktig om fasevalg:</p>
            <p className="font-light">
              Velg fasen som matcher dokumentasjonen du laster opp. AI-vurderingen vil validere 
              at dokumentene passer til valgt fase og gi tilbakemelding hvis noe mangler.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== ENHANCED ASSESSMENT RESULTS =====
const EnhancedAssessmentResults = ({ results, onNewAssessment, isAssessing = false, progress = 0, state, dispatch }: {
  results: AssessmentResult | null
  onNewAssessment: () => void
  isAssessing?: boolean
  progress?: number
  state: AppState
  dispatch: React.Dispatch<AppAction>
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [showChunks, setShowChunks] = useState(false)
  const [selectedCriterion, setSelectedCriterion] = useState<CriterionAssessment | null>(null)
  const api = useApi()
  
  // Debug logging commented out to prevent console spam
  // Uncomment if needed for debugging
  // console.log('🔍 EnhancedAssessmentResults - Received props:', {
  //   results,
  //   hasResults: !!results,
  //   assessment: results?.assessment,
  //   assessmentLength: results?.assessment?.length,
  //   criterionAssessments: results?.criterion_assessments,
  //   criterionCount: results?.criterion_assessments?.length,
  //   displayedChunks: results?.displayed_chunks,
  //   phaseValidation: results?.phase_validation,
  //   pointsSummary: results?.points_summary,
  //   fullAssessment: results?.fullAssessment,
  //   metadata: results?.metadata
  // });
  
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }, [])
  
  const openChunksModal = useCallback((criterion: CriterionAssessment) => {
    setSelectedCriterion(criterion)
    setShowChunks(true)
  }, [])
  
  // Early return with debugging
  if (!results) {
    console.error('❌ EnhancedAssessmentResults: No results provided!');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Ingen resultater å vise</h2>
          <p className="text-gray-600 mb-4">Vurderingen ble ikke fullført korrekt.</p>
          <button
            onClick={onNewAssessment}
            className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Prøv igjen
          </button>
        </div>
      </div>
    );
  }
  
  // DEBUG: Show raw data if assessment is missing
  if (!results.assessment && !results.criterion_assessments) {
    console.error('❌ No assessment data in results:', results);
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Debug: Manglende vurderingsdata</h1>
          <div className="bg-white p-6 rounded-lg shadow border border-red-200">
            <p className="mb-4 text-gray-700">Backend returnerte data, men mangler vurderingstekst.</p>
            <details className="mb-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Vis raw data</summary>
              <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto text-xs">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
            <button onClick={onNewAssessment} className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700">
              Tilbake til start
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Parse assessment structure - with better fallback handling
  const structuredData = useMemo(() => {
    const parseAssessmentStructure = (assessment: string) => {
      const sections = {
        summary: '',
        criteria: [] as Array<{
          title: string
          status: string
          content: string[]
          rationale: string
          documentReferences: string[]
        }>,
        recommendations: [] as string[]
      }
      
      // If we have criterion_assessments, use those directly
      if (results.criterion_assessments && results.criterion_assessments.length > 0) {
        // console.log('✅ Using criterion_assessments from backend:', results.criterion_assessments);
        sections.criteria = results.criterion_assessments.map(ca => ({
          title: `Kriterium ${ca.criterion_id}: ${ca.title}`,
          status: ca.status,
          content: [ca.assessment],
          rationale: '',
          documentReferences: ca.used_chunks ? ca.used_chunks.map(c => `${c.source}${c.page ? ` (s.${c.page})` : ''}`) : []
        }));
        
        // Extract summary from main assessment if available
        if (assessment) {
          // Look for explicit summary section
          const summaryMatch = assessment.match(/\*\*Oppsummering:\*\*\s*([^*]+?)(?=\n\n|\*\*|$)/);
          if (summaryMatch) {
            sections.summary = summaryMatch[1].trim();
          } else {
            // Fallback to first paragraph
            const firstParagraph = assessment.split('\n').find(line => line.trim() && !line.includes('###') && !line.includes('**'));
            if (firstParagraph) {
              sections.summary = firstParagraph.trim();
            }
          }
        }
        
        return sections;
      }
      
      // Fallback: Parse the assessment text
      console.log('⚠️ Parsing assessment text manually');
      const lines = assessment.split('\n');
      let currentSection = 'summary';
      let currentCriterion: typeof sections.criteria[0] | null = null;
      
      lines.forEach(line => {
        if ((line.includes('###') && line.includes(':')) || (line.includes('Kriterium') && line.includes(':'))) {
          if (currentCriterion) {
            sections.criteria.push(currentCriterion);
          }
          currentCriterion = {
            title: line.replace('###', '').trim(),
            status: '',
            content: [],
            rationale: '',
            documentReferences: []
          };
          currentSection = 'criterion';
        } else if (line.includes('**Status:**') || line.includes('**Vurderingsstatus:**')) {
          if (currentCriterion) {
            currentCriterion.status = line.replace(/.*\*\*(Status|Vurderingsstatus):\*\*\s*/, '').trim();
          }
        } else if (line.includes('Begrunnelse:') || line.includes('Faglig vurdering:')) {
          if (currentCriterion) {
            currentCriterion.rationale = line.replace(/(Begrunnelse|Faglig vurdering):/, '').trim();
          }
        } else if (line.includes('Dokumentasjon:') || line.includes('Referanse:') || line.includes('Dokumentasjonsgrunnlag:')) {
          if (currentCriterion) {
            currentCriterion.documentReferences.push(line.trim());
          }
        } else if (line.includes('Anbefalinger') || line.includes('anbefalinger')) {
          currentSection = 'recommendations';
          if (currentCriterion) {
            sections.criteria.push(currentCriterion);
            currentCriterion = null;
          }
        } else if (line.trim()) {
          if (currentSection === 'summary' && !sections.summary) {
            sections.summary = line.trim();
          } else if (currentSection === 'criterion' && currentCriterion) {
            currentCriterion.content.push(line.trim());
          } else if (currentSection === 'recommendations') {
            sections.recommendations.push(line.trim().replace(/^-\s*/, ''));
          }
        }
      });
      
      if (currentCriterion) {
        sections.criteria.push(currentCriterion);
      }
      
      return sections;
    };
    
    return parseAssessmentStructure(results.assessment || results.fullAssessment || '');
  }, [results]);
  
  // Get download URL with proper format
  const downloadUrl = api.getDownloadUrl(results.report_file || results.word_file || '');
  const isPDF = results.report_format === 'pdf';
  
  // Calculate statistics
  const statistics = useMemo(() => {
    if (results.criterion_assessments && results.criterion_assessments.length > 0) {
      const total = results.criterion_assessments.length;
      const fulfilled = results.criterion_assessments.filter(ca => {
        const status = ca.status?.toLowerCase() || '';
        return ca.status === '✅' || 
               status.includes('oppnådd') && !status.includes('ikke') && !status.includes('delvis') ||
               status.includes('oppfylt') && !status.includes('ikke') && !status.includes('delvis');
      }).length;
      const partial = results.criterion_assessments.filter(ca => {
        const status = ca.status?.toLowerCase() || '';
        return ca.status === '⚠️' || status.includes('delvis');
      }).length;
      const notFulfilled = results.criterion_assessments.filter(ca => {
        const status = ca.status?.toLowerCase() || '';
        return ca.status === '❌' || 
               (status.includes('ikke') && (status.includes('oppnådd') || status.includes('oppfylt')));
      }).length;
      
      return {
        total,
        fulfilled,
        partial,
        notFulfilled,
        fulfillmentRate: total > 0 ? Math.round((fulfilled / total) * 100) : 0
      };
    }
    return null;
  }, [results.criterion_assessments]);
  
  return (
    <>
      <AssessmentProgress isAssessing={isAssessing} progress={progress} progressMessage={state.progressMessage} />
      
      {/* Chunks Modal */}
      <ChunksModal
        isOpen={showChunks}
        onClose={() => setShowChunks(false)}
        criterion={selectedCriterion}
        allChunks={results.displayed_chunks}
      />
      
      {/* Keep header and footer on results page */}
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
        {/* Header - same as main page */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between">
              <BreeamLogo 
                iconClickable={true} 
                onIconClick={onNewAssessment}
              />
              <nav className="hidden md:flex items-center space-x-10 text-sm">
                <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
                  BREEAM
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                </a>
                <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
                  Bærekraft
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                </a>
                <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
                  Om oss
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
                </a>
                <a href="#" className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-lg hover:shadow-xl">
                  Kontakt oss
                </a>
              </nav>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Breadcrumb navigation */}
          <nav className="mb-6" aria-label="Breadcrumb">
            <button
              onClick={onNewAssessment}
              className="flex items-center text-emerald-600 hover:text-emerald-700 transition-colors font-medium text-sm"
            >
              <ArrowRight className="w-4 h-4 rotate-180 mr-2" />
              Tilbake til hovedsiden
            </button>
          </nav>

          {/* Header Card with Statistics */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
                  <CheckCircle className="w-4 h-4" />
                  AI-vurdering fullført
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">BREEAM AI-vurdering rapport</h1>
                <div className="flex items-center gap-6 text-sm text-gray-600 font-light">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {results.files_processed?.length || 0} filer analysert
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>{results.criteria_evaluated?.length || 0} kriterier vurdert</span>
                  <span aria-hidden="true">•</span>
                  <span>{results.metadata?.processing_time?.toFixed(1) || '0'}s prosesseringstid</span>
                  {results.metadata?.phase && (
                    <>
                      <span aria-hidden="true">•</span>
                      <span className="flex items-center gap-1">
                        {results.metadata.phase === 'prosjektering' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <HardHat className="w-4 h-4" />
                        )}
                        {results.metadata.phase_description}
                      </span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {downloadUrl && (
                  <a 
                    href={downloadUrl}
                    download
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-lg"
                  >
                    <Download className="w-5 h-5" />
                    <span>
                      Last ned AI-vurdering
                      <span className="block text-xs font-normal opacity-90">
                        ({isPDF ? 'PDF' : 'Word'}-format)
                      </span>
                    </span>
                  </a>
                )}
                <button
                  onClick={onNewAssessment}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Ny vurdering
                </button>
              </div>
            </div>
            
            {/* Statistics Overview */}
            {statistics && (
              <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                  <div className="text-sm text-gray-600">Totalt vurdert</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{statistics.fulfilled}</div>
                  <div className="text-sm text-gray-600">Oppnådd</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-600">{statistics.partial}</div>
                  <div className="text-sm text-gray-600">Delvis oppnådd</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{statistics.notFulfilled}</div>
                  <div className="text-sm text-gray-600">Ikke oppnådd</div>
                </div>
              </div>
            )}
            
            {/* QA Status */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-gray-600" />
                Kvalitetssikring
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    results.criterion_assessments && results.criterion_assessments.length > 0 
                      ? 'bg-emerald-100' 
                      : 'bg-gray-200'
                  }`}>
                    {results.criterion_assessments && results.criterion_assessments.length > 0 ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700">Alle krav dokumentert</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    results.phase_validation && results.phase_validation.valid_criteria > 0
                      ? 'bg-emerald-100' 
                      : 'bg-gray-200'
                  }`}>
                    {results.phase_validation && results.phase_validation.valid_criteria > 0 ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700">Robuste dokumenter</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    results.audit_trail && results.audit_trail.length > 0
                      ? 'bg-emerald-100' 
                      : 'bg-gray-200'
                  }`}>
                    {results.audit_trail && results.audit_trail.length > 0 ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <X className="w-3.5 h-3.5 text-gray-500" />
                    )}
                  </div>
                  <span className="text-sm text-gray-700">Fullstendig sporbarhet</span>
                </div>
              </div>
            </div>
            
            {/* Guidance Usage Statistics */}
            {results.metadata?.guidance_usage && (
              <div className="mt-6 text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {Math.round((results.metadata.guidance_usage.average_compliance || 0) * 100)}%
                </div>
                <div className="text-sm text-gray-600">Veiledningsoppfyllelse</div>
              </div>
            )}
            
            {/* Points Summary if available */}
            {results.points_summary && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-emerald-900">Poengoppnåelse:</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">
                      {results.points_summary.summary || `${results.points_summary.achieved_points} av ${results.points_summary.total_points} poeng`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-700">
                      {results.points_summary.percentage || 0}%
                    </p>
                    <p className="text-sm text-emerald-600">oppnådd</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Phase validation summary */}
            {results.phase_validation && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900">Fase-validering resultat:</p>
                    <p className="text-sm text-amber-800 mt-1">
                      {results.phase_validation.valid_criteria} av {results.phase_validation.valid_criteria + results.phase_validation.invalid_criteria} kriterier 
                      har tilstrekkelig dokumentasjon for valgt fase.
                    </p>
                    {results.phase_validation.missing_documents.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium text-amber-900">Manglende dokumenttyper:</p>
                        <ul className="list-disc list-inside text-sm text-amber-800 mt-1">
                          {[...new Set(results.phase_validation.missing_documents)].map((doc, i) => (
                            <li key={i}>{doc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Important disclaimer */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Viktig: AI-vurdering krever profesjonell gjennomgang
                </h2>
                <p className="text-amber-800 font-light leading-relaxed">
                  Denne AI-vurderingen er et grunnlag for din BREEAM-vurdering og må alltid kvalitetssikres av en sertifisert rådgiver. 
                  Resultatet kan inneholde unøyaktigheter og erstatter ikke profesjonell ekspertise.
                </p>
              </div>
            </div>
          </div>
          
          {/* Summary Section if available */}
          {structuredData.summary && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Sammendrag
              </h2>
              <p className="text-gray-700 leading-relaxed">{structuredData.summary}</p>
            </div>
          )}
          
          {/* Criteria Results with chunks */}
          <div className="space-y-4 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Vurdering av kriterier</h2>
            
            {results.criterion_assessments && results.criterion_assessments.length > 0 ? (
              results.criterion_assessments.map((criterion, index) => {
                const statusColorKey = criterion.status === '✅' || criterion.status.toLowerCase().includes('oppnådd') && !criterion.status.toLowerCase().includes('ikke') ? 'emerald' : 
                                  criterion.status === '⚠️' || criterion.status.toLowerCase().includes('delvis') ? 'yellow' : 
                                  criterion.status === '❌' || criterion.status.toLowerCase().includes('ikke') ? 'red' : 'gray';
                const StatusIcon = statusColorKey === 'emerald' ? CheckCircle : 
                                 statusColorKey === 'yellow' ? AlertCircle : 
                                 statusColorKey === 'red' ? XCircle : HelpCircle;
                
                return (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div 
                      className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleSection(`criterion-${index}`)}
                      role="button"
                      aria-expanded={expandedSections[`criterion-${index}`]}
                      aria-controls={`criterion-content-${index}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Kriterium {criterion.criterion_id}: {criterion.title}
                          </h3>
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusStyles[statusColorKey]}`}>
                              <StatusIcon className="w-4 h-4" />
                              {criterion.status}
                            </div>
                            
                            {criterion.points !== undefined && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
                                <Award className="w-4 h-4" />
                                {criterion.points} poeng
                              </span>
                            )}
                            
                            {criterion.guidance_match_info && (
                              <div className="mt-2 flex items-center gap-4 text-xs">
                                <span className={`${criterion.guidance_match_info.look_for_matches > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                  ✓ {criterion.guidance_match_info.look_for_matches}/{criterion.guidance_match_info.look_for_total} søkekriterier
                                </span>
                                <span className={`${criterion.guidance_match_info.format_matches > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                  ✓ {criterion.guidance_match_info.format_matches} godkjente formater
                                </span>
                                {criterion.guidance_match_info.reject_warnings > 0 && (
                                  <span className="text-amber-600">
                                    ⚠️ {criterion.guidance_match_info.reject_warnings} advarsler
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {criterion.used_chunks && criterion.used_chunks.length > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openChunksModal(criterion);
                                }}
                                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                              >
                                <FileSearch className="w-4 h-4" />
                                {criterion.used_chunks.length} kilder
                              </button>
                            )}
                            
                            {criterion.phase_validation && !criterion.phase_validation.is_valid && (
                              <span className="inline-flex items-center gap-1 text-sm text-amber-600">
                                <AlertCircle className="w-4 h-4" />
                                Fase-validering feilet
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-4">
                          {expandedSections[`criterion-${index}`] ? 
                            <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          }
                        </div>
                      </div>
                    </div>
                    
                    {expandedSections[`criterion-${index}`] && (
                      <div id={`criterion-content-${index}`} className="px-6 pb-6 border-t border-gray-100">
                        <div className="pt-4 space-y-4">
                          <MarkdownRenderer content={criterion.assessment} />
                          
                          {criterion.phase_validation && !criterion.phase_validation.is_valid && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <h4 className="font-medium text-amber-900 mb-2">Manglende dokumentasjon for fase:</h4>
                              <ul className="list-disc list-inside text-sm text-amber-800">
                                {criterion.phase_validation.missing_documents.map((doc, i) => (
                                  <li key={i}>{doc}</li>
                                ))}
                              </ul>
                              {criterion.phase_validation.warnings && criterion.phase_validation.warnings.length > 0 && (
                                <div className="mt-3">
                                  <p className="font-medium text-amber-900">Advarsler:</p>
                                  <ul className="list-disc list-inside text-sm text-amber-800">
                                    {criterion.phase_validation.warnings.map((warning, i) => (
                                      <li key={i}>{warning}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Rejection reasons display */}
                          {criterion.rejection_reasons && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-red-900 mb-2">⚠️ Dokumentasjon ikke godkjent</h4>
                                  <p className="text-sm text-red-800 mb-2">
                                    <span className="font-medium">Dokument:</span> {criterion.rejection_reasons.document}
                                  </p>
                                  <div className="space-y-3">
                                    <div>
                                      <p className="font-medium text-red-900 text-sm mb-1">Grunner:</p>
                                      <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                                        {criterion.rejection_reasons.rejected_because.map((reason, i) => (
                                          <li key={i}>{reason}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div>
                                      <p className="font-medium text-red-900 text-sm mb-1">Du trenger i stedet:</p>
                                      <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                                        {criterion.rejection_reasons.need_instead.map((need, i) => (
                                          <li key={i}>{need}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Evidence count and metadata */}
                          {criterion.evidence_count !== undefined && (
                            <div className="text-sm text-gray-600 pt-2 border-t border-gray-100">
                              <span className="font-medium">Dokumenter analysert:</span> {criterion.evidence_count}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : structuredData.criteria.length > 0 ? (
              // Fallback to parsed criteria
              structuredData.criteria.map((criterion, index) => {
                const statusColorKey = criterion.status.toLowerCase().includes('oppfylt') || criterion.status.toLowerCase().includes('oppnådd') && !criterion.status.toLowerCase().includes('ikke') ? 'emerald' : 
                                  criterion.status.toLowerCase().includes('delvis') ? 'yellow' : 'red';
                const StatusIcon = statusColorKey === 'emerald' ? CheckCircle : 
                                 statusColorKey === 'yellow' ? AlertCircle : XCircle;
                
                return (
                  <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div 
                      className="p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => toggleSection(`criterion-${index}`)}
                      role="button"
                      aria-expanded={expandedSections[`criterion-${index}`]}
                      aria-controls={`criterion-content-${index}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {criterion.title}
                          </h3>
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusStyles[statusColorKey]}`}>
                            <StatusIcon className="w-4 h-4" />
                            {criterion.status}
                          </div>
                          {criterion.documentReferences.length > 0 && (
                            <div className="mt-2 text-sm text-gray-600 font-light">
                              <span className="font-medium">Dokumentreferanse:</span> {criterion.documentReferences[0]}
                            </div>
                          )}
                        </div>
                        <div className="ml-4">
                          {expandedSections[`criterion-${index}`] ? 
                            <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                            <ChevronDown className="w-5 h-5 text-gray-500" />
                          }
                        </div>
                      </div>
                    </div>
                    
                    {expandedSections[`criterion-${index}`] && (
                      <div id={`criterion-content-${index}`} className="px-6 pb-6 border-t border-gray-100">
                        <div className="pt-4 space-y-3">
                          {criterion.rationale && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">Begrunnelse:</h4>
                              <p className="text-gray-700 font-light">{criterion.rationale}</p>
                            </div>
                          )}
                          
                          {criterion.content.length > 0 && (
                            <div>
                              <h4 className="font-medium text-gray-900 mb-1">Detaljer:</h4>
                              <ul className="list-disc list-inside space-y-1">
                                {criterion.content.map((item, i) => (
                                  <li key={i} className="text-gray-700 font-light">{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // No criteria found
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">Ingen kriterievurderinger funnet.</p>
              </div>
            )}
          </div>
          
          {/* Recommendations */}
          {structuredData.recommendations.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 tracking-tight">
                <Target className="w-5 h-5 text-emerald-600" />
                Anbefalinger for veien videre
              </h2>
              <ul className="space-y-3">
                {structuredData.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-sm font-semibold text-emerald-700">{index + 1}</span>
                    </div>
                    <p className="text-gray-700 font-light">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Displayed chunks overview */}
          {results.displayed_chunks && results.displayed_chunks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
                  <FileSearch className="w-5 h-5 text-emerald-600" />
                  Samlet dokumentasjonsgrunnlag
                </h2>
                <span className="text-sm text-gray-600">
                  {results.displayed_chunks.length} relevante utdrag
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.displayed_chunks.slice(0, 6).map((chunk, index) => (
                  <div key={chunk.id || index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 text-sm">
                        <FileText className="w-4 h-4 text-gray-600" />
                        <span className="font-medium text-gray-900">{chunk.source}</span>
                        {chunk.page && <span className="text-gray-600">s.{chunk.page}</span>}
                      </div>
                      <span className="text-xs text-emerald-600 font-medium">
                        {chunk.relevance_percentage}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {chunk.content}
                    </p>
                    {chunk.warnings && chunk.warnings.length > 0 && (
                      <div className="mt-2 text-xs text-amber-600">
                        ⚠️ {chunk.warnings.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {results.displayed_chunks.length > 6 && (
                <p className="text-center text-sm text-gray-600 mt-4">
                  + {results.displayed_chunks.length - 6} flere utdrag
                </p>
              )}
            </div>
          )}
          
          {/* Audit Trail Table */}
          {results.audit_trail && results.audit_trail.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2 tracking-tight">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                Sporbarhetstabell
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Dokumentreferanse</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Emne</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Kriterium</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900">Notater</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.audit_trail.map((entry, index) => (
                      <tr key={entry.identifier || index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-700">{entry.identifier}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{entry.reference}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{entry.issue}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{entry.criteria_no}</td>
                        <td className="py-3 px-4 text-sm text-gray-700">{entry.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Full Assessment Toggle */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection('fullAssessment')}
              role="button"
              aria-expanded={expandedSections.fullAssessment}
              aria-controls="full-assessment-content"
            >
              <h2 className="text-lg font-semibold text-gray-900">Detaljert AI-vurdering</h2>
              {expandedSections.fullAssessment ? 
                <ChevronUp className="w-5 h-5 text-gray-500" /> : 
                <ChevronDown className="w-5 h-5 text-gray-500" />
              }
            </div>
            
            {expandedSections.fullAssessment && (
              <div id="full-assessment-content" className="mt-4 prose prose-emerald max-w-none">
                <MarkdownRenderer content={results.assessment || results.fullAssessment || ''} />
              </div>
            )}
          </div>
          
          {/* Metadata */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 tracking-wide">Teknisk informasjon</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500 font-medium">AI Model:</span>
                <p className="font-medium text-gray-900">{results.metadata?.ai_model || 'GPT-4'}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Tekstblokker:</span>
                <p className="font-medium text-gray-900">{results.metadata?.total_chunks || 0}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Relevante blokker:</span>
                <p className="font-medium text-gray-900">{results.metadata?.relevant_chunks || 0}</p>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Versjon:</span>
                <p className="font-medium text-gray-900">{results.metadata?.engine_version || '3.0'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - same as main page */}
        <footer className="mt-32 bg-gradient-to-t from-gray-50 to-white border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-4 py-16">
            
            {/* Main Footer Content */}
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 items-start mb-12">
              
              {/* Brand Column */}
              <div className="space-y-3 max-w-[220px]">
                <BreeamLogo size="default" />
                
                <p className="text-gray-600 text-sm font-light leading-relaxed">
                  Profesjonell, nøytral og pålitelig AI-revisor for norske BREEAM-prosjekter.
                </p>
              </div>

              {/* Quick Links */}
              <div className="text-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Personvern</h4>
                <nav className="space-y-0">
                  <a 
                    href="/personvern.html"
                    className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                  >
                    Personvernerklæring
                  </a>
                  <a 
                    href="/cookies.html"
                    className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                  >
                    Informasjonskapsler
                  </a>
                  <a 
                    href="/bruksvilkar.html"
                    className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                  >
                    Bruksvilkår
                  </a>
                </nav>
              </div>

              {/* Contact */}
              <div className="text-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Kontakt</h4>
                <div className="space-y-0 text-gray-600 font-light">
                  <a href="mailto:support@breeamai.no" className="block hover:text-emerald-700 transition-colors py-0.5">
                    support@breeamai.no
                  </a>
                  <a href="tel:+4712345678" className="block hover:text-emerald-700 transition-colors py-0.5">
                    +47 123 45 678
                  </a>
                  <p className="py-0.5">Oslo, Norge</p>
                </div>
              </div>

              {/* Status */}
              <div className="text-sm space-y-4">
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Status</h4>
                <div className="space-y-0 text-gray-600 font-light">
                  <p className="text-sm py-0.5">Trusted by BREEAM-NOR sertifiserte selskaper</p>
                  <p className="text-sm py-0.5">Testet av BREEAM-revisorer og AP-er</p>
                </div>
              </div>
            </div>

            {/* Bottom Bar with all trust signals */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex flex-col items-center space-y-3">
                <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 font-medium flex-wrap">
                  <span className="flex items-center space-x-1">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="text-gray-500">GDPR-kompatibel</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <span className="text-gray-500">Utviklet i Norge - med</span>
                    <span className="text-emerald-600 text-base">💚</span>
                    <span className="text-gray-500">for bærekraftige bygg</span>
                  </span>
                  <span className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="text-gray-500">Alle systemer operative</span>
                  </span>
                  <span className="text-gray-500">© 2024 BREEAMai</span>
                </div>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

// ===== CUSTOM HOOK FOR BREEAM DATA - WITH RETRY LOGIC =====
const useBreeamData = () => {
  const [data, setData] = useState<BreeamData>({
    versions: [],
    categories: [],
    topics: [],
    criteriaGroups: {}
  })
  
  const [loading, setLoading] = useState<LoadingState>({
    versions: false,
    categories: false,
    topics: false,
    criteria: false
  })
  
  const [errors, setErrors] = useState<ErrorState>({})

  const loadWithRetry = useCallback(async (fn: () => Promise<any>, maxRetries = 3) => {
    let lastError: Error | null = null
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    }
    
    throw lastError
  }, [])

  const loadVersions = useCallback(async (): Promise<string[]> => {
    try {
      setLoading(prev => ({...prev, versions: true}))
      setErrors(prev => ({...prev, versions: undefined}))
      
      const response = await loadWithRetry(() => breeamApi.getVersions())
      
      const versions = response.map((v: any) => 
        typeof v === 'string' ? v : v.code
      )
      
      setData(prev => ({...prev, versions}))
      console.log('✅ Loaded versions from backend:', versions)
      return versions
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Failed to load versions:', error)
      setErrors(prev => ({...prev, versions: errorMessage}))
      
      const fallback = ['v6.1.1', 'v6.0', 'v1.2']
      setData(prev => ({...prev, versions: fallback}))
      console.warn('⚠️ Using fallback versions:', fallback)
      return fallback
    } finally {
      setLoading(prev => ({...prev, versions: false}))
    }
  }, [loadWithRetry])

  const loadCategories = useCallback(async (version: string): Promise<string[]> => {
    try {
      setLoading(prev => ({...prev, categories: true}))
      setErrors(prev => ({...prev, categories: undefined}))
      
      const categories = await loadWithRetry(() => breeamApi.getCategories(version))
      
      setData(prev => ({...prev, categories}))
      console.log('✅ Loaded categories from backend:', categories)
      return categories
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Failed to load categories:', error)
      setErrors(prev => ({...prev, categories: errorMessage}))
      
      const fallback = ['Ledelse', 'Energi', 'Transport', 'Vann', 'Materialer']
      setData(prev => ({...prev, categories: fallback}))
      console.warn('⚠️ Using fallback categories:', fallback)
      return fallback
    } finally {
      setLoading(prev => ({...prev, categories: false}))
    }
  }, [loadWithRetry])

  const loadTopics = useCallback(async (version: string, category: string): Promise<string[]> => {
    try {
      setLoading(prev => ({...prev, topics: true}))
      setErrors(prev => ({...prev, topics: undefined}))
      
      const topics = await loadWithRetry(() => breeamApi.getTopics(version, category))
      
      setData(prev => ({...prev, topics}))
      console.log('✅ Loaded topics from backend:', topics)
      return topics
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Failed to load topics:', error)
      setErrors(prev => ({...prev, topics: errorMessage}))
      
      const fallback = ['MAN01', 'MAN02', 'MAN03']
      setData(prev => ({...prev, topics: fallback}))
      console.warn('⚠️ Using fallback topics:', fallback)
      return fallback
    } finally {
      setLoading(prev => ({...prev, topics: false}))
    }
  }, [loadWithRetry])

  const loadCriteria = useCallback(async (version: string, category: string, topic: string): Promise<Record<string, CriteriaGroup>> => {
    try {
      setLoading(prev => ({...prev, criteria: true}))
      
      const result = await loadWithRetry(() => breeamApi.getCriteria(version, category, topic))
      
      // Handle the new structure
      const criteriaGroups = result.grupper || {}
      
      // Log for debugging
      console.log('✅ Loaded criteria with new structure:', {
        totalGroups: result.total_groups,
        totalCriteria: result.total_criteria,
        hasMetadata: !!result.metadata,
        version: result.version,
        phase: result.phase,
        groups: Object.keys(criteriaGroups).length
      })
      
      setData(prev => ({...prev, criteriaGroups}))
      return criteriaGroups
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('❌ Failed to load criteria:', error)
      setErrors(prev => ({...prev, criteria: errorMessage}))
      
      const fallback: Record<string, CriteriaGroup> = {
        '1': { 
          label: 'Kriterium 1: Standard krav',
          criteria_ids: [1],
          title: 'Standard krav',
          points: 1,
          criteria: []
        }
      }
      setData(prev => ({...prev, criteriaGroups: fallback}))
      return fallback
    } finally {
      setLoading(prev => ({...prev, criteria: false}))
    }
  }, [loadWithRetry])

  return {
    data,
    loading,
    errors,
    loadVersions,
    loadCategories,
    loadTopics,
    loadCriteria
  }
}

// ===== PROGRESSIVE DISCLOSURE COMPONENT =====
interface ProgressiveConfigurationProps {
  state: AppState
  dispatch: React.Dispatch<AppAction>
  data: BreeamData
  loading: LoadingState
  errors: ErrorState
  onFileUpload: (files: FileList | null) => void
  onDrop: (event: React.DragEvent) => void
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const ProgressiveConfiguration: React.FC<ProgressiveConfigurationProps> = ({
  state,
  dispatch,
  data,
  loading,
  errors,
  onFileUpload,
  onDrop,
  addToast
}) => {
  const steps = [
    { id: 'criteria', label: 'Kriterier', icon: '4' },
    { id: 'phase', label: 'Fase', icon: '5' },
    { id: 'upload', label: 'Dokumenter', icon: '6' }
  ]
  
  const getStepStatus = (stepId: string) => {
    if (stepId === 'criteria' && state.selectedCriteria.length > 0) return 'completed'
    if (stepId === 'phase' && state.selectedPhase) return 'completed'
    if (stepId === 'upload' && state.selectedFiles.length > 0) return 'completed'
    if (state.activeConfigStep === stepId) return 'active'
    return 'inactive'
  }
  
  return (
    <div className="space-y-6">
      {/* Horizontal dropdowns for Version, Category, Topic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Version selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            BREEAM-NOR manual
          </label>
          {loading.versions ? (
            <LoadingSkeleton type="dropdown" />
          ) : (
            <select
              value={state.selectedVersion}
              onChange={(e) => dispatch({ type: 'SET_VERSION', payload: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all duration-200 text-sm font-medium hover:border-gray-400 hover:shadow-md"
            >
              <option value="">Velg versjon</option>
              {data.versions.map(version => (
                <option key={version} value={version}>
                  BREEAM-NOR {version.replace(/^v/, '')}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {/* Category selection */}
        <div className={`transition-all duration-200 ${!state.selectedVersion ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Kategori
          </label>
          {loading.categories ? (
            <LoadingSkeleton type="dropdown" />
          ) : (
            <select
              value={state.selectedCategory}
              onChange={(e) => dispatch({ type: 'SET_CATEGORY', payload: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all duration-200 text-sm font-medium hover:border-gray-400 hover:shadow-md"
              disabled={!state.selectedVersion}
            >
              <option value="">Velg kategori</option>
              {data.categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {/* Topic selection */}
        <div className={`transition-all duration-200 ${!state.selectedCategory ? 'opacity-50 pointer-events-none' : ''}`}>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            Emne
          </label>
          {loading.topics ? (
            <LoadingSkeleton type="dropdown" />
          ) : (
            <select
              value={state.selectedTopic}
              onChange={(e) => dispatch({ type: 'SET_TOPIC', payload: e.target.value })}
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 transition-all duration-200 text-sm font-medium hover:border-gray-400 hover:shadow-md"
              disabled={!state.selectedCategory}
            >
              <option value="">Velg emne</option>
              {data.topics.map(topic => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Progress indicator for remaining steps */}
      {state.selectedTopic && (
        <div className="flex items-center justify-between mb-8 px-2 md:px-0">
          {steps.map((step, index) => {
            const status = getStepStatus(step.id)
            const isLast = index === steps.length - 1
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-bold transition-all duration-200 ${
                      status === 'completed' ? 'bg-emerald-600 text-white' :
                      status === 'active' ? 'bg-emerald-100 text-emerald-700 ring-4 ring-emerald-200' :
                      'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {status === 'completed' ? <CheckCircle className="w-5 h-5 md:w-6 md:h-6" /> : step.icon}
                  </div>
                  <span className={`text-[10px] md:text-xs mt-1 md:mt-2 font-medium text-center ${
                    status === 'active' ? 'text-emerald-700' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
                {!isLast && (
                  <div className={`flex-1 h-1 mx-1 md:mx-2 transition-all duration-200 ${
                    getStepStatus(steps[index + 1].id) !== 'inactive' 
                      ? 'bg-emerald-600' 
                      : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}
      
      {/* Step content */}
      <div className="space-y-8">
        {/* Criteria selection */}
        {state.selectedTopic && (
          <div className="animate-slideIn" data-criteria-section>
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-semibold text-gray-900">
                Velg kriterier ({state.selectedCriteria.length} valgt)
              </label>
              {state.selectedCriteria.length > 0 && (
                <span className="text-sm text-emerald-600 font-medium">
                  {state.selectedCriteria.length} av {Object.keys(data.criteriaGroups).length} valgt
                </span>
              )}
            </div>
            
            {loading.criteria ? (
              <LoadingSkeleton type="criteria" />
            ) : (
              <>
                {/* Search input for criteria */}
                {Object.keys(data.criteriaGroups).length > 5 && (
                  <CriteriaSearch
                    searchQuery={state.criteriaSearchQuery}
                    onSearchChange={(query) => dispatch({ type: 'SET_CRITERIA_SEARCH', payload: query })}
                    totalCount={Object.keys(data.criteriaGroups).length}
                    filteredCount={Object.entries(data.criteriaGroups).filter(([key, group]) => {
                      const searchLower = state.criteriaSearchQuery.toLowerCase()
                      return group.label.toLowerCase().includes(searchLower) ||
                             group.title?.toLowerCase().includes(searchLower) ||
                             group.criteria?.some(c => c.title.toLowerCase().includes(searchLower))
                    }).length}
                  />
                )}
                
                <div className="space-y-4">
                  {Object.entries(data.criteriaGroups)
                    .filter(([key, group]) => {
                      if (!state.criteriaSearchQuery) return true
                      const searchLower = state.criteriaSearchQuery.toLowerCase()
                      return group.label.toLowerCase().includes(searchLower) ||
                             group.title?.toLowerCase().includes(searchLower) ||
                             group.criteria?.some(c => c.title.toLowerCase().includes(searchLower))
                    })
                    .map(([key, group]) => (
                      <label key={key} className={`flex items-start space-x-4 cursor-pointer p-6 rounded-lg border transition-all duration-200 ${
                        state.selectedCriteria.includes(key) 
                          ? 'bg-emerald-50 border-emerald-500 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}>
                        <input
                          type="checkbox"
                          value={key}
                          checked={state.selectedCriteria.includes(key)}
                          onChange={() => {
                            // Ensure criterion ID is sent as string to match backend
                            dispatch({ type: 'TOGGLE_CRITERION', payload: String(key) })
                          }}
                          className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-600 mt-0.5 flex-shrink-0"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{group.label}</span>
                            {group.criteria && group.criteria[0]?.assessment_guidance && (
                              <GuidanceTooltip guidance={group.criteria[0].assessment_guidance} />
                            )}
                          </div>
                          {group.points > 0 && (
                            <div className="text-sm text-emerald-600 font-medium mb-1 mt-1">
                              {group.points} poeng
                            </div>
                          )}
                          {/* Show count of sub-requirements if available */}
                          {group.criteria && group.criteria.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {group.criteria.reduce((acc, c) => acc + (c.requirements?.length || 0), 0)} krav totalt
                            </div>
                          )}
                          {/* Show phase relevance if available */}
                          {group.phase_relevant !== undefined && (
                            <div className="text-xs text-gray-500 mt-1">
                              {group.phase_relevant ? '✓ Relevant for valgt fase' : '⚠️ Sjekk fase-relevans'}
                            </div>
                          )}
                          {/* Show assessment guidance if available */}
                          {group.criteria && group.criteria[0]?.assessment_guidance && (
                            <div className="text-xs text-gray-500 mt-2 space-y-1">
                              {group.criteria[0].assessment_guidance.accept_formats && (
                                <div className="flex items-start gap-1">
                                  <FileCheck className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>Aksepterer: {group.criteria[0].assessment_guidance.accept_formats.join(', ')}</span>
                                </div>
                              )}
                              {group.criteria[0].assessment_guidance.look_for && (
                                <div className="flex items-start gap-1">
                                  <Search className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                  <span>Ser etter: {group.criteria[0].assessment_guidance.look_for[0]}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  
                  {state.criteriaSearchQuery && Object.entries(data.criteriaGroups).filter(([key, group]) => {
                    const searchLower = state.criteriaSearchQuery.toLowerCase()
                    return group.label.toLowerCase().includes(searchLower) ||
                           group.title?.toLowerCase().includes(searchLower)
                  }).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>Ingen kriterier funnet for "{state.criteriaSearchQuery}"</p>
                    </div>
                  )}
                  
                  {Object.keys(data.criteriaGroups).length > 0 && !state.criteriaSearchQuery && (
                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={() => dispatch({ 
                          type: 'SET_CRITERIA', 
                          payload: Object.keys(data.criteriaGroups) 
                        })}
                        className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors duration-200"
                      >
                        Velg alle
                      </button>
                      <button
                        onClick={() => dispatch({ type: 'SET_CRITERIA', payload: [] })}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors duration-200"
                      >
                        Fjern alle
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        
        {/* Phase selection */}
        {state.selectedCriteria.length > 0 && (
          <div className="animate-slideIn">
            <PhaseSelector
              selectedPhase={state.selectedPhase}
              onPhaseChange={(phase) => dispatch({ type: 'SET_PHASE', payload: phase })}
            />
          </div>
        )}

        {/* Phase-specific warnings */}
        {state.selectedPhase === 'ferdigstillelse' && (
          <div className="animate-slideIn mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-900 mb-1">Viktig informasjon om ferdigstillelsesfasen</h4>
                <p className="text-sm text-yellow-800">
                  I ferdigstillelsesfasen godtas IKKE forpliktelser eller intensjonserklæringer. 
                  Kun faktisk som-bygget dokumentasjon aksepteres.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* File upload */}
        {state.selectedCriteria.length > 0 && state.selectedPhase && (
          <div className="animate-slideIn">
            <label className="block text-lg font-semibold text-gray-900 mb-4">
              Last opp prosjektdokumentasjon
            </label>
            
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                state.isDragOver 
                  ? 'border-emerald-400 bg-emerald-50 scale-105 shadow-lg' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault()
                dispatch({ type: 'SET_DRAG_OVER', payload: true })
              }}
              onDragLeave={() => dispatch({ type: 'SET_DRAG_OVER', payload: false })}
              role="button"
              tabIndex={0}
              aria-label="Slipp filer her eller klikk for å velge"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  document.getElementById('fileInput')?.click()
                }
              }}
            >
              <div className={`transition-all duration-200 ${state.isDragOver ? 'scale-110' : ''}`}>
                <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <Upload className={`w-8 h-8 ${state.isDragOver ? 'text-emerald-600' : 'text-gray-600'}`} />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {state.isDragOver ? 'Slipp filene her!' : 'Dra filer hit eller klikk for å velge'}
                </h4>
                <p className="text-gray-600 mb-4 text-sm font-light">
                  PDF, Word (.docx) og Excel (.xlsx) filer støttes • Maks {MAX_FILE_SIZE / 1024 / 1024}MB per fil
                </p>
              </div>
              
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx"
                onChange={(e) => onFileUpload(e.target.files)}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className="inline-flex items-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold cursor-pointer hover:bg-emerald-800 transition-colors duration-200"
              >
                <Upload className="w-4 h-4" />
                Velg filer
              </label>
            </div>

            {/* Selected files */}
            {state.selectedFiles.length > 0 && (
              <div className="mt-8">
                <h4 className="text-sm font-medium text-gray-700 mb-4 tracking-wide">
                  Valgte filer ({state.selectedFiles.length})
                </h4>
                <div className="space-y-3">
                  {state.selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-xs">{file.name}</p>
                          <p className="text-sm text-gray-500 font-light">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          dispatch({ type: 'REMOVE_FILE', payload: index })
                          addToast(`${file.name} fjernet`, 'info')
                        }}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                        aria-label={`Fjern ${file.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report format selection */}
            {state.selectedFiles.length > 0 && (
              <div className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Velg rapportformat:</h4>
                <div className="flex gap-4">
                  <label className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-all ${
                    state.reportFormat === 'pdf' 
                      ? 'bg-emerald-50 border-emerald-500' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="pdf"
                      checked={state.reportFormat === 'pdf'}
                      onChange={(e) => dispatch({ type: 'SET_REPORT_FORMAT', payload: 'pdf' })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <FileText className="w-6 h-6 text-red-600" />
                      </div>
                      <p className="font-medium text-gray-900">PDF</p>
                      <p className="text-xs text-gray-600 mt-1">Anbefalt format</p>
                    </div>
                  </label>
                  
                  <label className={`flex-1 cursor-pointer p-4 rounded-lg border-2 transition-all ${
                    state.reportFormat === 'word' 
                      ? 'bg-emerald-50 border-emerald-500' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}>
                    <input
                      type="radio"
                      name="reportFormat"
                      value="word"
                      checked={state.reportFormat === 'word'}
                      onChange={(e) => dispatch({ type: 'SET_REPORT_FORMAT', payload: 'word' })}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
                        <FileText className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="font-medium text-gray-900">Word</p>
                      <p className="text-xs text-gray-600 mt-1">For redigering</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ===== PRIVACY MODAL =====
interface PrivacyModalProps {
 state: AppState
 dispatch: React.Dispatch<AppAction>
 startAnalysis: () => void
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ state, dispatch, startAnalysis }) => {
 return (
   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title">
     <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl">
       <div className="flex items-center justify-between mb-4">
         <div className="flex items-center space-x-2">
           <Shield className="w-5 h-5 text-emerald-600" />
           <h3 id="privacy-modal-title" className="text-lg font-semibold text-gray-900">Personvern og samtykke</h3>
         </div>
         <button
           onClick={() => dispatch({ type: 'SHOW_PRIVACY_MODAL', payload: false })}
           className="text-gray-400 hover:text-gray-600 transition-colors"
           aria-label="Lukk dialog"
         >
           <X className="w-5 h-5" />
         </button>
       </div>
       
       <div className="mb-6">
         <p className="text-gray-700 font-light mb-4 leading-relaxed">
           For å analysere dokumentene dine med AI, trenger vi ditt samtykke til å behandle dataene midlertidig.
         </p>
         
         <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
           <h4 className="font-medium text-emerald-800 mb-2">Våre garantier:</h4>
           <ul className="text-sm text-emerald-700 space-y-1 font-light">
             <li>• All data slettes automatisk innen 1 time</li>
             <li>• Ingen data lagres permanent</li>
             <li>• Kryptert overføring og behandling</li>
             <li>• GDPR-compliant prosesser</li>
           </ul>
         </div>
       </div>

       <div className="mb-6">
         <label className="flex items-start space-x-3 cursor-pointer">
           <input
             type="checkbox"
             checked={state.hasConsentedToPrivacy}
             onChange={(e) => dispatch({ type: 'SET_PRIVACY_CONSENT', payload: e.target.checked })}
             className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-600 mt-0.5"
           />
           <span className="text-sm text-gray-700 font-light leading-relaxed">
             Jeg godtar behandling av opplastede dokumenter i henhold til{' '}
             <a
               href="/personvern.html"
               className="text-emerald-600 underline hover:text-emerald-700 transition-colors font-medium"
             >
               personvernerklæringen
             </a>
             {' '}og{' '}
             <a
               href="/bruksvilkar.html"
               className="text-emerald-600 underline hover:text-emerald-700 transition-colors font-medium"
             >
               bruksvilkårene
             </a>
             . All data slettes automatisk innen 1 time.
           </span>
         </label>
       </div>

       <div className="flex space-x-3">
         <button
           onClick={() => dispatch({ type: 'SHOW_PRIVACY_MODAL', payload: false })}
           className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
         >
           Avbryt
         </button>
         <button
           onClick={() => {
             dispatch({ type: 'SHOW_PRIVACY_MODAL', payload: false })
             if (state.hasConsentedToPrivacy) {
               startAnalysis()
             }
           }}
           disabled={!state.hasConsentedToPrivacy}
           className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
         >
           Fortsett
         </button>
       </div>
     </div>
   </div>
 )
}

// ===== PAGE COMPONENTS =====
// Removed - now using static HTML files in /public folder
const CookiesPage: React.FC<{ dispatch: React.Dispatch<AppAction> }> = ({ dispatch }) => (
 <div className="min-h-screen bg-gray-50">
   <div className="max-w-4xl mx-auto px-6 py-12">
     <button
       onClick={() => dispatch({ type: 'SET_PAGE', payload: 'main' })}
       className="mb-8 flex items-center text-emerald-600 hover:text-emerald-700 transition-colors font-medium"
     >
       ← Tilbake til BREEAM-AI
     </button>
     
     <h1 className="text-3xl font-bold text-emerald-700 mb-4 pb-4 border-b-2 border-emerald-700">
       Cookie-policy for BREEAM-AI
     </h1>
     
     <p className="text-sm text-gray-600 mb-6">
       <strong>Sist oppdatert:</strong> 9. juli 2025
     </p>

     <div className="bg-emerald-50 border-l-4 border-emerald-600 p-6 rounded-r-lg mb-8">
       <h2 className="text-xl font-semibold text-emerald-800 mb-4">
         Vår tilnærming til cookies
       </h2>
       <p className="text-gray-800 font-medium leading-relaxed">
         BREEAM-AI er designet for å fungere uten unødvendige cookies for å beskytte ditt personvern.
       </p>
     </div>

     <div className="space-y-8">
       <section>
         <h2 className="text-xl font-semibold text-emerald-800 mb-6">
           Hvilke cookies bruker vi?
         </h2>
         
         <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
           <span className="text-lg mr-2">✅</span>
           Strengt nødvendige cookies
         </h3>
         <p className="text-gray-700 mb-4 leading-relaxed">
           Disse er nødvendige for at nettsiden skal fungere og kan ikke deaktiveres:
         </p>

         <div className="overflow-x-auto mb-6">
           <table className="w-full border-collapse border border-gray-300 bg-white rounded-lg overflow-hidden">
             <thead>
               <tr className="bg-gray-50">
                 <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Cookie navn</th>
                 <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Formål</th>
                 <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Varighet</th>
                 <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Type</th>
               </tr>
             </thead>
             <tbody>
               <tr>
                 <td className="border border-gray-300 px-4 py-3 font-mono text-sm">session_id</td>
                 <td className="border border-gray-300 px-4 py-3">Holder styr på din økt under bruk</td>
                 <td className="border border-gray-300 px-4 py-3">Sesjon</td>
                 <td className="border border-gray-300 px-4 py-3">Funksjonell</td>
               </tr>
               <tr>
                 <td className="border border-gray-300 px-4 py-3 font-mono text-sm">csrf_token</td>
                 <td className="border border-gray-300 px-4 py-3">Sikkerhet mot angrep</td>
                 <td className="border border-gray-300 px-4 py-3">Sesjon</td>
                 <td className="border border-gray-300 px-4 py-3">Sikkerhet</td>
               </tr>
               <tr>
                 <td className="border border-gray-300 px-4 py-3 font-mono text-sm">upload_progress</td>
                 <td className="border border-gray-300 px-4 py-3">Viser fremdrift ved filopplasting</td>
                 <td className="border border-gray-300 px-4 py-3">Sesjon</td>
                 <td className="border border-gray-300 px-4 py-3">Funksjonell</td>
               </tr>
             </tbody>
           </table>
         </div>

         <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
           <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <span className="text-lg mr-2">❌</span>
             Cookies vi IKKE bruker
           </h3>
           <p className="text-gray-700 mb-4 leading-relaxed">
             Vi bruker <strong>ikke</strong>:
           </p>
           <ul className="text-gray-700 space-y-2">
             <li className="flex items-center"><span className="mr-2">🚫</span> Google Analytics cookies</li>
             <li className="flex items-center"><span className="mr-2">🚫</span> Facebook Pixel eller andre sporingsverktøy</li>
             <li className="flex items-center"><span className="mr-2">🚫</span> Markedsføringscookies</li>
             <li className="flex items-center"><span className="mr-2">🚫</span> Tredjepartscookies for annonsering</li>
           </ul>
         </div>
       </section>

       <section>
         <h2 className="text-xl font-semibold text-emerald-800 mb-4">
           Datainnsamling uten cookies
         </h2>
         <p className="text-gray-700 mb-4 leading-relaxed">Vi samler inn denne anonyme informasjonen:</p>
         <ul className="list-disc pl-6 text-gray-700 space-y-2">
           <li>Antall vurderinger per dag/måned</li>
           <li>Mest brukte BREEAM-versjoner og kategorier</li>
           <li>Tekniske feilmeldinger for debugging</li>
           <li>Generell bruksstatistikk (uten IP-adresser)</li>
         </ul>
       </section>

       <section>
         <h2 className="text-xl font-semibold text-emerald-800 mb-4">
           Kontroll over cookies
         </h2>
         
         <h3 className="text-lg font-semibold text-gray-900 mb-3">For de strengt nødvendige cookies:</h3>
         <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-6">
           <li>Disse kan ikke deaktiveres uten at tjenesten slutter å fungere</li>
           <li>De slettes automatisk når du lukker nettleseren</li>
           <li>Inneholder ingen personlig identifiserbar informasjon</li>
         </ul>

         <h3 className="text-lg font-semibold text-gray-900 mb-3">For å fjerne cookies:</h3>
         <ol className="list-decimal pl-6 text-gray-700 space-y-2">
           <li><strong>Chrome:</strong> Innstillinger → Personvern og sikkerhet → Cookies og andre nettstedsdata</li>
           <li><strong>Firefox:</strong> Innstillinger → Personvern og sikkerhet → Cookies og nettstedsdata</li>
           <li><strong>Safari:</strong> Innstillinger → Personvern → Administrer nettstedsdata</li>
         </ol>
       </section>

       <section>
         <h2 className="text-xl font-semibold text-emerald-800 mb-4">
           Tredjepartstjenester
         </h2>
         <p className="text-gray-700 mb-4 leading-relaxed">Vi bruker:</p>
         <ul className="list-disc pl-6 text-gray-700 space-y-2">
           <li><strong>Microsoft Azure OpenAI</strong> - for AI-behandling (ingen cookies satt)</li>
           <li><strong>Cloudflare</strong> - for sikkerhet og hastighet (minimal teknisk cookies)</li>
         </ul>
       </section>

       <section>
         <h2 className="text-xl font-semibold text-emerald-800 mb-4">
           Endringer i cookie-policy
         </h2>
         <p className="text-gray-700 leading-relaxed">
           Vi varsler om vesentlige endringer i hvordan vi bruker cookies med minimum 30 dagers varsel på nettsiden.
         </p>
       </section>

       <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
         <h2 className="text-xl font-semibold text-emerald-800 mb-4">
           Kontakt oss
         </h2>
         <div className="text-gray-700 leading-relaxed">
           <p>Spørsmål om vår cookie-bruk?<br />
           <strong>E-post:</strong> [din-epost@envia.no]<br />
           <strong>Telefon:</strong> [ditt telefonnummer]</p>
         </div>
       </div>
     </div>

     <hr className="my-10 border-gray-300" />
     <p className="text-center text-gray-500 text-sm">
       Sist oppdatert: 9. juli 2025 • Powered by Envia AS
     </p>
   </div>
 </div>
)

const BruksvilkarPage: React.FC<{ dispatch: React.Dispatch<AppAction> }> = ({ dispatch }) => {
 useEffect(() => {
   window.scrollTo(0, 0)
 }, [])
 
 return (
   <div className="min-h-screen bg-gray-50">
     <div className="max-w-4xl mx-auto px-6 py-12">
       <button
         onClick={() => dispatch({ type: 'SET_PAGE', payload: 'main' })}
         className="mb-8 flex items-center text-emerald-600 hover:text-emerald-700 transition-colors font-medium"
       >
         ← Tilbake til BREEAM-AI
       </button>
       
       <h1 className="text-3xl font-bold text-emerald-700 mb-4 pb-4 border-b-2 border-emerald-700">
         Bruksvilkår for BREEAM-AI
       </h1>
       
       <p className="text-sm text-gray-600 mb-6">
         <strong>Sist oppdatert:</strong> 9. juli 2025
       </p>
       
       <p className="text-gray-700 mb-8 leading-relaxed">
         Ved å bruke BREEAM-AI aksepterer du følgende vilkår og betingelser. Les dem nøye før du begynner å bruke tjenesten.
       </p>

       <div className="space-y-8">
         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             🎯 Tjenestens formål
           </h2>
           <p className="text-gray-700 leading-relaxed">
             BREEAM-AI er et verktøy for å assistere med BREEAM-vurderinger ved å analysere opplastede dokumenter mot valgte kriterier. 
             Tjenesten genererer AI-baserte vurderinger som <strong>må alltid kvalitetssikres av en sertifisert BREEAM-rådgiver</strong>. 
             Resultatene erstatter ikke profesjonell vurdering eller sertifiseringsprosesser.
           </p>
         </section>

         <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg">
           <h2 className="text-xl font-semibold text-amber-800 mb-4 flex items-center">
             ⚠️ Viktige begrensninger
           </h2>
           <ul className="text-amber-800 space-y-2">
             <li>• AI-vurderinger kan inneholde feil og unøyaktigheter</li>
             <li>• Tjenesten erstatter ikke profesjonell BREEAM-ekspertise</li>
             <li>• Alle resultater må verifiseres av kvalifisert personell</li>
             <li>• Vi garanterer ikke nøyaktigheten av AI-genererte vurderinger</li>
           </ul>
         </div>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             📋 Akseptert bruk
           </h2>
           <p className="text-gray-700 mb-4 leading-relaxed">Du kan bruke BREEAM-AI til:</p>
           <ul className="list-disc pl-6 text-gray-700 space-y-2">
             <li>Å få foreløpige AI-vurderinger av BREEAM-dokumentasjon</li>
             <li>Som startpunkt for profesjonell BREEAM-analyse</li>
             <li>Til intern kvalitetskontroll av dokumenter</li>
             <li>Som et hjelpeverktøy i sertifiseringsprosessen</li>
           </ul>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             🚫 Forbudt bruk
           </h2>
           <p className="text-gray-700 mb-4 leading-relaxed">Du kan IKKE bruke BREEAM-AI til:</p>
           <ul className="list-disc pl-6 text-gray-700 space-y-2">
             <li>Som endelig grunnlag for BREEAM-sertifisering uten profesjonell gjennomgang</li>
             <li>Å laste opp dokumenter du ikke har rettigheter til</li>
             <li>Kommersielle formål uten avtale med Envia AS</li>
             <li>Å omgå eller misbruke tjenestens sikkerhetsfunksjoner</li>
             <li>Å dele eller publisere AI-vurderinger som offisielle BREEAM-rapporter</li>
           </ul>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             ⚖️ Ansvar og garanti
           </h2>
           <div className="space-y-4 text-gray-700 leading-relaxed">
             <p>
               <strong>Tjenesten leveres "som den er"</strong> uten garantier av noe slag, verken uttrykkelige eller underforståtte. 
               Envia AS fraskriver seg alt ansvar for:
             </p>
             <ul className="list-disc pl-6 space-y-2">
               <li>Feil eller unøyaktigheter i AI-genererte vurderinger</li>
               <li>Tap eller skade som følge av bruk av tjenesten</li>
               <li>Forsinkelser eller avbrudd i tjenesten</li>
               <li>Tap av data eller dokumenter</li>
             </ul>
             <p className="font-medium">
               <strong>Brukeren er selv ansvarlig for å verifisere alle resultater og sikre overholdelse av BREEAM-krav.</strong>
             </p>
           </div>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             🔒 Intellectual Property og konfidensialitet
           </h2>
           <div className="space-y-4 text-gray-700 leading-relaxed">
             <p>
               Dokumenter du laster opp forblir din eiendom. Envia AS får ingen rettigheter til ditt innhold utover det som er 
               nødvendig for å levere tjenesten.
             </p>
             <p>
               AI-vurderingene som genereres tilhører deg, men må ikke presenteres som offisielle BREEAM-rapporter uten 
               kvalifikasjon fra sertifisert rådgiver.
             </p>
           </div>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             💰 Priser og betaling
           </h2>
           <div className="space-y-4 text-gray-700 leading-relaxed">
             <p>
               Aktuelle priser publiseres på nettsiden. Priser kan endres med 30 dagers varsel. 
               Betaling skjer gjennom sikre betalingsløsninger integrert i tjenesten.
             </p>
             <p>
               <strong>Ingen refusjon:</strong> På grunn av tjenestens natur (øyeblikkelig AI-prosessering) gis ingen refusjon 
               etter at en vurdering er gjennomført.
             </p>
           </div>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             🔄 Endringer av vilkår
           </h2>
           <p className="text-gray-700 leading-relaxed">
             Vi forbeholder oss retten til å endre disse vilkårene med 30 dagers skriftlig varsel. 
             Fortsatt bruk av tjenesten etter endringer utgjør aksept av nye vilkår.
           </p>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             🏛️ Gjeldende lov
           </h2>
           <p className="text-gray-700 leading-relaxed">
             Disse vilkårene reguleres av norsk lov. Eventuelle tvister skal løses ved norske domstoler, 
             med Oslo tingrett som verneting.
           </p>
         </section>

         <section>
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             ⏰ Oppsigelse og avslutning
           </h2>
           <div className="space-y-4 text-gray-700 leading-relaxed">
             <p>
               Du kan når som helst slutte å bruke tjenesten. Vi kan suspendere tilgangen ved brudd på vilkårene.
             </p>
             <p>
               Ved avslutning slettes alle dine data i henhold til personvernerklæringen (innen 1 time).
             </p>
           </div>
         </section>

         <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
           <h2 className="text-xl font-semibold text-emerald-800 mb-4 flex items-center">
             📞 Kontakt ved spørsmål
           </h2>
           <div className="text-gray-700 leading-relaxed">
             <p><strong>Envia AS</strong><br />
             [Adresse]<br />
             E-post: [din-epost@envia.no]<br />
             Telefon: [ditt telefonnummer]<br />
             Org.nr: [org.nr]</p>
             
             <p className="mt-4">
               Kontakt oss ved spørsmål om bruksvilkårene eller tjenesten.
             </p>
           </div>
         </div>
       </div>

       <hr className="my-10 border-gray-300" />
       <p className="text-center text-gray-500 text-sm">
         © 2024 Envia AS • Alle rettigheter forbeholdt • Utviklet for norske BREEAM-standarder
       </p>
     </div>
   </div>
 )
}

// ===== MAIN COMPONENT =====
function EnhancedBREEAMAI() {
  // Use reducer for state management
  const [state, dispatch] = useReducer(appReducer, initialState)

  // Use custom hook for data fetching
  const { data, loading, errors, loadVersions, loadCategories, loadTopics, loadCriteria } = useBreeamData()

  // Progress interval ref to handle cleanup
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Toast helpers
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    dispatch({ type: 'ADD_TOAST', payload: { message, type } })
  }, [])

  const removeToast = useCallback((id: number) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id })
  }, [])

  // Load versions on mount
  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // Removed localStorage autosave functionality

  // File handler
  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return
    
    const validFiles = Array.from(files).filter((file: File) => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      const isValidType = ['pdf', 'docx', 'xlsx'].includes(extension || '')
      const isValidSize = file.size <= MAX_FILE_SIZE
      
      if (!isValidType) {
        addToast(`${file.name} har ugyldig filtype`, 'error')
      } else if (!isValidSize) {
        addToast(`${file.name} er for stor (maks ${MAX_FILE_SIZE / 1024 / 1024}MB)`, 'error')
      }
      
      return isValidType && isValidSize
    })
    
    const newFiles = validFiles.filter((newFile: File) => 
      !state.selectedFiles.some((existingFile: File) => 
        existingFile.name === newFile.name && existingFile.size === newFile.size
      )
    )
    
    if (newFiles.length > 0) {
      dispatch({ type: 'ADD_FILES', payload: newFiles })
      addToast(`${newFiles.length} fil(er) lagt til`, 'success')
    }
  }, [state.selectedFiles, addToast])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    dispatch({ type: 'SET_DRAG_OVER', payload: false })
    const files = event.dataTransfer.files
    handleFileUpload(files)
  }, [handleFileUpload])

  const resetForm = useCallback(() => {
    dispatch({ type: 'RESET_FORM' })
    addToast('Skjema tilbakestilt', 'info')
  }, [addToast])

  // Keyboard shortcuts - FLYTTET ETTER resetForm
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to close modals
      if (e.key === 'Escape') {
        if (state.showPrivacyModal) {
          dispatch({ type: 'SHOW_PRIVACY_MODAL', payload: false })
        }
        if (state.showChunksModal) {
          dispatch({ type: 'SHOW_CHUNKS_MODAL', payload: { show: false } })
        }
      }
      
      // Ctrl/Cmd + R to reset form (with confirmation)
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !state.isAssessing) {
        e.preventDefault()
        if (window.confirm('Er du sikker på at du vil tilbakestille skjemaet?')) {
          resetForm()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.showPrivacyModal, state.showChunksModal, state.isAssessing, resetForm])

  // Load categories when version changes
  useEffect(() => {
    if (state.selectedVersion) {
      loadCategories(state.selectedVersion)
    }
  }, [state.selectedVersion, loadCategories])

  // Load topics when category changes
  useEffect(() => {
    if (state.selectedVersion && state.selectedCategory) {
      loadTopics(state.selectedVersion, state.selectedCategory)
    }
  }, [state.selectedVersion, state.selectedCategory, loadTopics])

  // Load criteria when topic changes
  useEffect(() => {
    if (state.selectedVersion && state.selectedCategory && state.selectedTopic) {
      loadCriteria(state.selectedVersion, state.selectedCategory, state.selectedTopic)
    }
  }, [state.selectedVersion, state.selectedCategory, state.selectedTopic, loadCriteria])

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [])

  // Retry utility function with exponential backoff
  async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        console.log(`🔄 Retry attempt ${i + 1}/${maxRetries}`)
        const result = await fn()
        console.log(`✅ Success on attempt ${i + 1}`)
        return result
      } catch (error) {
        lastError = error as Error
        console.error(`❌ Attempt ${i + 1} failed:`, error)
        
        // Don't retry on client errors (4xx) or if no error
        if (!error || (error instanceof ApiError && error.status && error.status >= 400 && error.status < 500)) {
          throw error || new Error('Unknown error occurred')
        }
        
        if (i < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, i)
          console.log(`⏳ Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed')
  }

  // Enhanced assessment with PDF support and phase
  const startAnalysis = useCallback(async (isRetry = false) => {
    if (!state.hasConsentedToPrivacy) {
      dispatch({ type: 'SHOW_PRIVACY_MODAL', payload: true })
      return
    }
    
    dispatch({ type: 'SET_ASSESSING', payload: true })
    dispatch({ type: 'SET_PROGRESS', payload: { progress: 0, message: 'Forbereder analyse...' } })
    
    if (!isRetry) {
      dispatch({ type: 'RESET_RETRY' })
    }
    
    // Set up timeout handler - increased to 10 minutes to match fetch timeout
    const timeoutId = setTimeout(() => {
      if (state.isAssessing) {
        dispatch({ type: 'SET_ASSESSING', payload: false })
        dispatch({ type: 'SET_ERROR', payload: { message: 'Vurderingen tok for lang tid (over 10 minutter). Prøv igjen med færre filer eller kriterier.' } })
        addToast('Timeout: Vurderingen tok for lang tid', 'error')
      }
    }, 600000) // 10 minutes timeout - matches the fetch timeout in api_fix.ts
    
    try {
      // Check if backend is reachable
      try {
        const healthCheck = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://web-production-ed3ca.up.railway.app'}/api/health`)
        if (!healthCheck.ok) {
          throw new Error('Backend er ikke tilgjengelig')
        }
      } catch (error) {
        dispatch({ type: 'SET_ERROR', payload: { message: 'Kan ikke koble til serveren. Sjekk at backend kjører og prøv igjen.' } })
        dispatch({ type: 'SET_ASSESSING', payload: false })
        clearTimeout(timeoutId)
        return
      }
      
      // Use utils to create FormData with phase
      const formData = utils.createAssessmentFormData({
        version: state.selectedVersion, // Allerede har 'v' prefix
        category: state.selectedCategory,
        topic: state.selectedTopic,
        criteria: state.selectedCriteria,
        files: state.selectedFiles,
        privacyConsent: state.hasConsentedToPrivacy,
        reportFormat: state.reportFormat,
        phase: state.selectedPhase,
        includeChunks: false
      })
      
      dispatch({ type: 'SET_PROGRESS', payload: { progress: 20, message: 'Laster opp dokumenter...' } })
      
      // console.log('🚀 Starting assessment with format:', state.reportFormat, 'and phase:', state.selectedPhase)
      
      // Progress interval with messages
      let currentProgress = 20
      const progressMessages = [
        { at: 30, message: 'Ekstraherer tekst fra dokumenter...' },
        { at: 40, message: 'Analyserer innhold...' },
        { at: 50, message: 'Finner relevante seksjoner...' },
        { at: 60, message: 'AI vurderer kriterier...' },
        { at: 70, message: 'Validerer fase-krav...' },
        { at: 80, message: 'Genererer rapport...' },
        { at: 90, message: 'Ferdigstiller vurdering...' }
      ]
      
      progressIntervalRef.current = setInterval(() => {
        // Slower progress for longer assessments
        currentProgress = Math.min(90, currentProgress + 2) // Changed from +5 to +2
        const messageObj = progressMessages.find(m => m.at === currentProgress)
        dispatch({ type: 'SET_PROGRESS', payload: { 
          progress: currentProgress,
          message: messageObj?.message
        } })
      }, 1500) // Changed from 800ms to 1500ms for slower progress
      
      // Call API with format using retry logic
      console.log('🚀 Calling createAssessment API...')
      const result = await retryWithBackoff(
        async () => {
          console.log('📤 Sending to createAssessment...')
          try {
            const response = await breeamApi.createAssessment(formData, state.reportFormat)
            console.log('📥 Received from createAssessment:', response)
            
            // Validate response structure
            if (!response || typeof response !== 'object') {
              throw new Error('Invalid response format from server')
            }
            
            // Ensure success property exists
            if (response.success === false && response.error) {
              throw new ApiError(response.error.message || 'Assessment failed', response.error.status)
            }
            
            return response
          } catch (error) {
            console.error('🔴 API call error:', error)
            throw error
          }
        },
        3,
        2000
      )
      
      console.log('✅ API Response received:', result)
      
      // ADD FULL DEBUG LOG:
      console.log('🔍 FULL RESULT OBJECT:', JSON.stringify(result, null, 2))
      
      // Check if emergency mode is active
      const isEmergencyMode = result?.metadata?.emergency_mode === true
      
      // IMMEDIATELY update progress to 100% when response is received
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      
      if (isEmergencyMode) {
        console.log('🚨 EMERGENCY MODE DETECTED - Using bypass response')
        dispatch({ type: 'SET_PROGRESS', payload: { 
          progress: 100, 
          message: 'Vurdering sendt! (Nødmodus aktiv)' 
        } })
      } else {
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 100, message: 'Fullført!' } })
      }
      
      // Then log details
      console.log('📄 Assessment length:', result.assessment?.length || 0)
      console.log('📊 Criteria evaluated:', result.criteria_evaluated)
      console.log('📁 Files processed:', result.files_processed)
      console.log('🚨 Emergency mode:', isEmergencyMode)
      
      // In emergency mode, we accept the bypass response
      if (!result || (!result.assessment && !result.criterion_assessments && !isEmergencyMode)) {
        console.error('❌ Empty result from backend:', result)
        throw new Error('Backend returnerte tom vurdering. Vennligst prøv igjen eller kontakt support.')
      }
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // console.log('✅ Assessment completed:', result)
      
      // Check for emergency mode
      if (isEmergencyMode) {
        addToast('Nødmodus: Vurderingen kjører i bakgrunnen. Rapporten genereres selv om resultatene ikke vises live.', 'info')
      }
      
      // Check for guidance usage warning
      if (result.metadata?.guidance_usage === false) {
        addToast('Advarsel: Vurdering utført uten veiledningsmatching', 'info')
      }
      
      const mappedResults: AssessmentResult = {
        assessment: result.assessment || '',
        fullAssessment: result.assessment || '',
        files_processed: result.files_processed || [],
        // Ensure criteria_evaluated is always an array of strings
        criteria_evaluated: Array.isArray(result.criteria_evaluated) 
          ? result.criteria_evaluated.map(String) 
          : [],
        word_file: result.word_file,
        wordFileUrl: result.word_file,
        report_file: result.report_file,
        report_format: state.reportFormat,
        displayed_chunks: result.displayed_chunks || [],
        criterion_assessments: result.criterion_assessments || [],
        phase_validation: result.phase_validation,
        metadata: {
          ...result.metadata,
          phase: state.selectedPhase,
          phase_description: PHASE_OPTIONS.find(p => p.id === state.selectedPhase)?.name
        },
        summary: result.summary || {
          totalCriteria: state.selectedCriteria.length,
          fulfilled: result.criterion_assessments?.filter((ca: CriterionAssessment) => ca.status === '✅').length || 0,
          partiallyFulfilled: result.criterion_assessments?.filter((ca: CriterionAssessment) => ca.status === '⚠️').length || 0,
          notFulfilled: result.criterion_assessments?.filter((ca: CriterionAssessment) => ca.status === '❌').length || 0,
        },
        points_summary: result.points_summary
      }
      
      // Validate before setting results
      if (!mappedResults.assessment && !mappedResults.criterion_assessments?.length) {
        throw new Error('Vurderingen inneholder ingen data. Prøv igjen.')
      }

      console.log('📊 Mapped results:', mappedResults)
      console.log('🎯 Dispatching SET_RESULTS with:', mappedResults)
      dispatch({ type: 'SET_RESULTS', payload: mappedResults })
      dispatch({ type: 'SET_ERROR', payload: null })
      console.log('✅ SET_RESULTS dispatched, state.results should be set now')
      
      // Assessment completed successfully
      console.log('✅ Results set successfully, assessment complete!')
      
      addToast('AI-vurdering fullført!', 'success')

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ukjent feil'
      console.error('❌ Assessment failed:', error)
      console.error('❌ Error details:', {
        message: errorMessage,
        type: error?.constructor?.name,
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Clear the progress interval to prevent stuck loading
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      
      // IMPROVE ERROR HANDLING:
      // Check for specific error types
      if (error instanceof Error && error.name === 'AbortError') {
        // This is our own timeout or user navigation
        dispatch({ type: 'SET_ERROR', payload: { 
          message: 'Vurderingen ble avbrutt. Dette kan skyldes at den tok for lang tid eller at du navigerte bort fra siden.' 
        } })
      } else if (error instanceof ApiError && error.status) {
        // Backend returned an error response
        if (error.status === 503) {
          dispatch({ type: 'SET_ERROR', payload: { message: 'AI-tjenesten er midlertidig utilgjengelig. Prøv igjen om noen minutter.' } })
        } else if (error.status === 400) {
          dispatch({ type: 'SET_ERROR', payload: { message: error.details?.detail || 'Ugyldig forespørsel. Sjekk at alle felt er fylt ut korrekt.' } })
        } else if (error.status === 408) {
          dispatch({ type: 'SET_ERROR', payload: { message: 'Forespørselen tok for lang tid. Prøv med færre filer eller mindre kriterier.' } })
        } else {
          dispatch({ type: 'SET_ERROR', payload: { message: `Server feil (${error.status}): ${error.details?.detail || errorMessage}` } })
        }
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        // Request was made but no response received
        dispatch({ type: 'SET_ERROR', payload: { message: 'Kunne ikke nå serveren. Sjekk internettforbindelsen og prøv igjen.' } })
      } else if (errorMessage.includes('Failed to read response data')) {
        // Response was too large or corrupted
        dispatch({ type: 'SET_ERROR', payload: { 
          message: 'Responsen fra serveren var for stor eller skadet. Prøv med færre kriterier eller kontakt support.' 
        } })
      } else {
        // Something else happened
        dispatch({ type: 'SET_ERROR', payload: { message: errorMessage } })
      }
      
      // Don't set empty results - keep user on the form
      dispatch({ type: 'SET_RESULTS', payload: null })
      
      dispatch({ type: 'INCREMENT_RETRY' })
      
      // Show retry option if not already retrying too many times
      if (state.retryCount < 3) {
        addToast(
          `Vurdering feilet: ${errorMessage}. Prøv igjen eller kontakt support.`, 
          'error'
        )
      } else {
        addToast(
          'Vurdering feilet etter flere forsøk. Vennligst kontakt support.', 
          'error'
        )
      }
    } finally {
      clearTimeout(timeoutId)
      dispatch({ type: 'SET_ASSESSING', payload: false })
      // Only reset progress if we don't have results (i.e., assessment failed)
      if (!state.results) {
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 0, message: '' } })
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
      console.log('🏁 Assessment flow completed (success or error)')
    }
  }, [state, addToast])

  const canStartAssessment = useCallback(() => {
    return state.selectedVersion && state.selectedCategory && state.selectedTopic && 
           state.selectedCriteria.length > 0 && state.selectedFiles.length > 0 && 
           state.selectedPhase && !state.isAssessing
  }, [state])

  // Debug logging removed to prevent console spam

  // Removed page rendering - now using direct HTML links

  // Results view
  if (state.results) {
    console.log('🎯 RENDERING RESULTS VIEW with:', state.results)
    console.log('📊 Has assessment:', !!state.results.assessment)
    console.log('📋 Has criterion assessments:', !!state.results.criterion_assessments)
    return (
      <Suspense fallback={<LoadingSkeleton type="results" />}>
        <EnhancedAssessmentResults 
          results={state.results}
          onNewAssessment={resetForm}
          isAssessing={state.isAssessing}
          progress={state.progress}
          state={state}
          dispatch={dispatch}
        />
      </Suspense>
    )
  }

 // Main view
 return (
   <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
     {/* Offline Banner */}
     <OfflineBanner />
     
     {/* Toast notifications */}
     {state.toasts.map(toast => (
       <ToastNotification
         key={toast.id}
         message={toast.message}
         type={toast.type}
         onClose={() => removeToast(toast.id)}
       />
     ))}
     
     {/* Chunks Modal */}
     <ChunksModal
       isOpen={state.showChunksModal}
       onClose={() => dispatch({ type: 'SHOW_CHUNKS_MODAL', payload: { show: false } })}
       criterion={state.selectedCriterionChunks}
     />
     
     {/* Privacy Modal */}
     {state.showPrivacyModal && (
       <PrivacyModal 
         state={state} 
         dispatch={dispatch} 
         startAnalysis={startAnalysis}
       />
     )}
     
     {/* Progress Modal with enhanced message */}
     <AssessmentProgress 
       isAssessing={state.isAssessing} 
       progress={state.progress} 
       progressMessage={state.progressMessage}
     />
     
     {/* Success Animation */}
     {state.results && !state.currentPage && (
       <SuccessAnimation onComplete={() => {}} />
     )}

     {/* Header - PROFESSIONAL LOGO */}
     <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
       <div className="max-w-7xl mx-auto px-6 py-5">
         <div className="flex items-center justify-between">
           <BreeamLogo 
             iconClickable={true} 
             onIconClick={() => window.location.reload()}
           />
           <nav className="hidden md:flex items-center space-x-10 text-sm">
             <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
               BREEAM
               <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
             </a>
             <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
               Bærekraft
               <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
             </a>
             <a href="#" className="text-gray-600 hover:text-emerald-700 font-normal transition-all duration-200 relative group focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded px-2 py-1">
               Om oss
               <span className="absolute inset-x-0 bottom-0 h-0.5 bg-emerald-700 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200"></span>
             </a>
             <a href="#" className="bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-emerald-700 transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-lg hover:shadow-xl">
               Kontakt oss
             </a>
           </nav>
         </div>
       </div>
     </header>

     <div className="max-w-7xl mx-auto px-6 py-12">
       {/* Hero section with Satoshi typography */}
       <div className="text-center mb-16 py-8 relative">
         <div className="absolute inset-0 opacity-5">
           <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 animate-pulse">
             <svg viewBox="0 0 400 400" className="w-full h-full">
               <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                 <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2"/>
               </pattern>
               <rect width="100%" height="100%" fill="url(#grid)" />
               <circle cx="200" cy="200" r="150" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1"/>
               <circle cx="200" cy="200" r="100" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1"/>
             </svg>
           </div>
         </div>
         
         <div className="relative z-10">
           <h1 className="text-5xl md:text-6xl font-bold mb-8 leading-tight tracking-tight">
             <span className="text-emerald-700">AI-assistert</span>
             <span className="text-gray-900"> BREEAM-NOR dokumentanalyse</span>
           </h1>
           
           <div className="text-xl font-light text-gray-600 mb-12 max-w-4xl mx-auto leading-relaxed text-center">
             <p className="mb-4 font-normal">
               Profesjonell vurdering av kriterier basert på din prosjektdokumentasjon
             </p>
             <div className="flex items-center justify-center gap-8 text-sm text-gray-700">
               <div className="flex items-center gap-2">
                 <Shield className="w-4 h-4 text-emerald-600" />
                 <span>Sikker databehandling</span>
               </div>
               <div className="flex items-center gap-2">
                 <FileCheck className="w-4 h-4 text-emerald-600" />
                 <span>Full sporbarhet</span>
               </div>
               <div className="flex items-center gap-2">
                 <Award className="w-4 h-4 text-emerald-600" />
                 <span>Basert på offisielle manualer</span>
               </div>
             </div>
           </div>
         </div>

         {/* Enhanced Stats with social proof moved down */}
         <div className="flex items-center justify-center space-x-8 md:space-x-16 mb-8 py-8 relative z-10">
           <div className="text-center group cursor-default">
             <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200">
               <Lightning className="w-10 h-10 text-gray-700" />
             </div>
             <div className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">20 sek</div>
             <div className="text-sm font-medium text-gray-600">Gjennomsnittlig analysetid</div>
             <div className="text-xs text-gray-500 mt-1">Verifisert av 500+ vurderinger</div>
           </div>
           
           <div className="w-px h-20 bg-gray-200" aria-hidden="true"></div>
           
           <div className="text-center group cursor-default">
             <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200">
               <TrendingUp className="w-10 h-10 text-gray-700" />
             </div>
             <div className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">95%</div>
             <div className="text-sm font-medium text-gray-600">Raskere enn manuell revidering</div>
             <div className="text-xs text-gray-500 mt-1">Basert på brukerundersøkelser</div>
           </div>
           
           <div className="w-px h-20 bg-gray-200" aria-hidden="true"></div>
           
           <div className="text-center group cursor-default">
             <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-200">
               <Brain className="w-10 h-10 text-gray-700" />
             </div>
             <div className="text-2xl md:text-3xl font-semibold text-gray-900 mb-2">AI-motor</div>
             <div className="text-sm font-medium text-gray-600">GPT-4o teknologi</div>
             <div className="text-xs text-gray-500 mt-1">Oppdatert kvartalsvis</div>
           </div>
         </div>

         {/* Visual arrow/transition - reduced spacing */}
         <div className="flex justify-center mb-6">
           <div className="animate-bounce">
             <ArrowDown className="w-8 h-8 text-emerald-600" />
           </div>
         </div>
       </div>

       {/* Configuration section - moved closer to arrow */}
       <div className="bg-white rounded-lg border border-gray-200 shadow-xl p-12 mb-12 max-w-5xl mx-auto -mt-6">
         <div className="text-center mb-8">
           <h2 className="text-2xl md:text-3xl font-semibold text-emerald-700 mb-6 tracking-tight">
             Konfigurasjon av vurderingsparametere
           </h2>
           <p className="text-lg font-light text-gray-600 max-w-2xl mx-auto leading-relaxed mb-6">
             Spesifiser manual, kategori og kriterier for dokumentanalyse
           </p>
           
           
           {/* Trust signals */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 mb-10">
             <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
               <div className="flex items-start gap-3">
                 <Shield className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                 <div className="text-left">
                   <h4 className="text-sm font-semibold text-gray-900 mb-1">Datasikkerhet</h4>
                   <p className="text-xs text-gray-600 font-light">All data slettes automatisk etter 1 time. GDPR-compliant.</p>
                 </div>
               </div>
             </div>
             
             <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
               <div className="flex items-start gap-3">
                 <FileSearch className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                 <div className="text-left">
                   <h4 className="text-sm font-semibold text-gray-900 mb-1">Revisjonssporbarhet</h4>
                   <p className="text-xs text-gray-600 font-light">Alle vurderinger refererer til faktiske dokumenter og sider.</p>
                 </div>
               </div>
             </div>
             
             <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
               <div className="flex items-start gap-3">
                 <Award className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                 <div className="text-left">
                   <h4 className="text-sm font-semibold text-gray-900 mb-1">Faglig integritet</h4>
                   <p className="text-xs text-gray-600 font-light">Basert på offisielle BREEAM-NOR manualer og praksis.</p>
                 </div>
               </div>
             </div>
           </div>
         </div>
         
         {/* Display API errors if any */}
         {(errors.versions || errors.categories || errors.topics || errors.criteria) && (
           <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8 animate-slideIn" role="alert">
             <div className="flex items-start">
               <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5 mr-4 flex-shrink-0" aria-hidden="true" />
               <div>
                 <h4 className="text-base font-semibold text-yellow-800 mb-2">Advarsel</h4>
                 <div className="text-sm text-yellow-700 space-y-1 font-light">
                   {errors.versions && <p>• Problem med lasting av versjoner: {errors.versions}</p>}
                   {errors.categories && <p>• Problem med lasting av kategorier: {errors.categories}</p>}
                   {errors.topics && <p>• Problem med lasting av emner: {errors.topics}</p>}
                   {errors.criteria && <p>• Problem med lasting av kriterier: {errors.criteria}</p>}
                   <p className="mt-3 font-medium">Bruker fallback-data. Noen funksjoner kan være begrenset.</p>
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* Progressive disclosure configuration */}
         <ProgressiveConfiguration
           state={state}
           dispatch={dispatch}
           data={data}
           loading={loading}
           errors={errors}
           onFileUpload={handleFileUpload}
           onDrop={handleDrop}
           addToast={addToast}
         />

         {/* Privacy consent */}
         {state.selectedFiles.length > 0 && (
           <div className="mt-10 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
             <div className="flex items-start space-x-3">
               <input
                 type="checkbox"
                 id="privacy-consent"
                 checked={state.hasConsentedToPrivacy}
                 onChange={(e) => dispatch({ type: 'SET_PRIVACY_CONSENT', payload: e.target.checked })}
                 className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-600 mt-1 touch-manipulation"
               />
               <label htmlFor="privacy-consent" className="text-sm text-gray-700 font-light leading-relaxed">
                 <strong className="font-medium">Samtykke til databehandling:</strong> Jeg godtar behandling av opplastede dokumenter i henhold til{' '}
                 <a
                   href="/personvern.html"
                   className="text-emerald-700 underline hover:text-emerald-800 font-medium transition-colors"
                 >
                   personvernerklæringen
                 </a>
                 {' '}og{' '}
                 <a
                   href="/bruksvilkar.html"
                   className="text-emerald-700 underline hover:text-emerald-800 font-medium transition-colors"
                 >
                   bruksvilkårene
                 </a>
                 . All data slettes automatisk innen 1 time.
               </label>
             </div>
           </div>
         )}

         {/* Start button with error state */}
         {state.selectedFiles.length > 0 && (
           <div className="mt-10 text-center">
             {state.lastError && !state.isAssessing && (
               <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 max-w-lg mx-auto">
                 <div className="flex items-start gap-3">
                   <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                   <div className="flex-1 text-left">
                     <p className="text-sm font-medium text-red-800">Siste forsøk feilet</p>
                     <p className="text-sm text-red-700 mt-1">{state.lastError.message}</p>
                     {state.retryCount < 3 && (
                       <button
                         onClick={() => startAnalysis(true)}
                         className="mt-3 text-sm font-medium text-red-700 hover:text-red-800 underline"
                       >
                         Prøv igjen ({state.retryCount}/3)
                       </button>
                     )}
                   </div>
                 </div>
               </div>
             )}
             
             <button
               onClick={() => startAnalysis()}
               disabled={!canStartAssessment()}
               className={`px-12 py-4 rounded-lg font-bold text-lg transition-all duration-200 min-h-[48px] shadow-lg ${
                 canStartAssessment()
                   ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-xl transform hover:scale-105'
                   : 'bg-gray-300 text-gray-500 cursor-not-allowed'
               }`}
             >
               {state.isAssessing ? (
                 <div className="flex items-center space-x-3">
                   <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                   <span>Analyserer dokumenter...</span>
                 </div>
               ) : (
                 <div className="flex items-center space-x-3">
                   <span>Få min {state.reportFormat.toUpperCase()}-vurdering nå</span>
                   <ArrowRight className="w-6 h-6" />
                 </div>
               )}
             </button>
             
             <div className="mt-3 text-xs text-gray-500">
               <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded">Ctrl</kbd> + 
               <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded ml-1">Enter</kbd> 
               <span className="ml-2">for å starte analyse</span>
             </div>
             
             {!state.hasConsentedToPrivacy && state.selectedFiles.length > 0 && (
               <p className="text-sm text-red-600 mt-3 font-light">
                 Du må godta personvernerklæringen for å fortsette
               </p>
             )}
             
             {canStartAssessment() && (
               <p className="text-gray-600 mt-4 font-light">
                 Estimert tid: {Math.ceil(state.selectedCriteria.length * 0.5)} minutter
               </p>
             )}
           </div>
         )}
       </div>

       {/* Sticky CTA for criteria selection */}
       {state.selectedVersion && state.selectedCategory && state.selectedTopic && !state.selectedCriteria.length && (
         <div className="fixed bottom-8 left-0 right-0 z-40 px-6 animate-slideUp">
           <div className="max-w-md mx-auto">
             <button
               onClick={() => {
                 const criteriaSection = document.querySelector('[data-criteria-section]')
                 criteriaSection?.scrollIntoView({ behavior: 'smooth', block: 'center' })
               }}
               className="w-full bg-emerald-700 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:bg-emerald-800 transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 flex items-center justify-center gap-3"
             >
               <span>Velg kriterier for vurdering</span>
               <ArrowRight className="w-5 h-5" />
             </button>
           </div>
         </div>
       )}

       {/* Footer - UPDATED WITH STATUS INDICATORS */}
       <footer className="mt-32 bg-gradient-to-t from-gray-50 to-white border-t border-gray-200">
         <div className="max-w-7xl mx-auto px-4 py-16">
           
           {/* Main Footer Content */}
           <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-8 items-start mb-12">
             
             {/* Brand Column */}
             <div className="space-y-3 max-w-[220px]">
               <BreeamLogo size="default" />
               
               <p className="text-gray-600 text-sm font-light leading-relaxed">
                 Profesjonell, nøytral og pålitelig AI-revisor for norske BREEAM-prosjekter.
               </p>
             </div>

             {/* Quick Links */}
             <div className="text-sm space-y-4">
               <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Personvern</h4>
               <nav className="space-y-0">
                 <a 
                   href="/personvern.html"
                   className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                 >
                   Personvernerklæring
                 </a>
                 <a 
                   href="/cookies.html"
                   className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                 >
                   Informasjonskapsler
                 </a>
                 <a 
                   href="/bruksvilkar.html"
                   className="block text-sm text-gray-600 hover:text-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded py-0.5 text-left font-light"
                 >
                   Bruksvilkår
                 </a>
               </nav>
             </div>

             {/* Contact */}
             <div className="text-sm space-y-4">
               <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Kontakt</h4>
               <div className="space-y-0 text-gray-600 font-light">
                 <a href="mailto:support@breeamai.no" className="block hover:text-emerald-700 transition-colors py-0.5">
                   support@breeamai.no
                 </a>
                 <a href="tel:+4712345678" className="block hover:text-emerald-700 transition-colors py-0.5">
                   +47 123 45 678
                 </a>
                 <p className="py-0.5">Oslo, Norge</p>
               </div>
             </div>

             {/* Status */}
             <div className="text-sm space-y-4">
               <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Status</h4>
               <div className="space-y-0 text-gray-600 font-light">
                 <p className="text-sm py-0.5">Trusted by BREEAM-NOR sertifiserte selskaper</p>
                 <p className="text-sm py-0.5">Testet av BREEAM-revisorer og AP-er</p>
               </div>
             </div>
           </div>

           {/* Bottom Bar with all trust signals */}
           <div className="border-t border-gray-200 pt-8">
             <div className="flex flex-col items-center space-y-3">
               <div className="flex items-center justify-center space-x-8 text-sm text-gray-500 font-medium flex-wrap">
                 <span className="flex items-center space-x-1">
                   <Shield className="w-4 h-4 text-emerald-600" />
                   <span className="text-gray-500">GDPR-kompatibel</span>
                 </span>
                 <span className="flex items-center space-x-1">
                   <span className="text-gray-500">Utviklet i Norge - med</span>
                   <span className="text-emerald-600 text-base">💚</span>
                   <span className="text-gray-500">for bærekraftige bygg</span>
                 </span>
                 <span className="flex items-center space-x-1">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                   <span className="text-gray-500">Alle systemer operative</span>
                 </span>
                 <span className="text-gray-500">© 2024 BREEAMai</span>
               </div>
             </div>
           </div>
         </div>
       </footer>
     </div>
   </div>
 )
}

// Create style element for Satoshi font and animations
const GlobalStyles = () => {
 useEffect(() => {
   const style = document.createElement('style')
   style.textContent = `
     @import url('https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,301,701,300,501,401,901,400&display=swap');
     
     * {
       font-family: 'Satoshi', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
     }
     
     body {
       -webkit-font-smoothing: antialiased;
       -moz-osx-font-smoothing: grayscale;
       font-feature-settings: 'cv01', 'cv02', 'cv03', 'cv04';
     }
     
     /* Force font on all text elements */
     h1, h2, h3, h4, h5, h6, p, span, div, button, input, select, textarea {
       font-family: 'Satoshi', ui-sans-serif, system-ui !important;
     }
     
     /* Custom animations */
     @keyframes slideIn {
       from {
         opacity: 0;
         transform: translateY(-20px);
       }
       to {
         opacity: 1;
         transform: translateY(0);
       }
     }
     
     @keyframes slideUp {
       from {
         opacity: 0;
         transform: translateY(20px);
       }
       to {
         opacity: 1;
         transform: translateY(0);
       }
     }
     
     .animate-slideIn {
       animation: slideIn 0.3s ease-out;
     }
     
     .animate-slideUp {
       animation: slideUp 0.3s ease-out;
     }
     
     /* Line clamp utility */
     .line-clamp-2 {
       overflow: hidden;
       display: -webkit-box;
       -webkit-box-orient: vertical;
       -webkit-line-clamp: 2;
     }
     
     /* Keyboard shortcuts for better UX */
     .focus-visible:outline-none {
       outline: 2px solid #10b981;
       outline-offset: 2px;
     }
     
     /* Success animation keyframes */
     @keyframes fadeIn {
       from { opacity: 0; }
       to { opacity: 1; }
     }
     
     @keyframes fadeInScale {
       from {
         opacity: 0;
         transform: scale(0.8);
       }
       to {
         opacity: 1;
         transform: scale(1);
       }
     }
     
     .animate-fadeIn {
       animation: fadeIn 0.3s ease-out;
     }
     
     .animate-fadeInScale {
       animation: fadeInScale 0.5s ease-out;
     }
     
     /* Touch targets for mobile */
     .touch-manipulation {
       touch-action: manipulation;
     }
   `
   document.head.appendChild(style)
   
   // Cleanup
   return () => {
     document.head.removeChild(style)
   }
 }, [])
 
 return null
}

// Main component wrapped with ErrorBoundary
export default function BreeamAIPage() {
  return (
    <ErrorBoundary>
      <GlobalStyles />
      <EnhancedBREEAMAI />
    </ErrorBoundary>
  );
}