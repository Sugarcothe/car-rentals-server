import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  phone: { type: String, required: true },
  role: { type: String, enum: ['user', 'vendor'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  avatar: { type: String },
  location: { type: String },
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  responseTime: { type: String, default: 'Usually responds within 24 hours' },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Hide password when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

export default mongoose.model('User', userSchema);