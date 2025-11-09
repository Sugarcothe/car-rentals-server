import { Router } from "express";
import { z } from "zod";
import Car from "../models/Car";
import User from "../models/User";
import { authenticate } from "../middleware/auth";
import { getIO } from "../socket";
import { VendorAnalyticsService } from "../services/vendorAnalyticsService";

const router = Router();

// Middleware to ensure user is a vendor
const requireVendor = (req: any, res: any, next: any) => {
  if (req.user.role !== 'vendor') {
    return res.status(403).json({ message: "Vendor access required" });
  }
  next();
};

// GET /api/vendors/dashboard - Vendor dashboard overview
router.get("/dashboard", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [overview, recentActivity, topPerforming, lowPerforming] = await Promise.all([
      // Overview stats
      Car.aggregate([
        { $match: { seller: vendorId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalValue: { $sum: '$price' },
            avgPrice: { $avg: '$price' },
            totalViews: { $sum: '$views' },
            totalInquiries: { $sum: '$inquiries' }
          }
        }
      ]),

      // Recent activity (last 7 days)
      Car.aggregate([
        {
          $match: {
            seller: vendorId,
            $or: [
              { listedAt: { $gte: sevenDaysAgo } },
              { lastUpdated: { $gte: sevenDaysAgo } },
              { soldAt: { $gte: sevenDaysAgo } }
            ]
          }
        },
        {
          $project: {
            make: 1,
            model: 1,
            year: 1,
            price: 1,
            status: 1,
            views: 1,
            inquiries: 1,
            listedAt: 1,
            lastUpdated: 1,
            soldAt: 1
          }
        },
        { $sort: { lastUpdated: -1 } },
        { $limit: 10 }
      ]),

      // Top performing cars (most views/inquiries)
      Car.find({ seller: vendorId, status: 'active' })
        .sort({ views: -1, inquiries: -1 })
        .limit(5)
        .select('make model year price views inquiries listedAt')
        .lean(),

      // Low performing cars (least views, old listings)
      Car.find({
        seller: vendorId,
        status: 'active',
        listedAt: { $lte: thirtyDaysAgo },
        views: { $lte: 10 }
      })
        .sort({ views: 1, listedAt: 1 })
        .limit(5)
        .select('make model year price views inquiries listedAt')
        .lean()
    ]);

    // Process overview data
    const stats = {
      active: 0,
      sold: 0,
      pending: 0,
      inactive: 0,
      totalValue: 0,
      avgPrice: 0,
      totalViews: 0,
      totalInquiries: 0
    };

    overview.forEach(item => {
      stats[item._id as keyof typeof stats] = item.count;
      stats.totalValue += item.totalValue || 0;
      stats.totalViews += item.totalViews || 0;
      stats.totalInquiries += item.totalInquiries || 0;
    });

    const totalCars = stats.active + stats.sold + stats.pending + stats.inactive;
    stats.avgPrice = totalCars > 0 ? stats.totalValue / totalCars : 0;

    res.json({
      stats,
      recentActivity,
      topPerforming,
      lowPerforming,
      insights: {
        conversionRate: stats.totalInquiries > 0 ? (stats.sold / stats.totalInquiries * 100).toFixed(1) : '0',
        avgViewsPerCar: totalCars > 0 ? Math.round(stats.totalViews / totalCars) : 0,
        avgInquiriesPerCar: totalCars > 0 ? Math.round(stats.totalInquiries / totalCars) : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Dashboard error", error: error.message });
  }
});

// GET /api/vendors/analytics - Detailed analytics
router.get("/analytics", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentStats, previousStats, topPerforming, performanceData, popularMake] = await Promise.all([
      // Current period stats
      Car.aggregate([
        { $match: { seller: vendorId } },
        {
          $group: {
            _id: null,
            totalListings: { $sum: 1 },
            totalViews: { $sum: '$views' },
            totalInquiries: { $sum: '$inquiries' },
            avgPrice: { $avg: '$price' },
            activeListings: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            }
          }
        }
      ]),

      // Previous period stats for trends
      Car.aggregate([
        { $match: { seller: vendorId, listedAt: { $lte: thirtyDaysAgo } } },
        {
          $group: {
            _id: null,
            totalViews: { $sum: '$views' },
            totalInquiries: { $sum: '$inquiries' },
            avgPrice: { $avg: '$price' },
            totalListings: { $sum: 1 }
          }
        }
      ]),

      // Top performing cars
      Car.find({ seller: vendorId })
        .sort({ views: -1, inquiries: -1 })
        .limit(3)
        .select('make model year price views inquiries')
        .lean(),

      // Performance metrics
      Car.aggregate([
        { $match: { seller: vendorId } },
        {
          $group: {
            _id: null,
            avgViewsPerListing: { $avg: '$views' },
            avgInquiriesPerListing: { $avg: '$inquiries' },
            avgDaysToSell: {
              $avg: {
                $cond: [
                  { $ne: ['$soldAt', null] },
                  { $divide: [{ $subtract: ['$soldAt', '$listedAt'] }, 1000 * 60 * 60 * 24] },
                  30
                ]
              }
            }
          }
        }
      ]),

      // Most popular make
      Car.aggregate([
        { $match: { seller: vendorId } },
        { $group: { _id: '$make', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ])
    ]);

    const current = currentStats[0] || {
      totalListings: 0,
      totalViews: 0,
      totalInquiries: 0,
      avgPrice: 0,
      activeListings: 0
    };

    const previous = previousStats[0] || {
      totalViews: 0,
      totalInquiries: 0,
      avgPrice: 0,
      totalListings: 0
    };

    const performance = performanceData[0] || {
      avgViewsPerListing: 0,
      avgInquiriesPerListing: 0,
      avgDaysToSell: 30
    };

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const conversionRate = current.totalViews > 0 
      ? (current.totalInquiries / current.totalViews) * 100 
      : 0;

    res.json({
      overview: {
        totalListings: current.totalListings,
        totalViews: current.totalViews,
        totalInquiries: current.totalInquiries,
        avgPrice: Math.round(current.avgPrice),
        conversionRate,
        activeListings: current.activeListings
      },
      trends: {
        viewsChange: calculateTrend(current.totalViews, previous.totalViews),
        inquiriesChange: calculateTrend(current.totalInquiries, previous.totalInquiries),
        priceChange: calculateTrend(current.avgPrice, previous.avgPrice),
        listingsChange: calculateTrend(current.totalListings, previous.totalListings)
      },
      topPerforming,
      performance: {
        avgViewsPerListing: Math.round(performance.avgViewsPerListing * 10) / 10,
        avgInquiriesPerListing: Math.round(performance.avgInquiriesPerListing * 10) / 10,
        avgDaysToSell: Math.round(performance.avgDaysToSell),
        mostPopularMake: popularMake[0]?._id || 'N/A'
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Analytics error", error: error.message });
  }
});

// GET /api/vendors/inventory - Inventory management
router.get("/inventory", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    const {
      page = 1,
      limit = 20,
      status,
      sortBy = 'listedAt',
      sortOrder = 'desc',
      search
    } = req.query;

    const filter: any = { seller: vendorId };
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { make: new RegExp(search as string, 'i') },
        { model: new RegExp(search as string, 'i') },
        { vin: new RegExp(search as string, 'i') }
      ];
    }

    const sortOptions: any = {};
    sortOptions[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const skip = (Number(page) - 1) * Number(limit);

    const [cars, total] = await Promise.all([
      Car.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(Number(limit))
        .select('make model year price status views inquiries favorites listedAt lastUpdated images')
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
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Inventory error", error: error.message });
  }
});

// POST /api/vendors/bulk-update - Bulk update cars
router.post("/bulk-update", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    const { carIds, updates } = req.body;

    if (!carIds || !Array.isArray(carIds) || carIds.length === 0) {
      return res.status(400).json({ message: "Car IDs required" });
    }

    const validUpdates = ['status', 'featured', 'urgent', 'price'];
    const updateData: any = {};
    
    Object.keys(updates).forEach(key => {
      if (validUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No valid updates provided" });
    }

    const result = await Car.updateMany(
      {
        _id: { $in: carIds },
        seller: vendorId
      },
      { $set: updateData }
    );

    // Emit real-time update
    const io = getIO();
    io.to(`user_${vendorId}`).emit('inventoryUpdate', {
      updatedCount: result.modifiedCount,
      updates: updateData
    });

    res.json({
      message: `Updated ${result.modifiedCount} cars`,
      modifiedCount: result.modifiedCount
    });
  } catch (error: any) {
    res.status(500).json({ message: "Bulk update error", error: error.message });
  }
});

// GET /api/vendors/leads - Lead management
router.get("/leads", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    // Get cars with recent inquiries
    const carsWithInquiries = await Car.find({
      seller: vendorId,
      inquiries: { $gt: 0 }
    })
    .sort({ lastUpdated: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .select('make model year price inquiries views favorites listedAt')
    .lean();

    // Calculate lead quality score
    const leadsWithScores = carsWithInquiries.map(car => {
      const daysListed = Math.floor((Date.now() - new Date(car.listedAt).getTime()) / (1000 * 60 * 60 * 24));
      const inquiryRate = car.views > 0 ? (car.inquiries / car.views) * 100 : 0;
      const urgencyScore = daysListed > 30 ? 'high' : daysListed > 14 ? 'medium' : 'low';
      
      return {
        ...car,
        leadScore: Math.round(inquiryRate * 10) / 10,
        urgency: urgencyScore,
        daysListed
      };
    });

    const total = await Car.countDocuments({
      seller: vendorId,
      inquiries: { $gt: 0 }
    });

    res.json({
      leads: leadsWithScores,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Leads error", error: error.message });
  }
});

// GET /api/vendors/recommendations - AI-powered recommendations
router.get("/recommendations", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendorId = req.user.id;

    const [underperforming, pricingInsights, marketOpportunities] = await Promise.all([
      // Underperforming listings
      Car.find({
        seller: vendorId,
        status: 'active',
        listedAt: { $lte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        views: { $lte: 20 }
      })
      .select('make model year price views inquiries listedAt')
      .limit(5)
      .lean(),

      // Pricing insights
      Car.aggregate([
        { $match: { seller: vendorId, status: 'active' } },
        {
          $lookup: {
            from: 'cars',
            let: { make: '$make', model: '$model', year: '$year' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$make', '$$make'] },
                      { $eq: ['$model', '$$model'] },
                      { $gte: ['$year', { $subtract: ['$$year', 2] }] },
                      { $lte: ['$year', { $add: ['$$year', 2] }] },
                      { $eq: ['$status', 'active'] }
                    ]
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  avgMarketPrice: { $avg: '$price' },
                  minPrice: { $min: '$price' },
                  maxPrice: { $max: '$price' }
                }
              }
            ],
            as: 'marketData'
          }
        },
        {
          $addFields: {
            marketPrice: { $arrayElemAt: ['$marketData.avgMarketPrice', 0] },
            priceDiff: {
              $subtract: [
                '$price',
                { $arrayElemAt: ['$marketData.avgMarketPrice', 0] }
              ]
            }
          }
        },
        {
          $match: {
            marketPrice: { $ne: null },
            $or: [
              { priceDiff: { $gt: 5000 } }, // Overpriced
              { priceDiff: { $lt: -3000 } }  // Underpriced
            ]
          }
        },
        {
          $project: {
            make: 1,
            model: 1,
            year: 1,
            price: 1,
            marketPrice: 1,
            priceDiff: 1,
            views: 1,
            inquiries: 1
          }
        },
        { $limit: 5 }
      ]),

      // Market opportunities
      Car.aggregate([
        {
          $match: {
            status: 'active',
            listedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: { make: '$make', bodyType: '$bodyType' },
            count: { $sum: 1 },
            avgPrice: { $avg: '$price' },
            avgViews: { $avg: '$views' }
          }
        },
        {
          $match: {
            count: { $gte: 5 }, // Popular combinations
            avgViews: { $gte: 50 } // High interest
          }
        },
        { $sort: { avgViews: -1 } },
        { $limit: 5 }
      ])
    ]);

    const recommendations = {
      underperforming: underperforming.map(car => ({
        ...car,
        suggestion: 'Consider reducing price or improving photos/description',
        priority: 'high'
      })),
      pricing: pricingInsights.map((car: any) => ({
        ...car,
        suggestion: car.priceDiff > 0 
          ? `Consider reducing price by $${Math.abs(car.priceDiff).toLocaleString()}`
          : `You could increase price by $${Math.abs(car.priceDiff).toLocaleString()}`,
        priority: Math.abs(car.priceDiff) > 10000 ? 'high' : 'medium'
      })),
      opportunities: marketOpportunities.map((opp: any) => ({
        make: opp._id.make,
        bodyType: opp._id.bodyType,
        avgPrice: opp.avgPrice,
        avgViews: opp.avgViews,
        suggestion: `High demand for ${opp._id.make} ${opp._id.bodyType} - consider stocking more`,
        priority: 'medium'
      }))
    };

    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ message: "Recommendations error", error: error.message });
  }
});

// GET /api/vendors/reports - Comprehensive vendor reports
router.get("/reports", authenticate, requireVendor, async (req: any, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    
    // Mock report data - in real app, this would be calculated from actual data
    const mockReportData = {
      summary: {
        totalRevenue: 485000,
        totalSales: 18,
        avgSalePrice: 26944,
        totalViews: 12450,
        totalInquiries: 342,
        conversionRate: 5.3
      },
      salesByMonth: [
        { month: "Jan", sales: 5, revenue: 135000 },
        { month: "Feb", sales: 3, revenue: 78000 },
        { month: "Mar", sales: 7, revenue: 189000 },
        { month: "Apr", sales: 3, revenue: 83000 }
      ],
      topPerformingCars: [
        {
          make: "Toyota",
          model: "Camry",
          year: 2022,
          price: 28500,
          views: 245,
          inquiries: 18,
          status: "sold",
          listedDate: "2024-01-15"
        },
        {
          make: "Honda",
          model: "Civic",
          year: 2021,
          price: 24900,
          views: 198,
          inquiries: 15,
          status: "sold",
          listedDate: "2024-01-20"
        },
        {
          make: "BMW",
          model: "X3",
          year: 2023,
          price: 45900,
          views: 156,
          inquiries: 12,
          status: "active",
          listedDate: "2024-02-01"
        }
      ],
      inventoryReport: [
        {
          make: "Ford",
          model: "F-150",
          year: 2022,
          price: 38900,
          daysListed: 45,
          views: 89,
          inquiries: 7,
          status: "active"
        },
        {
          make: "Chevrolet",
          model: "Malibu",
          year: 2021,
          price: 22500,
          daysListed: 67,
          views: 34,
          inquiries: 3,
          status: "active"
        },
        {
          make: "Nissan",
          model: "Altima",
          year: 2023,
          price: 26800,
          daysListed: 23,
          views: 112,
          inquiries: 9,
          status: "active"
        }
      ]
    };

    res.json(mockReportData);
  } catch (error: any) {
    res.status(500).json({ message: "Reports error", error: error.message });
  }
});

// GET /api/vendors/report - Comprehensive vendor report (legacy endpoint)
router.get("/report", authenticate, requireVendor, async (req: any, res) => {
  try {
    const { period = '30' } = req.query;
    const report = await VendorAnalyticsService.generateVendorReport(
      req.user.id,
      parseInt(period as string)
    );
    res.json(report);
  } catch (error: any) {
    res.status(500).json({ message: "Report generation error", error: error.message });
  }
});

// GET /api/vendors/realtime - Real-time dashboard metrics
router.get("/realtime", authenticate, requireVendor, async (req: any, res) => {
  try {
    const dashboard = await VendorAnalyticsService.getRealTimeDashboard(req.user.id);
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ message: "Real-time dashboard error", error: error.message });
  }
});

// GET /api/vendors/messages - Get vendor messages
router.get("/messages", authenticate, requireVendor, async (req: any, res) => {
  try {
    // Mock data for now - in real app, this would come from a messages collection
    const mockMessages = [
      {
        _id: "1",
        customerName: "John Smith",
        customerEmail: "john@example.com",
        customerPhone: "+1-555-0123",
        carId: "car1",
        carDetails: {
          make: "Toyota",
          model: "Camry",
          year: 2022,
          price: 28500
        },
        subject: "Interested in 2022 Toyota Camry",
        lastMessage: "Is this car still available? I'd like to schedule a test drive.",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        status: "unread",
        priority: "high",
        messages: [
          {
            sender: "customer",
            content: "Hi, I'm interested in the 2022 Toyota Camry you have listed. Is it still available?",
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
          },
          {
            sender: "customer",
            content: "I'd also like to know if you accept trade-ins.",
            timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString()
          }
        ]
      },
      {
        _id: "2",
        customerName: "Sarah Johnson",
        customerEmail: "sarah@example.com",
        carId: "car2",
        carDetails: {
          make: "Honda",
          model: "Civic",
          year: 2021,
          price: 24900
        },
        subject: "Question about Honda Civic",
        lastMessage: "Thank you for the information!",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: "replied",
        priority: "medium",
        messages: [
          {
            sender: "customer",
            content: "What's the mileage on this Honda Civic?",
            timestamp: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
          },
          {
            sender: "vendor",
            content: "The Honda Civic has 15,000 miles and is in excellent condition.",
            timestamp: new Date(Date.now() - 24.5 * 60 * 60 * 1000).toISOString()
          },
          {
            sender: "customer",
            content: "Thank you for the information!",
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          }
        ]
      }
    ];

    res.json(mockMessages);
  } catch (error: any) {
    res.status(500).json({ message: "Messages error", error: error.message });
  }
});

// POST /api/vendors/messages/:id/reply - Reply to message
router.post("/messages/:id/reply", authenticate, requireVendor, async (req: any, res) => {
  try {
    const { content } = req.body;
    
    // Mock response - in real app, this would update the message in database
    const updatedMessage = {
      _id: req.params.id,
      customerName: "John Smith",
      customerEmail: "john@example.com",
      customerPhone: "+1-555-0123",
      carId: "car1",
      carDetails: {
        make: "Toyota",
        model: "Camry",
        year: 2022,
        price: 28500
      },
      subject: "Interested in 2022 Toyota Camry",
      lastMessage: content,
      timestamp: new Date().toISOString(),
      status: "replied",
      priority: "high",
      messages: [
        {
          sender: "customer",
          content: "Hi, I'm interested in the 2022 Toyota Camry you have listed. Is it still available?",
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          sender: "vendor",
          content,
          timestamp: new Date().toISOString()
        }
      ]
    };

    res.json(updatedMessage);
  } catch (error: any) {
    res.status(500).json({ message: "Reply error", error: error.message });
  }
});

// PATCH /api/vendors/messages/:id/status - Update message status
router.patch("/messages/:id/status", authenticate, requireVendor, async (req: any, res) => {
  try {
    const { status } = req.body;
    
    // Mock response - in real app, this would update the message status in database
    res.json({ message: "Status updated successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Status update error", error: error.message });
  }
});

// GET /api/vendors/profile - Vendor profile and settings
router.get("/profile", authenticate, requireVendor, async (req: any, res) => {
  try {
    const vendor = await User.findById(req.user.id)
      .select('-password')
      .lean();

    const stats = await Car.aggregate([
      { $match: { seller: req.user.id } },
      {
        $group: {
          _id: null,
          totalListings: { $sum: 1 },
          activeListing: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          soldListings: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, 1, 0] }
          },
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'sold'] }, '$price', 0] }
          },
          totalViews: { $sum: '$views' },
          totalInquiries: { $sum: '$inquiries' }
        }
      }
    ]);

    res.json({
      vendor,
      stats: stats[0] || {
        totalListings: 0,
        activeListing: 0,
        soldListings: 0,
        totalRevenue: 0,
        totalViews: 0,
        totalInquiries: 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: "Profile error", error: error.message });
  }
});

export default router;
