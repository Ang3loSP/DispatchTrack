import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Truck } from 'lucide-react';
import L from 'leaflet';
import { cn } from '../../utils/cn';

const pickupIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="10" fill="#059669"/>
      <path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const dropoffIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
      <circle cx="12" cy="12" r="10" fill="#DC2626"/>
      <path d="M12 4v16M4 12h16" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const driverIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <circle cx="12" cy="12" r="12" fill="#FF4D00"/>
      <path d="M12 5v14M5 12h14" stroke="white" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -18],
});

interface JobPoint {
  lat: number;
  lng: number;
  address: string;
  type: 'pickup' | 'dropoff';
  jobId: number;
  status: string;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

interface DriverMapProps {
  jobs: JobPoint[];
  driverLocation?: DriverLocation;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

const FitBounds: React.FC<{ jobs: JobPoint[]; driverLocation?: DriverLocation }> = ({
  jobs,
  driverLocation,
}) => {
  const map = useMap();
  useEffect(() => {
    if (jobs.length === 0 && !driverLocation) return;

    const bounds = L.latLngBounds([]);
    jobs.forEach((job) => {
      bounds.extend([job.lat, job.lng]);
    });
    if (driverLocation) {
      bounds.extend([driverLocation.lat, driverLocation.lng]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    }
  }, [jobs, driverLocation, map]);

  return null;
};

export const DriverMap: React.FC<DriverMapProps> = ({
  jobs,
  driverLocation,
  center = [-26.2041, 28.0473],
  zoom = 12,
  className,
}) => {
  const mapRef = useRef<L.Map | null>(null);

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      zoomControl={true}
      scrollWheelZoom={true}
      className={cn('rounded-lg border border-[var(--border-hairline)]', className)}
      style={{ height: '100%', width: '100%', minHeight: '400px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds jobs={jobs} driverLocation={driverLocation} />

      {jobs.map((job) => (
        <Marker
          key={`${job.jobId}-${job.type}`}
          position={[job.lat, job.lng]}
          icon={job.type === 'pickup' ? pickupIcon : dropoffIcon}
        >
          <Popup>
            <div className="p-1 min-w-[180px]">
              <div className="flex items-center gap-1.5 text-xs font-medium mb-1">
                {job.type === 'pickup' ? (
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <MapPin className="h-3.5 w-3.5 text-rose-600" />
                )}
                <span className="capitalize">{job.type}</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate">{job.address}</p>
              <p className="text-[10px] text-[var(--text-main)] font-mono mt-1">
                Job #{job.jobId} • {job.status}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}

      {driverLocation && (
        <Marker
          position={[driverLocation.lat, driverLocation.lng]}
          icon={driverIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="p-1 min-w-[140px] text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs font-medium mb-1">
                <Truck className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span>Your Location</span>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                {driverLocation.lat.toFixed(5)}, {driverLocation.lng.toFixed(5)}
              </p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
};