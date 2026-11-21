import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Mic, Sparkles, MessageSquare, Shield, Clock } from 'lucide-react';

export default function AutopilotChapter() {
  const [activeTone, setActiveTone] = useState('professional');
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const drafts = {
    professional: "Dear Dr. Sen,\n\nThank you for sharing the updated course schedule and examination guidelines. I have noted the revised milestone deadline for Friday at 11:59 PM and will ensure our team submits the complete documentation on time.\n\nPlease let me know if any further details are needed.\n\nBest regards,\nAlex Sharma",
    concise: "Hi Dr. Sen,\n\nNoted on the updated Friday 11:59 PM deadline. Our complete project documentation will be submitted on schedule.\n\nThanks,\nAlex",
    detailed: "Dear Dr. Sen,\n\nThank you for the detailed guidelines. To summarize our action plan:\n1. The preliminary benchmark report will be completed by Wednesday.\n2. The final project archive will be uploaded before Friday, 11:59 PM.\n3. We have verified all team submissions meet the formatting standard.\n\nBest regards,\nAlex Sharma"
  };

  useEffect(() => {
    // Typewriter effect simulation when switching tones
    const fullText = drafts[activeTone];
    setIsTyping(true);
    setDisplayText('');
    setIsApproved(false);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < fullText.length) {
        setDisplayText(fullText.slice(0, idx + 4));
        idx += 4;
      } else {
        setDisplayText(fullText);
        setIsTyping(false);
        clearInterval(interval);
      }
    }, 15);

    return () => clearInterval(interval);
  }, [activeTone]);

  return (
    <section
      id="autopilot"
      className="py-28 px-4 sm:px-6 max-w-7xl mx-auto border-t border-white/10"
    >
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-widest mb-3">
          <MessageSquare className="w-4 h-4" />
          <span>Chapter 04 // AUTOPILOT ENGINE</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white">
          You Approve. <span className="text-amber-400">Always.</span>
        </h2>
        <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
          MailMind crafts high-context replies in three distinct tones and extracts deadlines automatically. 
          The AI never clicks send autonomously — every response requires your explicit authorization.
        </p>
      </div>

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Tone Selectors & Voice Waveform */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl space-y-4">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 block">
              Choose Reply Personality:
            </span>

            <div className="space-y-2">
              {[
                { id: 'professional', label: 'Professional Tone', desc: 'Courteous, thorough, structured' },
                { id: 'concise', label: 'Concise Tone', desc: 'Direct, 2 sentences, action-first' },
                { id: 'detailed', label: 'Detailed Tone', desc: 'Numbered steps, schedule milestones' }
              ].map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setActiveTone(tone.id)}
                  className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                    activeTone === tone.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-md'
                      : 'bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm font-sans">{tone.label}</span>
                    {activeTone === tone.id && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{tone.desc}</p>
                </button>
              ))}
            </div>

            {/* Voice Input Waveform Simulation */}
            <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 font-bold text-white">
                  <Mic className="w-4 h-4 text-rose-400" />
                  Voice Tone Matcher
                </span>
                <span className="text-[10px] text-amber-400">Listening active</span>
              </div>

              {/* Pulsing Audio Equalizer Waveform Bars */}
              <div className="flex items-center justify-center gap-1 h-10 px-4 rounded-xl bg-slate-950/80 border border-white/5">
                {[14, 28, 40, 18, 35, 48, 22, 45, 30, 16, 38, 24, 42, 20, 32].map((height, i) => (
                  <span
                    key={i}
                    className="w-1 bg-gradient-to-t from-amber-500 to-orange-400 rounded-full animate-pulse"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${i * 0.08}s`
                    }}
                  />
                ))}
              </div>
              <p className="text-[11px] font-mono text-slate-400 text-center">
                Matches vocabulary and brevity to your natural speech patterns
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Draft Preview & Approval Gate */}
        <div className="lg:col-span-7">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 text-xs font-mono">
              <span className="text-slate-400">Target Draft: Re: IIT Delhi Exam Schedule</span>
              <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800 uppercase">
                {activeTone}
              </span>
            </div>

            {/* Simulated Email Body Container */}
            <div className="min-h-[220px] p-5 rounded-2xl bg-slate-950/90 border border-white/5 text-slate-200 font-sans text-sm leading-relaxed whitespace-pre-wrap select-text">
              {displayText}
              {isTyping && <span className="inline-block w-1.5 h-4 bg-amber-400 ml-1 animate-ping" />}
            </div>

            {/* Approval Action Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Zero Autonomous Sends</span>
              </div>

              <button
                onClick={() => setIsApproved(true)}
                disabled={isApproved}
                className={`px-6 py-3 rounded-xl font-bold text-xs sm:text-sm font-sans flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  isApproved
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : 'bg-white text-slate-900 hover:bg-slate-100 active:scale-95'
                }`}
              >
                {isApproved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-slate-950" />
                    <span>Approved & Pushed to Gmail Drafts</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Approve & Push to Gmail</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
