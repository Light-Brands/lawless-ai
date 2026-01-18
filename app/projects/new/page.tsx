'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
  const [includeVercel, setIncludeVercel] = useState(true);
  const [includeSupabase, setIncludeSupabase] = useState(true);
  const [supabaseRegion, setSupabaseRegion] = useState('us-east-1');

  useEffect(() => {
    checkAuth();
  }, []);

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

  async function handleCreate() {
    if (!projectName.trim()) {
      alert('Please enter a project name');
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

    try {
      // Simulate progress updates
      const steps: string[] = [];
      if (includeSupabase) steps.push('Creating Supabase database...');
      steps.push('Creating GitHub repository...');
      if (includeVercel) steps.push('Setting up Vercel deployment...');

      let stepIndex = 0;
      const progressInterval = setInterval(() => {
        if (stepIndex < steps.length) {
          setCurrentStep(steps[stepIndex]);
          stepIndex++;
        }
      }, 3000);

      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description,
          isPrivate,
          includeGitHub: true,
          includeVercel,
          includeSupabase,
          supabaseRegion,
        }),
      });

      clearInterval(progressInterval);

      const data = await res.json();
      setResult(data);
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

                <button
                  className="new-project-create-btn"
                  onClick={handleCreate}
                  disabled={creating || !githubConnected}
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
              </div>

              {/* What gets created */}
              <div className="new-project-info">
                <h3>What gets created:</h3>
                <ul>
                  <li>GitHub repository with Next.js 14 + TypeScript template</li>
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
                  }}
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
