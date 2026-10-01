/**
 * FOTOS DO SITE
 * ---------------------------------------------------------------
 * As fotos atuais são imagens de banco gratuito (Unsplash) usadas como
 * EXEMPLO. Para um resultado profissional, substitua pelas fotos reais
 * da pizzaria. Basta trocar a URL abaixo.
 *
 * Fotos próprias:
 *   1. Coloque o arquivo em /public/images (ex.: /public/images/margherita.jpg)
 *   2. Use o caminho a partir de /public: '/images/margherita.jpg'
 *   Dica: use imagens com pelo menos 1600 px de largura, em JPG/WebP.
 */

const unsplash = (id: string) => `https://images.unsplash.com/${id}`;

export const photos = {
  hero: unsplash('photo-1513104890138-7c749659a591'),

  margherita: unsplash('photo-1574071318508-1cdbab80d002'),
  calabresa: unsplash('photo-1593560708920-61dd98c46a4e'),
  quatroQueijos: unsplash('photo-1571407970349-bc81e7e96d47'),
  frangoCatupiry: unsplash('photo-1565299624946-b28f40a0ae38'),
  portuguesa: unsplash('photo-1604382354936-07c5d9983bd3'),
  pepperoni: unsplash('photo-1628840042765-356cda07504e'),
  napolitana: unsplash('photo-1595708684082-a173bb3a06c5'),
  baconCheddar: unsplash('photo-1590947132387-155cc02f3212'),
  mussarela: unsplash('photo-1588315029754-2dd089d39a1a'),

  parmaRucula: unsplash('photo-1600028068383-ea11a7a101f3'),
  burrata: unsplash('photo-1555072956-7758afb20e8f'),
  diavola: unsplash('photo-1534308983496-4fabb1a015ee'),
  funghi: unsplash('photo-1576458088443-04a19bb13da6'),
  carneSeca: unsplash('photo-1541745537411-b8046dc6d66c'),

  tiramisu: unsplash('photo-1571877227200-a0d98ea607e9'),
  chocolate: unsplash('photo-1578985545062-69928b1d9587'),
  pannaCotta: unsplash('photo-1488477181946-6428a0291777'),

  comboCasal: unsplash('photo-1594007654729-407eedc4be65'),

  restaurante: unsplash('photo-1517248135467-4c7edcad34c4'),
  mesa: unsplash('photo-1414235077428-338989a2e8c0'),
  salao: unsplash('photo-1555396273-367ea4eb4db5'),
  cozinha: unsplash('photo-1556910103-1c02745aae4d'),
  forno: unsplash('photo-1579751626657-72bc17010498'),
} as const;
