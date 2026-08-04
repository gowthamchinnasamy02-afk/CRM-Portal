const Notification = require('../models/Notification');

exports.getNotifications = async (req, res, next) => {
    try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        await Notification.updateMany(
            { userId: req.user._id, isArchived: false, createdAt: { $lt: thirtyDaysAgo } },
            { $set: { isArchived: true } }
        );

        const unreadCount = await Notification.countDocuments({
            userId: req.user._id,
            isRead: false,
            isArchived: false,
        });

        const notifications = await Notification.find({
            userId: req.user._id,
            isArchived: false,
        })
            .sort({ createdAt: -1 })
            .limit(30);

        res.json({
            success: true,
            unreadCount,
            data: notifications,
        });
    } catch (error) {
        next(error);
    }
};

exports.markAsRead = async (req, res, next) => {
    try {
        const notification = await Notification.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found.' });
        }

        notification.isRead = true;
        await notification.save();

        res.json({ success: true, data: notification });
    } catch (error) {
        next(error);
    }
};

exports.markAllAsRead = async (req, res, next) => {
    try {
        await Notification.updateMany({ userId: req.user._id, isRead: false }, { $set: { isRead: true } });
        res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error) {
        next(error);
    }
};