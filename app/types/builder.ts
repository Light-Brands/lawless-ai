/**
 * Types for the Builder Portal
 * Used for managing brands, project plans, and brand identities
 */

// Brand status in the brand-factory
export interface Brand {
  name: string; // Folder name in brand-factory/brands/
  displayName: string; // Human-readable name from metadata
  hasPlan: boolean;
  hasIdentity: boolean;
  isComplete: boolean; // Has both plan AND identity
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

// Brand metadata stored in metadata.json
export interface BrandMetadata {
  brandName: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  hasPlan: boolean;
  hasIdentity: boolean;
}

// Builder types
export type BuilderType = 'plan' | 'identity';

// Builder chat request
export interface BuilderChatRequest {
  brandName: string;
  builderType: BuilderType;
  message: string;
  history?: BuilderMessage[];
  currentDocument?: string; // Current state of the document being built
}

// Builder message for history
export interface BuilderMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Document update parsed from AI response
export interface DocumentUpdate {
  section: string;
  content: string;
}

// Plan Builder sections
export const PLAN_SECTIONS = [
  'overview',
  'goals',
  'target_users',
  'key_features',
  'technical_stack',
  'success_metrics',
  'timeline',
] as const;

export type PlanSection = (typeof PLAN_SECTIONS)[number];

// Identity Builder sections
export const IDENTITY_SECTIONS = [
  'brand_overview',
  'mission_statement',
  'voice_and_tone',
  'visual_identity',
  'target_audience',
  'brand_personality',
] as const;

export type IdentitySection = (typeof IDENTITY_SECTIONS)[number];

// Builder conversation state (stored in DB for crash recovery)
export interface BuilderConversation {
  id: string;
  brandName: string;
  builderType: BuilderType;
  messages: BuilderMessage[];
  documentSections: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  userId: string;
  status: 'in_progress' | 'completed' | 'abandoned';
}

// API response types
export interface BrandsListResponse {
  brands: Brand[];
}

export interface BrandResponse {
  brand: Brand;
  plan?: string;
  identity?: string;
}

export interface SaveBrandResponse {
  success: boolean;
  brand: Brand;
  commitSha?: string;
}

// Builder chat streaming events
export type BuilderEventType =
  | 'text'
  | 'document_update'
  | 'section_complete'
  | 'error'
  | 'done';

export interface BuilderTextEvent {
  type: 'text';
  content: string;
}

export interface BuilderDocumentUpdateEvent {
  type: 'document_update';
  section: string;
  content: string;
}

export interface BuilderSectionCompleteEvent {
  type: 'section_complete';
  section: string;
}

export interface BuilderErrorEvent {
  type: 'error';
  message: string;
}

export interface BuilderDoneEvent {
  type: 'done';
}

export type BuilderEvent =
  | BuilderTextEvent
  | BuilderDocumentUpdateEvent
  | BuilderSectionCompleteEvent
  | BuilderErrorEvent
  | BuilderDoneEvent;
