import { Router } from "express";
import Message from "../models/Message";
import { authenticate } from "../middleware/auth";
import { getIO } from "../socket";

const router = Router();

// Get all messages for admin
router.get("/admin", authenticate, async (req, res) => {
  try {
    const messages = await Message.find()
      .populate('carId', 'make model year price')
      .sort({ createdAt: -1 });
    
    const formattedMessages = messages.map(msg => ({
      _id: msg._id,
      customerName: msg.userName,
      customerEmail: msg.userEmail,
      carId: msg.carId?._id,
      carDetails: msg.carId ? {
        make: (msg.carId as any).make,
        model: (msg.carId as any).model,
        year: (msg.carId as any).year,
        price: (msg.carId as any).price
      } : null,
      subject: msg.subject,
      lastMessage: msg.conversation.length > 0 
        ? msg.conversation[msg.conversation.length - 1].content 
        : msg.content,
      timestamp: msg.updatedAt,
      status: msg.status,
      priority: msg.priority,
      messages: msg.conversation.map(conv => ({
        sender: conv.sender === 'admin' ? 'vendor' : 'customer',
        content: conv.content,
        timestamp: conv.timestamp
      }))
    }));
    
    res.json(formattedMessages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send message from user
router.post("/", authenticate, async (req, res) => {
  try {
    const { subject, content, carId } = req.body;
    const userId = (req as any).user.id;
    const userName = (req as any).user.name;
    const userEmail = (req as any).user.email;

    const message = new Message({
      userId,
      userName,
      userEmail,
      subject,
      content,
      carId,
      conversation: [{
        sender: 'user',
        content,
        timestamp: new Date()
      }]
    });

    await message.save();
    await message.populate('carId', 'make model year price');

    // Emit to all admin users
    const io = getIO();
    io.emit('newMessage', {
      _id: message._id,
      customerName: message.userName,
      customerEmail: message.userEmail,
      subject: message.subject,
      content: message.content,
      carDetails: message.carId,
      timestamp: message.createdAt,
      status: message.status
    });

    res.status(201).json({ message: 'Message sent successfully', id: message._id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Reply to message (admin)
router.post("/:id/reply", authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.conversation.push({
      sender: 'admin',
      content,
      timestamp: new Date()
    });
    message.status = 'replied';
    message.updatedAt = new Date();

    await message.save();
    await message.populate('carId', 'make model year price');

    // Emit to specific user
    const io = getIO();
    console.log(`Sending messageReply to user_${message.userId}`);
    io.to(`user_${message.userId}`).emit('messageReply', {
      messageId: message._id,
      content,
      timestamp: new Date()
    });

    const formattedMessage = {
      _id: message._id,
      customerName: message.userName,
      customerEmail: message.userEmail,
      carId: message.carId?._id,
      carDetails: message.carId ? {
        make: (message.carId as any).make,
        model: (message.carId as any).model,
        year: (message.carId as any).year,
        price: (message.carId as any).price
      } : null,
      subject: message.subject,
      lastMessage: content,
      timestamp: message.updatedAt,
      status: message.status,
      priority: message.priority,
      messages: message.conversation.map(conv => ({
        sender: conv.sender === 'admin' ? 'vendor' : 'customer',
        content: conv.content,
        timestamp: conv.timestamp
      }))
    };

    res.json(formattedMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Update message status
router.patch("/:id/status", authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const messageId = req.params.id;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Reply to message (user)
router.post("/:id/user-reply", authenticate, async (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.id;
    const userId = (req as any).user.id;

    const message = await Message.findOne({ _id: messageId, userId });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    message.conversation.push({
      sender: 'user',
      content,
      timestamp: new Date()
    });
    message.status = 'read';
    message.updatedAt = new Date();

    await message.save();

    // Emit to admins
    const io = getIO();
    io.emit('newMessage', {
      _id: message._id,
      customerName: message.userName,
      customerEmail: message.userEmail,
      subject: message.subject,
      content,
      timestamp: new Date(),
      status: message.status
    });

    res.json({ message: 'Reply sent successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

// Get user's messages
router.get("/user", authenticate, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const messages = await Message.find({ userId })
      .populate('carId', 'make model year price images')
      .sort({ updatedAt: -1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

export default router;
