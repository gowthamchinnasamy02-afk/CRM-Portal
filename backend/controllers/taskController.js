const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { logAuditEvent } = require('../middleware/audit');
const { getScopedQuery } = require('../middleware/rbac');


const checkAndFlagOverdueTasks = async (query) => {
    const now = new Date();
    await Task.updateMany(
        { ...query, status: { $in: ['Open', 'In Progress'] }, dueDate: { $lt: now } },
        { $set: { status: 'Overdue' } }
    );
};


exports.getTasks = async (req, res, next) => {
    try {
        const scopedCriteria = await getScopedQuery(req, 'assignedTo');
        const query = { ...scopedCriteria, isDeleted: false };

        await checkAndFlagOverdueTasks(query);

        if (req.query.status) query.status = req.query.status;
        if (req.query.priority) query.priority = req.query.priority;
        if (req.query.assignedTo) query.assignedTo = req.query.assignedTo;
        if (req.query.relatedType) query.relatedType = req.query.relatedType;
        if (req.query.relatedId) query.relatedId = req.query.relatedId;

        const tasks = await Task.find(query)
            .populate('assignedTo', 'fullName email')
            .populate('createdBy', 'fullName email')
            .sort({ status: 1, dueDate: 1 });

        res.json({ success: true, count: tasks.length, data: tasks });
    } catch (error) {
        next(error);
    }
};

exports.createTask = async (req, res, next) => {
    try {
        const { title, description, relatedType, relatedId, assignedTo, dueDate, priority } = req.body;

        if (!title || !dueDate) {
            return res.status(400).json({ success: false, message: 'Task Title and Due Date are mandatory.' });
        }

        const due = new Date(dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (due < today) {
            return res.status(400).json({ success: false, message: 'Due Date cannot be earlier than today at creation.' });
        }

        const assignee = assignedTo || req.user._id;

        const task = await Task.create({
            title,
            description: description || '',
            relatedType: relatedType || 'None',
            relatedId: relatedId || null,
            assignedTo: assignee,
            createdBy: req.user._id,
            dueDate: due,
            priority: priority || 'Medium',
            status: 'Open',
        });

        if (assignee.toString() !== req.user._id.toString()) {
        await Notification.create({
            userId: assignee,
            eventType: 'TASK_ASSIGNED',
            message: `Task '${task.title}' assigned to you by ${req.user.fullName}. Due: ${due.toLocaleDateString()}`,
            relatedType: 'Task',
            relatedId: task._id,
        });
        }

        await logAuditEvent({
            req,
            action: 'CREATE_TASK',
            entity: 'Task',
            entityId: task._id,
            details: { title: task.title, assignedTo: assignee },
        });

        res.status(201).json({ success: true, data: task });
    } catch (error) {
        next(error);
    }
};

exports.updateTask = async (req, res, next) => {
    try {
        const { title, description, assignedTo, dueDate, priority, status } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task || task.isDeleted) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        if (status === 'Completed' && task.status !== 'Completed') {
            const isAssignee = task.assignedTo.toString() === req.user._id.toString();
            const isCreator = task.createdBy.toString() === req.user._id.toString();
            const isManagerOrAdmin = ['Admin', 'Sales Manager'].includes(req.user.role);

            if (!isAssignee && !isCreator && !isManagerOrAdmin) {
                return res.status(403).json({
                    success: false,
                    message: 'Only the assignee, creator, or Sales Manager/Admin may mark a task complete.',
                });
            }

            task.status = 'Completed';
            task.completedAt = new Date();

            if (task.createdBy.toString() !== req.user._id.toString()) {
                await Notification.create({
                    userId: task.createdBy,
                    eventType: 'TASK_COMPLETED',
                    message: `Task '${task.title}' was completed by ${req.user.fullName}.`,
                    relatedType: 'Task',
                    relatedId: task._id,
                });
            }
        } else if (status) {
            task.status = status;
        }

        if (assignedTo && assignedTo.toString() !== task.assignedTo.toString()) {
            const prevAssignee = task.assignedTo;
            task.assignedTo = assignedTo;

            await Notification.create({
                userId: assignedTo,
                eventType: 'TASK_ASSIGNED',
                message: `Task '${task.title}' has been reassigned to you by ${req.user.fullName}.`,
                relatedType: 'Task',
                relatedId: task._id,
            });

            await Notification.create({
                userId: prevAssignee,
                eventType: 'TASK_REASSIGNED',
                message: `Task '${task.title}' was reassigned away from you.`,
                relatedType: 'Task',
                relatedId: task._id,
            });
        }

        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (dueDate) task.dueDate = new Date(dueDate);
        if (priority) task.priority = priority;

        await task.save();

        await logAuditEvent({
            req,
            action: 'UPDATE_TASK',
            entity: 'Task',
            entityId: task._id,
            details: { status: task.status, priority: task.priority },
        });

        res.json({ success: true, data: task });
    } catch (error) {
        next(error);
    }
};

exports.deleteTask = async (req, res, next) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task || task.isDeleted) {
            return res.status(404).json({ success: false, message: 'Task not found.' });
        }

        task.isDeleted = true;
        await task.save();

        await logAuditEvent({
            req,
            action: 'SOFT_DELETE_TASK',
            entity: 'Task',
            entityId: task._id,
        });

        res.json({ success: true, message: 'Task archived successfully.' });
    } catch (error) {
        next(error);
    }
};