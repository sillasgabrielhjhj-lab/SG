-- Tira Automotivo, Ferramentas e Esportes (e todas as subcategorias) da vitrine.
-- Só desativa: categorias, produtos e histórico continuam no banco e podem ser
-- reativados pela administração.
WITH RECURSIVE hidden AS (
  SELECT "id" FROM "Category" WHERE "slug" IN ('automotivo', 'ferramentas', 'esportes')
  UNION
  SELECT c."id" FROM "Category" c JOIN hidden h ON c."parentId" = h."id"
)
UPDATE "Category" SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" IN (SELECT "id" FROM hidden);
