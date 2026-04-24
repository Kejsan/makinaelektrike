import type { AppLocale } from '../utils/localizedRouting';

type ChargingStationsFaqItem = {
  question: string;
  answer: string;
};

type ChargingStationsStep = {
  label: string;
  body: string;
};

export type ChargingStationsPageContent = {
  intlLocale: string;
  breadcrumbLabel: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  locateMe: string;
  autoUpdateTitle: string;
  autoUpdateDescription: string;
  searchArea: string;
  searchAreaHint: string;
  stationInfo: string;
  closeDetails: string;
  customBadge: string;
  stationFallbackTitle: string;
  operatorLabel: string;
  statusLabel: string;
  usageLabel: string;
  costLabel: string;
  notProvided: string;
  connectorsTitle: string;
  unknownLabel: string;
  standardChargingLabel: string;
  chargingSuffix: string;
  availableLabel: string;
  goLabel: string;
  shareLabel: string;
  copyAddressLabel: string;
  dataViaOCMLabel: string;
  dataSourceLabel: string;
  loadingStations: string;
  loadError: string;
  lastUpdatedLabel: string;
  retryLabel: string;
  focusOnMapLabel: string;
  directionsLabel: string;
  addressUnavailable: string;
  connectionDetailsMissing: string;
  noStationsHeading: string;
  noVisibleStations: string;
  paginationPrevious: string;
  paginationNext: string;
  paginationPage: string;
  paginationOf: string;
  connectionHeaders: {
    connection: string;
    level: string;
    power: string;
    quantity: string;
  };
  howToUseTitle: string;
  howToUseSteps: ChargingStationsStep[];
  coverageTitle: string;
  coverageParagraphs: string[];
  faqTitle: string;
  faqItems: ChargingStationsFaqItem[];
  toasts: {
    shareLinkCopied: string;
    shareLinkCopyFailed: string;
    addressCopied: string;
    addressCopyFailed: string;
    geolocationUnsupported: string;
    geolocationDenied: string;
    approximateLocation: string;
    geolocationUnavailable: string;
  };
};

const CONTENT: Record<AppLocale, ChargingStationsPageContent> = {
  sq: {
    intlLocale: 'sq-AL',
    breadcrumbLabel: 'Stacionet e karikimit në Shqipëri',
    seoTitle: 'Stacionet e karikimit në Shqipëri | Harta interaktive EV | Makina Elektrike',
    seoDescription:
      'Gjeni stacionet e karikimit për makina elektrike në Shqipëri. Kërkoni në hartën interaktive, shikoni detajet e stacioneve dhe planifikoni udhëtimet me të dhëna live nga Open Charge Map.',
    seoKeywords: [
      'harta e karikimit Shqipëri',
      'stacione karikimi EV Shqipëri',
      'Open Charge Map Shqipëri',
      'Makina Elektrike karikim',
    ],
    title: 'Stacionet e karikimit në Shqipëri',
    description:
      'Përdorni hartën e karikimit për të kërkuar stacione në Shqipëri, për të shqyrtuar detajet dhe për të planifikuar itinerare me ndalesa publike.',
    searchLabel: 'Kërko',
    searchPlaceholder: 'Kërko sipas emrit, adresës ose operatorit',
    locateMe: 'Gjej vendndodhjen time',
    autoUpdateTitle: 'Përditëso kur lëviz harta',
    autoUpdateDescription: 'Merr automatikisht stacionet sa herë që lëviz ose zmadhon hartën.',
    searchArea: 'Kërko në këtë zonë',
    searchAreaHint: 'U zbulua lëvizje. Shtyp "Kërko në këtë zonë" për të rifreskuar rezultatet këtu.',
    stationInfo: 'Detajet e stacionit',
    closeDetails: 'Mbyll detajet',
    customBadge: 'Manual',
    stationFallbackTitle: 'Stacion karikimi',
    operatorLabel: 'Operatori',
    statusLabel: 'Statusi',
    usageLabel: 'Përdorimi',
    costLabel: 'Kostoja',
    notProvided: 'Nuk është dhënë',
    connectorsTitle: 'Lidhjet',
    unknownLabel: 'E panjohur',
    standardChargingLabel: 'Standard',
    chargingSuffix: 'karikim',
    availableLabel: 'në dispozicion',
    goLabel: 'Nis navigimin',
    shareLabel: 'Ndaj',
    copyAddressLabel: 'Kopjo adresën',
    dataViaOCMLabel: 'Të dhëna nga OCM',
    dataSourceLabel: 'Të dhëna ©',
    loadingStations: 'Po ngarkohen stacionet...',
    loadError: 'Ngarkimi i stacioneve të karikimit dështoi.',
    lastUpdatedLabel: 'Përditësuar për herë të fundit',
    retryLabel: 'Provo sërish',
    focusOnMapLabel: 'Gjeje në hartë',
    directionsLabel: 'Udhëzimet',
    addressUnavailable: 'Adresa nuk është e disponueshme.',
    connectionDetailsMissing: 'Detajet e lidhjeve nuk janë dhënë.',
    noStationsHeading: 'Nuk ka ende stacione për t’u shfaqur.',
    noVisibleStations:
      'Provoni të kërkoni në një zonë tjetër të Shqipërisë ose zvogëloni zmadhimin për të parë më shumë lokacione.',
    paginationPrevious: 'Para',
    paginationNext: 'Tjetra',
    paginationPage: 'Faqja',
    paginationOf: 'nga',
    connectionHeaders: {
      connection: 'Lidhja',
      level: 'Niveli',
      power: 'Fuqia',
      quantity: 'Sasia',
    },
    howToUseTitle: 'Si të përdorni hartën',
    howToUseSteps: [
      {
        label: 'Kërko ose lëviz hartën',
        body: 'Përdorni fushën e kërkimit ose lëvizni hartën drejt qytetit, korridorit ose destinacionit që ju duhet. Rezultatet janë të ndara në faqe për t’u lexuar më lehtë.',
      },
      {
        label: 'Përditëso sipas zonës',
        body: 'Zmadhoni për të parë lagje ose korridore konkrete. Nëse çaktivizoni përditësimin automatik, përdorni "Kërko në këtë zonë" kur të jeni gati.',
      },
      {
        label: 'Hap detajet e stacionit',
        body: 'Prekni një marker ose një kartë rezultati për të parë lidhjet, fuqinë, koston e përdorimit dhe adresën.',
      },
      {
        label: 'Planifiko itinerarin',
        body: 'Përdorni butonat për udhëzime dhe ndarje që të ruani stacionet që ju duhen për udhëtimin.',
      },
    ],
    coverageTitle: 'Ku gjenden karikuesit në Shqipëri',
    coverageParagraphs: [
      'Mbulimi po rritet në Tiranë, Durrës, Shkodër, Korçë dhe në korridoret kryesore drejt bregdetit. Udhëtimet e gjata mbështeten më fort nga karikuesit CCS2 të shpejtë.',
      'Hoteleria, retail-i dhe operatorët privatë po shtojnë pika AC dhe DC, duke e bërë këtë faqe një burim të dobishëm për planifikimin e përdorimit të EV-ve në Shqipëri.',
    ],
    faqTitle: 'Pyetje të shpeshta',
    faqItems: [
      {
        question: 'Sa të sakta janë të dhënat në këtë hartë?',
        answer: 'Lokacionet vijnë nga kontribuesit e Open Charge Map dhe nga stacionet e shtuara manualisht. Kontrolloni datën e përditësimit dhe verifikoni statusin përpara një udhëtimi kritik.',
      },
      {
        question: 'Cilat lidhje janë më të zakonshme në Shqipëri?',
        answer: 'Type 2 për AC dhe CCS2 për karikim të shpejtë DC janë formatet më të përhapura në rrjetin publik shqiptar. CHAdeMO shfaqet më rrallë.',
      },
      {
        question: 'A mund të gjej vetëm stacione të shpejta?',
        answer: 'Po. Kërkoni stacione me fuqi 50 kW ose më shumë dhe me lidhje CCS2 në detaje për të identifikuar pikat DC të shpejta.',
      },
      {
        question: 'Çfarë do të thotë statusi i një stacioni?',
        answer: 'Statusi pasqyron flamurin operacional të raportuar nga Open Charge Map. Stacionet "Operational" zakonisht janë aktive, ndërsa statuset e tjera sinjalizojnë mirëmbajtje ose planifikim.',
      },
      {
        question: 'Si marr udhëzime për një karikues?',
        answer: 'Hapni kartën e stacionit dhe prekni "Udhëzimet". Do të hapet Google Maps me koordinatat e vendosura paraprakisht.',
      },
      {
        question: 'Pse rifreskohet harta kur e lëviz?',
        answer: 'Përditësimi automatik i mban rezultatet të sinkronizuara me zonën që po shihni. Mund ta çaktivizoni dhe të përdorni "Kërko në këtë zonë" vetëm kur të doni.',
      },
      {
        question: 'Si raportoj një problem ose lë një koment?',
        answer: 'Çdo stacion lidhet me burimin e Open Charge Map, ku mund të shtoni përditësime, foto dhe komente për komunitetin e EV-ve.',
      },
      {
        question: 'A funksionon kjo faqe në celular?',
        answer: 'Po. Pamja është përshtatur për ekrane të vogla, mbështet ndërveprimet me prekje dhe ruan kontrolle të qarta gjatë planifikimit në lëvizje.',
      },
      {
        question: 'A më duhet një llogari për ta përdorur hartën?',
        answer: 'Jo. Mund të kërkoni, shihni rezultatet dhe kopjoni lidhje për ndarje pa u identifikuar.',
      },
    ],
    toasts: {
      shareLinkCopied: 'Lidhja për ndarje u kopjua në clipboard.',
      shareLinkCopyFailed: 'Nuk u kopjua dot lidhja.',
      addressCopied: 'Adresa u kopjua në clipboard.',
      addressCopyFailed: 'Nuk u kopjua dot adresa.',
      geolocationUnsupported: 'Gjeolokacioni nuk mbështetet nga shfletuesi juaj.',
      geolocationDenied: 'Leja për vendndodhjen u refuzua. Ju lutem aktivizojeni dhe provoni sërish.',
      approximateLocation: 'Vendndodhja e rrjetit nuk ishte e disponueshme. Po përdorim një afrim sipas IP-së...',
      geolocationUnavailable: 'Nuk mundëm të gjejmë vendndodhjen tuaj.',
    },
  },
  en: {
    intlLocale: 'en-GB',
    breadcrumbLabel: 'Charging Stations in Albania',
    seoTitle: 'Charging Stations in Albania | Interactive EV Map | Makina Elektrike',
    seoDescription:
      'Find EV charging stations across Albania. Search the interactive map, explore station details, and plan your route with live Open Charge Map data.',
    seoKeywords: [
      'Albania EV charging map',
      'EV charging stations Albania',
      'Open Charge Map Albania',
      'Makina Elektrike charging',
    ],
    title: 'Charging Stations in Albania',
    description:
      'Use the EV charging map to search station locations across Albania, review charging details, and plan routes with public charging stops.',
    searchLabel: 'Search',
    searchPlaceholder: 'Search by name, address, or operator',
    locateMe: 'Locate me',
    autoUpdateTitle: 'Auto-update on map move',
    autoUpdateDescription: 'Fetch stations automatically whenever you pan or zoom.',
    searchArea: 'Search this area',
    searchAreaHint: 'Move detected. Press "Search this area" to refresh results here.',
    stationInfo: 'Station info',
    closeDetails: 'Close details',
    customBadge: 'Custom',
    stationFallbackTitle: 'Charging station',
    operatorLabel: 'Operator',
    statusLabel: 'Status',
    usageLabel: 'Usage',
    costLabel: 'Cost',
    notProvided: 'Not provided',
    connectorsTitle: 'Connectors',
    unknownLabel: 'Unknown',
    standardChargingLabel: 'Standard',
    chargingSuffix: 'charging',
    availableLabel: 'available',
    goLabel: 'Go',
    shareLabel: 'Share',
    copyAddressLabel: 'Copy address',
    dataViaOCMLabel: 'Data via OCM',
    dataSourceLabel: 'Data ©',
    loadingStations: 'Loading stations...',
    loadError: 'Failed to load charging locations.',
    lastUpdatedLabel: 'Last updated',
    retryLabel: 'Retry',
    focusOnMapLabel: 'Focus on map',
    directionsLabel: 'Directions',
    addressUnavailable: 'Address unavailable.',
    connectionDetailsMissing: 'Connection details not provided.',
    noStationsHeading: 'No stations to show yet.',
    noVisibleStations: 'Try searching a different area of Albania or zooming out to see more locations.',
    paginationPrevious: 'Previous',
    paginationNext: 'Next',
    paginationPage: 'Page',
    paginationOf: 'of',
    connectionHeaders: {
      connection: 'Connection',
      level: 'Level',
      power: 'Power',
      quantity: 'Quantity',
    },
    howToUseTitle: 'How to Use the Map',
    howToUseSteps: [
      {
        label: 'Search or browse',
        body: 'Use the search bar or pan around the country to reveal charger clusters. Results are paginated to keep the list easier to scan.',
      },
      {
        label: 'Refresh by area',
        body: 'Zoom in to inspect specific neighbourhoods or road corridors. Disable auto-update if you want to explore freely, then press "Search this area" when ready.',
      },
      {
        label: 'Open station details',
        body: 'Tap any marker or list item to review connector types, power levels, usage costs, and the full address.',
      },
      {
        label: 'Plan your trip',
        body: 'Use the directions and share actions to save the stations you want to visit on your journey.',
      },
    ],
    coverageTitle: 'Where Chargers Are Available in Albania',
    coverageParagraphs: [
      'Coverage continues to expand across Tirana, Durres, Shkoder, Korce, and the southern coast. Long-distance corridors are strongest where rapid CCS2 charging is available.',
      'Hotels, retail destinations, and private operators continue to add AC and DC infrastructure, making this page a useful informational landing page for EV planning in Albania.',
    ],
    faqTitle: 'Frequently Asked Questions',
    faqItems: [
      {
        question: 'How accurate is the data on this map?',
        answer: 'Locations come from Open Charge Map contributors and manually added stations. Check the updated timestamp and confirm live status before a critical trip.',
      },
      {
        question: 'Which connector types are common in Albania?',
        answer: 'Type 2 AC connectors and CCS2 DC fast chargers are the most common formats on Albania’s public network. CHAdeMO appears less often.',
      },
      {
        question: 'Can I find fast charging stations only?',
        answer: 'Yes. Look for stations rated at 50 kW or higher and review the CCS2 details to identify higher-power DC chargers.',
      },
      {
        question: 'What does the status mean on each location?',
        answer: 'Status reflects the operational flag reported by Open Charge Map. “Operational” sites are generally active, while other statuses usually indicate maintenance or planned units.',
      },
      {
        question: 'How do I get directions to a charger?',
        answer: 'Open any station card and tap "Directions". Google Maps will open with the charger coordinates already filled in.',
      },
      {
        question: 'Why does the map refresh when I move it?',
        answer: 'Auto-update keeps the results aligned with the area currently visible. You can disable it and use "Search this area" only when you want a manual refresh.',
      },
      {
        question: 'How can I report an issue or leave a comment?',
        answer: 'Each listing points back to the Open Charge Map source where you can submit updates, photos, and comments for the EV community.',
      },
      {
        question: 'Will this work on mobile devices?',
        answer: 'Yes. The layout adapts to smaller screens, supports touch interactions, and keeps controls large enough for route planning on the move.',
      },
      {
        question: 'Do I need an account to use the map?',
        answer: 'No account is required. You can search, review results, and copy share links without signing in.',
      },
    ],
    toasts: {
      shareLinkCopied: 'Shareable link copied to clipboard.',
      shareLinkCopyFailed: 'Unable to copy link.',
      addressCopied: 'Address copied to clipboard.',
      addressCopyFailed: 'Unable to copy address.',
      geolocationUnsupported: 'Geolocation is not supported by your browser.',
      geolocationDenied: 'Location permission denied. Please allow access and try again.',
      approximateLocation: 'Network location was unavailable. Using an approximate IP-based location...',
      geolocationUnavailable: 'Unable to retrieve your location.',
    },
  },
  it: {
    intlLocale: 'it-IT',
    breadcrumbLabel: 'Stazioni di ricarica in Albania',
    seoTitle: 'Stazioni di ricarica in Albania | Mappa EV interattiva | Makina Elektrike',
    seoDescription:
      'Trova le stazioni di ricarica per auto elettriche in Albania. Cerca nella mappa interattiva, controlla i dettagli delle colonnine e pianifica il percorso con dati live da Open Charge Map.',
    seoKeywords: [
      'mappa ricarica EV Albania',
      'stazioni di ricarica Albania',
      'Open Charge Map Albania',
      'Makina Elektrike ricarica',
    ],
    title: 'Stazioni di ricarica in Albania',
    description:
      'Usa la mappa EV per cercare stazioni in Albania, controllare i dettagli di ricarica e pianificare itinerari con soste pubbliche.',
    searchLabel: 'Cerca',
    searchPlaceholder: 'Cerca per nome, indirizzo o operatore',
    locateMe: 'Trova la mia posizione',
    autoUpdateTitle: 'Aggiorna quando la mappa si muove',
    autoUpdateDescription: 'Recupera automaticamente le stazioni ogni volta che sposti o zoomi la mappa.',
    searchArea: 'Cerca in questa zona',
    searchAreaHint: 'Rilevato uno spostamento. Premi "Cerca in questa zona" per aggiornare i risultati qui.',
    stationInfo: 'Dettagli stazione',
    closeDetails: 'Chiudi dettagli',
    customBadge: 'Manuale',
    stationFallbackTitle: 'Stazione di ricarica',
    operatorLabel: 'Operatore',
    statusLabel: 'Stato',
    usageLabel: 'Utilizzo',
    costLabel: 'Costo',
    notProvided: 'Non disponibile',
    connectorsTitle: 'Connettori',
    unknownLabel: 'Sconosciuto',
    standardChargingLabel: 'Standard',
    chargingSuffix: 'ricarica',
    availableLabel: 'disponibili',
    goLabel: 'Vai',
    shareLabel: 'Condividi',
    copyAddressLabel: 'Copia indirizzo',
    dataViaOCMLabel: 'Dati via OCM',
    dataSourceLabel: 'Dati ©',
    loadingStations: 'Caricamento stazioni...',
    loadError: 'Impossibile caricare le stazioni di ricarica.',
    lastUpdatedLabel: 'Ultimo aggiornamento',
    retryLabel: 'Riprova',
    focusOnMapLabel: 'Mostra sulla mappa',
    directionsLabel: 'Indicazioni',
    addressUnavailable: 'Indirizzo non disponibile.',
    connectionDetailsMissing: 'Dettagli dei connettori non disponibili.',
    noStationsHeading: 'Nessuna stazione da mostrare.',
    noVisibleStations: 'Prova a cercare in un’altra zona dell’Albania o ad allargare la mappa per vedere più località.',
    paginationPrevious: 'Precedente',
    paginationNext: 'Successiva',
    paginationPage: 'Pagina',
    paginationOf: 'di',
    connectionHeaders: {
      connection: 'Connessione',
      level: 'Livello',
      power: 'Potenza',
      quantity: 'Quantità',
    },
    howToUseTitle: 'Come usare la mappa',
    howToUseSteps: [
      {
        label: 'Cerca o esplora',
        body: 'Usa la barra di ricerca oppure sposta la mappa verso la città, il corridoio o la destinazione che ti serve. I risultati sono paginati per essere più leggibili.',
      },
      {
        label: 'Aggiorna per area',
        body: 'Ingrandisci per controllare quartieri o tratte specifiche. Se disattivi l’aggiornamento automatico, usa "Cerca in questa zona" quando vuoi aggiornare manualmente.',
      },
      {
        label: 'Apri i dettagli della stazione',
        body: 'Tocca un marker o una scheda risultato per vedere connettori, potenza, costi di utilizzo e indirizzo completo.',
      },
      {
        label: 'Pianifica il viaggio',
        body: 'Usa i pulsanti di indicazioni e condivisione per salvare le colonnine che vuoi usare durante il percorso.',
      },
    ],
    coverageTitle: 'Dove trovare colonnine in Albania',
    coverageParagraphs: [
      'La copertura continua a crescere tra Tirana, Durazzo, Scutari, Coriza e i corridoi verso la costa. I viaggi più lunghi sono supportati soprattutto dove è disponibile la ricarica rapida CCS2.',
      'Hotel, punti retail e operatori privati stanno aggiungendo infrastruttura AC e DC, rendendo questa pagina una risorsa utile per pianificare l’uso di un EV in Albania.',
    ],
    faqTitle: 'Domande frequenti',
    faqItems: [
      {
        question: 'Quanto sono accurati i dati di questa mappa?',
        answer: 'Le località provengono dai contributori di Open Charge Map e dalle stazioni aggiunte manualmente. Controlla la data di aggiornamento e verifica lo stato live prima di un viaggio importante.',
      },
      {
        question: 'Quali connettori sono più comuni in Albania?',
        answer: 'I connettori Type 2 per AC e i caricabatterie rapidi CCS2 per DC sono i formati più diffusi sulla rete pubblica albanese. CHAdeMO compare meno spesso.',
      },
      {
        question: 'Posso trovare solo stazioni di ricarica rapida?',
        answer: 'Sì. Cerca stazioni da 50 kW o più e controlla i dettagli CCS2 per identificare i punti DC ad alta potenza.',
      },
      {
        question: 'Che cosa indica lo stato di una località?',
        answer: 'Lo stato riflette il flag operativo riportato da Open Charge Map. Le località "Operational" sono generalmente attive, mentre gli altri stati indicano manutenzione o pianificazione.',
      },
      {
        question: 'Come ottengo indicazioni per una colonnina?',
        answer: 'Apri una scheda stazione e tocca "Indicazioni". Google Maps si aprirà con le coordinate già compilate.',
      },
      {
        question: 'Perché la mappa si aggiorna quando la sposto?',
        answer: 'L’aggiornamento automatico mantiene i risultati allineati con l’area visibile. Puoi disattivarlo e usare "Cerca in questa zona" solo quando vuoi un refresh manuale.',
      },
      {
        question: 'Come posso segnalare un problema o lasciare un commento?',
        answer: 'Ogni scheda rimanda alla fonte Open Charge Map, dove puoi inviare aggiornamenti, foto e commenti utili alla comunità EV.',
      },
      {
        question: 'Funziona bene anche da mobile?',
        answer: 'Sì. Il layout si adatta agli schermi piccoli, supporta l’interazione touch e mantiene i controlli leggibili durante la pianificazione in movimento.',
      },
      {
        question: 'Serve un account per usare la mappa?',
        answer: 'No. Puoi cercare, consultare i risultati e copiare link di condivisione senza accedere.',
      },
    ],
    toasts: {
      shareLinkCopied: 'Link condivisibile copiato negli appunti.',
      shareLinkCopyFailed: 'Impossibile copiare il link.',
      addressCopied: 'Indirizzo copiato negli appunti.',
      addressCopyFailed: 'Impossibile copiare l’indirizzo.',
      geolocationUnsupported: 'La geolocalizzazione non è supportata dal tuo browser.',
      geolocationDenied: 'Permesso di posizione negato. Consenti l’accesso e riprova.',
      approximateLocation: 'La posizione di rete non era disponibile. Usiamo una posizione approssimativa basata su IP...',
      geolocationUnavailable: 'Impossibile recuperare la tua posizione.',
    },
  },
};

export const getChargingStationsPageContent = (locale: AppLocale): ChargingStationsPageContent =>
  CONTENT[locale];

export const formatChargingStationsListHeading = (
  locale: AppLocale,
  params: { start: number; end: number; count: number; query?: string },
) => {
  const { start, end, count, query } = params;

  if (query) {
    switch (locale) {
      case 'sq':
        return `Po shfaqen ${start}-${end} nga ${count} rezultate për "${query}"`;
      case 'it':
        return `Mostra ${start}-${end} di ${count} risultati per "${query}"`;
      default:
        return `Showing ${start}-${end} of ${count} results for "${query}"`;
    }
  }

  switch (locale) {
    case 'sq':
      return `Po shfaqen ${start}-${end} nga ${count} stacione`;
    case 'it':
      return `Mostra ${start}-${end} di ${count} stazioni`;
    default:
      return `Showing ${start}-${end} of ${count} stations`;
  }
};
