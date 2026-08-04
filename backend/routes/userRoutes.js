const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, getActiveExecutives } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.use(protect);

router.get('/executives', getActiveExecutives);
router.get('/', authorize('Admin', 'Sales Manager'), getUsers);
router.post('/', authorize('Admin'), createUser);
router.put('/:id', authorize('Admin'), updateUser);

module.exports = router;