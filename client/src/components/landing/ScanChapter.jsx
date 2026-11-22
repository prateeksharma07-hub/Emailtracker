import React from 'react';
import { Binary, ShieldCheck, Cpu, Sparkles } from 'lucide-react';
import AutoScanLoop from './AutoScanLoop';

/**
 * ScanChapter — Real-Time Forensic Scanning Stage (v2.1)
 * 
 * Houses the self-running AutoScanLoop component:
 * - Zero GSAP / zero ScrollTrigger pins / zero intrusive spacers
 * - Pure continuous autonomous video-like inspection cycle
 * - Fully responsive on mobile, tablet & desktop
 */
export default function ScanChapter() {
  return (
    <section
      id="scan"
      className="relative py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/10"
    >
      {/* Chapter Eyebrow & Title */}
      <div className="w-full text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest mb-3">
          <Binary className="w-4 h-4" />
          <span>Chapter 02 // REAL-TIME FIREWALL SCAN</span>
        </div>
        <h2 className="text-section-title font-display font-black tracking-tight text-white">
          The Autonomous Inspection Loop
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base font-body leading-relaxed">
          Before any incoming email reaches language models, MailMind's multi-layer firewall
          inspects human visual layout against raw tokens to intercept steganography and prompt injection payloads.
        </p>
      </div>

      {/* Autonomous Video-like Inspection Stage */}
      <AutoScanLoop />
    </section>
  );
}
