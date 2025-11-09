import { Router } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { authenticate } from "../middleware/auth";

const router = Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || 'demo',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'demo',
});

// Check if Cloudinary is properly configured
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.warn('Cloudinary environment variables not set. Using mock upload.');
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/upload/images - Upload multiple images to Cloudinary
router.post("/images", authenticate, upload.array('images', 10), async (req: any, res) => {
  try {
    console.log('Upload request received');
    console.log('Files:', req.files?.length || 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images provided" });
    }

    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.log('Using mock upload - Cloudinary not configured');
      // Return mock URLs for development
      const mockUrls = req.files.map((_: any, index: number) => 
        `https://via.placeholder.com/800x600/1B3F79/FFFFFF?text=Car+Image+${index + 1}`
      );
      return res.json({
        message: "Images uploaded successfully (mock)",
        urls: mockUrls
      });
    }

    const uploadPromises = req.files.map((file: Express.Multer.File) => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            folder: "swoosh-cars",
            transformation: [
              { width: 1200, height: 800, crop: "limit" },
              { quality: "auto" },
              { format: "auto" }
            ]
          },
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              resolve(result?.secure_url);
            }
          }
        ).end(file.buffer);
      });
    });

    const urls = await Promise.all(uploadPromises);
    
    res.json({
      message: "Images uploaded successfully",
      urls: urls.filter(url => url) // Filter out any failed uploads
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

export default router;