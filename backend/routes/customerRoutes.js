const express = require('express');
const router = express.Router();
const {
    getCustomers,
    checkDuplicate,
    createCustomer,
    getCustomerById,
    updateCustomer,
    addCustomerNote,
    deleteCustomer,
} = require('../controllers/customerController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/check-duplicate', checkDuplicate);
router.get('/', getCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.post('/:id/notes', addCustomerNote);
router.delete('/:id', deleteCustomer);

module.exports = router;