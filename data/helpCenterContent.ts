export type HelpCenterLink = {
  label: string;
  description: string;
  to: string;
};

export type HelpCenterArticle = {
  title: string;
  body: string;
  bullets: string[];
  ctaLabel?: string;
  ctaTo?: string;
};

export type HelpCenterSection = {
  id: string;
  title: string;
  summary: string;
  articles: HelpCenterArticle[];
};

export type HelpCenterContent = {
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  title: string;
  subtitle: string;
  sectionNavLabel: string;
  quickLinksTitle: string;
  quickLinksSubtitle: string;
  quickLinks: HelpCenterLink[];
  sections: HelpCenterSection[];
  supportTitle: string;
  supportBody: string;
  supportPrimaryLabel: string;
  supportPrimaryTo: string;
  supportSecondaryLabel: string;
  supportSecondaryTo: string;
};

const helpCenterContent: Record<"en" | "sq" | "it", HelpCenterContent> = {
  en: {
    metaTitle: "Help Center | Makina Elektrike",
    metaDescription:
      "Practical help for researching EVs, comparing vehicles, contacting dealers, understanding charging, and managing dealer onboarding on Makina Elektrike.",
    metaKeywords: [
      "Makina Elektrike help center",
      "EV help Albania",
      "electric car support Albania",
      "dealer onboarding help",
    ],
    title: "Help Center",
    subtitle:
      "Use this page to understand how Makina Elektrike works, where to find the right EV information, and what to do when you need support as a buyer or dealer.",
    sectionNavLabel: "Help topics",
    quickLinksTitle: "Start with a task",
    quickLinksSubtitle:
      "Jump directly to the part of the platform that matches what you need to do next.",
    quickLinks: [
      {
        label: "Find an EV model",
        description: "Research range, battery, charging, and body style before narrowing down options.",
        to: "/models",
      },
      {
        label: "Browse live listings",
        description: "See vehicles currently offered for sale and review dealer-linked inventory.",
        to: "/listings",
      },
      {
        label: "Explore dealers",
        description: "Review verified dealerships, brands, locations, and contact details.",
        to: "/dealers",
      },
      {
        label: "Check charging stations",
        description: "Open the Albania charging map when route planning or ownership practicality matters.",
        to: "/albania-charging-stations",
      },
      {
        label: "Apply as a dealer",
        description: "Send your dealership details for review and onboarding.",
        to: "/register-dealer",
      },
      {
        label: "Contact support",
        description: "Reach Makina Elektrike for partnerships, corrections, or general platform help.",
        to: "/contact",
      },
    ],
    sections: [
      {
        id: "getting-started",
        title: "Getting started with Makina Elektrike",
        summary:
          "Understand the role of the platform before you rely on it for research or dealer discovery.",
        articles: [
          {
            title: "What the platform is for",
            body:
              "Makina Elektrike is designed as an Albania-focused EV research and marketplace platform. It combines model data, dealer profiles, listings, charging information, and editorial guidance in one place.",
            bullets: [
              "Use model pages when you need specifications and comparison context.",
              "Use listing pages when you want to see vehicles currently offered for sale.",
              "Use dealer pages when you want to verify who sells, supports, or imports a brand locally.",
            ],
          },
          {
            title: "How to use the site efficiently",
            body:
              "Most users move through the site in one of two paths: research first, then contact a seller; or browse dealers first, then inspect available models and stock.",
            bullets: [
              "Start in Models if you are still deciding what type of EV fits your needs.",
              "Start in Listings if you already know you want a vehicle that is currently for sale.",
              "Use the Help Center and blog for practical explanations, not for real-time stock confirmation.",
            ],
            ctaLabel: "Browse models",
            ctaTo: "/models",
          },
        ],
      },
      {
        id: "research-and-compare",
        title: "Researching and comparing electric vehicles",
        summary:
          "The strongest way to use the platform is to combine model research, live listings, and shortlist tools instead of relying on one page alone.",
        articles: [
          {
            title: "Model pages vs listing pages",
            body:
              "Model pages describe the vehicle itself. Listing pages describe a specific vehicle being sold by a specific dealer. Those are not the same thing and should not be read as the same source of truth.",
            bullets: [
              "Use model pages to compare battery size, WLTP range, charging capability, and body type.",
              "Use listing pages to review year, mileage, location, dealer, photos, and listing-specific details.",
              "Where dealer stock changes quickly, trust the listing page and direct dealer contact over older assumptions.",
            ],
            ctaLabel: "Open listings",
            ctaTo: "/listings",
          },
          {
            title: "Using favourites and comparison properly",
            body:
              "Favourites and side-by-side comparison work best as a shortlist workflow. Save the vehicles that survive your first pass, then compare only the few options that matter.",
            bullets: [
              "Shortlist first, compare second.",
              "Compare range, charging speed, size, drivetrain, and intended use rather than chasing a single headline number.",
              "Re-check dealer availability after comparison, because market inventory can change faster than model research pages.",
            ],
            ctaLabel: "Open favourites",
            ctaTo: "/favorites",
          },
        ],
      },
      {
        id: "dealers-and-enquiries",
        title: "Dealers, listings, and enquiries",
        summary:
          "Use dealer profiles to verify who you are contacting and use enquiry flows to create a clean handoff from research to purchase conversation.",
        articles: [
          {
            title: "When to use dealer pages",
            body:
              "Dealer pages are the best place to confirm location, served brands, contact details, and whether a dealership appears active on the platform.",
            bullets: [
              "Check the dealership location and contact details before arranging a visit.",
              "Use the brand information to confirm whether a dealer is relevant to your shortlist.",
              "Read dealer pages alongside listings rather than treating one page as complete on its own.",
            ],
            ctaLabel: "View dealers",
            ctaTo: "/dealers",
          },
          {
            title: "How enquiries should be used",
            body:
              "Enquiries are intended to start a sales conversation about a specific vehicle or dealership. They are not a guarantee of availability or a reservation by themselves.",
            bullets: [
              "Keep the message specific: ask about availability, condition, charging equipment, or next-step documents.",
              "Follow up directly with the dealer when timing matters.",
              "If contact details appear outdated, use the Contact page to report the issue to Makina Elektrike.",
            ],
            ctaLabel: "Contact Makina Elektrike",
            ctaTo: "/contact",
          },
        ],
      },
      {
        id: "charging-and-ownership",
        title: "Charging and EV ownership guidance",
        summary:
          "The charging and editorial surfaces help buyers understand practicality, not just specifications on paper.",
        articles: [
          {
            title: "Using the charging stations page",
            body:
              "The charging map is most useful when you want to understand route coverage, ownership practicality, and where public infrastructure is already viable in Albania.",
            bullets: [
              "Use it to validate whether your home city or regular driving corridor is already practical for public charging.",
              "Use it before buying a vehicle with slower AC charging or limited range.",
              "Treat charging data as operational information that may change over time and should be verified before a critical journey.",
            ],
            ctaLabel: "Open charging stations",
            ctaTo: "/albania-charging-stations",
          },
          {
            title: "Where to look for buyer guidance",
            body:
              "For broader ownership questions such as incentives, charging habits, operating costs, and EV market context, use the blog and Help Center together.",
            bullets: [
              "Use the blog for explainers, market context, and longer-form guidance.",
              "Use the Help Center for task-based answers and product-specific guidance.",
              "For price-sensitive or time-sensitive questions, verify details directly with a dealer or current source.",
            ],
            ctaLabel: "Read the blog",
            ctaTo: "/blog",
          },
        ],
      },
      {
        id: "accounts-and-onboarding",
        title: "Accounts, registration, and dealer onboarding",
        summary:
          "Buyers and dealers have different routes through the platform. This section explains what each registration flow is for.",
        articles: [
          {
            title: "User registration",
            body:
              "User registration is for visitors who want a more persistent research workflow, especially around saved dealers, favourite vehicles, and repeated comparison activity.",
            bullets: [
              "Create a user account if you expect to revisit the same shortlist multiple times.",
              "Use a stable email address so platform communication remains clear.",
              "Account creation does not replace dealer contact for transaction-specific questions.",
            ],
            ctaLabel: "Create an account",
            ctaTo: "/register",
          },
          {
            title: "Dealer registration and approval",
            body:
              "Dealer registration is an onboarding request, not instant activation. Submitted profiles are reviewed before they are treated as active public dealer records.",
            bullets: [
              "Provide accurate company and primary contact details.",
              "Expect a review step before dealership access is activated.",
              "Use the contact page if you need to clarify a submission or report an onboarding issue.",
            ],
            ctaLabel: "Register as a dealer",
            ctaTo: "/register-dealer",
          },
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting and support",
        summary:
          "Use this guidance when something looks outdated, unavailable, or unclear.",
        articles: [
          {
            title: "What to do when information looks wrong",
            body:
              "Some information changes faster than the public site can be updated. Dealer inventory, contact channels, and charging-station availability are the most likely areas to drift over time.",
            bullets: [
              "Check whether the issue is about evergreen information or fast-moving operational status.",
              "Use dealer contact for stock-specific confirmations.",
              "Use the Contact page to flag incorrect public information that should be reviewed centrally.",
            ],
          },
          {
            title: "When to contact support",
            body:
              "Contact Makina Elektrike when you need help with partnerships, dealership onboarding, public information corrections, or platform-level issues.",
            bullets: [
              "Use the Contact page for corrections, support, media, and partnerships.",
              "Be specific about the page or dealer record involved.",
              "Include the relevant URL whenever possible so the issue can be reviewed faster.",
            ],
            ctaLabel: "Open contact page",
            ctaTo: "/contact",
          },
        ],
      },
    ],
    supportTitle: "Still need help?",
    supportBody:
      "Use the contact page for platform questions, partnership requests, correction requests, and dealer onboarding follow-up. If you are a dealership that wants to join the platform, use the dedicated dealer registration flow.",
    supportPrimaryLabel: "Contact support",
    supportPrimaryTo: "/contact",
    supportSecondaryLabel: "Dealer registration",
    supportSecondaryTo: "/register-dealer",
  },
  sq: {
    metaTitle: "Qendra e Ndihmës | Makina Elektrike",
    metaDescription:
      "Ndihmë praktike për kërkimin e EV-ve, krahasimin e automjeteve, kontaktimin e shitësve, kuptimin e karikimit dhe menaxhimin e regjistrimit si shitës në Makina Elektrike.",
    metaKeywords: [
      "qendra e ndihmës Makina Elektrike",
      "ndihmë EV Shqipëri",
      "mbështetje makina elektrike",
      "regjistrim shitësi",
    ],
    title: "Qendra e Ndihmës",
    subtitle:
      "Përdoreni këtë faqe për të kuptuar si funksionon Makina Elektrike, ku gjenden informacionet më të rëndësishme për EV-të dhe çfarë duhet të bëni kur keni nevojë për mbështetje si blerës ose si shitës.",
    sectionNavLabel: "Temat e ndihmës",
    quickLinksTitle: "Niseni nga detyra",
    quickLinksSubtitle:
      "Kaloni direkt te pjesa e platformës që përputhet me atë që duhet të bëni më pas.",
    quickLinks: [
      {
        label: "Gjeni një model EV",
        description: "Kërkoni autonominë, baterinë, karikimin dhe tipin e karrocerisë para se të ngushtoni alternativat.",
        to: "/models",
      },
      {
        label: "Shikoni listimet aktive",
        description: "Hapni automjetet që janë aktualisht në shitje dhe shikoni inventarin e lidhur me shitësit.",
        to: "/listings",
      },
      {
        label: "Eksploroni shitësit",
        description: "Kontrolloni profilet e verifikuara, markat, vendndodhjet dhe kontaktet.",
        to: "/dealers",
      },
      {
        label: "Kontrolloni stacionet e karikimit",
        description: "Përdorni hartën e karikimit kur po planifikoni udhëtime ose po vlerësoni prakticitetin e përdorimit.",
        to: "/albania-charging-stations",
      },
      {
        label: "Apliko si shitës",
        description: "Dërgoni të dhënat e kompanisë për verifikim dhe onboarding.",
        to: "/register-dealer",
      },
      {
        label: "Kontaktoni mbështetjen",
        description: "Kontaktoni Makina Elektrike për partneritete, korrigjime ose ndihmë me platformën.",
        to: "/contact",
      },
    ],
    sections: [
      {
        id: "getting-started",
        title: "Si të nisni me Makina Elektrike",
        summary:
          "Kuptoni rolin e platformës para se ta përdorni si burim kërkimi ose për të gjetur shitës.",
        articles: [
          {
            title: "Për çfarë shërben platforma",
            body:
              "Makina Elektrike është ndërtuar si platformë kërkimi dhe tregu për automjete elektrike me fokus në Shqipëri. Ajo bashkon të dhënat e modeleve, profilet e shitësve, listimet, informacionin për karikimin dhe përmbajtjen udhëzuese në një vend.",
            bullets: [
              "Përdorni faqet e modeleve kur ju duhen specifika dhe kontekst krahasimi.",
              "Përdorni faqet e listimeve kur kërkoni automjete që janë aktualisht në shitje.",
              "Përdorni faqet e shitësve kur doni të verifikoni kush shet, mbështet ose importon një markë lokalisht.",
            ],
          },
          {
            title: "Si ta përdorni faqen në mënyrë efikase",
            body:
              "Shumica e përdoruesve ecin në një nga dy rrugët: fillimisht bëjnë kërkim dhe pastaj kontaktojnë një shitës, ose fillimisht zgjedhin një shitës dhe pastaj kontrollojnë modelet dhe inventarin.",
            bullets: [
              "Niseni te Modelet nëse ende po vendosni çfarë lloj EV-je ju përshtatet.",
              "Niseni te Listimet nëse kërkoni menjëherë një automjet që është në shitje.",
              "Përdorni Qendrën e Ndihmës dhe blogun për shpjegime praktike, jo për konfirmim të menjëhershëm të stokut.",
            ],
            ctaLabel: "Shikoni modelet",
            ctaTo: "/models",
          },
        ],
      },
      {
        id: "research-and-compare",
        title: "Kërkimi dhe krahasimi i automjeteve elektrike",
        summary:
          "Mënyra më e fortë për ta përdorur platformën është të kombinoni kërkimin te modelet, listimet aktive dhe mjetet e shortlist-it.",
        articles: [
          {
            title: "Faqja e modelit kundrejt faqes së listimit",
            body:
              "Faqja e modelit përshkruan vetë automjetin. Faqja e listimit përshkruan një automjet konkret që po shitet nga një shitës i caktuar. Këto nuk duhen lexuar si i njëjti burim.",
            bullets: [
              "Përdorni faqet e modeleve për të krahasuar baterinë, autonominë WLTP, karikimin dhe tipin e trupit.",
              "Përdorni listimet për vitin, kilometrat, vendndodhjen, shitësin, fotot dhe detajet konkrete të automjetit.",
              "Kur inventari ndryshon shpejt, besoni faqen e listimit dhe kontaktin me shitësin më shumë se një supozim i vjetër.",
            ],
            ctaLabel: "Hap listimet",
            ctaTo: "/listings",
          },
          {
            title: "Si të përdorni të preferuarat dhe krahasimin",
            body:
              "Të preferuarat dhe krahasimi krah për krah funksionojnë më mirë si proces shortlist-i. Ruani automjetet që kalojnë filtrin e parë dhe krahasoni vetëm alternativat që vlejnë realisht.",
            bullets: [
              "Së pari shortlist, pastaj krahasim.",
              "Krahasoni autonominë, karikimin, madhësinë, përdorimin e synuar dhe jo vetëm një numër të vetëm.",
              "Pas krahasimit, rikontrolloni disponueshmërinë te shitësi sepse inventari mund të ndryshojë.",
            ],
            ctaLabel: "Hap të preferuarat",
            ctaTo: "/favorites",
          },
        ],
      },
      {
        id: "dealers-and-enquiries",
        title: "Shitësit, listimet dhe kërkesat",
        summary:
          "Përdorni profilet e shitësve për të verifikuar kë po kontaktoni dhe përdorni format e kërkesës për ta kthyer kërkimin në bisedë konkrete blerjeje.",
        articles: [
          {
            title: "Kur duhet përdorur faqja e shitësit",
            body:
              "Faqet e shitësve janë vendi më i mirë për të kontrolluar vendndodhjen, markat që mbulojnë, kontaktet dhe nëse një shitës duket aktiv në platformë.",
            bullets: [
              "Kontrolloni vendndodhjen dhe kontaktet para se të organizoni një vizitë.",
              "Përdorni informacionin e markës për të kuptuar nëse shitësi i shërben shortlist-it tuaj.",
              "Lexoni faqen e shitësit së bashku me listimet, jo si zëvendësim i tyre.",
            ],
            ctaLabel: "Shiko shitësit",
            ctaTo: "/dealers",
          },
          {
            title: "Si duhet përdorur kërkesa për kontakt",
            body:
              "Kërkesat janë menduar për të nisur një bisedë me shitësin për një automjet ose profil të caktuar. Ato nuk janë rezervim dhe nuk garantojnë disponueshmëri.",
            bullets: [
              "Jini specifik: pyesni për disponueshmërinë, gjendjen, pajisjet e karikimit ose dokumentet e nevojshme.",
              "Kur koha është e rëndësishme, ndiqni edhe kontaktin direkt me shitësin.",
              "Nëse kontaktet duken të vjetruara, përdorni faqen e Kontaktit për ta raportuar problemin te Makina Elektrike.",
            ],
            ctaLabel: "Kontaktoni Makina Elektrike",
            ctaTo: "/contact",
          },
        ],
      },
      {
        id: "charging-and-ownership",
        title: "Karikimi dhe përdorimi i EV-së",
        summary:
          "Faqja e karikimit dhe përmbajtja editoriale ndihmojnë për të kuptuar praktikën e përdorimit, jo vetëm specifikat në letër.",
        articles: [
          {
            title: "Si të përdorni faqen e stacioneve të karikimit",
            body:
              "Harta e karikimit është më e vlefshme kur doni të kuptoni mbulimin e rrjetit, praktikën e përdorimit dhe sa i realizueshëm është një EV për rrugët tuaja të zakonshme në Shqipëri.",
            bullets: [
              "Përdoreni për të kuptuar nëse qyteti juaj ose korridori juaj i zakonshëm është praktik për karikim publik.",
              "Përdoreni para blerjes së një automjeti me autonomi më të ulët ose karikim më të ngadaltë AC.",
              "Trajtojeni si informacion operacional që mund të ndryshojë dhe duhet verifikuar para një udhëtimi kritik.",
            ],
            ctaLabel: "Hap hartën e karikimit",
            ctaTo: "/albania-charging-stations",
          },
          {
            title: "Ku të kërkoni udhëzime për blerje",
            body:
              "Për pyetje më të gjera rreth incentivave, zakoneve të karikimit, kostos së përdorimit dhe kontekstit të tregut, përdorni së bashku blogun dhe Qendrën e Ndihmës.",
            bullets: [
              "Përdorni blogun për analiza, kontekst tregu dhe guida më të gjata.",
              "Përdorni Qendrën e Ndihmës për përgjigje të drejtpërdrejta sipas detyrës.",
              "Për pyetje të ndjeshme ndaj kohës ose çmimit, verifikoni gjithmonë me burim aktual ose me shitësin.",
            ],
            ctaLabel: "Lexo blogun",
            ctaTo: "/blog",
          },
        ],
      },
      {
        id: "accounts-and-onboarding",
        title: "Llogaritë, regjistrimi dhe onboarding si shitës",
        summary:
          "Blerësit dhe shitësit ndjekin rrugë të ndryshme në platformë. Kjo pjesë shpjegon çfarë synon secili proces regjistrimi.",
        articles: [
          {
            title: "Regjistrimi si përdorues",
            body:
              "Regjistrimi si përdorues është për vizitorët që duan një proces kërkimi më të qëndrueshëm, sidomos për ruajtjen e shitësve, modeleve dhe krahasimeve të përsëritura.",
            bullets: [
              "Krijoni llogari nëse prisni të ktheheni disa herë te i njëjti shortlist.",
              "Përdorni një email të qëndrueshëm që komunikimi të mbetet i qartë.",
              "Llogaria e përdoruesit nuk zëvendëson kontaktin me shitësin për pyetje konkrete transaksioni.",
            ],
            ctaLabel: "Krijo llogari",
            ctaTo: "/register",
          },
          {
            title: "Regjistrimi dhe miratimi i shitësit",
            body:
              "Regjistrimi si shitës është një kërkesë onboardingu, jo aktivizim i menjëhershëm. Të dhënat shqyrtohen para se profili të trajtohet si faqe publike aktive.",
            bullets: [
              "Vendosni saktë emrin e kompanisë dhe kontaktin kryesor.",
              "Prisni një hap verifikimi para aktivizimit të aksesit.",
              "Përdorni faqen e Kontaktit nëse duhet të sqaroni një aplikim ose të raportoni problem me onboarding-un.",
            ],
            ctaLabel: "Regjistrohu si shitës",
            ctaTo: "/register-dealer",
          },
        ],
      },
      {
        id: "troubleshooting",
        title: "Zgjidhja e problemeve dhe mbështetja",
        summary:
          "Përdoreni këtë pjesë kur diçka duket e pasaktë, e paqartë ose jo më e disponueshme.",
        articles: [
          {
            title: "Çfarë të bëni kur informacioni duket i gabuar",
            body:
              "Disa informacione ndryshojnë më shpejt sesa mund të përditësohen faqet publike. Inventari i shitësve, kontaktet dhe disponueshmëria e stacioneve janë zonat më të ndjeshme ndaj ndryshimit.",
            bullets: [
              "Dalloni nëse problemi lidhet me informacion statik apo me status operacional që ndryshon shpejt.",
              "Për stokun konkret, kontrolloni gjithmonë me shitësin.",
              "Përdorni faqen e Kontaktit për të raportuar informacion publik që duhet rishikuar qendrorisht.",
            ],
          },
          {
            title: "Kur duhet të kontaktoni mbështetjen",
            body:
              "Kontaktoni Makina Elektrike kur keni nevojë për ndihmë për partneritete, onboarding të shitësve, korrigjime informacioni publik ose probleme të vetë platformës.",
            bullets: [
              "Përdorni faqen e Kontaktit për korrigjime, mbështetje, media dhe partneritete.",
              "Jepni qartë faqen, listimin ose shitësin që lidhet me problemin.",
              "Nëse mundeni, dërgoni URL-në përkatëse që çështja të shqyrtohet më shpejt.",
            ],
            ctaLabel: "Hap faqen e kontaktit",
            ctaTo: "/contact",
          },
        ],
      },
    ],
    supportTitle: "Keni ende nevojë për ndihmë?",
    supportBody:
      "Përdorni faqen e Kontaktit për pyetje mbi platformën, kërkesa partneriteti, kërkesa korrigjimi dhe ndjekje të aplikimit si shitës. Nëse jeni një dealership që dëshironi të hyni në platformë, përdorni procesin e dedikuar të regjistrimit si shitës.",
    supportPrimaryLabel: "Kontaktoni mbështetjen",
    supportPrimaryTo: "/contact",
    supportSecondaryLabel: "Regjistrimi si shitës",
    supportSecondaryTo: "/register-dealer",
  },
  it: {
    metaTitle: "Centro assistenza | Makina Elektrike",
    metaDescription:
      "Supporto pratico per cercare EV, confrontare veicoli, contattare concessionari, capire la ricarica e gestire l'onboarding dealer su Makina Elektrike.",
    metaKeywords: [
      "centro assistenza Makina Elektrike",
      "supporto EV Albania",
      "guida auto elettriche Albania",
      "onboarding concessionari",
    ],
    title: "Centro assistenza",
    subtitle:
      "Usa questa pagina per capire come funziona Makina Elektrike, dove trovare le informazioni piu utili sugli EV e cosa fare quando ti serve supporto come acquirente o concessionario.",
    sectionNavLabel: "Argomenti di supporto",
    quickLinksTitle: "Parti da un'attivita",
    quickLinksSubtitle:
      "Apri subito la parte della piattaforma che corrisponde a quello che devi fare adesso.",
    quickLinks: [
      {
        label: "Trova un modello EV",
        description: "Controlla autonomia, batteria, ricarica e carrozzeria prima di restringere la scelta.",
        to: "/models",
      },
      {
        label: "Consulta gli annunci attivi",
        description: "Guarda i veicoli attualmente in vendita e l'inventario collegato ai concessionari.",
        to: "/listings",
      },
      {
        label: "Esplora i concessionari",
        description: "Verifica profili, marchi, sedi e contatti dei concessionari presenti sulla piattaforma.",
        to: "/dealers",
      },
      {
        label: "Controlla le stazioni di ricarica",
        description: "Apri la mappa della ricarica in Albania quando vuoi valutare praticita e percorsi.",
        to: "/albania-charging-stations",
      },
      {
        label: "Candidati come concessionario",
        description: "Invia i dati della tua attivita per revisione e onboarding.",
        to: "/register-dealer",
      },
      {
        label: "Contatta il supporto",
        description: "Scrivi a Makina Elektrike per partnership, correzioni o supporto generale sulla piattaforma.",
        to: "/contact",
      },
    ],
    sections: [
      {
        id: "getting-started",
        title: "Come iniziare con Makina Elektrike",
        summary:
          "Capisci il ruolo della piattaforma prima di usarla come fonte per la ricerca o la scoperta dei concessionari.",
        articles: [
          {
            title: "A cosa serve la piattaforma",
            body:
              "Makina Elektrike e una piattaforma di ricerca e marketplace focalizzata sui veicoli elettrici in Albania. Riunisce dati di modello, profili concessionario, annunci, informazioni sulla ricarica e contenuti editoriali in un unico posto.",
            bullets: [
              "Usa le pagine modello quando ti servono specifiche e contesto di confronto.",
              "Usa le pagine annuncio quando vuoi vedere veicoli attualmente in vendita.",
              "Usa le pagine concessionario quando vuoi verificare chi vende, supporta o importa un marchio localmente.",
            ],
          },
          {
            title: "Come usare il sito in modo efficiente",
            body:
              "La maggior parte degli utenti segue uno di due percorsi: prima ricerca e poi contatto con il concessionario, oppure prima selezione del concessionario e poi verifica di modelli e stock.",
            bullets: [
              "Parti da Modelli se stai ancora decidendo quale EV si adatta meglio alle tue esigenze.",
              "Parti da Annunci se cerchi gia un'auto concretamente in vendita.",
              "Usa il Centro assistenza e il blog per le spiegazioni pratiche, non per confermare stock in tempo reale.",
            ],
            ctaLabel: "Vai ai modelli",
            ctaTo: "/models",
          },
        ],
      },
      {
        id: "research-and-compare",
        title: "Ricerca e confronto dei veicoli elettrici",
        summary:
          "Il modo migliore di usare la piattaforma e combinare ricerca sui modelli, annunci attivi e strumenti di shortlist.",
        articles: [
          {
            title: "Pagina modello e pagina annuncio",
            body:
              "La pagina modello descrive il veicolo in generale. La pagina annuncio descrive un'auto specifica venduta da un concessionario specifico. Non vanno lette come la stessa fonte.",
            bullets: [
              "Usa le pagine modello per batteria, autonomia WLTP, ricarica e tipo di carrozzeria.",
              "Usa gli annunci per anno, chilometraggio, localita, concessionario, foto e dettagli della singola vettura.",
              "Quando lo stock cambia rapidamente, conta di piu la pagina annuncio e il contatto diretto con il concessionario.",
            ],
            ctaLabel: "Apri gli annunci",
            ctaTo: "/listings",
          },
          {
            title: "Come usare preferiti e confronto",
            body:
              "Preferiti e confronto affiancato funzionano meglio come flusso di shortlist. Salva prima le alternative valide e confronta solo quelle che contano davvero.",
            bullets: [
              "Prima shortlist, poi confronto.",
              "Confronta autonomia, velocita di ricarica, dimensioni, utilizzo previsto e non un solo numero.",
              "Dopo il confronto, ricontrolla la disponibilita presso il concessionario perche lo stock puo cambiare.",
            ],
            ctaLabel: "Apri preferiti",
            ctaTo: "/favorites",
          },
        ],
      },
      {
        id: "dealers-and-enquiries",
        title: "Concessionari, annunci e richieste",
        summary:
          "Usa i profili concessionario per verificare chi stai contattando e le richieste per trasformare la ricerca in una conversazione commerciale chiara.",
        articles: [
          {
            title: "Quando usare la pagina concessionario",
            body:
              "Le pagine concessionario sono il punto migliore per confermare sede, marchi trattati, contatti e stato generale del partner sulla piattaforma.",
            bullets: [
              "Controlla sede e contatti prima di organizzare una visita.",
              "Usa i marchi trattati per capire se il concessionario e davvero rilevante per la tua shortlist.",
              "Leggi la pagina concessionario insieme agli annunci, non come sostituto completo.",
            ],
            ctaLabel: "Vai ai concessionari",
            ctaTo: "/dealers",
          },
          {
            title: "Come usare correttamente le richieste",
            body:
              "Le richieste servono per avviare una conversazione su un veicolo o concessionario specifico. Non equivalgono a una prenotazione e non garantiscono disponibilita.",
            bullets: [
              "Sii specifico: disponibilita, condizioni, dotazione di ricarica o prossimi documenti da preparare.",
              "Quando il tempo conta, abbina sempre il contatto diretto con il concessionario.",
              "Se i contatti sembrano obsoleti, segnala il problema a Makina Elektrike tramite la pagina Contatti.",
            ],
            ctaLabel: "Contatta Makina Elektrike",
            ctaTo: "/contact",
          },
        ],
      },
      {
        id: "charging-and-ownership",
        title: "Ricarica e uso quotidiano dell'EV",
        summary:
          "La pagina ricarica e i contenuti editoriali aiutano a capire la praticita reale del possesso di un EV, non solo le specifiche sulla carta.",
        articles: [
          {
            title: "Come usare la pagina delle stazioni di ricarica",
            body:
              "La mappa di ricarica e utile quando vuoi capire copertura, praticita di utilizzo e fattibilita di un EV per le tue abitudini in Albania.",
            bullets: [
              "Usala per capire se la tua citta o il tuo corridoio di percorrenza e gia gestibile con la ricarica pubblica.",
              "Usala prima di acquistare un veicolo con autonomia piu limitata o ricarica AC piu lenta.",
              "Tratta i dati di ricarica come informazioni operative che possono cambiare e che vanno verificate prima di un viaggio critico.",
            ],
            ctaLabel: "Apri la mappa di ricarica",
            ctaTo: "/albania-charging-stations",
          },
          {
            title: "Dove trovare le guide per l'acquisto",
            body:
              "Per domande piu ampie su incentivi, abitudini di ricarica, costi d'uso e contesto di mercato, usa insieme blog e Centro assistenza.",
            bullets: [
              "Usa il blog per analisi, contesto di mercato e guide piu estese.",
              "Usa il Centro assistenza per risposte operative e orientate al compito.",
              "Per domande sensibili a prezzo e tempistiche, verifica sempre con una fonte aggiornata o con il concessionario.",
            ],
            ctaLabel: "Leggi il blog",
            ctaTo: "/blog",
          },
        ],
      },
      {
        id: "accounts-and-onboarding",
        title: "Account, registrazione e onboarding concessionari",
        summary:
          "Acquirenti e concessionari seguono percorsi diversi sulla piattaforma. Qui trovi cosa serve davvero ogni flusso di registrazione.",
        articles: [
          {
            title: "Registrazione utente",
            body:
              "La registrazione utente e pensata per chi vuole un flusso di ricerca piu persistente, soprattutto per salvare concessionari, veicoli preferiti e confronti ripetuti.",
            bullets: [
              "Crea un account se pensi di tornare piu volte sulla stessa shortlist.",
              "Usa un indirizzo email stabile per mantenere chiaro il rapporto con la piattaforma.",
              "L'account utente non sostituisce il contatto con il concessionario per le domande commerciali specifiche.",
            ],
            ctaLabel: "Crea un account",
            ctaTo: "/register",
          },
          {
            title: "Registrazione e approvazione del concessionario",
            body:
              "La registrazione dealer e una richiesta di onboarding, non un'attivazione immediata. I dati inviati vengono revisionati prima che il profilo sia considerato pubblico e attivo.",
            bullets: [
              "Inserisci correttamente ragione sociale e contatto principale.",
              "Aspettati un passaggio di verifica prima dell'attivazione dell'accesso.",
              "Usa la pagina Contatti se devi chiarire una candidatura o segnalare un problema di onboarding.",
            ],
            ctaLabel: "Registrati come concessionario",
            ctaTo: "/register-dealer",
          },
        ],
      },
      {
        id: "troubleshooting",
        title: "Risoluzione problemi e supporto",
        summary:
          "Consulta questa sezione quando qualcosa sembra errato, non disponibile o poco chiaro.",
        articles: [
          {
            title: "Cosa fare se un'informazione sembra sbagliata",
            body:
              "Alcune informazioni cambiano piu rapidamente di quanto una pagina pubblica possa essere aggiornata. Stock dei concessionari, canali di contatto e disponibilita delle stazioni sono le aree piu soggette a variazioni.",
            bullets: [
              "Distingui tra informazioni evergreen e stato operativo che cambia velocemente.",
              "Per lo stock effettivo, verifica sempre con il concessionario.",
              "Usa la pagina Contatti per segnalare informazioni pubbliche che devono essere riviste centralmente.",
            ],
          },
          {
            title: "Quando contattare il supporto",
            body:
              "Contatta Makina Elektrike quando ti serve aiuto per partnership, onboarding dealer, correzioni alle informazioni pubbliche o problemi generali della piattaforma.",
            bullets: [
              "Usa la pagina Contatti per correzioni, supporto, media e partnership.",
              "Indica con precisione la pagina, l'annuncio o il concessionario coinvolto.",
              "Se possibile, includi l'URL esatto per velocizzare la verifica.",
            ],
            ctaLabel: "Apri la pagina contatti",
            ctaTo: "/contact",
          },
        ],
      },
    ],
    supportTitle: "Ti serve ancora aiuto?",
    supportBody:
      "Usa la pagina Contatti per domande sulla piattaforma, richieste di partnership, segnalazioni di correzione e follow-up sull'onboarding dealer. Se sei una concessionaria che vuole entrare nella piattaforma, usa il flusso dedicato di registrazione.",
    supportPrimaryLabel: "Contatta il supporto",
    supportPrimaryTo: "/contact",
    supportSecondaryLabel: "Registrazione concessionario",
    supportSecondaryTo: "/register-dealer",
  },
};

export const getHelpCenterContent = (language?: string): HelpCenterContent => {
  const normalized = language?.toLowerCase().split("-")[0];
  if (normalized === "sq" || normalized === "it" || normalized === "en") {
    return helpCenterContent[normalized];
  }
  return helpCenterContent.en;
};
