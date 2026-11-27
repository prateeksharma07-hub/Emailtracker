import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
  theme: 'night', // 'night' | 'day' (alias: 'dark' | 'light')
  isNight: true,
  toggleTheme: () => {},
  setTheme: () => {},
  reduceMotion: false,
  toggleReduceMotion: () => {},
  setReduceMotion: () => {}
});

export function ThemeProvider({ children }) {
  // 1. Theme State (Night = dark, Day = light)
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('mailmind-sorting-theme') || localStorage.getItem('mailmind-theme');
      if (saved === 'night' || saved === 'dark') return 'night';
      if (saved === 'day' || saved === 'light') return 'day';
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'day';
      }
      return 'night'; // Default: Night Sorting Room
    } catch {
      return 'night';
    }
  });

  // 2. Reduce Motion State
  const [reduceMotion, setReduceMotionState] = useState(() => {
    try {
      const saved = localStorage.getItem('mailmind-reduce-motion');
      if (saved !== null) return saved === 'true';
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  });

  // Apply theme classes to root
  useEffect(() => {
    try {
      localStorage.setItem('mailmind-sorting-theme', theme);
      localStorage.setItem('mailmind-theme', theme === 'night' ? 'dark' : 'light');
    } catch {}

    const root = document.documentElement;
    if (theme === 'night') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'night');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'day');
    }
  }, [theme]);

  // Apply reduced-motion class to root
  useEffect(() => {
    try {
      localStorage.setItem('mailmind-reduce-motion', reduceMotion.toString());
    } catch {}

    const root = document.documentElement;
    if (reduceMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  }, [reduceMotion]);

  // Listen for system theme changes if not manually set
  useEffect(() => {
    const mqlTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e) => {
      try {
        if (!localStorage.getItem('mailmind-sorting-theme')) {
          setThemeState(e.matches ? 'night' : 'day');
        }
      } catch {}
    };

    const mqlMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e) => {
      try {
        if (localStorage.getItem('mailmind-reduce-motion') === null) {
          setReduceMotionState(e.matches);
        }
      } catch {}
    };

    mqlTheme.addEventListener?.('change', handleThemeChange);
    mqlMotion.addEventListener?.('change', handleMotionChange);

    return () => {
      mqlTheme.removeEventListener?.('change', handleThemeChange);
      mqlMotion.removeEventListener?.('change', handleMotionChange);
    };
  }, []);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'night' || prev === 'dark' ? 'day' : 'night'));
  };

  const setTheme = (val) => {
    if (val === 'dark') val = 'night';
    if (val === 'light') val = 'day';
    setThemeState(val);
  };

  const toggleReduceMotion = () => {
    setReduceMotionState(prev => !prev);
  };

  const setReduceMotion = (val) => {
    setReduceMotionState(Boolean(val));
  };

  const isNight = theme === 'night' || theme === 'dark';

  return (
    <ThemeContext.Provider value={{ 
      theme: isNight ? 'dark' : 'light', 
      sortingTheme: isNight ? 'night' : 'day',
      isNight, 
      toggleTheme, 
      setTheme,
      reduceMotion,
      toggleReduceMotion,
      setReduceMotion
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useSortingRoomTheme() {
  return useContext(ThemeContext);
}
