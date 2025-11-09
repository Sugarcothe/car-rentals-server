import { Router } from "express";
import { z } from "zod";
import Car from "../models/Car";
import { authenticate } from "../middleware/auth";
import { getIO } from "../socket";
import { SearchService } from "../services/searchService";
import { NotificationService } from "../services/notificationService";
import { VendorNotificationService } from "../services/vendorNotificationService";

const router = Router();

// Validation schemas
const carCreateSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().min(1900).max(new Date().getFullYear() + 1),
  price: z.number().positive(),
  mileage: z.number().min(0),
  condition: z.enum(['new', 'used', 'certified']),
  fuelType: z.enum(['gasoline', 'diesel', 'hybrid', 'electric', 'plugin-hybrid']),
  transmission: z.enum(['manual', 'automatic', 'cvt']),
  bodyType: z.enum(['sedan', 'suv', 'hatchback', 'coupe', 'convertible', 'wagon', 'truck', 'van']),
  exteriorColor: z.string().min(1),
  location: z.object({
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().optional()
  }),
  description: z.string().min(10),
  images: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional(),
    isPrimary: z.boolean().optional()
  })).optional(),
  features: z.array(z.string()).optional(),
  
  // Engine & Performance
  enginePerformance: z.object({
    engine: z.string().optional(),
    horsepower: z.number().optional(),
    torque: z.number().optional(),
    drivetrain: z.enum(['fwd', 'rwd', 'awd', '4wd']).optional(),
    fuelEconomy: z.object({
      city: z.number().optional(),
      highway: z.number().optional(),
      combined: z.number().optional()
    }).optional()
  }).optional(),
  
  // Vehicle Details
  vehicleDetails: z.object({
    seating: z.number().min(1).max(8).optional(),
    doors: z.number().min(2).max(5).optional(),
    exteriorColor: z.string().min(1),
    interiorColor: z.string().optional()
  }).optional(),
  
  // Ownership History
  ownershipHistory: z.object({
    vin: z.string().optional(),
    previousOwners: z.number().min(1).optional(),
    ownershipType: z.enum(['personal', 'fleet', 'rental', 'lease-return', 'government', 'taxi-uber']).optional(),
    titleStatus: z.enum(['clean', 'salvage', 'flood', 'lemon', 'rebuilt', 'other']).optional()
  }).optional(),
  
  // Warranty & Protection
  warrantyProtection: z.object({
    warranty: z.object({
      type: z.enum(['none', 'manufacturer', 'extended', 'dealer', 'third-party']).optional(),
      duration: z.string().optional()
    }).optional()
  }).optional()
});

const carUpdateSchema = carCreateSchema.partial();

// GET /api/cars/search - Advanced search
router.get("/search", async (req, res) => {
  try {
    const result = await SearchService.advancedSearch(req.query, {
      page: req.query.page,
      limit: req.query.limit,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: "Search error", error: error.message });
  }
});

// GET /api/cars/suggestions - Search suggestions
router.get("/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json({ makes: [], models: [], cars: [] });
    }
    
    const suggestions = await SearchService.getSearchSuggestions(q);
    res.json(suggestions);
  } catch (error: any) {
    res.status(500).json({ message: "Error getting suggestions", error: error.message });
  }
});

// GET /api/cars/popular - Popular searches and trending
router.get("/popular", async (req, res) => {
  try {
    const popular = await SearchService.getPopularSearches();
    res.json(popular);
  } catch (error: any) {
    res.status(500).json({ message: "Error getting popular searches", error: error.message });
  }
});

// GET /api/cars/market-analysis - Market analysis
router.get("/market-analysis", async (req, res) => {
  try {
    const { make, model } = req.query;
    const analysis = await SearchService.getMarketAnalysis(
      make as string,
      model as string
    );
    res.json(analysis);
  } catch (error: any) {
    res.status(500).json({ message: "Error getting market analysis", error: error.message });
  }
});

// GET /api/cars/vendor - Get vendor's cars
router.get("/vendor", authenticate, async (req: any, res) => {
  try {
    console.log('Fetching cars for vendor:', req.user.id);
    
    const cars = await Car.find({ seller: req.user.id })
      .sort({ listedAt: -1 })
      .lean();
    
    console.log('Found cars:', cars.length);
    res.json(cars);
  } catch (error: any) {
    console.error('Vendor cars fetch error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/cars - List cars with filtering and pagination
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      make,
      model,
      minPrice,
      maxPrice,
      minYear,
      maxYear,
      maxMileage,
      condition,
      fuelType,
      transmission,
      bodyType,
      city,
      state,
      search,
      sortBy = 'listedAt',
      sortOrder = 'desc',
      featured
    } = req.query;

    // Build filter object
    const filter: any = { status: 'active' };
    
    if (make) filter.make = new RegExp(make as string, 'i');
    if (model) filter.model = new RegExp(model as string, 'i');
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (minYear || maxYear) {
      filter.year = {};
      if (minYear) filter.year.$gte = Number(minYear);
      if (maxYear) filter.year.$lte = Number(maxYear);
    }
    if (maxMileage) filter.mileage = { $lte: Number(maxMileage) };
    if (condition) filter.condition = condition;
    if (fuelType) filter.fuelType = fuelType;
    if (transmission) filter.transmission = transmission;
    if (bodyType) filter.bodyType = bodyType;
    if (city) filter['location.city'] = new RegExp(city as string, 'i');
    if (state) filter['location.state'] = new RegExp(state as string, 'i');
    if (featured === 'true') filter.featured = true;
    
    // Text search
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Sort options
    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;
    
    // If sorting by relevance and there's a search, add text score
    if (search && sortBy === 'relevance') {
      sortOptions.score = { $meta: 'textScore' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    
    const [cars, total] = await Promise.all([
      Car.find(filter)
        .populate('seller', 'name email phone sellerType')
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Car.countDocuments(filter)
    ]);

    res.json({
      cars,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      },
      filters: {
        makes: await Car.distinct('make', { status: 'active' }),
        bodyTypes: await Car.distinct('bodyType', { status: 'active' }),
        fuelTypes: await Car.distinct('fuelType', { status: 'active' })
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/cars/:id - Get single car
router.get("/:id", async (req, res) => {
  try {
    const car = await Car.findById(req.params.id)
      .populate('seller', 'name email phone sellerType')
      .lean();
    
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    // Increment view count
    await Car.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    
    // Get similar cars using search service
    const similarCars = await SearchService.getSimilarCars(req.params.id, 4);

    res.json({ car, similarCars });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/cars - Create new car listing
router.post("/", authenticate, async (req: any, res) => {
  try {
    const {
      make,
      model,
      year,
      price,
      mileage,
      location,
      condition,
      fuelType,
      transmission,
      bodyType,
      exteriorColor,
      description,
      features,
      images,
      color
    } = req.body;

    console.log('Received form data:', req.body);
    console.log('Images array:', images);

    // Validate images array
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "At least one image is required" });
    }

    // Use images as-is since frontend already formats them correctly
    console.log('Using images as provided:', images);

    const car = new Car({
      make,
      model,
      year: parseInt(year),
      price: parseFloat(price),
      mileage: parseInt(mileage),
      condition: condition.toLowerCase() === 'excellent' ? 'used' : condition.toLowerCase(),
      fuelType: fuelType.toLowerCase().replace(' ', '-'),
      transmission: transmission.toLowerCase(),
      bodyType: bodyType.toLowerCase(),
      exteriorColor: exteriorColor || color || 'Not specified',
      location: {
        city: location.city || location,
        state: location.state || 'Unknown',
        zipCode: location.zipCode
      },
      description,
      features: features || [],
      images: images,
      seller: req.user.id,
      sellerType: req.user.role === 'vendor' ? 'dealer' : 'private',
      originalPrice: parseFloat(price),
      priceHistory: [{ price: parseFloat(price) }]
    });

    await car.save();
    await car.populate('seller', 'name email phone');

    // Send real-time notifications
    await NotificationService.notifyNewListing(car.toObject());

    res.status(201).json({ message: "Car listed successfully", car });
  } catch (error: any) {
    console.error('Car creation error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PUT /api/cars/:id - Update car listing
router.put("/:id", authenticate, async (req: any, res) => {
  try {
    const car = await Car.findById(req.params.id);
    
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    
    if (car.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    console.log('Update request body:', req.body);
    
    // Skip validation for now to debug
    const updateData = req.body;
    
    // Track price changes
    if (updateData.price && updateData.price !== car.price) {
      const oldPrice = car.price;
      if (!car.priceHistory) car.priceHistory = [];
      car.priceHistory.push({ price: updateData.price });
      
      // Notify about price change
      await NotificationService.notifyPriceChange(car._id.toString(), oldPrice, updateData.price);
    }

    Object.assign(car, updateData);
    await car.save();
    await car.populate('seller', 'name email phone');

    res.json({ message: "Car updated successfully", car });
  } catch (error: any) {
    console.error('Car update error:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE /api/cars/:id - Delete car listing
router.delete("/:id", authenticate, async (req: any, res) => {
  try {
    const car = await Car.findById(req.params.id);
    
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    
    if (car.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await Car.findByIdAndDelete(req.params.id);
    
    // Emit deletion event
    const io = getIO();
    io.emit('carDeleted', {
      carId: car._id,
      message: `${car.year} ${car.make} ${car.model} listing removed`
    });

    res.json({ message: "Car listing deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/cars/:id/favorite - Toggle favorite
router.post("/:id/favorite", authenticate, async (req: any, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    await Car.findByIdAndUpdate(req.params.id, { $inc: { favorites: 1 } });
    res.json({ message: "Car favorited" });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /api/cars/:id/inquiry - Track inquiry
router.post("/:id/inquiry", authenticate, async (req: any, res) => {
  try {
    const car = await Car.findById(req.params.id);
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }

    await Car.findByIdAndUpdate(req.params.id, { $inc: { inquiries: 1 } });
    
    // Notify seller about inquiry
    await NotificationService.notifyInquiry(car._id.toString(), req.user.name);
    await VendorNotificationService.notifyNewInquiry(car.seller.toString(), car._id.toString(), req.user.name);
    
    // Check for performance milestones
    const updatedCar = await Car.findById(req.params.id).lean();
    if (updatedCar) {
      if (updatedCar.inquiries === 5) {
        await VendorNotificationService.notifyPerformanceMilestone(
          car.seller.toString(),
          car._id.toString(),
          'multiple_inquiries'
        );
      }
    }

    res.json({ message: "Inquiry recorded" });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// PATCH /api/cars/:id/status - Update car status
router.patch("/:id/status", authenticate, async (req: any, res) => {
  try {
    const car = await Car.findById(req.params.id);
    
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    
    if (car.seller.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { status } = req.body;
    if (!['active', 'inactive', 'sold', 'pending'].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    car.status = status;
    await car.save();

    res.json({ message: "Status updated successfully", car });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /api/cars/stats/overview - Get market stats
router.get("/stats/overview", async (_req, res) => {
  try {
    const [totalActive, avgPrice, popularMakes, recentListings] = await Promise.all([
      Car.countDocuments({ status: 'active' }),
      Car.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, avgPrice: { $avg: '$price' } } }
      ]),
      Car.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]),
      Car.find({ status: 'active' })
        .sort({ listedAt: -1 })
        .limit(5)
        .populate('seller', 'name')
        .lean()
    ]);

    res.json({
      totalActive,
      avgPrice: avgPrice[0]?.avgPrice || 0,
      popularMakes,
      recentListings
    });
  } catch (error: any) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
