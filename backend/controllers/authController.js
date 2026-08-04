const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { logAuditEvent } = require('../middleware/audit');


const generateTokens = (id) => {
    const accessToken = jwt.sign(
        { id },
        process.env.JWT_SECRET || 'crm_lite_jwt_super_secret_key_2026_enterprise_level_secure',
        { expiresIn: process.env.JWT_EXPIRES || '24h' }
    );

    const refreshToken = jwt.sign(
        { id },
        process.env.JWT_REFRESH_SECRET || 'crm_lite_jwt_refresh_secret_key_2026',
        { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
    );

    return { accessToken, refreshToken };
};


const validatePasswordComplexity = (password) => {
    const regex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

exports.register = async (req, res, next) => {
    try {
        const { fullName, email, password, confirmPassword, phone, designation, department } = req.body;
        
        if (!fullName || !email || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Please provide all mandatory fields.' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Confirm Password must match Password.' });
        }

        if (!validatePasswordComplexity(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character.',
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }


        const userCount = await User.countDocuments();
        const isFirstUser = userCount === 0;

        const user = await User.create({
            fullName,
            email: email.toLowerCase(),
            passwordHash: password,
            phone: phone || '',
            designation: designation || (isFirstUser ? 'System Administrator' : 'Sales Representative'),
            department: department || 'Sales',
            role: isFirstUser ? 'Admin' : 'Sales Executive',
            status: isFirstUser ? 'Active' : 'Active',
        });

        await logAuditEvent({
            req,
            action: 'REGISTER',
            entity: 'User',
            entityId: user._id,
            details: { email: user.email, role: user.role },
        });
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully. You can now log in.',
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password.' });
        }

        const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        if (user.isLocked()) {
            const waitMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(423).json({
                success: false,
                message: `Account locked due to 5 failed attempts. Please try again in ${waitMinutes} minute(s).`,
            });
        }

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            await user.incLoginAttempts();
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        await user.resetLock();

        const { accessToken, refreshToken } = generateTokens(user._id);

        await logAuditEvent({
            req: { user, ip: req.ip, headers: req.headers },
            action: 'LOGIN',
            entity: 'User',
            entityId: user._id,
            details: { email: user.email, role: user.role },
        });

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status,
                designation: user.designation,
                department: user.department,
                profilePhoto: user.profilePhoto,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.json({
                success: true,
                message: 'If that email address is registered, password reset instructions have been sent.',
            });
        }

        const resetToken = crypto.randomBytes(20).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = Date.now() + 30 * 60 * 1000; // 30 mins
        await user.save({ validateBeforeSave: false });

        await logAuditEvent({
            req,
            action: 'FORGOT_PASSWORD_REQUEST',
            entity: 'User',
            entityId: user._id,
            details: { email: user.email },
        });

        res.json({
            success: true,
            message: 'Password reset link sent to your registered email.',
            resetToken,
        });
    } catch (error) {
        next(error);
    }
};


exports.resetPassword = async (req, res, next) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;

        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Token and new password fields are required.' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Confirm password does not match.' });
        }

        if (!validatePasswordComplexity(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with upper, number, and special char.',
            });
        }

        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'This link has expired, please request a new one.',
            });
        }

        user.passwordHash = newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        await logAuditEvent({
            req,
            action: 'RESET_PASSWORD_SUCCESS',
            entity: 'User',
            entityId: user._id,
        });

        res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
    
    } catch (error) {
        next(error);
    }
};


exports.getProfile = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id).populate('reportsTo', 'fullName email');
        res.json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

exports.updateProfile = async (req, res, next) => {
    try {
        const { fullName, phone, designation, department, profilePhoto, currentPassword, newPassword } = req.body;
        const user = await User.findById(req.user._id).select('+passwordHash');

        if (fullName) user.fullName = fullName;
        if (phone !== undefined) user.phone = phone;
        if (designation) user.designation = designation;
        if (department) user.department = department;
        if (profilePhoto !== undefined) user.profilePhoto = profilePhoto;

        if (currentPassword && newPassword) {
            const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
        }
        if (!validatePasswordComplexity(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters with upper, number, and special char.',
            });
        }
        user.passwordHash = newPassword;
        }

        await user.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_PROFILE',
            entity: 'User',
            entityId: user._id,
        });

        res.json({
            success: true,
            message: 'Profile updated successfully.',
            data: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
                status: user.status,
                designation: user.designation,
                department: user.department,
                phone: user.phone,
                profilePhoto: user.profilePhoto,
            },
        });
    } catch (error) {
        next(error);
    }
};