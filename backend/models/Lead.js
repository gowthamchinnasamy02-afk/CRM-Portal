const mongoose = require('mongoose');

const assignmentHistorySchema = new mongoose.Schema({
    previousOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    newOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
});

const leadSchema = new mongoose.Schema(
    {
        leadName: {
            type: String,
            required: [true, 'Lead Name is mandatory'],
            trim: true,
        },
        companyName: {
            type: String,
            trim: true,
            default: '',
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: '',
        },
        phone: {
            type: String,
            trim: true,
            default: '',
        },
        leadSource: {
            type: String,
            enum: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Event', 'Advertisement', 'Other'],
            required: [true, 'Lead Source is mandatory'],
        },
        estimatedValue: {
            type: Number,
            default: 0,
            min: [0, 'Estimated Value must be a positive number'],
        },
        status: {
            type: String,
            enum: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
            default: 'New',
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Assigned Sales Executive is mandatory'],
        },
        convertedCustomerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            default: null,
        },
        convertedOpportunityId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Opportunity',
            default: null,
        },
        assignmentHistory: [assignmentHistorySchema],
            isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

leadSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Lead', leadSchema);