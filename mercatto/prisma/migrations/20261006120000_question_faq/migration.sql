-- Perguntas frequentes escritas pela loja (identificadas na página do produto).
ALTER TABLE "Question" ADD COLUMN "isFaq" BOOLEAN NOT NULL DEFAULT false;
