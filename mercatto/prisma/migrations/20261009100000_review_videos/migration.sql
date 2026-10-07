-- Vídeos enviados pelo comprador junto com a avaliação (compra verificada).
ALTER TABLE "Review" ADD COLUMN "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];
