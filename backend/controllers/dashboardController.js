const Customer = require('../models/Customer');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { getScopedQuery } = require('../middleware/rbac');


exports.getDashboardMetrics = async (req, res, next) => {
    try {
        const customerScope = await getScopedQuery(req, 'ownerId');
        const leadScope = await getScopedQuery(req, 'assignedTo');
        const oppScope = await getScopedQuery(req, 'ownerId');
        const taskScope = await getScopedQuery(req, 'assignedTo');

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const [
            totalCustomers,
            openLeads,
            activeDeals,
            pipelineResult,
            monthlyRevenueResult,
            tasksDueToday,
            overdueTasks,
        ] = await Promise.all([
            Customer.countDocuments({ ...customerScope, isDeleted: false }),
            Lead.countDocuments({ ...leadScope, isDeleted: false, status: { $in: ['New', 'Contacted', 'Qualified'] } }),
            Opportunity.countDocuments({ ...oppScope, isDeleted: false, stage: { $nin: ['Closed Won', 'Closed Lost'] } }),
            Opportunity.aggregate([
                { $match: { ...oppScope, isDeleted: false, stage: { $nin: ['Closed Won', 'Closed Lost'] } } },
                { $group: { _id: null, total: { $sum: '$expectedRevenue' } } },
            ]),
            Opportunity.aggregate([
                {
                $match: {
                    ...oppScope,
                    isDeleted: false,
                    stage: 'Closed Won',
                    updatedAt: { $gte: startOfMonth, $lte: endOfMonth },
                },
                },
                { $group: { _id: null, total: { $sum: '$expectedRevenue' } } },
            ]),
            Task.countDocuments({
                ...taskScope,
                isDeleted: false,
                status: { $in: ['Open', 'In Progress'] },
                dueDate: { $gte: startOfToday, $lte: endOfToday },
            }),
            Task.countDocuments({
                ...taskScope,
                isDeleted: false,
                $or: [{ status: 'Overdue' }, { status: { $in: ['Open', 'In Progress'] }, dueDate: { $lt: startOfToday } }],
            }),
        ]);

        const pipelineValue = pipelineResult.length > 0 ? pipelineResult[0].total : 0;
        const monthlyRevenue = monthlyRevenueResult.length > 0 ? monthlyRevenueResult[0].total : 0;

        res.json({
            success: true,
            data: {
                kpis: {
                    totalCustomers,
                    openLeads,
                    activeDeals,
                    pipelineValue,
                    monthlyRevenue,
                    tasksDueToday,
                    overdueTasks,
                },
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getDashboardCharts = async (req, res, next) => {
    try {
        const leadScope = await getScopedQuery(req, 'assignedTo');
        const oppScope = await getScopedQuery(req, 'ownerId');

        // 1. Lead Funnel Chart Data
        const leadFunnelRaw = await Lead.aggregate([
            { $match: { ...leadScope, isDeleted: false } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]);

        const funnelMap = { New: 0, Contacted: 0, Qualified: 0, Converted: 0, Unqualified: 0 };
        leadFunnelRaw.forEach((item) => {
            if (funnelMap[item._id] !== undefined) funnelMap[item._id] = item.count;
        });

        const leadFunnel = [
            { stage: 'New', count: funnelMap.New },
            { stage: 'Contacted', count: funnelMap.Contacted },
            { stage: 'Qualified', count: funnelMap.Qualified },
            { stage: 'Converted', count: funnelMap.Converted },
        ];

        // 2. Deal Pipeline by Stage Chart Data
        const dealPipelineRaw = await Opportunity.aggregate([
            { $match: { ...oppScope, isDeleted: false } },
            { $group: { _id: '$stage', count: { $sum: 1 }, value: { $sum: '$expectedRevenue' } } },
        ]);

        const stagesList = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
        const dealPipeline = stagesList.map((stg) => {
            const found = dealPipelineRaw.find((item) => item._id === stg);
            return {
                stage: stg,
                count: found ? found.count : 0,
                value: found ? found.value : 0,
            };
        });

        // 3. Lead Source Breakdown Pie Chart
        const leadSourceRaw = await Lead.aggregate([
            { $match: { ...leadScope, isDeleted: false } },
            { $group: { _id: '$leadSource', count: { $sum: 1 } } },
        ]);

        const leadSourceBreakdown = leadSourceRaw.map((item) => ({
            source: item._id || 'Unknown',
            count: item.count,
        }));

        // 4. Sales Trend (Monthly Closed Won Revenue last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const salesTrendRaw = await Opportunity.aggregate([
            {
                $match: {
                    ...oppScope,
                    isDeleted: false,
                    stage: 'Closed Won',
                    updatedAt: { $gte: sixMonthsAgo },
                },
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$updatedAt' },
                        month: { $month: '$updatedAt' },
                    },
                    revenue: { $sum: '$expectedRevenue' },
                    count: { $sum: 1 },
                },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]);

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const salesTrend = salesTrendRaw.map((item) => ({
            month: `${monthNames[item._id.month - 1]} ${item._id.year}`,
            revenue: item.revenue,
            deals: item.count,
        }));

        // 5. Team Performance Comparison (Admin / Manager view)
        let teamPerformance = [];
        if (['Admin', 'Sales Manager'].includes(req.user.role)) {
            teamPerformance = await Opportunity.aggregate([
                { $match: { isDeleted: false, stage: 'Closed Won' } },
                { $group: { _id: '$ownerId', revenue: { $sum: '$expectedRevenue' }, wonCount: { $sum: 1 } } },
                { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
                { $unwind: '$user' },
                {
                    $project: {
                        employeeName: '$user.fullName',
                        revenue: 1,
                        wonCount: 1,
                    },
                },
                { $sort: { revenue: -1 } },
                { $limit: 5 },
            ]);
        }

        res.json({
            success: true,
            data: {
                leadFunnel,
                dealPipeline,
                leadSourceBreakdown,
                salesTrend,
                teamPerformance,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.getRecentActivitiesFeed = async (req, res, next) => {
    try {
        const activities = await Activity.find()
            .populate('createdBy', 'fullName email')
            .sort({ dateTime: -1 })
            .limit(15);

        res.json({ success: true, data: activities });
    } catch (error) {
        next(error);
    }
};