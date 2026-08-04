const express = require('express');
const router = express.Router();
const {
    getLeads,
    createLead,
    updateLead,
    convertLead,
    deleteLead,
} = require('../controllers/leadController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', getLeads);
router.post('/', createLead);
router.put('/:id', updateLead);
router.post('/:id/convert', convertLead);
router.delete('/:id', deleteLead);

module.exports = router;