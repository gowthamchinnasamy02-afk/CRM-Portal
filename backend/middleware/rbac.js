const User = require('../models/User');

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: `User role '${req.user ? req.user.role : 'Guest'}' is not authorized to perform this action.`,
            });
        }
        next();
    };
};

const getScopedQuery = async (req, ownerField = 'ownerId') => {
    const user = req.user;

    if (user.role === 'Admin') {
        return {};
    }

    if (user.role === 'Sales Manager') {
        const teamMembers = await User.find({ reportsTo: user._id }).select('_id');
        const teamIds = teamMembers.map((m) => m._id);
        teamIds.push(user._id);
        
        return { [ownerField]: { $in: teamIds } };
    }
    
    return { [ownerField]: user._id };
};

module.exports = { authorize, getScopedQuery };