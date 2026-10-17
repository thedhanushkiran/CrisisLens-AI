import React, { useState } from 'react';
import { Incident } from '../types';

interface CrisisMapProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
}

export const CrisisMap: React.FC<CrisisMapProps> = ({ incidents, onSelectIncident }) => {
  const [selectedLayer, setSelectedLayer] = useState<'flood' | 'shelter' | 'radar'>('flood');
  const [activePin, setActivePin] = useState<Incident | null>(incidents[0] || null);
  const [zoomLevel, setZoomLevel] = useState(13);

  const shelters = [
    { id: 's-1', name: 'Velachery Community Hall (Shelter A-14)', capacity: '350/400', status: 'Open', lat: 12.973, lng: 80.218 },
    { id: 's-2', name: 'Pallavaram Higher Sec. School', capacity: '320/500', status: 'Open', lat: 12.967, lng: 80.149 },
    { id: 's-3', name: 'Saidapet Boys High School Camp', capacity: '180/200', status: 'Near Full', lat: 13.018, lng: 80.224 },
  ];

  return (
    <div className="flex flex-col w-full h-[calc(100vh-140px)] relative">
      {/* Map Control Bar */}
      <div className="bg-surface-container-lowest p-3 px-4 rounded-xl shadow-xs border border-surface-container-high mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[24px]">map</span>
          <div>
            <h2 className="text-base font-bold text-on-surface">Tactical Crisis Geospatial Map</h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Sentinel-1 Radar SAR Flood Contours • Chennai Metropolitan Region
            </span>
          </div>
        </div>

        {/* Layer selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-surface-container-low rounded-lg border border-surface-container">
            <button
              onClick={() => setSelectedLayer('flood')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedLayer === 'flood' ? 'bg-primary text-on-primary font-bold shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              🌊 Flood Inundation (+1.3m)
            </button>
            <button
              onClick={() => setSelectedLayer('shelter')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedLayer === 'shelter' ? 'bg-tertiary text-on-tertiary font-bold shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              🏛 Shelters &amp; Camps
            </button>
            <button
              onClick={() => setSelectedLayer('radar')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                selectedLayer === 'radar' ? 'bg-inverse-surface text-inverse-on-surface font-bold shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              🛰 Live Radar Precipitation
            </button>
          </div>

          <div className="flex items-center gap-1 border-l border-surface-container pl-2">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 1, 18))}
              className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
              title="Zoom In"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 1, 10))}
              className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
              title="Zoom Out"
            >
              <span className="material-symbols-outlined text-[18px]">remove</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div 
        className="flex-1 rounded-xl overflow-hidden shadow-inner relative bg-cover bg-center border border-surface-container-high"
        style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAz6bRNyEIXyoDqu-OS6ybK--Z0gm5KtTnkznbuRKbpEVpbMNVMLPauJafram2DMeccdNGKOVkO6JzXPP9OsK13fKOT43LCHiAxmpgdlQr61F50Ggj4UEYX-EuXBCPyOe2e_HZ2em2n8_eW9ilPZokD-W3Ym3FJ42Mqy4M7tOJJdrLNm3SFtbDFoGl8GRb3NMw0wNAYRfztlLk_2Iz8glo8SPhYJLjqmJtP73YSq8byhMve7VOw1H2_')` }}
      >
        {/* Layer simulation overlay */}
        {selectedLayer === 'flood' && (
          <div className="absolute inset-0 bg-blue-600/15 pointer-events-none mix-blend-multiply"></div>
        )}
        {selectedLayer === 'radar' && (
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 via-red-500/10 to-blue-500/20 pointer-events-none"></div>
        )}

        {/* Map Top HUD */}
        <div className="absolute top-4 left-4 bg-inverse-surface/90 text-inverse-on-surface backdrop-blur-xs p-3 rounded-lg shadow-lg max-w-sm border border-white/10 z-10">
          <div className="flex items-center justify-between text-xs font-mono mb-1">
            <span className="text-secondary-fixed-dim font-bold">STATIC DEMO MAP</span>
            <span className="text-tertiary-fixed font-bold">ZOOM {zoomLevel}X</span>
          </div>
          <p className="text-xs text-inverse-on-surface/90 leading-snug">
            {selectedLayer === 'flood'
              ? 'Illustrative flood overlay only. No live hydrology, satellite, or sensor data is connected.'
              : selectedLayer === 'shelter'
              ? 'Illustrative shelter locations only. Current availability and supplies are not verified.'
              : 'Illustrative radar overlay only. No live weather feed is connected.'}
          </p>
        </div>

        {/* Incident Interactive Pins */}
        {incidents.slice(0, 4).map((inc, index) => {
          const positions = [
            { top: '35%', left: '48%' },
            { top: '24%', left: '28%' },
            { top: '65%', left: '22%' },
            { top: '55%', left: '72%' },
          ];
          const pos = positions[index] || { top: '50%', left: '50%' };
          const isSelected = activePin?.id === inc.id;

          return (
            <div
              key={inc.id}
              onClick={() => setActivePin(inc)}
              style={{ top: pos.top, left: pos.left }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
            >
              <div className={`px-2 py-1 rounded text-xs font-mono font-bold shadow-lg flex items-center gap-1 ring-2 ${
                inc.urgency === 'Critical'
                  ? 'bg-error text-on-error ring-white'
                  : 'bg-amber-500 text-white ring-white'
              } ${isSelected ? 'scale-110 ring-4' : 'hover:scale-105'}`}>
                <span className="material-symbols-outlined text-[14px]">crisis_alert</span>
                <span>{inc.id} [{inc.urgency}]</span>
              </div>
              <div className={`w-3 h-3 rotate-45 -mt-1 mx-auto ${
                inc.urgency === 'Critical' ? 'bg-error' : 'bg-amber-500'
              }`}></div>
            </div>
          );
        })}

        {/* Shelter Pins */}
        {selectedLayer === 'shelter' && shelters.map((sh, idx) => {
          const positions = [
            { top: '42%', left: '60%' },
            { top: '70%', left: '40%' },
            { top: '18%', left: '75%' },
          ];
          const pos = positions[idx];
          return (
            <div
              key={sh.id}
              style={{ top: pos.top, left: pos.left }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group"
            >
              <div className="px-2 py-1 rounded bg-tertiary text-on-tertiary text-xs font-mono font-bold shadow-md flex items-center gap-1 ring-2 ring-white">
                <span className="material-symbols-outlined text-[14px]">shield</span>
                <span>{sh.name.split(' ')[0]}</span>
              </div>
              <div className="w-2.5 h-2.5 bg-tertiary rotate-45 -mt-1 mx-auto"></div>
            </div>
          );
        })}

        {/* Selected Incident Drawer on Bottom/Right */}
        {activePin && (
          <div className="absolute bottom-4 right-4 max-w-sm w-full bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-surface-container-high z-30 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-error text-on-error font-mono text-[10px] font-bold">
                  {activePin.urgency.toUpperCase()}
                </span>
                <span className="font-mono text-xs font-bold text-primary">{activePin.id}</span>
              </div>
              <button
                onClick={() => setActivePin(null)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                ✕
              </button>
            </div>
            <h4 className="text-xs font-bold text-on-surface leading-snug mb-1">
              {activePin.title}
            </h4>
            <p className="text-[11px] text-on-surface-variant mb-2 line-clamp-2">
              {activePin.description}
            </p>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-mono text-primary font-bold">
                {activePin.aiScore > 0 ? `Demo score ${activePin.aiScore}/100` : `Priority: ${activePin.urgency}`}
              </span>
              <span className="text-secondary font-mono text-[11px]">{activePin.timeAgo}</span>
            </div>
            <button
              onClick={() => onSelectIncident(activePin.id)}
              className="w-full py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors shadow cursor-pointer"
            >
              Open in Responder Command →
            </button>
          </div>
        )}

        {/* Map Legend */}
        <div className="absolute bottom-4 left-4 bg-surface-container-lowest/90 backdrop-blur-xs p-2.5 px-3 rounded-lg shadow-sm border border-surface-container-high font-mono text-xs flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
            <span>Example high-priority report</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
            <span>Demo marker</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
            <span>Demo marker</span>
          </div>
        </div>
      </div>
    </div>
  );
};
