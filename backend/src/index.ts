import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import healthRouter from './routes/health'
import authRouter from './routes/auth'
import documentsRouter from './routes/documents'
import { errorHandler } from './middleware/error'

const app = express()
const PORT = Number(process.env.PORT) || 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000'

app.use(helmet())
app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(express.json({ limit: '10mb' }))

app.use('/api', healthRouter)
app.use('/api/auth', authRouter)
app.use('/api/documents', documentsRouter)

app.use(errorHandler)

app.listen(PORT, () => {
  console.log(`backend running on http://localhost:${PORT}`)
})
