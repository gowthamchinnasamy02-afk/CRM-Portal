const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        eventType: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        relatedType: {
            type: String,
            enum: ['Customer', 'Lead', 'Opportunity', 'Task', 'Activity', 'System'],
            default: 'System',
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        isArchived: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

notificationSchema.index({ userId: 1, isRead: 1, isArchived: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);