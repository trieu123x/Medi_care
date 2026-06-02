import express from "express"
import { getAllMedicines, getMedicineById, createMedicine, updateMedicine, deleteMedicine, getTotalMedicines, getMedicinesForAdmin } from "../controllers/medicine.js"
import { authenticate, authorizeRoles, optionalAuthenticate } from "../middlewares/authenticate.js"

import { validate } from "../middlewares/validate-handler.js"
import { medicineSchema } from "../validates/medicine.js"

const router = express.Router()

router.get("/", validate(medicineSchema.getAll), getAllMedicines)
router.get("/admin", validate(medicineSchema.getAll), getMedicinesForAdmin)
router.get("/count", getTotalMedicines)
router.get("/:id", optionalAuthenticate, validate(medicineSchema.getById), getMedicineById)
router.post("/", authenticate, authorizeRoles('ADMIN'), validate(medicineSchema.create), createMedicine)
router.put("/:id", authenticate, authorizeRoles('ADMIN'), validate(medicineSchema.update), updateMedicine)
router.delete("/:id", authenticate, authorizeRoles('ADMIN'), validate(medicineSchema.getById), deleteMedicine)

export default router