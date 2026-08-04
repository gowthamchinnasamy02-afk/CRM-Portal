const express = require('express');
const router = express.Router();
const {
    getContactsByCustomer,
    createContact,
    updateContact,
    deleteContact,
} = require('../controllers/contactController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/customer/:customerId', getContactsByCustomer);
router.post('/', createContact);
router.put('/:id', updateContact);
router.delete('/:id', deleteContact);

module.exports = router;