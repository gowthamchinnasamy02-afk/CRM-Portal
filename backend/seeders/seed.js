const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Contact = require('../models/Contact');
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');

dotenv.config({ path: '../.env' });

const seedDatabase = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crm_lite';
        await mongoose.connect(mongoUri);
        console.log('[Seeder]: Connected to MongoDB...');

        await User.deleteMany({});
        await Customer.deleteMany({});
        await Contact.deleteMany({});
        await Lead.deleteMany({});
        await Opportunity.deleteMany({});
        await Task.deleteMany({});
        await Activity.deleteMany({});
        await Notification.deleteMany({});
        await Settings.deleteMany({});
        await AuditLog.deleteMany({});

        console.log('[Seeder]: Cleared existing database records.');

        // 1. Create Users
        const admin = await User.create({
            fullName: 'Alexander Vance',
            email: 'admin@crmlite.com',
            passwordHash: 'AdminPass123!',
            role: 'Admin',
            status: 'Active',
            designation: 'Chief Technology Officer',
            department: 'Executive',
            phone: '555-0100',
        });

        const manager1 = await User.create({
            fullName: 'Sarah Jenkins',
            email: 'manager1@crmlite.com',
            passwordHash: 'ManagerPass123!',
            role: 'Sales Manager',
            status: 'Active',
            designation: 'Regional Sales Manager',
            department: 'Sales',
            phone: '555-0101',
        });

        const exec1 = await User.create({
            fullName: 'Michael Scott',
            email: 'exec1@crmlite.com',
            passwordHash: 'ExecPass123!',
            role: 'Sales Executive',
            status: 'Active',
            reportsTo: manager1._id,
            designation: 'Senior Account Executive',
            department: 'Sales',
            phone: '555-0102',
        });

        const exec2 = await User.create({
            fullName: 'Pam Beesly',
            email: 'exec2@crmlite.com',
            passwordHash: 'ExecPass123!',
            role: 'Sales Executive',
            status: 'Active',
            reportsTo: manager1._id,
            designation: 'Account Executive',
            department: 'Sales',
            phone: '555-0103',
        });

        console.log('[Seeder]: Created 4 initial user accounts.');

        // 2. Create Master Settings
        await Settings.create({
            orgName: 'Acme Enterprise CRM-Lite Corp',
            currency: 'USD ($)',
            timeZone: 'America/New_York',
            leadSources: ['Website', 'Referral', 'Cold Call', 'Social Media', 'Event', 'Advertisement', 'Other'],
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

        // 3. Create Customers & Primary Contacts
        const cust1 = await Customer.create({
            customerName: 'Stark Industries Tech',
            companyName: 'Stark Industries Inc.',
            email: 'contact@starktech.corp',
            phone: '212-555-0199',
            address: { street: '10880 Wilshire Blvd', city: 'Los Angeles', state: 'CA', postalCode: '90024', country: 'USA' },
            industry: 'Technology',
            status: 'Active',
            ownerId: exec1._id,
            notes: [
                { content: 'Initial discovery call went exceptionally well.', authorId: exec1._id, authorName: exec1.fullName },
                { content: 'Client interested in enterprise tier renewal.', authorId: manager1._id, authorName: manager1.fullName },
            ],
        });

        const cust2 = await Customer.create({
            customerName: 'Wayne Enterprises Global',
            companyName: 'Wayne Enterprises',
            email: 'info@wayneent.com',
            phone: '312-555-0188',
            address: { street: '1007 Mountain Drive', city: 'Gotham', state: 'NY', postalCode: '10001', country: 'USA' },
            industry: 'Finance',
            status: 'Active',
            ownerId: exec2._id,
            notes: [
                { content: 'SLA agreement reviewed by legal team.', authorId: exec2._id, authorName: exec2.fullName },
            ],
        });

        await Contact.create({
            customerId: cust1._id,
            contactName: 'Pepper Potts',
            designation: 'CEO',
            email: 'pepper@starktech.corp',
            phone: '212-555-0198',
            roleType: 'Decision Maker',
            isPrimary: true,
        });

        await Contact.create({
            customerId: cust2._id,
            contactName: 'Lucius Fox',
            designation: 'CTO',
            email: 'lucius@wayneent.com',
            phone: '312-555-0187',
            roleType: 'Decision Maker',
            isPrimary: true,
        });

        // 4. Create Leads
        const lead1 = await Lead.create({
            leadName: 'Oscorp Bio-Tech Solution',
            companyName: 'Oscorp Corp',
            email: 'sales@oscorp.org',
            phone: '718-555-0155',
            leadSource: 'Website',
            estimatedValue: 45000,
            status: 'Qualified',
            assignedTo: exec1._id,
        });

        const lead2 = await Lead.create({
            leadName: 'Cyberdyne Systems AI',
            companyName: 'Cyberdyne Inc',
            email: 'contact@cyberdyne.tech',
            phone: '415-555-0122',
            leadSource: 'Referral',
            estimatedValue: 85000,
            status: 'Contacted',
            assignedTo: exec2._id,
        });

        // 5. Create Opportunities for Kanban Board
        await Opportunity.create({
            opportunityName: 'Stark Industries Cloud Expansion',
            customerId: cust1._id,
            stage: 'Negotiation',
            expectedRevenue: 120000,
            probability: 75,
            expectedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
            ownerId: exec1._id,
        });

        await Opportunity.create({
            opportunityName: 'Wayne Security Software Suite',
            customerId: cust2._id,
            stage: 'Closed Won',
            expectedRevenue: 95000,
            probability: 100,
            expectedCloseDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            ownerId: exec2._id,
            isReadOnly: true,
        });

        await Opportunity.create({
            opportunityName: 'Stark Robotics Consulting',
            customerId: cust1._id,
            stage: 'Proposal',
            expectedRevenue: 60000,
            probability: 50,
            expectedCloseDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
            ownerId: exec1._id,
        });

        // 6. Create Tasks
        await Task.create({
            title: 'Prepare Proposal Document for Stark Expansion',
            description: 'Draft standard scope of work and pricing schedule for cloud migration.',
            relatedType: 'Customer',
            relatedId: cust1._id,
            assignedTo: exec1._id,
            createdBy: manager1._id,
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            priority: 'High',
            status: 'In Progress',
        });

        await Task.create({
            title: 'Follow-up Call with Wayne Tech Lead',
            description: 'Check post-deployment system stability and feedback.',
            relatedType: 'Customer',
            relatedId: cust2._id,
            assignedTo: exec2._id,
            createdBy: exec2._id,
            dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
            priority: 'Medium',
            status: 'Open',
        });

        // 7. Create Activities
        await Activity.create({
            activityType: 'Call',
            subject: 'Q3 Contract Renewal Discussion',
            relatedType: 'Customer',
            relatedId: cust1._id,
            durationMinutes: 30,
            notes: 'Discussed volume discounts and licensing terms with Pepper Potts.',
            followUpRequired: true,
            createdBy: exec1._id,
        });

        await Activity.create({
            activityType: 'Meeting',
            subject: 'Technical Architecture Review',
            relatedType: 'Customer',
            relatedId: cust2._id,
            durationMinutes: 45,
            notes: 'Reviewed cloud compliance and data retention standards.',
            followUpRequired: false,
            createdBy: exec2._id,
        });

        // 8. Create Notifications
        await Notification.create({
            userId: exec1._id,
            eventType: 'LEAD_ASSIGNED',
            message: `New Lead 'Oscorp Bio-Tech Solution' assigned to you by ${manager1.fullName}.`,
            relatedType: 'Lead',
            relatedId: lead1._id,
        });

        await Notification.create({
            userId: exec2._id,
            eventType: 'TASK_ASSIGNED',
            message: `Task 'Follow-up Call with Wayne Tech Lead' was assigned to you.`,
            relatedType: 'Task',
        });

        console.log('[Seeder]: Database successfully populated with realistic demo data!');
        process.exit(0);
    } catch (error) {
        console.error('[Seeder Error]:', error);
        process.exit(1);
    }
};

seedDatabase();