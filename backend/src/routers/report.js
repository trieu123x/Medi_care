import express from 'express'
import { getReportByTime, getReportById, getLiveStats } from '../controllers/report.js'
import { reportSchema } from '../validates/report.js'
import { validate } from '../middlewares/validate-handler.js'
import { authenticate, authorizeRoles } from '../middlewares/authenticate.js'

const router = express.Router()

// router.get('/by-time', authenticate, authorizeRoles('ADMIN'), validate({ query: reportSchema.byTimeQuery }), getReportByTime)
// router.get('/:id', authenticate, authorizeRoles('ADMIN'), validate({ params: reportSchema.params }), getReportById)

router.get('/live', getLiveStats)
router.get('/by-time', validate({ query: reportSchema.byTimeQuery }), getReportByTime)
router.get('/:id', validate({ params: reportSchema.params }), getReportById)

export default router
