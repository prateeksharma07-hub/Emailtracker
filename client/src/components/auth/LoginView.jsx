import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import LandingNav from '../landing/LandingNav';
import HeroSection from '../landing/HeroSection';
import ArriveChapter from '../landing/ArriveChapter';
import ScanChapter from '../landing/ScanChapter';
import VerdictChapter from '../landing/VerdictChapter';
import AutopilotChapter from '../landing/AutopilotChapter';
import AttackLabChapter from '../landing/AttackLabChapter';
import PhotoBandSection from '../landing/PhotoBandSection';
import DemoVideoSection from '../landing/DemoVideoSection';
import FeaturesAndTrustSection from '../landing/FeaturesAndTrustSection';

/**
 * LoginView — Premium Scrollytelling Landing Page (v2.0)
 * 
 * Replaces simple legacy login screen with a cinematic, narrative journey:
 * 0) Hero with interactive X-Ray Lens cursor revealing hidden adversarial text
 * 1) Chapter "Arrive": Parallax incoming stream of email cards
 * 2) Chapter "Scan": Sticky stage with conveyor belt & oscillating X-ray laser beam
 * 3) Chapter "Verdict": Customs disposition stamps (CLEARED / SUSPICIOUS / DETAINED)
 * 4) Chapter "Autopilot": 3-tone draft generator & voice waveform ("You approve. Always.")
 * 5) Chapter "Try to hack it": Naive AI hijacked vs MailMind AI Shielded static bench
 * 6) Photo Band: 4 duotone ambient metaphors (self-hosted WebP <70KB)
 * 7) Video Section: Conditional looping video (if demo files exist)
 * 8) Trust Architecture: AES-256-GCM, zero-retention, and comprehensive footer
 * 
 * STRICT INVARIANTS:
 * - Existing OAuth logic (connectGmail, redirect, authNotification) 100% preserved.
 * - Google Sign-In button strictly compliant with Google Branding Guidelines.
 * - Zero live user data / zero external API calls on landing.
 * - Best-effort honest wording (zero "100%", zero "guaranteed").
 * - Native OS cursor is NEVER hidden (X-Ray lens is an overlay mask).
 */
export default function LoginView() {
  const { connectGmail, authNotification, clearAuthNotification } = useAuth();
  const { theme } = useTheme();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connectGmail();
    } catch (err) {
      setIsConnecting(false);
    }
  };

  return (
    <div className={`min-h-screen ${
      theme === 'dark' 
        ? 'bg-[#080C14] text-slate-100 selection:bg-amber-500/30 selection:text-amber-200' 
        : 'bg-[#FAF8F5] text-slate-900 selection:bg-amber-500/20 selection:text-amber-900'
    } transition-colors duration-300 font-sans relative overflow-x-hidden`}>
      
      {/* Top Floating Glass Navigation */}
      <LandingNav
        onConnect={handleConnect}
        isConnecting={isConnecting}
      />

      {/* Main Scrollytelling Narrative Flow */}
      <main id="main-content" className="relative z-10">
        
        {/* Section 0: Hero with X-Ray Lens Cursor */}
        <HeroSection
          onConnect={handleConnect}
          isConnecting={isConnecting}
          authNotification={authNotification}
          onClearNotification={clearAuthNotification}
        />

        {/* Section 7: Conditional Video Section (Only if demo video exists) */}
        <DemoVideoSection />

        {/* Section 1: Chapter 01 // ARRIVE */}
        <ArriveChapter />

        {/* Section 2: Chapter 02 // SCAN & CONVEYOR */}
        <ScanChapter />

        {/* Section 3: Chapter 03 // VERDICTS */}
        <VerdictChapter />

        {/* Section 4: Chapter 04 // AUTOPILOT ENGINE */}
        <AutopilotChapter />

        {/* Section 5: Chapter 05 // ATTACK LAB TEST BENCH */}
        <AttackLabChapter
          onConnect={handleConnect}
        />

        {/* Section 6: Photo Band (Duotone Amber Treatment) */}
        <PhotoBandSection />

        {/* Section 8: Feature Pillars, Trust Chips & Footer */}
        <FeaturesAndTrustSection
          onConnect={handleConnect}
          isConnecting={isConnecting}
        />

      </main>

    </div>
  );
}
