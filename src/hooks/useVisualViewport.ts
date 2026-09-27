'use client';

import { useState, useEffect } from 'react';

/**
 * Tracks the height of the visual viewport. 
 * This is crucial for mobile devices where the virtual keyboard 
 * shrinks the visible area but often just scrolls the body up, 
 * causing headers and UI to be pushed out of view.
 */
export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return;

    // Set initial height
    if (window.visualViewport) {
      setViewportHeight(window.visualViewport.height);
    } else {
      setViewportHeight(window.innerHeight);
    }

    const handleResize = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      setViewportHeight(height);
      document.documentElement.style.setProperty('--vv-height', `${height}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // Set initial
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return viewportHeight;
}
