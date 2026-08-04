const express = require('express');
const router = express.Router();
const {
    getMonthlySalesReport,
    getLeadConversionReport,
    getCustomerGrowthReport,
    getEmployeePerformanceReport,
} = require('../controllers/reportsController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/monthly-sales', getMonthlySalesReport);
router.get('/lead-conversion', getLeadConversionReport);
router.get('/customer-growth', getCustomerGrowthReport);
router.get('/employee-performance', getEmployeePerformanceReport);

module.exports = router;