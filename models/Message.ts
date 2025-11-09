import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  subject: string;
  content: string;
  status: 'unread' | 'read' | 'replied';
  priority: 'low' | 'medium' | 'high';
  carId?: mongoose.Types.ObjectId;
  conversation: Array<{
    sender: 'user' | 'admin';
    content: string;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied'],
    default: 'unread'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  carId: {
    type: Schema.Types.ObjectId,
    ref: 'Car',
    required: false
  },
  conversation: [{
    sender: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

messageSchema.index({ userId: 1, createdAt: -1 });
messageSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IMessage>('Message', messageSchema);