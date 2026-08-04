const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
    {
        activityType: {
            type: String,
            enum: ['Call', 'Meeting', 'Email', 'Follow-up'],
            required: [true, 'Activity Type is mandatory'],
        },
        subject: {
            type: String,
            required: [true, 'Subject is mandatory'],
            trim: true,
        },
        relatedType: {
            type: String,
            enum: ['Customer', 'Lead', 'Opportunity'],
            required: [true, 'Related Entity Type is mandatory'],
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Related Record ID is mandatory'],
        },
        dateTime: {
            type: Date,
            default: Date.now,
        },
        durationMinutes: {
            type: Number,
            default: 15,
            min: [1, 'Duration must be at least 1 minute'],
        },
        notes: {
            type: String,
            default: '',
        },
        followUpRequired: {
            type: Boolean,
            default: false,
        },
        linkedTaskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Task',
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

activitySchema.index({ relatedType: 1, relatedId: 1, dateTime: -1 });

module.exports = mongoose.model('Activity', activitySchema);