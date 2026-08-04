const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema(
    {
        opportunityName: {
            type: String,
            required: [true, 'Opportunity Name is mandatory'],
            trim: true,
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Linked Customer is mandatory'],
        },
        stage: {
            type: String,
            enum: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
            default: 'Prospecting',
        },
        expectedRevenue: {
            type: Number,
            default: 0,
            min: [0, 'Expected Revenue must be a positive number'],
        },
        probability: {
            type: Number,
            min: [0, 'Probability cannot be less than 0'],
            max: [100, 'Probability cannot exceed 100'],
            default: 10,
        },
        expectedCloseDate: {
            type: Date,
            required: [true, 'Expected Close Date is mandatory'],
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Owner is mandatory'],
        },
        isReadOnly: {
            type: Boolean,
            default: false,
        },
        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

opportunitySchema.index({ ownerId: 1, stage: 1 });
opportunitySchema.index({ customerId: 1 });

module.exports = mongoose.model('Opportunity', opportunitySchema);