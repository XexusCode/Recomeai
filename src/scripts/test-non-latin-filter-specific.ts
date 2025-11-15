import { hasLatinCharacters } from "@/lib/non-latin-filter";

const testTitles = [
  "水龙吟",
  "聊斋志异",
  "From",
  "Lost",
  "Bloody Apocalypsis 鮮血の黙示録",
  "T・P BON",
  "Letters from Iwo Jima",
];

console.log("🧪 Probando filtro de caracteres no latinos:\n");

testTitles.forEach((title) => {
  const result = hasLatinCharacters(title);
  const status = result ? "✅ ACEPTADO" : "❌ RECHAZADO";
  console.log(`${status}: "${title}"`);
});

