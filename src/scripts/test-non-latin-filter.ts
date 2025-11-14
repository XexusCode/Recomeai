#!/usr/bin/env ts-node
/**
 * Test script to verify non-Latin filter works correctly
 */

import { hasLatinCharacters } from "@/lib/non-latin-filter";

const testCases = [
  { title: "أمونة المزيونة", expected: false, description: "Arabic" },
  { title: "Любопытная Варвара 3", expected: false, description: "Cyrillic" },
  { title: "三生花", expected: false, description: "Chinese" },
  { title: "గాలివాన", expected: false, description: "Telugu" },
  { title: "The Matrix", expected: true, description: "Latin only" },
  { title: "Spider-Man: No Way Home", expected: true, description: "Latin with punctuation" },
  { title: "La Casa de Papel", expected: true, description: "Latin with accents" },
  { title: "2024", expected: false, description: "Numbers only" },
  { title: "Movie 2024", expected: true, description: "Latin with numbers" },
];

console.log("\n🧪 Testing non-Latin filter\n");
console.log("=".repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = hasLatinCharacters(testCase.title);
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ ${index + 1}. "${testCase.title}" (${testCase.description})`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
  } else {
    failed++;
    console.log(`❌ ${index + 1}. "${testCase.title}" (${testCase.description})`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result}`);
  }
  console.log();
});

console.log("=".repeat(80));
console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log("✅ All tests passed!");
  process.exit(0);
} else {
  console.log("❌ Some tests failed!");
  process.exit(1);
}

