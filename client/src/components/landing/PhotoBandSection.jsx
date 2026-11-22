import React from 'react';

export default function PhotoBandSection() {
  const photos = [
    {
      src: '/landing/scanner-checkpoint.webp',
      alt: 'Airport terminal scanner and inspection conveyor metaphor',
      title: 'Airport Customs Inspection',
      caption: 'Every inbound payload passes through strict diagnostic gates before reaching intelligence layers.',
      width: 720,
      height: 480
    },
    {
      src: '/landing/student-focused.webp',
      alt: 'Focused university student working on laptop without interruption',
      title: 'Zero-Distraction Flow',
      caption: 'Academic deadlines extracted directly into calendar reminders without prompt hijack risks.',
      width: 720,
      height: 480
    },
    {
      src: '/landing/command-desk.webp',
      alt: 'Clean minimalist developer workspace desk with laptop and coffee',
      title: 'Executive Triage Desk',
      caption: 'Rapid categorization into Urgent, Work, Meeting, and Newsletter priority queues in milliseconds.',
      width: 720,
      height: 480
    },
    {
      src: '/landing/security-vault.webp',
      alt: 'Cryptographic security token and padlock digital privacy vault',
      title: 'Cryptographic Privacy Vault',
      caption: 'AES-256-GCM token storage and local regex shielding for OTPs, Aadhaar, and banking credentials.',
      width: 720,
      height: 480
    }
  ];

  return (
    <section className="py-24 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/10">
      <div className="text-center max-w-3xl mx-auto mb-16">
        <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-widest block mb-2">
          REAL-WORLD ARCHITECTURE METAPHORS
        </span>
        <h2 className="text-section-title font-display font-black tracking-tight text-white">
          Engineered for Extreme Scrutiny
        </h2>
      </div>

      {/* 4 Photo Cards Grid with Duotone Amber Overlay */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {photos.map((p, idx) => (
          <div
            key={idx}
            className="group relative rounded-3xl overflow-hidden border border-white/10 bg-slate-900 shadow-xl transition-all duration-300 hover:border-amber-500/50 hover:-translate-y-1"
          >
            {/* Image Container with Duotone Styling */}
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-950">
              <img
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                loading="lazy"
                className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-700 ease-out"
              />
              {/* Duotone Amber Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-amber-950/30 to-amber-500/10 mix-blend-multiply group-hover:opacity-80 transition-opacity" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080C14] via-[#080C14]/40 to-transparent" />
            </div>

            {/* Caption & Title */}
            <div className="p-5 relative z-10 -mt-8 space-y-1.5 text-left">
              <h3 className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors">
                {p.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {p.caption}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
