const express = require("express");
const router = express.Router();
const controller = require("../controllers/report.controller");

router.post("/generate", controller.generateReport);

module.exports = router;
