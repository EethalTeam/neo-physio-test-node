const mongoose = require('mongoose');

const LinkSchema = new mongoose.Schema({
  key: { 
    type: String, 
    required: true, 
    unique: true, // Prevents duplicates at the DB level
    length: 6 
  },
  isExpired: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 86400 // Optional: Auto-delete after 24 hours
  }
});

module.exports = mongoose.model('Link', LinkSchema);