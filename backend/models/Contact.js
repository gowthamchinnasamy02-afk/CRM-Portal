const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: [true, 'Linked Customer is mandatory'],
        },
        contactName: {
            type: String,
            required: [true, 'Contact Name is mandatory'],
            trim: true,
        },
        designation: {
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
        roleType: {
            type: String,
            enum: ['Decision Maker', 'Influencer', 'End User', 'Other'],
            default: 'Decision Maker',
        },
        isPrimary: {
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

contactSchema.index({ customerId: 1, isDeleted: 1 });

module.exports = mongoose.model('Contact', contactSchema);