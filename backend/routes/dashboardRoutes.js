const express = require('express');
const router = express.Router();
const {
    getDashboardMetrics,
    getDashboardCharts,
    getRecentActivitiesFeed,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/metrics', getDashboardMetrics);
router.get('/charts', getDashboardCharts);
router.get('/activities-feed', getRecentActivitiesFeed);

module.exports = router;