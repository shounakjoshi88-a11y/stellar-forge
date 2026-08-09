module.exports = {
  apps: [{
    name: "stellar-forge-api",
    script: "src/index.ts",
    interpreter: "bun",
    env: {
      DATABASE_URL: "postgresql://postgres.hynwownfnuikkvhhzypg:WGIKv6Dx4L8dav8s@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
      PORT: "3001",
      FRONTEND_URL: "https://stellar-forge-frontend.vercel.app",
      SUPABASE_URL: "https://hynwownfnuikkvhhzypg.supabase.co",
      SUPABASE_API_SECRET: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5bndvd25mbnVpa2t2aGh6eXBnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzU0MjYwNCwiZXhwIjoyMDkzMTE4NjA0fQ.bCYv09_rvMkDEr44O_2arl9TSj0Q7jEs6RObhPJ5EGc",
      ADMIN_OWNER_EMAIL: "shounakjoshi88@gmail.com"
    }
  }]
};
