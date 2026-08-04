const Opportunity = require('../models/Opportunity');
const Customer = require('../models/Customer');
const Notification = require('../models/Notification');
const { getScopedQuery } = require('../middleware/rbac');
const { logAuditEvent } = require('../middleware/audit');

const STAGE_DEFAULT_PROBABILITIES = {
    Prospecting: 10,
    Qualification: 25,
    Proposal: 50,
    Negotiation: 75,
    'Closed Won': 100,
    'Closed Lost': 0,
};

exports.getOpportunities = async (req, res, next) => {
    try {
        const scopedCriteria = await getScopedQuery(req, 'ownerId');
        const query = { ...scopedCriteria, isDeleted: false };

        if (req.query.stage) query.stage = req.query.stage;
        if (req.query.customerId) query.customerId = req.query.customerId;

        const opportunities = await Opportunity.find(query)
            .populate('customerId', 'customerName companyName')
            .populate('ownerId', 'fullName email')
            .sort({ expectedCloseDate: 1 });

        const kanban = {
            Prospecting: [],
            Qualification: [],
            Proposal: [],
            Negotiation: [],
            'Closed Won': [],
            'Closed Lost': [],
        };

        let totalPipelineValue = 0;
        let weightedPipelineValue = 0;

        opportunities.forEach((opp) => {
        if (kanban[opp.stage]) {
            kanban[opp.stage].push(opp);
        }
        if (opp.stage !== 'Closed Won' && opp.stage !== 'Closed Lost') {
            totalPipelineValue += opp.expectedRevenue || 0;
            weightedPipelineValue += (opp.expectedRevenue || 0) * ((opp.probability || 0) / 100);
        }
        });

        res.json({
            success: true,
            count: opportunities.length,
            metrics: {
                totalPipelineValue,
                weightedPipelineValue: Math.round(weightedPipelineValue),
            },
            kanban,
            data: opportunities,
        });
    } catch (error) {
        next(error);
    }
};

exports.createOpportunity = async (req, res, next) => {
    try {
        const { opportunityName, customerId, stage, expectedRevenue, probability, expectedCloseDate, ownerId } = req.body;

        if (!opportunityName || !customerId || !expectedCloseDate) {
            return res.status(400).json({ success: false, message: 'Opportunity Name, Linked Customer, and Close Date are mandatory.' });
        }

        const customer = await Customer.findById(customerId);
        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Linked Customer not found.' });
        }

        const currentStage = stage || 'Prospecting';
        const rev = Number(expectedRevenue) || 0;

        if (['Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].includes(currentStage) && rev <= 0) {
            return res.status(400).json({
                success: false,
                message: `Expected Revenue must be set to a positive value before advancing to '${currentStage}' stage.`,
            });
        }

        const prob = probability !== undefined ? probability : STAGE_DEFAULT_PROBABILITIES[currentStage];
        const isClosed = ['Closed Won', 'Closed Lost'].includes(currentStage);

        const opportunity = await Opportunity.create({
            opportunityName,
            customerId,
            stage: currentStage,
            expectedRevenue: rev,
            probability: prob,
            expectedCloseDate,
            ownerId: ownerId || req.user._id,
            isReadOnly: isClosed,
        });

        await logAuditEvent({
            req,
            action: 'CREATE_OPPORTUNITY',
            entity: 'Opportunity',
            entityId: opportunity._id,
            details: { name: opportunity.opportunityName, stage: currentStage, revenue: rev },
        });

        res.status(201).json({ success: true, data: opportunity });
    } catch (error) {
        next(error);
    }
};

exports.updateOpportunity = async (req, res, next) => {
    try {
        const opportunity = await Opportunity.findById(req.params.id);

        if (!opportunity || opportunity.isDeleted) {
            return res.status(404).json({ success: false, message: 'Opportunity not found.' });
        }

        if (opportunity.isReadOnly && req.user.role !== 'Admin') {
            return res.status(403).json({
                success: false,
                message: 'This opportunity is closed and read-only. Only an Admin can make corrections.',
            });
        }

        const { opportunityName, stage, expectedRevenue, probability, expectedCloseDate, ownerId } = req.body;

        const targetStage = stage || opportunity.stage;
        const targetRevenue = expectedRevenue !== undefined ? Number(expectedRevenue) : opportunity.expectedRevenue;

        if (['Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'].includes(targetStage) && targetRevenue <= 0) {
            return res.status(400).json({
                success: false,
                message: `Expected Revenue must be set before moving past Qualification stage.`,
            });
        }

        if (opportunityName) opportunity.opportunityName = opportunityName;
        if (expectedCloseDate) opportunity.expectedCloseDate = expectedCloseDate;
        if (expectedRevenue !== undefined) opportunity.expectedRevenue = targetRevenue;
        if (ownerId) opportunity.ownerId = ownerId;

        if (stage && stage !== opportunity.stage) {
            opportunity.stage = stage;
            opportunity.probability = probability !== undefined ? probability : STAGE_DEFAULT_PROBABILITIES[stage];
            if (['Closed Won', 'Closed Lost'].includes(stage)) {
                opportunity.isReadOnly = true;
            }

            if (opportunity.ownerId.toString() !== req.user._id.toString()) {
                await Notification.create({
                    userId: opportunity.ownerId,
                    eventType: 'OPPORTUNITY_STAGE_CHANGED',
                    message: `Opportunity '${opportunity.opportunityName}' stage updated to '${stage}'.`,
                    relatedType: 'Opportunity',
                    relatedId: opportunity._id,
                });
            }
        } else if (probability !== undefined) {
        opportunity.probability = probability;
        }

        await opportunity.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_OPPORTUNITY',
            entity: 'Opportunity',
            entityId: opportunity._id,
            details: { stage: opportunity.stage, revenue: opportunity.expectedRevenue },
        });

        res.json({ success: true, data: opportunity });
    } catch (error) {
        next(error);
    }
};

exports.deleteOpportunity = async (req, res, next) => {
    try {
        const opportunity = await Opportunity.findById(req.params.id);

        if (!opportunity || opportunity.isDeleted) {
            return res.status(404).json({ success: false, message: 'Opportunity not found.' });
        }

        if (req.user.role === 'Sales Executive' && opportunity.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not have permission to delete this opportunity.' });
        }

        opportunity.isDeleted = true;
        await opportunity.save();

        await logAuditEvent({
            req,
            action: 'SOFT_DELETE_OPPORTUNITY',
            entity: 'Opportunity',
            entityId: opportunity._id,
        });

        res.json({ success: true, message: 'Opportunity archived successfully.' });
    } catch (error) {
        next(error);
    }
};