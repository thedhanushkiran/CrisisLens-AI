import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Incident, IncidentCategory, UrgencyLevel } from '../types';
import {
  Facility,
  findNearbyFacilities,
  listFacilities,
  calculateRoute,
  geocodeSearch,
  reverseGeocode,
  getIncidentHotspots,
  EvacuationRouteResponse,
  HotspotCluster,
  GeocodeResult,
} from '../services/apiService';

interface CrisisMapProps {
  incidents: Incident[];
  onSelectIncident: (id: string) => void;
  onNavigateToReport?: () => void;
}

function hasMapCoordinates(incident: Incident): boolean {
  const { lat, lng } = incident.location;
  return (incident.isDemo === true || incident.coordinatesConsented === true || incident.location.coordinatesConsented === true)
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && lat >= -90
    && lat <= 90
    && lng >= -180
    && lng <= 180
    && (lat !== 0 || lng !== 0);
}

// Flood inundation polygons for Chennai metropolitan area (Sentinel-1 SAR simulation)
const FLOOD_ZONES = [
  {
    name: 'Adyar River Lowland Corridor',
    depth: '+1.4m',
    color: '#ba1a1a',
    polygon: [
      [13.015, 80.210],
      [13.022, 80.228],
      [13.012, 80.252],
      [13.003, 80.245],
      [13.008, 80.218],
    ] as [number, number][],
  },
  {
    name: 'Velachery-Pallikaranai Catchment Basin',
    depth: '+1.1m',
    color: '#0053db',
    polygon: [
      [12.985, 80.205],
      [12.975, 80.235],
      [12.948, 80.225],
      [12.940, 80.200],
      [12.965, 80.190],
    ] as [number, number][],
  },
  {
    name: 'Madipakkam Lake Overflow Zone',
    depth: '+0.8m',
    color: '#eab308',
    polygon: [
      [12.972, 80.185],
      [12.968, 80.205],
      [12.955, 80.202],
      [12.958, 80.182],
    ] as [number, number][],
  },
];

export const CrisisMap: React.FC<CrisisMapProps> = ({
  incidents,
  onSelectIncident,
  onNavigateToReport,
}) => {
  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer group refs
  const incidentsLayerRef = useRef<L.LayerGroup | null>(null);
  const facilitiesLayerRef = useRef<L.LayerGroup | null>(null);
  const floodLayerRef = useRef<L.LayerGroup | null>(null);
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userLocationLayerRef = useRef<L.LayerGroup | null>(null);
  const manualPinLayerRef = useRef<L.LayerGroup | null>(null);
  const hasAutoFittedReportsRef = useRef(false);

  // Layer toggles
  const [showIncidents, setShowIncidents] = useState(true);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showFloodZones, setShowFloodZones] = useState(false);
  const [showHotspots, setShowHotspots] = useState(false);
  const [facilityFilter, setFacilityFilter] = useState<'All' | 'Hospital' | 'Shelter' | 'SafeZone'>('All');

  // Facilities & Hotspots state
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityLoadError, setFacilityLoadError] = useState<string | null>(null);
  const [hotspots, setHotspots] = useState<HotspotCluster[]>([]);
  const [activePin, setActivePin] = useState<Incident | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);

  // User Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [manualLocation, setManualLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Routing state
  const [routeInfo, setRouteInfo] = useState<EvacuationRouteResponse | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [routeDestination, setRouteDestination] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const geolocatedIncidents = incidents.filter(hasMapCoordinates);
  const routeStart = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng, label: 'Current device location' }
    : manualLocation || routeOrigin;

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Initial load of facilities and hotspots
  useEffect(() => {
    listFacilities()
      .then(data => {
        setFacilities(data);
        setFacilityLoadError(null);
      })
      .catch(() => {
        setFacilities([]);
        setFacilityLoadError('Facility data is unavailable. Reconnect to the CrisisLens API and retry.');
      });

    getIncidentHotspots(2.5, 2)
      .then(res => setHotspots(res.hotspots))
      .catch(() => setHotspots([]));
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return; // already initialized

    const geolocatedReports = incidents.filter(hasMapCoordinates);
    const initialBounds = geolocatedReports.length > 0
      ? L.latLngBounds(geolocatedReports.map(incident => [incident.location.lat, incident.location.lng]))
      : null;
    const map = L.map(mapContainerRef.current, {
      center: initialBounds?.getCenter() ?? [13.0827, 80.2707],
      zoom: initialBounds ? (geolocatedReports.length > 1 ? 11 : 14) : 11,
      zoomControl: false, // custom placed
    });
    if (initialBounds && initialBounds.isValid()) {
      map.fitBounds(initialBounds.pad(0.15), { maxZoom: 14 });
      hasAutoFittedReportsRef.current = true;
    }

    // Attribution-compliant OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Zoom controls at top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create Layer Groups
    const incLayer = L.layerGroup().addTo(map);
    const facLayer = L.layerGroup().addTo(map);
    const fldLayer = L.layerGroup().addTo(map);
    const hotLayer = L.layerGroup().addTo(map);
    const rtLayer = L.layerGroup().addTo(map);
    const usrLayer = L.layerGroup().addTo(map);
    const pinLayer = L.layerGroup().addTo(map);

    incidentsLayerRef.current = incLayer;
    facilitiesLayerRef.current = facLayer;
    floodLayerRef.current = fldLayer;
    hotspotsLayerRef.current = hotLayer;
    routeLayerRef.current = rtLayer;
    userLocationLayerRef.current = usrLayer;
    manualPinLayerRef.current = pinLayer;

    // Handle manual click on map
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const coordinateLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setManualLocation({ lat, lng, label: coordinateLabel });
      setLocationStatus('Manually selected map location. Device GPS has not been used.');
      pinLayer.clearLayers();

      const pinIcon = L.divIcon({
        className: 'custom-map-pin',
        html: `
          <div class="flex flex-col items-center">
            <div class="bg-primary text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-lg ring-2 ring-white">
              Selected Point
            </div>
            <div class="w-3 h-3 bg-primary rotate-45 -mt-1 ring-1 ring-white"></div>
          </div>
        `,
        iconSize: [80, 40],
        iconAnchor: [40, 36],
      });

      const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(pinLayer);
      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 4px; min-width: 220px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px;">
            <strong style="color: #004ac6;">Selected Location</strong>
            <span id="selected-point-provider" style="font-size: 9px; font-family: monospace; background: #e0e7ff; color: #3730a3; padding: 1px 4px; border-radius: 3px;">Resolving...</span>
          </div>
          <div id="selected-point-addr" style="font-size: 11px; color: #1e293b; font-weight: 600; margin-bottom: 3px;">
            Reverse geocoding...
          </div>
          <div style="font-family: monospace; font-size: 10px; color: #64748b; margin-bottom: 8px;">
            ${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E
          </div>
          <div style="display: flex; gap: 4px;">
            <button id="set-route-orig-btn" style="background: #004ac6; color: white; border: none; border-radius: 4px; padding: 5px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">
              Set Origin
            </button>
            <button id="set-route-dest-btn" style="background: #006243; color: white; border: none; border-radius: 4px; padding: 5px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">
              Set Destination
            </button>
          </div>
        </div>
      `).openPopup();

      let resolvedLabel = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      reverseGeocode(lat, lng).then(res => {
        if (res) {
          resolvedLabel = res.name;
          setManualLocation({ lat, lng, label: res.display_name || res.name });
          const addrEl = document.getElementById('selected-point-addr');
          const provEl = document.getElementById('selected-point-provider');
          if (addrEl) addrEl.innerText = res.display_name || res.name;
          if (provEl) provEl.innerText = res.provider || 'reverse';
        }
      }).catch(() => {
        const addrEl = document.getElementById('selected-point-addr');
        if (addrEl) addrEl.innerText = 'Address lookup offline';
      });

      // Hook click events inside popup
      setTimeout(() => {
        const origBtn = document.getElementById('set-route-orig-btn');
        const destBtn = document.getElementById('set-route-dest-btn');
        if (origBtn) {
          origBtn.onclick = () => {
            setRouteOrigin({ lat, lng, label: resolvedLabel });
            showToast(`Set "${resolvedLabel}" as route origin`);
          };
        }
        if (destBtn) {
          destBtn.onclick = () => {
            setRouteDestination({ lat, lng, label: resolvedLabel });
            showToast(`Set "${resolvedLabel}" as route destination`);
          };
        }
      }, 50);
    });

    mapInstanceRef.current = map;

    // Invalidate size after container settles
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [showToast]);

  // Window resize handler to prevent blank map tiles
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render Flood Zones
  useEffect(() => {
    if (!floodLayerRef.current) return;
    floodLayerRef.current.clearLayers();

    if (!showFloodZones) return;

    FLOOD_ZONES.forEach(zone => {
      const polygon = L.polygon(zone.polygon, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.22,
        weight: 2,
        dashArray: '4, 4',
      });

      polygon.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 2px;">
          <strong style="color: ${zone.color};">${zone.name}</strong>
          <div style="margin-top: 4px; font-size: 11px;">
            Estimated Flood Surge: <strong>${zone.depth}</strong>
          </div>
          <div style="font-size: 10px; color: #545d7c; margin-top: 2px;">
            Simulated Sentinel-1 Radar SAR flood boundary
          </div>
        </div>
      `);

      floodLayerRef.current?.addLayer(polygon);
    });
  }, [showFloodZones]);

  // Render Incidents Markers
  useEffect(() => {
    if (!incidentsLayerRef.current) return;
    incidentsLayerRef.current.clearLayers();

    if (!showIncidents) return;

    const geolocatedReports = incidents.filter(hasMapCoordinates);
    geolocatedReports.forEach(inc => {
      const lat = inc.location.lat;
      const lng = inc.location.lng;

      const isCritical = inc.urgency === 'Critical';
      const isUrgent = inc.urgency === 'Urgent';
      const bgColor = isCritical ? '#ba1a1a' : isUrgent ? '#d97706' : '#2563eb';

      const icon = L.divIcon({
        className: 'incident-marker',
        html: `
          <div class="flex flex-col items-center cursor-pointer group">
            <div style="background-color: ${bgColor};" class="text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 ring-2 ring-white hover:scale-110 transition-transform">
              <span class="w-1.5 h-1.5 rounded-full bg-white ${isCritical ? 'animate-ping' : ''}"></span>
              <span>${inc.isDemo ? 'DEMO · ' : ''}${inc.id} [${inc.urgency.slice(0, 4)}]</span>
            </div>
            <div style="background-color: ${bgColor};" class="w-2.5 h-2.5 rotate-45 -mt-1 ring-1 ring-white"></div>
          </div>
        `,
        iconSize: [90, 36],
        iconAnchor: [45, 34],
      });

      const marker = L.marker([lat, lng], { icon });

      marker.on('click', () => {
        setActivePin(inc);
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; max-width: 240px; padding: 2px;">
        ${inc.isDemo ? '<div style="margin-bottom: 5px; color: #7c2d12; font-size: 10px; font-weight: bold;">ILLUSTRATIVE DEMO REPORT — NOT A LIVE INCIDENT</div>' : ''}
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="background: ${bgColor}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 10px;">
              ${inc.urgency.toUpperCase()}
            </span>
            <span style="font-family: monospace; font-size: 11px; font-weight: bold; color: #004ac6;">
              ${inc.id}
            </span>
          </div>
          <div style="font-weight: bold; margin-bottom: 4px; line-height: 1.3;">
            ${inc.title}
          </div>
          <div style="font-size: 11px; color: #545d7c; margin-bottom: 6px;">
            📍 ${inc.location.street}
          </div>
          <div style="font-size: 11px; margin-bottom: 8px;">
            Water Depth: <strong>${inc.waterDepth || 'Unspecified'}</strong>
          </div>
          <button id="incident-popup-select-${inc.id}" style="width: 100%; background: #004ac6; color: white; border: none; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer;">
            Open in Responder Command →
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`incident-popup-select-${inc.id}`);
        if (btn) {
          btn.onclick = () => onSelectIncident(inc.id);
        }
      });

      incidentsLayerRef.current?.addLayer(marker);
    });
    if (!hasAutoFittedReportsRef.current && geolocatedReports.length > 0 && mapInstanceRef.current) {
      const bounds = L.latLngBounds(geolocatedReports.map(incident => [incident.location.lat, incident.location.lng]));
      if (bounds.isValid()) {
        mapInstanceRef.current.fitBounds(bounds.pad(0.15), { maxZoom: 14 });
        hasAutoFittedReportsRef.current = true;
      }
    }
  }, [incidents, showIncidents, onSelectIncident]);

  // Render Facilities Markers
  useEffect(() => {
    if (!facilitiesLayerRef.current) return;
    facilitiesLayerRef.current.clearLayers();

    if (!showFacilities) return;

    const filtered = facilities.filter(f => {
      if (facilityFilter === 'All') return true;
      return f.category === facilityFilter;
    });

    filtered.forEach(fac => {
      let iconColor = '#006243'; // Shelter green
      let iconSymbol = '🏛';
      if (fac.category === 'Hospital') {
        iconColor = '#ba1a1a';
        iconSymbol = '🏥';
      } else if (fac.category === 'SafeZone') {
        iconColor = '#0053db';
        iconSymbol = '🛡';
      } else if (fac.category === 'EmergencyService') {
        iconColor = '#545d7c';
        iconSymbol = '🚒';
      }

      const icon = L.divIcon({
        className: 'facility-marker',
        html: `
          <div class="flex flex-col items-center cursor-pointer group">
            <div style="background-color: ${iconColor};" class="text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-md flex items-center gap-1 ring-1 ring-white hover:scale-105 transition-transform">
              <span>${iconSymbol}</span>
              <span class="truncate max-w-[100px]">${fac.name.split(' ')[0]}</span>
            </div>
            <div style="background-color: ${iconColor};" class="w-2 h-2 rotate-45 -mt-0.5"></div>
          </div>
        `,
        iconSize: [110, 32],
        iconAnchor: [55, 30],
      });

      const marker = L.marker([fac.latitude, fac.longitude], { icon });

      marker.on('click', () => {
        setSelectedFacility(fac);
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; max-width: 250px; padding: 2px;">
          <div style="font-weight: bold; color: ${iconColor}; margin-bottom: 2px;">
            ${fac.name}
          </div>
          <div style="font-size: 11px; color: #545d7c; margin-bottom: 4px;">
            ${fac.address}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
            <span>Status: <strong style="color: #006243;">${fac.status}</strong></span>
            <span>${fac.emergency_capacity}</span>
          </div>
          <div style="font-size: 11px; margin-bottom: 6px;">
            Condition: <strong>${fac.flood_status}</strong>
          </div>
          <button id="facility-route-to-${fac.id}" style="width: 100%; background: #006243; color: white; border: none; padding: 5px; border-radius: 6px; font-weight: bold; font-size: 11px; cursor: pointer;">
            Calculate Route to this Facility →
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`facility-route-to-${fac.id}`);
        if (btn) {
          btn.onclick = () => {
            if (!routeStart) {
              showToast('Use Locate Me or select a map point before calculating a route.');
              return;
            }
            handleComputeRoute(routeStart.lat, routeStart.lng, fac.latitude, fac.longitude, fac.name);
          };
        }
      });

      facilitiesLayerRef.current?.addLayer(marker);
    });
  }, [facilities, showFacilities, facilityFilter, routeStart]);

  // Render ML Hotspots Layer
  useEffect(() => {
    if (!hotspotsLayerRef.current) return;
    hotspotsLayerRef.current.clearLayers();

    if (!showHotspots || hotspots.length === 0) return;

    hotspots.forEach(hs => {
      const isHigh = hs.risk_level === 'High';
      const color = isHigh ? '#ba1a1a' : '#d97706';

      const circle = L.circle([hs.centroid.latitude, hs.centroid.longitude], {
        radius: hs.radius_km * 1000,
        color: color,
        fillColor: color,
        fillOpacity: 0.18,
        weight: 2,
      });

      circle.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; padding: 2px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: ${color};">${hs.cluster_id} [${hs.risk_level} Risk]</strong>
            <span style="font-family: monospace; font-size: 10px; background: #e5eeff; padding: 2px 4px; border-radius: 3px;">
              DBSCAN ML
            </span>
          </div>
          <div style="font-size: 11px; margin-bottom: 3px;">
            Density: <strong>${hs.incident_count} reports</strong> (${hs.critical_count} Critical, ${hs.urgent_count} Urgent)
          </div>
          <div style="font-size: 11px; margin-bottom: 3px;">
            Cluster Radius: <strong>${hs.radius_km} km</strong>
          </div>
          <div style="font-size: 10px; color: #545d7c;">
            ${hs.data_coverage}
          </div>
        </div>
      `);

      hotspotsLayerRef.current?.addLayer(circle);
    });
  }, [showHotspots, hotspots]);

  // Render Evacuation Route
  useEffect(() => {
    if (!routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();

    if (!routeInfo || !routeInfo.geometry || routeInfo.geometry.length === 0) return;

    // Draw main route polyline
    const routePoly = L.polyline(routeInfo.geometry, {
      color: '#0053db',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    });

    routeLayerRef.current.addLayer(routePoly);

    // Origin marker
    const origIcon = L.divIcon({
      className: 'route-orig-icon',
      html: '<div style="background: #ba1a1a; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const origMarker = L.marker([routeInfo.origin.latitude, routeInfo.origin.longitude], { icon: origIcon });
    routeLayerRef.current.addLayer(origMarker);

    // Destination marker
    const destIcon = L.divIcon({
      className: 'route-dest-icon',
      html: '<div style="background: #006243; width: 16px; height: 16px; border-radius: 3px; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const destMarker = L.marker([routeInfo.destination.latitude, routeInfo.destination.longitude], { icon: destIcon });
    routeLayerRef.current.addLayer(destMarker);

    // Fit map bounds to route
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(routePoly.getBounds(), { padding: [50, 50] });
    }
  }, [routeInfo]);

  // Working Locate Me implementation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      showToast('Geolocation is not supported by this browser.');
      return;
    }

    setIsLocating(true);
    setLocationStatus('Acquiring high-accuracy device position...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude, accuracy } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude, accuracy });
        setManualLocation(null);
        setLocationStatus(`GPS locked ±${Math.round(accuracy)}m`);
        showToast(`Located position: ${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E (±${Math.round(accuracy)}m)`);

        if (userLocationLayerRef.current && mapInstanceRef.current) {
          userLocationLayerRef.current.clearLayers();

          // Accuracy radius circle
          const accuracyCircle = L.circle([latitude, longitude], {
            radius: accuracy,
            color: '#004ac6',
            fillColor: '#004ac6',
            fillOpacity: 0.12,
            weight: 1,
          });

          // User pin pulse
          const userIcon = L.divIcon({
            className: 'user-gps-pulse',
            html: `
              <div class="relative flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-primary opacity-75"></span>
                <span class="relative inline-flex rounded-full h-4 w-4 bg-primary ring-2 ring-white shadow-lg"></span>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const userMarker = L.marker([latitude, longitude], { icon: userIcon });
          userMarker.bindPopup(`
            <div style="font-family: inherit; font-size: 12px; padding: 2px;">
              <strong style="color: #004ac6;">Your Current Device Location</strong>
              <div style="font-family: monospace; font-size: 11px; margin-top: 2px;">
                ${latitude.toFixed(6)}° N, ${longitude.toFixed(6)}° E
              </div>
              <div style="font-size: 11px; color: #545d7c; margin-top: 2px;">
                GPS Accuracy: ±${Math.round(accuracy)} meters
              </div>
            </div>
          `);

          userLocationLayerRef.current.addLayer(accuracyCircle);
          userLocationLayerRef.current.addLayer(userMarker);

          mapInstanceRef.current.setView([latitude, longitude], 15, { animate: true });
        }
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = 'Unable to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location permission denied by user. Click the map to select your location manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Device GPS position unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out. Please retry.';
        }
        setLocationStatus(errorMsg);
        showToast(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  // Recenter Map
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    if (userLocation) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 14, { animate: true });
      showToast('Recentered to your current device location');
    } else if (manualLocation) {
      mapInstanceRef.current.setView([manualLocation.lat, manualLocation.lng], 14, { animate: true });
      showToast('Recentered to the manually selected location');
    } else if (geolocatedIncidents.length > 0) {
      fitIncidentLocations();
    } else {
      showToast('Locate Me, search for a place, or click the map to choose a location.');
    }
  };

  const fitIncidentLocations = () => {
    const map = mapInstanceRef.current;
    if (!map || geolocatedIncidents.length === 0) return;
    const bounds = L.latLngBounds(geolocatedIncidents.map(incident => [incident.location.lat, incident.location.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.15), { maxZoom: 14, animate: true });
      showToast(`Showing ${geolocatedIncidents.length} report location${geolocatedIncidents.length === 1 ? '' : 's'} with location consent.`);
    }
  };

  // Geocode Search handler
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await geocodeSearch(searchQuery);
      setSearchResults(results);
      if (results.length > 0 && mapInstanceRef.current) {
        const top = results[0];
        setManualLocation({ lat: top.lat, lng: top.lng, label: top.display_name || top.name });
        mapInstanceRef.current.setView([top.lat, top.lng], 14, { animate: true });
        showToast(`Navigated to: ${top.name}`);
      } else {
        showToast('No matching address found.');
      }
    } catch {
      showToast('Address lookup service unavailable.');
    } finally {
      setIsSearching(false);
    }
  };

  // Quick Find Nearby Facilities
  const handleFindNearby = async (category: 'Hospital' | 'Shelter' | 'SafeZone') => {
    if (!routeStart) {
      setLocationStatus('Use Locate Me, search for a place, or click the map before searching nearby.');
      showToast('Choose a current or manual map location before searching nearby.');
      return;
    }
    setFacilityFilter(category);
    setShowFacilities(true);

    try {
      const nearby = await findNearbyFacilities(routeStart.lat, routeStart.lng, 15, category);
      setFacilities(nearby);
      setFacilityLoadError(null);
      if (nearby.length > 0) {
        setSelectedFacility(nearby[0]);
        showToast(`Found ${nearby.length} nearby ${category}s. Nearest: ${nearby[0].name} (${nearby[0].distance_km} km)`);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([nearby[0].latitude, nearby[0].longitude], 14, { animate: true });
        }
      } else {
        setSelectedFacility(null);
        showToast(`No ${category}s located within 15 km.`);
      }
    } catch {
      setFacilityLoadError('Nearby facility search is unavailable. Check the CrisisLens API connection.');
      showToast(`Unable to search nearby ${category}s.`);
    }
  };

  // Compute Evacuation Route
  const handleComputeRoute = async (
    origLat: number,
    origLng: number,
    destLat: number,
    destLng: number,
    destLabel: string
  ) => {
    setIsCalculatingRoute(true);
    try {
      const route = await calculateRoute(origLat, origLng, destLat, destLng, true);
      setRouteInfo(route);
      setRouteDestination({ lat: destLat, lng: destLng, label: destLabel });
      showToast(`Calculated route: ${route.distance_km} km (~${route.duration_minutes} min). Check hazard advisories.`);
    } catch {
      showToast('Routing calculation failed. Check endpoint connectivity.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-130px)] min-h-[430px] lg:min-h-[520px] relative">
      {/* Map Interactive Control Bar */}
      <div className="bg-surface-container-lowest p-3 px-4 rounded-xl shadow-xs border border-surface-container-high mb-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-xs">
            <span className="material-symbols-outlined text-[20px]">map</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-on-surface">Tactical Crisis Geospatial Map</h1>
            <div className="flex items-center gap-2 text-[11px] text-on-surface-variant font-mono">
              <span className={`inline-block w-2 h-2 rounded-full ${facilityLoadError ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span>OpenStreetMap Engine</span>
              <span>•</span>
              <span className="text-primary font-bold">
                {userLocation
                  ? `Device GPS ±${Math.round(userLocation.accuracy)}m`
                  : manualLocation
                    ? `Selected: ${manualLocation.label}`
                    : geolocatedIncidents.length > 0
                      ? geolocatedIncidents.every(incident => incident.isDemo)
                        ? `Illustrative scenario · ${geolocatedIncidents.length} demo reports`
                        : `${geolocatedIncidents.length} mapped report locations`
                      : 'No report coordinates · choose a location'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Facility Search Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={fitIncidentLocations}
            disabled={geolocatedIncidents.length === 0}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary text-on-surface border border-surface-container-high transition-colors flex items-center gap-1 disabled:cursor-not-allowed disabled:opacity-50"
            title="Fit the map to reported locations with consented coordinates"
          >
            <span className="material-symbols-outlined text-[16px]">zoom_out_map</span>
            <span>Fit reports ({geolocatedIncidents.length})</span>
          </button>
          <button
            onClick={() => handleFindNearby('Hospital')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-container hover:bg-red-50 hover:text-red-700 text-on-surface border border-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
            title="Find Nearby Emergency Hospitals"
          >
            <span>🏥</span>
            <span>Hospitals</span>
          </button>
          <button
            onClick={() => handleFindNearby('Shelter')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-container hover:bg-emerald-50 hover:text-emerald-700 text-on-surface border border-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
            title="Find Nearby Evacuation Shelters"
          >
            <span>🏛</span>
            <span>Shelters</span>
          </button>
          <button
            onClick={() => handleFindNearby('SafeZone')}
            className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-surface-container hover:bg-blue-50 hover:text-blue-700 text-on-surface border border-surface-container-high transition-colors flex items-center gap-1 cursor-pointer"
            title="Find Safe High-Ground Zones"
          >
            <span>🛡</span>
            <span>Safe Zones</span>
          </button>

          {/* Locate Me Button */}
          <button
            onClick={handleLocateMe}
            disabled={isLocating}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary hover:bg-primary-container text-on-primary shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer ml-1"
          >
            <span className="material-symbols-outlined text-[16px]">{isLocating ? 'progress_activity' : 'my_location'}</span>
            <span>{isLocating ? 'Locating...' : 'Locate Me'}</span>
          </button>

          {/* Recenter */}
          <button
            onClick={handleRecenter}
            className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
            title="Recenter Map"
          >
            <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className="flex-1 rounded-xl overflow-hidden shadow-inner relative border border-surface-container-high flex">
        {/* Leaflet Map Div */}
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Search Bar (Top Left) */}
        <div className="absolute top-3 left-3 z-10 max-w-sm w-full">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center shadow-lg rounded-xl overflow-hidden">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search address, landmark (e.g., Velachery, Saidapet)..."
              className="w-full h-10 pl-9 pr-16 bg-surface-container-lowest/95 backdrop-blur-md text-on-surface text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary border border-surface-container-high"
            />
            <span className="material-symbols-outlined absolute left-2.5 text-[18px] text-on-surface-variant pointer-events-none">
              search
            </span>
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-1 px-2.5 py-1 rounded-lg bg-primary text-on-primary text-[11px] font-bold cursor-pointer"
            >
              {isSearching ? '...' : 'Search'}
            </button>
          </form>

          {/* Live Geocode Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-1.5 bg-surface-container-lowest/95 backdrop-blur-md rounded-xl shadow-xl border border-surface-container-high overflow-hidden text-xs max-h-56 overflow-y-auto">
              <div className="px-3 py-1.5 bg-surface-container-low text-[10px] font-mono font-bold text-secondary flex items-center justify-between border-b border-surface-container">
                <span>FOUND {searchResults.length} LOCATIONS</span>
                <button
                  type="button"
                  onClick={() => setSearchResults([])}
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.setView([res.lat, res.lng], 15, { animate: true });
                      const prov = res.provider ? ` (${res.provider})` : '';
                      showToast(`Navigated to: ${res.name}${prov}`);
                    }
                    setSearchResults([]);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-surface-container flex items-start justify-between gap-2 border-b border-surface-container/50 last:border-0 cursor-pointer"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-on-surface truncate">{res.name}</span>
                    <span className="text-[10px] text-on-surface-variant truncate">{res.display_name || `${res.lat.toFixed(4)}, ${res.lng.toFixed(4)}`}</span>
                  </div>
                  <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    res.provider === 'mapbox' ? 'bg-purple-100 text-purple-800' :
                    res.provider === 'google' ? 'bg-blue-100 text-blue-800' :
                    res.provider === 'nominatim' ? 'bg-emerald-100 text-emerald-800' :
                    'bg-surface-container text-on-surface-variant'
                  }`}>
                    {res.provider || res.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {selectedFacility && (
            <div className="absolute bottom-28 left-4 z-10 max-w-sm rounded-lg bg-amber-50/95 px-3 py-2 text-[10px] leading-snug text-amber-900 shadow">
              Facility status and capacity are reference data, not live availability. Confirm locally before relying on this information.
            </div>
          )}

          {locationStatus && (
            <div className="mt-1.5 px-2.5 py-1 rounded-md bg-inverse-surface/90 text-inverse-on-surface text-[11px] font-mono flex items-center justify-between backdrop-blur-xs">
              <span className="truncate">{locationStatus}</span>
              <button onClick={() => setLocationStatus(null)} className="text-white/70 hover:text-white ml-2 text-xs">✕</button>
            </div>
          )}
          {facilityLoadError && (
            <div role="alert" className="mt-1.5 rounded-lg border border-amber-300 bg-amber-50/95 px-3 py-2 text-[11px] font-medium text-amber-900 shadow">
              {facilityLoadError}
            </div>
          )}
        </div>

        {/* Floating Layer Controls (Top Right beneath Leaflet zoom) */}
        <div className="absolute top-16 right-3 z-10 bg-surface-container-lowest/95 backdrop-blur-md p-2.5 rounded-xl shadow-lg border border-surface-container-high flex flex-col gap-1.5 text-xs font-semibold text-on-surface">
          <span className="text-[10px] uppercase font-bold text-secondary font-mono tracking-wider border-b border-surface-container pb-1">
            Map Layers
          </span>

          <label className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={e => setShowIncidents(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Mapped reports ({geolocatedIncidents.length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <input
              type="checkbox"
              checked={showFacilities}
              onChange={e => setShowFacilities(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Facility reference data ({facilities.length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <input
              type="checkbox"
              checked={showFloodZones}
              onChange={e => setShowFloodZones(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>Flood scenario (demo)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer hover:text-primary">
            <input
              type="checkbox"
              checked={showHotspots}
              onChange={e => setShowHotspots(e.target.checked)}
              className="rounded accent-primary"
            />
            <span>🔥 ML Hotspots ({hotspots.length})</span>
          </label>
        </div>

        {/* Route Drawer & Navigation Directions (When Route Active) */}
        {routeInfo && (
          <div className="absolute top-3 right-3 sm:right-auto sm:left-3 mt-12 sm:mt-12 max-w-sm w-full bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-xl shadow-2xl border border-surface-container-high z-20 max-h-[75vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span className="font-bold text-xs text-on-surface">Evacuation Route Calculated</span>
              </div>
              <button
                onClick={() => setRouteInfo(null)}
                className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3 bg-surface-container-low p-2 rounded-lg text-center">
              <div>
                <span className="text-[10px] text-secondary uppercase font-bold">Total Distance</span>
                <div className="text-base font-bold font-mono text-primary">{routeInfo.distance_km} km</div>
              </div>
              <div>
                <span className="text-[10px] text-secondary uppercase font-bold">Est. Duration</span>
                <div className="text-base font-bold font-mono text-on-surface">{routeInfo.duration_minutes} min</div>
              </div>
            </div>

            {/* Hazard alerts */}
            {routeInfo.hazard_warnings && routeInfo.hazard_warnings.length > 0 && (
              <div className="p-2 mb-3 rounded-lg bg-error-container text-on-error-container text-xs border border-error/20 flex flex-col gap-1">
                <div className="font-bold flex items-center gap-1 text-error">
                  <span className="material-symbols-outlined text-[16px]">warning</span>
                  <span>Hazard Proximity Warning</span>
                </div>
                {routeInfo.hazard_warnings.map((h, i) => (
                  <p key={i} className="text-[11px] leading-tight">
                    • <strong>{h.hazard_zone}:</strong> {h.caution}
                  </p>
                ))}
              </div>
            )}

            {/* Turn by turn steps fallback */}
            <div className="flex flex-col gap-1 mb-2">
              <span className="text-[10px] uppercase font-bold text-secondary tracking-wider">
                Turn-by-Turn Guidance
              </span>
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                {routeInfo.steps.map(step => (
                  <div key={step.step_number} className="flex items-start gap-2 text-xs p-1.5 rounded bg-surface-container-low border border-surface-container">
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {step.step_number}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-on-surface text-[11px] leading-tight">{step.instruction}</p>
                      <span className="text-[10px] text-secondary">{step.distance_m}m • {step.heading}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-on-surface-variant italic mb-2">
              {routeInfo.disclaimer}
            </p>

            <button
              onClick={() => setRouteInfo(null)}
              className="w-full py-1.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Clear Route
            </button>
          </div>
        )}

        {/* Selected Incident Drawer (Bottom Right) */}
        {activePin && (
          <div className="absolute bottom-4 right-4 max-w-sm w-full bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-surface-container-high z-20 animate-in fade-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-white font-mono text-[10px] font-bold ${
                  activePin.urgency === 'Critical' ? 'bg-error' : activePin.urgency === 'Urgent' ? 'bg-amber-600' : 'bg-blue-600'
                }`}>
                  {activePin.urgency.toUpperCase()}
                </span>
                <span className="font-mono text-xs font-bold text-primary">{activePin.id}</span>
              </div>
              <button
                onClick={() => setActivePin(null)}
                className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
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
            <div className="flex items-center justify-between text-xs mb-3 bg-surface-container-low p-2 rounded-lg">
              <span className="font-mono text-primary font-bold text-[11px]">
                📍 {activePin.location.street}
              </span>
              <span className="text-secondary font-mono text-[11px]">
                {activePin.waterDepth ? `Water: ${activePin.waterDepth}` : activePin.timeAgo}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSelectIncident(activePin.id)}
                className="py-2 rounded-lg bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:bg-primary-container transition-colors shadow-xs cursor-pointer text-center"
              >
                View Command →
              </button>
              <button
                onClick={() => {
                  const dest = facilities.find(f => f.category === 'SafeZone' || f.category === 'Shelter') || facilities[0];
                  if (dest) {
                    handleComputeRoute(activePin.location.lat, activePin.location.lng, dest.latitude, dest.longitude, dest.name);
                  } else {
                    showToast('No safe facility available for evacuation route.');
                  }
                }}
                disabled={isCalculatingRoute}
                className="py-2 rounded-lg bg-tertiary text-on-tertiary text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer text-center"
              >
                {isCalculatingRoute ? 'Routing...' : 'Evac Route →'}
              </button>
            </div>
          </div>
        )}

        {/* Selected Facility Drawer */}
        {selectedFacility && (
          <div className="absolute bottom-4 left-4 max-w-sm w-full bg-surface-container-lowest/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-surface-container-high z-20">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-tertiary text-white font-mono text-[10px] font-bold">
                  {selectedFacility.category.toUpperCase()}
                </span>
                <span className="font-mono text-xs font-bold text-on-surface">{selectedFacility.status}</span>
              </div>
              <button
                onClick={() => setSelectedFacility(null)}
                className="text-on-surface-variant hover:text-on-surface text-xs font-bold"
              >
                ✕
              </button>
            </div>
            <h4 className="text-sm font-bold text-on-surface mb-1">
              {selectedFacility.name}
            </h4>
            <p className="mb-2 rounded-md bg-amber-50 px-2 py-1.5 text-[10px] leading-snug text-amber-900">
              Facility status and capacity are reference data, not live availability. Confirm locally before relying on this information.
            </p>
            <p className="text-xs text-on-surface-variant mb-2">
              📍 {selectedFacility.address}
            </p>
            <div className="flex items-center justify-between text-xs mb-3 bg-surface-container-low p-2 rounded-lg">
              <span className="font-semibold text-tertiary">
                Capacity: {selectedFacility.emergency_capacity}
              </span>
              <span className="font-mono text-primary font-bold">
                {selectedFacility.distance_km ? `${selectedFacility.distance_km} km away` : selectedFacility.flood_status}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!routeStart) {
                    showToast('Use Locate Me, search for a place, or select a map point before routing.');
                    return;
                  }
                  handleComputeRoute(routeStart.lat, routeStart.lng, selectedFacility.latitude, selectedFacility.longitude, selectedFacility.name);
                }}
                disabled={!routeStart || isCalculatingRoute}
                className="flex-1 py-2 rounded-lg bg-tertiary text-on-tertiary text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer text-center"
              >
                {isCalculatingRoute ? 'Routing…' : 'Route to Facility →'}
              </button>
              {selectedFacility.phone && selectedFacility.phone !== 'N/A' && (
                <a
                  href={`tel:${selectedFacility.phone.replace(/[^0-9+]/g, '')}`}
                  className="px-3 py-2 rounded-lg bg-surface-container text-primary font-bold text-xs flex items-center justify-center border border-surface-container-high"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Map Legend (Bottom Left) */}
        <div className="absolute bottom-3 left-3 bg-surface-container-lowest/90 backdrop-blur-xs p-2 px-3 rounded-lg shadow-sm border border-surface-container-high font-mono text-[11px] flex flex-wrap items-center gap-3 z-10 pointer-events-auto">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
            <span>Critical Incident</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>Urgent</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-tertiary"></span>
            <span>Shelter / Facility</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
            <span>GPS Location</span>
          </div>
        </div>

        {/* Toast Feedback */}
        {toastMessage && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-inverse-surface/95 text-inverse-on-surface px-4 py-2 rounded-xl shadow-2xl text-xs font-semibold backdrop-blur-xs flex items-center gap-2 border border-white/10 animate-in fade-in duration-150">
            <span className="material-symbols-outlined text-[18px] text-tertiary-fixed">info</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
