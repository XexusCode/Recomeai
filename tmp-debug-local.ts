import { buildRecommendations } from '@/server/recommendations/pipeline';
import { prisma } from '@/server/db/client';

async function main() {
  const locale = 'es';
  const result = await buildRecommendations({ query: 'The Witcher', locale });
  const ids = result.items.map((item) => item.id);
  const locs = await prisma.itemLocalization.findMany({
    where: {
      itemId: { in: ids },
      locale: { in: ['es', 'en'] },
    },
  });
  console.log('items', result.items.slice(0, 3).map((item) => ({ id: item.id, locale: item.locale, synopsis: item.synopsis?.slice(0, 60) })));
  console.log('localizations', locs.map((l) => ({ itemId: l.itemId, locale: l.locale, synopsis: l.synopsis?.slice(0, 60) })));
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
