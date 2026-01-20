'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { BuilderType } from '@/app/types/builder';
import { useBrands } from './hooks/useBrands';
import { useBuilderChat } from './hooks/useBuilderChat';
import { generateDocument } from './lib/documentTemplates';
import { BrandSelector, NewBrandModal } from './components/BrandSelector';
import { TabNavigation } from './components/TabNavigation';
import { BuilderChat } from './components/BuilderChat';
import { DocumentPreview } from './components/DocumentPreview';
import { BrandVault } from './components/BrandVault';

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export default function BuilderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  // State
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<BuilderType>('plan');
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hooks
  const { brands, loading: loadingBrands, createBrand, getBrand, refreshBrands } = useBrands();

  const {
    messages,
    isLoading: chatLoading,
    documentSections,
    sendMessage,
    clearMessages,
    setDocumentSections,
  } = useBuilderChat({
    brandName: selectedBrand || '',
    builderType: activeTab,
  });

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthenticated(data.authenticated);
      if (!data.authenticated) {
        router.push('/');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  // Load existing brand data when selected
  useEffect(() => {
    if (selectedBrand) {
      loadBrandData(selectedBrand);
    }
  }, [selectedBrand, activeTab]);

  async function loadBrandData(brandName: string) {
    const brandData = await getBrand(brandName);
    if (brandData) {
      // Load existing content as raw - don't try to parse into template sections
      const content = activeTab === 'plan' ? brandData.plan : brandData.identity;
      if (content) {
        // Store as raw content - existing docs evolve naturally, not forced into templates
        setDocumentSections({ _raw_content: content });
      } else {
        // No existing content - start fresh with template
        setDocumentSections({});
      }
    }
  }

  // Handle brand creation
  const handleCreateBrand = useCallback(
    async (brandName: string) => {
      setCreatingBrand(true);
      const brand = await createBrand(brandName);
      setCreatingBrand(false);

      if (brand) {
        setSelectedBrand(brand.name);
        setShowNewBrandModal(false);
        clearMessages();
      }
    },
    [createBrand, clearMessages]
  );

  // Handle brand selection
  const handleSelectBrand = useCallback(
    (brandName: string) => {
      if (brandName !== selectedBrand) {
        setSelectedBrand(brandName);
        clearMessages();
      }
    },
    [selectedBrand, clearMessages]
  );

  // Handle tab change
  const handleTabChange = useCallback(
    (tab: BuilderType) => {
      if (tab !== activeTab) {
        setActiveTab(tab);
        clearMessages();
      }
    },
    [activeTab, clearMessages]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    if (!selectedBrand) return;

    setSaving(true);
    try {
      const endpoint =
        activeTab === 'plan'
          ? `/api/builder/brands/${encodeURIComponent(selectedBrand)}/plan`
          : `/api/builder/brands/${encodeURIComponent(selectedBrand)}/identity`;

      const content = generateDocument(
        brands.find((b) => b.name === selectedBrand)?.displayName || selectedBrand,
        activeTab,
        documentSections
      );

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        throw new Error('Failed to save document');
      }

      // Refresh brands to update status
      await refreshBrands();
      alert('Document saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save document. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedBrand, activeTab, documentSections, brands, refreshBrands]);

  // Handle copy to clipboard
  const handleCopy = useCallback(() => {
    const content = generateDocument(
      brands.find((b) => b.name === selectedBrand)?.displayName || selectedBrand || '',
      activeTab,
      documentSections
    );
    navigator.clipboard.writeText(content);
    alert('Copied to clipboard!');
  }, [selectedBrand, activeTab, documentSections, brands]);

  // Handle jump to section
  const handleJumpToSection = useCallback(
    (sectionId: string) => {
      // Ask the AI to help with that section
      const sectionName = sectionId.replace(/_/g, ' ');
      sendMessage(`Let's work on the ${sectionName} section.`);
    },
    [sendMessage]
  );

  // Get completed sections
  const completedSections = Object.keys(documentSections).filter(
    (key) => documentSections[key]?.trim()
  );

  if (loading) {
    return (
      <div className="builder-page">
        <div className="builder-ambient" />
        <div className="builder-loading">
          <div className="builder-spinner" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="builder-page">
      <div className="builder-ambient" />

      {/* Header */}
      <header className="builder-header">
        <div className="builder-header-content">
          <Link href="/" className="builder-logo">
            <div className="builder-logo-icon">
              <LightningIcon />
            </div>
            <span className="builder-logo-text">Lawless AI</span>
          </Link>

          <div className="builder-header-center">
            <span className="builder-title">Builder</span>
            <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
          </div>

          <div className="builder-user-menu">
            <BrandSelector
              brands={brands}
              selectedBrand={selectedBrand}
              onSelectBrand={handleSelectBrand}
              onCreateBrand={() => setShowNewBrandModal(true)}
              loading={loadingBrands}
            />
            <button className="builder-vault-btn" onClick={() => setShowVault(true)}>
              <FolderIcon />
              <span>All Brands</span>
            </button>
            <Link href="/projects/new" className="builder-vault-btn">
              <LightningIcon />
              <span>Create Project</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="builder-main">
        {selectedBrand ? (
          <>
            <BuilderChat
              messages={messages}
              isLoading={chatLoading}
              builderType={activeTab}
              completedSections={completedSections}
              onSendMessage={sendMessage}
              onJumpToSection={handleJumpToSection}
            />
            <DocumentPreview
              brandName={brands.find((b) => b.name === selectedBrand)?.displayName || selectedBrand}
              builderType={activeTab}
              sections={documentSections}
              onSave={handleSave}
              onCopy={handleCopy}
              saving={saving}
            />
          </>
        ) : (
          <div className="builder-empty-state" style={{ flex: 1 }}>
            <div className="builder-empty-icon">
              <FolderIcon />
            </div>
            <h3 className="builder-empty-title">Select or create a brand</h3>
            <p className="builder-empty-description">
              Choose an existing brand from the dropdown or create a new one to get started.
            </p>
            <button
              className="builder-save-btn"
              style={{ width: 'auto', marginTop: '1rem' }}
              onClick={() => setShowNewBrandModal(true)}
            >
              Create New Brand
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <NewBrandModal
        isOpen={showNewBrandModal}
        onClose={() => setShowNewBrandModal(false)}
        onSubmit={handleCreateBrand}
        creating={creatingBrand}
      />

      <BrandVault
        isOpen={showVault}
        onClose={() => setShowVault(false)}
        brands={brands}
        onSelectBrand={handleSelectBrand}
        onRefresh={refreshBrands}
        loading={loadingBrands}
      />
    </div>
  );
}

