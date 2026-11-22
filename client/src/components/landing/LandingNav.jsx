import React, { useState } from 'react';
import { Sparkles, Sun, Moon, ArrowRight, Menu, X, ShieldCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function LandingNav({ onConnect, isConnecting }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { label: '01 Arrive', href: '#arrive' },
    { label: '02 Firewall', href: '#scan' },
    { label: '03 Features', href: '#how-it-works' },
    { label: '04 Verdicts', href: '#verdict' },
    { label: '05 Autopilot', href: '#autopilot' },
    { label: '06 Attack Lab', href: '#hack-lab' }
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#080C14]/80 dark:bg-[#080C14]/80 border-b border-white/10 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
        
        {/* Brand identity */}
        <a href="#" className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-xl p-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-slate-950 font-black" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold text-base tracking-tight text-white">
              MailMind <span className="text-amber-400">AI</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-400 font-bold hidden sm:inline-block">
              v2.0
            </span>
          </div>
        </a>

        {/* Desktop Anchor Navigation (>=1024px lg) */}
        <nav className="hidden lg:flex items-center gap-1 font-mono text-xs text-slate-400">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 rounded-lg hover:text-white hover:bg-white/5 transition-all"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Actions: Theme Toggle + Google OAuth CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            aria-label="Toggle visual theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-400" />}
          </button>

          {/* Official Google Sign-In Button (Google Branding Guidelines Compliant) */}
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="group relative inline-flex items-center gap-2.5 px-4 py-2 sm:px-5 sm:py-2.5 min-h-[44px] rounded-xl bg-white text-slate-900 font-bold text-xs sm:text-sm shadow-md shadow-white/5 hover:bg-slate-100 hover:shadow-lg hover:shadow-amber-500/10 active:scale-95 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Connect with Google"
          >
            {/* Official Google "G" SVG */}
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isConnecting ? 'Connecting...' : 'Connect Gmail'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-0.5 transition-transform hidden sm:inline-block" />
          </button>

          {/* Mobile/Tablet menu hamburger toggle (<1024px) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile/Tablet Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden px-6 py-4 bg-[#080C14] border-b border-white/10 space-y-2 animate-fade-in font-mono text-sm">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
