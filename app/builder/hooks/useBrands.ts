import { useState, useEffect, useCallback } from 'react';
import type { Brand, BrandsListResponse, BrandResponse } from '@/app/types/builder';

interface UseBrandsReturn {
  brands: Brand[];
  loading: boolean;
  error: string | null;
  refreshBrands: () => Promise<void>;
  createBrand: (brandName: string) => Promise<Brand | null>;
  getBrand: (brandName: string) => Promise<BrandResponse | null>;
  deleteBrand: (brandName: string) => Promise<boolean>;
}

export function useBrands(): UseBrandsReturn {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/builder/brands');
      if (!res.ok) {
        throw new Error('Failed to fetch brands');
      }
      const data: BrandsListResponse = await res.json();
      setBrands(data.brands);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brands');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const createBrand = useCallback(async (brandName: string): Promise<Brand | null> => {
    try {
      const res = await fetch('/api/builder/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create brand');
      }

      const data = await res.json();
      setBrands((prev) => [data.brand, ...prev]);
      return data.brand;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create brand');
      return null;
    }
  }, []);

  const getBrand = useCallback(async (brandName: string): Promise<BrandResponse | null> => {
    try {
      const res = await fetch(`/api/builder/brands/${encodeURIComponent(brandName)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch brand');
      }
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch brand');
      return null;
    }
  }, []);

  const deleteBrand = useCallback(async (brandName: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/builder/brands/${encodeURIComponent(brandName)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete brand');
      }

      setBrands((prev) => prev.filter((b) => b.name !== brandName));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete brand');
      return false;
    }
  }, []);

  return {
    brands,
    loading,
    error,
    refreshBrands: fetchBrands,
    createBrand,
    getBrand,
    deleteBrand,
  };
}
