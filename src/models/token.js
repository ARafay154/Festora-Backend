const mongoose = require('mongoose');

const tokenSchema = new mongoose.Schema({
    user_id: {
        type: String,  // Changed from ObjectId to String to match user.id field
        ref: 'User',
        required: [true, 'User ID is required'],
        validate: {
            validator: function(v) {
                return v && v.startsWith('usr_'); // Ensure it's a valid user ID format
            },
            message: 'Invalid user ID format'
        }
    },
    token: {
        type: String,
        required: [true, 'Token is required'],
        minlength: [100, 'Token too short'],
        maxlength: [500, 'Token too long']
    },
    expiresAt: {
        type: Date,
        required: [true, 'Expiration date is required'],
        validate: {
            validator: function(v) {
                return v > new Date(); // Token must not be expired
            },
            message: 'Token expiration date must be in the future'
        }
    },
    ipAddress: {
        type: String,
        required: false,
        match: [/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9a-fA-F:]+$/, 'Invalid IP address format']
    },
    userAgent: {
        type: String,
        required: false,
        maxlength: [500, 'User agent too long']
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for better performance and security
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired tokens
tokenSchema.index({ user_id: 1 }); // Fast user token lookups
tokenSchema.index({ token: 1 }, { unique: true }); // Fast token lookups

// Virtual for checking if token is expired
tokenSchema.virtual('isExpired').get(function() {
    return this.expiresAt < new Date();
});

// Pre-save middleware to validate data
tokenSchema.pre('save', function(next) {
    // Ensure token is not expired when saving
    if (this.expiresAt <= new Date()) {
        return next(new Error('Cannot save expired token'));
    }
    
    // Ensure user exists
    if (this.user_id) {
        const User = mongoose.model('User');
        User.findOne({ id: this.user_id })
            .then(user => {
                if (!user) {
                    next(new Error('User not found'));
                } else {
                    next();
                }
            })
            .catch(next);
    } else {
        next();
    }
});

// Static method to clean expired tokens
tokenSchema.statics.cleanExpired = function() {
    return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

module.exports = mongoose.model('Token', tokenSchema);