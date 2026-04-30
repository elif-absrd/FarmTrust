import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const user = process.env.DB_USER || 'postgres'
const password = process.env.DB_PASSWORD || ''
const host = process.env.DB_HOST || 'localhost'
const port = process.env.DB_PORT || '5432'
const database = process.env.DB_NAME || 'farmtrust'

const url = process.env.DATABASE_URL ||
  `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?schema=public`

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url,  
  },
})