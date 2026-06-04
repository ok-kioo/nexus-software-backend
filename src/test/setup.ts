// Variáveis de ambiente fictícias para não falhar em requireEnv() durante testes.
process.env.SUPABASE_URL ||= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-service-role";
process.env.SUPABASE_PUBLISHABLE_KEY ||= "test-anon";
process.env.SUPABASE_ANON_KEY ||= "test-anon";
process.env.PORT ||= "3000";
process.env.CORS_ORIGIN ||= "http://localhost:8080";
