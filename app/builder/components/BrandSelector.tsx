'use client';

import { useState } from 'react';
import type { Brand } from '@/app/types/builder';

const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface BrandSelectorProps {
  brands: Brand[];
  selectedBrand: string | null;
  onSelectBrand: (brandName: string) => void;
  onCreateBrand: () => void;
  loading?: boolean;
}

export function BrandSelector({
  brands,
  selectedBrand,
  onSelectBrand,
  onCreateBrand,
  loading,
}: BrandSelectorProps) {
  return (
    <div className="builder-brand-selector">
      <select
        className="builder-brand-select"
        value={selectedBrand || ''}
        onChange={(e) => onSelectBrand(e.target.value)}
        disabled={loading}
      >
        <option value="" disabled>
          {loading ? 'Loading...' : 'Select brand...'}
        </option>
        {brands.map((brand) => (
          <option key={brand.name} value={brand.name}>
            {brand.displayName}
            {brand.isComplete ? ' ✓' : ''}
          </option>
        ))}
      </select>

      <button
        className="builder-new-brand-btn"
        onClick={onCreateBrand}
        title="Create new brand"
      >
        <PlusIcon />
        <span>New</span>
      </button>
    </div>
  );
}

interface NewBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (brandName: string) => void;
  creating?: boolean;
}

export function NewBrandModal({ isOpen, onClose, onSubmit, creating }: NewBrandModalProps) {
  const [brandName, setBrandName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (brandName.trim()) {
      onSubmit(brandName.trim());
      setBrandName('');
    }
  };

  return (
    <div className="builder-modal-overlay" onClick={onClose}>
      <div className="builder-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="builder-modal-title">Create New Brand</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="builder-modal-input"
            placeholder="Brand name..."
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            autoFocus
            disabled={creating}
          />
          <div className="builder-modal-actions">
            <button
              type="button"
              className="builder-modal-btn secondary"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="builder-modal-btn primary"
              disabled={!brandName.trim() || creating}
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
