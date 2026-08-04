const express = require('express');
const router = express.Router();
const {
    register,
    login,
    forgotPassword,
    resetPassword,
    getProfile,
    updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);

module.exports = router;