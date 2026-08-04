const User = require('../models/User');
const { logAuditEvent } = require('../middleware/audit');

exports.getUsers = async (req, res, next) => {
    try {
        let query = {};
        if (req.user.role === 'Sales Manager') {
            query = { $or: [{ reportsTo: req.user._id }, { _id: req.user._id }] };
        }

        const users = await User.find(query)
            .populate('reportsTo', 'fullName email')
            .sort({ createdAt: -1 });

        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        next(error);
    }
};

exports.createUser = async (req, res, next) => {
    try {
        const { fullName, email, password, role, phone, designation, department, reportsTo, status } = req.body;

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email address is already in use.' });
        }

        const user = await User.create({
            fullName,
            email: email.toLowerCase(),
            passwordHash: password || 'DefaultPassword123!',
            role: role || 'Sales Executive',
            phone: phone || '',
            designation: designation || 'Sales Representative',
            department: department || 'Sales',
            reportsTo: reportsTo || null,
            status: status || 'Active',
        });

        await logAuditEvent({
            req,
            action: 'ADMIN_CREATE_USER',
            entity: 'User',
            entityId: user._id,
            details: { email: user.email, role: user.role },
        });

        res.status(201).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

exports.updateUser = async (req, res, next) => {
    try {
        const { role, status, reportsTo, fullName, designation, department, phone } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        if (user.role === 'Admin' && (status === 'Inactive' || (role && role !== 'Admin'))) {
            const activeAdminCount = await User.countDocuments({ role: 'Admin', status: 'Active' });
            if (activeAdminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Cannot deactivate or change role of the sole remaining active Admin account.',
                });
            }
        }

        if (role) user.role = role;
        if (status) user.status = status;
        if (reportsTo !== undefined) user.reportsTo = reportsTo || null;
        if (fullName) user.fullName = fullName;
        if (designation) user.designation = designation;
        if (department) user.department = department;
        if (phone !== undefined) user.phone = phone;

        await user.save();

        await logAuditEvent({
            req,
            action: 'ADMIN_UPDATE_USER',
            entity: 'User',
            entityId: user._id,
            details: { role: user.role, status: user.status },
        });

        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

exports.getActiveExecutives = async (req, res, next) => {
    try {
        const executives = await User.find({ status: 'Active' }).select('_id fullName email role designation');
        res.json({ success: true, data: executives });
    } catch (error) {
        next(error);
    }
};