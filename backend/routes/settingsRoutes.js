const express = require('express');
const router = express.Router();
const { getSettings, updateOrgProfile, addMasterDataEntry } = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

router.get('/', getSettings);
router.put('/profile', authorize('Admin'), updateOrgProfile);
router.post('/master-data', authorize('Admin'), addMasterDataEntry);

module.exports = router;