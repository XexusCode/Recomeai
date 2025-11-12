import type { Locale } from "@/i18n/config";

export type GuideCategory = "movies" | "series" | "anime" | "books";

export interface TopGuideConfig {
  slug: string;
  title: string;
  description: string;
  category: GuideCategory;
}

const EN_GUIDES: TopGuideConfig[] = [
  { slug: "inception", title: "Inception", description: "Cerebral sci-fi thrillers with layered dream logic.", category: "movies" },
  { slug: "interstellar", title: "Interstellar", description: "Epic space dramas that balance science with emotion.", category: "movies" },
  { slug: "the-matrix", title: "The Matrix", description: "Cyberpunk action that questions simulated reality.", category: "movies" },
  { slug: "blade-runner-2049", title: "Blade Runner 2049", description: "Neon future noir with brooding existential stakes.", category: "movies" },
  { slug: "oppenheimer", title: "Oppenheimer", description: "Historical character studies framed like thrillers.", category: "movies" },
  { slug: "dune", title: "Dune", description: "Sweeping desert sci-fi with dynastic intrigue.", category: "movies" },
  { slug: "succession", title: "Succession", description: "Boardroom power plays with razor-sharp dialogue.", category: "series" },
  { slug: "breaking-bad", title: "Breaking Bad", description: "Moral spiral dramas with meticulous plotting.", category: "series" },
  { slug: "stranger-things", title: "Stranger Things", description: "Supernatural 80s nostalgia with found-family stakes.", category: "series" },
  { slug: "the-bear", title: "The Bear", description: "High-intensity workplace stories packed with heart.", category: "series" },
  { slug: "attack-on-titan", title: "Attack on Titan", description: "Dark fantasy anime with escalating revelations.", category: "anime" },
  { slug: "chainsaw-man", title: "Chainsaw Man", description: "Gritty action anime with chaotic dark humor.", category: "anime" },
  { slug: "spy-x-family", title: "Spy x Family", description: "Heartwarming espionage antics with found-family charm.", category: "anime" },
  { slug: "demon-slayer", title: "Demon Slayer", description: "Visual showcase shounen with emotional arcs.", category: "anime" },
  { slug: "the-hunger-games", title: "The Hunger Games", description: "High-stakes dystopian YA with rebellion arcs.", category: "books" },
  { slug: "the-name-of-the-wind", title: "The Name of the Wind", description: "Lyrical epic fantasy centred on a gifted prodigy.", category: "books" },
  { slug: "a-court-of-thorns-and-roses", title: "A Court of Thorns and Roses", description: "Romantic fantasy sagas blending fae courts and intrigue.", category: "books" },
  { slug: "harry-potter", title: "Harry Potter", description: "Magic school adventures that evolve into epic battles.", category: "books" },
  { slug: "the-witcher", title: "The Witcher", description: "Monster-hunting fantasy laced with moral ambiguity.", category: "books" },
  { slug: "foundation", title: "Foundation", description: "Grand-scale sci-fi dealing in empires and psychohistory.", category: "books" },
];

const ES_GUIDES: TopGuideConfig[] = [
  { slug: "inception", title: "Origen (Inception)", description: "Thrillers de ciencia ficción cerebrales con capas oníricas.", category: "movies" },
  { slug: "interstellar", title: "Interstellar", description: "Dramas espaciales épicos que equilibran ciencia y emoción.", category: "movies" },
  { slug: "the-matrix", title: "Matrix", description: "Acción cyberpunk que cuestiona la realidad simulada.", category: "movies" },
  { slug: "blade-runner-2049", title: "Blade Runner 2049", description: "Noir futurista con dilemas existenciales.", category: "movies" },
  { slug: "oppenheimer", title: "Oppenheimer", description: "Biopics tensos con enfoque de thriller histórico.", category: "movies" },
  { slug: "dune", title: "Dune", description: "Ciencia ficción desértica con intrigas de casas nobles.", category: "movies" },
  { slug: "succession", title: "Succession", description: "Batallas corporativas con diálogos afilados.", category: "series" },
  { slug: "breaking-bad", title: "Breaking Bad", description: "Descensos morales milimétricamente planificados.", category: "series" },
  { slug: "stranger-things", title: "Stranger Things", description: "Aventuras sobrenaturales con nostalgia ochentera.", category: "series" },
  { slug: "the-bear", title: "The Bear", description: "Historias de cocina con ritmo frenético y mucho corazón.", category: "series" },
  { slug: "attack-on-titan", title: "Ataque a los Titanes", description: "Anime oscuro de fantasía con revelaciones constantes.", category: "anime" },
  { slug: "chainsaw-man", title: "Chainsaw Man", description: "Acción sangrienta con humor negro desatado.", category: "anime" },
  { slug: "spy-x-family", title: "Spy x Family", description: "Espionaje familiar cálido y divertido.", category: "anime" },
  { slug: "demon-slayer", title: "Guardianes de la Noche", description: "Shōnen visualmente espectacular con carga emocional.", category: "anime" },
  { slug: "the-hunger-games", title: "Los Juegos del Hambre", description: "Juventud distópica de alto riesgo y rebelión.", category: "books" },
  { slug: "the-name-of-the-wind", title: "El Nombre del Viento", description: "Fantasía épica lírica centrada en un prodigio.", category: "books" },
  { slug: "a-court-of-thorns-and-roses", title: "Una Corte de Rosas y Espinas", description: "Fantasía romántica entre cortes feéricas e intriga.", category: "books" },
  { slug: "harry-potter", title: "Harry Potter", description: "Aventuras mágicas que crecen hacia la épica.", category: "books" },
  { slug: "the-witcher", title: "The Witcher", description: "Cacería de monstruos con dilemas morales.", category: "books" },
  { slug: "foundation", title: "Fundación", description: "Ciencia ficción a gran escala sobre imperios y psicohistoria.", category: "books" },
];

const DE_GUIDES: TopGuideConfig[] = [
  { slug: "inception", title: "Inception", description: "Vertrackte Sci-Fi-Thriller mit Traumebenen.", category: "movies" },
  { slug: "interstellar", title: "Interstellar", description: "Weltraumdramen, die Wissenschaft und Emotion verbinden.", category: "movies" },
  { slug: "the-matrix", title: "Matrix", description: "Cyberpunk-Action, die Realität infrage stellt.", category: "movies" },
  { slug: "blade-runner-2049", title: "Blade Runner 2049", description: "Neon-Noir der Zukunft mit existenziellen Fragen.", category: "movies" },
  { slug: "oppenheimer", title: "Oppenheimer", description: "Historische Charakterstudien mit Thriller-Spannung.", category: "movies" },
  { slug: "dune", title: "Dune", description: "Wüsten-Sci-Fi mit dynastischer Politik.", category: "movies" },
  { slug: "succession", title: "Succession", description: "Machtkämpfe in Konzernen mit bissigen Dialogen.", category: "series" },
  { slug: "breaking-bad", title: "Breaking Bad", description: "Moralische Abwärtsspiralen mit minutiöser Dramaturgie.", category: "series" },
  { slug: "stranger-things", title: "Stranger Things", description: "Übernatürliche 80er-Nostalgie mit Herz.", category: "series" },
  { slug: "the-bear", title: "The Bear", description: "Intensives Küchen-Drama mit viel Herzblut.", category: "series" },
  { slug: "attack-on-titan", title: "Attack on Titan", description: "Düstere Fantasy-Anime mit stetigen Enthüllungen.", category: "anime" },
  { slug: "chainsaw-man", title: "Chainsaw Man", description: "Rauer Action-Anime mit wildem schwarzen Humor.", category: "anime" },
  { slug: "spy-x-family", title: "Spy x Family", description: "Herzliche Spionagekomödie über eine Patchwork-Familie.", category: "anime" },
  { slug: "demon-slayer", title: "Demon Slayer", description: "Visuell beeindruckender Shōnen mit emotionalem Kern.", category: "anime" },
  { slug: "the-hunger-games", title: "Die Tribute von Panem", description: "Dystopische Jugendabenteuer mit Rebellionsfaktor.", category: "books" },
  { slug: "the-name-of-the-wind", title: "Der Name des Windes", description: "Lyrische High-Fantasy über einen begabten Helden.", category: "books" },
  { slug: "a-court-of-thorns-and-roses", title: "Das Reich der sieben Höfe", description: "Romantische Fantasy mit Intrigen und Feenreichen.", category: "books" },
  { slug: "harry-potter", title: "Harry Potter", description: "Magische Schulabenteuer, die zur großen Saga anwachsen.", category: "books" },
  { slug: "the-witcher", title: "The Witcher", description: "Monsterjäger-Fantasy voller moralischer Grauzonen.", category: "books" },
  { slug: "foundation", title: "Foundation", description: "Großangelegte Sci-Fi über Imperien und Psychohistorik.", category: "books" },
];

export const TOP_SIMILAR_GUIDES: Record<Locale, TopGuideConfig[]> = {
  en: EN_GUIDES,
  es: ES_GUIDES,
  de: DE_GUIDES,
};

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  movies: "movie",
  series: "tv",
  anime: "anime",
  books: "book",
};

export function mapGuideCategoryToType(category: GuideCategory): "movie" | "tv" | "anime" | "book" {
  return CATEGORY_LABELS[category] as "movie" | "tv" | "anime" | "book";
}
