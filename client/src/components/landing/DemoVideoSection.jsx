import React, { useState, useRef, useEffect } from 'react';

/**
 * DemoVideoSection — Conditionally renders a lightweight looping video demo
 * ONLY if `client/public/landing/demo.webm` or `demo.mp4` exists.
 * Per specification: "Na ho to section render hi na ho. Video generate mat karo."
 */
export default function DemoVideoSection() {
  const [videoAvailable, setVideoAvailable] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    // Probe if video file exists via lightweight HEAD request
    fetch('/landing/demo.webm', { method: 'HEAD' })
      .then((res) => {
        if (res.ok && res.headers.get('content-type')?.includes('video')) {
          setVideoAvailable(true);
        } else {
          // Probe mp4 alternative
          return fetch('/landing/demo.mp4', { method: 'HEAD' });
        }
      })
      .then((res) => {
        if (res && res.ok && res.headers.get('content-type')?.includes('video')) {
          setVideoAvailable(true);
        }
      })
      .catch(() => {
        setVideoAvailable(false);
      });
  }, []);

  if (!videoAvailable) {
    return null;
  }

  return (
    <section className="py-16 px-4 sm:px-6 max-w-5xl mx-auto border-t border-white/10">
      <div className="rounded-3xl overflow-hidden border border-white/15 bg-slate-900 shadow-2xl relative">
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          preload="metadata"
          poster="/landing/scanner-checkpoint.webp"
          className="w-full h-auto object-cover"
        >
          <source src="/landing/demo.webm" type="video/webm" />
          <source src="/landing/demo.mp4" type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
