const Settings = require('../models/Settings');
const { logAuditEvent } = require('../middleware/audit');

const getOrCreateSettings = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = await Settings.create({
            orgName: 'Default Organization',
            currency: 'USD ($)',
            timezone: 'America/New_York',
            leadSource: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Event', 'Advertisement', 'Other'],
            industries: ['Technology', 'Healthcare', 'Finance', 'Manufacturing', 'Retail', 'Education', 'Services', 'Other'],
            opportunityStages: [
                { name: 'Prospecting', defaultProbability: 10 },
                { name: 'Qualification', defaultProbability: 25 },
                { name: 'Proposal', defaultProbability: 50 },
                { name: 'Negotiation', defaultProbability: 75 },
                { name: 'Closed Won', defaultProbability: 100 },
                { name: 'Closed Lost', defaultProbability: 0 },
            ],
        });
    }
    return settings;
};

exports.getSettings = async (req, res, next) => {
    try {
        const settings = await getOrCreateSettings();
        res.json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

exports.updateOrgProfile = async (req, res, next) => {
    try {
        const { orgName, logoUrl, currency, timeZone } = req.body;
        if (!orgName || !currency) {
            return res.status(400).json({ success: false, message: 'Organization Name and Currency are mandatory configuration fields.' });
        }

        const settings = await getOrCreateSettings();
        settings.orgName = orgName;
        if (logoUrl !== undefined) settings.logoUrl = logoUrl;
        settings.currency = currency;
        if (timeZone) settings.timeZone = timeZone;

        await settings.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_SETTINGS_PROFILE',
            entity: 'Settings',
            entityId: settings._id,
        });

        res.json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};

exports.addMasterDataEntry = async (req, res, next) => {
    try {
        const { type, value } = req.body; // type = 'leadSources' | 'industries'

        if (!type || !value || !value.trim()) {
            return res.status(400).json({ success: false, message: 'Type and non-empty Value are required.' });
        }

        const settings = await getOrCreateSettings();
        const entryValue = value.trim();

        if (type === 'leadSources') {
            if (settings.leadSources.includes(entryValue)) {
                return res.status(400).json({ success: false, message: `Lead source '${entryValue}' already exists.` });
            }
            settings.leadSources.push(entryValue);
        } else if (type === 'industries') {
            if (settings.industries.includes(entryValue)) {
                return res.status(400).json({ success: false, message: `Industry '${entryValue}' already exists.` });
            }
            settings.industries.push(entryValue);
        } else {
            return res.status(400).json({ success: false, message: 'Invalid master data type.' });
        }

        await settings.save();

        await logAuditEvent({
            req,
            action: 'ADD_MASTER_DATA',
            entity: 'Settings',
            entityId: settings._id,
            details: { type, value: entryValue },
        });

        res.status(201).json({ success: true, data: settings });
    } catch (error) {
        next(error);
    }
};