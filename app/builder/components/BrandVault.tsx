'use client';

import type { Brand } from '@/app/types/builder';

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const FolderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

interface BrandVaultProps {
  isOpen: boolean;
  onClose: () => void;
  brands: Brand[];
  onSelectBrand: (brandName: string) => void;
  loading?: boolean;
}

export function BrandVault({
  isOpen,
  onClose,
  brands,
  onSelectBrand,
  loading,
}: BrandVaultProps) {
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <div
        className={`builder-vault-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />
      <div className={`builder-vault-drawer ${isOpen ? 'open' : ''}`}>
        <div className="builder-vault-header">
          <h2 className="builder-vault-title">All Brands</h2>
          <button className="builder-vault-close" onClick={onClose}>
            <XIcon />
          </button>
        </div>

        <div className="builder-vault-content">
          {loading ? (
            <div className="builder-loading">
              <div className="builder-spinner" />
            </div>
          ) : brands.length === 0 ? (
            <div className="builder-empty-state">
              <div className="builder-empty-icon">
                <FolderIcon />
              </div>
              <h3 className="builder-empty-title">No brands yet</h3>
              <p className="builder-empty-description">
                Create your first brand to get started.
              </p>
            </div>
          ) : (
            <div className="builder-vault-list">
              {brands.map((brand) => (
                <div
                  key={brand.name}
                  className="builder-vault-item"
                  onClick={() => {
                    onSelectBrand(brand.name);
                    onClose();
                  }}
                >
                  <div className="builder-vault-item-name">{brand.displayName}</div>
                  <div className="builder-vault-item-status">
                    <span
                      className={`builder-vault-item-badge ${brand.hasPlan ? 'complete' : 'incomplete'}`}
                    >
                      {brand.hasPlan && <CheckIcon />}
                      Plan
                    </span>
                    <span
                      className={`builder-vault-item-badge ${brand.hasIdentity ? 'complete' : 'incomplete'}`}
                    >
                      {brand.hasIdentity && <CheckIcon />}
                      Identity
                    </span>
                  </div>
                  {brand.updatedAt && (
                    <div className="builder-vault-item-date">
                      Updated {formatDate(brand.updatedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
