-- E-mail oficial de atendimento (Fale conosco e rodapé). Editável depois em Admin → Configurações.
INSERT INTO "StoreSettings" ("id", "contactEmail", "updatedAt")
VALUES ('default', 'mercattoofc@gmail.com', NOW())
ON CONFLICT ("id") DO UPDATE SET "contactEmail" = EXCLUDED."contactEmail", "updatedAt" = NOW();
