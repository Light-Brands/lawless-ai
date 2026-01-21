'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  maxPull = 120,
  disabled = false,
  className = '',
  onClick,
}: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);

  const touchStartY = useRef(0);
  const touchStartScrollTop = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Only enable pull-to-refresh when scrolled to top
    if (container.scrollTop > 0) return;

    touchStartY.current = e.touches[0].clientY;
    touchStartScrollTop.current = container.scrollTop;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;

    const container = containerRef.current;
    if (!container) return;

    // Check if still at top
    if (container.scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    // Only allow pull down (positive delta)
    if (deltaY > 0) {
      // Apply resistance - pull distance is less than actual finger movement
      const resistance = 0.5;
      const distance = Math.min(deltaY * resistance, maxPull);
      setPullDistance(distance);

      // Prevent default scrolling when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, disabled, isRefreshing, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;

    setIsPulling(false);

    if (pullDistance >= threshold && !isRefreshing) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(threshold); // Keep at threshold during refresh

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(15);
      }

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  }, [isPulling, disabled, pullDistance, threshold, isRefreshing, onRefresh]);

  // Calculate progress (0 to 1)
  const progress = Math.min(pullDistance / threshold, 1);

  // Determine state for styling
  const canRelease = pullDistance >= threshold;

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh-container ${className} ${isPulling ? 'pulling' : ''} ${isRefreshing ? 'refreshing' : ''}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
      style={{
        // Apply transform to content when pulling
        '--pull-distance': `${pullDistance}px`,
        '--pull-progress': progress,
      } as React.CSSProperties}
    >
      {/* Pull indicator */}
      <div
        className={`pull-indicator ${canRelease ? 'can-release' : ''} ${isRefreshing ? 'refreshing' : ''}`}
        style={{
          transform: `translateY(${pullDistance - 60}px)`,
          opacity: progress,
        }}
      >
        <div className="pull-indicator-content">
          {isRefreshing ? (
            <div className="pull-spinner" />
          ) : (
            <>
              <div
                className="pull-arrow"
                style={{
                  transform: `rotate(${canRelease ? 180 : 0}deg)`,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5" />
                  <path d="m5 12 7-7 7 7" />
                </svg>
              </div>
              <span className="pull-text">
                {canRelease ? 'Release to refresh' : 'Pull to refresh'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content with transform */}
      <div
        className="pull-content"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
