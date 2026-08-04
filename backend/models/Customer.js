const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
    {
        content: {
            type: String,
            required: true,
        },
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        authorName: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

const customerSchema = new mongoose.Schema(
    {
        customerName: {
            type: String,
            required: [true, 'Customer Name is mandatory'],
            trim: true,
        },
        companyName: {
            type: String,
            trim: true,
            default: '',
        },
        email: {
            type: String,
            required: [true, 'Email is mandatory'],
            trim: true,
            lowercase: true,
        },
        phone: {
            type: String,
            required: [true, 'Phone number is mandatory'],
            trim: true,
        },
        address: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            postalCode: { type: String, default: '' },
            country: { type: String, default: 'USA' },
        },
        industry: {
            type: String,
            default: 'Technology',
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive', 'Prospect', 'Archived'],
            default: 'Prospect',
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Assigned Owner is mandatory'],
        },
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },
        notes: [noteSchema],
    },
    {
        timestamps: true,
    }
);

customerSchema.index({ email: 1, isDeleted: 1 });
customerSchema.index({ ownerId: 1, isDeleted: 1 });

module.exports = mongoose.model('Customer', customerSchema);