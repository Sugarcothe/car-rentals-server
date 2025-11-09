import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import User from "../models/User";
import { authenticate } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(10),
  role: z.enum(['user', 'vendor']).default('user')
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

router.post("/register", async (req, res) => {
  try {
    console.log('Register request body:', req.body);
    const { name, email, password, phone, role } = registerSchema.parse(req.body);
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      role
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: "User registered successfully",
      token,
      user
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/me", authenticate, (req: any, res) => {
  res.json({ user: req.user });
});

export default router;
