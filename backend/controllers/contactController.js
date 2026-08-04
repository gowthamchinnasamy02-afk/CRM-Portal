const Contact = require('../models/Contact');
const Customer = require('../models/Customer');
const { logAuditEvent } = require('../middleware/audit');


exports.getContactByCustomer = async (req, res, next) => {
    try {
        const contacts = await Contact.find({
            customerId: req.params.customerId,
            isDeleted: false,
        }).sort({ isPrimary: -1, createdAt: -1 });

        res.json({ success: true, count: contacts.length, data: contacts });
    } catch (error) {
        next(error);
    }
};


exports.createContact = async (req, res, next) => {
    try {
        const { customerId, contactName, designation, email, phone, roleType, isPrimary } = req.body;

        if (!customerId || !contactName) {
            return res.status(400).json({ success: false, message: 'Linked Customer and Contact Name are mandatory.' });
        }

        const customer = await Customer.findById(customerId);
        if (!customer || customer.isDeleted) {
            return res.status(404).json({ success: false, message: 'Parent Customer not found.' });
        }

        const existingCount = await Contact.countDocuments({ customerId, isDeleted: false });
        let setPrimary = isPrimary || existingCount === 0; // First contact must be primary

        if (setPrimary) {
            await Contact.updateMany({ customerId, isDeleted: false }, { $set: { isPrimary: false } });
        }

        const contact = await Contact.create({
            customerId,
            contactName,
            designation: designation || '',
            email: email ? email.toLowerCase() : '',
            phone: phone || '',
            roleType: roleType || 'Decision Maker',
            isPrimary: setPrimary,
        });

        await logAuditEvent({
            req,
            action: 'CREATE_CONTACT',
            entity: 'Contact',
            entityId: contact._id,
            details: { contactName: contact.contactName, customerId },
        });

        res.status(201).json({ success: true, data: contact });
    } catch (error) {
        next(error);
    }
};

exports.updateContact = async (req, res, next) => {
    try {
        const { contactName, designation, email, phone, roleType, isPrimary } = req.body;
        const contact = await Contact.findById(req.params.id);

        if (!contact || contact.isDeleted) {
            return res.status(404).json({ success: false, message: 'Contact record not found.' });
        }

        if (isPrimary && !contact.isPrimary) {
            await Contact.updateMany({ customerId: contact.customerId, isDeleted: false }, { $set: { isPrimary: false } });
        }

        contact.contactName = contactName || contact.contactName;
        contact.designation = designation !== undefined ? designation : contact.designation;
        contact.email = email !== undefined ? email.toLowerCase() : contact.email;
        contact.phone = phone !== undefined ? phone : contact.phone;
        contact.roleType = roleType || contact.roleType;
        if (isPrimary !== undefined) contact.isPrimary = isPrimary;

        await contact.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_CONTACT',
            entity: 'Contact',
            entityId: contact._id,
        });

        res.json({ success: true, data: contact });
    } catch (error) {
        next(error);
    }
};

exports.deleteContact = async (req, res, next) => {
    try {
        const contact = await Contact.findById(req.params.id);

        if (!contact || contact.isDeleted) {
            return res.status(404).json({ success: false, message: 'Contact record not found.' });
        }

        contact.isDeleted = true;
        await contact.save();

        if (contact.isPrimary) {
            const nextContact = await Contact.findOne({ customerId: contact.customerId, isDeleted: false });
            if (nextContact) {
                nextContact.isPrimary = true;
                await nextContact.save();
            }
        }

        await logAuditEvent({
            req,
            action: 'SOFT_DELETE_CONTACT',
            entity: 'Contact',
            entityId: contact._id,
        });

        res.json({ success: true, message: 'Contact deleted successfully.' });
    } catch (error) {
        next(error);
    }
};