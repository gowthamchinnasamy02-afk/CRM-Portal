const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Task Title is mandatory'],
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        relatedType: {
            type: String,
            enum: ['Customer', 'Lead', 'Opportunity', 'None'],
            default: 'None',
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Assignee is mandatory'],
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        dueDate: {
            type: Date,
            required: [true, 'Due Date is mandatory'],
        },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High'],
            default: 'Medium',
        },
        status: {
            type: String,
            enum: ['Open', 'In Progress', 'Completed', 'Overdue'],
            default: 'Open',
        },
        completedAt: {
            type: Date,
            default: null,
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

taskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);