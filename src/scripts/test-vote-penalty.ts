#!/usr/bin/env ts-node
/**
 * Script to test vote count penalty
 */

import { normalizePopularityBatch } from "@/lib/popularity";

function testVotePenalty() {
  console.log("\n🧪 Probando penalización por número de votos\n");
  console.log("=".repeat(80));

  // Test cases
  const testCases = [
    { vote_average: 8.0, vote_count: 100, expected: 80, description: "8.0 con 100 votos (sin penalización)" },
    { vote_average: 8.0, vote_count: 50, expected: 80, description: "8.0 con 50 votos (sin penalización)" },
    { vote_average: 8.0, vote_count: 49, expected: 30, description: "8.0 con 49 votos (penalización -50 puntos)" },
    { vote_average: 8.0, vote_count: 10, expected: 30, description: "8.0 con 10 votos (penalización -50 puntos)" },
    { vote_average: 5.6, vote_count: 100, expected: 56, description: "5.6 con 100 votos (sin penalización)" },
    { vote_average: 5.6, vote_count: 30, expected: 6, description: "5.6 con 30 votos (penalización -50 puntos)" },
    { vote_average: 9.2, vote_count: 5, expected: 42, description: "9.2 con 5 votos (penalización -50 puntos)" },
    { vote_average: 3.0, vote_count: 2, expected: 0, description: "3.0 con 2 votos (penalización -50 puntos, mínimo 0)" },
  ];

  console.log("\nCasos de prueba:\n");
  testCases.forEach((testCase, index) => {
    const result = normalizePopularityBatch([{
      popularityRaw: testCase.vote_average,
      source: "tmdb",
      voteCount: testCase.vote_count,
    }])[0];

    const status = Math.abs(result - testCase.expected) < 0.01 ? "✅" : "❌";
    console.log(`${index + 1}. ${status} ${testCase.description}`);
    console.log(`   vote_average: ${testCase.vote_average}, vote_count: ${testCase.vote_count}`);
    console.log(`   Resultado: ${result.toFixed(2)}/100 (esperado: ${testCase.expected}/100)`);
    if (Math.abs(result - testCase.expected) >= 0.01) {
      console.log(`   ⚠️  Diferencia: ${Math.abs(result - testCase.expected).toFixed(2)} puntos`);
    }
    console.log();
  });

  console.log("=".repeat(80));
  console.log("\n✅ Pruebas completadas\n");
}

testVotePenalty();

