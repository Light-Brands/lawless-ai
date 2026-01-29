'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Brand } from '@/app/types/builder';
import { MarkdownRenderer } from '@/app/components/MarkdownRenderer';

interface AuthStatus {
  authenticated: boolean;
  user?: { login: string; name: string; avatar: string };
  vercel?: { connected: boolean };
  supabase?: { connected: boolean };
}

interface StepResult {
  step: string;
  status: 'success' | 'error' | 'skipped';
  data?: Record<string, unknown>;
  error?: string;
}

interface CreateResult {
  success: boolean;
  results: StepResult[];
  summary: {
    github?: { fullName: string; htmlUrl: string };
    supabase?: { ref: string; url: string };
    vercel?: { id: string; name: string };
  };
}

interface GitHubAccount {
  login: string;
  name: string;
  avatarUrl: string;
  type: 'personal' | 'organization';
}

interface VercelAccount {
  id: string;
  slug: string;
  name: string;
  avatar?: string;
  type: 'personal' | 'team';
}

interface SupabaseOrg {
  id: string;
  name: string;
}

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const VercelIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2L2 19.5h20L12 2z"/>
  </svg>
);

const SupabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2v4"/>
    <path d="m6.8 15-3.5 2"/>
    <path d="m20.7 17-3.5-2"/>
    <path d="M6.8 9 3.3 7"/>
    <path d="m20.7 7-3.5 2"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const LoadingSpinner = () => (
  <div className="new-project-spinner"></div>
);

const ExternalLinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/>
    <line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

export default function NewProjectPage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [result, setResult] = useState<CreateResult | null>(null);

  // Form state
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [includeAiConfig, setIncludeAiConfig] = useState(true);
  const [includeVercel, setIncludeVercel] = useState(true);
  const [includeSupabase, setIncludeSupabase] = useState(true);
  const [supabaseRegion, setSupabaseRegion] = useState('us-east-1');

  // Organization state
  const [githubAccounts, setGithubAccounts] = useState<GitHubAccount[]>([]);
  const [vercelAccounts, setVercelAccounts] = useState<VercelAccount[]>([]);
  const [supabaseOrgs, setSupabaseOrgs] = useState<SupabaseOrg[]>([]);
  const [selectedGithubAccount, setSelectedGithubAccount] = useState<string>('');
  const [selectedVercelAccount, setSelectedVercelAccount] = useState<string>('');
  const [selectedSupabaseOrg, setSelectedSupabaseOrg] = useState<string>('');

  // Brand selection state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [showPlanPreview, setShowPlanPreview] = useState(false);
  const [showIdentityPreview, setShowIdentityPreview] = useState(false);
  const [planContent, setPlanContent] = useState<string>('');
  const [identityContent, setIdentityContent] = useState<string>('');

  // File upload refs
  const planFileRef = useRef<HTMLInputElement>(null);
  const identityFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (authStatus?.authenticated) {
      loadOrganizations();
      loadBrands();
    }
  }, [authStatus]);

  // Auto-fill project name from selected brand
  useEffect(() => {
    if (selectedBrand) {
      const brand = brands.find(b => b.name === selectedBrand);
      if (brand && !projectName) {
        // Convert brand name to project name format
        setProjectName(brand.name);
      }
    }
  }, [selectedBrand, brands]);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthStatus(data);

      if (!data.authenticated) {
        router.push('/');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganizations() {
    // Fetch GitHub accounts
    try {
      const res = await fetch('/api/github/orgs');
      if (res.ok) {
        const data = await res.json();
        setGithubAccounts(data.accounts || []);
        if (data.accounts?.length > 0) {
          setSelectedGithubAccount(data.accounts[0].login);
        }
      }
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
    }

    // Fetch Vercel accounts if connected
    if (authStatus?.vercel?.connected) {
      try {
        const res = await fetch('/api/integrations/vercel/teams');
        if (res.ok) {
          const data = await res.json();
          setVercelAccounts(data.accounts || []);
          if (data.accounts?.length > 0) {
            setSelectedVercelAccount(data.accounts[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load Vercel accounts:', error);
      }
    }

    // Fetch Supabase orgs if connected
    if (authStatus?.supabase?.connected) {
      try {
        const res = await fetch('/api/integrations/supabase/organizations');
        if (res.ok) {
          const data = await res.json();
          setSupabaseOrgs(data.organizations || []);
          if (data.organizations?.length > 0) {
            setSelectedSupabaseOrg(data.organizations[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load Supabase orgs:', error);
      }
    }
  }

  async function loadBrands() {
    setLoadingBrands(true);
    try {
      const res = await fetch('/api/builder/brands');
      if (res.ok) {
        const data = await res.json();
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Failed to load brands:', error);
    } finally {
      setLoadingBrands(false);
    }
  }

  async function loadBrandContent(brandName: string) {
    try {
      const res = await fetch(`/api/builder/brands/${encodeURIComponent(brandName)}`);
      if (res.ok) {
        const data = await res.json();
        setPlanContent(data.plan || '');
        setIdentityContent(data.identity || '');
      }
    } catch (error) {
      console.error('Failed to load brand content:', error);
    }
  }

  // Load brand content when selected
  useEffect(() => {
    if (selectedBrand) {
      loadBrandContent(selectedBrand);
    } else {
      setPlanContent('');
      setIdentityContent('');
    }
  }, [selectedBrand]);

  function handleFileUpload(file: File, target: 'plan' | 'identity') {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (target === 'plan') {
        setPlanContent(content);
      } else {
        setIdentityContent(content);
      }
    };
    reader.readAsText(file);
  }

  async function handleCreate() {
    if (!selectedBrand) {
      alert('Please select a brand.');
      return;
    }

    if (!projectName.trim()) {
      alert('Please enter a project name.');
      return;
    }

    if (!planContent.trim()) {
      alert('Project plan is required. Paste content, upload a .md file, or select a brand that has a plan.');
      return;
    }

    if (!identityContent.trim()) {
      alert('Brand identity is required. Paste content, upload a .md file, or select a brand that has an identity.');
      return;
    }

    // Validate project name (GitHub requirements)
    const nameRegex = /^[a-zA-Z0-9._-]+$/;
    if (!nameRegex.test(projectName)) {
      alert('Project name can only contain letters, numbers, hyphens, underscores, and periods');
      return;
    }

    setCreating(true);
    setCurrentStep('Starting...');

    // Get selected GitHub account info to determine if it's an org
    const githubAccount = githubAccounts.find(a => a.login === selectedGithubAccount);
    const githubOrg = githubAccount?.type === 'organization' ? selectedGithubAccount : undefined;

    // Get selected Vercel account info to determine if it's a team
    const vercelAccount = vercelAccounts.find(a => a.id === selectedVercelAccount);
    const vercelTeamId = vercelAccount?.type === 'team' ? selectedVercelAccount : undefined;

    const stepResults: StepResult[] = [];

    try {
      const response = await fetch('/api/projects/create-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description,
          isPrivate,
          includeAiConfig,
          includeVercel,
          includeSupabase,
          supabaseRegion,
          githubOrg,
          vercelTeamId,
          supabaseOrgId: selectedSupabaseOrg || undefined,
          // Pass brand name instead of document content
          brandName: selectedBrand,
          // Also pass the content directly since it's already loaded
          projectPlan: planContent ? { type: 'upload', content: planContent } : undefined,
          brandIdentity: identityContent ? { type: 'upload', content: identityContent } : undefined,
        }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7);
          } else if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (eventType === 'progress') {
              setCurrentStep(data.message);
            } else if (eventType === 'step') {
              stepResults.push({
                step: data.step,
                status: data.status,
                data: data.data,
                error: data.error,
              });
            } else if (eventType === 'complete') {
              setResult({
                success: data.success,
                results: stepResults,
                summary: data.summary,
              });
            } else if (eventType === 'error') {
              setResult({
                success: false,
                results: [...stepResults, { step: 'error', status: 'error', error: data.message }],
                summary: {},
              });
            }
          }
        }
      }

      setCurrentStep('');
    } catch (error) {
      console.error('Create failed:', error);
      setResult({
        success: false,
        results: [{ step: 'error', status: 'error', error: 'Request failed' }],
        summary: {},
      });
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="new-project-page">
        <div className="new-project-loading">
          <LoadingSpinner />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const githubConnected = authStatus?.authenticated;
  const vercelConnected = authStatus?.vercel?.connected;
  const supabaseConnected = authStatus?.supabase?.connected;

  const selectedBrandData = brands.find(b => b.name === selectedBrand);
  const canCreate = Boolean(selectedBrand && projectName.trim() && planContent.trim() && identityContent.trim());

  return (
    <div className="new-project-page">
      <div className="new-project-ambient"></div>

      {/* Header */}
      <header className="new-project-header">
        <div className="new-project-header-content">
          <Link href="/" className="new-project-logo">
            <div className="new-project-logo-icon">
              <LightningIcon />
            </div>
            <span className="new-project-logo-text">Lawless AI</span>
          </Link>

          <nav className="new-project-nav">
            <Link href="/builder" className="new-project-nav-link">Builder</Link>
            <Link href="/repos" className="new-project-nav-link">Repos</Link>
            <Link href="/integrations" className="new-project-nav-link">Integrations</Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="new-project-main">
        <div className="new-project-container">
          {!result ? (
            <>
              <div className="new-project-title-section">
                <h1 className="new-project-title">Create New Project</h1>
                <p className="new-project-subtitle">
                  Launch a full-stack Next.js + Supabase project with one click
                </p>
              </div>

              {/* Integration Status */}
              <div className="new-project-integrations">
                <div className={`new-project-integration ${githubConnected ? 'connected' : 'disconnected'}`}>
                  <GitHubIcon />
                  <span>GitHub</span>
                  {githubConnected ? <CheckIcon /> : <XIcon />}
                </div>
                <div className={`new-project-integration ${vercelConnected ? 'connected' : 'disconnected'}`}>
                  <VercelIcon />
                  <span>Vercel</span>
                  {vercelConnected ? <CheckIcon /> : <XIcon />}
                </div>
                <div className={`new-project-integration ${supabaseConnected ? 'connected' : 'disconnected'}`}>
                  <SupabaseIcon />
                  <span>Supabase</span>
                  {supabaseConnected ? <CheckIcon /> : <XIcon />}
                </div>
              </div>

              {(!vercelConnected || !supabaseConnected) && (
                <div className="new-project-warning">
                  <p>
                    Some integrations are not connected.{' '}
                    <Link href="/integrations">Connect them</Link> to use all features.
                  </p>
                </div>
              )}

              {/* Form */}
              <div className="new-project-form">
                {/* Brand Selection - REQUIRED */}
                <div className="new-project-brand-section">
                  <div className="new-project-brand-header">
                    <span className="new-project-doc-title">
                      Select Brand <span className="new-project-required">*</span>
                    </span>
                    <Link href="/builder" target="_blank" className="new-project-brand-create-link">
                      <PlusIcon />
                      Create New Brand
                    </Link>
                  </div>

                  <select
                    className="new-project-brand-select"
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    disabled={creating || loadingBrands}
                  >
                    <option value="">
                      {loadingBrands ? 'Loading brands...' : 'Select a brand...'}
                    </option>
                    {brands.map(brand => (
                      <option key={brand.name} value={brand.name}>
                        {brand.displayName}
                        {!brand.hasPlan && !brand.hasIdentity ? ' (no plan or identity)' : !brand.hasPlan ? ' (no plan)' : !brand.hasIdentity ? ' (no identity)' : ''}
                      </option>
                    ))}
                  </select>

                  {!selectedBrand && brands.length === 0 && !loadingBrands && (
                    <div className="new-project-brand-empty">
                      <p>No brands found. Create a brand in the Builder to get started.</p>
                      <Link href="/builder" className="new-project-brand-create-btn">
                        <PlusIcon />
                        Create Brand in Builder
                      </Link>
                    </div>
                  )}
                </div>

                {/* Project Plan - editable textarea */}
                <div className="new-project-doc-section">
                  <div className="new-project-doc-header">
                    <span className="new-project-doc-title">
                      Project Plan <span className="new-project-required">*</span>
                    </span>
                    <div className="new-project-doc-actions">
                      <button
                        type="button"
                        className="new-project-preview-btn"
                        onClick={() => setShowPlanPreview(true)}
                        disabled={!planContent}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="new-project-preview-btn"
                        onClick={() => planFileRef.current?.click()}
                        disabled={creating}
                      >
                        Upload .md
                      </button>
                      <input
                        ref={planFileRef}
                        type="file"
                        accept=".md,.markdown,.txt"
                        className="new-project-upload-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'plan');
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    className="new-project-content-textarea"
                    value={planContent}
                    onChange={(e) => setPlanContent(e.target.value)}
                    placeholder="Paste or type your project plan in markdown..."
                    disabled={creating}
                    rows={10}
                  />
                </div>

                {/* Brand Identity - editable textarea */}
                <div className="new-project-doc-section">
                  <div className="new-project-doc-header">
                    <span className="new-project-doc-title">
                      Brand Identity <span className="new-project-required">*</span>
                    </span>
                    <div className="new-project-doc-actions">
                      <button
                        type="button"
                        className="new-project-preview-btn"
                        onClick={() => setShowIdentityPreview(true)}
                        disabled={!identityContent}
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        className="new-project-preview-btn"
                        onClick={() => identityFileRef.current?.click()}
                        disabled={creating}
                      >
                        Upload .md
                      </button>
                      <input
                        ref={identityFileRef}
                        type="file"
                        accept=".md,.markdown,.txt"
                        className="new-project-upload-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file, 'identity');
                          e.target.value = '';
                        }}
                      />
                    </div>
                  </div>
                  <textarea
                    className="new-project-content-textarea"
                    value={identityContent}
                    onChange={(e) => setIdentityContent(e.target.value)}
                    placeholder="Paste or type your brand identity in markdown..."
                    disabled={creating}
                    rows={10}
                  />
                </div>

                <div className="new-project-field">
                  <label htmlFor="projectName">Project Name *</label>
                  <input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="my-awesome-app"
                    disabled={creating}
                  />
                </div>

                <div className="new-project-field">
                  <label htmlFor="description">Description</label>
                  <input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A brief description of your project"
                    disabled={creating}
                  />
                </div>

                <div className="new-project-options">
                  <label className="new-project-checkbox">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                      disabled={creating}
                    />
                    <span>Private repository</span>
                  </label>

                  <label className="new-project-checkbox">
                    <input
                      type="checkbox"
                      checked={includeAiConfig}
                      onChange={(e) => setIncludeAiConfig(e.target.checked)}
                      disabled={creating}
                    />
                    <span>Include LightBrands Studio</span>
                  </label>

                  <label className="new-project-checkbox">
                    <input
                      type="checkbox"
                      checked={includeVercel}
                      onChange={(e) => setIncludeVercel(e.target.checked)}
                      disabled={creating || !vercelConnected}
                    />
                    <span>Deploy to Vercel</span>
                    {!vercelConnected && <span className="new-project-checkbox-note">(not connected)</span>}
                  </label>

                  <label className="new-project-checkbox">
                    <input
                      type="checkbox"
                      checked={includeSupabase}
                      onChange={(e) => setIncludeSupabase(e.target.checked)}
                      disabled={creating || !supabaseConnected}
                    />
                    <span>Create Supabase database</span>
                    {!supabaseConnected && <span className="new-project-checkbox-note">(not connected)</span>}
                  </label>
                </div>

                {includeSupabase && supabaseConnected && (
                  <div className="new-project-field">
                    <label htmlFor="region">Supabase Region</label>
                    <select
                      id="region"
                      value={supabaseRegion}
                      onChange={(e) => setSupabaseRegion(e.target.value)}
                      disabled={creating}
                    >
                      <option value="us-east-1">US East (N. Virginia)</option>
                      <option value="us-west-1">US West (N. California)</option>
                      <option value="eu-west-1">Europe (Ireland)</option>
                      <option value="eu-west-2">Europe (London)</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
                      <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                      <option value="ap-south-1">Asia Pacific (Mumbai)</option>
                      <option value="sa-east-1">South America (Sao Paulo)</option>
                    </select>
                  </div>
                )}

                {/* Organization Selectors */}
                <div className="new-project-org-section">
                  <h3 className="new-project-org-title">Create Under</h3>

                  {githubAccounts.length > 0 && (
                    <div className="new-project-field">
                      <label htmlFor="githubAccount">
                        <GitHubIcon />
                        <span>GitHub Account</span>
                      </label>
                      <select
                        id="githubAccount"
                        value={selectedGithubAccount}
                        onChange={(e) => setSelectedGithubAccount(e.target.value)}
                        disabled={creating}
                      >
                        {githubAccounts.map((account) => (
                          <option key={account.login} value={account.login}>
                            {account.name} {account.type === 'organization' ? '(Org)' : '(Personal)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {includeVercel && vercelConnected && vercelAccounts.length > 0 && (
                    <div className="new-project-field">
                      <label htmlFor="vercelAccount">
                        <VercelIcon />
                        <span>Vercel Account</span>
                      </label>
                      <select
                        id="vercelAccount"
                        value={selectedVercelAccount}
                        onChange={(e) => setSelectedVercelAccount(e.target.value)}
                        disabled={creating}
                      >
                        {vercelAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name} {account.type === 'team' ? '(Team)' : '(Personal)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {includeSupabase && supabaseConnected && supabaseOrgs.length > 0 && (
                    <div className="new-project-field">
                      <label htmlFor="supabaseOrg">
                        <SupabaseIcon />
                        <span>Supabase Organization</span>
                      </label>
                      <select
                        id="supabaseOrg"
                        value={selectedSupabaseOrg}
                        onChange={(e) => setSelectedSupabaseOrg(e.target.value)}
                        disabled={creating}
                      >
                        {supabaseOrgs.map((org) => (
                          <option key={org.id} value={org.id}>
                            {org.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <button
                  className="new-project-create-btn"
                  onClick={handleCreate}
                  disabled={creating || !githubConnected || !canCreate}
                >
                  {creating ? (
                    <>
                      <LoadingSpinner />
                      <span>{currentStep || 'Creating...'}</span>
                    </>
                  ) : (
                    <>
                      <LightningIcon />
                      <span>Create Project</span>
                    </>
                  )}
                </button>

                {!canCreate && !creating && (
                  <p className="new-project-create-hint">
                    {!selectedBrand
                      ? 'Select a brand to get started'
                      : !planContent.trim()
                        ? 'Add a project plan to continue'
                        : !identityContent.trim()
                          ? 'Add a brand identity to continue'
                          : !projectName.trim()
                            ? 'Enter a project name'
                            : ''}
                  </p>
                )}
              </div>

              {/* What gets created */}
              <div className="new-project-info">
                <h3>What gets created:</h3>
                <ul>
                  <li>GitHub repository with Next.js 14 + TypeScript template</li>
                  <li>Project plan and brand identity deployed to brand-details/</li>
                  <li>Supabase client configured and ready to use</li>
                  {includeVercel && vercelConnected && (
                    <li>Vercel project linked to GitHub with auto-deploy</li>
                  )}
                  {includeSupabase && supabaseConnected && (
                    <li>Supabase database with environment variables auto-configured</li>
                  )}
                </ul>
              </div>
            </>
          ) : (
            /* Results */
            <div className="new-project-results">
              <h1 className={`new-project-results-title ${result.success ? 'success' : 'error'}`}>
                {result.success ? 'Project Created!' : 'Creation Completed with Issues'}
              </h1>

              <div className="new-project-results-list">
                {result.results.map((step, index) => (
                  <div
                    key={index}
                    className={`new-project-result-item ${step.status}`}
                  >
                    <div className="new-project-result-icon">
                      {step.status === 'success' && <CheckIcon />}
                      {step.status === 'error' && <XIcon />}
                      {step.status === 'skipped' && <span>-</span>}
                    </div>
                    <div className="new-project-result-content">
                      <div className="new-project-result-step">
                        {step.step.charAt(0).toUpperCase() + step.step.slice(1)}
                      </div>
                      {step.status === 'success' && step.data && (
                        <div className="new-project-result-data">
                          {step.step === 'github' && (
                            <a href={step.data.htmlUrl as string} target="_blank" rel="noopener noreferrer">
                              {step.data.fullName as string} →
                            </a>
                          )}
                          {step.step === 'vercel' && (
                            <a href={step.data.url as string} target="_blank" rel="noopener noreferrer">
                              {step.data.url as string} →
                            </a>
                          )}
                          {step.step === 'supabase' && (
                            <div>
                              <a href={`https://supabase.com/dashboard/project/${step.data.ref}`} target="_blank" rel="noopener noreferrer">
                                Open Dashboard →
                              </a>
                              {step.data.dbPassword ? (
                                <div className="new-project-db-password">
                                  <strong>Database Password:</strong>
                                  <code>{String(step.data.dbPassword)}</code>
                                  <small>Save this! It won&apos;t be shown again.</small>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                      {step.status === 'error' && (
                        <div className="new-project-result-error">{step.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="new-project-results-actions">
                {result.summary.github && (
                  <Link
                    href={`/repos/${result.summary.github.fullName}`}
                    className="new-project-action-btn primary"
                  >
                    View Repository
                  </Link>
                )}
                <button
                  className="new-project-action-btn secondary"
                  onClick={() => {
                    setResult(null);
                    setProjectName('');
                    setDescription('');
                    setSelectedBrand('');
                    setPlanContent('');
                    setIdentityContent('');
                  }}
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Plan Preview Modal */}
      {showPlanPreview && (
        <div className="new-project-modal-overlay" onClick={() => setShowPlanPreview(false)}>
          <div className="new-project-modal new-project-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="new-project-modal-header">
              <h3>Project Plan</h3>
              <button className="new-project-modal-close" onClick={() => setShowPlanPreview(false)}>
                <XIcon />
              </button>
            </div>
            <div className="new-project-modal-content">
              <MarkdownRenderer content={planContent} />
            </div>
          </div>
        </div>
      )}

      {/* Identity Preview Modal */}
      {showIdentityPreview && (
        <div className="new-project-modal-overlay" onClick={() => setShowIdentityPreview(false)}>
          <div className="new-project-modal new-project-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="new-project-modal-header">
              <h3>Brand Identity</h3>
              <button className="new-project-modal-close" onClick={() => setShowIdentityPreview(false)}>
                <XIcon />
              </button>
            </div>
            <div className="new-project-modal-content">
              <MarkdownRenderer content={identityContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
