const express = require('express');
const router = express.Router();
const { getActivities, logActivity, updateActivity } = require('../controllers/activityController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getActivities);
router.post('/', logActivity);
router.put('/:id', updateActivity);

module.exports = router;