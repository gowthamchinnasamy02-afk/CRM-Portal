const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const Opportunity = require('../models/Opportunity');
const Notification = require('../models/Notification');
const { getScopedQuery } = require('../middleware/rbac');
const { logAuditEvent } = require('../middleware/audit');

const ALLOWED_TRANSITIONS = {
    New: ['Contacted', 'Unqualified'],
    Contacted: ['Qualified', 'Unqualified'],
    Qualified: ['Converted', 'Unqualified'],
    Unqualified: [],
    Converted: [],
};

exports.getLeads = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const scopedCriteria = await getScopedQuery(req, 'assignedTo');
        const query = { ...scopedCriteria, isDeleted: false };

        if (req.query.status) query.status = req.query.status;
        if (req.query.leadSource) query.leadSource = req.query.leadSource;
        if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;

        if (req.query.search && req.query.search.trim().length >= 2) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            query.$or = [{ leadName: searchRegex }, { companyName: searchRegex }, { email: searchRegex }];
        }

        const total = await Lead.countDocuments(query);
        const leads = await Lead.find(query)
            .populate('assignedTo', 'fullName email')
            .populate('convertedCustomerId', 'customerName')
            .populate('convertedOpportunityId', 'opportunityName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            success: true,
            count: leads.length,
            pagination: { total, page, pages: Math.ceil(total / limit), limit },
            data: leads,
        });
    } catch (error) {
        next(error);
    }
};

exports.createLead = async (req, res, next) => {
    try {
        const { leadName, companyName, email, phone, leadSource, estimatedValue, assignedTo } = req.body;

        if (!leadName || !leadSource) {
        return res.status(400).json({ success: false, message: 'Lead Name and Lead Source are mandatory.' });
        }

        const assignee = assignedTo || req.user._id;

        const lead = await Lead.create({
        leadName,
        companyName: companyName || '',
        email: email ? email.toLowerCase() : '',
        phone: phone || '',
        leadSource,
        estimatedValue: estimatedValue || 0,
        assignedTo: assignee,
        assignmentHistory: [{ newOwner: assignee, assignedBy: req.user._id, timestamp: new Date() }],
        });

        if (assignee.toString() !== req.user._id.toString()) {
            await Notification.create({
                userId: assignee,
                eventType: 'LEAD_ASSIGNED',
                message: `New Lead '${lead.leadName}' assigned to you by ${req.user.fullName}.`,
                relatedType: 'Lead',
                relatedId: lead._id,
            });
        }

        await logAuditEvent({
            req,
            action: 'CREATE_LEAD',
            entity: 'Lead',
            entityId: lead._id,
            details: { leadName: lead.leadName, assignedTo: assignee },
        });

        res.status(201).json({ success: true, data: lead });
    } catch (error) {
        next(error);
    }
};

exports.updateLead = async (req, res, next) => {
    try {
        const { leadName, companyName, email, phone, leadSource, estimatedValue, status, assignedTo } = req.body;
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ success: false, message: 'Lead record not found.' });
        }

        if (status && status !== lead.status) {
            const allowed = ALLOWED_TRANSITIONS[lead.status] || [];
            if (!allowed.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status transition from '${lead.status}' to '${status}'. Permitted transitions: ${allowed.join(', ') || 'None'}.`,
                });
            }
            lead.status = status;
        }

        if (assignedTo && assignedTo.toString() !== lead.assignedTo.toString()) {
            lead.assignmentHistory.push({
                previousOwner: lead.assignedTo,
                newOwner: assignedTo,
                assignedBy: req.user._id,
                timestamp: new Date(),
            });
            lead.assignedTo = assignedTo;

            await Notification.create({
                userId: assignedTo,
                eventType: 'LEAD_ASSIGNED',
                message: `Lead '${lead.leadName}' has been reassigned to you by ${req.user.fullName}.`,
                relatedType: 'Lead',
                relatedId: lead._id,
            });
        }

        if (leadName) lead.leadName = leadName;
        if (companyName !== undefined) lead.companyName = companyName;
        if (email !== undefined) lead.email = email.toLowerCase();
        if (phone !== undefined) lead.phone = phone;
        if (leadSource) lead.leadSource = leadSource;
        if (estimatedValue !== undefined) lead.estimatedValue = estimatedValue;

        await lead.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_LEAD',
            entity: 'Lead',
            entityId: lead._id,
        });

        res.json({ success: true, data: lead });
    } catch (error) {
        next(error);
    }
};

exports.convertLead = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ success: false, message: 'Lead record not found.' });
        }

        if (lead.status !== 'Qualified') {
            return res.status(400).json({
                success: false,
                message: `Lead cannot be converted unless it is in 'Qualified' status. Current status: '${lead.status}'.`,
            });
        }

        let customer = await Customer.findOne({
            email: lead.email ? lead.email.toLowerCase() : 'nonexistent@email.com',
            isDeleted: false,
        });

        if (!customer) {
            customer = await Customer.create({
                customerName: lead.leadName,
                companyName: lead.companyName || lead.leadName,
                email: lead.email || `${lead.leadName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
                phone: lead.phone || '555-0199',
                industry: 'Technology',
                status: 'Active',
                ownerId: lead.assignedTo,
            });

            await Contact.create({
                customerId: customer._id,
                contactName: lead.leadName,
                email: lead.email || customer.email,
                phone: lead.phone || customer.phone,
                designation: 'Main Contact',
                roleType: 'Decision Maker',
                isPrimary: true,
            });
        }

        const opportunity = await Opportunity.create({
            opportunityName: `${lead.companyName || lead.leadName} - Initial Deal`,
            customerId: customer._id,
            stage: 'Prospecting',
            expectedRevenue: lead.estimatedValue || 10000,
            probability: 10,
            expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            ownerId: lead.assignedTo,
        });

        lead.status = 'Converted';
        lead.convertedCustomerId = customer._id;
        lead.convertedOpportunityId = opportunity._id;
        await lead.save();

        await logAuditEvent({
            req,
            action: 'CONVERT_LEAD',
            entity: 'Lead',
            entityId: lead._id,
            details: { customerId: customer._id, opportunityId: opportunity._id },
        });

        res.json({
            success: true,
            message: 'Lead converted successfully into Customer and Opportunity.',
            data: {
                leadId: lead._id,
                customer,
                opportunity,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteLead = async (req, res, next) => {
    try {
        const lead = await Lead.findById(req.params.id);

        if (!lead || lead.isDeleted) {
            return res.status(404).json({ success: false, message: 'Lead not found.' });
        }

        if (lead.status === 'Unqualified' && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'Unqualified leads are retained for reporting and cannot be deleted by non-Admin users.',
            });
        }

        lead.isDeleted = true;
        await lead.save();

        await logAuditEvent({
            req,
            action: 'SOFT_DELETE_LEAD',
            entity: 'Lead',
            entityId: lead._id,
        });

        res.json({ success: true, message: 'Lead record archived successfully.' });
    } catch (error) {
        next(error);
    }
};