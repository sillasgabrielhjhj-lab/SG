import "dotenv/config";

// Os módulos de servidor leem DATABASE_URL: redirecionamos para o banco de teste.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.PAYMENT_PROVIDER = "dev";
process.env.PAYMENT_WEBHOOK_SECRET ??= "test-webhook-secret-123456";
process.env.EMAIL_PROVIDER = "console";
process.env.STORAGE_PROVIDER = "local";
process.env.LOG_LEVEL = "error";
