const Activity = require('../models/Activity');
const Task = require('../models/Task');
const { logAuditEvent } = require('../middleware/audit');


exports.getActivities = async (req, res, next) => {
    try {
        const query = {};

        if (req.query.relatedType && req.query.relatedId) {
            query.relatedType = req.query.relatedId;
            query.relatedId = req.query.relatedId;
        } else if (req.user.role === "Sales Executive") {
            query.createdBy = req.user._id;
        }

        if (req.query.activityType) query.activityType = req.query.activityType;

        const activities = await Activity.find(query)
          .sort({ dateTime: -1 })
          .populate('createdBy', 'fullName email')
          .populate('linkedTaskId', 'title status dueDate');

        res.json ({ success: true, count: activities.length, data: activities });
    } catch (error) {
        next(error);
    }
};


exports.logActivity = async (req, res, next) => {
    try {
        const { activityType, subject, relatedType, relatedId, dateTime ,durationMinutes, notes, followUpRequired, followUpDueDate } = req.body;

        if (!activityType || !subject || !relatedType || !relatedId) {
            return res.status(400).json({ success: false, message: 'Activity Type, Subject, Related Record Type, and Related Record ID are mandatory.', });
        }

        let linkedTaskId = null;

        if (followUpRequired) {
            const dueDate = followUpDueDate ? new Date(followUpDueDate) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
            const task = await Task.create({
                title: `Follow-up for ${subject}`,
                description: `Follow-up generated from ${activityType} activity notes: ${notes || 'No additional notes'}`,
                relatedType,
                relatedId,
                assignedTo: req.user._id,
                createdBy: req.user._id,
                dueDate,
                priority: 'High',
                status: 'Open',
            });
            linkedTaskId = task._id;
        }

        const activity = await Activity.create({
            activityType,
            subject,
            relatedType,
            relatedId,
            linkedTaskId,
            dateTime: dateTime || new Date(),
            durationMinutes: durationMinutes || 15,
            notes: notes || '',
            followUpRequired: !!followUpRequired,
            createdBy: req.user._id,
        });

        await logAuditEvent({
            req,
            action: 'LOG_ACTIVITY',
            entity: 'Activity',
            entityId: activity._id,
            details: { type : activityType, subject, followUpRequired: !!followUpRequired },
        });

        res.status(201).json({ success: true, data: activity });
    } catch (error) {
        next(error);
    }
};


exports.updateActivity = async (req, res, next) => {
    try {
        const activity = await Activity.findById(req.params.id);
    
    if (!activity) {
        return res.status(404).json({ success: false, message: 'Activity not found' });
    }

    const ageInHours = (Date.now() - new Date(activity.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageInHours > 24 && req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Activities become read-only 24 hours after creation. Only an Admin can make corrections to preserve audit integrity.',
      });
    }

    const { subject, durationMinutes, notes, followUpRequired } = req.body;

    if (subject) activity.subject = subject;
    if (durationMinutes !== undefined) activity.durationMinutes = durationMinutes;
    if (notes !== undefined) activity.notes = notes;
    if (followUpRequired !== undefined) activity.followUpRequired = followUpRequired;

    await activity.save();

    await logAuditEvent({
        req,
        action: 'UPDATE_ACTIVITY',
        entity: 'Activity',
        entityId: activity._id,
    });

    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
};

