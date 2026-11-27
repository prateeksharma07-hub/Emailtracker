import React, { useState } from 'react';
import { useTheme } from './ThemeProvider';
import Stamp from './primitives/Stamp';
import Postmark from './primitives/Postmark';
import Button from './primitives/Button';
import Panel from './primitives/Panel';
import Kbd from './primitives/Kbd';
import SectionLabel from './primitives/SectionLabel';
import PerforatedDivider from './primitives/PerforatedDivider';
import { 
  Sun, 
  Moon, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  ArrowLeft, 
  Zap, 
  Lock, 
  Clock, 
  Sliders,
  Eye
} from 'lucide-react';

export default function DesignShowcase() {
  const { theme, toggleTheme, reduceMotion, toggleReduceMotion } = useTheme();
  const [stampAngle, setStampAngle] = useState(-4);
  const isNight = theme === 'night' || theme === 'dark';

  return (
    <div 
      className="min-h-screen p-6 sm:p-12 transition-colors duration-200 font-body relative"
      style={{
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--color-ink)'
      }}
    >
      {/* Top Controls Bar */}
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 pb-8 border-b-2 border-dashed border-[var(--color-line-strong)]">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-typewriter text-xl font-bold uppercase tracking-wider" style={{ color: 'var(--color-red)' }}>
              MAILMIND // SORTING ROOM
            </span>
            <span className="font-mono text-xs px-2 py-0.5 border border-current opacity-70">
              SPEC: V1.0.0
            </span>
          </div>
          <p className="text-xs font-mono mt-1 opacity-75" style={{ color: 'var(--color-muted)' }}>
            Design System & Component Catalog (Dev Route)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => window.location.hash = ''}
            icon={ArrowLeft}
          >
            Back to Landing
          </Button>

          <Button 
            variant="secondary" 
            size="sm"
            onClick={toggleTheme}
            icon={isNight ? Sun : Moon}
          >
            {isNight ? 'Switch to Day Post Office' : 'Switch to Night Sorting Room'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={toggleReduceMotion}
            icon={Sliders}
          >
            Motion: {reduceMotion ? 'OFF (Reduced)' : 'ON'}
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 space-y-12">
        {/* Section 1: Typography */}
        <section>
          <SectionLabel number="01" title="TYPOGRAPHY SPECIMEN" />
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-3 mb-6">
            Four Dedicated Typefaces
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Panel ruled>
              <span className="font-mono text-xs opacity-60">FONT 01 • HEADINGS</span>
              <h3 className="text-2xl font-bold font-display mt-1">Bricolage Grotesque</h3>
              <p className="text-sm font-display mt-2 opacity-80">
                Expressive, condensed grotesque for high-impact postal headers.
              </p>
              <div className="mt-4 font-display text-xl font-extrabold">
                The Quick Brown Fox Jumps Over 0123456789
              </div>
            </Panel>

            <Panel ruled>
              <span className="font-mono text-xs opacity-60">FONT 02 • BODY & INTERFACE</span>
              <h3 className="text-2xl font-bold font-body mt-1">Instrument Sans</h3>
              <p className="text-sm font-body mt-2 opacity-80">
                Modern, humanistic geometric sans-serif for comfortable reading and dense email inspection.
              </p>
              <div className="mt-4 font-body text-base">
                Inspect incoming emails before AI inference. Never sends mail on its own.
              </div>
            </Panel>

            <Panel ruled>
              <span className="font-mono text-xs opacity-60">FONT 03 • RUBBER STAMPS & LABELS</span>
              <h3 className="text-2xl font-bold font-typewriter mt-1">Special Elite</h3>
              <p className="text-sm font-body mt-2 opacity-80">
                Grungy vintage mechanical typewriter strictly used on rubber customs stamps and dockets.
              </p>
              <div className="mt-4 font-typewriter text-lg tracking-wider" style={{ color: 'var(--color-red)' }}>
                ★ CUSTOMS QUARANTINE PROTOCOL NO. 409 ★
              </div>
            </Panel>

            <Panel ruled>
              <span className="font-mono text-xs opacity-60">FONT 04 • TECHNICAL DATA & METRICS</span>
              <h3 className="text-2xl font-bold font-mono mt-1">JetBrains Mono</h3>
              <p className="text-sm font-body mt-2 opacity-80">
                Monospaced numerals, cryptographic hashes, and timing benchmarks.
              </p>
              <div className="mt-4 font-mono text-xs opacity-90 p-2 bg-[var(--bg-canvas)] border border-[var(--color-line)]">
                AES-256-GCM • SHA-256: 7f8a3b... • 12.4ms LPU latency
              </div>
            </Panel>
          </div>
        </section>

        <PerforatedDivider />

        {/* Section 2: Stamps & Postmarks */}
        <section>
          <SectionLabel number="02" title="POSTAL STAMPS & CANCELLATION MARKS" />
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-3 mb-6">
            Physical Inspection Imprints
          </h2>

          <div className="flex flex-wrap items-center gap-4 mb-6">
            <span className="text-xs font-mono">Rotation Slider:</span>
            <input 
              type="range" 
              min="-15" 
              max="15" 
              value={stampAngle} 
              onChange={(e) => setStampAngle(Number(e.target.value))}
              className="accent-[var(--color-red)] cursor-pointer"
            />
            <span className="text-xs font-mono font-bold">{stampAngle}°</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Panel className="flex flex-col items-center justify-center py-10 gap-3">
              <Stamp variant="CLEARED" rotate={stampAngle} />
              <span className="text-xs font-mono opacity-60 mt-2">CLEARED (Safe to process)</span>
            </Panel>

            <Panel className="flex flex-col items-center justify-center py-10 gap-3">
              <Stamp variant="SUSPICIOUS" rotate={stampAngle} />
              <span className="text-xs font-mono opacity-60 mt-2">SUSPICIOUS (Flagged for check)</span>
            </Panel>

            <Panel className="flex flex-col items-center justify-center py-10 gap-3">
              <Stamp variant="DETAINED" rotate={stampAngle} />
              <span className="text-xs font-mono opacity-60 mt-2">DETAINED (Quarantined payload)</span>
            </Panel>

            <Panel className="flex flex-col items-center justify-center py-10 gap-3">
              <Stamp variant="APPROVED" rotate={stampAngle} />
              <span className="text-xs font-mono opacity-60 mt-2">APPROVED (User dispatched)</span>
            </Panel>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-around gap-8 p-6 bg-[var(--bg-surface)] border-2 border-[var(--color-line-strong)]">
            <Postmark city="NEW DELHI" code="IN-01" date="27 NOV 2026" rotate={-6} />
            <Postmark city="SORTING ROOM" code="SEC-04" date="CLEARED" rotate={4} />
            <Postmark city="DISPATCH CTR" code="CUSTOMS" date="EXPRESS" rotate={-10} />
          </div>
        </section>

        <PerforatedDivider />

        {/* Section 3: Buttons & Tactile Controls */}
        <section>
          <SectionLabel number="03" title="INTERACTIVE BUTTONS & CONTROLS" />
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-3 mb-6">
            Tactile Mechanical Controls
          </h2>

          <div className="flex flex-wrap items-center gap-4 p-6 bg-[var(--bg-surface)] border-2 border-[var(--color-line-strong)]">
            <Button variant="primary" size="lg">
              Primary Dispatch Button
            </Button>
            <Button variant="secondary" size="lg">
              Secondary Paper Button
            </Button>
            <Button variant="teal" size="lg">
              Teal Airmail Action
            </Button>
            <Button variant="ghost" size="lg">
              Ghost Link Action
            </Button>
            <Button variant="primary" disabled size="lg">
              Disabled Button
            </Button>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <span className="text-xs font-mono">Keyboard Key Primitives:</span>
            <Kbd>Enter</Kbd>
            <Kbd>Space</Kbd>
            <Kbd>P</Kbd>
            <Kbd>Esc</Kbd>
          </div>
        </section>

        <PerforatedDivider />

        {/* Section 4: Color Contrast Audit */}
        <section>
          <SectionLabel number="04" title="WCAG AA CONTRAST AUDIT" />
          <h2 className="text-3xl font-extrabold font-display tracking-tight mt-3 mb-4">
            Audited Contrast Ramps
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-none border border-[var(--color-line-strong)] bg-[var(--bg-canvas)] text-[var(--color-ink)]">
              <span className="font-mono text-xs font-bold">Canvas vs Ink</span>
              <p className="text-xs mt-1 opacity-80">Contrast: &gt; 12.5:1 (AAA)</p>
            </div>

            <div className="p-4 rounded-none border border-[var(--color-line-strong)] bg-[var(--bg-surface)] text-[var(--color-muted)]">
              <span className="font-mono text-xs font-bold">Surface vs Muted</span>
              <p className="text-xs mt-1">Contrast: &gt; 5.2:1 (AA)</p>
            </div>

            <div className="p-4 rounded-none border border-[var(--color-ink)] bg-[var(--color-red)] text-white">
              <span className="font-mono text-xs font-bold">Red vs White</span>
              <p className="text-xs mt-1">Contrast: &gt; 4.8:1 (AA)</p>
            </div>

            <div className="p-4 rounded-none border border-[var(--color-ink)] bg-[var(--color-teal)] text-white">
              <span className="font-mono text-xs font-bold">Teal vs White</span>
              <p className="text-xs mt-1">Contrast: &gt; 4.9:1 (AA)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
