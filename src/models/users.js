const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        default: () => 'usr_' + Math.random().toString(36).substr(2, 9)
    },
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [2, 'Name must be at least 2 characters long'],
        maxlength: [50, 'Name cannot exceed 50 characters'],
        match: [/^[a-zA-Z\s]+$/, 'Name can only contain letters and spaces']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true,
        trim: true,
        match: [
            /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            'Please enter a valid email address'
        ]
    },
    passwordHash: {
        type: String,
        required: [true, 'Password hash is required'],
        minlength: [60, 'Invalid password hash format']
    },
    phone: {
        type: String,
        required: [true, 'Phone number is required'],
        match: [
            /^\+[1-9]\d{1,14}$/,
            'Please enter a valid phone number with country code (e.g., +11234567890)'
        ]
    },
    country: {
        type: String,
        required: [true, 'Country is required'],
        trim: true,
        minlength: [2, 'Country must be at least 2 characters long'],
        maxlength: [50, 'Country cannot exceed 50 characters']
    },
    city: {
        type: String,
        required: [true, 'City is required'],
        trim: true,
        minlength: [2, 'City must be at least 2 characters long'],
        maxlength: [50, 'City cannot exceed 50 characters']
    },
    preferences: {
        type: [String],
        default: [],
        validate: {
            validator: function(v) {
                return v.length <= 20; // Maximum 20 preferences
            },
            message: 'Cannot have more than 20 preferences'
        }
    },
    favoriteArtists: {
        type: [String],
        default: [],
        validate: {
            validator: function(v) {
                return v.length <= 100; // Maximum 100 favorite artists
            },
            message: 'Cannot have more than 100 favorite artists'
        }
    },
    favoriteVenues: {
        type: [String],
        default: [],
        validate: {
            validator: function(v) {
                return v.length <= 100; // Maximum 100 favorite venues
            },
            message: 'Cannot have more than 100 favorite venues'
        }
    },
    profileComplete: {
        type: Boolean,
        default: false
    },
    accountVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // This will automatically add createdAt and updatedAt
});

// Indexes for better performance and security
userSchema.index({ email: 1 }, { unique: true }); // Fast email lookups for login
userSchema.index({ id: 1 }, { unique: true });    // Fast ID lookups
userSchema.index({ phone: 1 }, { unique: true }); // Fast phone lookups for uniqueness checks

// Pre-save middleware to validate data
userSchema.pre('save', function(next) {
    // Ensure phone number is unique
    if (this.isModified('phone')) {
        this.constructor.findOne({ phone: this.phone, _id: { $ne: this._id } })
            .then(existingUser => {
                if (existingUser) {
                    next(new Error('Phone number already exists'));
                } else {
                    next();
                }
            })
            .catch(next);
    } else {
        next();
    }
});

module.exports = mongoose.model('User', userSchema);