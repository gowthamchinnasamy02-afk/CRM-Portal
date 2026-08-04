const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const Task = require('../models/Task');
const { getScopedQuery } = require('../middleware/rbac');
const { logAuditEvent } = require('../middleware/audit');


exports.getCustomers = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;

        const scopedCriteria = await getScopedQuery(req, 'ownerId');
        const query = { ...scopedCriteria, isDeleted: false };

        if (req.query.search && req.query.search.trim().length >= 2) {
            const searchRegex = new RegExp(req.query.search.trim(), 'i');
            query.$or = [
                { customerName: searchRegex },
                { companyName: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
            ];
        }

        if (req.query.status) query.status = req.query.status;
        if (req.query.industry) query.industry = req.query.industry;
        if (req.query.ownerId) query.ownerId = req.query.ownerId;

        const total = await Customer.countDocuments(query);
        const customers = await Customer.find(query)
            .populate('ownerId', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
        success: true,
        count: customers.length,
        pagination: {
            total,
            page,
            pages: Math.ceil(total / limit),
            limit,
        },
        data: customers,
        });
    } catch (error) {
        next(error);
    }
};

exports.checkDuplicate = async (req, res, next) => {
    try {
        const { email, companyName, phone } = req.body;
        const duplicate = await Customer.findOne({
            isDeleted: false,
            $or: [
                { email: email.toLowerCase() },
                { companyName: companyName, phone: phone },
            ],
        });

        if (duplicate) {
            return res.json({
                success: true,
                isDuplicate: true,
                message: `A customer with matching email '${email}' or company '${companyName}' already exists.`,
                existingCustomer: {
                    id: duplicate._id,
                    name: duplicate.customerName,
                    company: duplicate.companyName,
                },
            });
        }   

        res.json({ success: true, isDuplicate: false });
    } catch (error) {
        next(error);
    }
};

exports.createCustomer = async (req, res, next) => {
    try {
        const { customerName, companyName, email, phone, address, industry, status, ownerId } = req.body;

        if (!customerName || !email || !phone) {
            return res.status(400).json({ success: false, message: 'Customer Name, Email, and Phone are mandatory fields.' });
        }

        const assignedOwner = ownerId || req.user._id;

        const customer = await Customer.create({
            customerName,
            companyName: companyName || '',
            email: email.toLowerCase(),
            phone,
            address: address || {},
            industry: industry || 'Technology',
            status: status || 'Prospect',
            ownerId: assignedOwner,
        });

        await logAuditEvent({
            req,
            action: 'CREATE_CUSTOMER',
            entity: 'Customer',
            entityId: customer._id,
            details: { name: customer.customerName, owner: assignedOwner },
        });

        res.status(201).json({ success: true, data: customer });
    } catch (error) {
        next(error);
    }
};

exports.getCustomerById = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id)
            .populate('ownerId', 'fullName email designation')
            .populate('notes.authorId', 'fullName');

        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Customer record not found.' });
        }

        const contacts = await Contact.find({ customerId: customer._id, isDeleted: false });
        const leads = await Lead.find({ convertedCustomerId: customer._id, isDeleted: false });
        const opportunities = await Opportunity.find({ customerId: customer._id, isDeleted: false });
        const tasks = await Task.find({ relatedType: 'Customer', relatedId: customer._id, isDeleted: false })
            .populate('assignedTo', 'fullName');
        const activities = await Activity.find({ relatedType: 'Customer', relatedId: customer._id })
            .populate('createdBy', 'fullName')
            .sort({ dateTime: -1 });

        res.json({
            success: true,
            data: {
                customer,
                contacts,
                leads,
                opportunities,
                tasks,
                activities,
            },
        });
    } catch (error) {
        next(error);
    }
};

exports.updateCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Customer record not found.' });
        }

        if (req.user.role === 'Sales Executive' && customer.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not have permission to edit this customer.' });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        await logAuditEvent({
            req,
            action: 'UPDATE_CUSTOMER',
            entity: 'Customer',
            entityId: customer._id,
        });

        res.json({ success: true, data: updatedCustomer });
    } catch (error) {
        next(error);
    }
};

exports.addCustomerNote = async (req, res, next) => {
    try {
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Note content cannot be empty.' });
        }

        const customer = await Customer.findById(req.params.id);
        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Customer record not found.' });
        }

        customer.notes.push({
            content: content.trim(),
            authorId: req.user._id,
            authorName: req.user.fullName,
        });

        await customer.save();

        await logAuditEvent({
            req,
            action: 'ADD_CUSTOMER_NOTE',
            entity: 'Customer',
            entityId: customer._id,
        });

        res.status(201).json({ success: true, data: customer.notes });
    } catch (error) {
        next(error);
    }
};

exports.deleteCustomer = async (req, res, next) => {
    try {
        const customer = await Customer.findById(req.params.id);

        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Customer record not found.' });
        }

        if (req.user.role === 'Sales Executive' && customer.ownerId.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
        }

        customer.isDeleted = true;
        await customer.save();

        await Contact.updateMany({ customerId: customer._id }, { $set: { isDeleted: true } });

        await logAuditEvent({
            req,
            action: 'SOFT_DELETE_CUSTOMER',
            entity: 'Customer',
            entityId: customer._id,
        });

        res.json({ success: true, message: 'Customer and associated contacts archived successfully.' });
    } catch (error) {
        next(error);
    }
};