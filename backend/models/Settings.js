const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
    {
        orgName: {
            type: String,
            default: 'Acme Sales Enterprise',
            required: true,
        },
        logoUrl: {
            type: String,
            default: '',
        },
        currency: {
            type: String,
            default: 'INR (₹)',
            required: true,
        },
        timeZone: {
            type: String,
            default: 'India Standard Time (IST)',
        },
        leadSources: {
            type: [String],
            default: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Event', 'Advertisement', 'Other'],
        },
        industries: {
            type: [String],
            default: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Services', 'Other'],
        },
        opportunityStages: [
            {
                name: { type: String, required: true },
                defaultProbability: { type: Number, required: true },
            },
        ],
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Settings', settingsSchema);