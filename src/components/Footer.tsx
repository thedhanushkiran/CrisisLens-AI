import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-inverse-surface text-inverse-on-surface px-4 md:px-margin-desktop py-space-md flex flex-col md:flex-row items-center justify-between gap-space-sm text-xs">
      <div className="flex items-center gap-space-sm">
        <span className="material-symbols-outlined text-[18px] text-error-container shrink-0">warning</span>
        <span className="font-bold tracking-wide uppercase text-error-container shrink-0">NOTICE:</span>
        <span className="leading-snug">
          CrisisLens AI is an experimental AI-assisted decision-support prototype. It does not replace official national emergency response (911/112). For immediate life safety, dial emergency services directly.
        </span>
      </div>
      <div className="font-mono text-[11px] text-secondary-fixed-dim shrink-0">
        © 2025 CrisisLens Disaster Ops Network
      </div>
    </footer>
  );
};
