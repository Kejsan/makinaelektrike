import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png?url';
import markerIcon from 'leaflet/dist/images/marker-icon.png?url';
import markerShadow from 'leaflet/dist/images/marker-shadow.png?url';
import {
  Copy,
  LocateFixed,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Share2,
  X,
} from 'lucide-react';
import SEO from '../components/SEO';
import { BASE_URL, DEFAULT_OG_IMAGE } from '../constants/seo';
import { StationProperties, fetchStations } from '../services/ocm';
import type { StationFeatureCollection } from '../services/ocm';
import { fetchChargingStations, mergeStationsWithOCM } from '../services/chargingStations';
import { useToast } from '../contexts/ToastContext';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIconRetina,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const DEFAULT_CENTER: [number, number] = [41.3275, 19.8187];
const DEFAULT_ZOOM = 8;

type StationFeature = StationFeatureCollection['features'][number];

type BoundsTuple = [topLat: number, leftLng: number, bottomLat: number, rightLng: number];

const formatAddress = (properties: any) => {
  // Handle both PascalCase (OCM GeoJSON default) and camelCase
  const addressInfo = properties.addressInfo || properties.AddressInfo;
  if (!addressInfo) return '';

  const segments = [
    addressInfo.title || addressInfo.Title,
    addressInfo.addressLine1 || addressInfo.AddressLine1,
    addressInfo.town || addressInfo.Town,
    addressInfo.stateOrProvince || addressInfo.StateOrProvince,
    addressInfo.postcode || addressInfo.Postcode,
  ].filter(Boolean);

  // Remove exact duplicates (e.g. if title and addressLine1 are the same)
  const uniqueSegments = [...new Set(segments)];
  return uniqueSegments.join(', ');
};

const formatPowerRange = (properties: any) => {
  const connections = properties.connections || properties.Connections || [];
  const powerValues = (connections as any[])
    .map(connection => connection.powerKW ?? connection.PowerKW ?? null)
    .filter((value): value is number => value !== null && !Number.isNaN(value));

  if (!powerValues.length) {
    return null;
  }

  const min = Math.min(...powerValues);
  const max = Math.max(...powerValues);

  if (min === max) {
    return `${min.toFixed(0)} kW`;
  }

  return `${min.toFixed(0)}–${max.toFixed(0)} kW`;
};

const getBoundingBoxFromBounds = (bounds: L.LatLngBounds) => {
  const northEast = bounds.getNorthEast();
  const southWest = bounds.getSouthWest();
  const topLeftLat = northEast.lat;
  const topLeftLng = southWest.lng;
  const bottomRightLat = southWest.lat;
  const bottomRightLng = northEast.lng;

  return `${topLeftLat},${topLeftLng},${bottomRightLat},${bottomRightLng}`;
};

const boundsFromTuple = (tuple?: BoundsTuple | null) => {
  if (!tuple) {
    return null;
  }
  const [topLat, leftLng, bottomLat, rightLng] = tuple;
  return L.latLngBounds([bottomLat, leftLng], [topLat, rightLng]);
};

const getStationLatLng = (feature: StationFeature) => {
  const { geometry, properties } = feature;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  }
  const addressInfo = properties.addressInfo || (properties as any).AddressInfo;
  return {
    lat: addressInfo?.latitude ?? addressInfo?.Latitude ?? 0,
    lng: addressInfo?.longitude ?? addressInfo?.Longitude ?? 0,
  };
};

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const customStationIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIconRetina,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
  className: 'custom-station-marker',
});

const ChargingStationsAlbaniaPage: React.FC = () => {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const latParam = Number.parseFloat(searchParams.get('lat') ?? '');
  const lngParam = Number.parseFloat(searchParams.get('lng') ?? '');
  const zoomParam = Number.parseInt(searchParams.get('z') ?? '', 10);

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');

  const [autoUpdate, setAutoUpdate] = useState(searchParams.get('auto') !== 'false');
  const [mapState, setMapState] = useState({
    center: [Number.isFinite(latParam) ? latParam : DEFAULT_CENTER[0], Number.isFinite(lngParam) ? lngParam : DEFAULT_CENTER[1]] as [number, number],
    zoom: Number.isFinite(zoomParam) ? zoomParam : DEFAULT_ZOOM,
  });
  const initialMapStateRef = useRef(mapState);
  const [selectedStation, setSelectedStation] = useState<StationFeature | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const [stations, setStations] = useState<StationFeature[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingSearch, setPendingSearch] = useState(false);
  const [hoveredStationId, setHoveredStationId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const fetchControllerRef = useRef<AbortController | null>(null);
  const requestTokenRef = useRef(0);
  const lastNonEmptyStationsRef = useRef<StationFeature[] | null>(null);
  const lastContextRef = useRef<{ mode: 'country' | 'bounds'; bounds: BoundsTuple | null }>({
    mode: 'country',
    bounds: null,
  });
  const pendingBoundsRef = useRef<L.LatLngBounds | null>(null);
  const moveDebounceRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const hasLoadedOnceRef = useRef(false);

  const loadStations = useCallback(
    async (mode: 'country' | 'bounds', options: { bounds?: L.LatLngBounds | null } = {}) => {
      if (fetchControllerRef.current) {
        fetchControllerRef.current.abort();
      }
      const controller = new AbortController();
      fetchControllerRef.current = controller;
      requestTokenRef.current += 1;
      const requestToken = requestTokenRef.current;
      setLoadingStations(true);
      setError(null);

      const sourceBounds = mode === 'bounds'
        ? options.bounds ?? mapRef.current?.getBounds() ?? null
        : null;

      const nextContext: { mode: 'country' | 'bounds'; bounds: BoundsTuple | null } = sourceBounds
        ? {
          mode: 'bounds',
          bounds: (() => {
            const ne = sourceBounds.getNorthEast();
            const sw = sourceBounds.getSouthWest();
            return [
              Number(ne.lat.toFixed(6)),
              Number(sw.lng.toFixed(6)),
              Number(sw.lat.toFixed(6)),
              Number(ne.lng.toFixed(6)),
            ];
          })(),
        }
        : { mode: 'country', bounds: null };

      try {
        // Fetch both OCM and custom stations in parallel
        const [ocmData, customStations] = await Promise.all([
          mode === 'country'
            ? fetchStations({ mode: 'country', signal: controller.signal })
            : fetchStations({
              mode: 'bounds',
              boundingBox: options.bounds ? getBoundingBoxFromBounds(options.bounds) : undefined,
              signal: controller.signal,
            }),
          fetchChargingStations().catch(() => []), // Fallback to empty array on error
        ]);

        if (requestToken !== requestTokenRef.current) {
          return;
        }

        // Merge custom stations with OCM stations
        const ocmFeatures = Array.isArray(ocmData.features) ? ocmData.features : [];
        const mergedData = mergeStationsWithOCM(customStations, ocmFeatures);

        const features = Array.isArray(mergedData) ? mergedData : [];
        const hasFeatures = features.length > 0;

        lastContextRef.current = nextContext;

        if (hasFeatures) {
          setStations(features);
          lastNonEmptyStationsRef.current = features;
        } else if (!hasLoadedOnceRef.current) {
          setStations([]);
          lastNonEmptyStationsRef.current = null;
        } else if (lastNonEmptyStationsRef.current?.length) {
          console.warn('Open Charge Map returned 0 stations for the current bounds; keeping previous markers.');
          setStations(prev => (prev.length ? prev : [...lastNonEmptyStationsRef.current!]));
        } else {
          setStations([]);
        }

        setLastUpdated(new Date());
        hasLoadedOnceRef.current = true;
        if (sourceBounds) {
          pendingBoundsRef.current = sourceBounds;
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load charging locations');
      } finally {
        if (!controller.signal.aborted) {
          setLoadingStations(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadStations('country');
    return () => {
      fetchControllerRef.current?.abort();
    };
  }, [loadStations]);

  useEffect(() => {
    if (autoUpdate) {
      const bounds = mapRef.current?.getBounds();
      if (bounds) {
        setPendingSearch(false);
        loadStations('bounds', { bounds });
      }
    }
  }, [autoUpdate, loadStations]);

  const handleMapMove = useCallback(() => {
    if (!mapRef.current) {
      return;
    }
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    const bounds = mapRef.current.getBounds();

    setMapState({ center: [center.lat, center.lng], zoom });

    if (autoUpdate) {
      setPendingSearch(false);
      pendingBoundsRef.current = bounds;
      if (moveDebounceRef.current) {
        clearTimeout(moveDebounceRef.current);
      }
      moveDebounceRef.current = window.setTimeout(() => {
        loadStations('bounds', { bounds });
      }, 450);
    } else {
      pendingBoundsRef.current = bounds;
      setPendingSearch(true);
    }
  }, [autoUpdate, loadStations]);

  useEffect(() => {
    return () => {
      if (moveDebounceRef.current) {
        clearTimeout(moveDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const { center, zoom } = initialMapStateRef.current;
    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      minZoom: 5,
      maxZoom: 18,
      zoomControl: false,
    });

    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const clusterGroup = L.markerClusterGroup({
      showCoverageOnHover: false,
      chunkedLoading: true,
      maxClusterRadius: 60,
    });

    clusterRef.current = clusterGroup;
    map.addLayer(clusterGroup);

    return () => {
      clusterGroup.clearLayers();
      map.remove();
      clusterRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    map.on('moveend', handleMapMove);
    map.on('zoomend', handleMapMove);

    return () => {
      map.off('moveend', handleMapMove);
      map.off('zoomend', handleMapMove);
    };
  }, [handleMapMove]);

  const visibleStations = useMemo(() => {
    // Sort custom stations to the top
    const sorted = [...stations].sort((a, b) => {
      const aIsCustom = a.properties.isCustomStation ? 1 : 0;
      const bIsCustom = b.properties.isCustomStation ? 1 : 0;
      return bIsCustom - aIsCustom;
    });

    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return sorted;
    }
    return sorted.filter(feature => {
      const { properties } = feature;
      const address = formatAddress(properties).toLowerCase();
      const operator = (properties.operatorInfo?.title || (properties as any).OperatorInfo?.Title || '').toLowerCase();
      const title = (properties.title || (properties as any).Title || '').toLowerCase();
      return (
        title.includes(query) ||
        operator.includes(query) ||
        address.includes(query)
      );
    });
  }, [searchTerm, stations]);

  // Reset to page 1 when search term or stations change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, stations]);

  const totalPages = Math.ceil(visibleStations.length / itemsPerPage);

  const paginatedStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return visibleStations.slice(startIndex, endIndex);
  }, [visibleStations, currentPage, itemsPerPage]);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  const shareStation = useCallback(
    (feature: StationFeature) => {
      const latLng = getStationLatLng(feature);
      const params = new URLSearchParams();
      params.set('lat', latLng.lat.toFixed(5));
      params.set('lng', latLng.lng.toFixed(5));
      params.set('z', '15');
      params.set('poi', String(feature.properties.id));

      if (searchTerm.trim()) params.set('q', searchTerm.trim());
      if (!autoUpdate) params.set('auto', 'false');

      const url = `${window.location.origin}/albania-charging-stations?${params.toString()}`;
      navigator.clipboard
        .writeText(url)
        .then(() => addToast('Shareable link copied to clipboard', 'success'))
        .catch(() => addToast('Unable to copy link', 'error'));
    },
    [addToast, autoUpdate, searchTerm],
  );

  useEffect(() => {
    const clusterGroup = clusterRef.current;
    if (!clusterGroup) {
      return;
    }

    clusterGroup.clearLayers();
    markersRef.current.clear();

    visibleStations.forEach(feature => {
      const latLng = getStationLatLng(feature);
      if (!Number.isFinite(latLng.lat) || !Number.isFinite(latLng.lng)) {
        return;
      }

      const isCustom = feature.properties.isCustomStation === true;

      const markerOptions: L.MarkerOptions = {
        riseOnHover: true,
        title: feature.properties.title ?? 'Charging station',
      };

      if (isCustom) {
        markerOptions.icon = customStationIcon;
      }

      const marker = L.marker([latLng.lat, latLng.lng], markerOptions);

      const handleCopy = () => {
        const address = formatAddress(feature.properties);
        navigator.clipboard
          .writeText(address)
          .then(() => addToast('Address copied to clipboard', 'success'))
          .catch(() => addToast('Unable to copy address', 'error'));
      };

      const handleShare = () => {
        shareStation(feature);
      };

      marker.on('click', () => {
        setSelectedStation(feature);
        setPanelOpen(true);
        setHoveredStationId(feature.properties.id);
      });

      marker.on('mouseover', () => setHoveredStationId(feature.properties.id));
      marker.on('mouseout', () => setHoveredStationId(current => (current === feature.properties.id ? null : current)));

      clusterGroup.addLayer(marker);
      markersRef.current.set(feature.properties.id, marker);
    });
  }, [addToast, shareStation, visibleStations]);

  useEffect(() => {
    if (!selectedStation) {
      return;
    }
    const marker = markersRef.current.get(selectedStation.properties.id);
    if (marker) {
      const latLng = marker.getLatLng();
      const zoom = Math.max(mapRef.current?.getZoom() ?? DEFAULT_ZOOM, 14);

      // Offset the map on desktop to make room for the side panel
      if (window.innerWidth >= 1024) {
        mapRef.current?.flyTo([latLng.lat, latLng.lng - 0.005], zoom, { animate: true });
      } else {
        mapRef.current?.flyTo(latLng, zoom, { animate: true });
      }
    }
  }, [selectedStation]);

  const handleSearchInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleToggleAutoUpdate = () => {
    setAutoUpdate(current => !current);
  };

  const handleSearchArea = () => {
    const bounds = pendingBoundsRef.current ?? mapRef.current?.getBounds();
    if (bounds) {
      setPendingSearch(false);
      loadStations('bounds', { bounds });
    }
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        if (mapRef.current) {
          mapRef.current.flyTo([latitude, longitude], 14, { animate: true });
        }
        setMapState({ center: [latitude, longitude], zoom: 14 });
      },
      () => {
        addToast('Unable to retrieve your location.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleRetry = () => {
    const context = lastContextRef.current;
    if (context.mode === 'bounds') {
      const bounds = boundsFromTuple(context.bounds);
      if (bounds) {
        loadStations('bounds', { bounds });
        return;
      }
    }
    loadStations('country');
  };

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('lat', mapState.center[0].toFixed(5));
    params.set('lng', mapState.center[1].toFixed(5));
    params.set('z', String(mapState.zoom));

    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    if (!autoUpdate) params.set('auto', 'false');
    if (selectedStation) params.set('poi', String(selectedStation.properties.id));

    const next = params.toString();
    if (next !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [autoUpdate, mapState, searchParams, searchTerm, selectedStation, setSearchParams]);

  const faqItems = useMemo(
    () => [
      {
        question: 'How accurate is the data on this map?',
        answer:
          'All charging locations come directly from Open Charge Map contributors. Each listing includes the last verified timestamp so you can gauge freshness.',
      },
      {
        question: 'Which connector types are common in Albania?',
        answer:
          'Type 2 AC connectors and CCS2 DC fast chargers are the most widespread. CHAdeMO appears occasionally, but CCS2 is the go-to option for rapid charging across the country.',
      },
      {
        question: 'Can I find fast charging stations only?',
        answer:
          'Yes. Look for stations whose power rating shows 50 kW or higher and CCS2 connectors in the details — those are the high-power DC chargers ideal for quick top-ups.',
      },
      {
        question: 'What does “status” mean on each location?',
        answer:
          'Status reflects the operational flag reported to Open Charge Map. “Operational” sites are generally active, while other statuses highlight maintenance or planned units.',
      },
      {
        question: 'How do I get directions to a charger?',
        answer:
          'Open any station card or map popup and tap the Directions button. It will launch Google Maps with the coordinates pre-filled for easy navigation.',
      },
      {
        question: 'Why does the map refresh when I move it?',
        answer:
          'Auto-update keeps results aligned with the area currently visible. You can disable it to explore freely and then press “Search this area” when ready.',
      },
      {
        question: 'How can I report an issue or leave a comment?',
        answer:
          'Each listing links back to Open Charge Map where you can submit updates, photos, and comments to help the EV community in Albania.',
      },
      {
        question: 'Will this work on mobile devices?',
        answer:
          'Absolutely. The layout adapts to small screens, supports touch interactions, and keeps controls large enough for on-the-go route planning.',
      },
      {
        question: 'Do I need an account to use the map?',
        answer:
          'No account is required. You can search, navigate through results, and copy share links instantly without signing in.',
      },
    ],
    [],
  );

  const structuredData = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }), [faqItems]);

  const seoTitle = 'Charging Stations in Albania – Interactive EV Map | Makina Elektrike';
  const seoDescription =
    'Find EV charging stations across Albania. Search the interactive map, explore station details, and plan your route with live Open Charge Map data.';

  const breadcrumbItems = [
    { label: t('header.home'), to: '/' },
    { label: 'Charging Stations in Albania', to: '/albania-charging-stations' },
  ];

  const getListHeading = () => {
    if (!visibleStations.length) {
      return 'No stations to show yet';
    }
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, visibleStations.length);
    const searchQuery = searchTerm.trim();

    if (searchQuery) {
      return `Showing ${startIndex}-${endIndex} of ${visibleStations.length} results for "${searchQuery}"`;
    }
    return `Showing ${startIndex}-${endIndex} of ${visibleStations.length} stations`;
  };

  const listHeading = getListHeading();

  return (
    <div className="py-12">
      <SEO
        title={seoTitle}
        description={seoDescription}
        canonical={`${BASE_URL} /albania-charging-stations/`}
        keywords={[
          'Albania EV charging map',
          'Open Charge Map Albania',
          'EV charging stations Tirana',
          'Makina Elektrike charging',
        ]}
        openGraph={{
          title: seoTitle,
          description: seoDescription,
          url: `${BASE_URL} /albania-charging-stations/`,
          type: 'website',
          images: [DEFAULT_OG_IMAGE],
        }}
        twitter={{
          title: seoTitle,
          description: seoDescription,
          image: DEFAULT_OG_IMAGE,
          site: '@makinaelektrike',
        }}
        structuredData={structuredData}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <nav aria-label="Breadcrumb" className="text-sm">
          <ol className="flex flex-wrap items-center gap-2 text-gray-300">
            {breadcrumbItems.map((item, index) => (
              <Fragment key={item.to}>
                {index > 0 && <span className="text-gray-500">/</span>}
                {index === breadcrumbItems.length - 1 ? (
                  <span className="font-semibold text-white">{item.label}</span>
                ) : (
                  <Link to={item.to} className="hover:text-white">
                    {item.label}
                  </Link>
                )}
              </Fragment>
            ))}
          </ol>
        </nav>

        <header className="space-y-4">
          <h1 className="text-4xl font-extrabold text-white">Charging Stations in Albania</h1>
          <p className="text-lg text-gray-300 max-w-3xl">
            Explore every public charging location in Albania with live data from Open Charge Map. Use the interactive map to search, export station details, and plan confident electric journeys.
          </p>
        </header>

        <section className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <label className="flex w-full flex-col gap-2 lg:max-w-md">
                <span className="text-sm font-medium text-gray-300">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={handleSearchInput}
                    placeholder="Search by name, address, or operator"
                    className="w-full rounded-lg border border-white/10 bg-gray-950/70 py-2 pl-10 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-gray-cyan focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                  />
                </div>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleLocate}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/60 bg-gray-cyan/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/30 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                >
                  <LocateFixed className="h-4 w-4" aria-hidden="true" />
                  Locate me
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-gray-950/60 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-white">Auto-update on map move</p>
                  <p className="text-xs text-gray-400">Fetch stations automatically whenever you pan or zoom.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoUpdate}
                  onClick={handleToggleAutoUpdate}
                  className={`relative h - 7 w - 14 rounded - full transition ${autoUpdate ? 'bg-gray-cyan' : 'bg-gray-700'} `}
                >
                  <span
                    className={`absolute top - 1 h - 5 w - 5 rounded - full bg - white transition ${autoUpdate ? 'right-1' : 'left-1'} `}
                  />
                </button>
              </div>

              {!autoUpdate && (
                <button
                  type="button"
                  onClick={handleSearchArea}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-cyan/60 bg-gray-cyan/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-cyan/30 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Search this area
                </button>
              )}

              {pendingSearch && !autoUpdate && (
                <p className="text-xs text-gray-400 sm:text-right">
                  Move detected. Press “Search this area” to refresh results here.
                </p>
              )}
            </div>
          </div>

          <div className="relative h-[400px] rounded-2xl border border-white/10 bg-gray-950/50 shadow-xl sm:h-[460px] lg:h-[510px]">
            <div ref={mapContainerRef} className="h-full w-full rounded-2xl" aria-label="Charging stations map" />

            {/* Map Detail Panel */}
            {selectedStation && (
              <div
                className={`absolute inset-0 z-[1000] overflow-hidden pointer-events-none rounded-2xl`}
              >
                {/* Backdrop for mobile - only shows when panel is open */}
                <div
                  className={`absolute inset-0 bg-black/40 transition-opacity duration-300 lg:hidden pointer-events-auto ${panelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                  onClick={() => setPanelOpen(false)}
                />

                <div
                  className={`absolute right-0 top-0 h-full w-full bg-gray-950/95 shadow-2xl backdrop-blur-md border-l border-white/10 lg:w-96 flex flex-col transform transition-transform duration-300 ease-in-out pointer-events-auto ${panelOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
                >
                  {/* Panel Header */}
                  <div className="flex items-center justify-between border-b border-white/10 p-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-bold text-white leading-tight">Station Info</h2>
                      {selectedStation.properties.isCustomStation && (
                        <span className="rounded-full bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 text-[10px] font-bold text-purple-200 uppercase tracking-wider">
                          Custom
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setPanelOpen(false)}
                      className="rounded-full bg-white/5 p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Close details"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    <div>
                      <h3 className="text-lg font-semibold text-white leading-snug">
                        {selectedStation.properties.title || 'Charging station'}
                      </h3>
                      <p className="mt-1 text-sm text-gray-400">
                        {formatAddress(selectedStation.properties)}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Operator</span>
                        <p className="text-sm text-gray-200 truncate">
                          {selectedStation.properties.operatorInfo?.title || (selectedStation.properties as any).OperatorInfo?.Title || 'Unknown'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Status</span>
                        <p className="text-sm text-gray-200 truncate">
                          {selectedStation.properties.statusType?.title || (selectedStation.properties as any).StatusType?.Title || 'Unknown'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Usage</span>
                        <p className="text-sm text-gray-200 truncate">
                          {selectedStation.properties.usageType?.title || (selectedStation.properties as any).UsageType?.Title || 'Unknown'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Cost</span>
                        <p className="text-sm text-gray-200">
                          {selectedStation.properties.usageCost || 'Not provided'}
                        </p>
                      </div>
                    </div>

                    {/* Connections Section */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-widest opacity-60">Connectors</h4>
                      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                        {(selectedStation.properties.connections || (selectedStation.properties as any).Connections || []).map((conn: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between border-b border-white/10 last:border-0 p-3 bg-gray-900/40">
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-sm font-semibold text-white truncate">
                                {conn.connectionType?.title || conn.ConnectionType?.Title || 'Unknown'}
                              </p>
                              <p className="text-[11px] text-gray-400">
                                {conn.level?.title || conn.Level?.Title || 'Standard'} charging
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-gray-cyan-light">
                                {conn.powerKW || conn.PowerKW ? `${conn.powerKW || conn.PowerKW} kW` : '—'}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {conn.quantity || conn.Quantity || 1} available
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CTA Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${getStationLatLng(selectedStation).lat},${getStationLatLng(selectedStation).lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 rounded-xl bg-gray-cyan px-4 py-3 text-sm font-bold text-black transition hover:bg-gray-cyan-light active:scale-95"
                      >
                        <MapPin className="h-4 w-4" />
                        Go
                      </a>
                      <button
                        onClick={() => shareStation(selectedStation)}
                        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
                      >
                        <Share2 className="h-4 w-4" />
                        Share
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        const address = formatAddress(selectedStation.properties);
                        navigator.clipboard
                          .writeText(address)
                          .then(() => addToast('Address copied', 'success'));
                      }}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 active:scale-95"
                    >
                      <Copy className="h-4 w-4" />
                      Copy Address
                    </button>

                    <p className="text-[10px] text-gray-500 text-center pb-2 opacity-50">
                      ID: {selectedStation.properties.id} • Data via OCM
                    </p>
                  </div>
                </div>
              </div>
            )}
            {loadingStations && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-gray-950/60 backdrop-blur">
                <Loader2 className="h-8 w-8 animate-spin text-gray-cyan" aria-hidden="true" />
                <span className="ml-3 text-sm text-white">Loading stations...</span>
              </div>
            )}
            <div className="absolute bottom-3 right-4 rounded bg-black/70 px-3 py-1 text-xs text-gray-300">
              Data © <a href="https://openchargemap.org" className="underline" target="_blank" rel="noreferrer">Open Charge Map contributors</a>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-white">{listHeading}</h2>
              {lastUpdated && (
                <p className="text-xs text-gray-400">
                  Last updated {formatDateTime(lastUpdated)}
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                <p>{error}</p>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300/60 px-3 py-1 text-xs font-semibold text-red-100 transition hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-300"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            )}

            <div className="space-y-4">
              {paginatedStations.map(station => {
                const latLng = getStationLatLng(station);
                const powerRange = formatPowerRange(station.properties);
                const isHovered = hoveredStationId === station.properties.id;
                const isCustomStation = station.properties.isCustomStation === true;

                return (
                  <article
                    key={station.properties.id}
                    className={`rounded-xl border px-4 py-4 transition ${isHovered ? 'border-gray-cyan bg-gray-950/70 shadow-lg' : 'border-white/10 bg-gray-950/40'
                      }`}
                    onMouseEnter={() => setHoveredStationId(station.properties.id)}
                    onMouseLeave={() => setHoveredStationId(current => (current === station.properties.id ? null : current))}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">{station.properties.title ?? 'Charging station'}</h3>
                          {isCustomStation && (
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-400/30 px-2.5 py-0.5 text-xs font-semibold text-purple-200">
                              Custom
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-300">{formatAddress(station.properties) || 'Address unavailable'}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <p className="text-xs text-gray-400">
                            Operator: <span className="text-gray-200">{station.properties.operatorInfo?.title ?? (station.properties as any).OperatorInfo?.Title ?? 'Unknown'}</span>
                          </p>
                          <p className="text-xs text-gray-400">
                            Status: <span className="text-gray-200">{station.properties.statusType?.title ?? (station.properties as any).StatusType?.Title ?? 'Unknown'}</span>
                          </p>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3">
                          {powerRange && (
                            <div className="flex items-center gap-1.5 rounded-md bg-gray-cyan/10 px-2 py-0.5 text-[11px] font-medium text-gray-cyan-light border border-gray-cyan/20">
                              ⚡ {powerRange}
                            </div>
                          )}
                          {station.properties.usageCost && (
                            <div className="flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium text-gray-300 border border-white/10">
                              💰 {station.properties.usageCost}
                            </div>
                          )}
                          {isCustomStation && (
                            <div className="flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-300 border border-purple-500/20">
                              🔌 {station.properties.connections?.[0]?.connectionType?.title || 'Connectors'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStation(station);
                            setPanelOpen(true);
                            if (mapRef.current) {
                              mapRef.current.flyTo([latLng.lat, latLng.lng], Math.max(mapRef.current.getZoom(), 14), {
                                animate: true,
                              });
                            }
                          }}
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-cyan/60 bg-gray-cyan/20 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-cyan/30 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                        >
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          Focus on map
                        </button>
                        <button
                          type="button"
                          onClick={() => shareStation(station)}
                          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                        >
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                          Share
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${latLng.lat},${latLng.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      >
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        Directions
                      </a >
                      <button
                        type="button"
                        onClick={() => {
                          const address = formatAddress(station.properties);
                          navigator.clipboard
                            .writeText(address)
                            .then(() => addToast('Address copied to clipboard', 'success'))
                            .catch(() => addToast('Unable to copy address', 'error'));
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-cyan"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        Copy address
                      </button>
                    </div >

                    {
                      station.properties.connections?.length ? (
                        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
                          <table className="min-w-full divide-y divide-white/10 text-left text-xs text-gray-200">
                            <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-gray-400">
                              <tr>
                                <th className="px-3 py-2">Connection</th>
                                <th className="px-3 py-2">Level</th>
                                <th className="px-3 py-2">Power</th>
                                <th className="px-3 py-2">Quantity</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {station.properties.connections.map(connection => (
                                <tr key={connection.id ?? `${connection.connectionType?.id}-${connection.level?.id}`}
                                  className="bg-gray-950/60 hover:bg-gray-950/80">
                                  <td className="px-3 py-2">
                                    {connection.connectionType?.title ?? 'Unknown'}
                                  </td>
                                  <td className="px-3 py-2">{connection.level?.title ?? 'Unknown'}</td>
                                  <td className="px-3 py-2">{connection.powerKW ? `${connection.powerKW} kW` : '—'}</td>
                                  <td className="px-3 py-2">{connection.quantity ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="mt-3 text-xs text-gray-400">Connection details not provided.</p>
                      )
                    }

                    {
                      station.properties.generalComments && (
                        <p className="mt-3 text-xs text-gray-400">{station.properties.generalComments}</p>
                      )
                    }
                  </article >
                );
              })}

              {
                !loadingStations && !visibleStations.length && !error && (
                  <div className="rounded-lg border border-white/10 bg-gray-950/60 px-4 py-6 text-center text-sm text-gray-300">
                    Try searching a different area of Albania or zooming out to see more locations.
                  </div>
                )
              }
            </div>

            {visibleStations.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-cyan disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-300">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-gray-cyan disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/10"
                >
                  Next
                </button>
              </div>
            )}
          </div >
        </section >

        <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <h2 className="text-3xl font-bold text-white">How to Use the Map</h2>
          <ol className="space-y-3 text-gray-300">
            <li>
              <strong className="text-white">Search or browse:</strong> Use the search bar or simply pan around the country to reveal clusters of chargers. Results are paginated for easier navigation.
            </li>
            <li>
              <strong className="text-white">Move the map:</strong> Zoom in to inspect specific neighbourhoods. Auto-update keeps results fresh, or switch it off and press “Search this area”.
            </li>
            <li>
              <strong className="text-white">Open station details:</strong> Tap any marker or list item to view connection types, power levels, usage costs, and photos.
            </li>
            <li>
              <strong className="text-white">Plan your trip:</strong> Use the Directions and Share buttons to navigate to and save the stations you want to visit.
            </li>
          </ol>
        </section>

        <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <h2 className="text-3xl font-bold text-white">Where You’ll Find Chargers in Albania</h2>
          <p className="text-gray-300">
            Fast-growing coverage stretches from Tirana and Durrës to key corridors toward Shkodër, Korçë, and the southern coast. Rapid DC hubs support major highways, while AC wallboxes keep city centres and hospitality venues connected. Expect Type 2 plugs for everyday top-ups and CCS2 rapid chargers on long-distance routes.
          </p>
          <p className="text-gray-300">
            New sites appear regularly thanks to private operators, retail destinations, and municipal initiatives. Keep an eye on status indicators in each listing to confirm availability before you depart.
          </p>
        </section>

        <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-8 shadow-xl">
          <h2 className="text-3xl font-bold text-white">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqItems.map(item => (
              <details key={item.question} className="group rounded-xl border border-white/10 bg-gray-950/60 p-4">
                <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold text-white">
                  {item.question}
                  <span className="ml-4 text-gray-400 transition group-open:rotate-45">
                    <X aria-hidden="true" className="h-5 w-5" />
                  </span>
                </summary>
                <p className="mt-3 text-sm text-gray-300">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div >
    </div >
  );
};

export default ChargingStationsAlbaniaPage;
