import type { RecommendationPayload, Suggestion } from "@/lib/types";

import { defaultLocale, type Locale } from "@/i18n/config";

type TypeKey = RecommendationPayload["type"] | Suggestion["type"] | "all";
type HubCategory = "movies" | "series" | "anime" | "books";

interface TypeLabelEntry {
  singular: string;
  plural: string;
}

interface HubSection {
  title: string;
  description: string;
}

interface HubGuide {
  title: string;
  anchor: string;
  description: string;
}

interface HubStrings {
  slug: string;
  breadcrumb: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  intro: string;
  sections: HubSection[];
  guidesHeading: string;
  guidesDescription: string;
  guides: HubGuide[];
  faqHeading: string;
  faq: Array<{ question: string; answer: string }>;
}

interface AppStrings {
  common: {
    appName: string;
    buttons: {
      resetFilters: string;
      submit: string;
      viewSimilarGuide: string;
    };
    messages: {
      warningEnterTitle: string;
      infoNoResults: string;
      generating: string;
      analyzing: string;
      fetchError: string;
    };
    sections: {
      recommendationsHeading: string;
    };
    labels: {
      yearUnknown: string;
    };
    a11y: {
      skipToContent: string;
    };
    card: {
      noPoster: string;
      popularity: string;
      availabilityHeading: string;
      availabilityEmpty: string;
      actions: {
        stream: string;
        buy: string;
        rent: string;
        read: string;
        visit: string;
      };
      ariaLabel: string;
      titleTemplate: string;
      infoLabel: string;
      infoCta: string;
      bullets: {
        genre: string;
        popularity: string;
        reason: string;
      };
    };
  };
  hubs: Record<HubCategory, HubStrings>;
  home: {
    heroTitle: string;
    heroSubtitle: string;
    searchLabel: string;
    typeLabel: string;
    typeDescription: string;
    yearRangeLabel: string;
    popularityLabel: string;
    selectedPosterAlt: string;
    anchorHeading: string;
    loadMoreButton: string;
    getRandomButton: string;
    randomNotice: string;
    similarGuidesHeading: string;
    similarGuidesDescription: string;
    similarGuidesCta: string;
    chips: {
      comedy: string;
      crime: string;
      anime: string;
      year2024: string;
      surprise: string;
    };
    emptyPrompt: string;
    noResults: string;
    fetchFailed: string;
    readyPrompt: string;
    slider: {
      year: {
        minLabel: string;
        maxLabel: string;
        any: string;
        ariaMin: string;
        ariaMax: string;
        inputMinPlaceholder: string;
        inputMaxPlaceholder: string;
        instructions: string;
      };
      popularity: {
        minLabel: string;
        noMinimum: string;
        aria: string;
        clear: string;
        tooltipTitle: string;
        tooltipBody: string;
        instructions: string;
        inputLabel: string;
      };
    };
    yearChips: {
      latest: string;
      decade2010: string;
      decade2000: string;
      decade1990: string;
    };
    autocomplete: {
      placeholder: string;
      ariaLabel: string;
      loading: string;
      error: string;
      empty: string;
      minChars: string;
      select: string;
      pressEnter: string;
      yearUnknown: string;
      romaji: string;
    };
  };
  similar: {
    navBack: string;
    headline: string;
    intro: string;
    aboutAnchor: string;
    curatedHeading: string;
    curatedSubheading: string;
    reasonsHeading: string;
    quickAnswersHeading: string;
    quickAnswers: Array<{ question: string; answer: string }>;
    metadataTitle: string;
    metadataDescription: string;
    structuredDescription: string;
    synopsisFallback: string;
    moreHeading: string;
    editorialHeading: string;
    editorialOverview: string;
    editorialProviders: string;
    editorialGenres: string;
    editorialYearFallback: string;
    editorialProviderFallback: string;
  };
  seo: {
    homeDescription: string;
  };
  types: Record<TypeKey, TypeLabelEntry>;
}

const STRINGS: Record<Locale, AppStrings> = {
  en: {
    common: {
      appName: "Recomeai",
      buttons: {
        resetFilters: "Reset filters",
        submit: "Get Recommendations",
        viewSimilarGuide: 'View the dedicated "similar to {{title}}" guide',
      },
      messages: {
        warningEnterTitle: "Enter a title to get recommendations.",
        infoNoResults: "No recommendations matched those filters.",
        generating: "Generating recommendations…",
        analyzing: "Analyzing recommendations and balancing diversity…",
        fetchError: "Unable to fetch recommendations.",
      },
      sections: {
        recommendationsHeading: "Recommendations",
      },
      labels: {
        yearUnknown: "Year N/A",
      },
      a11y: {
        skipToContent: "Skip to main content",
      },
      card: {
        noPoster: "No poster available",
        popularity: "Popularity {{value}}",
        availabilityHeading: "Where to find it",
        availabilityEmpty: "Check your preferred services for this title.",
        actions: {
          stream: "Watch",
          buy: "Buy",
          rent: "Rent",
          read: "Read",
          visit: "Visit",
        },
        ariaLabel: "{{action}} on {{provider}}",
        titleTemplate: "{{provider}} • {{action}}",
        infoLabel: "Source: {{source}}",
        infoCta: "Data & privacy",
        bullets: {
          genre: "Vibe: {{genre}}",
          popularity: "Audience reach ≈ {{score}} / 100",
          reason: "Why it fits: {{summary}}",
        },
      },
    },
    hubs: {
      movies: {
        slug: "movies",
        breadcrumb: "Movies",
        metaTitle: "Best Movie Recommendations | Recomeai",
        metaDescription:
          "Explore movie recommendations curated by Recomeai's hybrid search. Blend blockbusters and hidden gems tailored to your taste.",
        heroTitle: "Movies curated for every mood",
        heroSubtitle:
          "Our hybrid search and reranker surface high-impact films that balance familiarity with surprise.",
        intro:
          "These spotlight and discovery picks refresh throughout the day. Combine them with the main search to zero in on exactly ten films you will enjoy.",
        sections: [
          {
            title: "Spotlight releases",
            description: "High-popularity films trending with audiences and critics right now.",
          },
          {
            title: "Underrated discoveries",
            description: "Character-driven and independent features that score highly on similarity and diversity.",
          },
        ],
        guidesHeading: "Popular “similar to” guides",
        guidesDescription: "Jump into deep-dive lists crafted around landmark movies.",
        guides: [
          {
            title: "Inception",
            anchor: "Inception",
            description: "Mind-bending sci-fi thrillers with emotional stakes.",
          },
          {
            title: "La La Land",
            anchor: "La La Land",
            description: "Modern musicals and romantic crowd-pleasers.",
          },
          {
            title: "Mad Max: Fury Road",
            anchor: "Mad Max: Fury Road",
            description: "High-octane action with bold worldbuilding.",
          },
        ],
        faqHeading: "Movie FAQ",
        faq: [
          {
            question: "How does Recomeai select movie recommendations?",
            answer:
              "We blend vector similarity, full-text search, popularity percentiles, reranking, and diversity constraints so the list stays relevant without repeating franchises.",
          },
          {
            question: "How often do these movie picks refresh?",
            answer:
              "Fresh titles arrive whenever you ingest data from TMDb and OMDb or rerun the expand scripts. Spotlight sections revalidate every hour for up-to-date highlights.",
          },
          {
            question: "Where can I watch the recommended films?",
            answer:
              "Each card displays up to six verified availability links sourced from TMDb watch providers, prioritising streaming, buy, and rent options in your configured region.",
          },
        ],
      },
      series: {
        slug: "series",
        breadcrumb: "Series",
        metaTitle: "Top TV Series Recommendations | Recomeai",
        metaDescription:
          "Find binge-worthy TV and streaming series, curated with Recomeai's hybrid search and reranking pipeline.",
        heroTitle: "Series that keep the momentum",
        heroSubtitle:
          "Serialized storytelling picks across drama, comedy, mini-series, and docu-series—refreshed every hour.",
        intro:
          "Use this hub to start a new binge or discover limited series worth finishing in a weekend. Combine it with filters for year, popularity, and format on the homepage.",
        sections: [
          {
            title: "Essential prestige series",
            description: "High-rated shows with strong critical and audience resonance.",
          },
          {
            title: "Fresh weeknight watches",
            description: "Shorter seasons and international finds surfaced by our diversity engine.",
          },
        ],
        guidesHeading: "Series comparison guides",
        guidesDescription: "Explore curated counterparts for flagship shows.",
        guides: [
          {
            title: "Succession",
            anchor: "Succession",
            description: "Boardroom dramas with razor-sharp writing.",
          },
          {
            title: "Stranger Things",
            anchor: "Stranger Things",
            description: "Supernatural adventures with 80s nostalgia.",
          },
          {
            title: "Dark",
            anchor: "Dark",
            description: "Time-bending mystery thrillers from around the world.",
          },
        ],
        faqHeading: "Series FAQ",
        faq: [
          {
            question: "Do you distinguish between series and anime?",
            answer:
              "Yes. TMDb ingestion separates live-action TV from anime originals, and you can browse each catalogue via dedicated hubs.",
          },
          {
            question: "Can I find limited series or mini-series here?",
            answer:
              "Absolutely—our pipeline tags short runs and miniseries, so they appear in the fresh weeknight section and in homepage quick chips.",
          },
          {
            question: "How are availability badges handled for series?",
            answer:
              "We prioritise streaming platforms first, followed by purchase or rental options. Regional overrides respect the locale set in environment variables.",
          },
        ],
      },
      anime: {
        slug: "anime",
        breadcrumb: "Anime",
        metaTitle: "Anime Recommendations | Recomeai",
        metaDescription:
          "Dive into anime recommendations that mix mainstream hits with manga-inspired deep cuts, powered by Recomeai's hybrid search.",
        heroTitle: "Anime with impact",
        heroSubtitle:
          "From shounen blockbusters to introspective slice-of-life gems, curated with AniList and TMDb data.",
        intro:
          "These selections balance energy, tone, and thematic overlap. Use them to seed your own searches or jump straight into a new season.",
        sections: [
          {
            title: "Must-watch sagas",
            description: "High-popularity anime with strong community scores and availability.",
          },
          {
            title: "Hidden anime gems",
            description: "Short-run or genre-bending titles surfaced by similarity scoring.",
          },
        ],
        guidesHeading: "Trending anime guides",
        guidesDescription: "Follow-up recommendations for fan-favourite series.",
        guides: [
          {
            title: "Attack on Titan",
            anchor: "Attack on Titan",
            description: "Epic action with political intrigue.",
          },
          {
            title: "Chainsaw Man",
            anchor: "Chainsaw Man",
            description: "Dark fantasy with razor-sharp humour.",
          },
          {
            title: "Spy x Family",
            anchor: "Spy x Family",
            description: "Warm-hearted espionage comedies.",
          },
        ],
        faqHeading: "Anime FAQ",
        faq: [
          {
            question: "Where do the anime metadata and images come from?",
            answer:
              "We merge AniList and TMDb sources to capture localisation, genres, and streaming providers, then hydrate them through Prisma localisations.",
          },
          {
            question: "Can I filter by manga adaptations or original anime?",
            answer:
              "Source material tags are stored in the database—future updates will expose them as filters. For now, descriptions highlight notable adaptations.",
          },
          {
            question: "How often is the anime catalogue updated?",
            answer:
              "Run the ingest expand script with the AniList provider enabled to pull the latest season launches and back-catalogue staples.",
          },
        ],
      },
      books: {
        slug: "books",
        breadcrumb: "Books",
        metaTitle: "Book Recommendations | Recomeai",
        metaDescription:
          "Browse novel recommendations spanning speculative fiction, literary hits, and page-turning thrillers—powered by Recomeai's hybrid ranking.",
        heroTitle: "Books to add to your shelf",
        heroSubtitle:
          "We cross-reference Google Books, Open Library, and curated metadata to surface relevant reads.",
        intro:
          "Pair this hub with the main recommender to request books similar to your favourite films, series, or existing novels.",
        sections: [
          {
            title: "Essential reads",
            description: "High-popularity novels and non-fiction staples with broad appeal.",
          },
          {
            title: "Literary discoveries",
            description: "Smaller press and genre-bending titles with strong thematic overlap.",
          },
        ],
        guidesHeading: "Book comparison guides",
        guidesDescription: "Start with these fan-favourite titles to get bespoke lists.",
        guides: [
          {
            title: "Dune",
            anchor: "Dune",
            description: "Epic science fiction sagas and cosmic politics.",
          },
          {
            title: "The Name of the Wind",
            anchor: "The Name of the Wind",
            description: "Character-driven fantasy epics with lyrical prose.",
          },
          {
            title: "The Hunger Games",
            anchor: "The Hunger Games",
            description: "High-stakes dystopian adventures and coming-of-age arcs.",
          },
        ],
        faqHeading: "Book FAQ",
        faq: [
          {
            question: "Do recommendations include eBook and audiobook availability?",
            answer:
              "Availability links highlight eBook retailers first. Future updates will surface audiobook providers and library integrations where data is available.",
          },
          {
            question: "Can I start with a film to get book matches?",
            answer:
              "Yes—enter a movie or series title on the homepage, then filter by books to receive cross-media recommendations.",
          },
          {
            question: "How do you source book metadata?",
            answer:
              "We rely on Google Books and Open Library APIs, normalise genres, and store multilingual synopses through the localisation table.",
          },
        ],
      },
    },
    home: {
      heroTitle: "Recomeai",
      heroSubtitle:
        "Hybrid recommender with intelligent diversity. Search for a title and receive exactly ten relevant, diverse, and duplicate-free recommendations.",
      searchLabel: "Search title",
      typeLabel: "Content type",
      typeDescription: "Filter recommendations by content type",
      yearRangeLabel: "Year range",
      popularityLabel: "Popularity",
      selectedPosterAlt: "Poster for {{title}}",
      anchorHeading: "Anchor title",
      loadMoreButton: "Show 10 more",
      getRandomButton: "Get Random Recommendations",
      randomNotice: "Showing random picks (no search term).",
      similarGuidesHeading: "Popular “similar to” guides",
      similarGuidesDescription: "Jump straight into curated lists for fan-favourite movies, series, anime and books.",
      similarGuidesCta: "View guide",
      chips: {
        comedy: "Comedy",
        crime: "Crime",
        anime: "Anime",
        year2024: "Year 2024",
        surprise: "Surprise me",
      },
      emptyPrompt: "Type a title or pick a chip to get started.",
      noResults: "No results for “{{query}}”. Try another title or clear filters.",
      fetchFailed: "We couldn’t fetch recommendations. Please try again.",
      readyPrompt: "Press “Get Recommendations” to continue.",
      slider: {
        year: {
          minLabel: "Min: {{value}}",
          maxLabel: "Max: {{value}}",
          any: "any",
          ariaMin: "Minimum year",
          ariaMax: "Maximum year",
          inputMinPlaceholder: "From",
          inputMaxPlaceholder: "To",
          instructions: "Drag the handles or edit the year fields below. Leave blank for any year.",
        },
        popularity: {
          minLabel: "Minimum popularity",
          noMinimum: "No minimum",
          aria: "Minimum popularity",
          clear: "Clear minimum",
          tooltipTitle: "How we score",
          tooltipBody: "0 means cult favorite, 100 means mainstream hit. Adjust to balance discoveries and crowd-pleasers.",
          instructions: "Use arrow keys or type an exact value between 0 and 100.",
          inputLabel: "Exact minimum (0–100)",
        },
      },
      yearChips: {
        latest: "Latest",
        decade2010: "2010s",
        decade2000: "2000s",
        decade1990: "1990s",
      },
      autocomplete: {
        placeholder: "Search movies, series, anime, or books",
        ariaLabel: "Search title",
        loading: "Looking for suggestions…",
        error: "Unable to load suggestions",
        empty: "No matches found, try a variation.",
        minChars: "Type at least two characters.",
        select: "Select",
        pressEnter: "Press Enter to search with the current text.",
        yearUnknown: "Year N/A",
        romaji: "romaji title",
      },
    },
    similar: {
      navBack: "Recomeai Home",
      headline: "Top {{count}} {{typePlural}} like {{title}}",
      intro:
        "These picks mirror {{title}} with {{genres}} energy while adding fresh angles. Expect balanced pacing, curated availability, and spoiler-free highlights.",
      aboutAnchor: "About {{title}}:",
      curatedHeading: "Curated recommendations",
      curatedSubheading:
        "Generated with Recomeai’s hybrid AI pipeline — semantic vectors, full-text search, reranking, and diversity balancing.",
      reasonsHeading: "Why these titles work",
      quickAnswersHeading: "Quick answers",
      quickAnswers: [
        {
          question: "Is {{title}} on streaming services?",
          answer:
            "Availability is updated daily using TMDb providers. Icons above link directly to official platforms so you can start watching immediately.",
        },
        {
          question: "How are these recommendations selected?",
          answer:
            "We combine vector similarity, full-text search, AI reranking, and diversity scoring to balance nostalgia picks with fresh discoveries.",
        },
        {
          question: "Can I refine the list further?",
          answer:
            "Yes — use the filters on the home page to target movies, TV, anime, or books and adjust release years and popularity thresholds.",
        },
        {
          question: "Do you cover international catalogs?",
          answer:
            "Watch providers default to your locale but can be configured via environment variables to match the regions you care about.",
        },
      ],
      metadataTitle: "{{typePlural}} similar to {{title}}{{year}}",
      metadataDescription:
        "Explore {{count}} {{typePlural}} like {{title}}. Highlights include {{highlights}}. Updated recommendations powered by Recomeai's hybrid AI.",
      structuredDescription:
        "Curated {{typePlural}} related to {{title}} generated through hybrid semantic search, AI reranking, and diversity balancing.",
      synopsisFallback: "A complementary title selected for tone, pacing, and thematic resonance.",
      moreHeading: "Need more inspiration?",
      editorialHeading: "Why you'll enjoy this line-up",
      editorialOverview:
        "This list balances {{typePlural}} that echo {{title}}'s core energy with fresher angles. Expect highlights like {{genreSample}} and releases spanning {{yearRange}}.",
      editorialProviders:
        "Most picks are streamable on {{providerSample}} — check the availability badges for direct links and regional options.",
      editorialGenres:
        "We leaned into themes such as {{topGenres}} to keep the experience coherent while still surfacing a few wildcard surprises.",
      editorialYearFallback: "various years",
      editorialProviderFallback: "top streaming platforms",
    },
    seo: {
      homeDescription:
        "Recomeai blends semantic vectors, full-text search, and AI reranking to deliver diverse, spoiler-free recommendations across movies, series, anime, and books.",
    },
    types: {
      movie: { singular: "Movie", plural: "Movies" },
      tv: { singular: "Series", plural: "Series" },
      anime: { singular: "Anime", plural: "Anime" },
      book: { singular: "Book", plural: "Books" },
      all: { singular: "Mixed types", plural: "Mixed selections" },
    },
  },
  es: {
    common: {
      appName: "Recomeai",
      buttons: {
        resetFilters: "Restablecer filtros",
        submit: "Obtener recomendaciones",
        viewSimilarGuide: 'Ver la guía "similares a {{title}}"',
      },
      messages: {
        warningEnterTitle: "Introduce un título para generar recomendaciones.",
        infoNoResults: "Ninguna recomendación coincide con esos filtros.",
        generating: "Generando recomendaciones…",
        analyzing: "Analizando recomendaciones y equilibrando diversidad…",
        fetchError: "No se pudieron obtener las recomendaciones.",
      },
      sections: {
        recommendationsHeading: "Recomendaciones",
      },
      labels: {
        yearUnknown: "Año N/D",
      },
      a11y: {
        skipToContent: "Saltar al contenido",
      },
      card: {
        noPoster: "Sin imagen",
        popularity: "Popularidad {{value}}",
        availabilityHeading: "Dónde verlo",
        availabilityEmpty: "Consulta tus plataformas habituales para este título.",
        actions: {
          stream: "Ver",
          buy: "Comprar",
          rent: "Alquilar",
          read: "Leer",
          visit: "Visitar",
        },
        ariaLabel: "{{action}} en {{provider}}",
        titleTemplate: "{{provider}} • {{action}}",
        infoLabel: "Fuente: {{source}}",
        infoCta: "Datos y privacidad",
        bullets: {
          genre: "Tono principal: {{genre}}",
          popularity: "Alcance aproximado: {{score}} / 100",
          reason: "¿Por qué encaja? {{summary}}",
        },
      },
    },
    hubs: {
      movies: {
        slug: "movies",
        breadcrumb: "Películas",
        metaTitle: "Recomendaciones de películas | Recomeai",
        metaDescription:
          "Explora películas recomendadas por el motor híbrido de Recomeai. Mezclamos éxitos de taquilla y joyas ocultas adaptadas a tu gusto.",
        heroTitle: "Películas para cada estado de ánimo",
        heroSubtitle:
          "El buscador híbrido y el reranker equilibran familiaridad y sorpresa para darte listas de diez títulos relevantes.",
        intro:
          "Estas selecciones se actualizan durante el día. Úsalas como punto de partida y combínalas con el buscador principal para filtrar por tipo, año y popularidad.",
        sections: [
          {
            title: "Estrenos imprescindibles",
            description: "Películas de alta popularidad que marcan tendencia entre crítica y público.",
          },
          {
            title: "Descubrimientos infravalorados",
            description: "Historias con gran afinidad temática y diversidad que quizá no tenías en el radar.",
          },
        ],
        guidesHeading: "Guías populares “similares a”",
        guidesDescription: "Accede a comparativas curadas alrededor de películas icónicas.",
        guides: [
          {
            title: "Inception",
            anchor: "Inception",
            description: "Thrillers de ciencia ficción con tensión emocional.",
          },
          {
            title: "La La Land",
            anchor: "La La Land",
            description: "Musicales contemporáneos y romances luminosos.",
          },
          {
            title: "Mad Max: Fury Road",
            anchor: "Mad Max: Fury Road",
            description: "Acción adrenalínica con mundos memorables.",
          },
        ],
        faqHeading: "Preguntas sobre películas",
        faq: [
          {
            question: "¿Cómo elige Recomeai las películas recomendadas?",
            answer:
              "Fusionamos similitud vectorial, búsqueda full-text, percentiles de popularidad, reranking y diversidad para evitar duplicados de franquicia y mantener la relevancia.",
          },
          {
            question: "¿Cada cuánto se renuevan estas listas?",
            answer:
              "Se refrescan cada hora y cuando ejecutas los scripts de ingestión con TMDb y OMDb. Así combinamos estrenos recientes con catálogo de fondo.",
          },
          {
            question: "¿Dónde puedo ver las películas recomendadas?",
            answer:
              "Cada tarjeta muestra hasta seis enlaces oficiales obtenidos de los proveedores de TMDb, priorizando streaming y opciones de compra o alquiler según tu región.",
          },
        ],
      },
      series: {
        slug: "series",
        breadcrumb: "Series",
        metaTitle: "Recomendaciones de series | Recomeai",
        metaDescription:
          "Encuentra series adictivas con el motor híbrido de Recomeai. Mezclamos drama premium, comedia, miniseries y documentales.",
        heroTitle: "Series que enganchan",
        heroSubtitle:
          "Curamos historias serializadas con buen ritmo y personajes memorables, listas para tu próxima maratón.",
        intro:
          "Este hub te ayuda a arrancar una nueva serie o elegir miniseries para el fin de semana. Ajusta luego filtros en la home para afinar por año, duración y popularidad.",
        sections: [
          {
            title: "Series de prestigio",
            description: "Producciones con gran repercusión crítica y fandom activo.",
          },
          {
            title: "Propuestas ágiles",
            description: "Temporadas cortas, internacionales y géneros híbridos detectados por nuestro motor de diversidad.",
          },
        ],
        guidesHeading: "Guías destacadas",
        guidesDescription: "Comparativas rápidas para series emblemáticas.",
        guides: [
          {
            title: "Succession",
            anchor: "Succession",
            description: "Dramas corporativos con diálogos afilados.",
          },
          {
            title: "Stranger Things",
            anchor: "Stranger Things",
            description: "Aventuras sobrenaturales con nostalgia ochentera.",
          },
          {
            title: "Dark",
            anchor: "Dark",
            description: "Thrillers temporales de culto europeos.",
          },
        ],
        faqHeading: "Preguntas sobre series",
        faq: [
          {
            question: "¿Recomeai separa series y anime?",
            answer:
              "Sí. El pipeline etiqueta live-action y anime por separado, y puedes explorarlos en hubs dedicados.",
          },
          {
            question: "¿Incluye miniseries y docuseries?",
            answer:
              "Detectamos temporadas cortas y miniseries automáticamente, así aparecen en las secciones de descubrimientos y en los filtros rápidos.",
          },
          {
            question: "¿Cómo se gestionan los iconos de disponibilidad?",
            answer:
              "Priorizamos plataformas de streaming y después compra o alquiler. Las regiones siguen la configuración (`TMDB_WATCH_REGION`).",
          },
        ],
      },
      anime: {
        slug: "anime",
        breadcrumb: "Anime",
        metaTitle: "Recomendaciones de anime | Recomeai",
        metaDescription:
          "Descubre anime popular y joyas ocultas con datos de AniList y TMDb combinados por el motor híbrido de Recomeai.",
        heroTitle: "Anime con impacto",
        heroSubtitle:
          "Seleccionamos sagas shounen, thrillers sobrenaturales y slice-of-life con gran afinidad temática.",
        intro:
          "Usa estas listas como punto de partida y luego busca títulos concretos o filtra por popularidad mínima en la home.",
        sections: [
          {
            title: "Sagas imprescindibles",
            description: "Series de anime con altos índices de popularidad y disponibilidad global.",
          },
          {
            title: "Joyas ocultas",
            description: "Propuestas cortas o experimentales recomendadas por similitud vectorial.",
          },
        ],
        guidesHeading: "Guías anime en tendencia",
        guidesDescription: "Listas detalladas para tus franquicias favoritas.",
        guides: [
          {
            title: "Attack on Titan",
            anchor: "Attack on Titan",
            description: "Acción épica con trasfondo político.",
          },
          {
            title: "Chainsaw Man",
            anchor: "Chainsaw Man",
            description: "Oscuridad, humor ácido y estética explosiva.",
          },
          {
            title: "Spy x Family",
            anchor: "Spy x Family",
            description: "Comedias de espionaje familiares y cálidas.",
          },
        ],
        faqHeading: "Preguntas sobre anime",
        faq: [
          {
            question: "¿De dónde salen los datos de anime?",
            answer:
              "Unificamos metadatos de AniList y TMDb para conservar títulos, sinopsis, géneros y disponibilidad localizados.",
          },
          {
            question: "¿Puedo saber si es adaptación de manga?",
            answer:
              "Almacenamos la fuente original en la base de datos y planeamos exponerla como filtro. Mientras tanto, destacamos la información en las sinopsis.",
          },
          {
            question: "¿Cada cuánto se actualiza la lista de anime?",
            answer:
              "Ejecuta el script de ingestión con el proveedor AniList para añadir nuevos estrenos y completar temporadas anteriores.",
          },
        ],
      },
      books: {
        slug: "books",
        breadcrumb: "Libros",
        metaTitle: "Recomendaciones de libros | Recomeai",
        metaDescription:
          "Encuentra lecturas sugeridas: ciencia ficción, fantasía, thrillers y no ficción curados por el motor híbrido de Recomeai.",
        heroTitle: "Libros para tu próxima lectura",
        heroSubtitle:
          "Combinamos Google Books, Open Library y datos curados para ofrecer lecturas con gran afinidad narrativa.",
        intro:
          "Empieza aquí y luego en la home busca películas o series para obtener recomendaciones cruzadas de libros similares.",
        sections: [
          {
            title: "Lecturas esenciales",
            description: "Novelas y ensayos de alta popularidad y gran alcance internacional.",
          },
          {
            title: "Descubrimientos literarios",
            description: "Títulos de editoriales medianas e independientes con temáticas afines.",
          },
        ],
        guidesHeading: "Guías literarias",
        guidesDescription: "Puntos de partida para generar listas personalizadas.",
        guides: [
          {
            title: "Dune",
            anchor: "Dune",
            description: "Sagas épicas de ciencia ficción y política galáctica.",
          },
          {
            title: "El nombre del viento",
            anchor: "The Name of the Wind",
            description: "Fantasía de personaje con prosa lírica.",
          },
          {
            title: "Los Juegos del Hambre",
            anchor: "The Hunger Games",
            description: "Distopías juveniles cargadas de tensión y crecimiento personal.",
          },
        ],
        faqHeading: "Preguntas sobre libros",
        faq: [
          {
            question: "¿Incluye enlaces a eBook y audiolibros?",
            answer:
              "Mostramos primero tiendas digitales. Estamos trabajando para añadir audiolibros y préstamos de biblioteca cuando los proveedores lo permitan.",
          },
          {
            question: "¿Puedo partir de una película para recibir libros afines?",
            answer:
              "Sí. Introduce el título de una película o serie en la home, aplica el filtro de libros y obtendrás novelas relacionadas.",
          },
          {
            question: "¿Cómo obtienen los metadatos literarios?",
            answer:
              "Consultamos Google Books y Open Library, normalizamos géneros y almacenamos sinopsis localizadas en la tabla `ItemLocalization`.",
          },
        ],
      },
    },
    home: {
      heroTitle: "Recomeai",
      heroSubtitle:
        "Recomendador híbrido con diversidad inteligente. Busca un título y recibe exactamente diez propuestas relevantes, variadas y sin duplicados de franquicia.",
      searchLabel: "Buscar título",
      typeLabel: "Tipo de contenido",
      typeDescription: "Filtra las recomendaciones por tipo de contenido",
      yearRangeLabel: "Rango de años",
      popularityLabel: "Popularidad",
      selectedPosterAlt: "Póster de {{title}}",
      anchorHeading: "Título de referencia",
      loadMoreButton: "Ver 10 más",
      getRandomButton: "Obtener recomendaciones aleatorias",
      randomNotice: "Mostrando recomendaciones aleatorias (sin título de búsqueda).",
      similarGuidesHeading: "Guías “similares a” populares",
      similarGuidesDescription: "Accede directo a listas curadas para tus películas, series, anime y libros favoritos.",
      similarGuidesCta: "Ver guía",
      chips: {
        comedy: "Comedia",
        crime: "Crimen",
        anime: "Anime",
        year2024: "Año 2024",
        surprise: "Sorpresa",
      },
      emptyPrompt: "Escribe un título o elige un género para empezar.",
      noResults: "No hay resultados para “{{query}}”. Prueba con otro título o borra los filtros.",
      fetchFailed: "No se pudieron obtener recomendaciones. Intenta de nuevo.",
      readyPrompt: "Pulsa “Obtener recomendaciones” para ver resultados.",
      slider: {
        year: {
          minLabel: "Mín.: {{value}}",
          maxLabel: "Máx.: {{value}}",
          any: "cualquiera",
          ariaMin: "Año mínimo",
          ariaMax: "Año máximo",
          inputMinPlaceholder: "Desde",
          inputMaxPlaceholder: "Hasta",
          instructions: "Arrastra los controles o edita los campos numéricos. Déjalo vacío para cualquier año.",
        },
        popularity: {
          minLabel: "Popularidad mínima",
          noMinimum: "Sin mínimo",
          aria: "Popularidad mínima",
          clear: "Borrar mínimo",
          tooltipTitle: "Cómo se calcula",
          tooltipBody: "0 indica título de culto; 100, fenómeno mainstream. Ajusta para equilibrar hallazgos y éxitos.",
          instructions: "Usa las flechas o escribe un valor exacto entre 0 y 100.",
          inputLabel: "Mínimo exacto (0–100)",
        },
      },
      yearChips: {
        latest: "Actual",
        decade2010: "Años 2010",
        decade2000: "Años 2000",
        decade1990: "Años 1990",
      },
      autocomplete: {
        placeholder: "Busca películas, series, anime o libros",
        ariaLabel: "Buscar título",
        loading: "Buscando sugerencias…",
        error: "No se pueden cargar las sugerencias",
        empty: "Sin coincidencias, prueba otra variación.",
        minChars: "Escribe al menos dos caracteres.",
        select: "Seleccionar",
        pressEnter: "Pulsa Enter para buscar con el texto actual.",
        yearUnknown: "Año N/D",
        romaji: "título romaji",
      },
    },
    similar: {
      navBack: "Inicio de Recomeai",
      headline: "{{count}} {{typePlural}} imprescindibles como {{title}}",
      intro:
        "Estas propuestas capturan la energía de {{title}} con matices de {{genres}}, manteniendo ritmo equilibrado, disponibilidad actualizada y cero spoilers.",
      aboutAnchor: "Sobre {{title}}:",
      curatedHeading: "Recomendaciones seleccionadas",
      curatedSubheading:
        "Generadas con la IA híbrida de Recomeai: vectores semánticos, búsqueda textual, reranking y diversidad controlada.",
      reasonsHeading: "Por qué encajan",
      quickAnswersHeading: "Respuestas rápidas",
      quickAnswers: [
        {
          question: "¿{{title}} está disponible en streaming?",
          answer:
            "Actualizamos la disponibilidad a diario desde TMDb. Los iconos enlazan a las plataformas oficiales para que puedas verla al instante.",
        },
        {
          question: "¿Cómo elegís estas recomendaciones?",
          answer:
            "Combinamos similitud semántica, búsqueda textual, reranking con IA y diversidad para equilibrar clásicos y descubrimientos nuevos.",
        },
        {
          question: "¿Puedo afinar aún más la lista?",
          answer:
            "Sí. Usa los filtros de la página principal para centrarte en cine, series, anime o libros y ajustar años o umbral de popularidad.",
        },
        {
          question: "¿Incluye catálogos internacionales?",
          answer:
            "Las plataformas se adaptan a tu región, y puedes redefinirlas mediante variables de entorno para cubrir otros territorios.",
        },
      ],
      metadataTitle: "{{typePlural}} parecidos a {{title}}{{year}}",
      metadataDescription:
        "Descubre {{count}} {{typePlural}} similares a {{title}}. Destacan {{highlights}}. Selección actualizada impulsada por la IA híbrida de Recomeai.",
      structuredDescription:
        "Selección curada de {{typePlural}}, que se ajusta a {{title}} – basado en búsqueda semántica híbrida, reranking y diversidad equilibrada.",
      synopsisFallback: "Título complementario elegido por tono, ritmo y resonancia temática.",
      moreHeading: "¿Buscas más inspiración?",
      editorialHeading: "Por qué esta selección funciona",
      editorialOverview:
        "Reunimos {{typePlural}} que conservan la energía de {{title}} y aportan nuevas capas. Encontrarás ecos de {{genreSample}} y estrenos que abarcan {{yearRange}}.",
      editorialProviders:
        "Buena parte del listado se puede ver en {{providerSample}}; revisa los iconos de disponibilidad para ir directo a la plataforma de tu región.",
      editorialGenres:
        "Priorizamos temáticas como {{topGenres}} para mantener coherencia sin renunciar a sorpresas calculadas.",
      editorialYearFallback: "varios años",
      editorialProviderFallback: "plataformas destacadas",
    },
    seo: {
      homeDescription:
        "Recomeai combina vectores semánticos, búsqueda textual y reranking con IA para ofrecer recomendaciones diversas y sin spoilers de cine, series, anime y libros.",
    },
    types: {
      movie: { singular: "Película", plural: "Películas" },
      tv: { singular: "Serie", plural: "Series" },
      anime: { singular: "Anime", plural: "Anime" },
      book: { singular: "Libro", plural: "Libros" },
      all: { singular: "Tipos mixtos", plural: "Selección mixta" },
    },
  },
  de: {
    common: {
      appName: "Recomeai",
      buttons: {
        resetFilters: "Filter zurücksetzen",
        submit: "Empfehlungen anzeigen",
        viewSimilarGuide: 'Zur Guide "ähnlich wie {{title}}"',
      },
      messages: {
        warningEnterTitle: "Bitte gib einen Titel ein, um Empfehlungen zu erhalten.",
        infoNoResults: "Keine Empfehlungen passen zu diesen Filtern.",
        generating: "Empfehlungen werden erstellt…",
        analyzing: "Empfehlungen werden analysiert und Vielfalt ausbalanciert…",
        fetchError: "Empfehlungen konnten nicht geladen werden.",
      },
      sections: {
        recommendationsHeading: "Empfehlungen",
      },
      labels: {
        yearUnknown: "Jahr k. A.",
      },
      a11y: {
        skipToContent: "Inhalt überspringen",
      },
      card: {
        noPoster: "Kein Poster verfügbar",
        popularity: "Popularität {{value}}",
        availabilityHeading: "Wo verfügbar",
        availabilityEmpty: "Prüfe deine bevorzugten Dienste für diesen Titel.",
        actions: {
          stream: "Ansehen",
          buy: "Kaufen",
          rent: "Leihen",
          read: "Lesen",
          visit: "Besuchen",
        },
        ariaLabel: "{{action}} bei {{provider}}",
        titleTemplate: "{{provider}} • {{action}}",
        infoLabel: "Quelle: {{source}}",
        infoCta: "Daten & Datenschutz",
        bullets: {
          genre: "Stimmung: {{genre}}",
          popularity: "Reichweite ca. {{score}} / 100",
          reason: "Darum passt es: {{summary}}",
        },
      },
    },
    hubs: {
      movies: {
        slug: "movies",
        breadcrumb: "Filme",
        metaTitle: "Filmempfehlungen | Recomeai",
        metaDescription:
          "Entdecke handverlesene Filmempfehlungen von Recomeai. Blockbuster treffen auf Geheimtipps – abgestimmt auf deinen Geschmack.",
        heroTitle: "Filme für jede Stimmung",
        heroSubtitle:
          "Unser hybrider Such- und Reranking-Stack kombiniert vertraute Favoriten mit überraschenden Neuentdeckungen.",
        intro:
          "Die Listen aktualisieren sich stündlich. Nutze sie als Startpunkt und kombiniere sie mit der Hauptsuche, um gezielt nach Jahr, Popularität oder Streaming-Verfügbarkeit zu filtern.",
        sections: [
          {
            title: "Aktuelle Highlights",
            description: "Filme mit hoher Popularität, die gerade für Gesprächsstoff sorgen.",
          },
          {
            title: "Versteckte Perlen",
            description: "Charakterstarke und experimentelle Werke mit hoher thematischer Übereinstimmung.",
          },
        ],
        guidesHeading: "Beliebte Vergleichsguides",
        guidesDescription: "Stöbere in kuratierten Listen zu ikonischen Filmen.",
        guides: [
          {
            title: "Inception",
            anchor: "Inception",
            description: "Mind-Bending-Science-Fiction mit emotionalem Kern.",
          },
          {
            title: "La La Land",
            anchor: "La La Land",
            description: "Moderne Musicals und romantische Crowdpleaser.",
          },
          {
            title: "Mad Max: Fury Road",
            anchor: "Mad Max: Fury Road",
            description: "Action mit hohem Tempo und markantem Worldbuilding.",
          },
        ],
        faqHeading: "Fragen zu Filmen",
        faq: [
          {
            question: "Wie wählt Recomeai Filme aus?",
            answer:
              "Wir kombinieren Vektorsuche, Volltext, Popularitäts-Percentiles, Reranking und Diversität, damit keine Franchise doppelt erscheint und die Liste ausgewogen bleibt.",
          },
          {
            question: "Wie oft werden die Filmempfehlungen aktualisiert?",
            answer:
              "Neue Titel kommen ins System, wenn du die TMDb/OMDb-Ingestion startest. Die Spotlight-Abschnitte werden zusätzlich jede Stunde neu berechnet.",
          },
          {
            question: "Wo kann ich die Filme streamen?",
            answer:
              "Jede Karte zeigt bis zu sechs geprüfte Links von TMDb-Providern – Streaming zuerst, danach Kauf- und Leihoptionen für deine Region.",
          },
        ],
      },
      series: {
        slug: "series",
        breadcrumb: "Serien",
        metaTitle: "Serienempfehlungen | Recomeai",
        metaDescription:
          "Finde binge-würdige Serien durch Recomeais hybriden Empfehlungsansatz: Drama, Comedy, Miniserien und Dokus auf einen Blick.",
        heroTitle: "Serien, die dich dranbleiben lassen",
        heroSubtitle:
          "Wir kuratieren hochwertige Erzählungen mit starkem Cast und sauberem Pacing – perfekt für deine nächste Staffel.",
        intro:
          "Nutze das Serien-Hub als Inspirationsquelle und verfeinere anschließend auf der Startseite nach Jahr, Popularität oder Format.",
        sections: [
          {
            title: "Prestige-TV",
            description: "Serien mit starker Resonanz bei Kritik und Publikum.",
          },
          {
            title: "Kurze Formate",
            description: "Internationales Storytelling mit kompakten Staffeln und schnellen Hooks.",
          },
        ],
        guidesHeading: "Vergleichsguides für Serien",
        guidesDescription: "Direkte Einstiege in kuratierte Gegenstücke.",
        guides: [
          {
            title: "Succession",
            anchor: "Succession",
            description: "Machtkämpfe in Vorstandsetagen mit bissigen Dialogen.",
          },
          {
            title: "Stranger Things",
            anchor: "Stranger Things",
            description: "Übernatürliches Abenteuer mit 80er-Charme.",
          },
          {
            title: "Dark",
            anchor: "Dark",
            description: "Zeitreise-Thriller aus Europa mit Gänsehautgarantie.",
          },
        ],
        faqHeading: "Fragen zu Serien",
        faq: [
          {
            question: "Trennt Recomeai Serien und Anime?",
            answer:
              "Ja. Live-Action-Serien und Anime werden getrennt verarbeitet und besitzen eigene Hubs.",
          },
          {
            question: "Findet man hier auch Miniserien?",
            answer:
              "Unsere Ingestion taggt Miniserien automatisch. Sie erscheinen in den Abschnitten für kurze Formate und in den Filter-Chips der Startseite.",
          },
          {
            question: "Wie funktionieren die Verfügbarkeits-Icons?",
            answer:
              "Wir priorisieren Streamingdienste, gefolgt von Kauf- oder Leihmöglichkeiten. Die Region kannst du über Umgebungsvariablen steuern.",
          },
        ],
      },
      anime: {
        slug: "anime",
        breadcrumb: "Anime",
        metaTitle: "Anime-Empfehlungen | Recomeai",
        metaDescription:
          "Tauche ein in anime Empfehlungen – große Hits und Geheimtipps basierend auf AniList- und TMDb-Daten.",
        heroTitle: "Anime mit Wucht",
        heroSubtitle:
          "Von Shounen-Hauptwerken bis zu experimentellen Kurzserien – kuratiert und lokalisiert.",
        intro:
          "Nutze die Anime-Auswahl als Inspirationsquelle und filtere anschließend gezielt nach Popularität oder Veröffentlichungsjahr.",
        sections: [
          {
            title: "Must-Watch-Sagas",
            description: "Anime mit hohen Community-Bewertungen und stabiler Verfügbarkeit.",
          },
          {
            title: "Verborgene Highlights",
            description: "Kurzläufer und Genre-Mixe, die unser Ähnlichkeitsmodell empfiehlt.",
          },
        ],
        guidesHeading: "Beliebte Anime-Guides",
        guidesDescription: "Vertiefende Listen für Fan-Lieblinge.",
        guides: [
          {
            title: "Attack on Titan",
            anchor: "Attack on Titan",
            description: "Epische Action mit politischer Spannung.",
          },
          {
            title: "Chainsaw Man",
            anchor: "Chainsaw Man",
            description: "Düsterer Fantasy-Humor mit hohem Tempo.",
          },
          {
            title: "Spy x Family",
            anchor: "Spy x Family",
            description: "Herzliche Spionagekomödie für die ganze Familie.",
          },
        ],
        faqHeading: "Fragen zu Anime",
        faq: [
          {
            question: "Welche Quellen nutzt ihr für Anime?",
            answer:
              "Wir kombinieren AniList und TMDb, normalisieren Genres und speichern Lokalisierungen inklusive Streaming-Informationen.",
          },
          {
            question: "Kann ich nach Manga-Adaptionen filtern?",
            answer:
              "Die Daten sind vorhanden; zukünftige Updates machen sie als Filter verfügbar. In den Beschreibungen weisen wir bereits darauf hin.",
          },
          {
            question: "Wie halte ich die Anime-Liste aktuell?",
            answer:
              "Starte den `ingest:expand`-Workflow mit AniList, um neue Seasons und Klassiker hinzuzufügen.",
          },
        ],
      },
      books: {
        slug: "books",
        breadcrumb: "Bücher",
        metaTitle: "Buchempfehlungen | Recomeai",
        metaDescription:
          "Erhalte Roman- und Sachbuchempfehlungen aus Science-Fiction, Fantasy, Thrillern und mehr – generiert von Recomeais hybridem System.",
        heroTitle: "Bücher für deinen Lesestapel",
        heroSubtitle:
          "Wir verknüpfen Google Books, Open Library und kuratierte Daten, um passende Leseempfehlungen zu liefern.",
        intro:
          "Nutze das Bücher-Hub, um literarische Inspiration zu sammeln, oder suche nach Filmen/Serien und filtere anschließend nach Büchern.",
        sections: [
          {
            title: "Essentielle Lektüre",
            description: "Beliebte Romane und Sachbücher mit großer Reichweite.",
          },
          {
            title: "Literarische Entdeckungen",
            description: "Titel abseits des Mainstreams, die thematisch hervorragend passen.",
          },
        ],
        guidesHeading: "Vergleichsguides für Bücher",
        guidesDescription: "Starte mit diesen Favoriten für maßgeschneiderte Listen.",
        guides: [
          {
            title: "Dune",
            anchor: "Dune",
            description: "Epische Science-Fiction und politische Welten.",
          },
          {
            title: "Der Name des Windes",
            anchor: "The Name of the Wind",
            description: "Charaktergetriebene Fantasy mit poetischer Sprache.",
          },
          {
            title: "Die Tribute von Panem",
            anchor: "The Hunger Games",
            description: "Dystopische Abenteuer mit Coming-of-Age-Fokus.",
          },
        ],
        faqHeading: "Fragen zu Büchern",
        faq: [
          {
            question: "Zeigt Recomeai eBook- und Hörbuchanbieter an?",
            answer:
              "Wir beginnen mit eBook-Shops; weitere Integrationen wie Hörbücher oder Bibliotheken sind geplant, sobald Datenquellen vorliegen.",
          },
          {
            question: "Kann ich über Filme zu passenden Büchern finden?",
            answer:
              "Ja. Suche auf der Startseite nach einem Film oder einer Serie, filtere anschließend auf Bücher und erhalte passende Lesetipps.",
          },
          {
            question: "Woher stammen die Buchdaten?",
            answer:
              "Die Informationen kommen von Google Books und Open Library; wir normalisieren Genres und speichern lokalisierte Zusammenfassungen.",
          },
        ],
      },
    },
    home: {
      heroTitle: "Recomeai",
      heroSubtitle:
        "Hybrider Empfehlungsdienst mit Vielfalt. Suche nach einem Titel und erhalte genau zehn relevante, abwechslungsreiche und franchisefreie Vorschläge.",
      searchLabel: "Titel suchen",
      typeLabel: "Inhaltstyp",
      typeDescription: "Empfehlungen nach Inhaltstyp filtern",
      yearRangeLabel: "Erscheinungsjahre",
      popularityLabel: "Popularität",
      selectedPosterAlt: "Poster von {{title}}",
      anchorHeading: "Referenztitel",
      loadMoreButton: "Weitere 10 anzeigen",
      getRandomButton: "Zufällige Empfehlungen holen",
      randomNotice: "Zufällige Empfehlungen ohne Suchbegriff.",
      similarGuidesHeading: "Beliebte “ähnlich wie” Guides",
      similarGuidesDescription: "Steige direkt in kuratierte Listen zu bekannten Filmen, Serien, Anime und Büchern ein.",
      similarGuidesCta: "Guide ansehen",
      chips: {
        comedy: "Komödie",
        crime: "Krimi",
        anime: "Anime",
        year2024: "Jahr 2024",
        surprise: "Überrasch mich",
      },
      emptyPrompt: "Gib einen Titel ein oder wähle ein Genre, um zu starten.",
      noResults: "Keine Ergebnisse für „{{query}}“. Probiere einen anderen Titel oder lösche die Filter.",
      fetchFailed: "Empfehlungen konnten nicht geladen werden. Bitte versuche es erneut.",
      readyPrompt: "Klicke auf „Empfehlungen holen“, um fortzufahren.",
      slider: {
        year: {
          minLabel: "Min.: {{value}}",
          maxLabel: "Max.: {{value}}",
          any: "beliebig",
          ariaMin: "Mindestjahr",
          ariaMax: "Höchstjahr",
          inputMinPlaceholder: "Von",
          inputMaxPlaceholder: "Bis",
          instructions: "Ziehe die Regler oder bearbeite die Zahlenfelder. Leer lassen für beliebiges Jahr.",
        },
        popularity: {
          minLabel: "Minimale Popularität",
          noMinimum: "Kein Minimum",
          aria: "Minimale Popularität",
          clear: "Minimum zurücksetzen",
          tooltipTitle: "Wie wird gewertet?",
          tooltipBody: "0 steht für Kultfavorit, 100 für Mainstream-Hit. Steuere damit, wie breit oder exklusiv die Auswahl sein soll.",
          instructions: "Nutze die Pfeiltasten oder gib einen exakten Wert zwischen 0 und 100 ein.",
          inputLabel: "Genaues Minimum (0–100)",
        },
      },
      yearChips: {
        latest: "Aktuell",
        decade2010: "2010er",
        decade2000: "2000er",
        decade1990: "1990er",
      },
      autocomplete: {
        placeholder: "Suche nach Filmen, Serien, Anime oder Büchern",
        ariaLabel: "Titel suchen",
        loading: "Suche nach Vorschlägen…",
        error: "Vorschläge konnten nicht geladen werden",
        empty: "Keine Treffer, versuche eine Variante.",
        minChars: "Mindestens zwei Zeichen eingeben.",
        select: "Auswählen",
        pressEnter: "Drücke Enter, um mit dem aktuellen Text zu suchen.",
        yearUnknown: "Jahr k. A.",
        romaji: "Romaji-Titel",
      },
    },
    similar: {
      navBack: "Recomeai Startseite",
      headline: "Top {{count}} {{typePlural}} wie {{title}}",
      intro:
        "Diese Auswahl fängt die Stimmung von {{title}} mit {{genres}}-Nuancen ein, hält das Tempo stimmig und liefert aktuelle Verfügbarkeiten ohne Spoiler.",
      aboutAnchor: "Über {{title}}:",
      curatedHeading: "Kuratiere Empfehlungen",
      curatedSubheading:
        "Entstanden durch Recomeais hybriden KI-Stack: semantische Vektoren, Volltextsuche, Reranking und Diversitätssteuerung.",
      reasonsHeading: "Darum funktionieren sie",
      quickAnswersHeading: "Schnelle Antworten",
      quickAnswers: [
        {
          question: "Ist {{title}} auf Streamingdiensten verfügbar?",
          answer:
            "Wir aktualisieren die Anbieterangaben täglich über TMDb. Die Logos verlinken direkt zur offiziellen Plattform, damit du sofort starten kannst.",
        },
        {
          question: "Wie werden diese Empfehlungen ausgewählt?",
          answer:
            "Wir kombinieren Vektorsuche, Volltext, KI-Reranking und Diversitätsscoring, um vertraute Favoriten und frische Entdeckungen auszubalancieren.",
        },
        {
          question: "Kann ich die Liste weiter anpassen?",
          answer:
            "Ja – nutze auf der Startseite die Filter für Filme, Serien, Anime oder Bücher und stelle Erscheinungsjahre sowie Popularität ein.",
        },
        {
          question: "Unterstützt ihr internationale Kataloge?",
          answer:
            "Die Standardregion richtet sich nach deinem Locale, kann aber über Umgebungsvariablen überschrieben werden.",
        },
      ],
      metadataTitle: "{{typePlural}} ähnlich wie {{title}}{{year}}",
      metadataDescription:
        "Entdecke {{count}} {{typePlural}} ähnlich zu {{title}}. Highlights sind u. a. {{highlights}}. Erstellt mit Recomeais Hybrid-Engine.",
      structuredDescription:
        "Kuratiertes Set aus {{typePlural}}, die zu {{title}} passen – basierend auf semantischer Suche, KI-Reranking und Diversitätslogik.",
      synopsisFallback: "Ein ergänzender Titel, ausgewählt nach Ton, Tempo und Themenresonanz.",
      moreHeading: "Noch mehr Inspiration?",
      editorialHeading: "Darum passt diese Auswahl",
      editorialOverview:
        "Diese Liste vereint {{typePlural}}, die den Kern von {{title}} aufgreifen und dennoch neue Blickwinkel liefern. Du findest Vibes von {{genreSample}} und Veröffentlichungen quer durch {{yearRange}}.",
      editorialProviders:
        "Viele Empfehlungen sind auf {{providerSample}} streambar – die Verfügbarkeits-Icons führen direkt zu den passenden Angeboten in deiner Region.",
      editorialGenres:
        "Schwerpunkte wie {{topGenres}} sorgen für einen roten Faden, während einige Überraschungen die Auswahl spannend halten.",
      editorialYearFallback: "verschiedene Jahre",
      editorialProviderFallback: "führende Streamingdienste",
    },
    seo: {
      homeDescription:
        "Recomeai vereint semantische Vektoren, Volltextsuche und KI-Reranking, um vielfältige, spoilerfreie Empfehlungen für Filme, Serien, Anime und Bücher zu liefern.",
    },
    types: {
      movie: { singular: "Film", plural: "Filme" },
      tv: { singular: "Serie", plural: "Serien" },
      anime: { singular: "Anime", plural: "Anime" },
      book: { singular: "Buch", plural: "Bücher" },
      all: { singular: "Gemischte Auswahl", plural: "Gemischte Auswahl" },
    },
  },
};

export function getStrings(locale: Locale): AppStrings {
  return STRINGS[locale] ?? STRINGS[defaultLocale];
}

export function format(template: string, replacements: Record<string, string | number>): string {
  return template.replace(/{{(\w+)}}/g, (_, key: string) => {
    const value = replacements[key];
    return value != null ? String(value) : "";
  });
}

export function getTypeLabel(
  locale: Locale,
  type: TypeKey,
  options: { plural?: boolean } = {},
): string {
  const dictionary = getStrings(locale);
  const entry = dictionary.types[type] ?? dictionary.types.all;
  return options.plural ? entry.plural : entry.singular;
}

export type { AppStrings };
